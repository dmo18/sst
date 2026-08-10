import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSchemaCanary,
  rollSourceReliability,
  sourceIntelligenceMetadataErrors
} from '../source-reliability.mjs';

const provider = (source_state = 'available', ok = true) => ({ source_state, ok, schema_fingerprint: 'json-current' });

test('source reliability rolls into bounded seven-day daily buckets', () => {
  let reliability;
  for (let index = 0; index < 9; index += 1) {
    reliability = rollSourceReliability(reliability, provider(), `2026-08-0${index + 1}T12:00:00.000Z`, index === 8);
  }
  assert.equal(reliability.window_days, 7);
  assert.equal(reliability.daily.length, 7);
  assert.equal(reliability.daily[0].date, '2026-08-03');
  assert.equal(reliability.daily.at(-1).date, '2026-08-09');
  assert.equal(reliability.sample_count, 7);
  assert.equal(reliability.live_percent, 100);
  assert.equal(reliability.schema_change_count, 1);
  assert.equal(reliability.slo_state, 'warming');
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
});

test('schema canary records shape changes separately from collection acceptance', () => {
  const old = { schema_canary: { last_changed_at: '2026-08-01T00:00:00.000Z' } };
  const changed = buildSchemaCanary(old, provider(), true, '2026-08-10T12:00:00.000Z');
  assert.deepEqual(changed, {
    state: 'changed',
    observation: 'accepted',
    fingerprint: 'json-current',
    last_changed_at: '2026-08-10T12:00:00.000Z'
  });
  const unavailable = buildSchemaCanary({ schema_canary: changed }, { source_state: 'unavailable', ok: false, schema_fingerprint: '' }, false, '2026-08-10T12:12:00.000Z');
  assert.equal(unavailable.state, 'unobserved');
  assert.equal(unavailable.observation, 'unavailable');
  assert.equal(unavailable.last_changed_at, changed.last_changed_at);
});

test('source reliability metadata validation catches reconciliation errors', () => {
  const reliability = rollSourceReliability(undefined, provider(), '2026-08-10T12:00:00.000Z');
  const schemaCanary = buildSchemaCanary(undefined, provider(), false, '2026-08-10T12:00:00.000Z');
  const valid = { source_reliability: reliability, schema_canary: schemaCanary };
  assert.deepEqual(sourceIntelligenceMetadataErrors(valid), []);
  const invalid = { source_reliability: { ...reliability, sample_count: 99 }, schema_canary: { ...schemaCanary, state: 'changed', last_changed_at: '' } };
  assert.ok(sourceIntelligenceMetadataErrors(invalid).some(error => error.includes('sample_count mismatch')));
  assert.ok(sourceIntelligenceMetadataErrors(invalid).some(error => error.includes('requires last_changed_at')));
});
