import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPublicProvider, resolvePublicSource } from '../update-public-status.mjs';
import {
  parseBetterStackIndex,
  parseStatusioPage,
  parseStatuspageSummary,
  structuredSourceOverrides
} from '../structured-source-adapters.mjs';

const response = (body, status = 200, type = 'application/json') => new Response(body, {
  status,
  headers: { 'content-type': type }
});

const statuspageFixture = {
  page: { id: 'page-1', name: 'Example', url: 'https://status.example.com/' },
  status: { indicator: 'minor', description: 'Minor Service Outage' },
  components: [],
  incidents: [
    {
      id: 'eu-1',
      name: 'API latency in London',
      status: 'investigating',
      impact: 'minor',
      created_at: '2026-08-02T11:00:00Z',
      updated_at: '2026-08-02T11:30:00Z',
      components: [{ id: 'eu-api', name: 'API Europe' }],
      incident_updates: [{ status: 'investigating', body: 'Customers in London and Europe are affected.', created_at: '2026-08-02T11:30:00Z' }]
    },
    {
      id: 'us-1',
      name: 'Workers API errors in US-East',
      status: 'monitoring',
      impact: 'major',
      shortlink: 'https://stspg.io/us-1',
      created_at: '2026-08-02T12:00:00Z',
      updated_at: '2026-08-02T13:20:00Z',
      components: [{ id: 'workers', name: 'Workers API' }, { id: 'iad', name: 'US-East' }],
      incident_updates: [
        { status: 'investigating', body: 'US customers are experiencing failed requests.', created_at: '2026-08-02T12:05:00Z' },
        { status: 'monitoring', body: 'A fix has been applied and error rates are recovering.', created_at: '2026-08-02T13:20:00Z' }
      ]
    },
    {
      id: 'resolved-1',
      name: 'Resolved incident',
      status: 'resolved',
      impact: 'major',
      created_at: '2026-08-02T09:00:00Z',
      updated_at: '2026-08-02T10:00:00Z',
      components: [{ id: 'api', name: 'API' }],
      incident_updates: [{ status: 'resolved', body: 'Resolved.', created_at: '2026-08-02T10:00:00Z' }]
    }
  ],
  scheduled_maintenances: [{ id: 'maintenance-1', name: 'US maintenance', status: 'in_progress' }]
};

const githubStatusFixture = {
  page: { id: 'github-status', name: 'GitHub', url: 'https://www.githubstatus.com/' },
  status: { indicator: 'major', description: 'Major Service Outage' },
  components: [
    { id: 'actions', name: 'Actions', status: 'partial_outage' },
    { id: 'pages', name: 'GitHub Pages', status: 'degraded_performance' },
    { id: 'git', name: 'Git Operations', status: 'operational' }
  ],
  incidents: [
    {
      id: 'github-actions-pages',
      name: 'Incident with GitHub Actions and GitHub Pages',
      status: 'investigating',
      impact: 'major',
      shortlink: 'https://www.githubstatus.com/incidents/example',
      created_at: '2026-08-02T14:00:00Z',
      updated_at: '2026-08-02T14:22:00Z',
      components: [
        { id: 'actions', name: 'Actions' },
        { id: 'pages', name: 'GitHub Pages' }
      ],
      incident_updates: [
        {
          status: 'investigating',
          body: 'We are investigating delayed Actions jobs and GitHub Pages deployments.',
          created_at: '2026-08-02T14:22:00Z'
        }
      ]
    }
  ],
  scheduled_maintenances: []
};

test('Statuspage JSON retains lifecycle, components, timestamps, and US scope', () => {
  const conclusion = parseStatuspageSummary(JSON.stringify(statuspageFixture), { id: 'cloudflare', name: 'Cloudflare' }, { regionScope: 'us' });
  assert.equal(conclusion.kind, 'issues');
  assert.equal(conclusion.incidents.length, 1);
  assert.equal(conclusion.incidents[0].id, 'us-1');
  assert.equal(conclusion.incidents[0].title, 'Workers API errors in US-East');
  assert.equal(conclusion.incidents[0].status, 'monitoring');
  assert.equal(conclusion.incidents[0].firstDetected, '2026-08-02T12:00:00Z');
  assert.equal(conclusion.incidents[0].latestUpdate, '2026-08-02T13:20:00Z');
  assert.equal(conclusion.incidents[0].affectedService, 'Workers API, US-East');
  assert.match(conclusion.incidents[0].note, /error rates are recovering/i);
  assert.equal(conclusion.incidents[0].color, 'red');
});

