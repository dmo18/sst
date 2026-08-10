export const SOURCE_RELIABILITY_WINDOW_DAYS = 7;
export const SOURCE_RELIABILITY_MIN_SAMPLES = 10;

const SLO_STATES = new Set(['warming', 'meeting', 'watch', 'breach']);
const CANARY_STATES = new Set(['stable', 'changed', 'unobserved']);
const CANARY_OBSERVATIONS = new Set(['accepted', 'unavailable']);

function integer(value) {
  return Number.isInteger(value) && Number(value) >= 0;
}

function percentage(value) {
  return integer(value) && Number(value) <= 100;
}

function dateKey(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : '';
}

function addDays(date, days) {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + days * 86400000).toISOString().slice(0, 10);
}

function normalizedDay(value) {
  if (!value || typeof value !== 'object') return null;
  const date = typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : '';
  const samples = Number(value.samples || 0);
  const live = Number(value.live || 0);
  const limited = Number(value.limited || 0);
  const unavailable = Number(value.unavailable || 0);
  const schemaChanges = Number(value.schema_changes || 0);
  if (!date || ![samples, live, limited, unavailable, schemaChanges].every(integer)) return null;
  if (live + limited + unavailable !== samples) return null;
  return { date, samples, live, limited, unavailable, schema_changes: schemaChanges };
}

function currentObservation(provider) {
  if (provider?.source_state === 'available' && provider?.ok === true) return 'live';
  if (['limited', 'stale'].includes(provider?.source_state)) return 'limited';
  return 'unavailable';
}

function sloState(sampleCount, livePercent, unavailableCount) {
  if (sampleCount < SOURCE_RELIABILITY_MIN_SAMPLES) return 'warming';
  if (livePercent >= 99 && unavailableCount === 0) return 'meeting';
  if (livePercent >= 95) return 'watch';
  return 'breach';
}

export function rollSourceReliability(previous, provider, generatedAt, schemaChanged = false) {
  const today = dateKey(generatedAt) || dateKey(new Date().toISOString());
  const earliest = addDays(today, -(SOURCE_RELIABILITY_WINDOW_DAYS - 1));
  const dailyMap = new Map();
  for (const raw of Array.isArray(previous?.daily) ? previous.daily : []) {
    const day = normalizedDay(raw);
    if (!day || day.date < earliest || day.date > today) continue;
    dailyMap.set(day.date, day);
  }

  const current = dailyMap.get(today) || { date: today, samples: 0, live: 0, limited: 0, unavailable: 0, schema_changes: 0 };
  const observation = currentObservation(provider);
  current.samples += 1;
  current[observation] += 1;
  if (schemaChanged) current.schema_changes += 1;
  dailyMap.set(today, current);

  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-SOURCE_RELIABILITY_WINDOW_DAYS);
  const totals = daily.reduce((sum, day) => ({
    samples: sum.samples + day.samples,
    live: sum.live + day.live,
    limited: sum.limited + day.limited,
    unavailable: sum.unavailable + day.unavailable,
    schemaChanges: sum.schemaChanges + day.schema_changes
  }), { samples: 0, live: 0, limited: 0, unavailable: 0, schemaChanges: 0 });
  const livePercent = totals.samples ? Math.round(totals.live / totals.samples * 100) : 0;
  const limitedPercent = totals.samples ? Math.round(totals.limited / totals.samples * 100) : 0;
  const unavailablePercent = totals.samples ? Math.round(totals.unavailable / totals.samples * 100) : 0;

  return {
    window_days: SOURCE_RELIABILITY_WINDOW_DAYS,
    sample_count: totals.samples,
    live_percent: livePercent,
    limited_percent: limitedPercent,
    unavailable_percent: unavailablePercent,
    schema_change_count: totals.schemaChanges,
    slo_state: sloState(totals.samples, livePercent, totals.unavailable),
    daily
  };
}

