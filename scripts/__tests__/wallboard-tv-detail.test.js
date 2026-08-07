import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('compact TV detail tuning loads after both wallboard presentation paths', async () => {
  const main = await read('src/main.tsx');
  assert.match(
    main,
    /styles\/wallboard-v2\.css[\s\S]*styles\/wallboard-compat\.css[\s\S]*styles\/wallboard-tv\.css/
  );
});

test('458x291 TV mode preserves complete incident detail with readable spacing', async () => {
  const css = await read('src/styles/wallboard-tv.css');

  assert.doesNotMatch(css, /@layer\b/);
  assert.equal((css.match(/@media\b/g) || []).length, 1);
  assert.match(css, /@media \(max-width: 520px\) and \(max-height: 360px\)/);
  assert.match(css, /grid-template-rows:\s*40px minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-columns:\s*28px minmax\(0, 1fr\)/);
  assert.match(css, /wallboard-priority-group > article\s*\{[\s\S]*gap:\s*11px/);
  assert.match(css, /wallboard-priority-group > article\s*\{[\s\S]*min-height:\s*118px/);
  assert.match(css, /wallboard-priority-group > article\s*\{[\s\S]*padding:\s*10px 9px 12px/);
  assert.match(css, /wallboard-priority-group > article\s*\{[\s\S]*border-bottom:\s*4px solid/);
  assert.match(css, /wallboard-priority-group article h3\s*\{[\s\S]*font-size:\s*14\.25px/);
  assert.match(css, /wallboard-priority-group article h3\s*\{[\s\S]*margin:\s*0 0 6px/);
  assert.match(css, /wallboard-priority-group article p\s*\{[\s\S]*display:\s*block\s*!important/);
  assert.match(css, /wallboard-priority-group article p\s*\{[\s\S]*font-size:\s*11\.5px/);
  assert.match(css, /wallboard-priority-group article p\s*\{[\s\S]*line-height:\s*1\.38/);
  assert.match(css, /wallboard-priority-group article p\s*\{[\s\S]*max-height:\s*none\s*!important/);
  assert.match(css, /wallboard-priority-group article p\s*\{[\s\S]*overflow:\s*visible\s*!important/);
  assert.match(css, /wallboard-priority-group article p\s*\{[\s\S]*-webkit-line-clamp:\s*unset\s*!important/);
  assert.doesNotMatch(css, /wallboard-priority-group article p\s*\{[^}]*display:\s*none/);
});

test('compact TV header shows provider names and keeps freshness telemetry', async () => {
  const css = await read('src/styles/wallboard-tv.css');

  assert.match(css, /wallboard-priority-v2 > h2\s*\{[\s\S]*height:\s*0\s*!important/);
  assert.match(css, /wallboard-priority-v2 > h2 > span:first-child\s*\{[\s\S]*clip:\s*rect\(0 0 0 0\)/);
  assert.match(css, /wallboard-alert-provider-rail\s*\{[\s\S]*height:\s*40px\s*!important/);
  assert.match(css, /wallboard-alert-provider-rail\s*\{[\s\S]*margin:\s*0 120px 0 0\s*!important/);
  assert.match(css, /wallboard-alert-provider-chip\s*\{[\s\S]*min-width:\s*64px\s*!important/);
  assert.match(css, /wallboard-alert-provider-chip\s*\{[\s\S]*max-width:\s*112px\s*!important/);
  assert.match(css, /wallboard-alert-provider-chip b\s*\{[\s\S]*display:\s*block\s*!important/);
  assert.match(css, /wallboard-alert-provider-chip b\s*\{[\s\S]*font-size:\s*9\.5px/);
  assert.doesNotMatch(css, /wallboard-alert-provider-chip b\s*\{[^}]*display:\s*none/);
  assert.match(css, /wallboard-mini-telemetry\s*\{[\s\S]*position:\s*absolute\s*!important/);
  assert.match(css, /wallboard-mini-telemetry\s*\{[\s\S]*right:\s*5px\s*!important/);
});

test('compact TV mode keeps provider, age, urgency, and signage-safe CSS', async () => {
  const css = await read('src/styles/wallboard-tv.css');

  assert.match(css, /wallboard-priority-group article b\s*\{[\s\S]*font-size:\s*10\.5px/);
  assert.match(css, /wallboard-priority-group article time\s*\{[\s\S]*position:\s*absolute\s*!important/);
  assert.match(css, /wallboard-priority-group article time\s*\{[\s\S]*font-size:\s*9\.5px/);
  assert.match(css, /article\.attention-critical[\s\S]*var\(--red, #ff727d\)/);
  assert.match(css, /article\.attention-action[\s\S]*var\(--amber, #ffc566\)/);
  assert.match(css, /article\.attention-watch[\s\S]*var\(--blue, #5b9dff\)/);
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /container-type|@container/);
  assert.doesNotMatch(css, /text-wrap\s*:/);
});
