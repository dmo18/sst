import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyReleaseContract } from '../release-contract.mjs';

const catalogHash = 'fnv1a32:12345678';
function payload(overrides = {}) {
  const generatedAt = '2026-08-10T21:00:00.000Z';
  const providers = [{
    id: 'alpha',
    name: 'Alpha',
    source_state: 'available',
    source_health: 'healthy',
    ok: true,
    status_data_valid: true,
    status_data_basis: 'live-official',
    data_quality_score: 90,
    collection_attempt_count: 1,
    collection_success_count: 1,
    collection_failure_count: 0
  }];
  return {
    schema_version: 3,
    contract_version: 3,
    catalog_hash: catalogHash,
    generated_at: generatedAt,
    providers,
    summary: {
      provider_total: 1,
      valid_status_count: 1,
      invalid_status_count: 0,
      valid_status_percent: 100,
      coverage_percent: 100,
      live_source_coverage_percent: 100,
      live_source_count: 1,
      fallback_source_count: 0
    },
    collection: {
      pipeline_version: '3.0.0',
      provider_count: 1,
      healthy_source_count: 1,
      watch_source_count: 0,
      blind_spot_count: 0,
      request_count: 1,
      successful_request_count: 1,
      failed_request_count: 0,
      quality_score: 90,
      origin_count: 1,
      duration_ms: 120,
      p95_request_ms: 120
    },
    ...overrides
  };
}

test('release contract returns deployment description and success state', () => {
  const result = verifyReleaseContract(payload(), Date.parse('2026-08-10T21:01:00.000Z'), catalogHash);
  assert.equal(result.state, 'success');
  assert.equal(result.description, '1/1 live (100%); quality 90; 0 blind');
});

test('release contract rejects catalog identity mismatch', () => {
  assert.throws(
    () => verifyReleaseContract(payload(), Date.parse('2026-08-10T21:01:00.000Z'), 'fnv1a32:deadbeef'),
    /provider catalog hash mismatch/
  );
});

test('release contract rejects inconsistent request reconciliation', () => {
  const value = payload();
  value.collection.request_count = 2;
  assert.throws(
    () => verifyReleaseContract(value, Date.parse('2026-08-10T21:01:00.000Z'), catalogHash),
    /collection request counts do not reconcile/
  );
});
