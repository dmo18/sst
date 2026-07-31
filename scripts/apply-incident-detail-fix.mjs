import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative, value) {
  fs.writeFileSync(path.join(root, relative), value);
}

function replaceOnce(value, before, after, label) {
  if (value.includes(after)) return value;
  const count = value.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return value.replace(before, after);
}

let repairs = read('scripts/public-source-repairs.mjs');
repairs = replaceOnce(
  repairs,
  "import { spawnSync } from 'node:child_process';\n",
  "import { spawnSync } from 'node:child_process';\nimport { incidentDetailOverrides, providerIncidentConclusion } from './incident-detail-repairs.mjs';\n",
  'incident detail import'
);
repairs = replaceOnce(
  repairs,
  "};\n\nfunction cleanRenderedText(value) {",
  "};\n\nObject.assign(additionalPublicOverrides, incidentDetailOverrides);\n\nfunction cleanRenderedText(value) {",
  'incident source overrides'
);
repairs = replaceOnce(
  repairs,
  "export function providerSpecificConclusion(provider, html) {\n  const text = cleanRenderedText(html);\n  if (!text) return null;\n\n  switch (provider.id) {",
  "export function providerSpecificConclusion(provider, html) {\n  const text = cleanRenderedText(html);\n  if (!text) return null;\n  const detailed = providerIncidentConclusion(provider, html);\n  if (detailed) return detailed;\n\n  switch (provider.id) {",
  'provider detail conclusion'
);
write('scripts/public-source-repairs.mjs', repairs);

let generator = read('scripts/update-public-status.mjs');
generator = replaceOnce(
  generator,
  "} from './public-source-repairs.mjs';\n",
  "} from './public-source-repairs.mjs';\nimport { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';\n",
  'generator incident detail import'
);
generator = generator.replace('investigat(?:e|ed|ing|ion)?', 'investigat(?:e|ed|ing)?');
generator = replaceOnce(
  generator,
  "    if (!issueText(text) || resolvedText(text) || maintenanceOnly(text)) return false;",
  "    if (isEditorialIncidentEntry(item) || isGenericIncidentTitle(item.title) || !issueText(text) || resolvedText(text) || maintenanceOnly(text)) return false;",
  'feed editorial guard'
);
generator = replaceOnce(
  generator,
  "export function scopeFeedEntries(entries, source = {}) {\n  if (source.regionScope === 'global') return entries;\n  return entries.filter(item => isUsRelevantIncident(`${item.title || ''} ${item.note || ''} ${item.status || ''}`));\n}",
  "export function scopeFeedEntries(entries, source = {}) {\n  if (source.regionScope === 'global') return entries;\n  return entries.filter(item => isIncidentUsRelevant(item));\n}",
  'strict incident region scope'
);
const genericIncidentBlock = `\n  const activeCount = /\\b([1-9]\\d*)\\s+active incidents?\\b/i.exec(current);\n  if (activeCount) {\n    return { kind: 'issue', color: 'amber', title: \`\${provider.name} public status page reports an active issue\`, note: \`\${activeCount[1]} active incidents\` };\n  }\n\n  const healthy = /\\b(all systems operational|all systems working|all services operational|all services are operational|no active incidents|0 active incidents|no incidents reported|everything is operating normally)\\b/i.exec(current);\n  if (healthy) return { kind: 'healthy', status: cleanText(healthy[0]) };\n\n  const issuePattern = /\\b(major outage|partial outage|degraded performance|service disruption|service degradation|critical incident|active incident|investigating an issue|identified an issue|monitoring an issue)\\b/i;\n  const issue = issuePattern.exec(current);\n  if (issue) {\n    const text = issue[0];\n    const color = /major|critical|outage/i.test(text) && !/partial/i.test(text) ? 'red' : 'amber';\n    return { kind: 'issue', color, title: \`\${provider.name} public status page reports an active issue\`, note: text };\n  }\n`;
const truthfulHealthyBlock = `\n  const healthy = /\\b(all systems operational|all systems working|all services operational|all services are operational|no active incidents|0 active incidents|no incidents reported|everything is operating normally)\\b/i.exec(current);\n  if (healthy) return { kind: 'healthy', status: cleanText(healthy[0]) };\n`;
generator = replaceOnce(generator, genericIncidentBlock, truthfulHealthyBlock, 'remove generic fake incident fallback');
write('scripts/update-public-status.mjs', generator);

