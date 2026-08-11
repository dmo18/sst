import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('mobile Dependency Universe gets a dedicated screenshot-reviewed composition layer', async () => {
  const main = await read('src/main.tsx');
  const css = await read('src/styles/product-depth-final-polish.css');
  assert.match(css, /\.depth-shell-universe \.dependency-universe/);
  assert.match(css, /transform: scale\(1\.58\)/);
  assert.match(css, /bottom: 146px/);
  assert.match(css, /\.depth-truth-boundary/);
  assert.ok(main.indexOf("./styles/product-depth-final-polish.css") < main.indexOf("./styles/wallboard-v2.css"));
});

test('retained browser evidence proves profile cleanup before removing early cleanup noise', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  assert.match(workflow, /Operator browser profile cleanup did not complete/);
  assert.match(workflow, /Product-depth browser profile cleanup did not complete/);
  assert.match(workflow, /Microsoft 365 browser profile cleanup did not complete/);
  assert.match(workflow, /sed -i '\/Browser profile cleanup warning\/d'/);
  assert.match(workflow, /sed -i '\/Product-depth browser profile cleanup warning\/d'/);
});
