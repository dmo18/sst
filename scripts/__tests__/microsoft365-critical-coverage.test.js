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
    assert.ok(contract.includes(service), `coverage contract must include ${service}`);
    assert.ok(catalog.providerOverrides.microsoft365.services.includes(service), `catalog must cover ${service}`);
  }

  assert.equal(catalog.providerOverrides.microsoft365.criticality, 'high');
  assert.match(component, /Microsoft 365 coverage/);
  assert.match(component, /Public does not mean tenant-complete/);
  assert.match(contract, /ServiceHealth\.Read\.All/);
  assert.match(component, /MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION/);
  assert.match(component, /data-m365-critical-suite/);
  assert.match(app, /<Microsoft365CriticalSuite model=\{model\} \/>/);
});

test('Microsoft service truth is never synthesized from evidence health', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');

  const serviceTone = contract.match(/export function microsoft365ServiceTone[\s\S]*?(?=export function microsoft365EvidenceTone)/)?.[0] || '';
  const evidenceTone = contract.match(/export function microsoft365EvidenceTone[\s\S]*?(?=export function microsoft365EvidenceLabel)/)?.[0] || '';
  assert.match(serviceTone, /source\.serviceState === 'major'/);
  assert.match(serviceTone, /source\.serviceState === 'degraded'/);
  assert.match(serviceTone, /source\.serviceState === 'operational'/);
  assert.doesNotMatch(serviceTone, /sourceHealth|sourceState/);
  assert.match(evidenceTone, /source\.sourceHealth === 'watch'/);
  assert.match(evidenceTone, /source\.sourceHealth === 'blind'/);
  assert.match(component, /Service truth and evidence quality are deliberately separate/);
  assert.match(component, /Source-quality warnings remain evidence warnings only/);
  assert.match(component, /data-evidence-tone/);
});

test('umbrella Microsoft 365 coverage does not claim facet-specific public health', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');
  assert.match(contract, /serviceTone: 'informational'/);
  assert.match(contract, /this individual service is not publicly verified/);
  assert.match(contract, /no broad Microsoft 365 public incident is active/);
  assert.match(component, /Broad public \+ tenant detail/);
  assert.match(component, /facet-specific health requires Microsoft service communications for the tenant/i);
  assert.match(component, /data-m365-current-incidents/);
});

test('Microsoft tenant health contract is explicit and cannot leak into the public browser pipeline', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');
  const workflow = await read('.github/workflows/refresh-pages.yml');

  assert.match(contract, /\/admin\/serviceAnnouncement\/healthOverviews/);
  assert.match(contract, /\/admin\/serviceAnnouncement\/issues/);
  assert.match(contract, /ServiceHealth\.Read\.All/);
  assert.match(component, /authenticated private backend/);
  assert.match(component, /tenant-only health is never invented from the public feed/);
  assert.doesNotMatch(workflow, /graph\.microsoft\.com/);
  assert.doesNotMatch(workflow, /AZURE_CLIENT_SECRET|MICROSOFT_CLIENT_SECRET|ServiceHealth\.Read\.All/);
});

test('Microsoft 365 critical suite styles load before wallboard geometry and remain operator-only', async () => {
  const main = await read('src/main.tsx');
  const app = await read('src/App.tsx');
  const css = await read('src/styles/microsoft365-critical-suite.css');
  const truthCss = await read('src/styles/microsoft365-truth-hardening.css');
  assert.ok(main.indexOf("./styles/microsoft365-critical-suite.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.ok(main.indexOf("./styles/microsoft365-truth-hardening.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.match(css, /bottom: 306px/);
  assert.match(css, /\.depth-truth-boundary/);
  assert.match(truthCss, /\.m365-service-card\.is-informational/);
  const wallboardBranch = app.slice(app.indexOf('? <WallboardV2'), app.indexOf(': <>'));
  assert.doesNotMatch(wallboardBranch, /Microsoft365CriticalSuite|ProductTruthBoundary/);
});

test('post-deploy evidence verifies Microsoft 365 desktop and mobile coverage', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  const verifier = await read('scripts/verify-microsoft365-experience.mjs');
  assert.match(workflow, /Verify deployed Microsoft 365 critical coverage/);
  assert.match(workflow, /verify-microsoft365-experience\.mjs/);
  assert.match(workflow, /operator-m365\.png/);
  assert.match(workflow, /operator-m365-mobile\.png/);
  assert.match(workflow, /microsoft365-verifier\.log/);
  assert.match(verifier, /data-m365-critical-suite/);
  assert.match(verifier, /facetCount !== 10/);
  assert.match(verifier, /ServiceHealth\.Read\.All/);
  assert.match(verifier, /MICROSOFT365_CRITICAL/);
});
