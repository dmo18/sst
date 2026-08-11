export const STATUS_CONTRACT_VERSION = 3 as const;
export const STATUS_WIRE_SCHEMA_VERSION = 3 as const;
export const LEGACY_INTERNAL_SCHEMA_VERSION = 2 as const;
export const SERVICE_STATES = ['operational', 'degraded', 'major', 'unknown'] as const;
export const SOURCE_STATES = ['available', 'limited', 'unavailable', 'disabled', 'pending', 'stale'] as const;
export const SOURCE_HEALTH_STATES = ['healthy', 'watch', 'blind'] as const;
export const TRUTH_BASES = ['vendor-incident', 'vendor-component', 'observed-affected-no-detail', 'confirmed-operational', 'observed-no-conclusion', 'last-known-official', 'limited-official', 'no-current-observation'] as const;
export const FRESHNESS_STATES = ['fresh', 'aging', 'stale', 'unknown'] as const;
export const STATUS_COLORS = ['green', 'amber', 'red', 'blue'] as const;
export const ATTENTION_LEVELS = ['critical', 'action', 'watch', 'informational'] as const;
export const SOURCE_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'none'] as const;
export const EVIDENCE_TIERS = ['structured', 'feed', 'rendered-page', 'public-page', 'limited'] as const;
export const MAINTENANCE_STATES = ['scheduled', 'in_progress', 'completed', 'unknown'] as const;
export const CURRENT_PAGE_EVIDENCE_BASIS = 'current-page' as const;
export const INCIDENT_EVIDENCE_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

function parsedTimestamp(value: unknown): number {
  const timestamp = Date.parse(typeof value === 'string' ? value : '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export interface IncidentTimeFields {
  latest_update?: string;
  rawTime?: string;
  first_detected?: string;
  observed_at?: string;
  evidence_basis?: string;
}

export function effectiveIncidentTime(item: IncidentTimeFields): string {
  for (const key of ['latest_update', 'rawTime', 'first_detected'] as const) {
    const value = item[key];
    if (parsedTimestamp(value)) return value || '';
  }
  if (item.evidence_basis === CURRENT_PAGE_EVIDENCE_BASIS && parsedTimestamp(item.observed_at)) return item.observed_at || '';
  return '';
}

export function incidentTemporalEvidence(item: IncidentTimeFields, now = Date.now()): { valid: boolean; kind: 'vendor-time' | 'current-page' | 'missing'; value: string; timestamp: number; ageMs: number } {
  for (const key of ['latest_update', 'rawTime', 'first_detected'] as const) {
    const value = item[key];
    const timestamp = parsedTimestamp(value);
    if (!timestamp) continue;
    const ageMs = now - timestamp;
    return { valid: ageMs >= -MAX_FUTURE_SKEW_MS && ageMs <= INCIDENT_EVIDENCE_MAX_AGE_MS, kind: 'vendor-time', value: value || '', timestamp, ageMs };
  }

  const timestamp = parsedTimestamp(item.observed_at);
  const currentPage = item.evidence_basis === CURRENT_PAGE_EVIDENCE_BASIS;
  const ageMs = timestamp ? now - timestamp : Number.POSITIVE_INFINITY;
  return {
    valid: currentPage && timestamp > 0 && ageMs >= -MAX_FUTURE_SKEW_MS && ageMs <= INCIDENT_EVIDENCE_MAX_AGE_MS,
    kind: currentPage ? 'current-page' : 'missing',
    value: currentPage ? item.observed_at || '' : '',
    timestamp,
    ageMs
  };
}