let tests = read('scripts/__tests__/update-public-status.test.js');
tests = replaceOnce(
  tests,
  "} from '../public-source-repairs.mjs';\n",
  "} from '../public-source-repairs.mjs';\nimport {\n  isEditorialIncidentEntry,\n  isGenericIncidentTitle,\n  isIncidentUsRelevant,\n  parseNableIncidentRecords,\n  providerIncidentConclusion\n} from '../incident-detail-repairs.mjs';\n",
  'test incident detail import'
);
const oldCoveTest = `test('Cove conclusion filters unrelated N-able incidents', () => {\n  const healthy = providerSpecificConclusion(\n    { id: 'cove-data-protection', name: 'Cove Data Protection' },\n    '<main>Active Incidents N-able Adlumin XDR Investigating Resolved Incidents Cove Data Protection restored</main>'\n  );\n  assert.equal(healthy.kind, 'healthy');\n  const issue = providerSpecificConclusion(\n    { id: 'cove-data-protection', name: 'Cove Data Protection' },\n    '<main>Active Incidents N-able Cove Data Protection EMEA Performance Issue Investigating Resolved Incidents</main>'\n  );\n  assert.equal(issue.kind, 'issue');\n});`;
const newCoveTest = `test('Cove conclusion filters unrelated and non-US N-able incidents', () => {\n  const fixture = \`<main>Active Incidents\n    Active Incident ID: 201377 Start: Jul 25, 2026 13:15:00 UTC End: N/A Severity: Minor Outage Status: Investigating\n    N-able Cove Data Protection EMEA There is an identified issue affecting a storage node in London, UK.\n    Services Impacted Cove Data Protection (Europe) Timeline Update Jul 29, 2026 12:38:35 UTC Hardware replacement is in progress.\n    Active Incident ID: 201250 Start: Jul 15, 2026 15:00:00 UTC End: N/A Severity: Minor Outage Status: Identified\n    N-able N-central (All Regions) Some feature flags may not be functioning as expected.\n    Services Impacted N-central (All Regions) Timeline Update Jul 29, 2026 10:00:00 UTC Engineering is monitoring.\n    Active Incident ID: 201400 Start: Jul 31, 2026 15:00:00 UTC End: N/A Severity: Minor Outage Status: Investigating\n    N-able Cove Data Protection Americas Customers may experience delayed backup jobs in the Americas.\n    Services Impacted Cove Data Protection (Americas) Timeline Update Jul 31, 2026 16:00:00 UTC Mitigation is in progress.\n    Resolved Incidents</main>\`;\n  const cove = providerSpecificConclusion({ id: 'cove-data-protection', name: 'Cove Data Protection' }, fixture);\n  assert.equal(cove.kind, 'issues');\n  assert.equal(cove.incidents.length, 1);\n  assert.match(cove.incidents[0].title, /Cove Data Protection Americas/i);\n  assert.doesNotMatch(cove.incidents[0].note, /N-central|London|201250|201377/i);\n  assert.equal(cove.incidents[0].firstDetected, '2026-07-31T15:00:00.000Z');\n  assert.equal(cove.incidents[0].latestUpdate, '2026-07-31T16:00:00.000Z');\n\n  const nable = providerSpecificConclusion({ id: 'n-able', name: 'N-able' }, fixture);\n  assert.equal(nable.kind, 'issues');\n  assert.equal(nable.incidents.length, 1);\n  assert.match(nable.incidents[0].title, /N-central/i);\n  assert.doesNotMatch(nable.incidents[0].note, /Cove Data Protection/i);\n});`;
tests = replaceOnce(tests, oldCoveTest, newCoveTest, 'Cove regression test');
const appendedTests = `\n\ntest('marketing and release posts are not service incidents', () => {\n  const entry = {\n    title: 'Adlumin Q2 Wrap-Up: Broader Coverage. Faster Investigation. Stronger Partner Operations.',\n    note: 'A quarterly product review covering new detections and workflow improvements.'\n  };\n  assert.equal(isEditorialIncidentEntry(entry), true);\n  assert.equal(activeFeedEntries([{ ...entry, time: 'Thu, 31 Jul 2026 12:00:00 GMT' }], 336, Date.parse('2026-07-31T13:00:00Z')).length, 0);\n});\n\ntest('generic incident headings are never published as incident titles', async () => {\n  assert.equal(isGenericIncidentTitle('Active Incident'), true);\n  assert.equal(isGenericIncidentTitle('Cloudflare public status page reports an active issue'), false);\n  globalThis.fetch = async url => String(url).endsWith('/')\n    ? response('<main><h2>Active Incident</h2><p>Partial Outage</p></main>')\n    : response('Not found', 404, 'text/plain');\n  const result = await loadPublicProvider({\n    id: 'vendor',\n    name: 'Vendor',\n    category: 'Cloud',\n    priority: 50,\n    sourceType: 'statuspage',\n    url: 'https://status.vendor.example/api/v2/summary.json'\n  });\n  assert.equal(result.incidents.length, 0);\n  assert.equal(result.service_state, 'unknown');\n});\n\ntest('US scope uses the incident title before page boilerplate', () => {\n  assert.equal(isIncidentUsRelevant({\n    title: 'Cisco Secure Access availability issue in Dubai',\n    note: 'Contact Cisco support in the United States for assistance.'\n  }), false);\n  assert.equal(isIncidentUsRelevant({\n    title: 'Cisco Umbrella DNS issue - Global',\n    note: 'Customers may see elevated latency.'\n  }), true);\n  assert.equal(isIncidentUsRelevant({\n    title: 'Cisco Umbrella issue affecting US and EU regions',\n    note: 'Multiple regions are impacted.'\n  }), true);\n});\n\ntest('Cloudflare parser publishes actual US incident details and drops international-only events', () => {\n  const fixture = \`<main>\n    <h2>Network Performance Issues in Istanbul</h2>\n    <p>Identified - The issue has been identified and a fix is being implemented.</p>\n    <p>Jul 28, 2026 - 10:25 UTC</p>\n    <h2>Workers API errors in US-East</h2>\n    <p>Investigating - US customers are currently experiencing failed Workers API requests.</p>\n    <p>Jul 31, 2026 - 16:20 UTC</p>\n    <h2>PHX scheduled maintenance</h2>\n    <p>In progress - Scheduled maintenance is currently in progress.</p>\n    <p>Jul 31, 2026 - 16:00 UTC</p>\n    <h2>Past Incidents</h2>\n  </main>\`;\n  const conclusion = providerIncidentConclusion({ id: 'cloudflare', name: 'Cloudflare' }, fixture);\n  assert.equal(conclusion.kind, 'issues');\n  assert.equal(conclusion.incidents.length, 1);\n  assert.equal(conclusion.incidents[0].title, 'Workers API errors in US-East');\n  assert.match(conclusion.incidents[0].note, /failed Workers API requests/);\n});\n\ntest('Docker healthy state wins over navigation text', () => {\n  const conclusion = providerIncidentConclusion(\n    { id: 'docker', name: 'Docker' },\n    '<main><h1>All Systems Operational</h1><nav>Active Incident Status History Report Issue</nav></main>'\n  );\n  assert.equal(conclusion.kind, 'healthy');\n});\n\ntest('N-able parser produces bounded records with service and timestamps', () => {\n  const records = parseNableIncidentRecords(\`<main>Active Incidents\n    Active Incident ID: 99 Start: Jul 31, 2026 15:00:00 UTC End: N/A Severity: Minor Outage Status: Investigating\n    N-able Cove Data Protection Americas Customers may experience delayed backups.\n    Services Impacted Cove Data Protection (Americas) Timeline Update Jul 31, 2026 16:00:00 UTC Mitigation is in progress.\n    Resolved Incidents</main>\`);\n  assert.equal(records.length, 1);\n  assert.match(records[0].title, /Cove Data Protection Americas/);\n  assert.equal(records[0].affectedService, 'Cove Data Protection (Americas)');\n  assert.ok(records[0].note.length < 900);\n});\n\ntest('repaired provider sources use official operational dashboards', () => {\n  assert.equal(resolvePublicSource({ id: 'n-able', url: 'https://status.n-able.com/api/v2/summary.json', sourceType: 'statuspage' }).url, 'https://uptime.n-able.com/');\n  assert.equal(resolvePublicSource({ id: 'cisco-umbrella', url: 'https://status.umbrella.com/api/v2/summary.json', sourceType: 'statuspage' }).url, 'https://status.sse.cisco.com/');\n  assert.equal(resolvePublicSource({ id: 'docker', url: 'https://status.docker.com/api/v2/summary.json', sourceType: 'statuspage' }).url, 'https://www.dockerstatus.com/');\n});\n`;
if (!tests.includes("marketing and release posts are not service incidents")) tests += appendedTests;
write('scripts/__tests__/update-public-status.test.js', tests);

