import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSnapshots, summarizeProviders, validatePayload } from './update-status.mjs';
import { sourceIntelligenceChanges, sourceIntelligenceSummary } from './source-intelligence.mjs';
import { sourceIntelligenceMetadataErrors } from './source-reliability.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const defaultStatusPath = path.join(root, 'public', 'status.json');
const defaultPreviousPath = path.join(root, 'public', 'previous-status.json');

export const validSourceStates = new Set(['available', 'limited', 'stale']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function validBasis(provider) {
  if (provider.source_state === 'available') return 'live-official';
  if (provider.source_state === 'stale') return 'last-known-official';
  return 'limited-official';
}

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function collectionMetrics(providers) {
  const requestCount = providers.reduce((sum, provider) => sum + Number(provider.collection_attempt_count || 0), 0);
  const successfulRequestCount = providers.reduce((sum, provider) => sum + Number(provider.collection_success_count || 0), 0);
  const failedRequestCount = providers.reduce((sum, provider) => sum + Number(provider.collection_failure_count || 0), 0);
  const quality = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);
  const authGated = providers.filter(provider => provider.health_access === 'authenticated').length;
  return {
    actionable_provider_count: providers.filter(provider => ['critical', 'action'].includes(provider.attention)).length,
    healthy_source_count: providers.filter(provider => provider.source_health === 'healthy').length,
    watch_source_count: providers.filter(provider => provider.source_health === 'watch').length,
    blind_spot_count: providers.filter(provider => provider.source_health === 'blind').length,
    auth_gated_provider_count: authGated,
    public_health_source_count: providers.length - authGated,
    average_data_quality_score: average(quality),
    request_count: requestCount,
    successful_request_count: successfulRequestCount,
    failed_request_count: failedRequestCount,
    request_success_percent: requestCount ? Math.round(successfulRequestCount / requestCount * 100) : 0,
    origin_count: new Set(providers.map(provider => provider.source_host).filter(Boolean)).size
  };
}

export function providerHasValidStatusData(provider) {
  return Boolean(
    provider
    && typeof provider.id === 'string'
    && provider.id
    && typeof provider.status === 'string'
    && provider.status
    && typeof provider.source === 'string'
    && /^https?:/.test(provider.source)
    && validSourceStates.has(provider.source_state)
    && ['operational', 'degraded', 'major', 'unknown'].includes(provider.service_state)
  );
}

export function normalizeProviderStatus(provider, incidents, now = new Date().toISOString()) {
  if (providerHasValidStatusData(provider)) {
    return {
      ...provider,
      status_data_valid: true,
      status_data_basis: validBasis(provider)
    };
  }

  if (provider.source_state === 'disabled') {
    throw new Error(`Provider ${provider.id} is disabled and cannot satisfy the all-sources-valid requirement.`);
  }

  const hasActiveIncident = incidents.some(incident => incident.providerId === provider.id);
  const reason = compact(provider.message) || compact(provider.status) || 'The official source did not return readable status data.';
  const message = `The official source could not be machine-read during this build. A fail-closed limited record was published instead. This record is not live coverage, is not operational confirmation, and is not evidence of a vendor outage. Retrieval detail: ${reason}`;
  const fallbackLog = {
    timestamp: now,
    completed_at: now,
    duration_ms: 0,
    url: provider.source,
    source_type: 'valid-status-fallback',
    ok: false,
    status: 'limited fallback',
    message: 'Published an explicit limited record after the official source failed to provide readable current data.'
  };

  return {
    ...provider,
    status: hasActiveIncident ? provider.status : 'Limited official status data',
    color: hasActiveIncident ? provider.color : 'blue',
    service_state: hasActiveIncident ? provider.service_state : 'unknown',
    source_state: 'limited',
    source_health: 'blind',
    truth_basis: 'no-current-observation',
    attention: hasActiveIncident ? provider.attention : 'watch',
    message,
    ok: false,
    source_confidence: 'none',
    evidence_tier: provider.evidence_tier || 'limited',
    data_quality_score: Math.min(12, Number(provider.data_quality_score || 12)),
    freshness_state: provider.freshness_state || 'unknown',
    download_log: [...(Array.isArray(provider.download_log) ? provider.download_log : []), fallbackLog],
    status_data_valid: true,
    status_data_basis: 'limited-fallback'
  };
}

