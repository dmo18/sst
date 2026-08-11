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
  const mobile = main.indexOf("./styles/premium-mobile.css");
  const wallboard = main.indexOf("./styles/wallboard-v2.css");
  const tv = main.indexOf("./styles/wallboard-tv.css");
  const wallboardPremium = main.indexOf("./styles/wallboard-premium.css");

  assert.ok(premium >= 0, 'premium operator stylesheet must be loaded');
  assert.ok(interactions > premium, 'interaction polish follows the base premium visual system');
  assert.ok(icons > interactions, 'product iconography follows interaction polish');
  assert.ok(state > icons, 'state-aware atmosphere follows the product icon layer');
  assert.ok(mobile > state, 'premium mobile rules override the desktop premium shell');
  assert.ok(wallboard > mobile, 'wallboard geometry styles must override generic operator components');
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
  assert.match(experience, /event\.key === 'ArrowDown'/);
  assert.match(experience, /event\.key === 'ArrowUp'/);
  assert.match(experience, /aria-selected=\{index === activeIndex\}/);
  assert.match(experience, /dispatchShortcut\('1'\)/);
  assert.match(experience, /dispatchShortcut\('5'\)/);
  assert.match(experience, /dispatchShortcut\('w'\)/);
  assert.match(experience, /Validated refresh requested/);
  assert.match(experience, /model\?\.actionQueue/);
  assert.match(experience, /dispatchProductCommand\('focus', `incident:\$\{incident\.id\}`\)/);
  assert.match(experience, /Opening \$\{item\.provider\} incident focus/);
  assert.match(experience, /dataset\.operationalTone = pulse\.tone/);
  assert.match(experience, /delete document\.documentElement\.dataset\.operationalTone/);
  assert.match(experience, /Mac\|iPhone\|iPad/);
});

test('premium product identity no longer depends on prototype navigation glyphs', async () => {
  const icons = await read('src/styles/premium-icons.css');
  assert.match(icons, /\.enterprise-mark::before/);
  assert.match(icons, /\.nav-glyph::before/);
  assert.match(icons, /mask-image: url/);
  assert.match(icons, /button:nth-of-type\(5\)/);
});

test('premium mobile layer restores the product bottom-navigation contract', async () => {
  const mobile = await read('src/styles/premium-mobile.css');
  assert.match(mobile, /@media \(max-width: 900px\)/);
  assert.match(mobile, /\.app-sidebar \{[\s\S]*position: fixed;/);
  assert.match(mobile, /grid-template-columns: repeat\(5, minmax\(0,1fr\)\)/);
  assert.match(mobile, /\.experience-pulse \{ display: none; \}/);
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

test('deployed product experience verification covers desktop command and mobile surfaces without schedule churn', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  const verifier = await read('scripts/verify-operator-experience.mjs');
  assert.match(workflow, /workflow_run\.event != 'schedule'/);
  assert.match(workflow, /operator-experience\.png/);
  assert.match(workflow, /operator-command\.png/);
  assert.match(workflow, /operator-mobile\.png/);
  assert.match(verifier, /const MOBILE_WIDTH = 390/);
  assert.match(verifier, /const MOBILE_HEIGHT = 844/);
  assert.match(verifier, /Command keyboard selection/);
  assert.match(verifier, /Mobile navigation is not fixed/);
});

test('product experience overhaul records completed production and visual evidence', async () => {
  const doc = await read('docs/product-experience-overhaul.md');
  assert.match(doc, /Status: complete/);
  assert.match(doc, /Final full production release: #799 \(`31454693471`\)/);
  assert.match(doc, /Final clean product-evidence run: #6 \(`31454777612`\)/);
  assert.match(doc, /Final evidence artifact: `9087617756`/);
  assert.match(doc, /Command\/Ctrl \+ K/);
  assert.match(doc, /exact 458 by 291 Yodeck verification is green/i);
  assert.match(doc, /repeated human visual review/i);
  assert.match(doc, /No known premium-product-experience engineering item remains open/);
});