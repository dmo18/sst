import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const updatePublic = fs.readFileSync(new URL('../update-public-status.mjs', import.meta.url), 'utf8');
const updateStatus = fs.readFileSync(new URL('../update-status.mjs', import.meta.url), 'utf8');
const legacy = fs.readFileSync(new URL('../legacy-update-status.mjs', import.meta.url), 'utf8');

test('production collector reaches only the extracted status core through update-status shim', () => {
  assert.match(updatePublic, /from '\.\/update-status\.mjs'/);
  assert.equal(updateStatus.trim(), "export * from './status-core.mjs';");
  assert.match(legacy, /export async function parseStatuspage/);
  assert.doesNotMatch(updateStatus, /parseStatuspage|parseRss|parseLimitedMicrosoft/);
});
