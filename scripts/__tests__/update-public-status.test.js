import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFeedEntries,
  canonicalizeProviderCatalog,
  dedupeIncidentEntries,
  discoverFeedUrls,
  entraConclusion,
  loadPublicProvider,
  parseFeedEntries,
  publicPageUrl,
  resolvePublicSource,
  scopeFeedEntries
} from '../update-public-status.mjs';
import {
  additionalPublicOverrides,
  isUsRelevantIncident,
  parseOktaIncidentRecords,
  providerSpecificConclusion
} from '../public-source-repairs.mjs';

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

test('verified public source overrides use free first-party pages', () => {
  for (const id of ['ringcentral', 'sophos', 'bitdefender-gravityzone', 'bitwarden', 'cove-data-protection', 'crashplan', 'fortinet', 'keeper', 'malwarebytes', 'superops', 'syncro', 'kaseya', 'okta', 'salesforce', 'zendesk', 'backblaze']) {
    const source = additionalPublicOverrides[id];
    assert.ok(source);
    assert.equal(source.mode, 'status-html');
    assert.match(source.url, /^https:\/\//);
  }
  assert.equal(additionalPublicOverrides.kaseya.regionScope, 'us');
  assert.equal(additionalPublicOverrides.okta.regionScope, 'us');
});

test('provider-specific status conclusions prefer current health over historical text', () => {
  assert.equal(providerSpecificConclusion({ id: 'sophos', name: 'Sophos' }, '<main>All systems normal</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'bitdefender-gravityzone', name: 'Bitdefender GravityZone' }, '<main>All systems are go!</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'bitwarden', name: 'Bitwarden' }, '<main>Operating Normally</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'crashplan', name: 'CrashPlan' }, '<main>All Systems Operational</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'superops', name: 'SuperOps' }, '<main>All services are online</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'syncro', name: 'Syncro' }, '<main>Operating Normally</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'zendesk', name: 'Zendesk' }, '<main>No incidents with Zendesk</main>').kind, 'healthy');
  assert.equal(providerSpecificConclusion({ id: 'backblaze', name: 'Backblaze' }, '<main>All systems operational. Nothing to report.</main>').kind, 'healthy');
});

test('RingCentral active incident overrides its general healthy legend', () => {
  const conclusion = providerSpecificConclusion(
    { id: 'ringcentral', name: 'RingCentral' },
    '<main>No issues are being reported A portion of customers may be experiencing inbound call failures Incident status updates</main>'
  );
  assert.equal(conclusion.kind, 'issue');
  assert.equal(conclusion.color, 'amber');
});

test('Cove conclusion filters unrelated N-able incidents', () => {
  const healthy = providerSpecificConclusion(
    { id: 'cove-data-protection', name: 'Cove Data Protection' },
    '<main>Active Incidents N-able Adlumin XDR Investigating Resolved Incidents Cove Data Protection restored</main>'
  );
  assert.equal(healthy.kind, 'healthy');
  const issue = providerSpecificConclusion(
    { id: 'cove-data-protection', name: 'Cove Data Protection' },
    '<main>Active Incidents N-able Cove Data Protection EMEA Performance Issue Investigating Resolved Incidents</main>'
  );
  assert.equal(issue.kind, 'issue');
});

test('Salesforce ignores informational messages but captures service degradation', () => {
  const healthy = providerSpecificConclusion(
    { id: 'salesforce', name: 'Salesforce' },
    '<main>Current Status ID Subject Instances Services Status Security Advisory Informational Message Ongoing Recently Viewed Instances</main>'
  );
  assert.equal(healthy.kind, 'healthy');
  const issue = providerSpecificConclusion(
    { id: 'salesforce', name: 'Salesforce' },
    '<main>Current Status ID Subject Instances Services Status Feature Degradation AP52 Core Service Ongoing Recently Viewed Instances</main>'
  );
  assert.equal(issue.kind, 'issue');
});

