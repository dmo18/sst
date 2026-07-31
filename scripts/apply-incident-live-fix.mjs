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

let details = read('scripts/incident-detail-repairs.mjs');
details = replaceOnce(
  details,
  "    sourceName: 'Docker public systems status page',\n    regionScope: 'us'",
  "    sourceName: 'Docker public systems status page',\n    render: true,\n    regionScope: 'us'",
  'Docker rendered source'
);
write('scripts/incident-detail-repairs.mjs', details);

let generator = read('scripts/update-public-status.mjs');
generator = replaceOnce(
  generator,
  "async function parsePublicHtml(provider, source) {\n  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };\n  const result = await fetchSource(requestProvider, 'text/html, text/plain, */*');\n  const logs = result.logs || [result.log];",
  "const publicHtmlRequestCache = new Map();\n\nasync function fetchPublicHtml(requestProvider) {\n  const accept = 'text/html, text/plain, */*';\n  const key = `${requestProvider.url}|${accept}`;\n  if (!publicHtmlRequestCache.has(key)) {\n    publicHtmlRequestCache.set(key, fetchSource(requestProvider, accept));\n  }\n  return publicHtmlRequestCache.get(key);\n}\n\nasync function parsePublicHtml(provider, source) {\n  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };\n  const result = await fetchPublicHtml(requestProvider);\n  const logs = [...(result.logs || [result.log])];",
  'shared public HTML request cache'
);
generator = replaceOnce(
  generator,
  "  if (conclusion.kind === 'limited' && source.render === true) {",
  "  if ((conclusion.kind === 'limited' || (conclusion.kind === 'issue' && isGenericIncidentTitle(conclusion.title))) && source.render === true) {",
  'render generic shell before classification'
);
write('scripts/update-public-status.mjs', generator);

let tests = read('scripts/__tests__/update-public-status.test.js');
tests = replaceOnce(
  tests,
  "  assert.equal(resolvePublicSource({ id: 'docker', url: 'https://status.docker.com/api/v2/summary.json', sourceType: 'statuspage' }).url, 'https://www.dockerstatus.com/');",
  "  const dockerSource = resolvePublicSource({ id: 'docker', url: 'https://status.docker.com/api/v2/summary.json', sourceType: 'statuspage' });\n  assert.equal(dockerSource.url, 'https://www.dockerstatus.com/');\n  assert.equal(dockerSource.render, true);",
  'Docker rendered source assertion'
);
const cacheTest = `\n\ntest('N-able and Cove share one public uptime page request without mixing incidents', async () => {\n  const fixture = \`<main>Active Incidents\n    Active Incident ID: 301 Start: Jul 31, 2026 15:00:00 UTC End: N/A Severity: Minor Outage Status: Investigating\n    N-able N-central (All Regions) Customers may see delayed policy updates.\n    Services Impacted N-central (All Regions) Timeline Update Jul 31, 2026 16:00:00 UTC Mitigation is in progress.\n    Active Incident ID: 302 Start: Jul 31, 2026 15:30:00 UTC End: N/A Severity: Minor Outage Status: Identified\n    N-able Cove Data Protection Americas Customers may see delayed backup jobs.\n    Services Impacted Cove Data Protection (Americas) Timeline Update Jul 31, 2026 16:10:00 UTC Mitigation is in progress.\n    Resolved Incidents</main>\`;\n  let fetches = 0;\n  globalThis.fetch = async () => {\n    fetches += 1;\n    return response(fixture);\n  };\n  const [nable, cove] = await Promise.all([\n    loadPublicProvider({ id: 'n-able', name: 'N-able', category: 'MSP Platforms', priority: 86, sourceType: 'statuspage', url: 'https://status.n-able.com/api/v2/summary.json' }),\n    loadPublicProvider({ id: 'cove-data-protection', name: 'Cove Data Protection', category: 'Backup', priority: 78, sourceType: 'statuspage', url: 'https://status.covedataprotection.com/api/v2/summary.json' })\n  ]);\n  assert.equal(fetches, 1);\n  assert.equal(nable.incidents.length, 1);\n  assert.match(nable.incidents[0].title, /N-central/i);\n  assert.doesNotMatch(nable.incidents[0].note, /Cove Data Protection/i);\n  assert.equal(cove.incidents.length, 1);\n  assert.match(cove.incidents[0].title, /Cove Data Protection Americas/i);\n  assert.doesNotMatch(cove.incidents[0].note, /N-central/i);\n});\n`;
if (!tests.includes('N-able and Cove share one public uptime page request')) tests += cacheTest;
write('scripts/__tests__/update-public-status.test.js', tests);

console.log('Applied Docker render and shared N-able uptime fetch repair.');
