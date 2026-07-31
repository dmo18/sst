import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBetterStackIndex, parseStatuspageSummary } from '../structured-source-adapters.mjs';
import { maintenanceFeedEntries } from '../update-public-status.mjs';

test('Statuspage JSON publishes scheduled maintenance separately from incidents', () => {
  const conclusion = parseStatuspageSummary(JSON.stringify({
    page: { url: 'https://status.example.com/' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [{ id: 'api', name: 'US API', status: 'operational' }],
    incidents: [],
    scheduled_maintenances: [{
      id: 'maint-1',
      name: 'US API database maintenance',
      status: 'scheduled',
      scheduled_for: '2026-08-02T04:00:00Z',
      scheduled_until: '2026-08-02T05:00:00Z',
      updated_at: '2026-07-31T12:00:00Z',
      components: [{ id: 'api', name: 'US API' }],
      incident_updates: [{ status: 'scheduled', body: 'Brief API interruptions may occur.', created_at: '2026-07-31T12:00:00Z' }]
    }]
  }), { id: 'example', name: 'Example' }, { regionScope: 'us', pageUrl: 'https://status.example.com/' });

  assert.equal(conclusion.kind, 'healthy');
  assert.equal(conclusion.incidents?.length || 0, 0);
  assert.equal(conclusion.maintenance.length, 1);
  assert.equal(conclusion.maintenance[0].id, 'maint-1');
  assert.equal(conclusion.maintenance[0].affectedService, 'US API');
  assert.equal(conclusion.maintenance[0].startsAt, '2026-08-02T04:00:00Z');
  assert.equal(conclusion.components[0].name, 'US API');
});

test('Better Stack maintenance remains separate while operational status stays healthy', () => {
  const conclusion = parseBetterStackIndex(JSON.stringify({
    data: { id: 'page', type: 'status_page', attributes: { company_name: 'Example', aggregate_state: 'maintenance' } },
    included: [
      { id: 'resource', type: 'status_page_resource', attributes: { public_name: 'US Portal', status: 'maintenance' } },
      {
        id: 'maintenance', type: 'status_report',
        attributes: {
          title: 'US Portal maintenance', report_type: 'maintenance', aggregate_state: 'maintenance',
          starts_at: '2026-08-03T03:00:00Z', ends_at: '2026-08-03T04:00:00Z',
          affected_resources: [{ status_page_resource_id: 'resource', status: 'maintenance' }]
        },
        relationships: { status_updates: { data: [{ id: 'update', type: 'status_update' }] } }
      },
      { id: 'update', type: 'status_update', attributes: { message: 'Maintenance is scheduled.', published_at: '2026-07-31T13:00:00Z' } }
    ]
  }), { id: 'example', name: 'Example' }, { regionScope: 'us', pageUrl: 'https://status.example.com/' });

  assert.equal(conclusion.kind, 'healthy');
  assert.equal(conclusion.maintenance.length, 1);
  assert.equal(conclusion.maintenance[0].status, 'scheduled');
  assert.equal(conclusion.maintenance[0].affectedService, 'US Portal');
});

test('feed maintenance classification excludes escalated incidents and completed work', () => {
  const entries = [
    { title: 'Scheduled maintenance', note: 'Planned database work for US customers.', status: 'scheduled', time: '2026-07-31T12:00:00Z' },
    { title: 'Emergency maintenance incident', note: 'Customers are currently unable to connect.', status: 'investigating', time: '2026-07-31T12:00:00Z' },
    { title: 'Scheduled maintenance completed', note: 'Work has completed.', status: 'completed', time: '2026-07-31T12:00:00Z' }
  ];
  const result = maintenanceFeedEntries(entries, 720, Date.parse('2026-07-31T17:00:00Z'));
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Scheduled maintenance');
});