test('scheduled event notices with conditional impact are not incidents', () => {
  const entries = [{
    title: 'THIS IS A SCHEDULED EVENT',
    note: 'Scheduled maintenance is currently in progress. Traffic might be re-routed, there is a possibility of slight latency, and interfaces may become temporarily unavailable.',
    status: 'in_progress',
    time: 'Thu, 31 Jul 2026 12:00:00 GMT'
  }];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 0);
});

test('planned maintenance stays suppressed when expected limitations sound severe', () => {
  const entries = [{
    title: 'Scheduled maintenance window',
    note: 'During this planned maintenance, users may be unable to create settings and connections could fail over. Service disruption is possible.',
    status: 'scheduled',
    time: 'Thu, 31 Jul 2026 12:00:00 GMT'
  }];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 0);
});

test('scheduled maintenance escalated to active customer impact remains an incident', () => {
  const entries = [{
    title: 'Scheduled maintenance update',
    note: 'Investigating: customers are currently experiencing connection failures during the maintenance window.',
    status: 'investigating',
    time: 'Thu, 31 Jul 2026 12:00:00 GMT'
  }];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 1);
});

test('emergency or critical maintenance events remain incidents', () => {
  const entries = [
    {
      title: 'Emergency maintenance due to unexpected outage',
      note: 'Service is currently unavailable while emergency work is performed.',
      status: 'identified',
      time: 'Thu, 31 Jul 2026 12:00:00 GMT'
    },
    {
      title: 'Scheduled maintenance escalated to critical incident',
      note: 'A major service outage has been declared.',
      status: 'critical',
      time: 'Thu, 31 Jul 2026 12:00:00 GMT'
    }
  ];
  assert.equal(activeFeedEntries(entries, 336, Date.parse('2026-07-31T13:00:00Z')).length, 2);
});

test('provider consolidation absorbs Datto and adds Autotask to Kaseya', () => {
  const catalog = canonicalizeProviderCatalog([
    { id: 'kaseya', name: 'Kaseya', services: [] },
    { id: 'datto', name: 'Datto' },
    { id: 'other', name: 'Other' }
  ], {
    excludedProviderIds: ['datto'],
    providerOverrides: { kaseya: { services: ['Autotask PSA', 'Datto RMM'] } }
  });
  assert.deepEqual(catalog.map(provider => provider.id), ['kaseya', 'other']);
  assert.deepEqual(catalog[0].services, ['Autotask PSA', 'Datto RMM']);
});

test('US scope keeps US, global, mixed, and region-unspecified incidents', () => {
  for (const text of [
    'Datto RMM US-East service degradation',
    'Global Kaseya outage affecting all customers',
    'Autotask incident affecting US and EU cells',
    'Kaseya login failures under investigation'
  ]) assert.equal(isUsRelevantIncident(text), true, text);
});

test('US scope rejects explicit non-US-only incidents', () => {
  for (const text of [
    'Autotask UK cell service degradation',
    'Datto RMM EMEA outage',
    'Kaseya Australia region disruption',
    'Okta Canada cell incident',
    'VSA EU region elevated errors'
  ]) assert.equal(isUsRelevantIncident(text), false, text);
  const scoped = scopeFeedEntries([
    { title: 'US outage', note: 'US-East customers are affected' },
    { title: 'UK outage', note: 'United Kingdom customers are affected' },
    { title: 'Global outage', note: 'Worldwide impact' }
  ]);
  assert.deepEqual(scoped.map(item => item.title), ['US outage', 'Global outage']);
});

test('feed updates are deduplicated while preserving first and latest timestamps', () => {
  const entries = dedupeIncidentEntries([
    { title: 'Autotask PSA service degradation', note: 'Investigating', url: 'https://status.example/incidents/1', time: '2026-07-31T14:00:00Z' },
    { title: 'Autotask PSA service degradation update', note: 'Monitoring', url: 'https://status.example/incidents/1', time: '2026-07-31T15:00:00Z' }
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].firstTime, '2026-07-31T14:00:00Z');
  assert.equal(entries[0].time, '2026-07-31T15:00:00Z');
});

