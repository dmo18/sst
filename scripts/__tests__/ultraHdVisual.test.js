import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const main = fs.readFileSync('src/main.tsx', 'utf8');
const visualSystem = fs.readFileSync('src/styles/ultra-hd.css', 'utf8');
const tuning = fs.readFileSync('src/styles/ultra-hd-tuning.css', 'utf8');

test('the ultra-HD visual system remains loaded after the base application styles', () => {
  const baseIndex = main.indexOf("./styles/command-center.css");
  const ultraIndex = main.indexOf("./styles/ultra-hd.css");
  const tuningIndex = main.indexOf("./styles/ultra-hd-tuning.css");

  assert.ok(baseIndex >= 0, 'base command-center stylesheet is missing');
  assert.ok(ultraIndex > baseIndex, 'ultra-HD stylesheet must load after the base stylesheet');
  assert.ok(tuningIndex > ultraIndex, 'ultra-HD tuning must load last');
});

test('the visual system contains progressive desktop, 4K, and 8K scaling contracts', () => {
  assert.match(visualSystem, /--content-max:\s*6200px/);
  assert.match(visualSystem, /@media \(min-width:\s*2200px\)/);
  assert.match(visualSystem, /@media \(min-width:\s*3400px\)/);
  assert.match(visualSystem, /@media \(min-width:\s*5000px\)/);
  assert.match(visualSystem, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test('normal desktop and 8K rendering use explicit legibility and compositor rules', () => {
  assert.match(tuning, /min-width:\s*1501px\) and \(max-width:\s*2399px/);
  assert.match(tuning, /grid-template-columns:\s*repeat\(4,/);
  assert.match(tuning, /@media \(min-width:\s*5000px\)/);
  assert.match(tuning, /backdrop-filter:\s*none/);
  assert.match(tuning, /contain:\s*layout paint/);
});
