import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicSource } from '../update-public-status.mjs';
import { parseStatusioJson, structuredSourceOverrides } from '../structured-source-adapters.mjs';

const provider = (id, name = id) => ({
  id,
  name,
  category: 'Test',
  priority: 50,
  sourceType: 'statuspage',
  url: `https://invalid.example/${id}`
});

test('current first-party structured endpoints replace retired aliases', () => {
  assert.equal(structuredSourceOverrides.notion.url, 'https://www.notion-status.com/api/v2/summary.json');
  assert.equal(structuredSourceOverrides.vercel.url, 'https://www.vercel-status.com/api/v2/summary.json');

  const notion = resolvePublicSource(provider('notion', 'Notion'));
  const vercel = resolvePublicSource(provider('vercel', 'Vercel'));
  assert.equal(notion.mode, 'statuspage-json');
  assert.equal(notion.url, 'https://www.notion-status.com/api/v2/summary.json');
  assert.equal(vercel.mode, 'statuspage-json');
  assert.equal(vercel.url, 'https://www.vercel-status.com/api/v2/summary.json');
});

test('Auth0 uses its current official server-rendered Public Cloud status snapshot instead of browser fallback or a retired Statuspage API path', () => {
  const source = resolvePublicSource(provider('auth0', 'Auth0'));
  assert.equal(source.mode, 'auth0-next-data');
  assert.equal(source.url, 'https://status.auth0.com/?environment=Production&region=US');
  assert.equal(source.pageUrl, 'https://status.auth0.com/');
  assert.equal(source.render, false);
  assert.equal(source.discoverFeeds, false);
  assert.equal(source.regionScope, 'us');
});

test('Mimecast and UltraDNS use their documented first-party Status.io JSON endpoints', () => {
  const mimecast = resolvePublicSource(provider('mimecast', 'Mimecast'));
  const ultradns = resolvePublicSource(provider('ultradns', 'UltraDNS'));

  assert.equal(mimecast.mode, 'statusio-json');
  assert.equal(mimecast.url, 'https://9498199887151372.hostedstatus.com/1.0/status/5d849b1c02e65b3ec45369d4');
  assert.equal(mimecast.pageUrl, 'https://status.mimecast.com/');
  assert.equal(ultradns.mode, 'statusio-json');
  assert.equal(ultradns.url, 'https://1545563159838271.hostedstatus.com/1.0/status/5f80d63ea1c48e04c1dfa100');
  assert.equal(ultradns.pageUrl, 'https://status.ultradns.com/');
});

test('Status.io JSON reports healthy current state and component evidence', () => {
  const fixture = {
    result: {
      status_overall: {
        updated: '2026-08-02T13:30:00Z',
        status: 'Operational',
        status_code: 100
      },
      status: [
        {
          id: 'north-america',
          name: 'North America',
          containers: [
            { id: 'api', name: 'API', status: 'Operational', status_code: 100 },
            { id: 'admin', name: 'Admin Console', status: 'Operational', status_code: 100 }
          ]
        }
      ],
      maintenance: { active: [], upcoming: [] },
      incidents: []
    }
  };

  const result = parseStatusioJson(JSON.stringify(fixture), { id: 'vendor', name: 'Vendor' }, { regionScope: 'us' });
  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'Operational');
  assert.equal(result.components.length, 2);
  assert.deepEqual(result.components.map(item => item.status), ['operational', 'operational']);
});

test('Status.io JSON preserves a current incident as specific structured evidence', () => {
  const fixture = {
    result: {
      status_overall: { status: 'Service Disruption', status_code: 300 },
      status: [
        {
          id: 'north-america',
          name: 'North America',
          containers: [
            { id: 'mail', name: 'Mail Processing', status: 'Degraded Performance', status_code: 200 }
          ]
        }
      ],
      maintenance: { active: [], upcoming: [] },
      incidents: [
        {
          id: 'incident-1',
          name: 'US mail processing delays',
          status: 'Investigating',
          created_at: '2026-08-02T12:30:00Z',
          updated_at: '2026-08-02T13:30:00Z',
          details: 'Customers in the United States may see delayed mail processing.',
          components: [{ name: 'Mail Processing' }],
          messages: [
            {
              status: 'Investigating',
              details: 'Engineering is investigating delayed processing for US customers.',
              datetime: '2026-08-02T13:30:00Z'
            }
          ]
        }
      ]
    }
  };

  const result = parseStatusioJson(JSON.stringify(fixture), { id: 'vendor', name: 'Vendor' }, { regionScope: 'us' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].title, 'US mail processing delays');
  assert.equal(result.incidents[0].latestUpdate, '2026-08-02T13:30:00Z');
  assert.match(result.incidents[0].affectedService, /Mail Processing/);
});
