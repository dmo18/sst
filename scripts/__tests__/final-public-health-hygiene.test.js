import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PayPal and Stripe catalog entries use current official health surfaces', () => {
  const catalog = JSON.parse(read('config/providers.json'));
  const paypal = catalog.find(provider => provider.id === 'paypal');
  const stripe = catalog.find(provider => provider.id === 'stripe');
  assert.ok(paypal);
  assert.ok(stripe);
  assert.deepEqual([paypal.sourceType, paypal.url], ['rendered-official', 'https://www.paypal-status.com/product/production']);
  assert.deepEqual([stripe.sourceType, stripe.url], ['statuspage', 'https://www.stripestatus.com/api/v2/summary.json']);
});

test('retired Stripe history feed is not a production source policy path', () => {
  const policy = [read('config/providers.json'), read('scripts/full-review-source-adapters.mjs'), read('scripts/update-public-status.mjs')].join('\n');
  assert.equal(policy.includes('https://status.stripe.com/current/atom.xml'), false);
  assert.equal(policy.includes('https://www.stripestatus.com/history.atom'), false);
});

test('temporary review diagnostics and patch tooling never ship', () => {
  for (const relativePath of [
    '.github/workflows/public-health-probe.yml',
    '.github/workflows/apply-final-public-health.yml',
    '.github/workflows/apply-paypal-legend-safety.yml',
    '.github/workflows/apply-deep-review-repairs.yml',
    '.github/workflows/fix-and-apply-deep-review.yml',
    'scripts/apply-final-public-health.mjs',
    'scripts/apply-paypal-legend-safety.mjs',
    'scripts/apply-deep-review-repairs.mjs',
    'scripts/fix-deep-review-patch.mjs'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} must not ship`);
  }
});
