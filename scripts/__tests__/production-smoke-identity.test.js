import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const smoke = fs.readFileSync(new URL('../production-smoke.mjs', import.meta.url), 'utf8');

test('deployed index and production smoke share the ServiceOps enterprise identity', () => {
  assert.match(index, /<title>ServiceOps \| MSP Service Intelligence<\/title>/i);
  assert.match(smoke, /ServiceOps \\?\| MSP Service Intelligence/);
  assert.doesNotMatch(smoke, /MSP Operations Command Center/);
});
