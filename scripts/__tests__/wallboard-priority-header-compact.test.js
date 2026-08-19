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

test('458x291 signage keeps Priority signals inline with freshness telemetry', async () => {
  const css = await read('src/styles/wallboard-header-compact.css');

  assert.match(css, /@media \(max-width: 520px\) and \(max-height: 360px\)/);
  assert.match(css, /grid-template-rows:\s*24px 32px minmax\(0, 1fr\)\s*!important/);
  assert.match(css, /wallboard-priority-v2 > h2\s*\{[\s\S]*position:\s*relative\s*!important[\s\S]*height:\s*24px\s*!important/);
  assert.match(css, /wallboard-priority-v2 > h2 > span:first-child\s*\{[\s\S]*clip:\s*auto\s*!important[\s\S]*font-size:\s*8px\s*!important/);
  assert.match(css, /wallboard-mini-telemetry\s*\{[\s\S]*position:\s*static\s*!important[\s\S]*font-size:\s*8px\s*!important/);
  assert.match(css, /wallboard-alert-provider-rail\s*\{[\s\S]*height:\s*32px\s*!important[\s\S]*margin:\s*0\s*!important/);
});

test('freshness recovery detects stale payloads quickly and can replace wedged releases', async () => {
  const watcher = await read('.github/workflows/status-freshness-watch.yml');
  const truthWatch = await read('scripts/status-truth-watch.mjs');

  assert.match(watcher, /cron:\s*"2,7,12,17,22,27,32,37,42,47,52,57 \* \* \* \*"/);
  assert.match(watcher, /stale_active=/);
  assert.match(watcher, /stale_ids=/);
  assert.match(watcher, /name:\s*Cancel wedged Pages releases/);
  assert.match(watcher, /actions\/runs\/\$\{id\}\/cancel/);
  assert.match(watcher, /steps\.release\.outputs\.stale_active == 'true'/);
  assert.match(truthWatch, /const STALE_AFTER_MINUTES = 10/);
});
