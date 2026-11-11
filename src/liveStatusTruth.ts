import { parseStatuspageSummary } from '../scripts/structured-source-adapters.mjs';
import { fullReviewOverrides } from '../scripts/full-review-source-adapters.mjs';
import { componentStatusIsProblem } from './componentStatus.ts';
import type { AttentionLevel, ComponentStatus, Incident, ProviderStatus, ServiceState, StatusPayload, StatusSummary } from './types';

const LIVE_TIMEOUT_MS = 6_000;
const LIVE_CONCURRENCY = 8;
const STATUSPAGE_SOURCE = /\/api\/v2\/summary\.json(?:$|\?)/i;

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

interface CollectorIncident {
  id?: string;
  title: string;
  note?: string;
  status?: string;
  firstDetected?: string;
  latestUpdate?: string;
  affectedService?: string;
  color?: string;
  url?: string;
  updates?: Array<{ status?: string; note?: string; at?: string }>;
}

function liveIncident(provider: ProviderStatus, incident: CollectorIncident, checkedAt: string, pageUrl: string): Incident | null {
  const id = text(incident.id);
  const title = text(incident.title);
  if (!id || !title) return null;
  const serviceState = incident.color === 'red' ? 'major' : 'degraded';
  const updatedAt = text(incident.latestUpdate) || text(incident.firstDetected) || checkedAt;
  const startedAt = text(incident.firstDetected) || updatedAt;
  return {
    id: `${provider.id}:${id}`,
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title,
    note: text(incident.note) || `Official ${provider.name} status page reports an active incident.`,
    source: provider.source,
    url: text(incident.url) || pageUrl,
    time: startedAt,
    rawTime: updatedAt,
    status: text(incident.status).toLowerCase() || 'active',
    color: serviceState === 'major' ? 'red' : 'amber',
    service_state: serviceState,
    attention: serviceState === 'major' ? 'critical' : 'action',
    priority: provider.priority,
    first_detected: startedAt,
    latest_update: updatedAt,
    observed_at: checkedAt,
    client_impact: provider.client_impact,
    technician_action: provider.technician_action,
    affected_service: text(incident.affectedService) || undefined,
    updates: (incident.updates || [])
      .map(update => ({ status: text(update.status) || undefined, note: text(update.note), at: text(update.at) || undefined }))
      .filter(update => update.note)
  };
}

// The browser reads a vendor's Statuspage document with the collector's own
// parser. There is one definition of an active, in-scope incident: the same
// region scope, advisory and planned-work rules, evidence-age limit and
// component handling apply here as in the audited payload. A document the
// parser cannot conclude from is an error, which leaves the audited provider
// record untouched.
export function parseBrowserStatuspage(provider: ProviderStatus, body: unknown, checkedAt = new Date().toISOString()): LiveProviderObservation {
  if (!body || typeof body !== 'object') throw new Error('official Statuspage summary is not an object');
  const summary = body as StatuspageSummary;
  if (!summary.status || !Array.isArray(summary.components))
    throw new Error('official Statuspage summary is missing status or components');

  const pageUrl = provider.source.replace(/\/api\/v2\/summary\.json(?:\?.*)?$/i, '/');
  const regionScope = (fullReviewOverrides as Record<string, { regionScope?: string } | undefined>)[provider.id]?.regionScope || 'us';
  const conclusion = parseStatuspageSummary(body, { id: provider.id, name: provider.name }, { regionScope, pageUrl, url: provider.source });
  if (!conclusion || conclusion.kind === 'limited')
    throw new Error(conclusion?.message || 'official Statuspage summary did not yield a current conclusion');

  const components: ComponentStatus[] = (conclusion.components || []).map(component => ({ name: component.name, status: component.status }));
  const problemComponentCount = components.filter(component => componentStatusIsProblem(component.status)).length;
  const incidents = conclusion.kind === 'issues'
    ? (conclusion.incidents || []).map(item => liveIncident(provider, item, checkedAt, pageUrl)).filter((item): item is Incident => Boolean(item))
    : [];
  let serviceState: ServiceState;
  if (conclusion.kind === 'issues') {
    if (!incidents.length) throw new Error('official Statuspage summary listed incidents without usable identity');
    serviceState = incidents.some(incident => incident.service_state === 'major') ? 'major' : 'degraded';
  }
  else if (conclusion.kind === 'component-state') serviceState = conclusion.color === 'red' ? 'major' : 'degraded';
  else serviceState = 'operational';
  return { providerId: provider.id, checkedAt, serviceState, incidents, components, problemComponentCount };
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
    color: state === 'major' ? 'red' : state === 'degraded' ? 'amber' : state === 'operational' ? 'green' : 'blue',
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
