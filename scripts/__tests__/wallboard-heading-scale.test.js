import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const main = fs.readFileSync('src/main.tsx', 'utf8');
const css = fs.readFileSync('src/styles/wallboard-heading-scale.css', 'utf8');

test('wallboard heading scale loads after all wallboard presentation styles', () => {
  const tvIndex = main.indexOf("./styles/wallboard-tv.css");
  const scaleIndex = main.indexOf("./styles/wallboard-heading-scale.css");
  assert.ok(tvIndex >= 0, 'wallboard TV stylesheet is missing');
  assert.ok(scaleIndex > tvIndex, 'wallboard heading scale must load after the TV overrides');
});

test('all semantic wallboard heading levels are exactly 15 percent smaller without changing weight', () => {
  assert.match(css, /\.wallboard-v2 h1\s*\{[^}]*font-size:\s*clamp\(1\.2325rem,\s*\.935rem \+ \.323vw,\s*1\.9125rem\)\s*!important/);
  assert.match(css, /\.wallboard-v2 h2\s*\{[^}]*font-size:\s*clamp\(1\.037rem,\s*\.867rem \+ \.17vw,\s*1\.4875rem\)\s*!important/);
  assert.match(css, /\.wallboard-v2 h3\s*\{[^}]*font-size:\s*\.85rem\s*!important/);
  assert.doesNotMatch(css, /font-weight\s*:/);
});

test('legacy and compact TV heading baselines are scaled by the same 15 percent', () => {
  assert.match(css, /html\.no-css-layers \.wallboard-v2 h2,[\s\S]*font-size:\s*\.697rem\s*!important/);
  assert.match(css, /clamp\(14\.45px,\s*3\.825vw,\s*18\.7px\)\s*!important/);
  assert.match(css, /font-size:\s*15\.3px\s*!important/);
  assert.match(css, /wallboard-priority-group article h3\s*\{[^}]*font-size:\s*12\.1125px\s*!important/);
});
