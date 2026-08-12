import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssueConsoleModel } from '../statusViewModel.ts';
import type { ProviderStatus, StatusPayload } from '../types.ts';

const backblaze: ProviderStatus = {
  id: 'backblaze',
  name: 'Backblaze',
  category: 'Backup & Storage',
  status: 'All systems operational. Nothing to report.',
  color: 'green',
  service_state: 'operational',
  source_state: 'available',
  source_health: 'healthy',
  truth_basis: 'confirmed-operational',
  attention: 'informational',
  ok: true,
  source: 'https://status.backblaze.com/data/payload.json',
  priority: 70,
  criticality: 'medium',
  evidence_tier: 'structured',
  source_confidence: 'high',
  data_quality_score: 96,
  freshness_state: 'fresh',
  active_incident_count: 0,
  maintenance_count: 1,
  problem_component_count: 0,
  component_status: []
};

const payload: StatusPayload = {
  schema_version: 2,
  generated_at: '2026-08-12T19:00:00Z',
  summary: {
    service_overall: 'operational',
    source_overall: 'available',
    active_incident_count: 0,
    affected_provider_count: 0,
    confirmed_operational_count: 1,
    degraded_count: 0,
    major_count: 0,
    unknown_count: 0,
    limited_count: 0,
    unavailable_count: 0,
    disabled_count: 0,
    pending_count: 0,
    stale_count: 0,
    provider_total: 1,
    enabled_provider_count: 1,
    coverage_percent: 100,
    live_source_coverage_percent: 100,
    valid_status_count: 1,
    invalid_status_count: 0,
    valid_status_percent: 100,
    confirmed_operational_percent: 100
  },
  providers: [backblaze],
  incidents: [],
  maintenance: [{
    id: 'backblaze:maintenance-1',
    providerId: 'backblaze',
    provider: 'Backblaze',
    category: 'Backup & Storage',
    title: 'US East Core Services Maintenance',
    note: 'Routine scheduled maintenance.',
    source: 'Backblaze official FireHydrant payload',
    url: 'https://status.backblaze.com/',
    status: 'in_progress',
    starts_at: '2026-08-12T18:30:00Z',
    ends_at: '2026-08-12T20:30:00Z',
    latest_update: '2026-08-12T18:00:00Z',
    affected_service: 'US East Region',
    priority: 70,
    attention: 'informational'
  }],
  changes: [],
  history: []
};

test('in-progress maintenance remains context and never enters the operator action queue', () => {
  const model = buildIssueConsoleModel(payload, 'v3');

  assert.equal(model.incidentCount, 0);
  assert.equal(model.affectedCount, 0);
  assert.equal(model.maintenance.length, 1);
  assert.equal(model.ongoingMaintenanceCount, 1);
  assert.equal(model.diagnostics[0].maintenanceCount, 1);
  assert.equal(model.actionQueue.some(item => item.kind === 'maintenance'), false);
  assert.equal(model.actionQueue.length, 0);
});
