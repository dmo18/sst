import type {
  AttentionLevel,
  Incident,
  ProviderConfig,
  ProviderDownloadLog,
  ProviderStatus,
  ServiceState,
  SourceState,
  StatusChange,
  StatusPayload
} from './types';

const serviceRank: Record<ServiceState, number> = { major: 4, degraded: 3, unknown: 2, operational: 1 };
const attentionRank: Record<AttentionLevel, number> = { critical: 4, action: 3, watch: 2, informational: 1 };

const genericImpact = 'Review affected client environments before confirming impact.';
const genericAction = 'Monitor the official source and correlate with client tickets.';

export interface IssueBrief extends Incident {
  label: string;
  clientDraft: string;
  affectedServiceLabel: string;
  mspImpact: string;
  technicianAction: string;
  operatorPriority: string;
}

export interface DiagnosticSource {
  id: string;
  provider: string;
  category: string;
  serviceState: ServiceState;
  sourceState: SourceState;
  attention: AttentionLevel;
  status: string;
  message: string;
  source: string;
  ok: boolean;
  checkedAt: string;
  sourceType: string;
  downloadLog: ProviderDownloadLog[];
  priority: number;
  criticality: string;
  tags: string[];
  services: string[];
  clientImpact: string;
  technicianAction: string;
  searchText: string;
  changed: boolean;
}

export interface IssueConsoleModel {
  version: string;
  generatedAt: string;
  incidentCount: number;
  affectedCount: number;
  briefs: IssueBrief[];
  diagnostics: DiagnosticSource[];
  changes: StatusChange[];
  history: StatusChange[];
  summary: StatusPayload['summary'];
  attentionCount: number;
  newIncidentCount: number;
  resolvedCount: number;
  newUnavailableCount: number;
}