const packagePath = 'package.json';
const packageData = JSON.parse(read(packagePath));
packageData.version = '2.3.9';
write(packagePath, `${JSON.stringify(packageData, null, 2)}\n`);

let lock = read('package-lock.json');
lock = lock.replace('"version": "2.3.8"', '"version": "2.3.9"');
lock = lock.replace('"version": "2.3.8"', '"version": "2.3.9"');
write('package-lock.json', lock);

let changelog = read('CHANGELOG.md');
const release = `## [2.3.9] - 2026-07-31\n\n### Fixed\n\n- Replaced generic incident headings with actual provider incident titles, current details, affected services, regional scope, and timestamps where the official source exposes them.\n- Moved N-able monitoring from its release-news site to the official uptime dashboard and rejected marketing, release-note, and quarterly wrap-up posts.\n- Split N-able and Cove incidents by affected product so unrelated N-central and Cove records cannot contaminate each other.\n- Applied title-first US regional filtering so international-only Cisco Umbrella, Cloudflare, and other incidents are not retained because of unrelated page boilerplate.\n- Added truthful parsers for Cloudflare, Docker, Cisco Umbrella, N-able, and Cove, and made inconclusive generic HTML fail closed instead of publishing fabricated incident text.\n\n`;
if (!changelog.includes('## [2.3.9]')) {
  const marker = '## [2.3.8]';
  if (!changelog.includes(marker)) throw new Error('Changelog release anchor missing');
  changelog = changelog.replace(marker, `${release}${marker}`);
}
write('CHANGELOG.md', changelog);

console.log('Applied incident detail repair for release 2.3.9.');
