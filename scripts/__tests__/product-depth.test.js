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
  assert.ok(main.indexOf("./styles/product-depth-final-polish.css") < main.indexOf("./styles/product-quality-cleanup.css"));
  assert.ok(main.indexOf("./styles/product-quality-cleanup.css") < main.indexOf("./styles/wallboard-v2.css"));
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

test('command workspace keyboard contract supports Escape and interactive SVG nodes', async () => {
  const layer = await read('src/ProductDepthLayer.tsx');
  assert.match(layer, /activateSvgButton/);
  assert.match(layer, /event\.key === 'Escape' && focus/);
  assert.match(layer, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(layer, /role="group" aria-label="Interactive provider dependency universe"/);
  assert.match(layer, /onKeyDown=\{event => activateSvgButton/);
  assert.match(layer, /aria-label=\{`\$\{node\.label\}, \$\{node\.category\}, \$\{node\.tone\}`\}/);
});

test('signature experience contains dependency universe cautious correlation and signal replay', async () => {
  const layer = await read('src/ProductDepthLayer.tsx');
  const workspace = await read('src/operatorWorkspace.ts');
  const correlation = await read('src/eventCorrelation.ts');
  assert.match(layer, /Dependency Universe/);
  assert.match(layer, /temporal correlations only, never inferred causality/i);
  assert.match(correlation, /Temporal correlation only; no causal relationship is inferred/);
  assert.match(layer, /Signal replay/);
  assert.match(layer, /does not reconstruct unobserved service state/);
  assert.match(workspace, /kind: 'correlation'/);
  assert.match(workspace, /categoryPositions/);
  assert.match(workspace, /providerPositions/);
  assert.match(workspace, /providerRadius = 305/);
});

test('dependency universe visual layer keeps mobile topology inside the viewport and labels only urgent nodes by default', async () => {
  const css = await read('src/styles/product-quality-cleanup.css');
  const layer = await read('src/ProductDepthLayer.tsx');
  assert.match(css, /\.depth-provider-node text,[\s\S]*\.depth-category-node text[\s\S]*opacity: 0/);
  assert.match(css, /\.depth-category-node circle[\s\S]*r: 16px/);
  assert.match(css, /transform: scale\(1\.28\)/);
  assert.match(css, /font-size: 30px/);
  assert.match(css, /\.depth-provider-node\.depth-tone-critical text/);
  assert.match(css, /\.depth-provider-node\.depth-tone-warning circle/);
  assert.match(css, /\.depth-truth-boundary[\s\S]*display: none/);
  const mobileBlock = css.slice(css.indexOf('@media (max-width: 900px)'), css.indexOf('@media (max-width: 470px)'));
  assert.match(mobileBlock, /\.depth-provider-node text[\s\S]*display: none/);
  assert.doesNotMatch(mobileBlock, /\.depth-provider-node\.depth-tone-warning text,[\s\S]*display: block/);
  assert.match(layer, /const labelOnLeft = node\.x > 600/);
  assert.match(layer, /textAnchor=\{labelOnLeft \? 'end' : 'start'\}/);
  assert.match(layer, /node\.x \+ \(labelOnLeft \? -13 : 13\)/);
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
  assert.match(workspace, /distinctRecentChanges/);
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

test('deployed product-depth verification captures readable universe search incident and mobile evidence without schedule churn', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  const verifier = await read('scripts/verify-product-depth-experience.mjs');
  assert.match(workflow, /workflow_run\.event == 'push' \|\| github\.event\.workflow_run\.event == 'workflow_dispatch'/);
  assert.match(workflow, /verify-product-depth-experience\.mjs/);
  for (const artifact of ['operator-universe.png', 'operator-search.png', 'operator-incident.png', 'operator-universe-mobile.png', 'product-depth-verifier.log']) {
    assert.match(workflow, new RegExp(artifact.replace('.', '\\.')));
  }
  assert.match(verifier, /focus: 'universe'/);
  assert.match(verifier, /focus: 'search'/);
  assert.match(verifier, /focus: `incident:\$\{incidentId\}`/);
  assert.match(verifier, /PRODUCT_DEPTH_INCIDENT/);
  assert.match(verifier, /skipped no-live-incident/);
  assert.match(verifier, /Mobile Dependency Universe launcher overlaps Operations Intelligence chrome/);
  assert.match(verifier, /temporal correlations only\|Temporal correlation only/i);
  assert.match(verifier, /recorded changes only/i);
  assert.match(verifier, /assertUniverseReadability/);
  assert.match(verifier, /maximumGraphWidth/);
  assert.match(verifier, /clippedLabels/);
  assert.match(verifier, /clips \$\{metrics\.clippedLabels\} visible labels/);
  assert.match(verifier, /PRODUCT_DEPTH_MOBILE_METRICS/);
  assert.ok(
    verifier.indexOf('const mobileUniverseBytes = await capture') < verifier.indexOf("assertUniverseReadability(mobile, 'Mobile Dependency Universe', true)"),
    'mobile evidence must be captured before strict visual assertions so failures retain the rejected frame'
  );
  assert.match(verifier, /medianLabelHeight/);
  assert.match(verifier, /labelCollisions/);
  assert.match(verifier, /duplicate semantic result rows/);
});

test('product-depth closure record is backed by final production and product evidence', async () => {
  const tracker = await read('docs/product-depth-command-system.md');
  const system = await read('docs/system-status.md');
  const report = await read('docs/repository-report.md');
  const readme = await read('README.md');

  for (const document of [tracker, system, report, readme]) {
    assert.match(document, /357021b38a955b402af03d35415d1c1eae2a1550/);
    assert.match(document, /80 providers/i);
    assert.match(document, /NUSO/);
    assert.match(document, /Microsoft 365/);
  }

  assert.match(tracker, /Status: complete/);
  assert.match(tracker, /production release #833/i);
  assert.match(tracker, /product experience #34/i);
  assert.match(tracker, /9120182392/);
  assert.match(tracker, /ServiceHealth\.Read\.All/);
  assert.match(tracker, /45 local exact\/brand-geometry provider references/);
  assert.match(system, /Run #833 \(`31539557831`\)/);
  assert.match(system, /Run #34 \(`31539671901`\)/);
  assert.match(system, /35 exact masks/);
  assert.match(report, /no external logo origins/i);
  assert.match(readme, /80 raw entries and 80 active canonical providers/);
  assert.match(readme, /product-experience\.yml/);

  for (const document of [tracker, system, report, readme]) {
    assert.doesNotMatch(document, /79 active providers/i);
    assert.doesNotMatch(document, /Status: implementation in progress/);
  }
});