export function buildSchemaCanary(previousProvider, provider, schemaChanged, generatedAt) {
  const fingerprint = typeof provider?.schema_fingerprint === 'string' ? provider.schema_fingerprint : '';
  const accepted = provider?.source_state === 'available' && provider?.ok === true;
  return {
    state: !fingerprint ? 'unobserved' : schemaChanged ? 'changed' : 'stable',
    observation: accepted ? 'accepted' : 'unavailable',
    fingerprint,
    last_changed_at: schemaChanged ? generatedAt : previousProvider?.schema_canary?.last_changed_at || ''
  };
}

export function sourceIntelligenceMetadataErrors(provider) {
  const errors = [];
  const reliability = provider?.source_reliability;
  if (!reliability || typeof reliability !== 'object') {
    errors.push('missing source_reliability');
  } else {
    if (reliability.window_days !== SOURCE_RELIABILITY_WINDOW_DAYS) errors.push('invalid source_reliability window_days');
    for (const key of ['sample_count', 'schema_change_count']) if (!integer(reliability[key])) errors.push(`invalid source_reliability ${key}`);
    for (const key of ['live_percent', 'limited_percent', 'unavailable_percent']) if (!percentage(reliability[key])) errors.push(`invalid source_reliability ${key}`);
    if (!SLO_STATES.has(reliability.slo_state)) errors.push('invalid source_reliability slo_state');
    if (!Array.isArray(reliability.daily) || reliability.daily.length > SOURCE_RELIABILITY_WINDOW_DAYS) {
      errors.push('invalid source_reliability daily');
    } else {
      const days = reliability.daily.map(normalizedDay);
      if (days.some(day => !day)) errors.push('invalid source_reliability daily bucket');
      else {
        const validDays = days.filter(Boolean);
        const distinct = new Set(validDays.map(day => day.date));
        if (distinct.size !== validDays.length) errors.push('duplicate source_reliability day');
        const totals = validDays.reduce((sum, day) => ({
          samples: sum.samples + day.samples,
          live: sum.live + day.live,
          limited: sum.limited + day.limited,
          unavailable: sum.unavailable + day.unavailable,
          schemaChanges: sum.schemaChanges + day.schema_changes
        }), { samples: 0, live: 0, limited: 0, unavailable: 0, schemaChanges: 0 });
        if (totals.samples !== reliability.sample_count) errors.push('source_reliability sample_count mismatch');
        if (totals.schemaChanges !== reliability.schema_change_count) errors.push('source_reliability schema_change_count mismatch');
        const expectedLive = totals.samples ? Math.round(totals.live / totals.samples * 100) : 0;
        const expectedLimited = totals.samples ? Math.round(totals.limited / totals.samples * 100) : 0;
        const expectedUnavailable = totals.samples ? Math.round(totals.unavailable / totals.samples * 100) : 0;
        if (expectedLive !== reliability.live_percent || expectedLimited !== reliability.limited_percent || expectedUnavailable !== reliability.unavailable_percent) errors.push('source_reliability percentage mismatch');
      }
    }
  }

  const canary = provider?.schema_canary;
  if (!canary || typeof canary !== 'object') {
    errors.push('missing schema_canary');
  } else {
    if (!CANARY_STATES.has(canary.state)) errors.push('invalid schema_canary state');
    if (!CANARY_OBSERVATIONS.has(canary.observation)) errors.push('invalid schema_canary observation');
    if (typeof canary.fingerprint !== 'string') errors.push('invalid schema_canary fingerprint');
    if (canary.last_changed_at && !Number.isFinite(Date.parse(canary.last_changed_at))) errors.push('invalid schema_canary last_changed_at');
    if (canary.state === 'changed' && !Number.isFinite(Date.parse(canary.last_changed_at || ''))) errors.push('changed schema_canary requires last_changed_at');
    if (canary.state !== 'unobserved' && !canary.fingerprint) errors.push('observed schema_canary requires fingerprint');
  }
  return errors;
}
