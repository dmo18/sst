import type { StatusPayload } from './types';

const services = new Set(['operational', 'degraded', 'major', 'unknown']);
const sources = new Set(['available', 'limited', 'unavailable', 'disabled', 'pending', 'stale']);
const colors = new Set(['green', 'amber', 'red', 'blue']);
const attention = new Set(['critical', 'action', 'watch', 'informational']);
const confidence = new Set(['high', 'medium', 'low', 'none']);
const evidence = new Set(['structured', 'feed', 'rendered-page', 'public-page', 'limited']);
const maintenanceStates = new Set(['scheduled', 'in_progress', 'completed', 'unknown']);

const http = (value: unknown): boolean => {
  try {
    return typeof value === 'string' && ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validDate = (value: unknown): boolean => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function payloadValidationErrors(value: unknown): string[] {
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
    if (!colors.has(String(provider.color))) errors.push(`invalid color ${String(provider.id)}`);
    if (!attention.has(String(provider.attention))) errors.push(`invalid attention ${String(provider.id)}`);
    if (typeof provider.ok !== 'boolean') errors.push(`invalid ok ${String(provider.id)}`);
    if (!Number.isFinite(provider.priority) || Number(provider.priority) < 0) errors.push(`invalid priority ${String(provider.id)}`);
    if (!http(provider.source)) errors.push(`invalid source URL ${String(provider.id)}`);
    if (provider.evidence_tier !== undefined && !evidence.has(String(provider.evidence_tier))) errors.push(`invalid evidence tier ${String(provider.id)}`);
    if (provider.source_confidence !== undefined && !confidence.has(String(provider.source_confidence))) errors.push(`invalid source confidence ${String(provider.id)}`);
    if (provider.consecutive_failures !== undefined && (!Number.isInteger(provider.consecutive_failures) || Number(provider.consecutive_failures) < 0)) errors.push(`invalid failure streak ${String(provider.id)}`);
    for (const key of ['checked_at', 'last_success_at', 'last_semantic_change_at']) {
      if (provider[key] && !validDate(provider[key])) errors.push(`invalid ${key} ${String(provider.id)}`);
    }
    if (provider.component_status !== undefined && !Array.isArray(provider.component_status)) errors.push(`invalid component status ${String(provider.id)}`);
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
    if (incident.rawTime && (!validDate(incident.rawTime) || Date.parse(String(incident.rawTime)) > Date.now() + 300000)) errors.push(`invalid incident timestamp ${String(incident.id)}`);
    if (incident.updates !== undefined && !Array.isArray(incident.updates)) errors.push(`invalid incident updates ${String(incident.id)}`);
  }

  const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance as Record<string, unknown>[] : [];
  const maintenanceIds = new Set<string>();
  for (const item of maintenance) {
    if (!ids.has(String(item.providerId))) errors.push(`unknown maintenance provider ${String(item.providerId)}`);
    if (maintenanceIds.has(String(item.id))) errors.push(`duplicate maintenance ${String(item.id)}`);
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
      'component_issue_count'
    ];
    for (const key of requiredNumeric) {
      if (!Number.isFinite(summary[key]) || Number(summary[key]) < 0) errors.push(`invalid summary ${key}`);
    }
    for (const key of optionalNumeric) {
      if (summary[key] !== undefined && (!Number.isFinite(summary[key]) || Number(summary[key]) < 0)) errors.push(`invalid summary ${key}`);
    }
    if (summary.provider_total !== providers.length) errors.push('provider count mismatch');
    if (summary.active_incident_count !== incidents.length) errors.push('incident count mismatch');
    if (summary.affected_provider_count !== new Set(incidents.map(item => item.providerId)).size) errors.push('affected provider count mismatch');

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

    const optionalExpected: Record<string, number> = {
      maintenance_count: maintenance.length,
      ongoing_maintenance_count: maintenance.filter(item => item.status === 'in_progress').length,
      structured_source_count: providers.filter(provider => provider.source_state === 'available' && provider.evidence_tier === 'structured').length,
      feed_source_count: providers.filter(provider => provider.source_state === 'available' && provider.evidence_tier === 'feed').length,
      page_source_count: providers.filter(provider => provider.source_state === 'available' && ['rendered-page', 'public-page'].includes(String(provider.evidence_tier))).length,
      high_confidence_source_count: providers.filter(provider => provider.source_confidence === 'high').length,
      schema_change_count: providers.filter(provider => provider.schema_changed === true).length,
      failure_streak_count: providers.filter(provider => Number(provider.consecutive_failures || 0) >= 2).length,
      component_issue_count: providers.flatMap(provider => Array.isArray(provider.component_status) ? provider.component_status as Record<string, unknown>[] : []).filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component.status || ''))).length
    };
    for (const [key, expected] of Object.entries(optionalExpected)) {
      if (summary[key] !== undefined && summary[key] !== expected) errors.push(`summary ${key} does not reconcile`);
    }
  }

  return errors;
}

export function isStatusPayload(value: unknown): value is StatusPayload {
  return payloadValidationErrors(value).length === 0;
}
