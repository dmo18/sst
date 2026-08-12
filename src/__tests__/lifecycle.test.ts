import test from 'node:test';
import assert from 'node:assert/strict';
import { dataLifecycleReducer, initialDataLifecycle } from '../dataLifecycle.ts';
import type { StatusPayload } from '../types.ts';

const data = {
  schema_version: 2,
  generated_at: '2026-01-01T00:00:00Z',
  summary: {
    service_overall: 'unknown',
    source_overall: 'unavailable',
    active_incident_count: 0,
    affected_provider_count: 0,
    confirmed_operational_count: 0,
    degraded_count: 0,
    major_count: 0,
    unknown_count: 0,
    limited_count: 0,
    unavailable_count: 0,
    disabled_count: 0,
    pending_count: 0,
    stale_count: 0,
    provider_total: 0,
    enabled_provider_count: 0,
    coverage_percent: 0,
    live_source_coverage_percent: 0,
    valid_status_count: 0,
    invalid_status_count: 0,
    valid_status_percent: 0,
    confirmed_operational_percent: 0
  },
  providers: [],
  incidents: [],
  changes: [],
  history: []
} as StatusPayload;

const overlayData = { ...data, live_truth: {
  checked_at: '2026-01-01T00:00:10Z',
  attempted_provider_count: 1,
  success_provider_count: 1,
  failure_provider_count: 0,
  active_provider_ids: [],
  successful_provider_ids: ['example'],
  failed_provider_ids: []
} } as StatusPayload;

test('loading, ready and refreshing transitions', () => {
  const ready = dataLifecycleReducer(initialDataLifecycle, { type: 'success', data });
  assert.equal(ready.phase, 'ready');
  assert.equal(dataLifecycleReducer(ready, { type: 'request' }).phase, 'refreshing');
});

test('refresh failure retains stale payload and recovery works', () => {
  const ready = dataLifecycleReducer(initialDataLifecycle, { type: 'success', data });
  const stale = dataLifecycleReducer(ready, { type: 'failure', message: 'offline' });
  assert.equal(stale.phase, 'stale');
  assert.equal(stale.data, data);
  assert.equal(dataLifecycleReducer(stale, { type: 'success', data }).phase, 'ready');
});

test('live truth overlay replaces data without hiding a static freshness failure', () => {
  const ready = dataLifecycleReducer(initialDataLifecycle, { type: 'success', data });
  const stale = dataLifecycleReducer(ready, { type: 'failure', message: 'payload stale' });
  const overlaid = dataLifecycleReducer(stale, { type: 'overlay', data: overlayData });
  assert.equal(overlaid.phase, 'stale');
  assert.equal(overlaid.data, overlayData);
  assert.equal(overlaid.failure, 'payload stale');
});

test('live truth overlay cannot create data before the audited payload exists', () => {
  assert.equal(dataLifecycleReducer(initialDataLifecycle, { type: 'overlay', data: overlayData }), initialDataLifecycle);
});

test('first failure has no false data', () => {
  assert.equal(dataLifecycleReducer(initialDataLifecycle, { type: 'failure', message: 'offline' }).phase, 'error');
});
