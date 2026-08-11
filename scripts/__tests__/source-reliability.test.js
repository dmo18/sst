import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSchemaCanary,
  rollSourceReliability,
  sourceIntelligenceMetadataErrors
} from '../source-reliability.mjs';

const provider = (source_state = 'available', ok = true, schema_fingerprint = 'json-current') => ({ source_state, ok, schema_fingerprint, service_state: 'operational' });
const day = offset => new Date(Date.UTC(2026, 6, 1 + offset, 12)).toISOString();

test('source reliability rolls into bounded seven and thirty-day daily buckets', () => {
  let reliability;
  for (let index = 0; index < 35; index += 1) {
    reliability = rollSourceReliability(reliability, provider(), day(index), index === 34);
  }
  assert.equal(reliability.window_days, 7);
  assert.equal(reliability.daily.length, 7);
  assert.equal(reliability.sample_count, 7);
  assert.equal(reliability.live_percent, 100);
  assert.equal(reliability.schema_change_count, 1);
  assert.equal(reliability.window_30d.window_days, 30);
  assert.equal(reliability.window_30d.daily.length, 30);
  assert.equal(reliability.window_30d.sample_count, 30);
  assert.equal(reliability.window_30d.schema_change_count, 1);
});

test('reliability SLO reports observation availability without changing service semantics', () => {
  let reliability;
  for (let index = 0; index < 20; index += 1) {
    const state = index === 19 ? provider('unavailable', false) : provider();
    reliability = rollSourceReliability(reliability, state, '2026-08-10T12:00:00.000Z');
  }
  assert.equal(reliability.sample_count, 20);
  assert.equal(reliability.live_percent, 95);
  assert.equal(reliability.unavailable_percent, 5);
  assert.equal(reliability.slo_state, 'watch');
  assert.equal(reliability.window_30d.live_percent, 95);
});

test('schema canary observes then quarantines repeated shape churn without changing service state', () => {
  const initial = buildSchemaCanary(undefined, provider(), false, '2026-08-10T12:00:00.000Z');
  assert.equal(initial.quarantine_state, 'clear');

  const changed = buildSchemaCanary({ schema_canary: initial }, provider('available', true, 'json-next'), true, '2026-08-10T12:12:00.000Z');
  assert.equal(changed.state, 'changed');
  assert.equal(changed.quarantine_state, 'observing');
  assert.equal(changed.quarantine_since, '2026-08-10T12:12:00.000Z');

  const churn = buildSchemaCanary({ schema_canary: changed }, provider('available', true, 'json-third'), true, '2026-08-10T12:24:00.000Z');
  assert.equal(churn.quarantine_state, 'quarantined');
  assert.equal(provider().service_state, 'operational');

  const stableOne = buildSchemaCanary({ schema_canary: churn }, provider('available', true, 'json-third'), false, '2026-08-10T12:36:00.000Z');
  assert.equal(stableOne.quarantine_state, 'quarantined');
  assert.equal(stableOne.stable_observations, 1);
  const stableTwo = buildSchemaCanary({ schema_canary: stableOne }, provider('available', true, 'json-third'), false, '2026-08-10T12:48:00.000Z');
  assert.equal(stableTwo.quarantine_state, 'clear');
});

test('schema canary retains change history across unavailable observations', () => {
  const changed = buildSchemaCanary(undefined, provider('available', true, 'json-next'), true, '2026-08-10T12:00:00.000Z');
  const unavailable = buildSchemaCanary({ schema_canary: changed }, provider('unavailable', false, ''), false, '2026-08-10T12:12:00.000Z');
  assert.equal(unavailable.state, 'unobserved');
  assert.equal(unavailable.observation, 'unavailable');
  assert.equal(unavailable.last_changed_at, changed.last_changed_at);
  assert.equal(unavailable.quarantine_state, 'observing');
});

test('source reliability metadata validation catches reconciliation and quarantine errors', () => {
  const reliability = rollSourceReliability(undefined, provider(), '2026-08-10T12:00:00.000Z');
  const schemaCanary = buildSchemaCanary(undefined, provider(), false, '2026-08-10T12:00:00.000Z');
  const valid = { source_reliability: reliability, schema_canary: schemaCanary };
  assert.deepEqual(sourceIntelligenceMetadataErrors(valid), []);
  const invalid = {
    source_reliability: { ...reliability, sample_count: 99, window_30d: { ...reliability.window_30d, sample_count: 88 } },
    schema_canary: { ...schemaCanary, state: 'changed', last_changed_at: '', quarantine_state: 'quarantined', quarantine_since: '' }
  };
  assert.ok(sourceIntelligenceMetadataErrors(invalid).some(error => error.includes('sample_count mismatch')));
  assert.ok(sourceIntelligenceMetadataErrors(invalid).some(error => error.includes('requires last_changed_at')));
  assert.ok(sourceIntelligenceMetadataErrors(invalid).some(error => error.includes('requires quarantine_since')));
});
