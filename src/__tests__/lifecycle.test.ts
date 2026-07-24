import test from 'node:test';
import assert from 'node:assert/strict';
import { dataLifecycleReducer, initialDataLifecycle } from '../dataLifecycle.ts';
import type { StatusPayload } from '../types.ts';
const data = { schema_version: 2, generated_at: '2026-01-01T00:00:00Z', summary: { service_overall: 'unknown', source_overall: 'unavailable', active_incident_count: 0, affected_provider_count: 0, confirmed_operational_count: 0, degraded_count: 0, major_count: 0, unknown_count: 0, limited_count: 0, unavailable_count: 0, disabled_count: 0, pending_count: 0, stale_count: 0, provider_total: 0, enabled_provider_count: 0, coverage_percent: 0, confirmed_operational_percent: 0 }, providers: [], incidents: [], changes: [], history: [] } as StatusPayload;
test('loading, ready and refreshing transitions', () => { const ready = dataLifecycleReducer(initialDataLifecycle, { type: 'success', data }); assert.equal(ready.phase, 'ready'); assert.equal(dataLifecycleReducer(ready, { type: 'request' }).phase, 'refreshing'); });
test('refresh failure retains stale payload and recovery works', () => { const ready = dataLifecycleReducer(initialDataLifecycle, { type: 'success', data }); const stale = dataLifecycleReducer(ready, { type: 'failure', message: 'offline' }); assert.equal(stale.phase, 'stale'); assert.equal(stale.data, data); assert.equal(dataLifecycleReducer(stale, { type: 'success', data }).phase, 'ready'); });
test('first failure has no false data', () => assert.equal(dataLifecycleReducer(initialDataLifecycle, { type: 'failure', message: 'offline' }).phase, 'error'));
