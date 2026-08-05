import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('production HTML does not load a legacy wallboard DOM controller', async () => {
  const html = await read('index.html');
  assert.doesNotMatch(html, /wallboard-controls\.js/);
  assert.equal((html.match(/<script\b/g) || []).length, 1, 'only the Vite module entry should execute');
});

test('wallboard visibility is controlled by one explicit state class', async () => {
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(css, /\.wallboard-shell\.wallboard-controls-visible\s*>\s*header/);
  assert.match(css, /\.wallboard-shell\.wallboard-controls-visible\s*>\s*\.wallboard-kpis/);
  assert.doesNotMatch(css, /\.wallboard-shell:hover/);
  assert.doesNotMatch(css, /data-header-collapsed/);
});

test('wallboard header and KPI strip have separate fixed geometry', async () => {
  const css = await read('src/styles/wallboard-focus.css');
  assert.match(css, /--wallboard-header-height:\s*72px/);
  assert.match(css, /--wallboard-kpi-height:\s*88px/);
  assert.match(css, /top:\s*calc\(var\(--wallboard-overlay-inset\) \+ var\(--wallboard-header-height\) \+ var\(--wallboard-overlay-gap\)\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.wallboard-kpis\s*>\s*\.metric-tile[\s\S]*height:\s*100%\s*!important/);
});

test('the remaining wallboard enhancement does not mutate signal rows', async () => {
  const source = await read('src/wallboardDomEnhancements.ts');
  assert.doesNotMatch(source, /MutationObserver/);
  assert.doesNotMatch(source, /wallboard-priority/);
  assert.doesNotMatch(source, /appendChild\(item\.article\)/);
  assert.doesNotMatch(source, /\.hidden\s*=/);
});
