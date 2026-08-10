import { componentStatusIsProblem } from './componentStatus.ts';
import {
  ATTENTION_LEVELS,
  CURRENT_PAGE_EVIDENCE_BASIS,
  EVIDENCE_TIERS,
  FRESHNESS_STATES,
  MAINTENANCE_STATES,
  SERVICE_STATES,
  SOURCE_CONFIDENCE_LEVELS,
  SOURCE_HEALTH_STATES,
  SOURCE_STATES,
  STATUS_COLORS,
  TRUTH_BASES,
  incidentTemporalEvidence
} from './statusContract.ts';
import type { StatusPayload } from './types';

const services = new Set<string>(SERVICE_STATES);
const sources = new Set<string>(SOURCE_STATES);
const sourceHealth = new Set<string>(SOURCE_HEALTH_STATES);
const truthBasis = new Set<string>(TRUTH_BASES);
const freshness = new Set<string>(FRESHNESS_STATES);
const colors = new Set<string>(STATUS_COLORS);
const attention = new Set<string>(ATTENTION_LEVELS);
const confidence = new Set<string>(SOURCE_CONFIDENCE_LEVELS);
const evidence = new Set<string>(EVIDENCE_TIERS);
const maintenanceStates = new Set<string>(MAINTENANCE_STATES);

