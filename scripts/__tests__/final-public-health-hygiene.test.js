import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('repaired public-health catalog entries use the strongest current official surfaces', () => {
  const catalog = JSON.parse(read('config/providers.json'));
  const byId = id => catalog.find(provider => provider.id === id);
  const paypal = byId('paypal');
  const stripe = byId('stripe');
  const quickBooks = byId('quickbooks-online');
  const auth0 = byId('auth0');
  assert.ok(paypal);
  assert.ok(stripe);
  assert.ok(quickBooks);
  assert.ok(auth0);
  assert.deepEqual([paypal.sourceType, paypal.url], ['rendered-official', 'https://www.paypal-status.com/product/production']);
  assert.deepEqual([stripe.sourceType, stripe.url], ['statuspage', 'https://www.stripestatus.com/api/v2/summary.json']);
  assert.deepEqual([quickBooks.sourceType, quickBooks.url], ['statuspage', 'https://status.quickbooks.intuit.com/api/v2/summary.json']);
  assert.deepEqual([auth0.sourceType, auth0.url], ['auth0-next-data', 'https://status.auth0.com/?environment=Production&region=US']);
});

test('retired and weaker repaired-provider source paths are not production policy', () => {
  const policy = [
    read('config/providers.json'),
    read('scripts/full-review-source-adapters.mjs'),
    read('scripts/structured-source-adapters.mjs'),
    read('scripts/update-public-status.mjs')
  ].join('\n');
  assert.equal(policy.includes('https://status.stripe.com/current/atom.xml'), false);
  assert.equal(policy.includes('https://www.stripestatus.com/history.atom'), false);
  assert.equal(policy.includes("'quickbooks-online': {\n    mode: 'status-html'"), false);
  assert.equal(policy.includes('https://status.quickbooks.intuit.com/history.rss'), false);
  assert.equal(policy.includes('https://status.quickbooks.intuit.com/history.atom'), false);
  assert.equal(policy.includes("mode: 'status-html',\n  url: 'https://status.auth0.com/?environment=Production&region=US'"), false);
});

test('temporary review diagnostics, live probes, and patch tooling never ship', () => {
  for (const relativePath of [
    '.github/workflows/public-health-probe.yml',
    '.github/workflows/apply-final-public-health.yml',
    '.github/workflows/apply-paypal-legend-safety.yml',
    '.github/workflows/apply-deep-review-repairs.yml',
    '.github/workflows/fix-and-apply-deep-review.yml',
    '.github/workflows/apply-last-mile-hardening.yml',
    '.github/workflows/apply-validator-quickbooks-fix.yml',
    '.github/workflows/apply-auth0-next-data.yml',
    '.github/workflows/probe-auth0-quickbooks.yml',
    '.github/workflows/branch-live-acceptance.yml',
    '.github/workflows/apply-final-hygiene-fixes.yml',
    '.github/workflows/apply-production-invariant-audit.yml',
    '.github/workflows/live-production-invariant-audit.yml',
    '.github/workflows/apply-truth-basis-validation.yml',
    '.github/workflows/apply-statuspage-group-scope.yml',
    'scripts/apply-final-public-health.mjs',
    'scripts/apply-paypal-legend-safety.mjs',
    'scripts/apply-deep-review-repairs.mjs',
    'scripts/fix-deep-review-patch.mjs',
    'scripts/apply-last-mile-hardening.mjs',
    'scripts/fix-last-mile-hardening.mjs',
    'scripts/apply-validator-quickbooks-fix.mjs',
    'scripts/apply-auth0-next-data.mjs',
    'scripts/fix-auth0-contract-test.mjs',
    'scripts/apply-final-hygiene-fixes.mjs',
    'scripts/apply-production-invariant-audit.mjs',
    'scripts/apply-truth-basis-validation.mjs',
    'scripts/apply-statuspage-group-scope.mjs'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} must not ship`);
  }
});

test('provider-specific conclusions use the shared region-scope implementation behind the adapter registry', () => {
  const facade = read('scripts/public-source-repairs.mjs');
  const implementation = read('scripts/public-source-repairs-legacy.mjs');
  assert.match(facade, /SourceAdapterRegistry/);
  assert.match(facade, /registry\.conclude\('provider-specific-current-page'/);
  assert.match(implementation, /regionScopeRelevant/);
  assert.equal(implementation.includes('const usRegionPattern'), false);
  assert.equal(implementation.includes('const nonUsRegionPattern'), false);
});
