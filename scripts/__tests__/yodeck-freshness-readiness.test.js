import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Yodeck verifier cannot accept an initial empty layout before freshness data arrives', async () => {
  const verifier = await read('scripts/verify-yodeck-wallboard.mjs');
  assert.match(verifier, /updatedAt: shell\?\.getAttribute\('data-wallboard-updated-at'\)/);
  assert.match(verifier, /browserCheckedAt: shell\?\.getAttribute\('data-wallboard-browser-checked-at'\)/);
  assert.match(verifier, /const layoutResolved = last\?\.state === 'pass' \|\| last\?\.state === 'fail'/);
  assert.match(verifier, /const freshnessReady = Boolean\(last\?\.updatedAt && last\?\.browserCheckedAt && last\?\.refreshMs >= 15_000\)/);
  assert.match(verifier, /if \(layoutResolved && freshnessReady\) return last/);
  assert.match(verifier, /Yodeck layout\/freshness probe timed out/);
  assert.match(verifier, /YODECK_READINESS updated=/);
});
