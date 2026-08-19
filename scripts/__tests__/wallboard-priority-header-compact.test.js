import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('compact priority header override loads after wallboard presentation styles', async () => {
  const main = await read('src/main.tsx');
  assert.match(
    main,
    /styles\/wallboard-v2\.css[\s\S]*styles\/wallboard-tv\.css[\s\S]*styles\/wallboard-header-compact\.css/
  );
});

test('priority signals label matches freshness telemetry scale and saves vertical space', async () => {
  const css = await read('src/styles/wallboard-header-compact.css');

  assert.match(css, /wallboard-priority-v2 > h2\s*\{[\s\S]*min-height:\s*28px\s*!important/);
  assert.match(css, /wallboard-priority-v2 > h2\s*\{[\s\S]*font-size:\s*9px\s*!important/);
  assert.match(css, /wallboard-priority-v2 > h2 > span:first-child\s*\{[\s\S]*font-size:\s*9px\s*!important/);
  assert.match(css, /wallboard-mini-telemetry\s*\{[\s\S]*font-size:\s*9px\s*!important/);
  assert.match(css, /grid-template-rows:\s*28px 46px minmax\(0, 1fr\)\s*!important/);
});

test('458x291 signage composition remains provider-first', async () => {
  const css = await read('src/styles/wallboard-header-compact.css');

  assert.match(css, /@media \(max-width: 520px\) and \(max-height: 360px\)/);
  assert.match(css, /grid-template-rows:\s*40px minmax\(0, 1fr\)\s*!important/);
  assert.match(css, /wallboard-priority-v2 > h2 > span:first-child\s*\{[\s\S]*clip:\s*rect\(0 0 0 0\)\s*!important/);
});
