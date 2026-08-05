import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('production HTML does not load a legacy wallboard DOM controller', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /wallboard-controls\.js/);
  assert.equal((html.match(/<script\b/g) || []).length, 1, 'only the Vite module entry should execute');
});

test('wallboard visibility uses explicit automatic and manual states', async () => {
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(css, /\.wallboard-shell\.wallboard-controls-visible\s*>\s*header/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-visible\s*>\s*\.wallboard-kpis/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-pinned-open\s*>\s*header/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-pinned-closed\s*>\s*header/);
  assert.doesNotMatch(css, /\.wallboard-shell:hover/);
  assert.doesNotMatch(css, /data-header-collapsed/);
});

test('wallboard header and KPI strip have separate fixed geometry', async () => {
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(css, /--wallboard-header-height:\s*72px/);
  assert.match(css, /--wallboard-kpi-height:\s*88px/);
  assert.match(css, /top:\s*calc\(var\(--wallboard-overlay-inset\) \+ var\(--wallboard-header-height\) \+ var\(--wallboard-overlay-gap\)\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.wallboard-shell\s*>\s*\.wallboard-kpis\s*>\s*\.metric-tile[\s\S]*height:\s*100%\s*!important/);
});

test('freshness telemetry is inline with the priority heading', async () => {
  const source = await read('src/wallboardDomEnhancements.ts');
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(source, /\.wallboard-priority > h2/);
  assert.match(source, /heading\.appendChild\(telemetry\)/);
  assert.match(css, /\.wallboard-priority\s*>\s*h2[\s\S]*display:\s*flex/);
  assert.doesNotMatch(css, /\.wallboard-mini-telemetry[\s\S]*position:\s*fixed/);
});

test('the remaining wallboard enhancement never mutates signal rows', async () => {
  const source = await read('src/wallboardDomEnhancements.ts');
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /querySelectorAll[^\n]*article/);
  assert.doesNotMatch(source, /appendChild\(item\.article\)/);
  assert.doesNotMatch(source, /\.hidden\s*=/);
});

test('compact wallboard keeps an explicit visible content row', async () => {
  const css = await read('src/styles/wallboard-v2.css');
  assert.match(css, /\.wallboard-v2\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto\s*!important/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.wallboard-v2 > main[\s\S]*display:\s*block\s*!important/);
  assert.match(css, /@media \(max-height: 620px\)/);
  assert.match(css, /\.wallboard-v2 \.wallboard-priority-v2[\s\S]*height:\s*100%/);
});

test('priority auto-loop is not disabled by a resting pointer', async () => {
  const source = await read('src/WallboardV2.tsx');
  assert.match(source, /requestAnimationFrame\(animate\)/);
  assert.match(source, /scrollHeight - list\.clientHeight/);
  assert.doesNotMatch(source, /pointerenter/);
  assert.doesNotMatch(source, /pointerleave/);
  assert.match(source, /wheel.*pauseForUserInput/);
});
