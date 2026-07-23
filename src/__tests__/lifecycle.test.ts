import test from 'node:test';
import assert from 'node:assert/strict';
import { dataLifecycleReducer, initialDataLifecycle } from '../dataLifecycle.ts';
import type { StatusPayload } from '../types.ts';
const payload = { schema_version: 1, generated_at: '2026-01-01T00:00:00Z', summary: { overall: 'green', active_incident_count: 0, providers_ok: 0, providers_total: 0 }, providers: [], incidents: [], history: [] } satisfies StatusPayload;
test('lifecycle loads, refreshes, retains stale data, and recovers', () => { assert.equal(initialDataLifecycle.phase,'loading'); const ready=dataLifecycleReducer(initialDataLifecycle,{type:'success',data:payload}); assert.equal(ready.phase,'ready'); assert.equal(dataLifecycleReducer(ready,{type:'request'}).phase,'refreshing'); const stale=dataLifecycleReducer(ready,{type:'failure',message:'offline'}); assert.equal(stale.phase,'stale'); assert.equal(stale.data,payload); assert.equal(dataLifecycleReducer(stale,{type:'success',data:payload}).phase,'ready'); });
test('first-load failure has no synthetic data',()=>assert.deepEqual(dataLifecycleReducer(initialDataLifecycle,{type:'failure',message:'bad'}),{phase:'error',data:null,failure:'bad'}));
