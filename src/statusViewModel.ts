import type {
  AttentionLevel,
  ComponentStatus,
  Incident,
  Maintenance,
  ProviderConfig,
  ProviderDownloadLog,
  ProviderStatus,
  ServiceState,
  SourceConfidence,
  SourceState,
  StatusChange,
  StatusPayload
} from './types';

const serviceRank: Record<ServiceState, number> = { major: 4, degraded: 3, unknown: 2, operational: 1 };
const attentionRank: Record<AttentionLevel, number> = { critical: 4, action: 3, watch: 2, informational: 1 };

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
  evidenceTier: string;
  sourceConfidence: SourceConfidence;
  parserVersion: string;
  schemaFingerprint: string;
  schemaChanged: boolean;
  lastSuccessAt: string;
  consecutiveFailures: number;
  lastSemanticChangeAt: string;
  componentStatus: ComponentStatus[];
}

export interface IssueConsoleModel {
  version: string;
  generatedAt: string;
  incidentCount: number;
  affectedCount: number;
  briefs: IssueBrief[];
  maintenance: Maintenance[];
  diagnostics: DiagnosticSource[];
  changes: StatusChange[];
  history: StatusChange[];
  summary: StatusPayload['summary'];
  attentionCount: number;
  newIncidentCount: number;
  resolvedCount: number;
  newUnavailableCount: number;
  maintenanceCount: number;
  ongoingMaintenanceCount: number;
  schemaChangeCount: number;
  failureStreakCount: number;
  highConfidenceCount: number;
  componentIssueCount: number;
}

