import test from 'node:test';
import assert from 'node:assert/strict';
import { fullReviewConclusion, fullReviewOverrides, parseStatusCastSummary } from '../full-review-source-adapters.mjs';

test('verified full-review replacements use current first-party machine-readable sources', () => {
  assert.equal(fullReviewOverrides.kaseya.url, 'https://status.kaseya.com/api/v2/summary.json');
  assert.equal(fullReviewOverrides.kaseya.mode, 'statuspage-json');
  assert.equal(fullReviewOverrides.lastpass.url, 'https://status.lastpass.com/api/v1/status.json');
  assert.equal(fullReviewOverrides.lastpass.mode, 'statuspage-json');
  assert.equal(fullReviewOverrides['8x8'].url, 'https://8x8status.status.page/summary.json');
  assert.equal(fullReviewOverrides['8x8'].mode, 'statuscast-json');
});

test('Kaseya current Statuspage degradation remains specific structured incident evidence', () => {
  const result = fullReviewConclusion({ id: 'kaseya', name: 'Kaseya' }, JSON.stringify({
    page: { id: 'kaseya', name: 'Kaseya Inc', url: 'https://status.kaseya.com/' },
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      { id: 'backup', name: 'Datto SaaS Protection Backups', status: 'degraded_performance' }
    ],
    incidents: [{
      id: 'incident-1',
      name: 'Datto SaaS Protection backup degradation affecting multiple regions',
      status: 'monitoring',
      impact: 'major',
      created_at: '2026-08-05T19:40:45Z',
      updated_at: '2026-08-07T16:08:45Z',
      incident_updates: [{
        status: 'monitoring',
        body: 'Backup success rates across all regions have recovered and remain under monitoring.',
        created_at: '2026-08-07T16:08:45Z'
      }],
      components: [{ name: 'Datto SaaS Protection Backups' }]
    }],
    scheduled_maintenances: []
  }));

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.match(result.incidents[0].title, /Datto SaaS Protection/);
});

test('LastPass Rootly status JSON confirms current operational service without a failed legacy request', () => {
  const result = fullReviewConclusion({ id: 'lastpass', name: 'LastPass' }, JSON.stringify({
    page: { id: 'lastpass', name: 'LastPass | Status', url: 'https://status.lastpass.com/' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    incidents: []
  }));

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All Systems Operational');
});

test('8x8 StatusCast informational knowledge-base notice with no availability impact is not an outage', () => {
  const result = parseStatusCastSummary(JSON.stringify({
    PageName: '8x8 Service Status',
    StatusText: 'Information',
    Status: 'Informational',
    UnresolvedIncidents: [{
      Id: 697937,
      DateCreated: '2026-08-04T10:14:55Z',
      IncidentType: 'Informational',
      Status: 'InProgress',
      Title: 'Update to 8x8 Knowledgebase',
      StartDate: '2026-08-06T07:40:00Z',
      Posts: [{ Text: 'There is no planned impact to availability. Direct knowledge base links are changing.' }]
    }]
  }), { id: '8x8', name: '8x8' }, fullReviewOverrides['8x8']);

  assert.equal(result.kind, 'healthy');
  assert.match(result.status, /informational notices do not report service impact/i);
});

test('8x8 StatusCast current Americas service impact remains an incident', () => {
  const result = parseStatusCastSummary(JSON.stringify({
    PageName: '8x8 Service Status',
    StatusText: 'Performance Issue',
    Status: 'DegradedPerformance',
    UnresolvedIncidents: [{
      Id: 700001,
      DateCreated: '2026-08-07T20:10:00Z',
      IncidentType: 'Performance Issue',
      Status: 'Investigating',
      Title: 'Americas Contact Center performance degradation',
      StartDate: '2026-08-07T20:10:00Z',
      Posts: [{
        Status: 'Investigating',
        DateCreated: '2026-08-07T20:25:00Z',
        Text: 'Customers in the Americas are experiencing intermittent Contact Center errors.'
      }]
    }]
  }), { id: '8x8', name: '8x8' }, fullReviewOverrides['8x8']);

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].affectedService, 'Americas');
});

test('8x8 StatusCast explicit non-US-only incident does not contaminate US scope', () => {
  const result = parseStatusCastSummary(JSON.stringify({
    PageName: '8x8 Service Status',
    StatusText: 'Performance Issue',
    Status: 'DegradedPerformance',
    UnresolvedIncidents: [{
      Id: 700002,
      DateCreated: '2026-08-07T20:10:00Z',
      IncidentType: 'Performance Issue',
      Status: 'Investigating',
      Title: 'EMEA Voice performance degradation',
      StartDate: '2026-08-07T20:10:00Z',
      Posts: [{ Text: 'Customers in Europe are experiencing intermittent voice errors.' }]
    }]
  }), { id: '8x8', name: '8x8' }, fullReviewOverrides['8x8']);

  assert.equal(result.kind, 'healthy');
  assert.match(result.status, /no active US-relevant/i);
});
