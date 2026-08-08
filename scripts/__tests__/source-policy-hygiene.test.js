import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('provider catalog names the current source technology and endpoint for repaired providers', () => {
  const catalog = JSON.parse(read('config/providers.json'));
  const byId = id => catalog.find(provider => provider.id === id);

  assert.deepEqual(
    [byId('lastpass').sourceType, byId('lastpass').url],
    ['rootly-json', 'https://status.lastpass.com/api/v1/status.json']
  );
  assert.deepEqual(
    [byId('8x8').sourceType, byId('8x8').url],
    ['statuscast-json', 'https://8x8status.status.page/summary.json']
  );
  assert.deepEqual(
    [byId('proofpoint').sourceType, byId('proofpoint').url],
    ['rendered-official', 'https://proofpoint.my.site.com/community/s/proofpoint-current-incidents']
  );
  assert.deepEqual(
    [byId('backblaze').sourceType, byId('backblaze').url],
    ['firehydrant-json', 'https://status.backblaze.com/data/payload.json']
  );
  assert.deepEqual(
    [byId('crowdstrike').sourceType, byId('crowdstrike').url],
    ['authenticated-status-reference', 'https://www.crowdstrike.com/en-us/contact-us/']
  );
  assert.deepEqual(
    [byId('intermedia').sourceType, byId('intermedia').url],
    ['authenticated-status-reference', 'https://support.intermedia.com/']
  );
});

test('retired source aliases cannot return through lower-precedence provider maps', () => {
  const activePolicy = [
    read('config/providers.json'),
    read('scripts/structured-source-adapters.mjs'),
    read('scripts/public-source-repairs.mjs'),
    read('scripts/update-public-status.mjs')
  ].join('\n');

  for (const retired of [
    'https://status.crowdstrike.com/',
    'https://status.proofpoint.com/',
    'https://status.intermedia.net/',
    'https://status.lastpass.com/api/v2/summary.json'
  ]) {
    assert.equal(activePolicy.includes(retired), false, `${retired} must stay retired`);
  }
});

test('temporary autonomous patch workflows and scripts never ship', () => {
  for (const relativePath of [
    '.github/workflows/source-diagnostic.yml',
    '.github/workflows/apply-full-review-integration.yml',
    '.github/workflows/apply-full-review-compat.yml',
    '.github/workflows/apply-source-policy-hygiene.yml',
    'scripts/apply-full-review-integration.mjs',
    'scripts/apply-full-review-compat.mjs',
    'scripts/apply-source-policy-hygiene.mjs'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} must not ship`);
  }
});
