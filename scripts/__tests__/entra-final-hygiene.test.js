import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Entra production policy stays on the current Azure public status table', () => {
  const catalog = JSON.parse(read('config/providers.json'));
  const entra = catalog.find(provider => provider.id === 'entra');
  assert.ok(entra);
  assert.equal(entra.sourceType, 'azure-status-html');
  assert.equal(entra.url, 'https://azure.status.microsoft/en-us/status');

  const runtime = read('scripts/update-public-status.mjs');
  assert.match(runtime, /mode:\s*'azure-status-html'/);
  assert.match(runtime, /url:\s*'https:\/\/azure\.status\.microsoft\/en-us\/status'/);
  assert.doesNotMatch(runtime, /rssfeed\.azure\.status\.microsoft\/en-us\/status\/feed/);
  assert.ok(fs.existsSync(path.join(root, 'scripts', 'entra-status-adapter.mjs')));
});

test('temporary Entra diagnostics and autonomous patch tooling never ship', () => {
  for (const relativePath of [
    '.github/workflows/entra-source-probe.yml',
    '.github/workflows/apply-entra-final-reliability.yml',
    '.github/workflows/apply-entra-parser-cleanup.yml',
    '.github/workflows/apply-entra-test-contracts.yml',
    'scripts/apply-entra-final-reliability.mjs',
    'scripts/apply-entra-parser-cleanup.mjs',
    'scripts/apply-entra-test-contracts.mjs'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} must not ship`);
  }
});
