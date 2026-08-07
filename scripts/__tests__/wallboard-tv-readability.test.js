import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('compact TV tuning loads after both wallboard presentation paths', async () => {
  const main = await read('src/main.tsx');
  assert.match(
    main,
    /styles\/wallboard-v2\.css[\s\S]*styles\/wallboard-compat\.css[\s\S]*styles\/wallboard-tv\.css/
  );
});

test('458x291 TV mode prioritizes readable incident identity over long prose', async () => {
  const css = await read('src/styles/wallboard-tv.css');

  assert.doesNotMatch(css, /@layer\b/);
  assert.equal((css.match(/@media\b/g) || []).length, 1);
  assert.match(css, /@media \(max-width: 520px\) and \(max-height: 360px\)/);
  assert.match(css, /grid-template-rows:\s*38px 38px minmax\(0, 1fr\)/);
  assert.match(css, /wallboard-priority-group > article\s*\{[\s\S]*min-height:\s*84px/);
  assert.match(css, /grid-template-columns:\s*34px minmax\(0, 1fr\) 54px/);
  assert.match(css, /wallboard-priority-group article h3\s*\{[\s\S]*font-size:\s*15px/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /wallboard-priority-group article p\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /wallboard-priority-group article b\s*\{[\s\S]*font-size:\s*11px/);
  assert.match(css, /wallboard-priority-group article time\s*\{[\s\S]*font-size:\s*10\.5px/);
  assert.match(css, /wallboard-alert-provider-chip b\s*\{[\s\S]*font-size:\s*10\.5px/);
  assert.match(css, /wallboard-mini-telemetry > span:last-child\s*\{\s*display:\s*none/);
});

test('compact TV mode retains urgency cues and signage-safe CSS', async () => {
  const css = await read('src/styles/wallboard-tv.css');

  assert.match(css, /article\.attention-critical[\s\S]*var\(--red, #ff727d\)/);
  assert.match(css, /article\.attention-action[\s\S]*var\(--amber, #ffc566\)/);
  assert.match(css, /article\.attention-watch[\s\S]*var\(--blue, #5b9dff\)/);
  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /container-type|@container/);
}
);
