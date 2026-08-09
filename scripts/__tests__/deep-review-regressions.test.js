import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { componentStatusIsProblem, sourceIntelligenceSummary } from '../source-intelligence.mjs';
import { parseStatuspageSummary, parseVultrStatus } from '../structured-source-adapters.mjs';
import { parseAzureEntraStatus } from '../entra-status-adapter.mjs';
import { parseNableIncidentRecords } from '../incident-detail-repairs.mjs';
import { isUsRelevantIncident } from '../public-source-repairs.mjs';
import { parsePayPalProductionStatus } from '../full-review-source-adapters.mjs';
import { reconcileProviderIncidentEvidence, resolvePublicSource, tryFeedCandidates } from '../update-public-status.mjs';
import { summarizeProviders } from '../update-status.mjs';
import { regionScopeRelevant } from '../region-scope.mjs';

function statuspage(data) {
  return JSON.stringify({ page: { url: 'https://status.example/' }, incidents: [], scheduled_maintenances: [], ...data });
}

test('US scope excludes explicit foreign POPs and cloud regions while retaining US and global components', () => {
  assert.equal(regionScopeRelevant('Arica, Chile - (ARI)', '', 'us'), false);
  assert.equal(regionScopeRelevant('Baghdad, Iraq - (BGW)', '', 'us'), false);
  assert.equal(regionScopeRelevant('AWS EC2 Health: me-south-1', '', 'us'), false);
  assert.equal(regionScopeRelevant('GCP northamerica-northeast1', '', 'us'), false);
  assert.equal(regionScopeRelevant('Azure azure-westeurope', '', 'us'), false);
  assert.equal(regionScopeRelevant('Ashburn, VA, United States - (IAD)', '', 'us'), true);
  assert.equal(regionScopeRelevant('AWS EC2 Health: us-east-1', '', 'us'), true);
  assert.equal(regionScopeRelevant('Elasticsearch connectivity: Azure azure-westus2', '', 'us'), true);
  assert.equal(regionScopeRelevant('Global services', '', 'us'), true);
});

test('Statuspage component slicing happens after region filtering and excludes foreign degradation', () => {
  const foreign = Array.from({ length: 50 }, (_, index) => ({ name: `City ${index}, Chile - (C${String(index).padStart(2, '0')})`, status: index === 4 ? 'major_outage' : 'operational' }));
  const result = parseStatuspageSummary(statuspage({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      ...foreign,
      { name: 'Ashburn, VA, United States - (IAD)', status: 'operational' },
      { name: 'Atlanta, GA, United States - (ATL)', status: 'degraded_performance' }
    ]
  }), { id: 'cloudflare', name: 'Cloudflare' }, { regionScope: 'us', url: 'https://status.example/api/v2/summary.json' });
  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.deepEqual(result.components.map(item => item.name), ['Ashburn, VA, United States - (IAD)', 'Atlanta, GA, United States - (ATL)']);
});

test('non-service product advisories cannot become outages even when the historical impact field is major', () => {
  const result = parseStatuspageSummary(statuspage({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      { name: 'Elasticsearch connectivity: Azure azure-westus2', status: 'degraded_performance' },
      { name: 'AWS EC2 Health: me-south-1', status: 'major_outage' }
    ],
    incidents: [{
      id: 'advisory-1',
      name: 'Elasticsearch 9.5.0 contains a query-correctness defect',
      status: 'identified',
      impact: 'major',
      created_at: '2026-08-02T10:00:00Z',
      updated_at: '2026-08-02T12:00:00Z',
      incident_updates: [{ status: 'identified', created_at: '2026-08-02T12:00:00Z', body: 'A patch release is in progress. There is no impact to cluster availability, connectivity, or data ingestion. Defer upgrading until the patch is available.' }]
    }]
  }), { id: 'elastic-cloud', name: 'Elastic Cloud' }, { regionScope: 'us', url: 'https://status.example/api/v2/summary.json' });
  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.equal(result.components.some(item => /me-south-1/i.test(item.name)), false);
});