function clean(value?: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function meaningful(value?: string): boolean {
  const text = clean(value);
  return text.length > 24 && text !== genericImpact && text !== genericAction;
}

function categoryText(value: string): string {
  return value.toLowerCase();
}

function affectedServiceLabel(i: Incident): string {
  const direct = clean(i.affected_service);
  if (direct) return direct;

  const category = categoryText(i.category || '');
  if (category.includes('identity')) return 'sign-in, MFA, SSO, and account access';
  if (category.includes('cloud')) return 'hosted workloads, APIs, storage, and dependent applications';
  if (category.includes('security')) return 'security controls, alerts, endpoint visibility, and policy enforcement';
  if (category.includes('backup')) return 'backup jobs, restore readiness, replication, and recovery points';
  if (category.includes('connectivity')) return 'internet circuits, DNS, routing, and site connectivity';
  if (category.includes('communications')) return 'calling, messaging, meetings, and client communications';
  if (category.includes('msp')) return 'ticketing, RMM, PSA, automation, and technician workflows';
  if (category.includes('collaboration')) return 'file sharing, documents, chat, and collaboration workflows';
  if (category.includes('commerce') || category.includes('payments')) return 'payments, invoicing, checkout, and transaction workflows';
  if (category.includes('crm')) return 'CRM, sales, support, and customer workflow data';
  if (category.includes('developer')) return 'developer tooling, deployments, images, packages, and APIs';
  return `${i.category || i.provider} services`;
}

function providerSourcePhrase(provider?: ProviderStatus): string {
  if (!provider) return 'source state is not available';
  if (provider.source_state === 'available') return 'official source was captured successfully';
  if (provider.source_state === 'limited') return 'official source is limited, so verify details before broad client communication';
  if (provider.source_state === 'unavailable') return 'official source did not load, so treat this as unconfirmed until rechecked';
  if (provider.source_state === 'stale') return 'source data may be stale, so confirm before taking client action';
  return `source state is ${provider.source_state}`;
}

function categoryImpact(i: Incident, service: string): string {
  const major = i.service_state === 'major';
  const category = categoryText(i.category || '');
  if (category.includes('identity')) {
    return major
      ? `${i.provider} may block client sign-ins, MFA, SSO, token refresh, or admin access for ${service}. Prioritize users locked out of core apps and any tenant-wide authentication failures.`
      : `${i.provider} may cause intermittent sign-in, MFA, SSO, or token refresh problems for ${service}. Watch for clusters of login tickets before escalating as client-impacting.`;
  }
  if (category.includes('cloud')) {
    return major
      ? `${i.provider} may interrupt hosted workloads, APIs, storage, and dependent client applications tied to ${service}. Treat client production workloads as potentially at risk until tickets prove otherwise.`
      : `${i.provider} may degrade workloads, APIs, storage, or admin actions tied to ${service}. Expect slow operations, failed jobs, or elevated retries rather than a complete outage.`;
  }
  if (category.includes('security')) {
    return major
      ? `${i.provider} may reduce protection, alert delivery, policy enforcement, or endpoint visibility for ${service}. Do not assume monitored clients are fully covered until telemetry is confirmed.`
      : `${i.provider} may delay alerts, management actions, updates, or security visibility for ${service}. Review high-risk clients first and avoid noisy false escalations.`;
  }
  if (category.includes('backup')) {
    return major
      ? `${i.provider} may affect backup completion, restore readiness, replication, or recovery point confidence for ${service}. Failed or missed protection jobs need same-day review.`
      : `${i.provider} may delay backup, replication, management, or restore workflows for ${service}. Watch for missed windows before confirming client impact.`;
  }
  if (category.includes('connectivity')) {
    return major
      ? `${i.provider} may interrupt internet, DNS, routing, or site access for ${service}. Group client reports by circuit, region, and provider before dispatching local troubleshooting.`
      : `${i.provider} may cause latency, packet loss, DNS errors, or intermittent access for ${service}. Correlate by geography and ISP before changing client networks.`;
  }
  if (category.includes('communications')) {
    return major
      ? `${i.provider} may block calling, meetings, messaging, or notifications for ${service}. Expect client-facing communication delays and phone queue pressure.`
      : `${i.provider} may degrade calls, meetings, chat, notifications, or messaging for ${service}. Check whether alternate channels are needed for affected clients.`;
  }
  if (category.includes('msp')) {
    return major
      ? `${i.provider} may disrupt technician operations, tickets, RMM actions, automations, or client support workflows for ${service}. Track work outside the platform until access is stable.`
      : `${i.provider} may slow technician workflows, syncs, automations, or remote actions for ${service}. Expect delayed ticket updates and retry failed automations after recovery.`;
  }
  if (category.includes('collaboration')) {
    return major
      ? `${i.provider} may block access to files, documents, chat, or collaboration workflows for ${service}. Client teams may lose access to shared work until vendor recovery.`
      : `${i.provider} may degrade file sync, sharing, document access, or collaboration workflows for ${service}. Watch for sync delays and permission errors.`;
  }
  if (category.includes('commerce') || category.includes('payments')) {
    return major
      ? `${i.provider} may block payments, invoicing, checkout, or transaction workflows for ${service}. Confirm revenue-impacting client processes before sending business-impact notices.`
      : `${i.provider} may delay or degrade payments, invoicing, checkout, or transaction workflows for ${service}. Watch for failed transactions and reconciliation gaps.`;
  }
  if (category.includes('developer')) {
    return major
      ? `${i.provider} may block deployments, package pulls, image builds, APIs, or developer workflows for ${service}. Freeze risky releases until vendor status stabilizes.`
      : `${i.provider} may slow builds, deployments, package pulls, or APIs for ${service}. Expect retries and delayed release pipelines.`;
  }
  return major
    ? `${i.provider} may cause a major interruption for ${service}. Confirm client-facing symptoms before declaring direct business impact.`
    : `${i.provider} may degrade ${service}. Correlate against client tickets before escalating as an active client incident.`;
}

function derivedMspImpact(i: Incident, provider?: ProviderStatus): string {
  if (meaningful(i.client_impact)) return clean(i.client_impact);
  const service = affectedServiceLabel(i);
  const source = providerSourcePhrase(provider);
  return `${categoryImpact(i, service)} Current capture note: ${source}.`;
}

function categoryAction(i: Incident, service: string): string {
  const major = i.service_state === 'major';
  const category = categoryText(i.category || '');
  if (category.includes('identity')) {
    return `${major ? 'Treat authentication reports as priority incidents' : 'Watch for login clusters'}; gather tenant ID, affected user, MFA method, app name, error, timestamp, and region before escalating.`;
  }
  if (category.includes('cloud')) {
    return `${major ? 'Freeze risky cloud changes and check production workloads' : 'Review failed jobs and elevated retries'}; capture region, resource, API, error code, and client workload before vendor escalation.`;
  }
  if (category.includes('security')) {
    return `${major ? 'Confirm monitoring and protection coverage immediately' : 'Check alert and management delays'}; verify agent check-in, policy sync, alert ingestion, and high-risk client exposure.`;
  }
  if (category.includes('backup')) {
    return `${major ? 'Audit failed backup and restore readiness now' : 'Review missed or delayed protection jobs'}; tag impacted clients, preserve logs, and retry only after the vendor reports recovery.`;
  }
  if (category.includes('connectivity')) {
    return `${major ? 'Group tickets by ISP, region, and circuit before dispatching' : 'Correlate latency and reachability symptoms'}; avoid client-side network changes until provider scope is clear.`;
  }
  if (category.includes('communications')) {
    return `${major ? 'Move urgent communications to backup channels' : 'Check whether alternate channels are needed'}; validate phone queues, meetings, SMS, chat, and notification paths for affected clients.`;
  }
  if (category.includes('msp')) {
    return `${major ? 'Track work outside the affected platform and pause bulk automations' : 'Retry failed syncs and automations after recovery'}; keep ticket notes, client approvals, and remote actions auditable.`;
  }
  if (category.includes('collaboration')) {
    return `${major ? 'Confirm whether users can access shared data' : 'Watch sync, sharing, and permission errors'}; identify critical client documents and recommend alternate access paths where possible.`;
  }
  if (category.includes('commerce') || category.includes('payments')) {
    return `${major ? 'Confirm revenue-impacting failures immediately' : 'Monitor failed transactions and reconciliation gaps'}; capture transaction IDs, timestamps, amounts, and client business process affected.`;
  }
  if (category.includes('developer')) {
    return `${major ? 'Pause risky deployments and release windows' : 'Expect pipeline retries and delayed builds'}; collect job IDs, package names, image tags, API errors, and affected environments.`;
  }
  return `${major ? 'Treat this as a priority vendor incident' : 'Monitor and correlate symptoms'}; capture client, service, error, timestamp, and business impact before broad communication about ${service}.`;
}

function derivedTechnicianAction(i: Incident, provider?: ProviderStatus): string {
  if (meaningful(i.technician_action)) return clean(i.technician_action);
  const service = affectedServiceLabel(i);
  const sourceCaution = provider && provider.source_state !== 'available'
    ? ` Source confidence is ${provider.source_state}; recheck the official page before client-wide messaging.`
    : ' Keep monitoring the official source for scope and recovery updates.';
  return `${categoryAction(i, service)}${sourceCaution}`;
}

function operatorPriority(i: Incident, provider?: ProviderStatus): string {
  const criticalProvider = provider?.criticality === 'high' || (provider?.priority || i.priority || 0) >= 85;
  if (i.service_state === 'major' && criticalProvider) return 'P1: major outage on a high-priority provider';
  if (i.service_state === 'major') return 'P1: major outage, confirm client impact now';
  if (criticalProvider) return 'P2: high-priority provider degraded';
  return 'P3: monitor, correlate tickets, and update if symptoms grow';
}

export function clientCommunicationDraft(i: Incident, provider?: ProviderStatus): string {
  const impact = derivedMspImpact(i, provider);
  const service = affectedServiceLabel(i);
  const severity = i.service_state === 'major' ? 'major service issue' : 'service degradation';
  const symptom = clean(i.note).slice(0, 220);
  return `DRAFT: We are monitoring a ${severity} affecting ${i.provider} ${service}. ${symptom ? `The vendor reports: ${symptom}. ` : ''}${impact} We are validating client impact before making account-specific claims and will update as the vendor publishes recovery details.`;
}

function catalogFallback(p: ProviderConfig, at: string): ProviderStatus {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.enabled === false ? 'Disabled in provider catalog' : 'Pending source refresh',
    color: 'blue',
    service_state: 'unknown',
    source_state: p.enabled === false ? 'disabled' : 'pending',
    attention: 'watch',
    message: p.message || 'Waiting for generated status.',
    ok: false,
    source: p.url,
    priority: p.priority || 0,
    criticality: p.criticality,
    tags: p.tags || [],
    services: p.services || [],
    client_impact: p.client_impact,
    technician_action: p.technician_action,
    checked_at: at,
    source_type: p.sourceType,
    download_log: []
  };
}

