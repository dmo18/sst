import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { faviconCandidates, faviconWrapperSvg, normalizeFavicon, providerPageUrl } from '../provider-favicon-utils.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('provider favicon source list covers every generated recognition brand', async () => {
  const settings = JSON.parse(await read('config/provider-favicon-sources.json'));
  const expected = [
    'sentinelone', 'sophos', 'dnsfilter', 'connectwise', 'halopsa', 'ninjaone', 'jumpcloud', 'jamf', 'addigy',
    'atera', 'syncro', 'kaseya', 'n-able', 'superops', 'crowdstrike', 'huntress', 'eset', 'proofpoint', 'mimecast',
    'barracuda', 'knowbe4', 'crashplan', 'cove-data-protection', 'sharefile', 'ultradns', 'linode', 'ringcentral',
    '8x8', 'nextiva', 'intermedia', 'twilio', 'salesforce', 'monday-com', 'docusign', 'nuso'
  ];
  assert.equal(settings.minimumResolved, 35);
  assert.deepEqual([...settings.providers].sort(), [...expected].sort());
  for (const id of ['sophos', 'halopsa', 'kaseya', 'superops', 'proofpoint', 'mimecast', 'cove-data-protection', 'ultradns', 'salesforce', 'docusign']) {
    assert.match(settings.websiteOverrides[id], /^https:\/\//);
  }
  for (const id of ['jamf', 'superops', 'cove-data-protection']) {
    assert.match(settings.assetOverrides[id].url, /^https:\/\//);
  }
  assert.match(settings.assetOverrides.jamf.url, /pages-favicon_logos\/original\/4655\/jamf_fav\.png$/);
  assert.equal(settings.websiteOverrides.ultradns, 'https://portal.ultradns.com/');
  assert.equal(settings.assetOverrides.ultradns, undefined);
  assert.equal(settings.assetOverrides['cove-data-protection'].background, '#005255');
});

test('provider favicon resolver derives the official status-site origin', () => {
  assert.equal(providerPageUrl('https://status.example.com/api/v2/summary.json'), 'https://status.example.com/');
});

test('favicon candidates prefer explicit sized icons and retain conventional fallbacks', () => {
  const html = '<link rel="icon" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" sizes="180x180" href="/touch.png">';
  const candidates = faviconCandidates(html, 'https://status.example.com/');
  assert.equal(candidates[0].url, 'https://status.example.com/favicon-32.png');
  assert.ok(candidates.some(candidate => candidate.url === 'https://status.example.com/favicon.ico'));
});

test('favicon bytes are wrapped into a static SVG identity asset', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const normalized = normalizeFavicon(png, 'image/png');
  assert.equal(normalized?.mime, 'image/png');
  const svg = faviconWrapperSvg(normalized.bytes, normalized.mime);
  assert.match(svg, /^<svg/);
  assert.match(svg, /data:image\/png;base64,/);
});

test('legacy ICO artwork remains usable when it does not contain an embedded PNG frame', () => {
  const ico = Buffer.from([0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
  const normalized = normalizeFavicon(ico, 'image/x-icon');
  assert.equal(normalized?.mime, 'image/x-icon');
  assert.deepEqual(normalized?.bytes, ico);
});

test('provider artwork wrappers can preserve a dark official-product plate', () => {
  const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path fill="white" d="M0 0h1v1H0z"/></svg>');
  const svg = faviconWrapperSvg(svgBytes, 'image/svg+xml', { background: '#005255' });
  assert.match(svg, /fill="#005255"/);
});

test('provider artwork fetching retries transient network and server failures without lowering the 35-provider gate', async () => {
  const sync = await read('scripts/sync-provider-favicons.mjs');
  const settings = JSON.parse(await read('config/provider-favicon-sources.json'));
  assert.match(sync, /const FETCH_ATTEMPTS = 3/);
  assert.match(sync, /new Set\(\[408, 425, 429\]\)/);
  assert.match(sync, /response\.status >= 500/);
  assert.match(sync, /attempt <= FETCH_ATTEMPTS/);
  assert.match(sync, /150 \* attempt/);
  assert.equal(settings.minimumResolved, 35);
});

test('provider UI uses build-generated local artwork paths without runtime external image requests', async () => {
  const providerIcon = await read('src/providerIcon.tsx');
  const generated = await read('src/generated/providerFavicons.ts');
  const sync = await read('scripts/sync-provider-favicons.mjs');
  const packageJson = JSON.parse(await read('package.json'));

  assert.match(providerIcon, /providerFavicons\[id\]/);
  assert.match(providerIcon, /provider-logo--favicon/);
  assert.match(providerIcon, /generatedFallback = !favicon/);
  assert.match(generated, /Readonly<Record<string, string>>/);
  assert.match(sync, /faviconCandidates/);
  assert.match(sync, /faviconWrapperSvg/);
  assert.match(sync, /websiteOverrides/);
  assert.match(sync, /assetOverrides/);
  assert.match(sync, /MAX_ICON_BYTES = 64 \* 1024/);
  assert.match(sync, /MAX_OFFICIAL_ASSET_BYTES = 512 \* 1024/);
  assert.match(sync, /fetchIconCandidate\(\{ url: assetOverride\.url \}, MAX_OFFICIAL_ASSET_BYTES\)/);
  assert.match(sync, /official-asset/);
  assert.match(sync, /vendor-website/);
  assert.match(sync, /status-site/);
  assert.match(sync, /generatedArtworkDirUrl/);
  assert.match(sync, /assets\/logos\/provider-favicons/);
  assert.match(sync, /provider-favicon-sources\.json/);
  assert.doesNotMatch(sync, /dataUri:/);
  assert.equal(packageJson.scripts['sync-provider-favicons'], 'node scripts/sync-provider-favicons.mjs');
  assert.match(packageJson.scripts['build:app'], /sync-provider-favicons/);
  assert.doesNotMatch(providerIcon, /https?:\/\//);
});
