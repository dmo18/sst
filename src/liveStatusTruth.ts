import type { AttentionLevel, ComponentStatus, Incident, ProviderStatus, ServiceState, StatusPayload, StatusSummary } from './types';

const LIVE_TIMEOUT_MS = 6_000;
const LIVE_CONCURRENCY = 8;
const STATUSPAGE_SOURCE = /\/api\/v2\/summary\.json(?:$|\?)/i;
const CLOSED_INCIDENT = new Set(['resolved', 'completed', 'postmortem']);
const MAJOR_COMPONENT = new Set(['major_outage']);
const DEGRADED_COMPONENT = new Set(['degraded_performance', 'partial_outage']);

interface StatuspageIncidentUpdate {
  status?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  affected_components?: Array<{ name?: string; new_status?: string }>;
}

interface StatuspageIncident {
  id?: string;
  name?: string;
  status?: string;
  impact?: string;
  shortlink?: string;
  created_at?: string;
  started_at?: string;
  updated_at?: string;
  incident_updates?: StatuspageIncidentUpdate[];
  components?: Array<{ name?: string; status?: string }>;
}

interface StatuspageSummary {
  status?: { indicator?: string; description?: string };
  components?: Array<{ name?: string; status?: string; group?: boolean }>;
  incidents?: StatuspageIncident[];
}

