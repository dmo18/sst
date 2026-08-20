import test from 'node:test';
import assert from 'node:assert/strict';
import { additionalPublicOverrides, parseShopifyStatusPage, providerSpecificConclusion } from '../public-source-adapter-implementation.mjs';

const provider = {
  id: 'shopify',
  name: 'Shopify',
  category: 'Commerce',
  priority: 100,
  sourceType: 'statuspage',
  url: 'https://www.shopifystatus.com/'
};

const currentIncidentHtml = `
  <main>
    <a href="/incidents/abc123">Live support unavailable for merchants</a>
    <div>Identified - We've identified the root cause as an outage at Twilio. Merchants may be unable to connect with a specialist.</div>
    <time>Aug 19, 2026 - 19:34 EDT</time>
    <button>Subscribe to Incident</button>
    <section>Admin Operational Support Major Outage</section>
  </main>
`;

test('Shopify current incident link becomes structured live issue evidence', () => {
  const result = parseShopifyStatusPage(currentIncidentHtml);
  assert.equal(result.kind, 'issue');
  assert.equal(result.title, 'Live support unavailable for merchants');
  assert.match(result.note, /outage at Twilio/);
  assert.equal(result.status, 'Identified');
  assert.equal(result.rawTime, 'Aug 19, 2026 - 19:34 EDT');
  assert.equal(result.color, 'red');
});

test('Shopify provider conclusion preserves the vendor incident title and current-page provenance', () => {
  const result = providerSpecificConclusion(provider, currentIncidentHtml);
  assert.equal(result.kind, 'issue');
  assert.equal(result.title, 'Live support unavailable for merchants');
  assert.equal(result.evidenceBasis, 'current-page');
  assert.match(result.id, /^live-support-unavailable-for-merchants-[a-f0-9]{8}$/);
});

test('Shopify does not infer an incident from legend wording without a current incident link', () => {
  const result = parseShopifyStatusPage('<main>Operational Degraded Performance Partial Outage Major Outage Maintenance</main>');
  assert.equal(result, null);
});

test('Shopify ignores hidden subscribe templates before the visible current incident', () => {
  const result = parseShopifyStatusPage(`
    <template>Subscribe to Incident</template>
    <main>
      <div>Live support unavailable for merchants</div>
      <div>Monitoring - Twilio is deploying a fix and live support connections are recovering.</div>
      <time>Aug <span>19</span> , <span>2026</span> - <span>19</span> : <span>54</span> EDT</time>
      <section>Past Incidents Unresolved incident: Live support unavailable for merchants.</section>
    </main>
  `);
  assert.equal(result.kind, 'issue');
  assert.equal(result.title, 'Live support unavailable for merchants');
  assert.equal(result.status, 'Monitoring');
  assert.equal(result.rawTime, 'Aug 19, 2026 - 19:54 EDT');
  assert.match(result.note, /deploying a fix/);
});

test('Shopify remains limited when a current incident has no vendor timestamp', () => {
  const result = parseShopifyStatusPage(`
    <main>
      <a href="/incidents/abc123">Live support unavailable for merchants</a>
      <div>Monitoring - Live support connections are recovering.</div>
      <button>Subscribe to Incident</button>
    </main>
  `);
  assert.equal(result.kind, 'limited');
  assert.match(result.message, /vendor update timestamp/);
});

test('Shopify production collection uses the official structured Statuspage API', () => {
  assert.equal(additionalPublicOverrides.shopify.mode, 'statuspage-json');
  assert.equal(additionalPublicOverrides.shopify.url, 'https://www.shopifystatus.com/api/v2/summary.json');
  assert.equal(additionalPublicOverrides.shopify.pageUrl, 'https://www.shopifystatus.com/');
});


test('Shopify structured summary is parsed through the structured adapter registry', () => {
  const recent = new Date(Date.now() - 60_000).toISOString();
  const result = providerSpecificConclusion(provider, JSON.stringify({
    page: { url: 'https://www.shopifystatus.com/' },
    status: { indicator: 'major', description: 'Major Service Outage' },
    components: [{ id: 'support', name: 'Support', status: 'major_outage' }],
    incidents: [{
      id: 'shopify-support',
      name: 'Live support unavailable for merchants',
      status: 'investigating',
      impact: 'major',
      created_at: recent,
      updated_at: recent,
      components: [{ id: 'support', name: 'Support', status: 'major_outage' }],
      incident_updates: [{ status: 'investigating', body: 'Shopify is investigating unavailable live support.', created_at: recent }]
    }]
  }));

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].title, 'Live support unavailable for merchants');
  assert.equal(result.incidents[0].color, 'red');
});
