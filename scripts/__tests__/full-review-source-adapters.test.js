import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fullReviewConclusion,
  fullReviewOverrides,
  parseFireHydrantPayload,
  parseProofpointCurrentIncidents,
  parseStatusCastSummary
} from '../full-review-source-adapters.mjs';

test('verified full-review replacements use current first-party sources', () => {
  assert.equal(fullReviewOverrides.kaseya.url, 'https://status.kaseya.com/api/v2/summary.json');
  assert.equal(fullReviewOverrides.kaseya.mode, 'statuspage-json');
  assert.equal(fullReviewOverrides.lastpass.url, 'https://status.lastpass.com/api/v1/status.json');
  assert.equal(fullReviewOverrides.lastpass.mode, 'statuspage-json');
  assert.equal(fullReviewOverrides['8x8'].url, 'https://8x8status.status.page/summary.json');
  assert.equal(fullReviewOverrides['8x8'].mode, 'statuscast-json');
  assert.equal(fullReviewOverrides.proofpoint.url, 'https://proofpoint.my.site.com/community/s/proofpoint-current-incidents');
  assert.equal(fullReviewOverrides.proofpoint.render, true);
  assert.equal(fullReviewOverrides.backblaze.url, 'https://status.backblaze.com/data/payload.json');
  assert.equal(fullReviewOverrides.backblaze.mode, 'firehydrant-json');
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
      created_at: '2026-08-02T10:40:45Z',
      updated_at: '2026-08-02T12:08:45Z',
      incident_updates: [{
        status: 'monitoring',
        body: 'Backup success rates across all regions have recovered and remain under monitoring.',
        created_at: '2026-08-02T12:08:45Z'
      }],
      components: [{ name: 'Datto SaaS Protection Backups' }]
    }],
    scheduled_maintenances: []
  }));

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.match(result.incidents[0].title, /Datto SaaS Protection/);
  assert.match(result.incidents[0].affectedService, /Datto SaaS Protection Backups/);
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
      DateCreated: '2026-08-02T11:10:00Z',
      IncidentType: 'Performance Issue',
      Status: 'Investigating',
      Title: 'Americas Contact Center performance degradation',
      StartDate: '2026-08-02T11:10:00Z',
      Posts: [{
        Status: 'Investigating',
        DateCreated: '2026-08-02T12:25:00Z',
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
      DateCreated: '2026-08-02T11:10:00Z',
      IncidentType: 'Performance Issue',
      Status: 'Investigating',
      Title: 'EMEA Voice performance degradation',
      StartDate: '2026-08-02T11:10:00Z',
      Posts: [{ Text: 'Customers in Europe are experiencing intermittent voice errors.' }]
    }]
  }), { id: '8x8', name: '8x8' }, fullReviewOverrides['8x8']);

  assert.equal(result.kind, 'healthy');
  assert.match(result.status, /no active US-relevant/i);
});

test('Backblaze FireHydrant payload confirms explicit operational state and preserves scheduled maintenance', () => {
  const result = parseFireHydrantPayload(JSON.stringify({
    config: {
      companyName: 'Backblaze',
      operationalMessage: 'All systems operational. Nothing to report.'
    },
    components: [
      { name: 'US West Region', id: 'us-west' },
      { name: 'US East Region', id: 'us-east' }
    ],
    conditions: {
      Degraded: 'DEGRADED',
      Unavailable: 'OFFLINE',
      Operational: 'OPERATIONAL',
      'Maintenance ': 'DEGRADED'
    },
    scheduledMaintenances: [{
      id: 'maintenance-1',
      name: 'US West Core Services Maintenance',
      summary: 'Routine maintenance',
      startsAt: '2026-08-19T17:00:00Z',
      endsAt: '2026-08-19T19:30:00Z',
      componentConditions: { 'US West Region': 'Maintenance ' }
    }]
  }), { id: 'backblaze', name: 'Backblaze' }, fullReviewOverrides.backblaze);

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All systems operational. Nothing to report.');
  assert.equal(result.maintenance.length, 1);
  assert.equal(result.maintenance[0].affectedService, 'US West Region');
});

test('Backblaze FireHydrant current US incident remains structured service-impact evidence', () => {
  const result = parseFireHydrantPayload(JSON.stringify({
    config: { companyName: 'Backblaze', operationalMessage: 'All systems operational. Nothing to report.' },
    components: [{ name: 'US East Region', id: 'us-east' }],
    conditions: { Degraded: 'DEGRADED', Unavailable: 'OFFLINE', Operational: 'OPERATIONAL' },
    incidents: [{
      id: 'incident-1',
      name: 'B2 API availability degradation',
      summary: 'Customers in US East are experiencing elevated API errors.',
      timestamps: { started: '2026-08-02T12:10:00Z' },
      currentMilestone: 'investigating',
      componentConditions: { 'US East Region': 'Degraded' },
      timeline: [{
        occurredAt: '2026-08-02T12:25:00Z',
        details: {
          '@type': 'type.googleapis.com/firehydrant.nunc.TimelineEvent.Note',
          note: 'Customers in US East are experiencing elevated API errors.'
        }
      }]
    }],
    scheduledMaintenances: []
  }), { id: 'backblaze', name: 'Backblaze' }, fullReviewOverrides.backblaze);

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].affectedService, 'US East Region');
  assert.equal(result.incidents[0].color, 'amber');
});

test('authenticated vendor health channels are live official references without false operational conclusions', () => {
  const crowdstrike = fullReviewConclusion({ id: 'crowdstrike', name: 'CrowdStrike' }, '<main>Log in to the CrowdStrike Support portal to create and manage your support cases, subscribe to Tech Alerts and Release notes, and access our knowledge base.</main>');
  assert.equal(crowdstrike.kind, 'access-gated');
  assert.match(crowdstrike.status, /authenticated Support Portal access/i);

  const intermedia = fullReviewConclusion({ id: 'intermedia', name: 'Intermedia' }, '<main><h2>System Status</h2><p>Intermedia\'s status dashboard can be seen on the homepage of your control panel when you log in.</p></main>');
  assert.equal(intermedia.kind, 'access-gated');
  assert.match(intermedia.status, /authenticated HostPilot access/i);
});

test('Proofpoint rendered current-incidents page accepts explicit no-current state', () => {
  const result = parseProofpointCurrentIncidents(`
    <html><body>
      <h1>Proofpoint Current Incidents</h1>
      <p><strong>No current identified incidents</strong></p>
      <p>If you are seeing a service disruption, please open a support case</p>
    </body></html>
  `, { id: 'proofpoint', name: 'Proofpoint' });

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'Proofpoint reports no current identified incidents');
});

test('Proofpoint rendered current incident never becomes false healthy', () => {
  const result = parseProofpointCurrentIncidents(`
    <html><body>
      <h1>Proofpoint Current Incidents</h1>
      <h2>Email Protection degradation</h2>
      <p>Customers in the United States are experiencing elevated errors. We are investigating.</p>
    </body></html>
  `, { id: 'proofpoint', name: 'Proofpoint' });

  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.match(result.message, /Email Protection degradation/);
});