test('Kaseya includes Autotask and filters non-US-only feed incidents', async () => {
  globalThis.fetch = async url => String(url).endsWith('/history.rss')
    ? response(`<?xml version="1.0"?><rss><channel>
        <item><title>Autotask PSA UK cell degradation</title><description>United Kingdom customers are affected</description><pubDate>Thu, 31 Jul 2026 14:00:00 GMT</pubDate><guid>https://status.kaseya.com/incidents/uk</guid></item>
        <item><title>Datto RMM US-East service degradation</title><description>Investigating US customers</description><pubDate>Thu, 31 Jul 2026 14:00:00 GMT</pubDate><guid>https://status.kaseya.com/incidents/us</guid></item>
        <item><title>Datto RMM US-East service degradation update</title><description>Monitoring US customers</description><pubDate>Thu, 31 Jul 2026 15:00:00 GMT</pubDate><guid>https://status.kaseya.com/incidents/us</guid></item>
        <item><title>Global Kaseya outage</title><description>Worldwide service impact</description><pubDate>Thu, 31 Jul 2026 15:00:00 GMT</pubDate><guid>https://status.kaseya.com/incidents/global</guid></item>
      </channel></rss>`, 200, 'application/rss+xml')
    : response('Forbidden', 403, 'text/html');
  const result = await loadPublicProvider({
    id: 'kaseya',
    name: 'Kaseya',
    category: 'MSP Platforms',
    priority: 86,
    services: ['Autotask PSA', 'Datto RMM'],
    sourceType: 'statuspage',
    url: 'https://status.kaseya.com/api/v2/summary.json'
  });
  assert.equal(result.incidents.length, 2);
  assert.equal(result.incidents.some(item => /UK cell/i.test(item.title)), false);
  const datto = result.incidents.find(item => /Datto RMM/i.test(item.title));
  assert.equal(datto.affected_service, 'Datto RMM');
  assert.equal(datto.first_detected, 'Thu, 31 Jul 2026 14:00:00 GMT');
  assert.equal(datto.latest_update, 'Thu, 31 Jul 2026 15:00:00 GMT');
});

test('Okta structured public data provides real detection and update times', async () => {
  const records = [
    {
      attributes: { type: 'Incident__c' },
      Incident_Title__c: 'US sign-in failures',
      Status__c: 'Investigating',
      Impacted_Cells__c: 'okta.com:12',
      Start_Time__c: '2026-07-31T14:05:00.000Z',
      Last_Updated__c: '2026-07-31T15:10:00.000Z',
      Log__c: 'US customers are currently experiencing authentication failures.',
      Okta_Sub_Service__c: 'Authentication'
    },
    {
      attributes: { type: 'Incident__c' },
      Incident_Title__c: 'EMEA sign-in failures',
      Status__c: 'Investigating',
      Impacted_Cells__c: 'okta-emea.com:4',
      Start_Time__c: '2026-07-31T14:00:00.000Z',
      Last_Updated__c: '2026-07-31T15:00:00.000Z',
      Log__c: 'EMEA customers are affected.'
    },
    {
      attributes: { type: 'Incident__c' },
      Incident_Title__c: 'Resolved US incident',
      Status__c: 'Resolved',
      Impacted_Cells__c: 'okta.com:9',
      Start_Time__c: '2026-07-31T12:00:00.000Z',
      Last_Updated__c: '2026-07-31T13:00:00.000Z',
      Log__c: 'Service restored.'
    }
  ];
  const html = `<main>Okta Status</main><script>window.records=${JSON.stringify(records)}</script>`;
  assert.equal(parseOktaIncidentRecords(html).length, 3);
  globalThis.fetch = async () => response(html);
  const result = await loadPublicProvider({
    id: 'okta',
    name: 'Okta',
    category: 'Identity',
    priority: 86,
    sourceType: 'statuspage',
    url: 'https://status.okta.com/api/v2/summary.json'
  });
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].title, 'US sign-in failures');
  assert.equal(result.incidents[0].first_detected, '2026-07-31T14:05:00.000Z');
  assert.equal(result.incidents[0].latest_update, '2026-07-31T15:10:00.000Z');
  assert.equal(result.incidents[0].affected_service, 'Authentication');
});
