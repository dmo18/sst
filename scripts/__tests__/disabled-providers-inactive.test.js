import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACTIVE_PROVIDER_CATALOG, ACTIVE_PROVIDER_IDS, ENABLED_PROVIDER_IDS } from '../../src/providerCatalog.ts';
import { canonicalizeProviderCatalog } from '../update-public-status.mjs';

const read = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

test('only the 41 enabled consolidated providers participate in SST operations', () => {
  const raw = JSON.parse(read('config/providers.json'));
  const consolidated = JSON.parse(read('config/provider-consolidation.json'));
  const providers = canonicalizeProviderCatalog(raw, consolidated);
  assert.equal(raw.length, 80);
  assert.equal(providers.length, 41);
  assert.ok(providers.every(provider => provider.enabled !== false));
  assert.deepEqual(providers.map(provider => provider.id), ACTIVE_PROVIDER_IDS);
  assert.deepEqual(providers.map(provider => provider.id), ENABLED_PROVIDER_IDS);
  assert.deepEqual(providers.map(provider => provider.id), ACTIVE_PROVIDER_CATALOG.map(provider => provider.id));
  assert.ok(!providers.some(provider => provider.id === 'aws' || provider.id === 'notion' || provider.id === 'zoom-disabled'));
});

test('collector history and favicon builder explicitly exclude disabled work', () => {
  const collector = read('scripts/update-public-status.mjs');
  const favicon = read('scripts/sync-provider-favicons.mjs');
  const normalizer = read('scripts/ensure-valid-status.mjs');
  const workflow = read('.github/workflows/refresh-pages.yml');
  assert.match(collector, /\.filter\(provider => provider\.enabled !== false\)/);
  assert.match(collector, /collectWithBudgets\(catalog, resolvePublicSource, loadPublicProvider, collectionLimits\)/);
  assert.match(collector, /ids\.has\(change\.provider_id\)/);
  assert.match(favicon, /settings\.providers\.filter\(id => byId\.has\(id\)\)/);
  assert.match(normalizer, /activeIds\.has\(change\.provider_id\)/);
  assert.match(workflow, /name: Remove internal prior snapshot before publication/);
  assert.match(read('.github/workflows/test.yml'), /name: Inspect all 41 enabled vendors through live official collection/);
  assert.doesNotMatch(workflow, /cp public\/previous-status\.json dist\/previous-status\.json/);
});
