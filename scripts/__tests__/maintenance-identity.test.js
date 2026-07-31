import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMaintenanceRecords, makeMaintenance } from '../update-public-status.mjs';
import { summarizeProviders, validatePayload } from '../update-status.mjs';

const provider = {
  id: 'stripe',
  name: 'Stripe',
  category: 'Payments',
  priority: 80,
  services: ['Payments']
};
const source = {
  mode: 'feed',
  url: 'https://status.stripe.com/history.rss',
  pageUrl: 'https://status.stripe.com/',
  sourceName: 'Stripe official feed'
};

function maintenance(overrides = {}) {
  return makeMaintenance(provider, source, {
    title: 'Maintenance for TWINT',
    note: 'Planned maintenance.',
    status: 'scheduled',
    startsAt: '2026-08-01T01:00:00Z',
    endsAt: '2026-08-01T02:00:00Z',
    announcedAt: '2026-07-31T12:00:00Z',
    latestUpdate: '2026-07-31T12:00:00Z',
    url: 'https://status.stripe.com/',
    ...overrides
  });
}

test('same-title recurring maintenance receives date-specific stable IDs', () => {
  const first = maintenance();
  const repeated = maintenance();
  const nextWindow = maintenance({
    startsAt: '2026-08-08T01:00:00Z',
    endsAt: '2026-08-08T02:00:00Z'
  });
  assert.equal(first.id, repeated.id);
  assert.notEqual(first.id, nextWindow.id);
});

test('true duplicate maintenance records merge into one bounded timeline', () => {
  const first = maintenance({ updates: [{ status: 'scheduled', note: 'Announced', at: '2026-07-31T12:00:00Z' }] });
  const updated = maintenance({
    latestUpdate: '2026-07-31T13:00:00Z',
    updates: [{ status: 'scheduled', note: 'Timing confirmed', at: '2026-07-31T13:00:00Z' }]
  });
  const records = dedupeMaintenanceRecords([first, updated]);
  assert.equal(records.length, 1);
  assert.equal(records[0].latest_update, '2026-07-31T13:00:00Z');
  assert.equal(records[0].updates.length, 2);
});

test('server validator rejects duplicate maintenance IDs', () => {
  const providerStatus = {
    id: 'stripe', name: 'Stripe', category: 'Payments', status: 'Operational', color: 'green',
    service_state: 'operational', source_state: 'available', attention: 'informational', ok: true,
    source: 'https://status.stripe.com/', priority: 80
  };
  const item = maintenance();
  const payload = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    providers: [providerStatus],
    incidents: [],
    maintenance: [item, { ...item }],
    changes: [],
    history: [],
    summary: summarizeProviders([providerStatus], [])
  };
  assert.throws(() => validatePayload(payload), /duplicate maintenance/);
});
