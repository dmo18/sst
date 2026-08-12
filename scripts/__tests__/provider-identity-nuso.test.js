import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalizeProviderCatalog, resolvePublicSource } from '../update-public-status.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

async function canonicalCatalog() {
  const raw = JSON.parse(await read('config/providers.json'));
  const consolidation = JSON.parse(await read('config/provider-consolidation.json'));
  return canonicalizeProviderCatalog(raw, consolidation);
}

test('NUSO replaces the non-canonical Datto raw slot and remains first-class in production collection', async () => {
  const catalog = await canonicalCatalog();
  const nuso = catalog.find(provider => provider.id === 'nuso');
  assert.equal(catalog.length, 80);
  assert.equal(catalog.some(provider => provider.id === 'datto'), false);
  assert.ok(nuso, 'NUSO must be present in the canonical production catalog');
  assert.equal(nuso.name, 'NUSO');
  assert.equal(nuso.category, 'VoIP');
  assert.equal(nuso.criticality, 'high');
  assert.equal(nuso.priority, 88);
  assert.equal(nuso.sourceType, 'statuspage');
  assert.equal(nuso.url, 'https://status.nuso.cloud/api/v2/summary.json');
  assert.ok(nuso.services.includes('Microsoft Operator Connect'));
  assert.ok(nuso.services.includes('NUSO Bridge for Teams'));
  assert.ok(nuso.services.includes('NUSO Bridge for Zoom'));
  assert.ok(nuso.services.includes('Messaging Services (SMS/MMS)'));
  assert.ok(nuso.services.includes('Emergency Services'));
  assert.ok(nuso.services.includes('CPaaS API'));
});

test('NUSO uses the normal first-party Statuspage adapter and history feeds', () => {
  const source = resolvePublicSource({
    id: 'nuso',
    name: 'NUSO',
    sourceType: 'statuspage',
    url: 'https://status.nuso.cloud/api/v2/summary.json'
  });
  assert.equal(source.mode, 'status-html');
  assert.equal(source.url, 'https://status.nuso.cloud/');
  assert.deepEqual(source.feedCandidates, [
    'https://status.nuso.cloud/history.rss',
    'https://status.nuso.cloud/history.atom'
  ]);
});

test('Kaseya retains Datto products after the raw Datto slot becomes NUSO', async () => {
  const catalog = await canonicalCatalog();
  const kaseya = catalog.find(provider => provider.id === 'kaseya');
  assert.ok(kaseya);
  for (const service of ['Datto RMM', 'Datto BCDR', 'Datto SaaS Protection']) {
    assert.ok(kaseya.services.includes(service), `Kaseya must retain ${service}`);
  }
});

test('provider identity is bundled locally with a pinned source record and no runtime logo CDN', async () => {
  const logos = await read('src/logos.ts');
  const providerIcon = await read('src/providerIcon.tsx');
  const sources = await read('public/assets/logos/BRAND-SOURCES.md');
  const main = await read('src/main.tsx');
  assert.match(sources, /Simple Icons 16\.27\.1/);
  assert.match(sources, /CC0-1\.0/);
  const runtimeLogoSource = logos.replaceAll('http://www.w3.org/2000/svg', '');
  assert.doesNotMatch(runtimeLogoSource, /https?:\/\//);
  assert.match(providerIcon, /provider-logo--brand-mask/);
  assert.match(providerIcon, /--provider-logo-mask/);
  assert.ok(main.indexOf("./styles/provider-identity.css") < main.indexOf("./styles/wallboard-v2.css"));
  assert.equal(existsSync(new URL('../../public/assets/logos/github.svg', import.meta.url)), true);
  assert.equal(existsSync(new URL('../../public/assets/logos/fortinet.svg', import.meta.url)), true);
  assert.equal(existsSync(new URL('../../public/assets/logos/quickbooks.svg', import.meta.url)), true);
});

test('desktop shell guard waits for styles before rendering a narrow desktop viewport', async () => {
  const main = await read('src/main.tsx');
  assert.match(main, /waitForApplicationStylesheets/);
  assert.match(main, /await waitForApplicationStylesheets\(\)/);
  assert.match(main, /keepDesktopDevicesOutOfCompactShell/);
  assert.match(main, /max-device-width: 900px/);
  assert.match(main, /max-device-width: 370px/);
  assert.match(main, /rule\.media\.mediaText = replacement/);
  assert.match(main, /dataset\.desktopShellGuard/);
  assert.match(main, /async function startApplication/);
  assert.match(main, /await keepDesktopDevicesOutOfCompactShell\(\)/);
  assert.doesNotMatch(main, /^keepDesktopDevicesOutOfCompactShell\(\);$/m);
});

test('deployed provider identity verification uses structural and computed-style CDP checks', async () => {
  const verifier = await read('scripts/verify-provider-identity.mjs');
  assert.doesNotMatch(verifier, /--dump-dom/);
  assert.doesNotMatch(verifier, /\/Provider operations\/i\.test\(html\)/);
  assert.match(verifier, /remote-debugging-port/);
  assert.match(verifier, /provider-data-table\[aria-label=/);
  assert.match(verifier, /brandMaskCount < 35/);
  assert.match(verifier, /localLogoAssets < 45/);
  assert.match(verifier, /generatedCount > 35/);
  assert.match(verifier, /embeddedSvgCount !== desktop\.generatedCount/);
  assert.match(verifier, /data:image\/svg\+xml,/);
  assert.match(verifier, /unexpectedData/);
  assert.match(verifier, /networkRefs/);
  assert.match(verifier, /failedAssets/);
  assert.match(verifier, /nusoVisible/);
  assert.match(verifier, /styleContract/);
  assert.match(verifier, /shellStyle\?\.display === 'grid'/);
  assert.match(verifier, /sidebarStyle\?\.position === 'fixed'/);
  assert.match(verifier, /generatedStyle\?\.paddingTop === '0px'/);
  assert.match(verifier, /NAVIGATION_ATTEMPTS = 3/);
});

test('provider identity browser verifier is syntactically executable', () => {
  const verifierPath = fileURLToPath(new URL('../verify-provider-identity.mjs', import.meta.url));
  const check = spawnSync(process.execPath, ['--check', verifierPath], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout || 'node --check failed');
});

test('provider consolidation remains the single source of canonical overrides', async () => {
  assert.equal(existsSync(new URL('../../config/provider-additions.json', import.meta.url)), false);
  const source = await read('src/providerCatalog.ts');
  assert.doesNotMatch(source, /provider-additions/);
  assert.match(source, /providerConsolidation/);
});
