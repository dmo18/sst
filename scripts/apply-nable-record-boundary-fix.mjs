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
  "  const markers = [...active.matchAll(/Active Incident ID:\\s*(\\d+)/gi)];\n  const records = [];\n\n  for (let index = 0; index < markers.length; index += 1) {\n    const marker = markers[index];\n    const block = active.slice(marker.index, markers[index + 1]?.index ?? active.length);\n    const id = marker[1];",
  "  const boundaries = [...active.matchAll(/(?:Active Incident|Planned Scheduled Maintenance|Scheduled Maintenance) ID:\\s*(\\d+)/gi)];\n  const records = [];\n\n  for (let index = 0; index < boundaries.length; index += 1) {\n    const marker = boundaries[index];\n    if (!/^Active Incident ID:/i.test(marker[0])) continue;\n    const block = active.slice(marker.index, boundaries[index + 1]?.index ?? active.length);\n    const id = marker[1];",
  'N-able record boundaries'
);
details = replaceOnce(
  details,
  "    const isCove = /\\bcove(?: data protection| draas)?\\b/i.test(`${record.title} ${record.affectedService}`);\n    if (provider.id === 'cove-data-protection' && !isCove) return false;",
  "    const identityText = `${record.title} ${record.affectedService}`;\n    const isCove = /\\bcove(?: data protection| draas)?\\b/i.test(identityText);\n    const isNcentral = /\\bn[- ]?central\\b/i.test(identityText);\n    if (provider.id === 'cove-data-protection' && (!isCove || isNcentral)) return false;",
  'Cove identity guard'
);
write('scripts/incident-detail-repairs.mjs', details);

let tests = read('scripts/__tests__/update-public-status.test.js');
const regression = `\n\ntest('planned maintenance is a hard boundary between N-able active incidents', () => {\n  const fixture = \`<main>Active Incidents\n    Active Incident ID: 401 Start: Jul 15, 2026 15:00:00 UTC End: N/A Severity: Minor Outage Status: Identified\n    N-able N-central (All Regions) Some features may not be functioning as expected.\n    Services Impacted N-central On-premise (Americas) N-central On-premise (APAC) N-central On-premise (Europe)\n    Timeline Update Jul 31, 2026 16:00:00 UTC Engineering is monitoring.\n    Planned Scheduled Maintenance ID: 201444 Start: Aug 1, 2026 07:15:00 UTC End: Aug 1, 2026 10:00:00 UTC Severity: Minor Outage Status: Planning\n    N-able Cove Data Protection Americas Planned storage maintenance.\n    Services Impacted Cove Data Protection (Americas)\n    Resolved Incidents</main>\`;\n  const records = parseNableIncidentRecords(fixture);\n  assert.equal(records.length, 1);\n  assert.match(records[0].title, /N-central/i);\n  assert.doesNotMatch(records[0].affectedService, /Cove|Scheduled Maintenance/i);\n  const cove = providerSpecificConclusion({ id: 'cove-data-protection', name: 'Cove Data Protection' }, fixture);\n  assert.equal(cove.kind, 'healthy');\n  const nable = providerSpecificConclusion({ id: 'n-able', name: 'N-able' }, fixture);\n  assert.equal(nable.kind, 'issues');\n  assert.equal(nable.incidents.length, 1);\n});\n`;
if (!tests.includes('planned maintenance is a hard boundary between N-able active incidents')) tests += regression;
write('scripts/__tests__/update-public-status.test.js', tests);

console.log('Applied N-able record boundary and Cove identity guards.');
