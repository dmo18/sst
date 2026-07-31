import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStatusPayload, providerHasValidStatusData } from '../ensure-valid-status.mjs';
import { summarizeProviders } from '../update-status.mjs';

const generatedAt = '2026-01-01T00:00:00.000Z';

function provider(sourceState = 'unavailable') {
  return {
    id: 'vendor',
    name: 'Vendor',
    category: 'Cloud',
    status: sourceState === 'available' ? 'All Systems Operational' : 'Source unavailable: HTTP 403',
    color: sourceState === 'available' ? 'green' : 'blue',
    service_state: sourceState === 'available' ? 'operational' : 'unknown',
    source_state: sourceState,
    attention: sourceState === 'available' ? 'informational' : 'watch',
    message: sourceState === 'available' ? '' : 'Official endpoint rejected the request.',
    ok: sourceState === 'available',
    source: 'https://status.vendor.test/',
    priority: 50,
    source_type: 'statuspage',
    download_log: []
  };
}

function payload(sourceState = 'unavailable') {
  const providers = [provider(sourceState)];
  const incidents = [];
  return {
    schema_version: 2,
    generated_at: generatedAt,
    summary: summarizeProviders(providers, incidents),
    providers,
    incidents,
    changes: [],
    history: []
  };
}

test('unreadable sources become explicit valid limited records without counting as live coverage', () => {
  const previous = payload('unavailable');
  const normalized = normalizeStatusPayload(payload('unavailable'), previous, generatedAt);
  const item = normalized.providers[0];

  assert.equal(item.source_state, 'limited');
  assert.equal(item.service_state, 'unknown');
  assert.equal(item.ok, false);
  assert.equal(item.status_data_valid, true);
  assert.equal(item.status_data_basis, 'limited-fallback');
  assert.match(item.message, /not live coverage/);
  assert.equal(providerHasValidStatusData(item), true);
  assert.equal(normalized.summary.unavailable_count, 0);
  assert.equal(normalized.summary.limited_count, 1);
  assert.equal(normalized.summary.invalid_status_count, 0);
  assert.equal(normalized.summary.valid_status_count, 1);
  assert.equal(normalized.summary.valid_status_percent, 100);
  assert.equal(normalized.summary.live_source_count, 0);
  assert.equal(normalized.summary.live_source_coverage_percent, 0);
  assert.equal(normalized.summary.coverage_percent, 0);
  assert.equal(normalized.summary.fallback_source_count, 1);
  assert.equal(normalized.changes[0].type, 'source_limited');
});

test('available official data remains available, valid, and covered', () => {
  const normalized = normalizeStatusPayload(payload('available'), null, generatedAt);
  const item = normalized.providers[0];

  assert.equal(item.source_state, 'available');
  assert.equal(item.service_state, 'operational');
  assert.equal(item.status_data_basis, 'live-official');
  assert.equal(normalized.summary.invalid_status_count, 0);
  assert.equal(normalized.summary.live_source_count, 1);
  assert.equal(normalized.summary.live_source_coverage_percent, 100);
  assert.equal(normalized.summary.coverage_percent, 100);
  assert.equal(normalized.summary.fallback_source_count, 0);
});

test('disabled catalog sources fail the all-sources-valid requirement', () => {
  assert.throws(
    () => normalizeStatusPayload(payload('disabled'), null, generatedAt),
    /disabled and cannot satisfy/
  );
});
