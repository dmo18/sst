import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBetterStackIndex, parseStatusioJson, parseStatuspageSummary } from '../structured-source-adapters.mjs';
import { parseFireHydrantPayload, parseStatusCastSummary } from '../full-review-source-adapters.mjs';
import { activeFeedEntries, htmlIssueConclusion, reconcileProviderIncidentEvidence } from '../update-public-status.mjs';

const auditNow = Date.parse('2026-08-02T13:44:00Z');

function statuspage(data) {
  return JSON.stringify({ page: { url: 'https://status.example/' }, incidents: [], scheduled_maintenances: [], ...data });
}

test('structured component degradation wins over contradictory aggregate healthy states', () => {
  const statuspageResult = parseStatuspageSummary(statuspage({
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [{ name: 'US API', status: 'degraded_performance' }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(statuspageResult.kind, 'component-state');

  const statusioResult = parseStatusioJson(JSON.stringify({ result: {
    status_overall: { status: 'Operational', status_code: 100 },
    status: [{ name: 'North America', containers: [{ name: 'US API', status: 'Degraded Performance' }] }],
    maintenance: { active: [], upcoming: [] },
    incidents: []
  } }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(statusioResult.kind, 'component-state');

  const betterStackResult = parseBetterStackIndex(JSON.stringify({
    data: { type: 'status_page', attributes: { company_name: 'Example', aggregate_state: 'operational' } },
    included: [{ id: 'us-api', type: 'status_page_resource', attributes: { public_name: 'US API', status: 'degraded' } }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(betterStackResult.kind, 'component-state');
});

test('mixed-region Statuspage incidents display only US-relevant affected components', () => {
  const result = parseStatuspageSummary(statuspage({
    status: { indicator: 'major', description: 'Major Service Outage' },
    components: [{ name: 'US-East', status: 'partial_outage' }],
    incidents: [{
      id: 'mixed', name: 'Global API disruption', status: 'investigating', impact: 'major',
      created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-02T13:00:00Z',
      components: [{ name: 'US-East' }, { name: 'API Europe', description: 'London Europe' }],
      incident_updates: [{ status: 'investigating', body: 'Customers in multiple regions are experiencing failed requests.', created_at: '2026-08-02T13:00:00Z' }]
    }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents[0].affectedService, 'US-East');
});

test('foreign-only Status.io maintenance does not leak into the US maintenance list', () => {
  const result = parseStatusioJson(JSON.stringify({ result: {
    status_overall: { status: 'Operational', status_code: 100 },
    status: [{ name: 'North America', containers: [{ name: 'US API', status: 'Operational' }] }],
    maintenance: { active: [], upcoming: [{ id: 'eu-maint', name: 'Database maintenance', status: 'Scheduled', components: [{ name: 'EU API' }] }] },
    incidents: []
  } }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(result.kind, 'healthy');
  assert.equal(result.maintenance.length, 0);
});

test('Backblaze FireHydrant uses shared US scope and neutral maintenance component semantics', () => {
  const result = parseFireHydrantPayload(JSON.stringify({
    config: { companyName: 'Backblaze', operationalMessage: 'All systems operational. Nothing to report.' },
    conditions: { Operational: 'OPERATIONAL', Maintenance: 'MAINTENANCE' },
    components: [
      { name: 'US East Region', customerCondition: 'Operational' },
      { name: 'EU Region', customerCondition: 'Maintenance' }
    ],
    incidents: [],
    scheduledMaintenances: [{ id: 'eu-maint', name: 'Database maintenance', startsAt: '2026-08-03T12:00:00Z', endsAt: '2026-08-03T13:00:00Z', componentConditions: { 'EU Region': 'Maintenance' } }]
  }), { name: 'Backblaze' }, { regionScope: 'us', pageUrl: 'https://status.backblaze.com/' });
  assert.equal(result.kind, 'healthy');
  assert.deepEqual(result.components.map(item => item.name), ['US East Region']);
  assert.equal(result.maintenance.length, 0);
});

test('stale unresolved StatusCast and FireHydrant records never remain current incidents', () => {
  const statusCast = parseStatusCastSummary(JSON.stringify({
    Status: 'Operational', StatusText: 'Available', UnresolvedIncidents: [{
      Id: 'old', Title: 'Americas Contact Center degradation', Status: 'Monitoring', IncidentType: 'Performance Issue',
      StartDate: '2026-01-01T00:00:00Z', DateUpdated: '2026-01-01T01:00:00Z', Posts: [{ Text: 'Customers in the Americas are experiencing intermittent errors.', DateCreated: '2026-01-01T01:00:00Z' }]
    }]
  }), { name: '8x8' }, { regionScope: 'us' });
  assert.equal(statusCast.kind, 'healthy');
  assert.equal(statusCast.incidents, undefined);

  const fireHydrant = parseFireHydrantPayload(JSON.stringify({
    config: { companyName: 'Backblaze', operationalMessage: 'All systems operational. Nothing to report.' },
    conditions: { Operational: 'OPERATIONAL' },
    components: [{ name: 'US East Region', customerCondition: 'Operational' }],
    incidents: [{ id: 'old', name: 'US East API degradation', summary: 'Customers are experiencing elevated API errors.', currentMilestone: 'monitoring', timestamps: { started: '2026-01-01T00:00:00Z' }, updatedAt: '2026-01-01T01:00:00Z', componentConditions: { 'US East Region': 'Degraded' } }],
    scheduledMaintenances: []
  }), { name: 'Backblaze' }, { regionScope: 'us' });
  assert.equal(fireHydrant.kind, 'healthy');
});

test('public incident feeds suppress non-service security and product advisories', () => {
  const entries = activeFeedEntries([{ title: 'Security vulnerability hotfix', note: 'A security advisory requires a hotfix. There is no impact to service availability.', status: 'investigating', time: '2026-08-02T12:00:00Z' }], 168, auditNow);
  assert.equal(entries.length, 0);
});

test('generic HTML ignores static legends, respects view-history boundaries, and still sees current issues', () => {
  const provider = { id: 'example', name: 'Example' };
  const source = { regionScope: 'us' };
  const legend = htmlIssueConclusion(provider, source, '<main>Status Operational Major Outage Partial Outage Degraded Performance Maintenance Bulletin View history Major Outage old incident</main>');
  assert.equal(legend.kind, 'limited');
  const issue = htmlIssueConclusion(provider, source, '<main>Status Investigating an issue Customers are currently experiencing failed requests. View history All Systems Operational</main>');
  assert.equal(issue.kind, 'issue');
});

test('unsupported affected state fails closed when current incident and component evidence are absent', () => {
  const stale = { id: 'old', title: 'Old outage', note: 'Customers were affected.', status: 'monitoring', color: 'amber', rawTime: '2026-01-01T00:00:00Z', latest_update: '2026-01-01T01:00:00Z' };
  const result = reconcileProviderIncidentEvidence({ status: '1 active public incident', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [stale], component_status: [] }, auditNow);
  assert.equal(result.service_state, 'unknown');
  assert.equal(result.source_state, 'limited');
  assert.equal(result.ok, false);
});
