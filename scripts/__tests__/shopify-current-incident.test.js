import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShopifyStatusPage, providerSpecificConclusion } from '../public-source-adapter-implementation.mjs';

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
  assert.equal(result.color, 'red');
});

test('Shopify provider conclusion preserves the vendor incident title and current-page provenance', () => {
  const result = providerSpecificConclusion(provider, currentIncidentHtml);
  assert.equal(result.kind, 'issue');
  assert.equal(result.title, 'Live support unavailable for merchants');
  assert.equal(result.evidenceBasis, 'current-page');
  assert.match(result.id, /^current-page-/);
});

test('Shopify does not infer an incident from legend wording without a current incident link', () => {
  const result = parseShopifyStatusPage('<main>Operational Degraded Performance Partial Outage Major Outage Maintenance</main>');
  assert.equal(result, null);
});
