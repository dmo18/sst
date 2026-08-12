import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStatuspageSummary } from '../structured-source-adapters.mjs';
import { deployedProblemState, parsedProblemState, truthDrift } from '../status-truth-watch.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function claudeIncidentFixture() {
  return JSON.stringify({
    page: { name: 'Claude', url: 'https://status.claude.com' },
    components: [
      { name: 'claude.ai', status: 'degraded_performance' },
      { name: 'Claude API (api.anthropic.com)', status: 'degraded_performance' },
      { name: 'Claude Code', status: 'degraded_performance' }
    ],
    incidents: [{
      id: 'rk6gkg2gwfny',
      name: 'Degraded performance for multiple models',
      status: 'investigating',
      impact: 'minor',
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      incident_updates: [{
        status: 'investigating',
        body: 'We are investigating elevated errors on requests to multiple models.',
        created_at: new Date().toISOString(),
        affected_components: [
          { name: 'claude.ai', new_status: 'degraded_performance' },
          { name: 'Claude API (api.anthropic.com)', new_status: 'degraded_performance' },
          { name: 'Claude Code', new_status: 'degraded_performance' }
        ]
      }]
    }],
    scheduled_maintenances: [],
    status: { indicator: 'minor', description: 'Partially Degraded Service' }
  });
}

test('Claude-style active Statuspage incidents are parsed as live problems', () => {
  const parsed = parseStatuspageSummary(claudeIncidentFixture(), { id: 'anthropic', name: 'Anthropic' }, {
    url: 'https://status.claude.com/api/v2/summary.json',
    pageUrl: 'https://status.claude.com/',
    regionScope: 'us'
  });
  const state = parsedProblemState(parsed);
  assert.equal(parsed?.kind, 'issues');
  assert.equal(state.known, true);
  assert.equal(state.active, true);
  assert.deepEqual(state.incidentIds, ['rk6gkg2gwfny']);
});

test('truth watcher detects a newly opened official incident even when deployed payload is fresh', () => {
  const provider = {
    id: 'anthropic',
    service_state: 'operational',
    source_health: 'healthy',
    active_incident_count: 0,
    problem_component_count: 0
  };
  const payload = { incidents: [] };
  const parsed = parseStatuspageSummary(claudeIncidentFixture(), { id: 'anthropic', name: 'Anthropic' }, {
    url: 'https://status.claude.com/api/v2/summary.json',
    pageUrl: 'https://status.claude.com/',
    regionScope: 'us'
  });
  assert.equal(truthDrift(provider, payload, parsed)?.reason, 'official-source-opened');
});

test('truth watcher detects resolved incidents and changed incident sets', () => {
  const activeProvider = {
    id: 'anthropic',
    service_state: 'degraded',
    active_incident_count: 1,
    problem_component_count: 3
  };
  const activePayload = { incidents: [{ providerId: 'anthropic', id: 'anthropic:old-incident' }] };
  const healthy = { kind: 'healthy', status: 'All Systems Operational' };
  assert.equal(truthDrift(activeProvider, activePayload, healthy)?.reason, 'official-source-cleared');

  const parsed = parseStatuspageSummary(claudeIncidentFixture(), { id: 'anthropic', name: 'Anthropic' }, {
    url: 'https://status.claude.com/api/v2/summary.json',
    pageUrl: 'https://status.claude.com/',
    regionScope: 'us'
  });
  assert.equal(truthDrift(activeProvider, activePayload, parsed)?.reason, 'official-incident-set-changed');
});

test('source-health watch does not invent an Entra service incident', () => {
  const entra = {
    id: 'entra',
    service_state: 'operational',
    source_state: 'available',
    source_health: 'watch',
    active_incident_count: 0,
    problem_component_count: 0
  };
  const state = deployedProblemState(entra, { incidents: [] });
  assert.equal(state.active, false);
});

test('freshness workflow compares official live truth and can recover fresh-but-wrong payloads', async () => {
  const workflow = await read('.github/workflows/status-freshness-watch.yml');
  const watcher = await read('scripts/status-truth-watch.mjs');
  assert.match(workflow, /Compare deployed state with live official structured truth/);
  assert.match(workflow, /node scripts\/status-truth-watch\.mjs/);
  assert.match(workflow, /steps\.truth\.outputs\.drift == 'true'/);
  assert.match(workflow, /steps\.truth\.outputs\.stale == 'true'/);
  assert.match(workflow, /actions\/workflows\/refresh-pages\.yml\/dispatches/);
  assert.doesNotMatch(workflow, /ageMinutes > 20/);
  assert.match(watcher, /provider\.source_type === 'statuspage-json'/);
  assert.match(watcher, /parseStatuspageSummary/);
  assert.match(watcher, /parseAzureEntraStatus/);
  assert.match(watcher, /official-incident-set-changed/);
});
