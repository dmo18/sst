import { payloadValidationErrors } from './payloadValidation.ts';
import type { AttentionLevel, Incident, ProviderStatus, ServiceState, SourceState, StatusPayload } from './types';

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): value is UnknownRecord => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const color = (value: unknown): ProviderStatus['color'] => ['green', 'amber', 'red', 'blue'].includes(String(value)) ? value as ProviderStatus['color'] : 'blue';
const httpUrl = (value: unknown): string | undefined => { try { const url = new URL(String(value)); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined; } catch { return undefined; } };
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: unknown) => Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;
function legacyStates(item: UnknownRecord): { service: ServiceState; source: SourceState; attention: AttentionLevel } {
  const visual = color(item.color); const ok = item.ok === true;
  const service: ServiceState = visual === 'red' ? 'major' : visual === 'amber' ? 'degraded' : 'unknown';
  const source: SourceState = !ok ? 'unavailable' : visual === 'blue' ? 'limited' : 'available';
  const attention: AttentionLevel = service === 'major' ? 'critical' : service === 'degraded' ? 'action' : source === 'available' ? 'informational' : 'watch';
  return { service, source, attention };
}
function summary(providers: ProviderStatus[], incidents: Incident[]): StatusPayload['summary'] {
  const count = (field: 'service_state' | 'source_state', value: string) => providers.filter(provider => provider[field] === value).length;
  const enabled = providers.filter(provider => provider.source_state !== 'disabled'); const available = count('source_state', 'available');
  const major = count('service_state', 'major'); const degraded = count('service_state', 'degraded'); const unknown = count('service_state', 'unknown');
  return { service_overall: major ? 'major' : degraded ? 'degraded' : unknown ? 'unknown' : 'operational', source_overall: count('source_state', 'unavailable') ? 'unavailable' : count('source_state', 'stale') ? 'stale' : count('source_state', 'limited') ? 'limited' : count('source_state', 'pending') ? 'pending' : available === enabled.length && enabled.length ? 'available' : 'unavailable', active_incident_count: incidents.length, affected_provider_count: new Set(incidents.map(incident => incident.providerId)).size, confirmed_operational_count: count('service_state', 'operational'), degraded_count: degraded, major_count: major, unknown_count: unknown, limited_count: count('source_state', 'limited'), unavailable_count: count('source_state', 'unavailable'), disabled_count: count('source_state', 'disabled'), pending_count: count('source_state', 'pending'), stale_count: count('source_state', 'stale'), provider_total: providers.length, enabled_provider_count: enabled.length, coverage_percent: enabled.length ? Math.round(available / enabled.length * 100) : 0, confirmed_operational_percent: enabled.length ? Math.round(count('service_state', 'operational') / enabled.length * 100) : 0 };
}
export function migrateLegacyPayload(value: unknown): StatusPayload | null {
  if (!record(value) || value.schema_version !== 1 || !Array.isArray(value.providers) || !Array.isArray(value.incidents) || typeof value.generated_at !== 'string' || !Number.isFinite(Date.parse(value.generated_at))) return null;
  const providers: ProviderStatus[] = value.providers.flatMap((raw): ProviderStatus[] => {
    if (!record(raw)) return []; const source = httpUrl(raw.source); const id = text(raw.id); const name = text(raw.name); const category = text(raw.category); if (!source || !id || !name || !category) return [];
    const states = legacyStates(raw); return [{ id, name, category, status: text(raw.status, 'Legacy status unavailable'), color: color(raw.color), service_state: states.service, source_state: states.source, attention: states.attention, message: text(raw.message), ok: raw.ok === true, source, priority: number(raw.priority), checked_at: text(raw.checked_at) || undefined, source_type: text(raw.source_type) || 'legacy', download_log: Array.isArray(raw.download_log) ? raw.download_log.filter(record) : [] }];
  });
  if (providers.length !== value.providers.length) return null; const providerIds = new Set(providers.map(provider => provider.id)); const identities = new Set<string>();
  const incidents: Incident[] = value.incidents.flatMap((raw, index): Incident[] => {
    if (!record(raw)) return []; const providerId = text(raw.providerId); const url = httpUrl(raw.url); if (!providerIds.has(providerId) || !url) return [];
    const visual = color(raw.color); if (!['red', 'amber'].includes(visual)) return []; const rawTime = text(raw.rawTime); if (rawTime && (!Number.isFinite(Date.parse(rawTime)) || Date.parse(rawTime) > Date.now() + 300_000)) return [];
    const base = `${providerId}:${text(raw.title, 'incident').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || index}`; let id = base; while (identities.has(id)) id = `${base}-${index}`; identities.add(id);
    const service_state = visual === 'red' ? 'major' : 'degraded'; return [{ id, providerId, provider: text(raw.provider, providers.find(provider => provider.id === providerId)?.name), category: text(raw.category), title: text(raw.title, 'Service incident'), note: text(raw.note, 'No official detail was provided.'), source: text(raw.source, 'Official source'), url, time: text(raw.time), rawTime: rawTime || undefined, status: text(raw.status), color: visual, service_state, attention: service_state === 'major' ? 'critical' : 'action', priority: number(raw.priority), first_detected: rawTime || undefined, latest_update: rawTime || undefined }];
  });
  const payload: StatusPayload = { schema_version: 2, generated_at: value.generated_at, providers, incidents, summary: summary(providers, incidents), changes: [], history: [] };
  return payloadValidationErrors(payload).length ? null : payload;
}
export function normalizeStatusPayload(value: unknown): { payload?: StatusPayload; migrated: boolean; errors: string[] } {
  const errors = payloadValidationErrors(value); if (!errors.length) return { payload: value as StatusPayload, migrated: false, errors: [] };
  const migrated = migrateLegacyPayload(value); return migrated ? { payload: migrated, migrated: true, errors: [] } : { migrated: false, errors };
}
