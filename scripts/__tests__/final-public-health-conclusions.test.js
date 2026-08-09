import test from 'node:test';
import assert from 'node:assert/strict';
import { fullReviewConclusion, fullReviewOverrides, parsePayPalProductionStatus } from '../full-review-source-adapters.mjs';
import { resolvePublicSource } from '../update-public-status.mjs';

const provider = (id, name) => ({ id, name, category: 'Payments', priority: 100, sourceType: 'statuspage', url: 'https://invalid.example' });

test('Stripe resolves to the current official Statuspage JSON host', () => {
  const source = resolvePublicSource(provider('stripe', 'Stripe'));
  assert.equal(source.mode, 'statuspage-json');
  assert.equal(source.url, 'https://www.stripestatus.com/api/v2/summary.json');
  assert.equal(source.pageUrl, 'https://www.stripestatus.com/');
  assert.equal(source.regionScope, 'global');
});

test('Stripe current operational summary becomes explicit service health', () => {
  const result = fullReviewConclusion(provider('stripe', 'Stripe'), JSON.stringify({
    page: { id: 'stripe', name: 'Stripe', url: 'https://www.stripestatus.com' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [
      { id: 'api', name: 'Stripe API', status: 'operational' },
      { id: 'payments', name: 'Global payments', status: 'operational' }
    ],
    incidents: [],
    scheduled_maintenances: []
  }));
  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All Systems Operational');
});

test('Stripe current incident remains structured issue evidence', () => {
  const result = fullReviewConclusion(provider('stripe', 'Stripe'), JSON.stringify({
    page: { id: 'stripe', name: 'Stripe', url: 'https://www.stripestatus.com' },
    status: { indicator: 'minor', description: 'Partial System Outage' },
    components: [{ id: 'api', name: 'Stripe API', status: 'partial_outage' }],
    incidents: [{
      id: 'incident-1',
      name: 'Stripe API elevated errors',
      status: 'investigating',
      impact: 'major',
      created_at: '2026-08-02T11:30:00Z',
      updated_at: '2026-08-02T12:20:00Z',
      incident_updates: [{
        status: 'investigating',
        body: 'We are investigating elevated API errors.',
        created_at: '2026-08-02T12:20:00Z'
      }],
      components: [{ name: 'Stripe API' }]
    }],
    scheduled_maintenances: []
  }));
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.match(result.incidents[0].title, /Stripe API elevated errors/);
});

test('PayPal resolves to the rendered official production page', () => {
  const source = resolvePublicSource(provider('paypal', 'PayPal'));
  assert.equal(source.mode, 'status-html');
  assert.equal(source.url, 'https://www.paypal-status.com/product/production');
  assert.equal(source.render, true);
  assert.equal(source.discoverFeeds, false);
});

test('PayPal explicit production aggregate confirms operational service', () => {
  const result = parsePayPalProductionStatus(`
    <main>
      <h1>PayPal Status Page</h1>
      <nav>Production Sandbox</nav>
      <h2>All Production Systems Operational</h2>
      <section>Operational Production Sandbox Services APIs PayPal Enterprise Solutions</section>
      <footer>Operational Major Outage Degraded Performance Maintenance Bulletin View history</footer>
    </main>
  `);
  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All Production Systems Operational');
});

test('PayPal legend wording alone can never fabricate an outage', () => {
  const result = parsePayPalProductionStatus(`
    <main>
      <h1>PayPal Status Page</h1>
      <nav>Production Sandbox</nav>
      <section>Production Sandbox Services APIs PayPal 20 Services Enterprise Solutions 9 Services Operational Major Outage Degraded Performance Maintenance Bulletin View history</section>
    </main>
  `);
  assert.equal(result.kind, 'limited');
});

test('PayPal explicit current production degradation remains service impact', () => {
  const result = parsePayPalProductionStatus(`
    <main>
      <h1>PayPal Status Page</h1>
      <nav>Production Sandbox</nav>
      <section>Production Sandbox Services APIs PayPal Degraded Performance Checkout users are experiencing elevated errors Operational Major Outage Degraded Performance Maintenance Bulletin View history</section>
    </main>
  `);
  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.match(result.message, /Degraded Performance/);
});

test('final public health overrides remain first-party and current', () => {
  assert.equal(fullReviewOverrides.stripe.sourceName, 'Stripe official Statuspage JSON');
  assert.equal(fullReviewOverrides.paypal.sourceName, 'PayPal production status page');
});
