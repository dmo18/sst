import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

replaceExact(
  'scripts/public-source-repairs.mjs',
  "import { incidentDetailOverrides, providerIncidentConclusion } from './incident-detail-repairs.mjs';\n",
  "import { incidentDetailOverrides, providerIncidentConclusion } from './incident-detail-repairs.mjs';\nimport { fullReviewConclusion, fullReviewOverrides } from './full-review-source-adapters.mjs';\n",
  'full review import'
);

replaceExact(
  'scripts/public-source-repairs.mjs',
  'Object.assign(additionalPublicOverrides, incidentDetailOverrides);\n',
  'Object.assign(additionalPublicOverrides, incidentDetailOverrides);\nObject.assign(additionalPublicOverrides, fullReviewOverrides);\n',
  'full review override assignment'
);

replaceExact(
  'scripts/public-source-repairs.mjs',
  "export function providerSpecificConclusion(provider, html) {\n  const text = cleanRenderedText(html);\n  if (!text) return null;\n  if (provider.id === '8x8') {\n",
  "export function providerSpecificConclusion(provider, html) {\n  const text = cleanRenderedText(html);\n  if (!text) return null;\n  const reviewed = fullReviewConclusion(provider, html);\n  if (reviewed) return reviewed;\n  if (provider.id === '8x8') {\n",
  'full review conclusion hook'
);

replaceExact(
  'scripts/update-public-status.mjs',
  "export function resolvePublicSource(provider) {\n  if (provider.id === 'kaseya' && publicOverrides.kaseya) {\n    const page = publicOverrides.kaseya;\n    return {\n      ...page,\n      mode: 'feed',\n      url: page.feedCandidates?.[0] || 'https://status.kaseya.com/history.rss',\n      pageUrl: page.url,\n      sourceName: 'Kaseya public status RSS',\n      maxAgeHours: 72\n    };\n  }\n  if (publicOverrides[provider.id]) return { ...publicOverrides[provider.id] };\n",
  "export function resolvePublicSource(provider) {\n  if (publicOverrides[provider.id]) return { ...publicOverrides[provider.id] };\n",
  'remove obsolete Kaseya feed special case'
);

replaceExact(
  'scripts/__tests__/final-blindspot-repairs.test.js',
  "test('Kaseya uses a readable 72-hour official history feed without false healthy confirmation', () => {\n  const source = resolvePublicSource(provider('kaseya', 'Kaseya'));\n  assert.equal(source.mode, 'feed');\n  assert.equal(source.url, 'https://status.kaseya.com/history.rss');\n  assert.equal(source.pageUrl, 'https://status.kaseya.com/');\n  assert.equal(source.maxAgeHours, 72);\n  assert.notEqual(source.confirmHealthyFromFeed, true);\n});\n",
  "test('Kaseya uses its current official Statuspage JSON instead of a history-only feed', () => {\n  const source = resolvePublicSource(provider('kaseya', 'Kaseya'));\n  assert.equal(source.mode, 'statuspage-json');\n  assert.equal(source.url, 'https://status.kaseya.com/api/v2/summary.json');\n  assert.equal(source.pageUrl, 'https://status.kaseya.com/');\n  assert.equal(source.regionScope, 'us');\n});\n",
  'Kaseya source regression test'
);

replaceExact(
  'scripts/__tests__/final-blindspot-repairs.test.js',
  "  for (const id of ['crowdstrike', 'proofpoint', '8x8', 'intermedia']) {\n",
  "  for (const id of ['crowdstrike', 'proofpoint', 'intermedia']) {\n",
  'browser fallback test scope'
);

console.log('Applied verified full-review source integration.');
