import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const microsoftWorkloads = [
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
];

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

test('Microsoft 365 is modeled as tenant-authoritative workloads plus public incident signals', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');
  const app = await read('src/App.tsx');
  const catalog = JSON.parse(await read('config/provider-consolidation.json'));

  for (const service of microsoftWorkloads) {
    assert.ok(contract.includes(service), `coverage contract must include ${service}`);
  }

  assert.equal(catalog.providerOverrides.microsoft365.name, 'Microsoft 365 public status');
  assert.equal(catalog.providerOverrides.microsoft365.criticality, 'high');
  assert.deepEqual(catalog.providerOverrides.microsoft365.services, ['Microsoft 365 public incident status']);
  for (const workload of microsoftWorkloads.slice(1)) {
    assert.ok(!catalog.providerOverrides.microsoft365.services.includes(workload), `generic public status provider must not alias ${workload}`);
  }

  assert.match(component, /Microsoft workload truth/);
  assert.match(component, /A clear public feed never green-lights the whole Microsoft estate/);
  assert.match(component, /Public incident feeds are not workload health/);
  assert.match(component, /Tenant workload authority/);
  assert.match(component, /MICROSOFT_GRAPH_SERVICE_HEALTH_PERMISSION/);
  assert.match(component, /data-m365-critical-suite/);
  assert.match(app, /<Microsoft365CriticalSuite model=\{model\} \/>/);
});

test('clear Microsoft public incident source renders informational instead of workload operational', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');

  const publicTone = contract.match(/export function microsoft365PublicSignalTone[\s\S]*?(?=export function microsoft365EvidenceTone)/)?.[0] || '';
  assert.match(publicTone, /source\.serviceState === 'major'/);
  assert.match(publicTone, /source\.serviceState === 'degraded'/);
  assert.match(publicTone, /source\.sourceState === 'available'/);
  assert.match(publicTone, /return 'informational'/);
  assert.doesNotMatch(publicTone, /source\.serviceState === 'operational'\) return 'positive'/);

  assert.match(component, /microsoft365PublicSignalTone/);
  assert.match(component, /public incident feed reachable/);
  assert.match(component, /not workload health/);
  assert.match(component, /data-source-role="public-incident-fallback"/);
  assert.match(component, /data-source-role="azure-public-entra"/);
});

test('Microsoft public incident scope maps only to explicitly named workloads', async () => {
  const contract = await read('src/microsoft365Coverage.ts');

  assert.match(contract, /export function microsoft365IncidentFacetIds/);
  assert.match(contract, /const matches = \['microsoft-365-suite'\]/);
  assert.match(contract, /exchange(?: online)?/i);
  assert.match(contract, /microsoft teams/i);
  assert.match(contract, /sharepoint/i);
  assert.match(contract, /onedrive/i);
  assert.match(contract, /microsoft intune/i);
  assert.match(contract, /microsoft 365 apps/i);
  assert.match(contract, /defender/i);
  assert.match(contract, /power platform/i);
  assert.match(contract, /if \(patterns\.some\(pattern => pattern\.test\(text\)\)\) matches\.push\(facetId\)/);
  assert.match(contract, /published scope does not map to this workload/);
});

test('all Microsoft workload facets remain tenant-authoritative when no mapped public incident exists', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');

  assert.match(contract, /tenantGranularFacetCount: MICROSOFT_365_CRITICAL_SERVICES\.length/);
  assert.match(contract, /No public incident currently maps to this workload; current health requires tenant Microsoft 365 Service Health/);
  assert.match(contract, /No active public Microsoft 365 incident is currently published; this is not a workload-health assertion/);
  assert.match(component, /tracked facets.*tenant-authoritative/);
  assert.match(component, /Tenant health \+ scoped public incidents/);
  assert.match(component, /data-health-authority="tenant-service-health"/);
  assert.match(component, /data-public-incident-count/);
});

test('Microsoft tenant health contract is explicit and cannot leak into the public browser pipeline', async () => {
  const contract = await read('src/microsoft365Coverage.ts');
  const component = await read('src/Microsoft365CriticalSuite.tsx');
  const workflow = await read('.github/workflows/refresh-pages.yml');

  assert.match(contract, /\/admin\/serviceAnnouncement\/healthOverviews/);
  assert.match(contract, /\/admin\/serviceAnnouncement\/issues/);
  assert.match(contract, /ServiceHealth\.Read\.All/);
  assert.match(component, /authenticated private backend/);
  assert.match(component, /authoritative per subscribed tenant service/);
  assert.match(component, /Health authority: tenant Microsoft 365 Service Health/);
  assert.doesNotMatch(workflow, /graph\.microsoft\.com/);
  assert.doesNotMatch(workflow, /AZURE_CLIENT_SECRET|MICROSOFT_CLIENT_SECRET|ServiceHealth\.Read\.All/);
});

test('Microsoft 365 critical suite styles load before wallboard geometry and keep public-clear neutral', async () => {
  const main = await read('src/main.tsx');
  const app = await read('src/App.tsx');
  const css = await read('src/styles/microsoft365-critical-suite.css');
  const truthCss = await read('src/styles/microsoft365-truth-hardening.css');
  assert.ok(main.indexOf("./styles/microsoft365-critical-suite.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.ok(main.indexOf("./styles/microsoft365-truth-hardening.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.match(css, /bottom: 306px/);
  assert.match(css, /\.depth-truth-boundary/);
  assert.match(truthCss, /\.m365-service-card\.is-informational/);
  assert.match(truthCss, /\.m365-source-card\.is-informational/);
  assert.match(truthCss, /data-health-authority="tenant-service-health"/);
  const wallboardBranch = app.slice(app.indexOf('? <WallboardV2'), app.indexOf(': <>'));
  assert.doesNotMatch(wallboardBranch, /Microsoft365CriticalSuite|ProductTruthBoundary/);
});

test('post-deploy evidence verifies Microsoft workload truth on desktop and mobile', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  const verifier = await read('scripts/verify-microsoft365-experience.mjs');
  assert.match(workflow, /Verify deployed Microsoft 365 critical coverage/);
  assert.match(workflow, /verify-microsoft365-experience\.mjs/);
  assert.match(workflow, /operator-m365\.png/);
  assert.match(workflow, /operator-m365-mobile\.png/);
  assert.match(workflow, /microsoft365-verifier\.log/);
  assert.match(verifier, /data-m365-critical-suite/);
  assert.match(verifier, /facetCount !== 10/);
  assert.match(verifier, /tenant-authoritative/i);
  assert.match(verifier, /public-incident-fallback/);
  assert.match(verifier, /ServiceHealth\.Read\.All/);
  assert.match(verifier, /MICROSOFT365_CRITICAL/);
});
