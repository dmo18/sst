import test from 'node:test';
import assert from 'node:assert/strict';
import { isStatusPayload, payloadValidationErrors } from '../payloadValidation.ts';
const p: any = { schema_version: 2, generated_at: '2026-01-01T00:00:00Z', summary: { service_overall: 'operational', source_overall: 'available', active_incident_count: 0, affected_provider_count: 0, confirmed_operational_count: 1, degraded_count: 0, major_count: 0, unknown_count: 0, limited_count: 0, unavailable_count: 0, disabled_count: 0, pending_count: 0, stale_count: 0, provider_total: 1, enabled_provider_count: 1, coverage_percent: 100, live_source_coverage_percent: 100, valid_status_count: 1, invalid_status_count: 0, valid_status_percent: 100, confirmed_operational_percent: 100 }, providers: [{ id: 'a', name: 'A', category: 'C', status: 'ok', color: 'green', service_state: 'operational', source_state: 'available', attention: 'informational', ok: true, source: 'https://a.test', priority: 1, status_data_valid: true }], incidents: [], changes: [], history: [] };
test('complete payload validates', () => assert.equal(isStatusPayload(p), true));
test('duplicate provider, bad URL and summary mismatch reject', () => { const x = structuredClone(p); x.providers.push({ ...x.providers[0], source: 'javascript:x' }); assert.ok(payloadValidationErrors(x).length >= 3); });
test('valid limited source remains valid data but does not count as live coverage', () => { const x = structuredClone(p); x.providers[0].service_state = 'unknown'; x.providers[0].source_state = 'limited'; x.providers[0].ok = false; x.summary.service_overall = 'unknown'; x.summary.source_overall = 'limited'; x.summary.confirmed_operational_count = 0; x.summary.unknown_count = 1; x.summary.limited_count = 1; x.summary.coverage_percent = 0; x.summary.live_source_coverage_percent = 0; x.summary.confirmed_operational_percent = 0; assert.equal(isStatusPayload(x), true); assert.equal(x.summary.valid_status_percent, 100); });
test('legacy record-validity coverage is rejected for a limited source', () => { const x = structuredClone(p); x.providers[0].service_state = 'unknown'; x.providers[0].source_state = 'limited'; x.providers[0].ok = false; x.summary.service_overall = 'unknown'; x.summary.source_overall = 'limited'; x.summary.confirmed_operational_count = 0; x.summary.unknown_count = 1; x.summary.limited_count = 1; x.summary.live_source_coverage_percent = 0; x.summary.confirmed_operational_percent = 0; assert.deepEqual(payloadValidationErrors(x), ['coverage counts do not reconcile']); });
test('materially future generated_at is rejected', () => { const x = structuredClone(p); x.generated_at = new Date(Date.now() + 3600000).toISOString(); assert.deepEqual(payloadValidationErrors(x), ['generated_at is materially in the future']); });

test('component-only degradation and neutral component states reconcile without an incident record', () => {
  const x = structuredClone(p);
  x.providers[0].service_state = 'degraded';
  x.providers[0].color = 'amber';
  x.providers[0].attention = 'action';
  x.providers[0].component_status = [
    { name: 'Region not applicable', status: 'Not available' },
    { name: 'Maintenance window', status: 'under_maintenance' },
    { name: 'API', status: 'degraded_performance' }
  ];
  x.summary.service_overall = 'degraded';
  x.summary.affected_provider_count = 1;
  x.summary.confirmed_operational_count = 0;
  x.summary.degraded_count = 1;
  x.summary.confirmed_operational_percent = 0;
  x.summary.component_issue_count = 1;
  assert.deepEqual(payloadValidationErrors(x), []);
});