interface LiveProviderObservation {
  providerId: string;
  checkedAt: string;
  serviceState: ServiceState;
  incidents: Incident[];
  components: ComponentStatus[];
  problemComponentCount: number;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function incidentServiceState(incident: StatuspageIncident): Exclude<ServiceState, 'operational' | 'unknown'> {
  const impact = text(incident.impact).toLowerCase();
  if (impact === 'critical' || impact === 'major') return 'major';
  return 'degraded';
}

function statuspageOverallState(summary: StatuspageSummary, incidents: Incident[], components: ComponentStatus[]): ServiceState {
  const indicator = text(summary.status?.indicator).toLowerCase();
  const componentMajor = components.some(component => MAJOR_COMPONENT.has(component.status));
  const componentDegraded = components.some(component => DEGRADED_COMPONENT.has(component.status));
  const incidentMajor = incidents.some(incident => incident.service_state === 'major');
  if (indicator === 'critical' || indicator === 'major' || componentMajor || incidentMajor) return 'major';
  if (indicator === 'minor' || componentDegraded || incidents.length) return 'degraded';
  if (indicator === 'none') return 'operational';
  return 'unknown';
}

function incidentUpdates(incident: StatuspageIncident) {
  return (incident.incident_updates || [])
    .map(update => ({
      status: text(update.status) || undefined,
      note: text(update.body),
      at: text(update.updated_at || update.created_at) || undefined
    }))
    .filter(update => update.note);
}

function latestIncidentUpdate(incident: StatuspageIncident): StatuspageIncidentUpdate | null {
  return [...(incident.incident_updates || [])]
    .sort((a, b) => Date.parse(text(b.updated_at || b.created_at)) - Date.parse(text(a.updated_at || a.created_at)))[0] || null;
}

function affectedComponents(incident: StatuspageIncident): string[] {
  const latest = latestIncidentUpdate(incident);
  const fromUpdate = (latest?.affected_components || []).map(item => text(item.name)).filter(Boolean);
  const fromIncident = (incident.components || []).map(item => text(item.name)).filter(Boolean);
  return [...new Set([...fromUpdate, ...fromIncident])];
}

function liveIncident(provider: ProviderStatus, incident: StatuspageIncident, checkedAt: string): Incident | null {
  const id = text(incident.id);
  const title = text(incident.name);
  const status = text(incident.status).toLowerCase();
  if (!id || !title || CLOSED_INCIDENT.has(status)) return null;
  const latest = latestIncidentUpdate(incident);
  const serviceState = incidentServiceState(incident);
  const updatedAt = text(incident.updated_at || latest?.updated_at || latest?.created_at || incident.created_at || incident.started_at) || checkedAt;
  const startedAt = text(incident.started_at || incident.created_at) || updatedAt;
  const pageUrl = provider.source.replace(/\/api\/v2\/summary\.json(?:\?.*)?$/i, '/');
  const components = affectedComponents(incident);
  return {
    id: `${provider.id}:${id}`,
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title,
    note: text(latest?.body) || `Official ${provider.name} status page reports an active incident.`,
    source: provider.source,
    url: text(incident.shortlink) || pageUrl,
    time: startedAt,
    rawTime: startedAt,
    status: status || 'active',
    color: serviceState === 'major' ? 'red' : 'yellow',
    service_state: serviceState,
    attention: serviceState === 'major' ? 'critical' : 'action',
    priority: provider.priority,
    first_detected: startedAt,
    latest_update: updatedAt,
    observed_at: checkedAt,
    evidence_basis: 'current-page',
    client_impact: provider.client_impact,
    technician_action: provider.technician_action,
    affected_service: components.join(', ') || undefined,
    updates: incidentUpdates(incident)
  };
}

export function parseBrowserStatuspage(provider: ProviderStatus, body: unknown, checkedAt = new Date().toISOString()): LiveProviderObservation {
  if (!body || typeof body !== 'object') throw new Error('official Statuspage summary is not an object');
  const summary = body as StatuspageSummary;
  if (!summary.status || !Array.isArray(summary.components) || !Array.isArray(summary.incidents))
    throw new Error('official Statuspage summary is missing status, components, or incidents');

  const components: ComponentStatus[] = summary.components
    .filter(component => !component.group)
    .map(component => ({ name: text(component.name) || 'Unnamed component', status: text(component.status).toLowerCase() || 'unknown' }));
  const incidents = summary.incidents.map(item => liveIncident(provider, item, checkedAt)).filter((item): item is Incident => Boolean(item));
  const problemComponentCount = components.filter(component => MAJOR_COMPONENT.has(component.status) || DEGRADED_COMPONENT.has(component.status)).length;
  return {
    providerId: provider.id,
    checkedAt,
    serviceState: statuspageOverallState(summary, incidents, components),
    incidents,
    components,
    problemComponentCount
  };
}

function liveAttention(provider: ProviderStatus, state: ServiceState): AttentionLevel {
  if (state === 'major') return 'critical';
  if (state === 'degraded') return 'action';
  if (provider.source_health === 'blind' || provider.source_health === 'watch') return 'watch';
  return 'informational';
}

function applyObservation(provider: ProviderStatus, observation: LiveProviderObservation): ProviderStatus {
  const state = observation.serviceState;
  const active = observation.incidents.length;
  const signalCount = active + observation.problemComponentCount;
  const status = state === 'major'
    ? `${signalCount} major live official Statuspage signal${signalCount === 1 ? '' : 's'}`
    : state === 'degraded'
      ? `${signalCount} degraded live official Statuspage signal${signalCount === 1 ? '' : 's'}`
      : state === 'operational'
        ? 'Live official Statuspage reports operational'
        : 'Live official Statuspage state is inconclusive';
  return {
    ...provider,
    status,
    message: active ? observation.incidents[0]?.note || status : status,
    service_state: state,
    color: state === 'major' ? 'red' : state === 'degraded' ? 'yellow' : state === 'operational' ? 'green' : 'blue',
    attention: liveAttention(provider, state),
    ok: state === 'operational',
    truth_basis: state === 'major' || state === 'degraded'
      ? 'vendor-incident'
      : state === 'operational'
        ? 'confirmed-operational'
        : 'observed-no-conclusion',
    checked_at: observation.checkedAt,
    status_data_valid: true,
    status_data_basis: 'live-official',
    evidence_tier: 'structured',
    source_confidence: 'high',
    last_success_at: observation.checkedAt,
    consecutive_failures: 0,
    component_status: observation.components,
    active_incident_count: active,
    problem_component_count: observation.problemComponentCount
  };
}

function overallServiceState(providers: ProviderStatus[]): ServiceState {
  if (providers.some(provider => provider.service_state === 'major')) return 'major';
  if (providers.some(provider => provider.service_state === 'degraded')) return 'degraded';
  if (providers.some(provider => provider.service_state === 'unknown')) return 'unknown';
  return 'operational';
}

function summaryWithLiveTruth(summary: StatusSummary, providers: ProviderStatus[], incidents: Incident[]): StatusSummary {
  const enabled = providers.filter(provider => provider.source_state !== 'disabled');
  const operational = enabled.filter(provider => provider.service_state === 'operational').length;
  const degraded = enabled.filter(provider => provider.service_state === 'degraded').length;
  const major = enabled.filter(provider => provider.service_state === 'major').length;
  const unknown = enabled.filter(provider => provider.service_state === 'unknown').length;
  return {
    ...summary,
    service_overall: overallServiceState(enabled),
    active_incident_count: incidents.length,
    affected_provider_count: enabled.filter(provider => provider.service_state === 'major' || provider.service_state === 'degraded').length,
    confirmed_operational_count: operational,
    degraded_count: degraded,
    major_count: major,
    unknown_count: unknown,
    confirmed_operational_percent: enabled.length ? Math.round((operational / enabled.length) * 1000) / 10 : 0,
    component_issue_count: enabled.reduce((sum, provider) => sum + Number(provider.problem_component_count || 0), 0),
    actionable_provider_count: enabled.filter(provider => provider.attention === 'critical' || provider.attention === 'action').length
  };
}

export function mergeBrowserLiveTruth(payload: StatusPayload, observations: LiveProviderObservation[], failedProviderIds: string[], checkedAt: string): StatusPayload {
  const observationByProvider = new Map(observations.map(item => [item.providerId, item]));
  const providers = payload.providers.map(provider => {
    const observation = observationByProvider.get(provider.id);
    return observation ? applyObservation(provider, observation) : provider;
  });
  const observedIds = new Set(observations.map(item => item.providerId));
  const incidents = [
    ...payload.incidents.filter(incident => !observedIds.has(incident.providerId)),
    ...observations.flatMap(item => item.incidents)
  ];
  const activeProviderIds = [...new Set(observations.filter(item => item.serviceState === 'major' || item.serviceState === 'degraded').map(item => item.providerId))].sort();
  return {
    ...payload,
    providers,
    incidents,
    summary: summaryWithLiveTruth(payload.summary, providers, incidents),
    live_truth: {
      checked_at: checkedAt,
      attempted_provider_count: observations.length + failedProviderIds.length,
      success_provider_count: observations.length,
      failure_provider_count: failedProviderIds.length,
      active_provider_ids: activeProviderIds,
      successful_provider_ids: observations.map(item => item.providerId).sort(),
      failed_provider_ids: [...failedProviderIds].sort()
    }
  };
}

function liveTargets(payload: StatusPayload): ProviderStatus[] {
  return payload.providers.filter(provider =>
    (provider.source_type === 'statuspage-json' || provider.source_type === 'statuspage')
    && STATUSPAGE_SOURCE.test(provider.source)
    && provider.source_state !== 'disabled'
  );
}

async function fetchObservation(provider: ProviderStatus, parentSignal: AbortSignal, checkedAt: string): Promise<LiveProviderObservation> {
  const url = new URL(provider.source);
  url.searchParams.set('browserTruth', String(Date.now()));
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  parentSignal.addEventListener('abort', abortFromParent, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    return parseBrowserStatuspage(provider, body, checkedAt);
  }
  finally {
    window.clearTimeout(timeout);
    parentSignal.removeEventListener('abort', abortFromParent);
  }
}

async function mapConcurrent<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index]) };
      }
      catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function applyBrowserLiveTruth(payload: StatusPayload, signal: AbortSignal): Promise<StatusPayload> {
  const targets = liveTargets(payload);
  if (!targets.length) return payload;
  const checkedAt = new Date().toISOString();
  const results = await mapConcurrent(targets, LIVE_CONCURRENCY, provider => fetchObservation(provider, signal, checkedAt));
  const observations: LiveProviderObservation[] = [];
  const failures: string[] = [];
  results.forEach((result, index) => {
    const provider = targets[index];
    if (result.status === 'fulfilled') observations.push(result.value);
    else {
      failures.push(provider.id);
      console.warn(`Live official truth unavailable for ${provider.id}:`, result.reason);
    }
  });
  return mergeBrowserLiveTruth(payload, observations, failures, checkedAt);
}
