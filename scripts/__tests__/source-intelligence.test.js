import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichProviderHistory,
  maintenanceIsRelevant,
  schemaFingerprint,
  sourceEvidence,
  sourceIntelligenceChanges
} from '../source-intelligence.mjs';

test('schema fingerprints track shape rather than JSON key order or values', () => {
  const first = schemaFingerprint(JSON.stringify({ status: { indicator: 'none' }, incidents: [{ id: 'a', name: 'One' }] }), 'statuspage-json');
  const reordered = schemaFingerprint(JSON.stringify({ incidents: [{ name: 'Two', id: 'b' }], status: { indicator: 'major' } }), 'statuspage-json');
  const changed = schemaFingerprint(JSON.stringify({ status: { indicator: 'none' }, incidents: [{ id: 'a', name: 'One', impact: 'minor' }] }), 'statuspage-json');
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test('source evidence separates transport quality from service health', () => {
  assert.deepEqual(sourceEvidence('statuspage-json', 'available', true), {
    evidence_tier: 'structured', source_confidence: 'high', parser_version: '2.5.0'
  });
  assert.equal(sourceEvidence('feed', 'available', true).source_confidence, 'medium');
  assert.equal(sourceEvidence('status-html', 'limited', false).source_confidence, 'none');
});

test('provider history retains last success and escalates consecutive source failures', () => {
  const previous = {
    generated_at: '2026-07-31T16:00:00Z',
    providers: [{
      id: 'a', name: 'A', status: 'Operational', service_state: 'operational', source_state: 'available',
      attention: 'informational', source_type: 'statuspage-json', priority: 90, criticality: 'high',
      last_success_at: '2026-07-31T16:00:00Z', consecutive_failures: 1, last_semantic_change_at: '2026-07-31T15:00:00Z',
      schema_fingerprint: 'json-a', component_status: []
    }],
    incidents: []
  };
  const result = enrichProviderHistory([{
    id: 'a', name: 'A', status: 'Source unavailable', service_state: 'unknown', source_state: 'unavailable',
    attention: 'watch', source_type: 'statuspage-json', priority: 90, criticality: 'high', ok: false,
    schema_fingerprint: '', component_status: []
  }], previous, [], '2026-07-31T17:00:00Z')[0];
  assert.equal(result.consecutive_failures, 2);
  assert.equal(result.last_success_at, '2026-07-31T16:00:00Z');
  assert.equal(result.attention, 'action');
  assert.equal(result.source_confidence, 'none');
});

test('maintenance relevance excludes completed and distant events', () => {
  const now = Date.parse('2026-07-31T17:00:00Z');
  assert.equal(maintenanceIsRelevant({ status: 'scheduled', starts_at: '2026-08-02T17:00:00Z' }, now), true);
  assert.equal(maintenanceIsRelevant({ status: 'completed', starts_at: '2026-07-31T12:00:00Z' }, now), false);
  assert.equal(maintenanceIsRelevant({ status: 'scheduled', starts_at: '2027-01-01T00:00:00Z' }, now), false);
});

test('intelligence changes emit schema, failure streak, and maintenance lifecycle events', () => {
  const previous = {
    providers: [{ id: 'a', name: 'A', consecutive_failures: 1 }],
    maintenance: [{ id: 'a:db', providerId: 'a', provider: 'A', title: 'DB work', status: 'scheduled' }]
  };
  const current = {
    providers: [{ id: 'a', name: 'A', schema_changed: true, consecutive_failures: 2, attention: 'action' }],
    maintenance: [
      { id: 'a:db', providerId: 'a', provider: 'A', title: 'DB work', status: 'in_progress' },
      { id: 'a:api', providerId: 'a', provider: 'A', title: 'API work', status: 'scheduled' }
    ]
  };
  const types = sourceIntelligenceChanges(previous, current, '2026-07-31T17:00:00Z').map(change => change.type);
  assert.deepEqual(types, ['source_schema_changed', 'source_failure_streak', 'maintenance_started', 'maintenance_new']);
});
