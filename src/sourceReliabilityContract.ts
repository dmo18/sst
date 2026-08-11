export const SOURCE_RELIABILITY_WINDOW_DAYS = 7;
export const SOURCE_RELIABILITY_LONG_WINDOW_DAYS = 30;
export const SOURCE_RELIABILITY_MIN_SAMPLES = 10;
export const SOURCE_RELIABILITY_SLO_STATES = ['warming', 'meeting', 'watch', 'breach'] as const;
export const SCHEMA_CANARY_STATES = ['stable', 'changed', 'unobserved'] as const;
export const SCHEMA_CANARY_OBSERVATIONS = ['accepted', 'unavailable'] as const;
export const SCHEMA_QUARANTINE_STATES = ['clear', 'observing', 'quarantined'] as const;

const sloStates = new Set<string>(SOURCE_RELIABILITY_SLO_STATES);
const canaryStates = new Set<string>(SCHEMA_CANARY_STATES);
const canaryObservations = new Set<string>(SCHEMA_CANARY_OBSERVATIONS);
const quarantineStates = new Set<string>(SCHEMA_QUARANTINE_STATES);

function integer(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}

function percentage(value: unknown): boolean {
  return integer(value) && Number(value) <= 100;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function normalizedDay(value: unknown): { date: string; samples: number; live: number; limited: number; unavailable: number; schemaChanges: number } | null {
  const day = record(value);
  if (!day) return null;
  const date = typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date : '';
  const samples = Number(day.samples || 0);
  const live = Number(day.live || 0);
  const limited = Number(day.limited || 0);
  const unavailable = Number(day.unavailable || 0);
  const schemaChanges = Number(day.schema_changes || 0);
  if (!date || ![samples, live, limited, unavailable, schemaChanges].every(integer)) return null;
  if (live + limited + unavailable !== samples) return null;
  return { date, samples, live, limited, unavailable, schemaChanges };
}

function reliabilityWindowErrors(value: unknown, expectedDays: number, label: string): string[] {
  const errors: string[] = [];
  const reliability = record(value);
  if (!reliability) return [`missing ${label}`];
  if (reliability.window_days !== expectedDays) errors.push(`invalid ${label} window_days`);
  for (const key of ['sample_count', 'schema_change_count']) if (!integer(reliability[key])) errors.push(`invalid ${label} ${key}`);
  for (const key of ['live_percent', 'limited_percent', 'unavailable_percent']) if (!percentage(reliability[key])) errors.push(`invalid ${label} ${key}`);
  if (!sloStates.has(String(reliability.slo_state))) errors.push(`invalid ${label} slo_state`);
  if (!Array.isArray(reliability.daily) || reliability.daily.length > expectedDays) {
    errors.push(`invalid ${label} daily`);
    return errors;
  }

  const days = reliability.daily.map(normalizedDay);
  if (days.some(day => !day)) {
    errors.push(`invalid ${label} daily bucket`);
    return errors;
  }
  const validDays = days.filter((day): day is NonNullable<typeof day> => Boolean(day));
  const distinct = new Set(validDays.map(day => day.date));
  if (distinct.size !== validDays.length) errors.push(`duplicate ${label} day`);
  const totals = validDays.reduce((sum, day) => ({
    samples: sum.samples + day.samples,
    live: sum.live + day.live,
    limited: sum.limited + day.limited,
    unavailable: sum.unavailable + day.unavailable,
    schemaChanges: sum.schemaChanges + day.schemaChanges
  }), { samples: 0, live: 0, limited: 0, unavailable: 0, schemaChanges: 0 });
  if (totals.samples !== reliability.sample_count) errors.push(`${label} sample_count mismatch`);
  if (totals.schemaChanges !== reliability.schema_change_count) errors.push(`${label} schema_change_count mismatch`);
  const expectedLive = totals.samples ? Math.round(totals.live / totals.samples * 100) : 0;
  const expectedLimited = totals.samples ? Math.round(totals.limited / totals.samples * 100) : 0;
  const expectedUnavailable = totals.samples ? Math.round(totals.unavailable / totals.samples * 100) : 0;
  if (expectedLive !== reliability.live_percent || expectedLimited !== reliability.limited_percent || expectedUnavailable !== reliability.unavailable_percent) errors.push(`${label} percentage mismatch`);
  return errors;
}

export function sourceIntelligenceMetadataErrors(providerValue: unknown): string[] {
  const errors: string[] = [];
  const provider = record(providerValue);
  if (!provider) return ['provider metadata must be an object'];

  const reliability = record(provider.source_reliability);
  errors.push(...reliabilityWindowErrors(reliability, SOURCE_RELIABILITY_WINDOW_DAYS, 'source_reliability'));
  if (reliability) errors.push(...reliabilityWindowErrors(reliability.window_30d, SOURCE_RELIABILITY_LONG_WINDOW_DAYS, 'source_reliability window_30d'));

  const canary = record(provider.schema_canary);
  if (!canary) {
    errors.push('missing schema_canary');
  } else {
    if (!canaryStates.has(String(canary.state))) errors.push('invalid schema_canary state');
    if (!canaryObservations.has(String(canary.observation))) errors.push('invalid schema_canary observation');
    if (typeof canary.fingerprint !== 'string') errors.push('invalid schema_canary fingerprint');
    if (canary.last_changed_at && !(typeof canary.last_changed_at === 'string' && Number.isFinite(Date.parse(canary.last_changed_at)))) errors.push('invalid schema_canary last_changed_at');
    if (canary.state === 'changed' && !(typeof canary.last_changed_at === 'string' && Number.isFinite(Date.parse(canary.last_changed_at)))) errors.push('changed schema_canary requires last_changed_at');
    if (canary.state !== 'unobserved' && !canary.fingerprint) errors.push('observed schema_canary requires fingerprint');
    if (!quarantineStates.has(String(canary.quarantine_state))) errors.push('invalid schema_canary quarantine_state');
    if (!integer(canary.stable_observations)) errors.push('invalid schema_canary stable_observations');
    if (canary.quarantine_since && !(typeof canary.quarantine_since === 'string' && Number.isFinite(Date.parse(canary.quarantine_since)))) errors.push('invalid schema_canary quarantine_since');
    if (['observing', 'quarantined'].includes(String(canary.quarantine_state)) && !(typeof canary.quarantine_since === 'string' && Number.isFinite(Date.parse(canary.quarantine_since)))) errors.push('active schema quarantine requires quarantine_since');
  }
  return errors;
}