test('N-able security hotfix advisories without current customer service impact are suppressed', () => {
  const records = parseNableIncidentRecords(`
    <main>Active Incidents
    Active Incident ID: 12345 Start: Aug 02, 2026 10:00:00 UTC End:
    Severity: Minor Status: Monitoring
    URGENT: N-CENTRAL SECOND HOTFIX - IMMEDIATE ACTION REQUIRED As our investigation into the recent N-central security vulnerability continues, we are proactively expanding protections in response to monitoring of threat actors.
    Services Impacted N-central
    Timeline Monitoring Aug 02, 2026 12:00:00 UTC A second security hotfix is available and should be installed immediately.
    Resolved Incidents</main>
  `);
  assert.equal(records.length, 0);
});

test('security-related records remain incidents when they contain explicit current service impact', () => {
  const records = parseNableIncidentRecords(`
    <main>Active Incidents
    Active Incident ID: 12346 Start: Aug 02, 2026 10:00:00 UTC End:
    Severity: Minor Status: Investigating
    N-central authentication issue. Customers are currently experiencing login failures while we investigate a security-related change.
    Services Impacted N-central
    Timeline Investigating Aug 02, 2026 12:00:00 UTC Customers are currently experiencing login failures.
    Resolved Incidents</main>
  `);
  assert.equal(records.length, 1);
});

test('Entra omits not-applicable regional cells from component issue telemetry', () => {
  const html = `<table data-zone-name="americas"><thead><tr><th>Products and services</th><th>*Non-Regional</th><th>East US</th><th>West US</th></tr></thead><tbody><tr><td>Microsoft Entra ID (formerly Azure AD)</td><td><span data-label="Good"></span></td><td><span data-label="Not available"></span></td><td><span data-label="Not available"></span></td></tr></tbody></table>`;
  const result = parseAzureEntraStatus(html);
  assert.equal(result.kind, 'healthy');
  assert.deepEqual(result.components, [{ name: 'Non-Regional', status: 'Good' }]);
});

test('component issue telemetry excludes maintenance, unknown, and not-applicable states', () => {
  for (const value of ['operational', 'Good', 'Not available', 'n/a', 'unknown', 'under_maintenance', 'scheduled_maintenance']) assert.equal(componentStatusIsProblem(value), false, value);
  for (const value of ['degraded_performance', 'partial_outage', 'major_outage', 'unavailable']) assert.equal(componentStatusIsProblem(value), true, value);
  const summary = sourceIntelligenceSummary([{ source_state: 'available', ok: true, component_status: [{ status: 'Not available' }, { status: 'under_maintenance' }, { status: 'degraded_performance' }] }], []);
  assert.equal(summary.component_issue_count, 1);
});

test('affected provider count reconciles all degraded and major providers, including component-only states', () => {
  const providers = [
    { service_state: 'major', source_state: 'available' },
    { service_state: 'degraded', source_state: 'available' },
    { service_state: 'operational', source_state: 'available' },
    { service_state: 'unknown', source_state: 'available' }
  ];
  const summary = summarizeProviders(providers, [{ providerId: 'only-one-incident' }]);
  assert.equal(summary.affected_provider_count, 2);
  assert.equal(summary.major_count + summary.degraded_count, summary.affected_provider_count);
});

test('incident reconciliation updates stale count labels and preserves current component-only degradation', () => {
  const current = { id: 'p', name: 'Provider', title: 'Current outage', note: 'Customers are currently affected.', status: 'investigating', color: 'amber', rawTime: '2026-08-02T12:00:00Z', latest_update: '2026-08-02T12:00:00Z' };
  const stale = { ...current, id: 'old', title: 'Old outage', rawTime: '2026-07-20T12:00:00Z', latest_update: '2026-07-20T12:00:00Z' };
  const reconciled = reconcileProviderIncidentEvidence({ status: '2 active US public incidents', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [current, stale], component_status: [] }, Date.parse('2026-08-02T13:44:00Z'));
  assert.equal(reconciled.incidents.length, 1);
  assert.equal(reconciled.status, '1 active US public incident');

  const components = reconcileProviderIncidentEvidence({ status: '1 active US public incident', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [stale], component_status: [{ name: 'API', status: 'degraded_performance' }] }, Date.parse('2026-08-02T13:44:00Z'));
  assert.equal(components.incidents.length, 0);
  assert.equal(components.status, '1 current degraded component');
  assert.equal(components.service_state, 'degraded');
});

