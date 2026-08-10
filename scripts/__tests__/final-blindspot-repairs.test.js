import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { providerSpecificConclusion } from '../public-source-repairs.mjs';
import { parseStatuspageSummary } from '../structured-source-adapters.mjs';
import { reconcileProviderIncidentEvidence, resolvePublicSource } from '../update-public-status.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

const provider = (id, name = id) => ({
  id,
  name,
  category: 'Test',
  priority: 50,
  sourceType: 'html',
  url: `https://invalid.example/${id}`
});

test('Kaseya uses its current official Statuspage JSON instead of a history-only feed', () => {
  const source = resolvePublicSource(provider('kaseya', 'Kaseya'));
  assert.equal(source.mode, 'statuspage-json');
  assert.equal(source.url, 'https://status.kaseya.com/api/v2/summary.json');
  assert.equal(source.pageUrl, 'https://status.kaseya.com/');
  assert.equal(source.regionScope, 'us');
});

test('provider transport policy distinguishes browser fallback from authenticated status access references', () => {
  const proofpoint = resolvePublicSource(provider('proofpoint', 'Proofpoint'));
  assert.equal(proofpoint.mode, 'status-html');
  assert.equal(proofpoint.render, true, 'Proofpoint should have browser fallback');
  assert.match(proofpoint.url, /^https:\/\//);

  for (const id of ['crowdstrike', 'intermedia']) {
    const source = resolvePublicSource(provider(id));
    assert.equal(source.mode, 'status-access-reference');
    assert.equal(source.healthAccess, 'authenticated');
    assert.notEqual(source.render, true);
    assert.match(source.url, /^https:\/\//);
    assert.match(source.pageUrl, /^https:\/\//);
  }

  const collector = fs.readFileSync(path.join(root, 'scripts', 'update-public-status.mjs'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'scripts', 'public-source-adapter-implementation.mjs'), 'utf8');
  const facade = fs.readFileSync(path.join(root, 'scripts', 'public-source-repairs.mjs'), 'utf8');
  assert.match(collector, /if \(!result\.ok\)[\s\S]*source\.render === true[\s\S]*await renderPublicPage\(source\)/);
  assert.match(collector, /let renderedAlready = false/);
  assert.match(facade, /SourceAdapterRegistry/);
  assert.match(renderer, /--virtual-time-budget=20000/);
  assert.match(renderer, /timeout:\s*35000/);
  assert.doesNotMatch(renderer, /spawnSync/);
  assert.doesNotMatch(renderer, /--no-sandbox/);
});

test('8x8 Americas service matrix can confirm an explicit all-normal current state', () => {
  const result = providerSpecificConclusion({ id: '8x8', name: '8x8' }, `
    Service Status
    Americas
    8x8 Work Normal
    Contact Center Normal
    Voice Normal
    Messaging Normal
    Meetings Normal
    Administration Normal
    EMEA
    Voice Performance Issue
  `);

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, '8x8 Americas services report normal status');
});

test('8x8 current issue wording never becomes a false healthy conclusion', () => {
  const result = providerSpecificConclusion({ id: '8x8', name: '8x8' }, `
    Service Status
    Americas
    8x8 Work Normal
    Contact Center Performance Issue
    Voice Normal
    Messaging Normal
    Meetings Normal
    Administration Normal
    EMEA
    Voice Normal
  `);

  assert.equal(result.kind, 'limited');
  assert.match(result.message, /Performance Issue/);
});

test('current Statuspage component degradation remains live structured evidence without fabricating an incident', () => {
  const result = parseStatuspageSummary(JSON.stringify({
    page: { id: 'lumen', name: 'Lumen', url: 'https://lumen.statuspage.io/' },
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      { id: 'us-core', name: 'US Core Network', status: 'degraded_performance' },
      { id: 'portal', name: 'Customer Portal', status: 'operational' }
    ],
    incidents: [],
    scheduled_maintenances: []
  }), { id: 'lumen', name: 'Lumen' }, { regionScope: 'us' });

  assert.equal(result.kind, 'component-state');
  assert.equal(result.status, 'Partially Degraded Service');
  assert.equal(result.color, 'amber');
  assert.match(result.message, /US Core Network/);
  assert.equal(result.components.length, 2);
});

test('component-backed degradation survives incident reconciliation while unsupported degradation still fails closed', () => {
  const base = {
    id: 'lumen',
    name: 'Lumen',
    service_state: 'degraded',
    source_state: 'available',
    color: 'amber',
    attention: 'action',
    ok: true,
    incidents: [],
    component_status: [{ name: 'US Core Network', status: 'degraded_performance' }]
  };

  const preserved = reconcileProviderIncidentEvidence(base, Date.parse('2026-08-02T14:00:00Z'));
  assert.equal(preserved.service_state, 'degraded');
  assert.equal(preserved.source_state, 'available');
  assert.equal(preserved.ok, true);

  const unsupported = reconcileProviderIncidentEvidence({ ...base, component_status: [] }, Date.parse('2026-08-02T14:00:00Z'));
  assert.equal(unsupported.service_state, 'unknown');
  assert.equal(unsupported.source_state, 'limited');
  assert.equal(unsupported.ok, false);
});
