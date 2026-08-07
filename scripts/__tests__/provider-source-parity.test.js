import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicSource } from '../update-public-status.mjs';
import {
  parseBackblazePage,
  parseRingCentralPage,
  parseSalesforcePage,
  parseVultrStatus
} from '../structured-source-adapters.mjs';

const provider = (id, name = id) => ({
  id,
  name,
  category: 'Test',
  priority: 50,
  sourceType: 'html',
  url: `https://invalid.example/${id}`
});

test('provider-specific source policies select the strongest current official source', () => {
  assert.deepEqual(
    ['ringcentral', 'salesforce', 'backblaze', 'vultr'].map(id => {
      const source = resolvePublicSource(provider(id));
      return [id, source.mode, source.url, source.render === true];
    }),
    [
      ['ringcentral', 'ringcentral-html', 'https://status.ringcentral.com/', true],
      ['salesforce', 'salesforce-html', 'https://status.salesforce.com/current', true],
      ['backblaze', 'backblaze-html', 'https://status.backblaze.com/', true],
      ['vultr', 'vultr-json', 'https://status.vultr.com/status.json', false]
    ]
  );
});

test('RingCentral healthy text wins over static incident-status template wording', () => {
  const result = parseRingCentralPage(`
    RingCentral System Status
    Incident status updates
    No issues are being reported at this time.
  `, { id: 'ringcentral', name: 'RingCentral' });

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'RingCentral reports no issues');
});

test('RingCentral explicit customer impact remains a service issue', () => {
  const result = parseRingCentralPage(`
    RingCentral System Status
    A portion of customers may be experiencing intermittent calling failures while we investigate.
  `, { id: 'ringcentral', name: 'RingCentral' });

  assert.equal(result.kind, 'issue');
  assert.equal(result.color, 'amber');
  assert.match(result.note, /intermittent calling failures/i);
});

test('Salesforce current table emits only service-impacting ongoing rows', () => {
  const result = parseSalesforcePage(`
    Current Status
    Incidents
    ID Subject Instances Services Status
    20004131 Feature Degradation CS316, CS317 Core Service Ongoing
    20000257 Security Advisory: Third-Party App Integration Disabled Informational Message - Ongoing
    Recently Viewed Instances
  `, { id: 'salesforce', name: 'Salesforce' });

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].id, '20004131');
  assert.equal(result.incidents[0].title, 'Feature Degradation (20004131)');
  assert.equal(result.incidents[0].url, 'https://status.salesforce.com/incidents/20004131');
});

test('Backblaze explicit current operational state is accepted from the rendered official page', () => {
  const result = parseBackblazePage(`
    Backblaze System Status
    All systems operational. Nothing to report.
    Affected Components Operational Degraded Outage Maintenance
  `, { id: 'backblaze', name: 'Backblaze' });

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'Backblaze reports all systems operational');
});

test('Vultr public JSON preserves current US outages and separates scheduled maintenance', () => {
  const result = parseVultrStatus(JSON.stringify({
    service_alerts: [],
    regions: {
      atl: {
        country: 'US',
        location: 'Atlanta',
        alerts: [
          {
            id: 'incident-1',
            subject: 'Partial Outage',
            status: 'ongoing',
            start_date: '2026-08-02T12:30:00Z',
            entries: [
              { message: 'Intermittent packet loss is affecting some instances.', updated_at: '2026-08-02T13:30:00Z' }
            ]
          },
          {
            id: 'maintenance-1',
            subject: 'Scheduled Maintenance',
            status: 'ongoing',
            start_date: '2026-08-02T12:00:00Z',
            entries: [
              { message: 'Start Time: 2026-08-02 14:00:00 UTC End Time: 2026-08-02 15:00:00 UTC', updated_at: '2026-08-02T12:05:00Z' }
            ]
          }
        ]
      },
      lon: {
        country: 'GB',
        location: 'London',
        alerts: [
          {
            id: 'non-us',
            subject: 'Partial Outage',
            status: 'ongoing',
            start_date: '2026-08-02T12:30:00Z',
            entries: [{ message: 'London impact', updated_at: '2026-08-02T13:30:00Z' }]
          }
        ]
      }
    }
  }), { id: 'vultr', name: 'Vultr' }, { pageUrl: 'https://status.vultr.com/', regionScope: 'us' });

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.match(result.incidents[0].title, /Atlanta/);
  assert.equal(result.maintenance.length, 1);
  assert.equal(result.maintenance[0].startsAt, '2026-08-02T14:00:00.000Z');
  assert.equal(result.maintenance[0].endsAt, '2026-08-02T15:00:00.000Z');
});
