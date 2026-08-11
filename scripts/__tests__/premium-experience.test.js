import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('premium operator styles load before the wallboard geometry stack', async () => {
  const main = await read('src/main.tsx');
  const premium = main.indexOf("./styles/premium-experience.css");
  const interactions = main.indexOf("./styles/premium-interactions.css");
  const icons = main.indexOf("./styles/premium-icons.css");
  const state = main.indexOf("./styles/premium-state.css");
  const wallboard = main.indexOf("./styles/wallboard-v2.css");
  const tv = main.indexOf("./styles/wallboard-tv.css");
  const wallboardPremium = main.indexOf("./styles/wallboard-premium.css");

  assert.ok(premium >= 0, 'premium operator stylesheet must be loaded');
  assert.ok(interactions > premium, 'interaction polish follows the base premium visual system');
  assert.ok(icons > interactions, 'product iconography follows interaction polish');
  assert.ok(state > icons, 'state-aware atmosphere follows the product icon layer');
  assert.ok(wallboard > state, 'wallboard geometry styles must override generic operator components');
  assert.ok(tv > wallboard, 'TV geometry remains after normal wallboard styles');
  assert.ok(wallboardPremium > tv, 'visual-only wallboard polish loads last');
});

test('operator runtime includes a keyboard-first live command experience', async () => {
  const app = await read('src/App.tsx');
  const experience = await read('src/ExperienceLayer.tsx');

  assert.match(app, /import \{ ExperienceLayer \} from '\.\/ExperienceLayer'/);
  assert.match(app, /<ExperienceLayer model=\{model\}/);
  assert.match(experience, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(experience, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(experience, /dispatchShortcut\('1'\)/);
  assert.match(experience, /dispatchShortcut\('5'\)/);
  assert.match(experience, /dispatchShortcut\('w'\)/);
  assert.match(experience, /Validated refresh requested/);
  assert.match(experience, /model\?\.actionQueue/);
  assert.match(experience, /Opening \$\{item\.provider\} incident operations/);
  assert.match(experience, /dataset\.operationalTone = pulse\.tone/);
  assert.match(experience, /delete document\.documentElement\.dataset\.operationalTone/);
});

test('premium product identity no longer depends on prototype navigation glyphs', async () => {
  const icons = await read('src/styles/premium-icons.css');
  assert.match(icons, /\.enterprise-mark::before/);
  assert.match(icons, /\.nav-glyph::before/);
  assert.match(icons, /mask-image: url/);
  assert.match(icons, /button:nth-of-type\(5\)/);
});

test('premium motion remains accessible and wallboard polish stays geometry-neutral', async () => {
  const premium = await read('src/styles/premium-experience.css');
  const interactions = await read('src/styles/premium-interactions.css');
  const wallboardPremium = await read('src/styles/wallboard-premium.css');

  assert.match(premium, /prefers-reduced-motion: reduce/);
  assert.match(interactions, /prefers-reduced-motion: reduce/);
  assert.match(wallboardPremium, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(wallboardPremium, /grid-template-columns|grid-template-rows/);
  assert.doesNotMatch(wallboardPremium, /wallboard-priority-list[^}]*\bheight\s*:/s);
  assert.doesNotMatch(wallboardPremium, /wallboard-priority-v2[^}]*\bpadding\s*:/s);
  assert.doesNotMatch(wallboardPremium, /wallboard-priority-v2[^}]*\bwidth\s*:/s);
});

test('product experience overhaul remains production-gated', async () => {
  const doc = await read('docs/product-experience-overhaul.md');
  assert.match(doc, /Status: implementation in progress/);
  assert.match(doc, /Command\/Ctrl \+ K/);
  assert.match(doc, /exact 458 by 291 Yodeck verification passes/);
  assert.match(doc, /deployed to production/);
});