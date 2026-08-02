import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssueConsoleModel, filterDiagnostics } from '../statusViewModel.ts';
import type { ProviderStatus, StatusPayload } from '../types.ts';

function provider(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
  return {
    id: 'alpha',
    name: 'Alpha',
    category: 'Identity',
    status: 'All systems operational',
    color: 'green',
    service_state: 'operational',
    source_state: 'available',
    source_health: 'healthy',
    truth_basis: 'confirmed-operational',
    attention: 'informational',
    ok: true,
    source: 'https://status.alpha.test',
    source_host: 'status.alpha.test',
    priority: 90,
    criticality: 'high',
    evidence_tier: 'structured',
    source_confidence: 'high',
    data_quality_score: 96,
    freshness_state: 'fresh',
    source_latency_ms: 120,
    collection_attempt_count: 1,
    collection_success_count: 1,
    collection_failure_count: 0,
    active_incident_count: 0,
    maintenance_count: 0,
    problem_component_count: 0,
    component_status: [],
    ...overrides
  };
}

function payload(providers: ProviderStatus[]): StatusPayload {
  return {
    schema_version: 2,
    generated_at: '2026-08-01T12:00:00Z',
    collection: {
      pipeline_version: '3.0.0', run_id: 'run-1', started_at: '2026-08-01T11:59:58Z', completed_at: '2026-08-01T12:00:00Z', duration_ms: 2000,
      provider_count: providers.length, origin_count: providers.length, unique_source_count: providers.length, shared_source_count: 0,
      request_count: providers.length, successful_request_count: providers.filter(item => item.collection_success_count).length, failed_request_count: providers.filter(item => item.collection_failure_count).length,
      request_success_percent: 100, median_request_ms: 120, p95_request_ms: 140, quality_score: Math.round(providers.reduce((sum, item) => sum + Number(item.data_quality_score || 0), 0) / providers.length),
      healthy_source_count: providers.filter(item => item.source_health === 'healthy').length, watch_source_count: providers.filter(item => item.source_health === 'watch').length, blind_spot_count: providers.filter(item => item.source_health === 'blind').length
    },
    summary: {
      service_overall: 'unknown', source_overall: 'limited', active_incident_count: 0, affected_provider_count: 0,
      confirmed_operational_count: providers.filter(item => item.service_state === 'operational').length, degraded_count: 0, major_count: 0, unknown_count: providers.filter(item => item.service_state === 'unknown').length,
      limited_count: providers.filter(item => item.source_state === 'limited').length, unavailable_count: providers.filter(item => item.source_state === 'unavailable').length, disabled_count: 0, pending_count: 0, stale_count: 0,
      provider_total: providers.length, enabled_provider_count: providers.length, coverage_percent: 50, live_source_coverage_percent: 50, valid_status_count: providers.length, invalid_status_count: 0, valid_status_percent: 100, confirmed_operational_percent: 50
    },
    providers,
    incidents: [],
    maintenance: [],
    changes: [],
    history: []
  };
}

test('command center model separates service state from source health and prioritizes critical blind spots', () => {
  const blind = provider({ id: 'blind', name: 'Blind', service_state: 'unknown', source_state: 'unavailable', source_health: 'blind', truth_basis: 'no-current-observation', attention: 'action', ok: false, color: 'blue', data_quality_score: 4, collection_success_count: 0, collection_failure_count: 1, consecutive_failures: 3 });
  const model = buildIssueConsoleModel(payload([provider(), blind]), 'v3');
  assert.equal(model.blindSpotCount, 1);
  assert.equal(model.healthySourceCount, 1);
  assert.equal(model.actionQueue[0].providerId, 'blind');
  assert.equal(filterDiagnostics(model.diagnostics, '', ['blind-source']).length, 1);
});

test('category pulse reconciles operational, affected, unknown, blind, and quality metrics', () => {
  const model = buildIssueConsoleModel(payload([
    provider(),
    provider({ id: 'beta', name: 'Beta', service_state: 'unknown', source_state: 'limited', source_health: 'watch', truth_basis: 'limited-official', ok: false, color: 'blue', data_quality_score: 30 })
  ]), 'v3');
  assert.equal(model.categoryPulse[0].total, 2);
  assert.equal(model.categoryPulse[0].operational, 1);
  assert.equal(model.categoryPulse[0].unknown, 1);
  assert.equal(model.categoryPulse[0].averageQuality, 63);
});
