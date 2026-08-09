import test from 'node:test';
import assert from 'node:assert/strict';
import { regionScopeRelevant } from '../region-scope.mjs';
import { normalizeMaintenanceState } from '../source-intelligence.mjs';
import { enrichProviderCollection } from '../collection-intelligence.mjs';
import { makeMaintenance } from '../update-public-status.mjs';
import { parseSalesforcePage } from '../structured-source-adapters.mjs';

test('US scope excludes foreign macro-regions while retaining North America', () => {
  assert.equal(regionScopeRelevant('Oceania', '', 'us'), false);
  assert.equal(regionScopeRelevant('Europe', '', 'us'), false);
  assert.equal(regionScopeRelevant('Asia Pacific', '', 'us'), false);
  assert.equal(regionScopeRelevant('North America', '', 'us'), true);
});

test('maintenance lifecycle is derived from the actual window before vendor wording', () => {
  const now = Date.parse('2026-08-09T15:00:00Z');
  assert.equal(normalizeMaintenanceState('ongoing', '2026-08-10T01:00:00Z', '2026-08-10T03:00:00Z', now), 'scheduled');
  assert.equal(normalizeMaintenanceState('scheduled', '2026-08-09T14:00:00Z', '2026-08-09T16:00:00Z', now), 'in_progress');
  assert.equal(normalizeMaintenanceState('ongoing', '2026-08-09T10:00:00Z', '2026-08-09T12:00:00Z', now), 'completed');
});

test('makeMaintenance cannot publish future work as in progress', () => {
  const realNow = Date.now;
  Date.now = () => Date.parse('2026-08-09T15:00:00Z');
  try {
    const result = makeMaintenance(
      { id: 'vultr', name: 'Vultr', category: 'Cloud', priority: 70, services: ['Cloud Compute'] },
      { mode: 'vultr-json', url: 'https://status.vultr.com/status.json', pageUrl: 'https://status.vultr.com/' },
      {
        id: 'future-maintenance',
        title: 'New Jersey Scheduled Maintenance',
        status: 'ongoing',
        startsAt: '2026-08-10T01:00:00Z',
        endsAt: '2026-08-10T03:00:00Z'
      }
    );
    assert.equal(result.status, 'scheduled');
    assert.equal(result.attention, 'watch');
  } finally {
    Date.now = realNow;
  }
});

test('component-only degradation is not mislabeled as vendor incident evidence', () => {
  const provider = {
    id: 'cloudflare',
    name: 'Cloudflare',
    service_state: 'degraded',
    source_state: 'available',
    ok: true,
    source: 'https://www.cloudflarestatus.com/api/v2/summary.json',
    source_type: 'statuspage-json',
    evidence_tier: 'structured',
    checked_at: '2026-08-09T15:00:00Z',
    component_status: [{ name: 'North America', status: 'partial_outage' }],
    download_log: []
  };
  const result = enrichProviderCollection(provider, [], [], '2026-08-09T15:00:00Z');
  assert.equal(result.active_incident_count, 0);
  assert.equal(result.problem_component_count, 1);
  assert.equal(result.truth_basis, 'vendor-component');
});

test('Salesforce current table incidents carry explicit snapshot provenance when vendor timestamps are absent', () => {
  const result = parseSalesforcePage(`
    <main>
      <h1>Current Status</h1>
      <div>123456 Feature Degradation United States - East - (prod-useast-b) Load a View Ongoing</div>
      <h2>Recently Viewed Instances</h2>
    </main>
  `, { id: 'salesforce', name: 'Salesforce' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].evidenceBasis, 'current-page');
  assert.equal(result.incidents[0].latestUpdate || '', '');
});
