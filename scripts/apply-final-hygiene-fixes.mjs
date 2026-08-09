import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

replaceExact(
  'scripts/update-public-status.mjs',
  `  'quickbooks-online': {\n    mode: 'status-html',\n    url: 'https://status.quickbooks.intuit.com/',\n    feedCandidates: [\n      'https://status.quickbooks.intuit.com/history.rss',\n      'https://status.quickbooks.intuit.com/history.atom'\n    ],\n    sourceName: 'QuickBooks public status page'\n  },\n`,
  '',
  'obsolete QuickBooks HTML and history fallback'
);

replaceExact(
  'scripts/public-source-repairs.mjs',
  "import { fullReviewConclusion, fullReviewOverrides } from './full-review-source-adapters.mjs';\n",
  "import { fullReviewConclusion, fullReviewOverrides } from './full-review-source-adapters.mjs';\nimport { regionScopeRelevant } from './region-scope.mjs';\n",
  'shared region scope import'
);

replaceExact(
  'scripts/public-source-repairs.mjs',
  `const globalRegionPattern = /\\b(?:global|worldwide|all regions|all customers|multiple regions|across regions)\\b/i;\nconst usRegionPattern = /\\b(?:united states|u\\.s\\.|usa|us|us customers?|us cells?|north america|america east|america west|us[- ](?:east|west|central|north|south)(?:[- ]\\d+)?|us(?:e|w|c)\\d+)\\b|\\bokta\\.com:\\d+\\b|\\boktapreview\\.com:\\d+\\b/i;\nconst nonUsRegionPattern = /\\b(?:emea|europe|eu(?:rope)?(?:[- ]?(?:cell|region|zone))?[- ]?\\d*|uk(?:[- ]?(?:cell|region|zone))?[- ]?\\d*|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|germany|german|france|spain|japan|singapore|india|brazil|okta-emea\\.com:\\d+)\\b|\\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)\\d+(?:[-_a-z0-9]*)\\b/i;\n\nexport function isUsRelevantIncident(value) {\n  const text = cleanRenderedText(value);\n  if (!text) return true;\n  if (globalRegionPattern.test(text) || usRegionPattern.test(text)) return true;\n  return !nonUsRegionPattern.test(text);\n}\n`,
  `export function isUsRelevantIncident(value) {\n  return regionScopeRelevant('', cleanRenderedText(value), 'us');\n}\n`,
  'duplicate provider-specific region policy'
);

const deepTestPath = 'scripts/__tests__/deep-review-regressions.test.js';
let deepTests = fs.readFileSync(deepTestPath, 'utf8');
if (!deepTests.includes("isUsRelevantIncident")) {
  deepTests = deepTests.replace(
    "import { parseNableIncidentRecords } from '../incident-detail-repairs.mjs';",
    "import { parseNableIncidentRecords } from '../incident-detail-repairs.mjs';\nimport { isUsRelevantIncident } from '../public-source-repairs.mjs';"
  );
}
const regression = `\ntest('provider-specific region filtering shares the canonical US scope policy', () => {\n  assert.equal(isUsRelevantIncident('Arica, Chile - (ARI) service disruption'), false);\n  assert.equal(isUsRelevantIncident('Autotask UK cell service degradation'), false);\n  assert.equal(isUsRelevantIncident('AWS EC2 Health: me-south-1'), false);\n  assert.equal(isUsRelevantIncident('GCP northamerica-northeast1'), false);\n  assert.equal(isUsRelevantIncident('Ashburn, VA, United States - (IAD) service disruption'), true);\n  assert.equal(isUsRelevantIncident('AWS EC2 Health: us-east-1'), true);\n  assert.equal(isUsRelevantIncident('Global service disruption'), true);\n});\n`;
if (!deepTests.includes('provider-specific region filtering shares the canonical US scope policy')) deepTests += regression;
fs.writeFileSync(deepTestPath, deepTests);

const hygienePath = 'scripts/__tests__/final-public-health-hygiene.test.js';
let hygiene = fs.readFileSync(hygienePath, 'utf8');
hygiene = hygiene.replace(
  "  assert.equal(policy.includes(\"'quickbooks-online': {\\n    mode: 'status-html'\"), false);\n",
  "  assert.equal(policy.includes(\"'quickbooks-online': {\\n    mode: 'status-html'\"), false);\n  assert.equal(policy.includes('https://status.quickbooks.intuit.com/history.rss'), false);\n  assert.equal(policy.includes('https://status.quickbooks.intuit.com/history.atom'), false);\n"
);
const sharedPolicyTest = `\ntest('provider-specific conclusions use the shared region-scope implementation', () => {\n  const source = read('scripts/public-source-repairs.mjs');\n  assert.match(source, /regionScopeRelevant/);\n  assert.equal(source.includes('const usRegionPattern'), false);\n  assert.equal(source.includes('const nonUsRegionPattern'), false);\n});\n`;
if (!hygiene.includes('provider-specific conclusions use the shared region-scope implementation')) hygiene += sharedPolicyTest;
fs.writeFileSync(hygienePath, hygiene);

console.log('Applied final source hygiene and shared region-policy repairs.');
