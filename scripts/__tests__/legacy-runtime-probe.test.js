import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('legacy signage verification inspects the running page through CDP', async () => {
  const source = await read('scripts/verify-legacy-wallboard.mjs');

  assert.match(source, /--remote-debugging-port=/);
  assert.match(source, /Runtime\.enable/);
  assert.match(source, /Emulation\.setDeviceMetricsOverride/);
  assert.match(source, /classList\.contains\('no-css-layers'\)/);
  assert.match(source, /document\.querySelector\('\.wallboard-v2, \.wallboard-shell'\)/);
  assert.match(source, /Page\.captureScreenshot/);
  assert.match(source, /horizontalOverflow/);
  assert.match(source, /LEGACY_BROWSER_DIAGNOSTICS/);
  assert.doesNotMatch(source, /--dump-dom/);
});

test('legacy runtime probe keeps the exact signage viewport and compatibility-only sandbox exception', async () => {
  const source = await read('scripts/verify-legacy-wallboard.mjs');

  assert.match(source, /width: 458/);
  assert.match(source, /height: 291/);
  assert.match(source, /contract\.width !== 458 \|\| contract\.height !== 291/);
  assert.match(source, /--no-sandbox/);
  assert.match(source, /STATUS_BASE_URL/);
  assert.match(source, /view=wallboard&alerts=24h/);
});