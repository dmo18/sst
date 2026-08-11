import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCollectionIntelligence,
  collectWithBudgets,
  enrichProviderCollection,
  providerQualityScore
} from '../collection-intelligence.mjs';

function provider(overrides = {}) {
  return {
    id: 'alpha',
    name: 'Alpha',
    category: 'Cloud',
    service_state: 'operational',
    source_state: 'available',
    attention: 'informational',
    ok: true,
    source: 'https://status.alpha.test/api/v2/summary.json',
    evidence_tier: 'structured',
    source_confidence: 'high',
    checked_at: '2026-08-01T12:00:00Z',
    last_success_at: '2026-08-01T12:00:00Z',
    consecutive_failures: 0,
    schema_changed: false,
    schema_canary: { state: 'stable', observation: 'accepted', fingerprint: 'json-alpha', last_changed_at: '', quarantine_state: 'clear', quarantine_since: '', stable_observations: 4 },
    component_status: [],
    download_log: [{ url: 'https://status.alpha.test/api/v2/summary.json', ok: true, duration_ms: 120, status: 'HTTP 200', source_type: 'statuspage-json' }],
    ...overrides
  };
}

test('origin-aware collector preserves order and enforces global and per-origin budgets', async () => {
  const items = [
    { id: 'a1', url: 'https://one.test/a' },
    { id: 'a2', url: 'https://one.test/b' },
    { id: 'a3', url: 'https://one.test/c' },
    { id: 'b1', url: 'https://two.test/a' },
    { id: 'b2', url: 'https://two.test/b' }
  ];
  let globalActive = 0;
  let globalMax = 0;
  const activeByOrigin = new Map();
  const maxByOrigin = new Map();
  const results = await collectWithBudgets(
    items,
    item => ({ url: item.url }),
    async item => {
      const origin = new URL(item.url).origin;
      globalActive += 1;
      globalMax = Math.max(globalMax, globalActive);
      activeByOrigin.set(origin, Number(activeByOrigin.get(origin) || 0) + 1);
      maxByOrigin.set(origin, Math.max(Number(maxByOrigin.get(origin) || 0), Number(activeByOrigin.get(origin))));
      await new Promise(resolve => setTimeout(resolve, 8));
      activeByOrigin.set(origin, Number(activeByOrigin.get(origin)) - 1);
      globalActive -= 1;
      return item.id;
    },
    { globalLimit: 3, perOriginLimit: 1 }
  );
  assert.deepEqual(results, items.map(item => item.id));
  assert.ok(globalMax <= 3);
  assert.ok([...maxByOrigin.values()].every(value => value <= 1));
});

test('quality scoring keeps strong structured sources high and failed sources blind', () => {
  assert.ok(providerQualityScore(provider(), Date.parse('2026-08-01T12:05:00Z')) >= 90);
  const failed = provider({ source_state: 'unavailable', ok: false, evidence_tier: 'public-page', consecutive_failures: 3, last_success_at: '' });
  assert.ok(providerQualityScore(failed, Date.parse('2026-08-01T12:05:00Z')) < 20);
  assert.equal(enrichProviderCollection(failed, [], [], '2026-08-01T12:05:00Z').source_health, 'blind');
});

test('parser quarantine reduces source trust but preserves vendor service state and accepted observation', () => {
  const quarantined = provider({
    schema_changed: false,
    schema_canary: {
      state: 'stable',
      observation: 'accepted',
      fingerprint: 'json-alpha-next',
      last_changed_at: '2026-08-01T11:58:00Z',
      quarantine_state: 'quarantined',
      quarantine_since: '2026-08-01T11:55:00Z',
      stable_observations: 1
    }
  });
  const enriched = enrichProviderCollection(quarantined, [], [], '2026-08-01T12:05:00Z');
  assert.equal(enriched.service_state, 'operational');
  assert.equal(enriched.source_state, 'available');
  assert.equal(enriched.ok, true);
  assert.equal(enriched.source_health, 'watch');
  assert.ok(enriched.data_quality_score < providerQualityScore(provider(), Date.parse('2026-08-01T12:05:00Z')));
});

test('provider timing separates last request latency from total collection elapsed time', () => {
  const enriched = enrichProviderCollection(provider({
    download_log: [
      { url: 'https://status.alpha.test/a', ok: true, duration_ms: 120, status: 'HTTP 200', source_type: 'statuspage-json' },
      { url: 'https://status.alpha.test/b', ok: true, duration_ms: 80, status: 'HTTP 200', source_type: 'feed' }
    ]
  }), [], [], '2026-08-01T12:05:00Z');
  assert.equal(enriched.last_request_ms, 80);
  assert.equal(enriched.source_latency_ms, 80);
  assert.equal(enriched.collection_elapsed_ms, 200);
  assert.equal(enriched.collection_attempt_count, 2);
});

test('collection intelligence exposes run, request, origin, quality, and provider workload metrics', () => {
  const incidents = [{ providerId: 'alpha' }];
  const maintenance = [{ providerId: 'alpha' }];
  const result = buildCollectionIntelligence([provider()], incidents, maintenance, '2026-08-01T12:00:00Z', '2026-08-01T12:00:02Z');
  assert.equal(result.collection.duration_ms, 2000);
  assert.equal(result.collection.origin_count, 1);
  assert.equal(result.collection.request_success_percent, 100);
  assert.equal(result.providers[0].active_incident_count, 1);
  assert.equal(result.providers[0].maintenance_count, 1);
  assert.equal(result.providers[0].source_health, 'healthy');
  assert.equal(result.providers[0].last_request_ms, 120);
  assert.equal(result.providers[0].collection_elapsed_ms, 120);
  assert.equal(result.summary.blind_spot_count, 0);
});
