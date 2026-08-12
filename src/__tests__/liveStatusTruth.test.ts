import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeBrowserLiveTruth, parseBrowserStatuspage } from '../liveStatusTruth.ts';
import type { ProviderStatus, StatusPayload } from '../types.ts';

function provider(overrides: Partial<ProviderStatus> = {}): ProviderStatus {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'AI',
    status: 'All Systems Operational',
    color: 'green',
    service_state: 'operational',
    source_state: 'available',
    source_health: 'healthy',
    truth_basis: 'confirmed-operational',
    attention: 'informational',
    ok: true,
    source: 'https://status.claude.com/api/v2/summary.json',
    priority: 62,
    source_type: 'statuspage-json',
    active_incident_count: 0,
    problem_component_count: 0,
    component_status: [],
    ...overrides
  };
}

function payload(providerStatus: ProviderStatus, incidents: StatusPayload['incidents'] = []): StatusPayload {
  return {
    schema_version: 3,
    generated_at: '2026-08-12T13:49:53.565Z',
    providers: [providerStatus],
    incidents,
    maintenance: [],
    changes: [],
    history: [],
    summary: {
      service_overall: providerStatus.service_state,
      source_overall: 'available',
      active_incident_count: incidents.length,
      affected_provider_count: providerStatus.service_state === 'operational' ? 0 : 1,
      confirmed_operational_count: providerStatus.service_state === 'operational' ? 1 : 0,
      degraded_count: providerStatus.service_state === 'degraded' ? 1 : 0,
      major_count: providerStatus.service_state === 'major' ? 1 : 0,
      unknown_count: providerStatus.service_state === 'unknown' ? 1 : 0,
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
      confirmed_operational_percent: providerStatus.service_state === 'operational' ? 100 : 0
    }
  };
}

const liveClaudeIncident = {
  page: { name: 'Claude', url: 'https://status.claude.com' },
  status: { indicator: 'minor', description: 'Partially Degraded Service' },
  components: [
    { id: '1', name: 'claude.ai', status: 'degraded_performance', group: false },
    { id: '2', name: 'Claude API (api.anthropic.com)', status: 'degraded_performance', group: false },
    { id: '3', name: 'Claude Code', status: 'degraded_performance', group: false }
  ],
  incidents: [{
    id: 'rk6gkg2gwfny',
    name: 'Degraded performance for multiple models',
    status: 'investigating',
    impact: 'minor',
    created_at: '2026-08-12T13:50:28.458Z',
    started_at: '2026-08-12T13:50:28.458Z',
    updated_at: '2026-08-12T14:00:00.000Z',
    shortlink: 'https://stspg.io/example',
    incident_updates: [{
      status: 'investigating',
      body: 'We are investigating elevated errors on requests to multiple models.',
      created_at: '2026-08-12T13:50:28.458Z',
      affected_components: [
        { name: 'claude.ai', new_status: 'degraded_performance' },
        { name: 'Claude API (api.anthropic.com)', new_status: 'degraded_performance' },
        { name: 'Claude Code', new_status: 'degraded_performance' }
      ]
    }]
  }]
};

test('browser live truth promotes a fresh static clear state when Claude opens an incident seconds later', () => {
  const staticPayload = payload(provider());
  const observation = parseBrowserStatuspage(staticPayload.providers[0], liveClaudeIncident, '2026-08-12T14:01:00.000Z');
  const merged = mergeBrowserLiveTruth(staticPayload, [observation], [], '2026-08-12T14:01:00.000Z');

  assert.equal(merged.incidents.length, 1);
  assert.equal(merged.incidents[0].id, 'anthropic:rk6gkg2gwfny');
  assert.equal(merged.incidents[0].title, 'Degraded performance for multiple models');
  assert.equal(merged.providers[0].service_state, 'degraded');
  assert.equal(merged.providers[0].active_incident_count, 1);
  assert.equal(merged.providers[0].problem_component_count, 3);
  assert.equal(merged.providers[0].status_data_basis, 'live-official');
  assert.equal(merged.summary.active_incident_count, 1);
  assert.equal(merged.summary.affected_provider_count, 1);
  assert.deepEqual(merged.live_truth?.active_provider_ids, ['anthropic']);
});

test('browser live truth removes a stale resolved incident only after a successful official summary says clear', () => {
  const staleProvider = provider({
    status: 'Incident active',
    color: 'yellow',
    service_state: 'degraded',
    truth_basis: 'vendor-incident',
    attention: 'action',
    ok: false,
    active_incident_count: 1,
    problem_component_count: 2
  });
  const staticPayload = payload(staleProvider, [{
    id: 'anthropic:old',
    providerId: 'anthropic',
    provider: 'Anthropic',
    category: 'AI',
    title: 'Old incident',
    note: 'Old incident',
    source: staleProvider.source,
    url: 'https://status.claude.com/',
    time: '2026-08-12T13:00:00.000Z',
    color: 'yellow',
    service_state: 'degraded',
    attention: 'action',
    priority: 62
  }]);
  const clearSummary = {
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [{ id: '1', name: 'claude.ai', status: 'operational', group: false }],
    incidents: []
  };
  const observation = parseBrowserStatuspage(staleProvider, clearSummary, '2026-08-12T15:00:00.000Z');
  const merged = mergeBrowserLiveTruth(staticPayload, [observation], [], '2026-08-12T15:00:00.000Z');

  assert.equal(merged.incidents.length, 0);
  assert.equal(merged.providers[0].service_state, 'operational');
  assert.equal(merged.providers[0].active_incident_count, 0);
  assert.equal(merged.providers[0].problem_component_count, 0);
  assert.equal(merged.summary.active_incident_count, 0);
  assert.equal(merged.summary.affected_provider_count, 0);
  assert.equal(merged.summary.confirmed_operational_count, 1);
});

test('failed browser live truth leaves the audited static provider and incidents unchanged', () => {
  const staticProvider = provider({ service_state: 'degraded', active_incident_count: 1, attention: 'action', ok: false });
  const staticPayload = payload(staticProvider, [{
    id: 'anthropic:static',
    providerId: 'anthropic',
    provider: 'Anthropic',
    category: 'AI',
    title: 'Static audited incident',
    note: 'Static audited incident',
    source: staticProvider.source,
    url: 'https://status.claude.com/',
    time: '2026-08-12T13:00:00.000Z',
    color: 'yellow',
    service_state: 'degraded',
    attention: 'action',
    priority: 62
  }]);
  const merged = mergeBrowserLiveTruth(staticPayload, [], ['anthropic'], '2026-08-12T14:01:00.000Z');
  assert.equal(merged.providers[0].service_state, 'degraded');
  assert.equal(merged.incidents[0].id, 'anthropic:static');
  assert.equal(merged.live_truth?.failure_provider_count, 1);
  assert.deepEqual(merged.live_truth?.failed_provider_ids, ['anthropic']);
});