test('GitHub Status JSON preserves Actions and Pages incident evidence', () => {
  const source = structuredSourceOverrides.github;
  const conclusion = parseStatuspageSummary(JSON.stringify(githubStatusFixture), { id: 'github', name: 'GitHub' }, source);
  assert.equal(source.mode, 'statuspage-json');
  assert.equal(source.url, 'https://www.githubstatus.com/api/v2/summary.json');
  assert.equal(conclusion.kind, 'issues');
  assert.equal(conclusion.incidents.length, 1);
  assert.equal(conclusion.incidents[0].id, 'github-actions-pages');
  assert.equal(conclusion.incidents[0].title, 'Incident with GitHub Actions and GitHub Pages');
  assert.equal(conclusion.incidents[0].affectedService, 'Actions, GitHub Pages');
  assert.equal(conclusion.incidents[0].firstDetected, '2026-08-02T14:00:00Z');
  assert.equal(conclusion.incidents[0].latestUpdate, '2026-08-02T14:22:00Z');
  assert.match(conclusion.incidents[0].note, /delayed Actions jobs and GitHub Pages deployments/i);
  assert.equal(conclusion.incidents[0].color, 'red');
  assert.equal(conclusion.components.find(component => component.name === 'Actions')?.status, 'partial_outage');
  assert.equal(conclusion.components.find(component => component.name === 'GitHub Pages')?.status, 'degraded_performance');
});