function merge(payload: StatusPayload, catalog: ProviderConfig[]): ProviderStatus[] {
  const map = new Map<string, ProviderStatus>();
  for (const p of payload.providers) {
    if (map.has(p.id)) throw new Error(`Duplicate provider id in status payload: ${p.id}`);
    map.set(p.id, p);
  }
  for (const p of catalog) if (!map.has(p.id)) map.set(p.id, catalogFallback(p, payload.generated_at));
  return [...map.values()];
}

export function filterDiagnostics(items: DiagnosticSource[], query: string, filters: string[]): DiagnosticSource[] {
  const q = query.trim().toLowerCase();
  return items.filter(x => (!q || x.searchText.includes(q)) && filters.every(f =>
    f === 'attention' ? x.attention !== 'informational'
      : f === 'changed' ? x.changed
        : f === 'incident' ? ['major', 'degraded'].includes(x.serviceState)
          : f === 'high' ? x.criticality === 'high'
            : f === 'operational' ? x.serviceState === 'operational'
              : f === x.sourceState || f === x.serviceState || x.tags.includes(f) || x.category.toLowerCase().includes(f)
  ));
}

export function buildIssueConsoleModel(payload: StatusPayload, version: string, catalog: ProviderConfig[] = []): IssueConsoleModel {
  const changed = new Set(payload.changes.map(c => c.provider_id));
  const mergedProviders = merge(payload, catalog);
  const providerMap = new Map(mergedProviders.map(p => [p.id, p]));
  const diagnostics = mergedProviders.map(p => ({
    id: p.id,
    provider: p.name,
    category: p.category,
    serviceState: p.service_state,
    sourceState: p.source_state,
    attention: p.attention,
    status: p.status,
    message: p.message || '',
    source: p.source,
    ok: p.ok,
    checkedAt: p.checked_at || payload.generated_at,
    sourceType: p.source_type || 'unknown',
    downloadLog: p.download_log || [],
    priority: p.priority,
    criticality: p.criticality || 'medium',
    tags: (p.tags || []).map(x => x.toLowerCase()),
    services: p.services || [],
    clientImpact: p.client_impact || '',
    technicianAction: p.technician_action || '',
    searchText: `${p.name} ${p.category} ${(p.tags || []).join(' ')} ${(p.services || []).join(' ')} ${payload.incidents.filter(i => i.providerId === p.id).map(i => `${i.title} ${i.note}`).join(' ')}`.toLowerCase(),
    changed: changed.has(p.id)
  })).sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || serviceRank[b.serviceState] - serviceRank[a.serviceState] || Number(b.changed) - Number(a.changed) || b.priority - a.priority || a.provider.localeCompare(b.provider));
  const briefs = [...payload.incidents]
    .sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || serviceRank[b.service_state] - serviceRank[a.service_state] || b.priority - a.priority)
    .map(i => {
      const provider = providerMap.get(i.providerId);
      const brief = {
        ...i,
        label: i.service_state === 'major' ? 'Major incident' : 'Degraded service',
        affectedServiceLabel: affectedServiceLabel(i),
        mspImpact: derivedMspImpact(i, provider),
        technicianAction: derivedTechnicianAction(i, provider),
        operatorPriority: operatorPriority(i, provider),
        clientDraft: ''
      };
      return { ...brief, clientDraft: clientCommunicationDraft(brief, provider) };
    });
  return {
    version,
    generatedAt: payload.generated_at,
    incidentCount: briefs.length,
    affectedCount: payload.summary.affected_provider_count,
    briefs,
    diagnostics,
    changes: payload.changes,
    history: payload.history,
    summary: payload.summary,
    attentionCount: diagnostics.filter(x => ['critical', 'action'].includes(x.attention)).length,
    newIncidentCount: payload.changes.filter(x => x.type === 'incident_new').length,
    resolvedCount: payload.changes.filter(x => x.type === 'incident_resolved').length,
    newUnavailableCount: payload.changes.filter(x => x.type === 'source_unavailable').length
  };
}

export function wallboardSubset(model: IssueConsoleModel): DiagnosticSource[] {
  return model.diagnostics.filter(x => x.attention !== 'informational' || x.changed);
}
