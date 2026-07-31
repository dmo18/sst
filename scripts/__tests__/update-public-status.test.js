import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFeedEntries,
  discoverFeedUrls,
  entraConclusion,
  parseFeedEntries,
  publicPageUrl,
  resolvePublicSource
} from '../update-public-status.mjs';

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

test('account-specific ISPs remain limited instead of fabricated green', () => {
  const source = resolvePublicSource({ id: 'att', url: 'https://www.att.com/outages/', sourceType: 'limited-official' });
  assert.equal(source.mode, 'limited');
});
