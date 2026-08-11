import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('signal replay evidence boundary remains visible even when bounded history exists', async () => {
  const app = await read('src/App.tsx');
  const boundary = await read('src/ProductTruthBoundary.tsx');
  const verifier = await read('scripts/verify-product-depth-experience.mjs');
  assert.match(app, /replayBoundaryVisible/);
  assert.match(app, /<ProductTruthBoundary visible=\{replayBoundaryVisible\} \/>/);
  assert.match(boundary, /Recorded changes only\./);
  assert.match(boundary, /No unobserved service state is reconstructed\./);
  assert.match(verifier, /recorded changes only/i);
});

test('Microsoft 365 is a first-class critical service estate', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');
  const app = await read('src/App.tsx');
  const catalog = JSON.parse(await read('config/provider-consolidation.json'));

  for (const service of [
    'Microsoft 365 suite',
    'Exchange Online',
    'Microsoft Teams',
    'SharePoint Online',
    'OneDrive for Business',
    'Microsoft Entra ID',
    'Microsoft Intune',
    'Microsoft 365 Apps',
    'Microsoft Defender for Microsoft 365',
    'Microsoft Power Platform'
  ]) {
    assert.match(contract, new RegExp(service.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(catalog.providerOverrides.microsoft365.services.includes(service), `catalog must cover ${service}`);
  }

  assert.equal(catalog.providerOverrides.microsoft365.criticality, 'high');
  assert.match(component, /Microsoft 365 coverage/);
  assert.match(component, /Public does not mean tenant-complete/);
  assert.match(component, /ServiceHealth\.Read\.All/);
  assert.match(app, /<Microsoft365CriticalSuite model=\{model\} \/>/);
});

test('Microsoft tenant health contract is explicit and cannot leak into the public browser pipeline', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');
  const workflow = await read('.github/workflows/refresh-pages.yml');

  assert.match(contract, /\/admin\/serviceAnnouncement\/healthOverviews/);
  assert.match(contract, /\/admin\/serviceAnnouncement\/issues/);
  assert.match(contract, /ServiceHealth\.Read\.All/);
  assert.match(component, /never exposed to the public browser or status payload/);
  assert.match(component, /authenticated private backend/);
  assert.doesNotMatch(workflow, /graph\.microsoft\.com/);
  assert.doesNotMatch(workflow, /AZURE_CLIENT_SECRET|MICROSOFT_CLIENT_SECRET|ServiceHealth\.Read\.All/);
});

test('Microsoft 365 critical suite styles load before wallboard geometry and remain operator-only', async () => {
  const main = await read('src/main.tsx');
  const app = await read('src/App.tsx');
  const css = await read('src/styles/microsoft365-critical-suite.css');
  assert.ok(main.indexOf("./styles/microsoft365-critical-suite.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.match(css, /bottom: 306px/);
  assert.match(css, /\.depth-truth-boundary/);
  const wallboardBranch = app.slice(app.indexOf('? <WallboardV2'), app.indexOf(': <>'));
  assert.doesNotMatch(wallboardBranch, /Microsoft365CriticalSuite|ProductTruthBoundary/);
});
