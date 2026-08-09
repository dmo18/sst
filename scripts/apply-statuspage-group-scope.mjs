import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

replaceExact(
  'scripts/structured-source-adapters.mjs',
  `function componentRecords(values, limit = 512) {\n  const records = [];\n  const seen = new Set();\n  for (const component of Array.isArray(values) ? values : []) {\n    const name = clean(component?.name || component?.display_name || component?.public_name || component?.id);\n    if (!name || seen.has(name.toLowerCase())) continue;\n    seen.add(name.toLowerCase());\n    records.push({\n      name,\n      status: clean(component?.status || component?.state || 'unknown').toLowerCase().replace(/\\s+/g, '_'),\n      group: clean(component?.group_name || component?.group || component?.group_id || '')\n    });\n    if (records.length >= limit) break;\n  }\n  return records;\n}`,
  `function componentRecords(values, limit = 512) {\n  const source = Array.isArray(values) ? values : [];\n  const groupNames = new Map();\n  for (const component of source) {\n    if (component?.group === true && component?.id) {\n      const groupName = clean(component?.name || component?.display_name || component?.public_name || '');\n      if (groupName) groupNames.set(String(component.id), groupName);\n    }\n  }\n\n  const records = [];\n  const seen = new Set();\n  for (const component of source) {\n    const name = clean(component?.name || component?.display_name || component?.public_name || component?.id);\n    if (!name || seen.has(name.toLowerCase())) continue;\n    seen.add(name.toLowerCase());\n    const groupId = component?.group_id ? String(component.group_id) : '';\n    const resolvedGroup = clean(component?.group_name || (component?.group === true ? name : '') || groupNames.get(groupId) || '');\n    records.push({\n      name,\n      status: clean(component?.status || component?.state || 'unknown').toLowerCase().replace(/\\s+/g, '_'),\n      group: resolvedGroup\n    });\n    if (records.length >= limit) break;\n  }\n  return records;\n}`,
  'Statuspage component group resolution'
);

const testPath = 'scripts/__tests__/production-invariant-audit.test.js';
let tests = fs.readFileSync(testPath, 'utf8');
const importBefore = "import { parseSalesforcePage } from '../structured-source-adapters.mjs';";
const importAfter = "import { parseSalesforcePage, parseStatuspageSummary } from '../structured-source-adapters.mjs';";
if (!tests.includes(importBefore)) throw new Error('Missing structured adapter test import');
tests = tests.replace(importBefore, importAfter);
tests += `\n\ntest('Statuspage child components inherit named geographic groups before US filtering', () => {\n  const result = parseStatuspageSummary(JSON.stringify({\n    page: { name: 'Cloudflare', url: 'https://www.cloudflarestatus.com/' },\n    status: { indicator: 'minor', description: 'Partial System Outage' },\n    components: [\n      { id: 'na', name: 'North America', status: 'partial_outage', group: true, group_id: null },\n      { id: 'useast', name: 'Ashburn, VA - (IAD)', status: 'partial_outage', group: false, group_id: 'na' },\n      { id: 'me', name: 'Middle East', status: 'partial_outage', group: true, group_id: null },\n      { id: 'ramallah', name: 'Ramallah - (ZDM)', status: 'partial_outage', group: false, group_id: 'me' }\n    ],\n    incidents: [],\n    scheduled_maintenances: []\n  }), { id: 'cloudflare', name: 'Cloudflare' }, { regionScope: 'us', pageUrl: 'https://www.cloudflarestatus.com/' });\n\n  assert.equal(result.kind, 'component-state');\n  const names = result.components.map(component => component.name);\n  assert.ok(names.includes('North America'));\n  assert.ok(names.includes('Ashburn, VA - (IAD)'));\n  assert.ok(!names.includes('Middle East'));\n  assert.ok(!names.includes('Ramallah - (ZDM)'));\n  assert.equal(result.components.find(component => component.name === 'Ashburn, VA - (IAD)')?.group, 'North America');\n});\n`;
fs.writeFileSync(testPath, tests);
console.log('Applied Statuspage group scope repair.');
