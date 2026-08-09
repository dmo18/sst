import { componentStatusIsProblem } from './source-intelligence.mjs';

const DEFAULT_GLOBAL_LIMIT = 10;
const DEFAULT_PER_ORIGIN_LIMIT = 2;

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return Math.round(sorted[index]);
}

export function sourceOrigin(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return 'invalid-source';
  }
}

export async function collectWithBudgets(items, resolveSource, mapper, options = {}) {
  const globalLimit = Math.max(1, Number(options.globalLimit || DEFAULT_GLOBAL_LIMIT));
  const perOriginLimit = Math.max(1, Number(options.perOriginLimit || DEFAULT_PER_ORIGIN_LIMIT));
  if (!Array.isArray(items) || items.length === 0) return [];

  const queues = new Map();
  items.forEach((item, index) => {
    let source;
    try {
      source = resolveSource(item);
    } catch {
      source = null;
    }
    const origin = sourceOrigin(source?.url || item?.url);
    const queue = queues.get(origin) || [];
    queue.push({ item, index, origin });
    queues.set(origin, queue);
  });

  const origins = [...queues.keys()];
  const activeByOrigin = new Map(origins.map(origin => [origin, 0]));
  const results = new Array(items.length);
  let active = 0;
  let completed = 0;
  let cursor = 0;
  let settled = false;

  return new Promise((resolve, reject) => {
    const takeNext = () => {
      for (let offset = 0; offset < origins.length; offset += 1) {
        const index = (cursor + offset) % origins.length;
        const origin = origins[index];
        const queue = queues.get(origin);
        if (queue?.length && Number(activeByOrigin.get(origin) || 0) < perOriginLimit) {
          cursor = (index + 1) % origins.length;
          return queue.shift();
        }
      }
      return null;
    };

    const pump = () => {
      if (settled) return;
      while (active < globalLimit) {
        const next = takeNext();
        if (!next) break;
        active += 1;
        activeByOrigin.set(next.origin, Number(activeByOrigin.get(next.origin) || 0) + 1);
        Promise.resolve(mapper(next.item))
          .then(result => {
            results[next.index] = result;
          })
          .catch(error => {
            settled = true;
            reject(error);
          })
          .finally(() => {
            active -= 1;
            activeByOrigin.set(next.origin, Math.max(0, Number(activeByOrigin.get(next.origin) || 1) - 1));
            completed += 1;
            if (settled) return;
            if (completed === items.length) {
              settled = true;
              resolve(results);
              return;
            }
            pump();
          });
      }
    };

    pump();
  });
}

function evidenceBase(provider) {
  switch (provider.evidence_tier) {
    case 'structured': return 96;
    case 'feed': return 86;
    case 'rendered-page': return 76;
    case 'public-page': return 66;
    case 'limited': return 28;
    default: return 52;
  }
}

function freshness(provider, nowMs) {
  const value = provider.last_success_at || (provider.ok ? provider.checked_at : '');
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return { seconds: undefined, state: 'unknown' };
  const seconds = Math.max(0, Math.round((nowMs - timestamp) / 1000));
  if (seconds <= 30 * 60) return { seconds, state: 'fresh' };
  if (seconds <= 60 * 60) return { seconds, state: 'aging' };
  return { seconds, state: 'stale' };
}

function retrievalLogs(provider) {
  return (Array.isArray(provider.download_log) ? provider.download_log : []).filter(log =>
    log
    && log.source_type !== 'valid-status-fallback'
    && log.status !== 'parser result'
    && typeof log.url === 'string'
  );
}

export function providerQualityScore(provider, now = Date.now()) {
  const fresh = freshness(provider, now);
  let score = evidenceBase(provider);
  if (provider.source_state === 'limited') score = Math.min(score, 38);
  if (provider.source_state === 'stale') score = Math.min(score, 34);
  if (provider.source_state === 'unavailable' || provider.source_state === 'pending') score = Math.min(score, 12);
  if (provider.source_state === 'disabled') score = 0;
  if (provider.ok !== true) score -= 8;
  score -= Math.min(32, Number(provider.consecutive_failures || 0) * 9);
  if (provider.schema_changed === true) score -= 12;
  if (fresh.state === 'aging') score -= 8;
  if (fresh.state === 'stale') score -= 22;
  if (fresh.state === 'unknown' && provider.source_state === 'available') score -= 10;
  return clamp(score);
}

function sourceHealth(provider, score) {
  if (provider.source_state === 'available' && provider.ok === true && score >= 74) return 'healthy';
  if (provider.source_state === 'unavailable' || provider.source_state === 'pending' || score < 28) return 'blind';
  return 'watch';
}

function truthBasis(provider, incidentCount = 0, problemComponentCount = 0) {
  if (['major', 'degraded'].includes(provider.service_state) && provider.source_state === 'available') {
    if (incidentCount > 0) return 'vendor-incident';
    if (problemComponentCount > 0) return 'vendor-component';
    return 'observed-affected-no-detail';
  }
  if (provider.service_state === 'operational' && provider.source_state === 'available') return 'confirmed-operational';
  if (provider.source_state === 'available') return 'observed-no-conclusion';
  if (provider.source_state === 'stale') return 'last-known-official';
  if (provider.source_state === 'limited') return 'limited-official';
  return 'no-current-observation';
}

