import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseAzureEntraStatus } from './entra-status-adapter.mjs';
import { parseStatuspageSummary } from './structured-source-adapters.mjs';
import { resolveDeployedStatus } from './deployed-status.mjs';

const DEFAULT_STATUS_URL = 'https://dmo18.github.io/sst/status.json';
const REQUEST_TIMEOUT_MS = 8_000;
const STALE_AFTER_MINUTES = 10;
const MAX_CONCURRENCY = 8;

function cacheBust(url, token) {
  const parsed = new URL(url);
  parsed.searchParams.set('truthWatch', String(token));
  return parsed.toString();
}

async function fetchResponse(fetchImpl, url) {
  return fetchImpl(url, {
    cache: 'no-store',
    headers: { accept: 'application/json,text/html;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchResponse(fetchImpl, url);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

async function fetchText(fetchImpl, url) {
  const response = await fetchResponse(fetchImpl, url);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.text();
}

function cleanIncidentId(value, providerId) {
  const id = String(value || '');
  return id.startsWith(`${providerId}:`) ? id.slice(providerId.length + 1) : id;
}

function deployedIncidentIds(payload, providerId) {
  return (payload.incidents || [])
    .filter(incident => incident.providerId === providerId)
    .map(incident => cleanIncidentId(incident.id, providerId))
    .filter(Boolean)
    .sort();
}

export function deployedProblemState(provider, payload = { incidents: [] }) {
  const active = provider?.service_state === 'major'
    || provider?.service_state === 'degraded'
    || Number(provider?.active_incident_count || 0) > 0
    || Number(provider?.problem_component_count || 0) > 0;
  return {
    known: Boolean(provider),
    active,
    incidentIds: provider ? deployedIncidentIds(payload, provider.id) : []
  };
}

export function parsedProblemState(parsed) {
  if (!parsed || typeof parsed !== 'object') return { known: false, active: false, incidentIds: [] };
  if (parsed.kind === 'healthy') return { known: true, active: false, incidentIds: [] };
  if (parsed.kind === 'issues') {
    return {
      known: true,
      active: true,
      incidentIds: (parsed.incidents || []).map(incident => String(incident.id || '')).filter(Boolean).sort()
    };
  }
  if (parsed.kind === 'issue' || parsed.kind === 'component-state') {
    const incidentId = String(parsed.id || '').trim();
    return { known: true, active: true, incidentIds: incidentId ? [incidentId] : [] };
  }
  return { known: false, active: false, incidentIds: [] };
}

export function truthDrift(provider, payload, parsed) {
  const deployed = deployedProblemState(provider, payload);
  const live = parsedProblemState(parsed);
  if (!deployed.known || !live.known) return null;
  if (deployed.active !== live.active) {
    return {
      providerId: provider.id,
      reason: live.active ? 'official-source-opened' : 'official-source-cleared',
      deployed,
      live
    };
  }
  if (!live.active || !live.incidentIds.length) return null;
  if (deployed.incidentIds.join('|') !== live.incidentIds.join('|')) {
    return {
      providerId: provider.id,
      reason: 'official-incident-set-changed',
      deployed,
      live
    };
  }
  return null;
}

async function mapBounded(items, mapper, limit = MAX_CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function statuspageWatchTargets(payload) {
  return (payload.providers || []).filter(provider =>
    provider.source_type === 'statuspage-json'
    && typeof provider.source === 'string'
    && /\/api\/v2\/summary\.json(?:$|\?)/i.test(provider.source)
  );
}

async function inspectStatuspageProvider(provider, payload, fetchImpl, token) {
  const sourceUrl = cacheBust(provider.source, token);
  try {
    const body = JSON.stringify(await fetchJson(fetchImpl, sourceUrl));
    const parsed = parseStatuspageSummary(body, { id: provider.id, name: provider.name }, {
      url: provider.source,
      pageUrl: provider.source.replace(/\/api\/v2\/summary\.json(?:\?.*)?$/i, '/'),
      regionScope: 'us'
    });
    return { providerId: provider.id, checked: true, error: '', drift: truthDrift(provider, payload, parsed) };
  }
  catch (error) {
    return { providerId: provider.id, checked: false, error: error instanceof Error ? error.message : String(error), drift: null };
  }
}

async function inspectEntra(payload, fetchImpl, token) {
  const provider = (payload.providers || []).find(item => item.id === 'entra');
  if (!provider?.source) return { providerId: 'entra', checked: false, error: 'Entra source missing from deployed payload', drift: null };
  try {
    const html = await fetchText(fetchImpl, cacheBust(provider.source, token));
    const parsed = parseAzureEntraStatus(html);
    return { providerId: provider.id, checked: true, error: '', drift: truthDrift(provider, payload, parsed) };
  }
  catch (error) {
    return { providerId: provider.id, checked: false, error: error instanceof Error ? error.message : String(error), drift: null };
  }
}

export async function checkStatusTruth({
  fetchImpl = fetch,
  statusUrl = process.env.STATUS_URL || DEFAULT_STATUS_URL,
  now = Date.now()
} = {}) {
  const deployed = await resolveDeployedStatus(statusUrl.replace(/status\.json(?:\?.*)?$/i, ''), { fetchImpl, token: now });
  const payload = await fetchJson(fetchImpl, deployed.statusUrl);
  const generatedAt = Date.parse(payload.generated_at || '');
  const ageMinutes = Number.isFinite(generatedAt) ? Math.max(0, Math.floor((now - generatedAt) / 60_000)) : Number.POSITIVE_INFINITY;
  const targets = statuspageWatchTargets(payload);
  const checks = await mapBounded(targets, provider => inspectStatuspageProvider(provider, payload, fetchImpl, now));
  checks.push(await inspectEntra(payload, fetchImpl, now));
  const drifts = checks.map(item => item.drift).filter(Boolean);
  const failures = checks.filter(item => !item.checked);

  return {
    payload,
    deployedStatusPath: deployed.statusPath,
    ageMinutes,
    stale: !Number.isFinite(ageMinutes) || ageMinutes > STALE_AFTER_MINUTES,
    inspectedCount: checks.length,
    failureCount: failures.length,
    failures,
    drift: drifts.length > 0,
    driftCount: drifts.length,
    drifts
  };
}

function githubOutput(values) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${String(value)}\n`).join('');
  fs.appendFileSync(output, lines);
}

async function main() {
  const result = await checkStatusTruth();
  console.log(`TRUTH_WATCH status_path=${result.deployedStatusPath} payload_age_minutes=${Number.isFinite(result.ageMinutes) ? result.ageMinutes : 'invalid'} inspected=${result.inspectedCount} failures=${result.failureCount} drift=${result.driftCount}`);
  for (const item of result.drifts) {
    console.log(`TRUTH_DRIFT ${item.providerId} reason=${item.reason} deployed=${item.deployed.active ? 'active' : 'clear'} live=${item.live.active ? 'active' : 'clear'} deployed_incidents=${item.deployed.incidentIds.join(',') || 'none'} live_incidents=${item.live.incidentIds.join(',') || 'none'}`);
  }
  for (const failure of result.failures.slice(0, 8)) {
    console.warn(`TRUTH_WATCH_UNAVAILABLE ${failure.providerId} ${failure.error}`);
  }
  githubOutput({
    stale: result.stale,
    drift: result.drift,
    age_minutes: Number.isFinite(result.ageMinutes) ? result.ageMinutes : 9999,
    drift_count: result.driftCount,
    inspected_count: result.inspectedCount,
    failure_count: result.failureCount
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`TRUTH_WATCH_FATAL ${error instanceof Error ? error.stack || error.message : String(error)}`);
    githubOutput({ stale: true, drift: false, age_minutes: 9999, drift_count: 0, inspected_count: 0, failure_count: 1 });
    process.exitCode = 0;
  });
}