function clean(value?: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function categoryText(value: string): string {
  return value.toLowerCase();
}

function affectedServiceLabel(item: Incident): string {
  const direct = clean(item.affected_service);
  if (direct) return direct;
  const category = categoryText(item.category || '');
  if (category.includes('identity')) return 'sign-in, MFA, SSO, and account access';
  if (category.includes('cloud')) return 'hosted workloads, APIs, storage, and dependent applications';
  if (category.includes('security')) return 'security controls, alerts, endpoint visibility, and policy enforcement';
  if (category.includes('backup')) return 'backup jobs, restores, replication, and recovery points';
  if (category.includes('network') || category.includes('connectivity') || category.includes('isp')) return 'internet, DNS, routing, and site connectivity';
  if (category.includes('communication') || category.includes('collaboration')) return 'calling, messaging, meetings, files, and collaboration';
  if (category.includes('msp')) return 'ticketing, RMM, PSA, automation, and technician workflows';
  if (category.includes('payment') || category.includes('commerce') || category.includes('accounting')) return 'payments, invoicing, checkout, and transaction workflows';
  return `${item.category || item.provider} services`;
}

function categoryImpact(item: Incident, service: string): string {
  const major = item.service_state === 'major';
  const category = categoryText(item.category || '');
  if (category.includes('identity')) return major
    ? `${item.provider} may block sign-in, MFA, SSO, token refresh, or administrative access for ${service}.`
    : `${item.provider} may cause intermittent authentication, MFA, SSO, or token-refresh failures for ${service}.`;
  if (category.includes('security')) return major
    ? `${item.provider} may reduce protection, alert delivery, policy enforcement, or endpoint visibility for ${service}.`
    : `${item.provider} may delay alerts, management actions, policy sync, or security visibility for ${service}.`;
  if (category.includes('backup')) return major
    ? `${item.provider} may affect backup completion, replication, restore readiness, or recovery-point confidence for ${service}.`
    : `${item.provider} may delay backup, replication, management, or restore workflows for ${service}.`;
  if (category.includes('network') || category.includes('connectivity') || category.includes('isp')) return major
    ? `${item.provider} may interrupt internet, DNS, routing, or site access for ${service}.`
    : `${item.provider} may cause latency, packet loss, DNS errors, or intermittent access for ${service}.`;
  if (category.includes('msp')) return major
    ? `${item.provider} may disrupt tickets, RMM actions, automations, remote access, or other technician workflows for ${service}.`
    : `${item.provider} may slow syncs, automations, ticket updates, or remote actions for ${service}.`;
  if (category.includes('communication') || category.includes('collaboration')) return major
    ? `${item.provider} may block calling, meetings, messaging, files, notifications, or collaboration for ${service}.`
    : `${item.provider} may degrade calls, meetings, chat, notifications, file sync, or collaboration for ${service}.`;
  return major
    ? `${item.provider} may cause a major interruption for ${service}.`
    : `${item.provider} may degrade ${service}.`;
}

function derivedMspImpact(item: Incident, provider?: ProviderStatus): string {
  const configured = clean(item.client_impact || provider?.client_impact);
  if (configured.length > 24) return configured;
  const service = affectedServiceLabel(item);
  const sourceNote = provider?.source_confidence === 'high'
    ? 'The conclusion is based on structured first-party evidence.'
    : provider?.source_confidence === 'medium'
      ? 'The conclusion is based on a readable first-party feed or rendered page.'
      : 'Source confidence is limited; correlate before broad client communication.';
  return `${categoryImpact(item, service)} ${sourceNote}`;
}

function categoryAction(item: Incident): string {
  const category = categoryText(item.category || '');
  if (category.includes('identity')) return 'Capture tenant, user, MFA method, application, error, timestamp, and region; test a known-good account before escalating.';
  if (category.includes('security')) return 'Verify agent check-in, policy sync, alert ingestion, and protection coverage for high-risk clients before changing policy.';
  if (category.includes('backup')) return 'Review missed jobs and restore readiness, preserve logs, and retry only after vendor recovery is confirmed.';
  if (category.includes('network') || category.includes('connectivity') || category.includes('isp')) return 'Group reports by provider, circuit, and geography; avoid client-side network changes until provider scope is clear.';
  if (category.includes('msp')) return 'Keep work auditable outside the affected platform, pause risky bulk automation, and retry failed operations after recovery.';
  if (category.includes('communication') || category.includes('collaboration')) return 'Validate alternate communications and critical file access for affected clients while monitoring vendor updates.';
  return 'Capture client, service, error, timestamp, region, and business impact; correlate tickets before broad communication.';
}

function derivedTechnicianAction(item: Incident, provider?: ProviderStatus): string {
  const configured = clean(item.technician_action || provider?.technician_action);
  if (configured.length > 24) return configured;
  const caution = provider && provider.source_confidence !== 'high'
    ? ' Recheck the official source before client-wide messaging.'
    : ' Continue monitoring the official incident timeline.';
  return `${categoryAction(item)}${caution}`;
}

function operatorPriority(item: Incident, provider?: ProviderStatus): string {
  const criticalProvider = provider?.criticality === 'high' || (provider?.priority || item.priority || 0) >= 85;
  if (item.service_state === 'major' && criticalProvider) return 'P1: major issue on a high-priority dependency';
  if (item.service_state === 'major') return 'P1: major vendor issue; confirm client impact now';
  if (criticalProvider) return 'P2: high-priority dependency degraded';
  return 'P3: monitor, correlate tickets, and update as scope changes';
}

export function clientCommunicationDraft(item: Incident, provider?: ProviderStatus): string {
  const service = affectedServiceLabel(item);
  const severity = item.service_state === 'major' ? 'major service issue' : 'service degradation';
  const vendorNote = clean(item.note).slice(0, 220);
  return `DRAFT: We are monitoring a ${severity} affecting ${item.provider} ${service}. ${vendorNote ? `The vendor reports: ${vendorNote}. ` : ''}Client impact has not been confirmed unless separately communicated. We are correlating symptoms and will update as the vendor publishes recovery details.`;
}

function catalogFallback(provider: ProviderConfig, at: string): ProviderStatus {
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status: provider.enabled === false ? 'Disabled in provider catalog' : 'Pending source refresh',
    color: 'blue',
    service_state: 'unknown',
    source_state: provider.enabled === false ? 'disabled' : 'pending',
    attention: 'watch',
    message: provider.message || 'Waiting for generated status.',
    ok: false,
    source: provider.url,
    priority: provider.priority || 0,
    criticality: provider.criticality,
    tags: provider.tags || [],
    services: provider.services || [],
    client_impact: provider.client_impact,
    technician_action: provider.technician_action,
    checked_at: at,
    source_type: provider.sourceType,
    download_log: [],
    evidence_tier: 'limited',
    source_confidence: 'none',
    consecutive_failures: 0,
    component_status: []
  };
}

function merge(payload: StatusPayload, catalog: ProviderConfig[]): ProviderStatus[] {
  const map = new Map<string, ProviderStatus>();
  for (const provider of payload.providers) {
    if (map.has(provider.id)) throw new Error(`Duplicate provider id in status payload: ${provider.id}`);
    map.set(provider.id, provider);
  }
  for (const provider of catalog) {
    if (!map.has(provider.id)) map.set(provider.id, catalogFallback(provider, payload.generated_at));
  }
  return [...map.values()];
}

export function filterDiagnostics(items: DiagnosticSource[], query: string, filters: string[]): DiagnosticSource[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter(item => (!normalizedQuery || item.searchText.includes(normalizedQuery)) && filters.every(filter =>
    filter === 'attention' ? item.attention !== 'informational'
      : filter === 'changed' ? item.changed
        : filter === 'incident' ? ['major', 'degraded'].includes(item.serviceState)
          : filter === 'high' ? item.criticality === 'high'
            : filter === 'operational' ? item.serviceState === 'operational'
              : filter === 'structured' ? item.evidenceTier === 'structured'
                : filter === 'schema-change' ? item.schemaChanged
                  : filter === 'failure-streak' ? item.consecutiveFailures >= 2
                    : filter === item.sourceState || filter === item.serviceState || item.tags.includes(filter) || item.category.toLowerCase().includes(filter)
  ));
}

