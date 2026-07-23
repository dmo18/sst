import type { StatusPayload } from './types';
const services = new Set(['operational', 'degraded', 'major', 'unknown']);
const sources = new Set(['available', 'limited', 'unavailable', 'disabled', 'pending', 'stale']);
const colors = new Set(['green', 'amber', 'red', 'blue']);
const attention = new Set(['critical', 'action', 'watch', 'informational']);
const http = (value: unknown) => { try {
    return typeof value === 'string' && ['http:', 'https:'].includes(new URL(value).protocol);
}
catch {
    return false;
} };
export function payloadValidationErrors(value: unknown): string[] {
    const e: string[] = [];
    if (!value || typeof value !== 'object')
        return ['payload must be an object'];
    const p = value as Record<string, unknown>;
    if (p.schema_version !== 2)
        e.push('unsupported schema_version');
    if (typeof p.generated_at !== 'string' || !Number.isFinite(Date.parse(p.generated_at)))
        e.push('invalid generated_at');
    if (!Array.isArray(p.providers))
        e.push('providers must be an array');
    if (!Array.isArray(p.incidents))
        e.push('incidents must be an array');
    if (!Array.isArray(p.changes) || !Array.isArray(p.history))
        e.push('changes and history must be arrays');
    const providers = Array.isArray(p.providers) ? p.providers as Record<string, unknown>[] : [];
    const ids = new Set<string>();
    for (const x of providers) {
        if (!x || typeof x !== 'object') {
            e.push('provider must be an object');
            continue;
        }
        for (const k of ['id', 'name', 'category', 'status', 'source'])
            if (typeof x[k] !== 'string' || !x[k])
                e.push(`provider ${String(x.id)} missing ${k}`);
        if (ids.has(String(x.id)))
            e.push(`duplicate provider ${String(x.id)}`);
        ids.add(String(x.id));
        if (!services.has(String(x.service_state)))
            e.push(`invalid service_state ${String(x.id)}`);
        if (!sources.has(String(x.source_state)))
            e.push(`invalid source_state ${String(x.id)}`);
        if (!colors.has(String(x.color)))
            e.push(`invalid color ${String(x.id)}`);
        if (!attention.has(String(x.attention)))
            e.push(`invalid attention ${String(x.id)}`);
        if (typeof x.ok !== 'boolean')
            e.push(`invalid ok ${String(x.id)}`);
        if (!Number.isFinite(x.priority) || Number(x.priority) < 0)
            e.push(`invalid priority ${String(x.id)}`);
        if (!http(x.source))
            e.push(`invalid source URL ${String(x.id)}`);
    }
    const incidents = Array.isArray(p.incidents) ? p.incidents as Record<string, unknown>[] : [];
    const incidentIds = new Set<string>();
    for (const x of incidents) {
        if (!ids.has(String(x.providerId)))
            e.push(`unknown incident provider ${String(x.providerId)}`);
        if (incidentIds.has(String(x.id)))
            e.push(`duplicate incident ${String(x.id)}`);
        incidentIds.add(String(x.id));
        if (!http(x.url))
            e.push(`invalid incident URL ${String(x.id)}`);
        if (!['degraded', 'major'].includes(String(x.service_state)))
            e.push(`invalid incident state ${String(x.id)}`);
        if (!attention.has(String(x.attention)))
            e.push(`invalid incident attention ${String(x.id)}`);
        if (x.rawTime && (!Number.isFinite(Date.parse(String(x.rawTime))) || Date.parse(String(x.rawTime)) > Date.now() + 300000))
            e.push(`invalid incident timestamp ${String(x.id)}`);
    }
    const s = p.summary as Record<string, unknown> | undefined;
    if (!s || typeof s !== 'object')
        e.push('summary must be an object');
    else {
        if (!services.has(String(s.service_overall)))
            e.push('invalid summary service_overall');
        if (!sources.has(String(s.source_overall)))
            e.push('invalid summary source_overall');
        const numeric = ['active_incident_count', 'affected_provider_count', 'confirmed_operational_count', 'degraded_count', 'major_count', 'unknown_count', 'limited_count', 'unavailable_count', 'disabled_count', 'pending_count', 'stale_count', 'provider_total', 'enabled_provider_count', 'coverage_percent', 'confirmed_operational_percent'];
        for (const k of numeric)
            if (!Number.isFinite(s[k]) || Number(s[k]) < 0)
                e.push(`invalid summary ${k}`);
        if (s.provider_total !== providers.length)
            e.push('provider count mismatch');
        if (s.active_incident_count !== incidents.length)
            e.push('incident count mismatch');
        if (s.affected_provider_count !== new Set(incidents.map(x => x.providerId)).size)
            e.push('affected provider count mismatch');
        const count = (k: string, v: string) => providers.filter(x => x[k] === v).length;
        if (s.confirmed_operational_count !== count('service_state', 'operational') || s.degraded_count !== count('service_state', 'degraded') || s.major_count !== count('service_state', 'major') || s.unknown_count !== count('service_state', 'unknown'))
            e.push('service counts do not reconcile');
        if (s.limited_count !== count('source_state', 'limited') || s.unavailable_count !== count('source_state', 'unavailable') || s.disabled_count !== count('source_state', 'disabled') || s.pending_count !== count('source_state', 'pending') || s.stale_count !== count('source_state', 'stale'))
            e.push('source counts do not reconcile');
        const enabled = providers.filter(x => x.source_state !== 'disabled');
        const available = count('source_state', 'available');
        const expectedCoverage = enabled.length ? Math.round(available / enabled.length * 100) : 0;
        const expectedOperational = enabled.length ? Math.round(count('service_state', 'operational') / enabled.length * 100) : 0;
        if (s.enabled_provider_count !== enabled.length || s.coverage_percent !== expectedCoverage || s.confirmed_operational_percent !== expectedOperational)
            e.push('coverage counts do not reconcile');
    }
    return e;
}
export function isStatusPayload(value: unknown): value is StatusPayload { return payloadValidationErrors(value).length === 0; }