export function normalizeStatusPayload(payload, previous = null, now = payload?.generated_at || new Date().toISOString()) {
  validatePayload(payload);

  let validPrevious = null;
  if (previous) {
    try {
      validatePayload(previous);
      validPrevious = previous;
    } catch {
      validPrevious = null;
    }
  }

  const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance : [];
  const normalizedProviders = payload.providers.map(provider => normalizeProviderStatus(provider, payload.incidents, now));
  const intelligenceMetadataErrors = normalizedProviders.flatMap(provider =>
    sourceIntelligenceMetadataErrors(provider).map(error => `${provider.id}: ${error}`)
  );
  if (intelligenceMetadataErrors.length) throw new Error(`Source intelligence metadata validation failed: ${intelligenceMetadataErrors.join('; ')}`);
  const normalizedCount = normalizedProviders.filter((provider, index) => provider.source_state !== payload.providers[index].source_state).length;
  const validStatusCount = normalizedProviders.filter(providerHasValidStatusData).length;
  const invalidStatusCount = normalizedProviders.length - validStatusCount;
  const validStatusPercent = normalizedProviders.length ? Math.round(validStatusCount / normalizedProviders.length * 100) : 0;
  const enabledProviders = normalizedProviders.filter(provider => provider.source_state !== 'disabled');
  const liveSourceCount = normalizedProviders.filter(provider => provider.source_state === 'available' && provider.ok === true).length;
  const liveSourceCoveragePercent = enabledProviders.length ? Math.round(liveSourceCount / enabledProviders.length * 100) : 0;
  const fallbackCount = normalizedProviders.filter(provider => provider.status_data_basis === 'limited-fallback').length;
  const limitedCount = normalizedProviders.filter(provider => provider.source_state === 'limited').length;
  const staleCount = normalizedProviders.filter(provider => provider.source_state === 'stale').length;
  const summarized = summarizeProviders(normalizedProviders, payload.incidents);
  const intelligence = sourceIntelligenceSummary(normalizedProviders, maintenance);
  const collectionSummary = collectionMetrics(normalizedProviders);
  const collection = payload.collection ? {
    ...payload.collection,
    provider_count: normalizedProviders.length,
    request_count: collectionSummary.request_count,
    successful_request_count: collectionSummary.successful_request_count,
    failed_request_count: collectionSummary.failed_request_count,
    request_success_percent: collectionSummary.request_success_percent,
    quality_score: collectionSummary.average_data_quality_score,
    healthy_source_count: collectionSummary.healthy_source_count,
    watch_source_count: collectionSummary.watch_source_count,
    blind_spot_count: collectionSummary.blind_spot_count
  } : undefined;
  const validatedBase = {
    ...payload,
    ...(collection ? { collection } : {}),
    maintenance,
    providers: normalizedProviders,
    summary: {
      ...payload.summary,
      ...summarized,
      ...intelligence,
      ...collectionSummary,
      valid_status_count: validStatusCount,
      invalid_status_count: invalidStatusCount,
      valid_status_percent: validStatusPercent
    }
  };

  validatePayload(validatedBase);

  const base = {
    ...validatedBase,
    summary: {
      ...validatedBase.summary,
      coverage_percent: liveSourceCoveragePercent,
      live_source_coverage_percent: liveSourceCoveragePercent,
      live_source_count: liveSourceCount,
      limited_source_count: limitedCount,
      stale_source_count: staleCount,
      fallback_source_count: fallbackCount
    }
  };
  const changes = [...compareSnapshots(validPrevious, base, now), ...sourceIntelligenceChanges(validPrevious, base, now)]
    .filter((change, index, all) => all.findIndex(candidate => candidate.id === change.id) === index);
  const normalized = {
    ...base,
    changes,
    history: [...changes, ...(validPrevious?.history || payload.history || [])].slice(0, 200),
    status_data_policy: {
      requirement: 'Every provider must publish an explicit status record, but only successfully captured current official sources count as coverage.',
      valid_source_states: [...validSourceStates],
      normalized_provider_count: normalizedCount,
      coverage_definition: 'coverage_percent and live_source_coverage_percent are the percentage of providers with a successfully captured current official source or current official status-access channel. Limited, stale, and fallback records do not count as coverage. Providers whose current health is vendor-authenticated remain service_state unknown and are counted separately by auth_gated_provider_count; they are never operational confirmation.',
      record_validity_definition: 'valid_status_percent measures structurally valid records and must not be presented as live provider coverage.',
      evidence_definition: 'source_confidence describes the quality and readability of the first-party source, not the severity or health of the vendor service.',
      collection_definition: 'source_health and data_quality_score describe the collector observation, freshness, evidence tier, parser reliability, and bounded seven-day observation SLO. They never replace vendor service state. schema_canary reports source-shape observations only and never changes service health by itself.'
    }
  };

  const invalid = normalized.providers.filter(provider => !providerHasValidStatusData(provider));
  if (invalid.length) throw new Error(`Status data requirement failed for: ${invalid.map(provider => provider.id).join(', ')}`);
  if (normalized.summary.invalid_status_count !== 0 || normalized.summary.valid_status_count !== normalized.providers.length) throw new Error('Status data summary did not reconcile to zero invalid providers.');
  if (normalized.summary.coverage_percent !== normalized.summary.live_source_coverage_percent) throw new Error('Coverage metrics must reconcile to live official source coverage.');

  const nowMs = Date.parse(now) || Date.now();
  const futureActiveMaintenance = normalized.maintenance.filter(item => item.status === 'in_progress' && Number.isFinite(Date.parse(item.starts_at || '')) && Date.parse(item.starts_at) > nowMs + 5 * 60 * 1000);
  if (futureActiveMaintenance.length) throw new Error(`Future maintenance cannot be in progress: ${futureActiveMaintenance.map(item => item.id).join(', ')}`);
  const expiredMaintenance = normalized.maintenance.filter(item => Number.isFinite(Date.parse(item.ends_at || '')) && Date.parse(item.ends_at) < nowMs - 15 * 60 * 1000);
  if (expiredMaintenance.length) throw new Error(`Expired maintenance cannot remain active: ${expiredMaintenance.map(item => item.id).join(', ')}`);
  const incidentCounts = new Map();
  for (const incident of normalized.incidents || []) incidentCounts.set(incident.providerId, Number(incidentCounts.get(incident.providerId) || 0) + 1);
  const incidentCountMismatches = normalized.providers.filter(provider => Number(provider.active_incident_count || 0) !== Number(incidentCounts.get(provider.id) || 0));
  if (incidentCountMismatches.length) throw new Error(`Provider incident counts do not reconcile: ${incidentCountMismatches.map(provider => provider.id).join(', ')}`);
  const affectedCount = normalized.providers.filter(provider => ['major', 'degraded'].includes(provider.service_state)).length;
  if (Number(normalized.summary.affected_provider_count) !== affectedCount) throw new Error(`Affected provider count does not reconcile: expected ${affectedCount}, received ${normalized.summary.affected_provider_count}`);
  const unprovenUntimed = (normalized.incidents || []).filter(incident => !incident.latest_update && !incident.first_detected && !incident.rawTime && !(incident.evidence_basis === 'current-page' && Number.isFinite(Date.parse(incident.observed_at || ''))));
  if (unprovenUntimed.length) throw new Error(`Untimed incidents require explicit current-page evidence: ${unprovenUntimed.map(incident => incident.id).join(', ')}`);
  return normalized;
}

export function enforceValidStatusFile(statusPath = defaultStatusPath, previousPath = defaultPreviousPath) {
  const payload = readJson(statusPath);
  let previous = null;
  try {
    previous = readJson(previousPath);
  } catch {
    previous = null;
  }
  const normalized = normalizeStatusPayload(payload, previous, payload.generated_at);
  writeJson(statusPath, normalized);
  return normalized;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const statusPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultStatusPath;
  const previousPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultPreviousPath;
  const payload = enforceValidStatusFile(statusPath, previousPath);
  console.log(`Validated ${payload.summary.valid_status_count}/${payload.providers.length} status records; ${payload.summary.live_source_count}/${payload.providers.length} live official sources (${payload.summary.live_source_coverage_percent}% coverage); ${payload.summary.fallback_source_count} fallbacks; ${payload.summary.maintenance_count} maintenance events; collection quality ${payload.collection?.quality_score ?? 'legacy'}.`);
}
