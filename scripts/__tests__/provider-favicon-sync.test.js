import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { faviconCandidates, faviconWrapperDataUri, normalizeFavicon, providerPageUrl } from '../provider-favicon-utils.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('provider favicon source list covers every generated recognition brand', async () => {
  const settings = JSON.parse(await read('config/provider-favicon-sources.json'));
  const expected = [
    'sentinelone', 'sophos', 'dnsfilter', 'connectwise', 'halopsa', 'ninjaone', 'jumpcloud', 'jamf', 'addigy',
    'atera', 'syncro', 'kaseya', 'n-able', 'superops', 'crowdstrike', 'huntress', 'eset', 'proofpoint', 'mimecast',
    'barracuda', 'knowbe4', 'crashplan', 'cove-data-protection', 'sharefile', 'ultradns', 'linode', 'ringcentral',
    '8x8', 'nextiva', 'intermedia', 'twilio', 'salesforce', 'monday-com', 'docusign', 'nuso'
  ];
  assert.equal(settings.minimumResolved, 28);
  assert.deepEqual([...settings.providers].sort(), [...expected].sort());
  for (const id of ['sophos', 'halopsa', 'kaseya', 'superops', 'proofpoint', 'mimecast', 'cove-data-protection', 'ultradns', 'salesforce', 'docusign']) {
    assert.match(settings.websiteOverrides[id], /^https:\/\//);
  }
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

test('favicon bytes are wrapped into the existing embedded SVG identity contract', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const normalized = normalizeFavicon(png, 'image/png');
  assert.equal(normalized?.mime, 'image/png');
  const dataUri = faviconWrapperDataUri(normalized.bytes, normalized.mime);
  assert.match(dataUri, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(dataUri), /data:image\/png;base64,/);
});

test('provider UI prefers build-embedded favicons without adding runtime external image requests', async () => {
  const providerIcon = await read('src/providerIcon.tsx');
  const generated = await read('src/generated/providerFavicons.ts');
  const sync = await read('scripts/sync-provider-favicons.mjs');
  const packageJson = JSON.parse(await read('package.json'));

  assert.match(providerIcon, /providerFavicons\[id\]/);
  assert.match(providerIcon, /provider-logo--favicon/);
  assert.match(generated, /Readonly<Record<string, string>>/);
  assert.match(sync, /faviconCandidates/);
  assert.match(sync, /websiteOverrides/);
  assert.match(sync, /vendor-website/);
  assert.match(sync, /status-site/);
  assert.match(sync, /provider-favicon-sources\.json/);
  assert.equal(packageJson.scripts['sync-provider-favicons'], 'node scripts/sync-provider-favicons.mjs');
  assert.match(packageJson.scripts['build:app'], /sync-provider-favicons/);
  assert.doesNotMatch(providerIcon, /https?:\/\//);
});
