import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('legacy signage fallback only activates without CSS cascade layers', async () => {
  const main = await read('src/main.tsx');
  const compat = await read('src/styles/wallboard-compat.css');

  assert.match(main, /styles\/wallboard-v2\.css[\s\S]*styles\/wallboard-compat\.css/);
  assert.match(main, /'CSSLayerBlockRule' in window/);
  assert.match(main, /classList\.add\('no-css-layers'\)/);

  assert.doesNotMatch(compat, /@layer\b/);
  assert.match(compat, /html\.no-css-layers \.wallboard-v2\s*\{/);
  assert.match(compat, /position:\s*fixed/);
  assert.match(compat, /grid-template-rows:\s*minmax\(0, 1fr\) auto/);
  assert.match(compat, /html\.no-css-layers \.wallboard-v2 \.wallboard-priority article\s*\{[\s\S]*display:\s*grid/);
  assert.match(compat, /@media \(max-width: 1180px\), \(max-height: 520px\)/);
  assert.match(compat, /html\.no-css-layers \.wallboard-v2\s*\{[\s\S]*display:\s*block\s*!important/);
  assert.match(compat, /html\.no-css-layers \.wallboard-v2 \.wallboard-alert-provider-rail\s*\{[\s\S]*display:\s*block/);
  assert.match(compat, /html\.no-css-layers \.wallboard-v2 \.wallboard-priority-v2\s*\{[\s\S]*position:\s*absolute/);
  assert.match(compat, /wallboard-priority-marquee-compat/);
  assert.match(compat, /wallboard-alert-provider-marquee-compat/);
});

test('compatibility stylesheet cannot affect modern browsers without the marker class', async () => {
  const compat = await read('src/styles/wallboard-compat.css');
  const selectorBlocks = compat
    .split('{')
    .slice(0, -1)
    .map(part => part.split('}').pop()?.trim() || '')
    .filter(selector => selector && !selector.startsWith('@'));

  for (const selector of selectorBlocks) {
    if (selector === 'from' || selector === 'to') continue;
    assert.match(selector, /html\.no-css-layers|%$/, `unscoped compatibility selector: ${selector}`);
  }
});
