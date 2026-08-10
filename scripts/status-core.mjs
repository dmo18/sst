import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

export const timeoutMs = 12000;
export const maxResponseBytes = 2 * 1024 * 1024;
export const maxRetryDelayMs = 1500;

export function colorFromText(value) {
  const text = String(value || '').toLowerCase();
  if (/critical|major|outage|unavailable|down|severe/.test(text)) return 'red';
  if (/minor|degrad|partial|warning|investigat|monitor|issue|disruption|error|elevated|latency|delayed|intermittent/.test(text)) return 'amber';
  if (/none|operational|ok|good|normal|resolved|available|all systems operational/.test(text)) return 'green';
  return 'blue';
}

export function safeIncidentUrl(value, fallback) {
  try {
    const url = new URL(String(value || ''), fallback);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch { }
  return fallback;
}

function makeLog(provider, startedAt, startedMs, status, ok, message, error = '') {
  return {
    timestamp: startedAt,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    url: provider.url,
    source_type: provider.sourceType || 'unknown',
    ok,
    status,
    message,
    error
  };
}

export async function readBoundedBody(response, limit = maxResponseBytes, signal) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new Error(`Response Content-Length ${declared} exceeded ${limit} bytes`);
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > limit) throw new Error(`Response exceeded ${limit} bytes`);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error(`Response stream exceeded ${limit} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function plausibleContentType(contentType, accept) {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (!type) return false;
  if (accept.includes('json')) return type === 'application/json' || type.endsWith('+json') || type === 'text/json';
  if (accept.includes('xml') || accept.includes('rss')) return ['application/xml', 'text/xml', 'application/rss+xml', 'application/atom+xml', 'text/plain'].includes(type) || type.endsWith('+xml');
  if (accept.includes('html')) return type === 'text/html' || type === 'text/plain';
  return true;
}

const transient = new Set([408, 429, 500, 502, 503, 504]);

function retryDelay(response) {
  const value = response?.headers.get('retry-after');
  const seconds = Number(value);
  return Math.min(maxRetryDelayMs, Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 200);
}

export async function fetchSource(provider, accept = '*/*', fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const logs = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(provider.url, { signal: controller.signal, redirect: 'follow', headers: { accept, 'user-agent': `msp-status-hud/${packageVersion}` } });
      const contentType = response.headers.get('content-type') || '';
      if (!plausibleContentType(contentType, accept)) throw Object.assign(new Error(`Unsupported content-type ${contentType || 'missing'} for ${accept}`), { permanent: true });
      if (!response.ok) {
        const log = { ...makeLog(provider, startedAt, startedMs, `HTTP ${response.status}`, false, `${response.statusText}; content-type=${contentType}`), attempt, content_type: contentType };
        logs.push(log);
        if (attempt === 1 && transient.has(response.status)) {
          await sleep(retryDelay(response));
          continue;
        }
        return { ok: false, status: response.status, body: '', log, logs };
      }
      const body = await readBoundedBody(response, maxResponseBytes, controller.signal);
      const log = { ...makeLog(provider, startedAt, startedMs, `HTTP ${response.status}`, true, `${response.statusText || 'OK'}; content-type=${contentType}; bytes=${new TextEncoder().encode(body).byteLength}`), attempt, content_type: contentType };
      logs.push(log);
      return { ok: true, status: response.status, body, log, logs };
    } catch (error) {
      const aborted = controller.signal.aborted || error?.name === 'AbortError';
      const log = { ...makeLog(provider, startedAt, startedMs, aborted ? 'fetch aborted' : 'fetch failed', false, 'Fetch failed before a readable response was returned.', String(error?.message || error)), attempt, content_type: response?.headers.get('content-type') || '' };
      logs.push(log);
      if (attempt === 1 && !aborted && !error?.permanent && !/exceeded/.test(String(error?.message))) {
        await sleep(200);
        continue;
      }
      return { ok: false, status: response?.status || 0, body: '', log, logs };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('unreachable');
}

export function activeIncident(item, now = Date.now(), maxAgeDays = INCIDENT_MAX_AGE_DAYS) {
  if (!incidentEvidenceIsCurrent(item, now, maxAgeDays)) return false;
  const text = `${item.title} ${item.note} ${item.status}`.toLowerCase();
  if (/resolved|completed|postmortem|closed|fixed/.test(text)) return false;
  if (/scheduled|maintenance|planned|announcement|informational|deprecation/.test(text) && !/outage|degrad|disruption|error|latency|incident/.test(text)) return false;
  return item.color !== 'green';
}

export function summarizeProviders(providers, incidents) {
  const count = (field, value) => providers.filter(provider => provider[field] === value).length;
  const enabled = providers.filter(provider => provider.source_state !== 'disabled');
  const confirmed_operational_count = count('service_state', 'operational');
  const degraded_count = count('service_state', 'degraded');
  const major_count = count('service_state', 'major');
  const unknown_count = count('service_state', 'unknown');
  const available = count('source_state', 'available');
  const limited_count = count('source_state', 'limited');
  const unavailable_count = count('source_state', 'unavailable');
  const disabled_count = count('source_state', 'disabled');
  const pending_count = count('source_state', 'pending');
  const stale_count = count('source_state', 'stale');
  const service_overall = major_count ? 'major' : degraded_count ? 'degraded' : unknown_count ? 'unknown' : confirmed_operational_count && enabled.length === confirmed_operational_count ? 'operational' : 'unknown';
  const source_overall = unavailable_count ? 'unavailable' : stale_count ? 'stale' : limited_count ? 'limited' : pending_count ? 'pending' : available === enabled.length && enabled.length ? 'available' : disabled_count === providers.length ? 'disabled' : 'unavailable';
  return { service_overall, source_overall, active_incident_count: incidents.length, affected_provider_count: degraded_count + major_count, confirmed_operational_count, degraded_count, major_count, unknown_count, limited_count, unavailable_count, disabled_count, pending_count, stale_count, provider_total: providers.length, enabled_provider_count: enabled.length, coverage_percent: enabled.length ? Math.round(available / enabled.length * 100) : 0, confirmed_operational_percent: enabled.length ? Math.round(confirmed_operational_count / enabled.length * 100) : 0 };
}

const stateRank = { operational: 1, unknown: 1, degraded: 2, major: 3 };

export function compareSnapshots(previous, current, now = new Date().toISOString()) {
  if (!previous?.providers?.length) return [];
  const changes = [];
  const oldProviders = new Map(previous.providers.map(x => [x.id, x]));
  const oldIncidents = new Map((previous.incidents || []).map(x => [x.id, x]));
  const currentIncidents = new Map(current.incidents.map(x => [x.id, x]));
  for (const item of current.incidents) {
    const old = oldIncidents.get(item.id);
    if (!old) changes.push({ id: `${now}:${item.id}:new`, type: 'incident_new', provider_id: item.providerId, provider: item.provider, detected_at: now, title: item.title, attention: item.attention });
    else if (stateRank[item.service_state] > stateRank[old.service_state]) changes.push({ id: `${now}:${item.id}:up`, type: 'severity_increased', provider_id: item.providerId, provider: item.provider, detected_at: now, title: item.title, attention: item.attention });
    else if (stateRank[item.service_state] < stateRank[old.service_state]) changes.push({ id: `${now}:${item.id}:down`, type: 'severity_decreased', provider_id: item.providerId, provider: item.provider, detected_at: now, title: item.title, attention: 'watch' });
  }
  for (const old of oldIncidents.values()) if (!currentIncidents.has(old.id)) changes.push({ id: `${now}:${old.id}:resolved`, type: 'incident_resolved', provider_id: old.providerId, provider: old.provider, detected_at: now, title: old.title, attention: 'watch' });
  for (const item of current.providers) {
    const old = oldProviders.get(item.id);
    if (!old) continue;
    let type;
    if (old.service_state === 'operational' && ['degraded', 'major'].includes(item.service_state)) type = 'service_degraded';
    else if (['degraded', 'major'].includes(old.service_state) && item.service_state === 'operational') type = 'service_recovered';
    else if (old.source_state !== 'unavailable' && item.source_state === 'unavailable') type = 'source_unavailable';
    else if (old.source_state === 'unavailable' && item.source_state === 'available') type = 'source_recovered';
    else if (old.source_state !== 'limited' && item.source_state === 'limited') type = 'source_limited';
    else if (old.source_state === 'limited' && item.source_state === 'available') type = 'source_available';
    if (type) changes.push({ id: `${now}:${item.id}:${type}`, type, provider_id: item.id, provider: item.name, detected_at: now, title: item.status, attention: item.attention });
  }
  return changes;
}

export function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') throw new Error('Generated payload validation failed: payload must be an object');
  const providers = Array.isArray(payload.providers) ? payload.providers : [];
  const incidents = Array.isArray(payload.incidents) ? payload.incidents : [];
  const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance : [];
  if (!Array.isArray(payload.providers)) errors.push('providers must be an array');
  if (!Array.isArray(payload.incidents)) errors.push('incidents must be an array');
  if (payload.maintenance !== undefined && !Array.isArray(payload.maintenance)) errors.push('maintenance must be an array');
  const ids = new Set();
  for (const provider of providers) {
    if (ids.has(provider.id)) errors.push(`duplicate provider ${provider.id}`);
    ids.add(provider.id);
    if (!['operational', 'degraded', 'major', 'unknown'].includes(provider.service_state)) errors.push(`invalid service state ${provider.id}`);
    if (!['available', 'limited', 'unavailable', 'disabled', 'pending', 'stale'].includes(provider.source_state)) errors.push(`invalid source state ${provider.id}`);
    if (provider.source_health !== undefined && !['healthy', 'watch', 'blind'].includes(provider.source_health)) errors.push(`invalid source health ${provider.id}`);
    if (provider.truth_basis !== undefined && !['vendor-incident', 'vendor-component', 'observed-affected-no-detail', 'confirmed-operational', 'observed-no-conclusion', 'last-known-official', 'limited-official', 'no-current-observation'].includes(provider.truth_basis)) errors.push(`invalid truth basis ${provider.id}`);
    if (typeof provider.ok !== 'boolean' || !Number.isFinite(provider.priority) || !/^https?:/.test(provider.source)) errors.push(`invalid provider ${provider.id}`);
    if (provider.data_quality_score !== undefined && (!Number.isFinite(provider.data_quality_score) || provider.data_quality_score < 0 || provider.data_quality_score > 100)) errors.push(`invalid quality score ${provider.id}`);
    for (const field of ['source_latency_ms', 'last_request_ms', 'collection_elapsed_ms', 'collection_attempt_count', 'collection_success_count', 'collection_failure_count', 'freshness_seconds', 'active_incident_count', 'maintenance_count', 'problem_component_count']) {
      if (provider[field] !== undefined && (!Number.isFinite(provider[field]) || provider[field] < 0)) errors.push(`invalid ${field} ${provider.id}`);
    }
    if (provider.collection_attempt_count !== undefined && provider.collection_success_count !== undefined && provider.collection_failure_count !== undefined && provider.collection_attempt_count !== provider.collection_success_count + provider.collection_failure_count) errors.push(`collection counts do not reconcile ${provider.id}`);
  }
  const incidentIds = new Set();
  for (const incident of incidents) {
    if (!ids.has(incident.providerId)) errors.push(`unknown incident provider ${incident.providerId}`);
    if (incidentIds.has(incident.id)) errors.push(`duplicate incident ${incident.id}`);
    incidentIds.add(incident.id);
    try { if (!['http:', 'https:'].includes(new URL(incident.url).protocol)) errors.push(`invalid incident URL ${incident.id}`); } catch { errors.push(`invalid incident URL ${incident.id}`); }
    if (incident.rawTime && Date.parse(incident.rawTime) > Date.now() + 300000) errors.push(`future incident ${incident.id}`);
  }
  const maintenanceIds = new Set();
  for (const item of maintenance) {
    if (!ids.has(item.providerId)) errors.push(`unknown maintenance provider ${item.providerId}`);
    if (!item.id || maintenanceIds.has(item.id)) errors.push(`duplicate maintenance ${item.id || 'missing'}`);
    maintenanceIds.add(item.id);
    try { if (!['http:', 'https:'].includes(new URL(item.url).protocol)) errors.push(`invalid maintenance URL ${item.id}`); } catch { errors.push(`invalid maintenance URL ${item.id}`); }
    if (!['scheduled', 'in_progress', 'completed', 'unknown'].includes(item.status)) errors.push(`invalid maintenance state ${item.id}`);
    for (const field of ['starts_at', 'ends_at', 'announced_at', 'latest_update']) if (item[field] && !Number.isFinite(Date.parse(item[field]))) errors.push(`invalid maintenance ${field} ${item.id}`);
  }
  if (!Array.isArray(payload.changes) || !Array.isArray(payload.history)) errors.push('changes and history must be arrays');
  const expected = summarizeProviders(providers, incidents);
  for (const [key, value] of Object.entries(expected)) if (payload.summary?.[key] !== value) errors.push(`summary mismatch ${key}`);
  if (payload.collection !== undefined) {
    const collection = payload.collection;
    if (!collection || typeof collection !== 'object') errors.push('collection must be an object');
    else {
      for (const field of ['pipeline_version', 'run_id']) if (typeof collection[field] !== 'string' || !collection[field]) errors.push(`invalid collection ${field}`);
      for (const field of ['started_at', 'completed_at']) if (!Number.isFinite(Date.parse(collection[field] || ''))) errors.push(`invalid collection ${field}`);
      for (const field of ['duration_ms', 'provider_count', 'origin_count', 'unique_source_count', 'shared_source_count', 'request_count', 'successful_request_count', 'failed_request_count', 'request_success_percent', 'median_request_ms', 'p95_request_ms', 'quality_score', 'healthy_source_count', 'watch_source_count', 'blind_spot_count']) {
        if (!Number.isFinite(collection[field]) || collection[field] < 0) errors.push(`invalid collection ${field}`);
      }
      const attempts = providers.reduce((sum, provider) => sum + Number(provider.collection_attempt_count || 0), 0);
      const successes = providers.reduce((sum, provider) => sum + Number(provider.collection_success_count || 0), 0);
      const failures = providers.reduce((sum, provider) => sum + Number(provider.collection_failure_count || 0), 0);
      const quality = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);
      const averageQuality = quality.length ? Math.round(quality.reduce((sum, value) => sum + value, 0) / quality.length) : 0;
      if (collection.provider_count !== providers.length) errors.push('collection provider count mismatch');
      if (collection.request_count !== attempts || collection.successful_request_count !== successes || collection.failed_request_count !== failures) errors.push('collection request counts mismatch');
      if (collection.quality_score !== averageQuality) errors.push('collection quality mismatch');
      if (collection.healthy_source_count !== providers.filter(provider => provider.source_health === 'healthy').length || collection.watch_source_count !== providers.filter(provider => provider.source_health === 'watch').length || collection.blind_spot_count !== providers.filter(provider => provider.source_health === 'blind').length) errors.push('collection source health mismatch');
    }
  }
  if (payload.schema_version !== 2 || !Number.isFinite(Date.parse(payload.generated_at))) errors.push('invalid schema metadata');
  if (errors.length) throw new Error(`Generated payload validation failed: ${errors.join('; ')}`);
  return true;
}