test('Statuspage JSON confirms healthy only from an explicit none indicator', () => {
  const healthy = parseStatuspageSummary(JSON.stringify({
    page: { url: 'https://status.example.com/' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    incidents: [],
    scheduled_maintenances: []
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(healthy.kind, 'healthy');
  assert.match(healthy.status, /All Systems Operational/);

  const inconclusive = parseStatuspageSummary(JSON.stringify({
    page: { url: 'https://status.example.com/' },
    status: { indicator: 'major', description: 'Major Service Outage' },
    incidents: [],
    scheduled_maintenances: []
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(inconclusive, null);
});

const betterStackFixture = {
  data: {
    id: 'page-1',
    type: 'status_page',
    attributes: { company_name: 'SuperOps', aggregate_state: 'degraded' }
  },
  included: [
    { id: 'resource-us', type: 'status_page_resource', attributes: { public_name: 'US API', status: 'degraded' } },
    { id: 'resource-eu', type: 'status_page_resource', attributes: { public_name: 'EU API', status: 'degraded' } },
    {
      id: 'report-us',
      type: 'status_report',
      attributes: {
        title: 'US API request failures',
        report_type: 'manual',
        starts_at: '2026-08-02T12:00:00Z',
        ends_at: null,
        aggregate_state: 'degraded',
        affected_resources: [{ status_page_resource_id: 'resource-us', status: 'degraded' }]
      },
      relationships: { status_updates: { data: [{ id: 'update-1', type: 'status_update' }, { id: 'update-2', type: 'status_update' }] } }
    },
    {
      id: 'report-maintenance',
      type: 'status_report',
      attributes: {
        title: 'Scheduled database maintenance',
        report_type: 'maintenance',
        starts_at: '2026-08-02T15:00:00Z',
        ends_at: null,
        aggregate_state: 'downtime',
        affected_resources: [{ status_page_resource_id: 'resource-eu', status: 'maintenance' }]
      },
      relationships: { status_updates: { data: [] } }
    },
    {
      id: 'update-1',
      type: 'status_update',
      attributes: {
        message: 'Investigating elevated API errors for US customers.',
        published_at: '2026-08-02T12:05:00Z',
        affected_resources: [{ status_page_resource_id: 'resource-us', status: 'degraded' }]
      }
    },
    {
      id: 'update-2',
      type: 'status_update',
      attributes: {
        message: 'The mitigation is reducing failed requests.',
        published_at: '2026-08-02T13:10:00Z',
        affected_resources: [{ status_page_resource_id: 'resource-us', status: 'degraded' }]
      }
    }
  ]
};

test('Better Stack JSON separates maintenance and preserves report details', () => {
  const conclusion = parseBetterStackIndex(JSON.stringify(betterStackFixture), { id: 'superops', name: 'SuperOps' }, { regionScope: 'us', pageUrl: 'https://status.superops.com/' });
  assert.equal(conclusion.kind, 'issues');
  assert.equal(conclusion.incidents.length, 1);
  assert.equal(conclusion.incidents[0].id, 'report-us');
  assert.equal(conclusion.incidents[0].title, 'US API request failures');
  assert.equal(conclusion.incidents[0].firstDetected, '2026-08-02T12:00:00Z');
  assert.equal(conclusion.incidents[0].latestUpdate, '2026-08-02T13:10:00Z');
  assert.equal(conclusion.incidents[0].affectedService, 'US API');
  assert.match(conclusion.incidents[0].note, /mitigation/i);
});

test('Better Stack JSON uses aggregate operational state only when no report is active', () => {
  const healthy = parseBetterStackIndex(JSON.stringify({
    data: { id: 'page', type: 'status_page', attributes: { company_name: 'Example', aggregate_state: 'operational' } },
    included: [{ id: 'resource', type: 'status_page_resource', attributes: { public_name: 'API', status: 'operational' } }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(healthy.kind, 'healthy');
});

test('Status.io page parser exposes title, lifecycle, components, locations, and update time', () => {
  const fixture = `<main>
    <h2>Active Incident</h2>
    <p>Updated a few seconds ago</p>
    <h3>Delayed SIEM Alerting</h3>
    <p>Degraded Performance</p>
    <p>Components</p><p>SIEM</p>
    <p>Locations</p><p>All Regions</p>
    <p>August 2, 2026 8:36AM EDT</p>
    <p>Monitoring</p>
    <p>We resolved the cause and are monitoring delayed alerts while normal delivery is restored.</p>
    <h2>Scheduled Maintenance</h2>
    <p>Database maintenance</p>
  </main>`;
  const conclusion = parseStatusioPage(fixture, { id: 'connectwise', name: 'ConnectWise' }, { regionScope: 'us', url: 'https://status.connectwise.com/' });
  assert.equal(conclusion.kind, 'issues');
  assert.equal(conclusion.incidents.length, 1);
  assert.equal(conclusion.incidents[0].title, 'Delayed SIEM Alerting');
  assert.match(conclusion.incidents[0].affectedService, /SIEM|All Regions/);
  assert.match(conclusion.incidents[0].latestUpdate, /^2026-08-02T/);
});

test('Status.io page parser hides non-US-only incidents and ignores scheduled maintenance', () => {
  const fixture = `<main>
    <h2>Active Incident</h2>
    <h3>HaloPSA login failures</h3>
    <p>Degraded Performance</p>
    <p>Components</p><p>HaloPSA</p>
    <p>Locations</p><p>United Kingdom</p>
    <p>August 2, 2026 8:00AM UTC</p>
    <p>Investigating</p><p>UK customers are affected.</p>
    <h2>Scheduled Maintenance</h2>
    <p>US maintenance window</p>
  </main>`;
  const conclusion = parseStatusioPage(fixture, { id: 'halopsa', name: 'HaloPSA' }, { regionScope: 'us', url: 'https://status.haloservicesolutions.com/' });
  assert.equal(conclusion.kind, 'healthy');
  assert.match(conclusion.status, /no active US-relevant incidents/i);
});

test('structured overrides prefer official first-party JSON and rendered Status.io pages', () => {
  assert.equal(structuredSourceOverrides.cloudflare.mode, 'statuspage-json');
  assert.equal(structuredSourceOverrides.cloudflare.url, 'https://www.cloudflarestatus.com/api/v2/summary.json');
  assert.equal(structuredSourceOverrides.github.mode, 'statuspage-json');
  assert.equal(structuredSourceOverrides.github.url, 'https://www.githubstatus.com/api/v2/summary.json');
  assert.equal(structuredSourceOverrides.superops.mode, 'betterstack-json');
  assert.equal(structuredSourceOverrides.superops.url, 'https://status.superops.com/index.json');
  assert.equal(structuredSourceOverrides.connectwise.mode, 'statusio-html');
  assert.equal(structuredSourceOverrides.connectwise.render, true);
  assert.equal(structuredSourceOverrides.halopsa.mode, 'statusio-html');
  assert.equal(structuredSourceOverrides.halopsa.render, true);
});

test('loadPublicProvider publishes structured Statuspage incident details', async () => {
  globalThis.fetch = async url => String(url).endsWith('/api/v2/summary.json')
    ? response(JSON.stringify(statuspageFixture))
    : response('Not found', 404, 'text/plain');

  const provider = {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'Cloud Services',
    priority: 95,
    sourceType: 'statuspage',
    url: 'https://www.cloudflarestatus.com/api/v2/summary.json'
  };
  const source = resolvePublicSource(provider);
  const result = await loadPublicProvider(provider);

  assert.equal(source.mode, 'statuspage-json');
  assert.equal(result.source_type, 'statuspage-json');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].title, 'Workers API errors in US-East');
  assert.equal(result.incidents[0].affected_service, 'Workers API, US-East');
  assert.equal(result.incidents[0].status, 'monitoring');
  assert.equal(result.incidents[0].url, 'https://stspg.io/us-1');
});

test('loadPublicProvider publishes GitHub Actions and Pages incidents', async () => {
  globalThis.fetch = async url => String(url) === 'https://www.githubstatus.com/api/v2/summary.json'
    ? response(JSON.stringify(githubStatusFixture))
    : response('Not found', 404, 'text/plain');

  const provider = {
    id: 'github',
    name: 'GitHub',
    category: 'DevOps',
    priority: 90,
    sourceType: 'statuspage',
    url: 'https://www.githubstatus.com/api/v2/summary.json'
  };
  const source = resolvePublicSource(provider);
  const result = await loadPublicProvider(provider);

  assert.equal(source.mode, 'statuspage-json');
  assert.equal(result.source_type, 'statuspage-json');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].title, 'Incident with GitHub Actions and GitHub Pages');
  assert.equal(result.incidents[0].affected_service, 'Actions, GitHub Pages');
  assert.equal(result.incidents[0].status, 'investigating');
  assert.equal(result.incidents[0].url, 'https://www.githubstatus.com/incidents/example');
});
