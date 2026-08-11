import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('product-depth system is operator-only and loads before wallboard geometry', async () => {
  const app = await read('src/App.tsx');
  const main = await read('src/main.tsx');
  assert.match(app, /<ProductDepthLauncher model=\{model\} \/>/);
  assert.match(app, /<ProductDepthLayer model=\{model\} \/>/);
  assert.ok(app.indexOf('<ProductDepthLayer model={model} />') > app.indexOf('<ExperienceLayer'));
  assert.ok(main.indexOf("./styles/product-depth.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.ok(main.indexOf("./styles/product-depth-launcher.css") < main.indexOf("./styles/wallboard-v2.css"));
  const wallboardBranch = app.slice(app.indexOf('? <WallboardV2'), app.indexOf(': <>'));
  assert.doesNotMatch(wallboardBranch, /ProductDepth/);
});

test('command palette reaches universe changes search watchlist and incident focus', async () => {
  const experience = await read('src/ExperienceLayer.tsx');
  assert.match(experience, /dispatchProductCommand\('universe'\)/);
  assert.match(experience, /dispatchProductCommand\('changes'\)/);
  assert.match(experience, /dispatchProductCommand\('search'\)/);
  assert.match(experience, /dispatchProductCommand\('watchlist'\)/);
  assert.match(experience, /dispatchProductCommand\('focus', `incident:\$\{incident\.id\}`\)/);
  assert.match(experience, /!event\.shiftKey && event\.key\.toLowerCase\(\) === 'k'/);
});

test('incident focus action loop is local and cannot rewrite vendor truth', async () => {
  const layer = await read('src/ProductDepthLayer.tsx');
  const workspace = await read('src/operatorWorkspace.ts');
  assert.match(layer, /Acknowledge/);
  assert.match(layer, /Follow/);
  assert.match(layer, /Snooze 30m/);
  assert.match(layer, /Mark handled/);
  assert.match(layer, /Browser-only workflow state/);
  assert.match(workspace, /do not modify vendor truth/);
  assert.doesNotMatch(layer, /service_state\s*=/);
  assert.doesNotMatch(layer, /source_health\s*=/);
});

test('signature experience contains dependency universe cautious correlation and signal replay', async () => {
  const layer = await read('src/ProductDepthLayer.tsx');
  const workspace = await read('src/operatorWorkspace.ts');
  assert.match(layer, /Dependency Universe/);
  assert.match(layer, /Temporal correlation only/);
  assert.match(layer, /Signal replay/);
  assert.match(layer, /does not reconstruct unobserved service state/);
  assert.match(workspace, /kind: 'correlation'/);
  assert.match(workspace, /categoryPositions/);
});

test('workspace supports deep links universal search change catch-up and persistent lenses', async () => {
  const layer = await read('src/ProductDepthLayer.tsx');
  const workspace = await read('src/operatorWorkspace.ts');
  assert.match(layer, /search\.set\('focus', focus\)/);
  assert.match(layer, /search\.set\('lens', lensId\)/);
  assert.match(layer, /Command\/Ctrl \+ Shift \+ K/);
  assert.match(layer, /Since your last catch-up/);
  assert.match(layer, /Mark current payload reviewed/);
  assert.match(layer, /Save pinned lens/);
  assert.match(workspace, /OPERATOR_WORKSPACE_STORAGE_KEY/);
  assert.match(workspace, /buildWorkspaceSearchIndex/);
  assert.match(workspace, /buildChangeDigest/);
  assert.match(workspace, /saveLens/);
});

test('persistent launcher makes the signature feature discoverable without overlapping wallboard mode', async () => {
  const launcher = await read('src/ProductDepthLauncher.tsx');
  const css = await read('src/styles/product-depth-launcher.css');
  assert.match(launcher, /Dependency Universe/);
  assert.match(launcher, /serviceops:product-command/);
  assert.match(css, /bottom: 244px/);
  assert.match(css, /right: 164px/);
  assert.match(css, /@media \(max-width: 900px\)/);
});
