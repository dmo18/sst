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
  "  docusign: ['https://status.docusign.com/api/v2/summary.json', 'DocuSign']\n};",
  "  docusign: ['https://status.docusign.com/api/v2/summary.json', 'DocuSign'],\n  'quickbooks-online': ['https://status.quickbooks.intuit.com/api/v2/summary.json', 'QuickBooks']\n};",
  'QuickBooks structured source override'
);

const catalogPath = 'config/providers.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const quickBooks = catalog.find(provider => provider.id === 'quickbooks-online');
if (!quickBooks) throw new Error('Missing QuickBooks Online provider');
Object.assign(quickBooks, {
  sourceType: 'statuspage',
  url: 'https://status.quickbooks.intuit.com/api/v2/summary.json',
  message: 'Current QuickBooks Online health is read from the official QuickBooks Statuspage JSON summary.'
});
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');

replaceExact(
  'src/payloadValidation.ts',
  "const percentage = (value: unknown): boolean => finiteNonNegative(value) && Number(value) <= 100;\n",
  `const percentage = (value: unknown): boolean => finiteNonNegative(value) && Number(value) <= 100;\n\nfunction componentStatusIsProblem(value: unknown): boolean {\n  const status = String(value || '').trim().toLowerCase().replace(/\\s+/g, '_');\n  if (!status) return false;\n  if (/^(?:operational|available|up|ok|none|good|normal|healthy|not_available|n\\/?a|not_applicable|unknown|under_maintenance|maintenance|scheduled_maintenance|planned_maintenance)$/.test(status)) return false;\n  return /(?:degrad|partial[_-]?outage|major[_-]?outage|outage|unavailable|down|offline|disrupt|impaired|warning|error|failure)/.test(status);\n}\n`,
  'browser component status semantics'
);

replaceExact(
  'src/payloadValidation.ts',
  "    if (summary.affected_provider_count !== new Set(incidents.map(item => item.providerId)).size) errors.push('affected provider count mismatch');",
  "    if (summary.affected_provider_count !== providers.filter(provider => ['degraded', 'major'].includes(String(provider.service_state))).length) errors.push('affected provider count mismatch');",
  'browser affected provider semantics'
);

replaceExact(
  'src/payloadValidation.ts',
  "      component_issue_count: providers.flatMap(provider => Array.isArray(provider.component_status) ? provider.component_status as Record<string, unknown>[] : []).filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component.status || ''))).length,",
  "      component_issue_count: providers.flatMap(provider => Array.isArray(provider.component_status) ? provider.component_status as Record<string, unknown>[] : []).filter(component => componentStatusIsProblem(component.status)).length,",
  'browser component issue reconciliation'
);

const payloadTestPath = 'src/__tests__/payloadValidation.test.ts';
let payloadTests = fs.readFileSync(payloadTestPath, 'utf8');
const payloadRegression = `\ntest('component-only degradation and neutral component states reconcile without an incident record', () => {\n  const x = structuredClone(p);\n  x.providers[0].service_state = 'degraded';\n  x.providers[0].color = 'amber';\n  x.providers[0].attention = 'action';\n  x.providers[0].component_status = [\n    { name: 'Region not applicable', status: 'Not available' },\n    { name: 'Maintenance window', status: 'under_maintenance' },\n    { name: 'API', status: 'degraded_performance' }\n  ];\n  x.summary.service_overall = 'degraded';\n  x.summary.affected_provider_count = 1;\n  x.summary.confirmed_operational_count = 0;\n  x.summary.degraded_count = 1;\n  x.summary.confirmed_operational_percent = 0;\n  x.summary.component_issue_count = 1;\n  assert.deepEqual(payloadValidationErrors(x), []);\n});\n`;
if (payloadTests.includes("component-only degradation and neutral component states reconcile")) throw new Error('Payload validator regression already exists');
payloadTests += payloadRegression;
fs.writeFileSync(payloadTestPath, payloadTests);

const deepTestPath = 'scripts/__tests__/deep-review-regressions.test.js';
let deepTests = fs.readFileSync(deepTestPath, 'utf8');
if (!deepTests.includes("import { resolvePublicSource")) {
  deepTests = deepTests.replace(
    "import { reconcileProviderIncidentEvidence, tryFeedCandidates } from '../update-public-status.mjs';",
    "import { reconcileProviderIncidentEvidence, resolvePublicSource, tryFeedCandidates } from '../update-public-status.mjs';"
  );
}
const quickBooksRegression = `\ntest('QuickBooks Online uses the current official Statuspage JSON summary', () => {\n  const source = resolvePublicSource({ id: 'quickbooks-online', name: 'QuickBooks Online', category: 'Accounting', sourceType: 'statuspage', url: 'https://status.quickbooks.intuit.com/api/v2/summary.json' });\n  assert.equal(source.mode, 'statuspage-json');\n  assert.equal(source.url, 'https://status.quickbooks.intuit.com/api/v2/summary.json');\n  const result = parseStatuspageSummary(JSON.stringify({\n    page: { id: 'quickbooks', name: 'QuickBooks', url: 'https://status.quickbooks.intuit.com' },\n    status: { indicator: 'none', description: 'All Systems Operational' },\n    components: [\n      { name: 'United States', group_id: 'qbo', status: 'operational' },\n      { name: 'EMEA', group_id: 'qbo', status: 'major_outage' }\n    ],\n    incidents: [],\n    scheduled_maintenances: []\n  }), { id: 'quickbooks-online', name: 'QuickBooks Online' }, source);\n  assert.equal(result.kind, 'healthy');\n  assert.deepEqual(result.components.map(item => item.name), ['United States']);\n});\n`;
if (deepTests.includes('QuickBooks Online uses the current official Statuspage JSON summary')) throw new Error('QuickBooks regression already exists');
deepTests += quickBooksRegression;
fs.writeFileSync(deepTestPath, deepTests);

console.log('Applied browser validator and QuickBooks structured-source repairs.');
