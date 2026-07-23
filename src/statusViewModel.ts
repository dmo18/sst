import type { AttentionLevel, Incident, ProviderConfig, ProviderDownloadLog, ProviderStatus, ServiceState, SourceState, StatusChange, StatusPayload } from './types';
const serviceRank: Record<ServiceState, number> = { major: 4, degraded: 3, unknown: 2, operational: 1 };
const attentionRank: Record<AttentionLevel, number> = { critical: 4, action: 3, watch: 2, informational: 1 };
export interface IssueBrief extends Incident {
    label: string;
    clientDraft: string;
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
export function clientCommunicationDraft(i: Incident): string { const symptom = i.note ? ` The vendor reports: ${i.note.replace(/\s+/g, ' ').slice(0, 220)}` : ''; return `DRAFT — We are monitoring a reported service issue affecting ${i.provider}.${symptom} Some users may experience disruption to ${i.affected_service || 'the affected service'}. Our team is monitoring official updates and will provide further information as it becomes available. Client impact has not been confirmed unless separately communicated.`; }
function catalogFallback(p: ProviderConfig, at: string): ProviderStatus { return { id: p.id, name: p.name, category: p.category, status: p.enabled === false ? 'Disabled in provider catalog' : 'Pending source refresh', color: 'blue', service_state: 'unknown', source_state: p.enabled === false ? 'disabled' : 'pending', attention: 'watch', message: p.message || 'Waiting for generated status.', ok: false, source: p.url, priority: p.priority || 0, criticality: p.criticality, tags: p.tags || [], services: p.services || [], client_impact: p.client_impact, technician_action: p.technician_action, checked_at: at, source_type: p.sourceType, download_log: [] }; }
function merge(payload: StatusPayload, catalog: ProviderConfig[]) { const map = new Map<string, ProviderStatus>(); for (const p of payload.providers) {
    if (map.has(p.id))
        throw new Error(`Duplicate provider id in status payload: ${p.id}`);
    map.set(p.id, p);
} for (const p of catalog)
    if (!map.has(p.id))
        map.set(p.id, catalogFallback(p, payload.generated_at)); return [...map.values()]; }
export function filterDiagnostics(items: DiagnosticSource[], query: string, filters: string[]): DiagnosticSource[] { const q = query.trim().toLowerCase(); return items.filter(x => (!q || x.searchText.includes(q)) && filters.every(f => f === 'attention' ? x.attention !== 'informational' : f === 'changed' ? x.changed : f === 'incident' ? ['major', 'degraded'].includes(x.serviceState) : f === 'high' ? x.criticality === 'high' : f === 'operational' ? x.serviceState === 'operational' : f === x.sourceState || f === x.serviceState || x.tags.includes(f) || x.category.toLowerCase().includes(f))); }
export function buildIssueConsoleModel(payload: StatusPayload, version: string, catalog: ProviderConfig[] = []): IssueConsoleModel {
    const changed = new Set(payload.changes.map(c => c.provider_id));
    const diagnostics = merge(payload, catalog).map(p => ({ id: p.id, provider: p.name, category: p.category, serviceState: p.service_state, sourceState: p.source_state, attention: p.attention, status: p.status, message: p.message || '', source: p.source, ok: p.ok, checkedAt: p.checked_at || payload.generated_at, sourceType: p.source_type || 'unknown', downloadLog: p.download_log || [], priority: p.priority, criticality: p.criticality || 'medium', tags: (p.tags || []).map(x => x.toLowerCase()), services: p.services || [], clientImpact: p.client_impact || '', technicianAction: p.technician_action || '', searchText: `${p.name} ${p.category} ${(p.tags || []).join(' ')} ${(p.services || []).join(' ')} ${payload.incidents.filter(i => i.providerId === p.id).map(i => `${i.title} ${i.note}`).join(' ')}`.toLowerCase(), changed: changed.has(p.id) })).sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || serviceRank[b.serviceState] - serviceRank[a.serviceState] || Number(b.changed) - Number(a.changed) || b.priority - a.priority || a.provider.localeCompare(b.provider));
    const briefs = [...payload.incidents].sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || serviceRank[b.service_state] - serviceRank[a.service_state] || b.priority - a.priority).map(i => ({ ...i, label: i.service_state === 'major' ? 'Major incident' : 'Degraded service', clientDraft: clientCommunicationDraft(i) }));
    return { version, generatedAt: payload.generated_at, incidentCount: briefs.length, affectedCount: payload.summary.affected_provider_count, briefs, diagnostics, changes: payload.changes, history: payload.history, summary: payload.summary, attentionCount: diagnostics.filter(x => ['critical', 'action'].includes(x.attention)).length, newIncidentCount: payload.changes.filter(x => x.type === 'incident_new').length, resolvedCount: payload.changes.filter(x => x.type === 'incident_resolved').length, newUnavailableCount: payload.changes.filter(x => x.type === 'source_unavailable').length };
}
export function wallboardSubset(model: IssueConsoleModel) { return model.diagnostics.filter(x => x.attention !== 'informational' || x.changed); }