test('Vultr collapses indistinguishable duplicate public alerts without hiding distinct incidents', () => {
  const duplicate = id => ({ id, subject: 'Partial Outage', status: 'ongoing', start_date: '2026-08-02T12:00:00Z', updated_at: '2026-08-02T12:30:00Z', message: 'An outage or maintenance window is affecting a subset of users in this region.' });
  const result = parseVultrStatus(JSON.stringify({ regions: { ord: { country: 'US', location: 'Chicago', alerts: [duplicate('a'), duplicate('b'), { id: 'c', subject: 'Chicago power issue', status: 'ongoing', start_date: '2026-08-02T12:10:00Z', updated_at: '2026-08-02T12:40:00Z', message: 'Customers are currently experiencing intermittent connectivity.' }] } } }), { id: 'vultr', name: 'Vultr' }, { regionScope: 'us', url: 'https://status.vultr.com/status.json' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 2);
  assert.equal(result.incidents.find(item => /Partial Outage/.test(item.title)).collapsedRecordCount, 2);
});

test('disabled feed discovery performs no network request', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('should not fetch'); };
  try {
    const result = await tryFeedCandidates({ id: 'paypal', name: 'PayPal' }, { url: 'https://www.paypal-status.com/product/production', discoverFeeds: false }, '<link rel="alternate" href="/history.rss">', []);
    assert.equal(result, null);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('PayPal health is scoped before history and static legend text', () => {
  const staleHealthy = parsePayPalProductionStatus('PayPal Status Page Production Sandbox Subscribe Production Sandbox Services PayPal Degraded Performance Checkout users are experiencing elevated errors Operational Major Outage Degraded Performance Maintenance Bulletin View history All Production Systems Operational');
  assert.equal(staleHealthy.kind, 'component-state');
  const noCurrentSignal = parsePayPalProductionStatus('PayPal Status Page Production Sandbox Subscribe Production Sandbox Services APIs Operational Major Outage Degraded Performance Maintenance Bulletin View history All Production Systems Operational');
  assert.equal(noCurrentSignal.kind, 'limited');
});

test('deep review helper files are production code, not temporary patch artifacts', () => {
  for (const path of ['scripts/region-scope.mjs', 'scripts/incident-classification.mjs']) assert.equal(fs.existsSync(path), true);
});

test('QuickBooks Online uses the current official Statuspage JSON summary', () => {
  const source = resolvePublicSource({ id: 'quickbooks-online', name: 'QuickBooks Online', category: 'Accounting', sourceType: 'statuspage', url: 'https://status.quickbooks.intuit.com/api/v2/summary.json' });
  assert.equal(source.mode, 'statuspage-json');
  assert.equal(source.url, 'https://status.quickbooks.intuit.com/api/v2/summary.json');
  const result = parseStatuspageSummary(JSON.stringify({
    page: { id: 'quickbooks', name: 'QuickBooks', url: 'https://status.quickbooks.intuit.com' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [
      { name: 'United States', group_id: 'qbo', status: 'operational' },
      { name: 'EMEA', group_id: 'qbo', status: 'major_outage' }
    ],
    incidents: [],
    scheduled_maintenances: []
  }), { id: 'quickbooks-online', name: 'QuickBooks Online' }, source);
  assert.equal(result.kind, 'healthy');
  assert.deepEqual(result.components.map(item => item.name), ['United States']);
});

test('provider-specific region filtering shares the canonical US scope policy', () => {
  assert.equal(isUsRelevantIncident('Arica, Chile - (ARI) service disruption'), false);
  assert.equal(isUsRelevantIncident('Autotask UK cell service degradation'), false);
  assert.equal(isUsRelevantIncident('AWS EC2 Health: me-south-1'), false);
  assert.equal(isUsRelevantIncident('GCP northamerica-northeast1'), false);
  assert.equal(isUsRelevantIncident('Ashburn, VA, United States - (IAD) service disruption'), true);
  assert.equal(isUsRelevantIncident('AWS EC2 Health: us-east-1'), true);
  assert.equal(isUsRelevantIncident('Global service disruption'), true);
});
