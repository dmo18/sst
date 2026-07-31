import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFeedEntries,
  discoverFeedUrls,
  entraConclusion,
  loadPublicProvider,
  parseFeedEntries,
  publicPageUrl,
  resolvePublicSource
} from '../update-public-status.mjs';

const response = (body, status = 200, type = 'text/html') => new Response(body, {
  status,
  headers: { 'content-type': type }
});

test('statuspage API URLs resolve to public pages and feeds', () => {
  const provider = {
    id: 'vendor',
    name: 'Vendor',
    sourceType: 'statuspage',
    url: 'https://status.vendor.example/api/v2/summary.json'
  };
  const source = resolvePublicSource(provider);
  assert.equal(publicPageUrl(provider.url), 'https://status.vendor.example/');
  assert.equal(source.mode, 'status-html');
  assert.equal(source.confirmHealthyFromFeed, undefined);
  assert.deepEqual(source.feedCandidates, [
    'https://status.vendor.example/history.rss',
    'https://status.vendor.example/history.atom'
  ]);
});

test('Microsoft 365 uses the free official public RSS feed', () => {
  const source = resolvePublicSource({ id: 'microsoft365', url: 'https://invalid.example', sourceType: 'limited-microsoft' });
  assert.equal(source.mode, 'feed');
  assert.equal(source.url, 'https://status.cloud.microsoft/api/feed/mac');
  assert.equal(source.allowEmpty, true);
  assert.equal(source.confirmHealthyFromFeed, true);
});

test('Entra uses the free Azure public RSS feed with identity filtering', () => {
  const source = resolvePublicSource({ id: 'entra', url: 'https://invalid.example', sourceType: 'limited-microsoft' });
  assert.equal(source.mode, 'feed');
  assert.equal(source.url, 'https://rssfeed.azure.status.microsoft/en-us/status/feed/');
  assert.equal(source.includePattern.test('Microsoft Entra ID authentication issue'), true);
  assert.equal(source.includePattern.test('Azure Storage issue'), false);
});

test('feed parser keeps active incidents and rejects resolved history', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Exchange Online service degradation</title><description>Investigating elevated errors</description><pubDate>Thu, 30 Jul 2026 23:00:00 GMT</pubDate></item>
    <item><title>Teams incident resolved</title><description>Service restored</description><pubDate>Thu, 30 Jul 2026 22:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const entries = parseFeedEntries(xml);
  const active = activeFeedEntries(entries, 336, Date.parse('2026-07-31T00:00:00Z'));
  assert.equal(entries.length, 2);
  assert.equal(active.length, 1);
  assert.match(active[0].title, /Exchange/);
});

test('feed discovery resolves relative RSS and Atom links', () => {
  const html = `<link rel="alternate" type="application/rss+xml" href="/history.rss"><a href="feed/atom">Atom</a>`;
  assert.deepEqual(discoverFeedUrls(html, 'https://status.vendor.example/'), [
    'https://status.vendor.example/history.rss',
    'https://status.vendor.example/feed/atom'
  ]);
});

test('Entra uses its first row status and ignores neighboring services', () => {
  assert.equal(entraConclusion('Identity Microsoft Entra ID (formerly Azure AD) Good Enterprise State Roaming Warning').kind, 'healthy');
  const issue = entraConclusion('Identity Microsoft Entra ID (formerly Azure AD) Warning Current Impact');
  assert.equal(issue.kind, 'issue');
  assert.equal(issue.color, 'amber');
});

test('readable generic history feed is live without false operational status', async () => {
  globalThis.fetch = async url => String(url).endsWith('/history.rss')
    ? response('<?xml version="1.0"?><rss><channel><item><title>Incident resolved</title><description>Service restored</description><pubDate>Thu, 30 Jul 2026 22:00:00 GMT</pubDate></item></channel></rss>', 200, 'application/rss+xml')
    : response('Forbidden', 403, 'text/html');
  const result = await loadPublicProvider({
    id: 'vendor',
    name: 'Vendor',
    category: 'Cloud',
    priority: 50,
    sourceType: 'statuspage',
    url: 'https://status.vendor.example/api/v2/summary.json'
  });
  assert.equal(result.source_state, 'available');
  assert.equal(result.service_state, 'unknown');
  assert.equal(result.ok, true);
  assert.match(result.message, /does not confirm current component health/);
});

test('Entra feed ignores unrelated Azure incidents', async () => {
  globalThis.fetch = async () => response(`<?xml version="1.0"?><rss><channel>
    <item><title>Azure Storage outage</title><description>Investigating</description><pubDate>Thu, 30 Jul 2026 23:00:00 GMT</pubDate></item>
    <item><title>Microsoft Entra ID authentication degradation</title><description>Investigating sign-in failures</description><pubDate>Thu, 30 Jul 2026 23:00:00 GMT</pubDate></item>
  </channel></rss>`, 200, 'application/rss+xml');
  const result = await loadPublicProvider({
    id: 'entra',
    name: 'Entra ID',
    category: 'Identity',
    priority: 125,
    sourceType: 'limited-microsoft',
    url: 'https://status.cloud.microsoft/api/'
  });
  assert.equal(result.source_state, 'available');
  assert.equal(result.incidents.length, 1);
  assert.match(result.incidents[0].title, /Entra ID/);
});