const http = (value: unknown): boolean => {
  try {
    return typeof value === 'string' && ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validDate = (value: unknown): boolean => typeof value === 'string' && Number.isFinite(Date.parse(value));
const finiteNonNegative = (value: unknown): boolean => Number.isFinite(value) && Number(value) >= 0;
const percentage = (value: unknown): boolean => finiteNonNegative(value) && Number(value) <= 100;

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function payloadValidationErrors(value: unknown, expectedProviderIds: readonly string[] = []): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return ['payload must be an object'];
  const payload = value as Record<string, unknown>;

  if (payload.schema_version !== 2) errors.push('unsupported schema_version');
  if (!validDate(payload.generated_at)) errors.push('invalid generated_at');
  else if (Date.parse(String(payload.generated_at)) > Date.now() + 300000) errors.push('generated_at is materially in the future');
  if (!Array.isArray(payload.providers)) errors.push('providers must be an array');
  if (!Array.isArray(payload.incidents)) errors.push('incidents must be an array');
  if (payload.maintenance !== undefined && !Array.isArray(payload.maintenance)) errors.push('maintenance must be an array');
  if (!Array.isArray(payload.changes) || !Array.isArray(payload.history)) errors.push('changes and history must be arrays');

  const providers = Array.isArray(payload.providers) ? payload.providers as Record<string, unknown>[] : [];
  const ids = new Set<string>();
  for (const provider of providers) {
    if (!provider || typeof provider !== 'object') {
      errors.push('provider must be an object');
      continue;
    }
    for (const key of ['id', 'name', 'category', 'status', 'source']) {
      if (typeof provider[key] !== 'string' || !provider[key]) errors.push(`provider ${String(provider.id)} missing ${key}`);
    }
    if (ids.has(String(provider.id))) errors.push(`duplicate provider ${String(provider.id)}`);
    ids.add(String(provider.id));
    if (!services.has(String(provider.service_state))) errors.push(`invalid service_state ${String(provider.id)}`);
    if (!sources.has(String(provider.source_state))) errors.push(`invalid source_state ${String(provider.id)}`);
    if (provider.source_health !== undefined && !sourceHealth.has(String(provider.source_health))) errors.push(`invalid source_health ${String(provider.id)}`);
    if (provider.truth_basis !== undefined && !truthBasis.has(String(provider.truth_basis))) errors.push(`invalid truth_basis ${String(provider.id)}`);
    if (!colors.has(String(provider.color))) errors.push(`invalid color ${String(provider.id)}`);
    if (!attention.has(String(provider.attention))) errors.push(`invalid attention ${String(provider.id)}`);
    if (typeof provider.ok !== 'boolean') errors.push(`invalid ok ${String(provider.id)}`);
    if (!Number.isFinite(provider.priority) || Number(provider.priority) < 0) errors.push(`invalid priority ${String(provider.id)}`);
    if (!http(provider.source)) errors.push(`invalid source URL ${String(provider.id)}`);
    if (provider.source_host !== undefined && typeof provider.source_host !== 'string') errors.push(`invalid source_host ${String(provider.id)}`);
    if (provider.evidence_tier !== undefined && !evidence.has(String(provider.evidence_tier))) errors.push(`invalid evidence tier ${String(provider.id)}`);
    if (provider.source_confidence !== undefined && !confidence.has(String(provider.source_confidence))) errors.push(`invalid source confidence ${String(provider.id)}`);
    if (provider.consecutive_failures !== undefined && (!Number.isInteger(provider.consecutive_failures) || Number(provider.consecutive_failures) < 0)) errors.push(`invalid failure streak ${String(provider.id)}`);
    if (provider.freshness_state !== undefined && !freshness.has(String(provider.freshness_state))) errors.push(`invalid freshness_state ${String(provider.id)}`);
    for (const key of ['checked_at', 'last_success_at', 'last_semantic_change_at']) {
      if (provider[key] && !validDate(provider[key])) errors.push(`invalid ${key} ${String(provider.id)}`);
    }
    const numericFields = ['source_latency_ms', 'last_request_ms', 'collection_elapsed_ms', 'collection_attempt_count', 'collection_success_count', 'collection_failure_count', 'freshness_seconds', 'active_incident_count', 'maintenance_count', 'problem_component_count'];
    for (const key of numericFields) if (provider[key] !== undefined && !finiteNonNegative(provider[key])) errors.push(`invalid ${key} ${String(provider.id)}`);
    if (provider.data_quality_score !== undefined && !percentage(provider.data_quality_score)) errors.push(`invalid data_quality_score ${String(provider.id)}`);
    if (provider.collection_attempt_count !== undefined && provider.collection_success_count !== undefined && provider.collection_failure_count !== undefined && Number(provider.collection_attempt_count) !== Number(provider.collection_success_count) + Number(provider.collection_failure_count)) errors.push(`collection counts do not reconcile ${String(provider.id)}`);
    if (provider.component_status !== undefined && !Array.isArray(provider.component_status)) errors.push(`invalid component status ${String(provider.id)}`);
  }

  if (expectedProviderIds.length) {
    const expected = new Set(expectedProviderIds);
    const missing = expectedProviderIds.filter(id => !ids.has(id));
    const unexpected = [...ids].filter(id => !expected.has(id));
    if (missing.length || unexpected.length) errors.push(`provider catalog mismatch missing=[${missing.join(',')}] unexpected=[${unexpected.join(',')}]`);
  }

  const incidents = Array.isArray(payload.incidents) ? payload.incidents as Record<string, unknown>[] : [];
  const incidentIds = new Set<string>();
  for (const incident of incidents) {
    if (!ids.has(String(incident.providerId))) errors.push(`unknown incident provider ${String(incident.providerId)}`);
    if (incidentIds.has(String(incident.id))) errors.push(`duplicate incident ${String(incident.id)}`);
    incidentIds.add(String(incident.id));
    if (!http(incident.url)) errors.push(`invalid incident URL ${String(incident.id)}`);
    if (!['degraded', 'major'].includes(String(incident.service_state))) errors.push(`invalid incident state ${String(incident.id)}`);
    if (!attention.has(String(incident.attention))) errors.push(`invalid incident attention ${String(incident.id)}`);
    if (incident.evidence_basis !== undefined && incident.evidence_basis !== CURRENT_PAGE_EVIDENCE_BASIS) errors.push(`invalid incident evidence_basis ${String(incident.id)}`);
    if (incident.observed_at !== undefined && !validDate(incident.observed_at)) errors.push(`invalid incident observed_at ${String(incident.id)}`);
    const temporal = incidentTemporalEvidence({
      latest_update: typeof incident.latest_update === 'string' ? incident.latest_update : undefined,
      rawTime: typeof incident.rawTime === 'string' ? incident.rawTime : undefined,
      first_detected: typeof incident.first_detected === 'string' ? incident.first_detected : undefined,
      observed_at: typeof incident.observed_at === 'string' ? incident.observed_at : undefined,
      evidence_basis: typeof incident.evidence_basis === 'string' ? incident.evidence_basis : undefined
    });
    if (!temporal.valid) errors.push(`invalid incident temporal evidence ${String(incident.id)}`);
    if (incident.updates !== undefined && !Array.isArray(incident.updates)) errors.push(`invalid incident updates ${String(incident.id)}`);
  }

  const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance as Record<string, unknown>[] : [];
  const maintenanceIds = new Set<string>();
  for (const item of maintenance) {
    if (!ids.has(String(item.providerId))) errors.push(`unknown maintenance provider ${String(item.providerId)}`);
    if (!item.id || maintenanceIds.has(String(item.id))) errors.push(`duplicate maintenance ${String(item.id || 'missing')}`);
    maintenanceIds.add(String(item.id));
    if (!http(item.url)) errors.push(`invalid maintenance URL ${String(item.id)}`);
    if (!maintenanceStates.has(String(item.status))) errors.push(`invalid maintenance state ${String(item.id)}`);
    if (!attention.has(String(item.attention))) errors.push(`invalid maintenance attention ${String(item.id)}`);
    for (const key of ['starts_at', 'ends_at', 'announced_at', 'latest_update']) {
      if (item[key] && !validDate(item[key])) errors.push(`invalid maintenance timestamp ${String(item.id)}`);
    }
  }

  const summary = payload.summary as Record<string, unknown> | undefined;
  if (!summary || typeof summary !== 'object') {
    errors.push('summary must be an object');
  } else {
    if (!services.has(String(summary.service_overall))) errors.push('invalid summary service_overall');
    if (!sources.has(String(summary.source_overall))) errors.push('invalid summary source_overall');
    const requiredNumeric = [
      'active_incident_count', 'affected_provider_count', 'confirmed_operational_count', 'degraded_count',
      'major_count', 'unknown_count', 'limited_count', 'unavailable_count', 'disabled_count', 'pending_count',
      'stale_count', 'provider_total', 'enabled_provider_count', 'coverage_percent', 'live_source_coverage_percent',
      'valid_status_count', 'invalid_status_count', 'valid_status_percent', 'confirmed_operational_percent'
    ];
    const optionalNumeric = [
      'maintenance_count', 'ongoing_maintenance_count', 'structured_source_count', 'feed_source_count',
      'page_source_count', 'high_confidence_source_count', 'schema_change_count', 'failure_streak_count',
      'component_issue_count', 'actionable_provider_count', 'healthy_source_count', 'watch_source_count',
      'blind_spot_count', 'average_data_quality_score', 'request_count', 'successful_request_count',
      'failed_request_count', 'request_success_percent', 'origin_count', 'median_request_ms', 'p95_request_ms'
    ];
    for (const key of requiredNumeric) if (!finiteNonNegative(summary[key])) errors.push(`invalid summary ${key}`);
    for (const key of optionalNumeric) if (summary[key] !== undefined && !finiteNonNegative(summary[key])) errors.push(`invalid summary ${key}`);
    for (const key of ['coverage_percent', 'live_source_coverage_percent', 'valid_status_percent', 'confirmed_operational_percent', 'average_data_quality_score', 'request_success_percent']) if (summary[key] !== undefined && !percentage(summary[key])) errors.push(`invalid summary percentage ${key}`);
    if (summary.provider_total !== providers.length) errors.push('provider count mismatch');
    if (summary.active_incident_count !== incidents.length) errors.push('incident count mismatch');
    if (summary.affected_provider_count !== providers.filter(provider => ['degraded', 'major'].includes(String(provider.service_state))).length) errors.push('affected provider count mismatch');

    const count = (key: string, state: string) => providers.filter(provider => provider[key] === state).length;
    if (summary.confirmed_operational_count !== count('service_state', 'operational') || summary.degraded_count !== count('service_state', 'degraded') || summary.major_count !== count('service_state', 'major') || summary.unknown_count !== count('service_state', 'unknown')) errors.push('service counts do not reconcile');
    if (summary.limited_count !== count('source_state', 'limited') || summary.unavailable_count !== count('source_state', 'unavailable') || summary.disabled_count !== count('source_state', 'disabled') || summary.pending_count !== count('source_state', 'pending') || summary.stale_count !== count('source_state', 'stale')) errors.push('source counts do not reconcile');

    const enabled = providers.filter(provider => provider.source_state !== 'disabled');
    const available = count('source_state', 'available');
    const validStatusCount = providers.filter(provider => provider.status_data_valid === true || ['available', 'limited', 'stale'].includes(String(provider.source_state))).length;
    const expectedValidStatusPercent = providers.length ? Math.round(validStatusCount / providers.length * 100) : 0;
    const expectedLiveSourceCoverage = enabled.length ? Math.round(available / enabled.length * 100) : 0;
    const expectedOperational = enabled.length ? Math.round(count('service_state', 'operational') / enabled.length * 100) : 0;
    if (summary.enabled_provider_count !== enabled.length || summary.coverage_percent !== expectedLiveSourceCoverage || summary.live_source_coverage_percent !== expectedLiveSourceCoverage || summary.valid_status_count !== validStatusCount || summary.invalid_status_count !== providers.length - validStatusCount || summary.valid_status_percent !== expectedValidStatusPercent || summary.confirmed_operational_percent !== expectedOperational) errors.push('coverage counts do not reconcile');

    const qualityValues = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);
    const optionalExpected: Record<string, number> = {
      maintenance_count: maintenance.length,
      ongoing_maintenance_count: maintenance.filter(item => item.status === 'in_progress').length,
      structured_source_count: providers.filter(provider => provider.source_state === 'available' && provider.evidence_tier === 'structured').length,
      feed_source_count: providers.filter(provider => provider.source_state === 'available' && provider.evidence_tier === 'feed').length,
      page_source_count: providers.filter(provider => provider.source_state === 'available' && ['rendered-page', 'public-page'].includes(String(provider.evidence_tier))).length,
      high_confidence_source_count: providers.filter(provider => provider.source_confidence === 'high').length,
      schema_change_count: providers.filter(provider => provider.schema_changed === true).length,
      failure_streak_count: providers.filter(provider => Number(provider.consecutive_failures || 0) >= 2).length,
      component_issue_count: providers.flatMap(provider => Array.isArray(provider.component_status) ? provider.component_status as Record<string, unknown>[] : []).filter(component => componentStatusIsProblem(component.status)).length,
      actionable_provider_count: providers.filter(provider => ['critical', 'action'].includes(String(provider.attention))).length,
      healthy_source_count: count('source_health', 'healthy'),
      watch_source_count: count('source_health', 'watch'),
      blind_spot_count: count('source_health', 'blind'),
      average_data_quality_score: average(qualityValues),
      request_count: providers.reduce((sum, provider) => sum + Number(provider.collection_attempt_count || 0), 0),
      successful_request_count: providers.reduce((sum, provider) => sum + Number(provider.collection_success_count || 0), 0),
      failed_request_count: providers.reduce((sum, provider) => sum + Number(provider.collection_failure_count || 0), 0),
      origin_count: new Set(providers.map(provider => provider.source_host || (() => { try { return new URL(String(provider.source)).hostname; } catch { return ''; } })()).filter(Boolean)).size
    };
    optionalExpected.request_success_percent = optionalExpected.request_count ? Math.round(optionalExpected.successful_request_count / optionalExpected.request_count * 100) : 0;
    for (const [key, expected] of Object.entries(optionalExpected)) if (summary[key] !== undefined && summary[key] !== expected) errors.push(`summary ${key} does not reconcile`);
  }

  if (payload.collection !== undefined) {
    if (!payload.collection || typeof payload.collection !== 'object') {
      errors.push('collection must be an object');
    } else {
      const collection = payload.collection as Record<string, unknown>;
      for (const key of ['pipeline_version', 'run_id']) if (typeof collection[key] !== 'string' || !collection[key]) errors.push(`invalid collection ${key}`);
      for (const key of ['started_at', 'completed_at']) if (!validDate(collection[key])) errors.push(`invalid collection ${key}`);
      const numeric = ['duration_ms', 'provider_count', 'origin_count', 'unique_source_count', 'shared_source_count', 'request_count', 'successful_request_count', 'failed_request_count', 'request_success_percent', 'median_request_ms', 'p95_request_ms', 'quality_score', 'healthy_source_count', 'watch_source_count', 'blind_spot_count'];
      for (const key of numeric) if (!finiteNonNegative(collection[key])) errors.push(`invalid collection ${key}`);
      for (const key of ['request_success_percent', 'quality_score']) if (!percentage(collection[key])) errors.push(`invalid collection percentage ${key}`);
      const providerAttempts = providers.reduce((sum, provider) => sum + Number(provider.collection_attempt_count || 0), 0);
      const providerSuccesses = providers.reduce((sum, provider) => sum + Number(provider.collection_success_count || 0), 0);
      const providerFailures = providers.reduce((sum, provider) => sum + Number(provider.collection_failure_count || 0), 0);
      const qualityValues = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);
      if (collection.provider_count !== providers.length) errors.push('collection provider_count mismatch');
      if (collection.healthy_source_count !== providers.filter(provider => provider.source_health === 'healthy').length || collection.watch_source_count !== providers.filter(provider => provider.source_health === 'watch').length || collection.blind_spot_count !== providers.filter(provider => provider.source_health === 'blind').length) errors.push('collection source health counts do not reconcile');
      if (collection.request_count !== providerAttempts || collection.successful_request_count !== providerSuccesses || collection.failed_request_count !== providerFailures) errors.push('collection request counts do not reconcile');
      if (collection.request_success_percent !== (providerAttempts ? Math.round(providerSuccesses / providerAttempts * 100) : 0)) errors.push('collection request success does not reconcile');
      if (collection.quality_score !== average(qualityValues)) errors.push('collection quality does not reconcile');
      if (validDate(collection.started_at) && validDate(collection.completed_at) && Date.parse(String(collection.completed_at)) < Date.parse(String(collection.started_at))) errors.push('collection completed before it started');
    }
  }

  return errors;
}

export function isStatusPayload(value: unknown, expectedProviderIds: readonly string[] = []): value is StatusPayload {
  return payloadValidationErrors(value, expectedProviderIds).length === 0;
}