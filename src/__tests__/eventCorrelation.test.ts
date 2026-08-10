import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEventCorrelations } from '../eventCorrelation.ts';
import type { Incident } from '../types.ts';

function incident(id: string, providerId: string, category: string, at: string, evidence_basis?: 'current-page'): Incident {
  return {
    id,
    providerId,
    provider: providerId.toUpperCase(),
    category,
    title: `${providerId} incident`,
    note: 'Active service impact',
    source: 'vendor',
    url: `https://${providerId}.test/incidents/${id}`,
    time: at,
    rawTime: evidence_basis ? undefined : at,
    observed_at: evidence_basis ? at : undefined,
    evidence_basis,
    color: 'amber',
    service_state: 'degraded',
    attention: 'action',
    priority: 50
  };
}

test('two vendor-timed incidents in the same category form a medium-confidence cluster', () => {
  const clusters = buildEventCorrelations([
    incident('a1', 'a', 'Identity', '2026-08-10T12:00:00.000Z'),
    incident('b1', 'b', 'Identity', '2026-08-10T12:12:00.000Z')
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].confidence, 'medium');
  assert.deepEqual(clusters[0].providerIds, ['a', 'b']);
  assert.match(clusters[0].rationale, /no causal relationship is inferred/);
});

test('two cross-category incidents do not form a cluster', () => {
  const clusters = buildEventCorrelations([
    incident('a1', 'a', 'Identity', '2026-08-10T12:00:00.000Z'),
    incident('b1', 'b', 'Cloud', '2026-08-10T12:05:00.000Z')
  ]);
  assert.deepEqual(clusters, []);
});

test('three vendor-timed incidents across categories form a low-confidence cluster', () => {
  const clusters = buildEventCorrelations([
    incident('a1', 'a', 'Identity', '2026-08-10T12:00:00.000Z'),
    incident('b1', 'b', 'Cloud', '2026-08-10T12:05:00.000Z'),
    incident('c1', 'c', 'Connectivity', '2026-08-10T12:18:00.000Z')
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].confidence, 'low');
  assert.equal(clusters[0].categories.length, 3);
});

test('current-page observations are never treated as event start times for correlation', () => {
  const clusters = buildEventCorrelations([
    incident('a1', 'a', 'Identity', '2026-08-10T12:00:00.000Z'),
    incident('b1', 'b', 'Identity', '2026-08-10T12:05:00.000Z', 'current-page'),
    incident('c1', 'c', 'Cloud', '2026-08-10T12:10:00.000Z', 'current-page')
  ]);
  assert.deepEqual(clusters, []);
});

test('incidents outside the twenty-minute window remain separate', () => {
  const clusters = buildEventCorrelations([
    incident('a1', 'a', 'Identity', '2026-08-10T12:00:00.000Z'),
    incident('b1', 'b', 'Identity', '2026-08-10T12:25:00.000Z')
  ]);
  assert.deepEqual(clusters, []);
});