export function buildIssueConsoleModel(payload: StatusPayload, version: string, catalog: ProviderConfig[] = []): IssueConsoleModel {
  const changed = new Set(payload.changes.map(change => change.provider_id));
  const mergedProviders = merge(payload, catalog);
  const providerMap = new Map(mergedProviders.map(provider => [provider.id, provider]));
  const maintenance = [...(payload.maintenance || [])].sort((a, b) => {
    const stateDelta = Number(b.status === 'in_progress') - Number(a.status === 'in_progress');
    if (stateDelta) return stateDelta;
    return (Date.parse(a.starts_at || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(b.starts_at || '') || Number.MAX_SAFE_INTEGER);
  });

  const diagnostics = mergedProviders.map(provider => {
    const components = provider.component_status || [];
    const relatedIncidents = payload.incidents.filter(item => item.providerId === provider.id);
    const relatedMaintenance = maintenance.filter(item => item.providerId === provider.id);
    return {
      id: provider.id,
      provider: provider.name,
      category: provider.category,
      serviceState: provider.service_state,
      sourceState: provider.source_state,
      attention: provider.attention,
      status: provider.status,
      message: provider.message || '',
      source: provider.source,
      ok: provider.ok,
      checkedAt: provider.checked_at || payload.generated_at,
      sourceType: provider.source_type || 'unknown',
      downloadLog: provider.download_log || [],
      priority: provider.priority,
      criticality: provider.criticality || 'medium',
      tags: (provider.tags || []).map(tag => tag.toLowerCase()),
      services: provider.services || [],
      clientImpact: provider.client_impact || '',
      technicianAction: provider.technician_action || '',
      evidenceTier: provider.evidence_tier || 'public-page',
      sourceConfidence: provider.source_confidence || 'low',
      parserVersion: provider.parser_version || '',
      schemaFingerprint: provider.schema_fingerprint || '',
      schemaChanged: provider.schema_changed === true,
      lastSuccessAt: provider.last_success_at || '',
      consecutiveFailures: provider.consecutive_failures || 0,
      lastSemanticChangeAt: provider.last_semantic_change_at || '',
      componentStatus: components,
      searchText: `${provider.name} ${provider.category} ${(provider.tags || []).join(' ')} ${(provider.services || []).join(' ')} ${components.map(component => `${component.name} ${component.status}`).join(' ')} ${relatedIncidents.map(item => `${item.title} ${item.note}`).join(' ')} ${relatedMaintenance.map(item => `${item.title} ${item.note}`).join(' ')}`.toLowerCase(),
      changed: changed.has(provider.id)
    };
  }).sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || serviceRank[b.serviceState] - serviceRank[a.serviceState] || Number(b.changed) - Number(a.changed) || b.priority - a.priority || a.provider.localeCompare(b.provider));

  const briefs = [...payload.incidents]
    .sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || serviceRank[b.service_state] - serviceRank[a.service_state] || b.priority - a.priority)
    .map(item => {
      const provider = providerMap.get(item.providerId);
      const brief: IssueBrief = {
        ...item,
        label: item.service_state === 'major' ? 'Major incident' : 'Degraded service',
        affectedServiceLabel: affectedServiceLabel(item),
        mspImpact: derivedMspImpact(item, provider),
        technicianAction: derivedTechnicianAction(item, provider),
        operatorPriority: operatorPriority(item, provider),
        clientDraft: ''
      };
      return { ...brief, clientDraft: clientCommunicationDraft(brief, provider) };
    });

  const componentIssueCount = diagnostics.flatMap(item => item.componentStatus)
    .filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(component.status)).length;

  return {
    version,
    generatedAt: payload.generated_at,
    incidentCount: briefs.length,
    affectedCount: payload.summary.affected_provider_count,
    briefs,
    maintenance,
    diagnostics,
    changes: payload.changes,
    history: payload.history,
    summary: payload.summary,
    attentionCount: diagnostics.filter(item => ['critical', 'action'].includes(item.attention)).length,
    newIncidentCount: payload.changes.filter(item => item.type === 'incident_new').length,
    resolvedCount: payload.changes.filter(item => item.type === 'incident_resolved').length,
    newUnavailableCount: payload.changes.filter(item => item.type === 'source_unavailable').length,
    maintenanceCount: maintenance.length,
    ongoingMaintenanceCount: maintenance.filter(item => item.status === 'in_progress').length,
    schemaChangeCount: diagnostics.filter(item => item.schemaChanged).length,
    failureStreakCount: diagnostics.filter(item => item.consecutiveFailures >= 2).length,
    highConfidenceCount: diagnostics.filter(item => item.sourceConfidence === 'high').length,
    componentIssueCount
  };
}

export function wallboardSubset(model: IssueConsoleModel): DiagnosticSource[] {
  return model.diagnostics.filter(item => item.attention !== 'informational' || item.changed);
}