export function enrichProviderCollection(provider, incidents = [], maintenance = [], now = new Date().toISOString()) {
  const nowMs = Date.parse(now) || Date.now();
  const logs = retrievalLogs(provider);
  const durations = logs.map(log => Number(log.duration_ms)).filter(Number.isFinite);
  const quality = providerQualityScore(provider, nowMs);
  const fresh = freshness(provider, nowMs);
  const problemComponents = (provider.component_status || []).filter(component => componentStatusIsProblem(component.status)).length;
  const incidentCount = incidents.filter(item => item.providerId === provider.id).length;
  const sourceUrl = provider.source || '';
  let sourceHost = '';
  try {
    sourceHost = new URL(sourceUrl).hostname;
  } catch { }
  return {
    ...provider,
    source_health: sourceHealth(provider, quality),
    truth_basis: truthBasis(provider, incidentCount, problemComponents),
    data_quality_score: quality,
    source_latency_ms: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0)) : 0,
    collection_attempt_count: logs.length,
    collection_success_count: logs.filter(log => log.ok === true).length,
    collection_failure_count: logs.filter(log => log.ok === false).length,
    source_host: sourceHost,
    freshness_state: fresh.state,
    ...(fresh.seconds === undefined ? {} : { freshness_seconds: fresh.seconds }),
    active_incident_count: incidentCount,
    maintenance_count: maintenance.filter(item => item.providerId === provider.id).length,
    problem_component_count: problemComponents
  };
}

export function buildCollectionIntelligence(providers, incidents, maintenance, startedAt, completedAt) {
  const completedMs = Date.parse(completedAt) || Date.now();
  const startedMs = Date.parse(startedAt) || completedMs;
  const enrichedProviders = providers.map(provider => enrichProviderCollection(provider, incidents, maintenance, completedAt));
  const allLogs = enrichedProviders.flatMap(provider => retrievalLogs(provider));
  const durations = allLogs.map(log => Number(log.duration_ms)).filter(Number.isFinite);
  const sourceUrls = new Set(enrichedProviders.map(provider => provider.source).filter(Boolean));
  const origins = new Set([...sourceUrls].map(sourceOrigin));
  const qualityScore = enrichedProviders.length
    ? Math.round(enrichedProviders.reduce((sum, provider) => sum + Number(provider.data_quality_score || 0), 0) / enrichedProviders.length)
    : 0;
  const healthy = enrichedProviders.filter(provider => provider.source_health === 'healthy').length;
  const watch = enrichedProviders.filter(provider => provider.source_health === 'watch').length;
  const blind = enrichedProviders.filter(provider => provider.source_health === 'blind').length;
  const authGated = enrichedProviders.filter(provider => provider.health_access === 'authenticated').length;
  const publiclyObservable = enrichedProviders.length - authGated;
  const requestCount = allLogs.length;
  const successfulRequests = allLogs.filter(log => log.ok === true).length;
  const failedRequests = allLogs.filter(log => log.ok === false).length;
  const actionable = enrichedProviders.filter(provider => ['critical', 'action'].includes(provider.attention)).length;

  return {
    providers: enrichedProviders,
    summary: {
      actionable_provider_count: actionable,
      healthy_source_count: healthy,
      watch_source_count: watch,
      blind_spot_count: blind,
      auth_gated_provider_count: authGated,
      public_health_source_count: publiclyObservable,
      average_data_quality_score: qualityScore,
      request_count: requestCount,
      successful_request_count: successfulRequests,
      failed_request_count: failedRequests,
      request_success_percent: requestCount ? Math.round(successfulRequests / requestCount * 100) : 0,
      origin_count: origins.size,
      median_request_ms: percentile(durations, 0.5),
      p95_request_ms: percentile(durations, 0.95)
    },
    collection: {
      pipeline_version: '3.0.0',
      run_id: `run-${String(completedAt).replace(/[^0-9]/g, '').slice(0, 14)}`,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Math.max(0, completedMs - startedMs),
      provider_count: enrichedProviders.length,
      origin_count: origins.size,
      unique_source_count: sourceUrls.size,
      shared_source_count: Math.max(0, enrichedProviders.length - sourceUrls.size),
      request_count: requestCount,
      successful_request_count: successfulRequests,
      failed_request_count: failedRequests,
      request_success_percent: requestCount ? Math.round(successfulRequests / requestCount * 100) : 0,
      median_request_ms: percentile(durations, 0.5),
      p95_request_ms: percentile(durations, 0.95),
      quality_score: qualityScore,
      healthy_source_count: healthy,
      watch_source_count: watch,
      blind_spot_count: blind,
      auth_gated_provider_count: authGated,
      public_health_source_count: publiclyObservable
    }
  };
}
