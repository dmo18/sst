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
  `structuredSourceOverrides.auth0 = {\n  mode: 'status-html',\n  url: 'https://status.auth0.com/?environment=Production&region=US',\n  pageUrl: 'https://status.auth0.com/',\n  sourceName: 'Auth0 official public cloud status page',\n  render: true,\n  regionScope: 'us'\n};`,
  `structuredSourceOverrides.auth0 = {\n  mode: 'auth0-next-data',\n  url: 'https://status.auth0.com/?environment=Production&region=US',\n  pageUrl: 'https://status.auth0.com/',\n  sourceName: 'Auth0 official Public Cloud server status data',\n  render: false,\n  discoverFeeds: false,\n  regionScope: 'us'\n};`,
  'Auth0 structured source override'
);

const parserMarker = 'export function parseStatuspageSummary(value, provider = {}, source = {}) {';
const structuredPath = 'scripts/structured-source-adapters.mjs';
let structured = fs.readFileSync(structuredPath, 'utf8');
if (!structured.includes(parserMarker)) throw new Error('Missing structured parser marker');
const auth0Parser = `function auth0NextData(value) {\n  const match = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\\s\\S]*?)<\\/script>/i.exec(String(value || ''));\n  if (!match?.[1]) return null;\n  try {\n    const json = JSON.parse(match[1]);\n    return json && typeof json === 'object' ? json : null;\n  } catch {\n    return null;\n  }\n}\n\nfunction auth0CurrentRecord(row) {\n  const records = Array.isArray(row?.response?.incidents) ? row.response.incidents : [];\n  const live = records.filter(record => record && typeof record === 'object' && !record.resolved_at);\n  if (!live.length) return null;\n  const impacted = live.filter(record => !/^(?:operational|resolved|completed)$/i.test(clean(record.status)) || !/^(?:none|)$/i.test(clean(record.impact)));\n  return impacted[0] || live[0];\n}\n\nfunction auth0Operational(record) {\n  return Boolean(record)\n    && /^(?:operational|resolved|completed)$/i.test(clean(record.status))\n    && /^(?:none|)$/i.test(clean(record.impact))\n    && !record.scheduled_for;\n}\n\nfunction auth0Maintenance(record) {\n  return Boolean(record) && (/\\b(?:scheduled|maintenance)\\b/i.test(clean(record.status)) || Boolean(record.scheduled_for));\n}\n\nexport function parseAuth0NextData(value, provider = {}, source = {}) {\n  const json = auth0NextData(value);\n  const rows = json?.props?.pageProps?.activeIncidents;\n  if (!Array.isArray(rows)) return null;\n\n  const currentUs = rows.filter(row => /^US(?:-\\d+)?$/i.test(clean(row?.region)) && /^Production$/i.test(clean(row?.environment)));\n  if (!currentUs.length) return null;\n\n  const components = [];\n  const problems = [];\n  const maintenance = [];\n\n  for (const row of currentUs) {\n    const region = clean(row.region);\n    const record = auth0CurrentRecord(row);\n    if (!record) {\n      components.push({ name: region, status: 'unknown' });\n      continue;\n    }\n\n    if (auth0Maintenance(record) && !/\\b(?:outage|degrad|disrupt|unavailable|error|failure)\\b/i.test(clean(record.name))) {\n      components.push({ name: region, status: 'operational' });\n      maintenance.push({\n        id: String(record.id || region),\n        title: clean(record.name || 'Auth0 scheduled maintenance'),\n        note: \\`Auth0 reports scheduled maintenance for \\${region}.\\`,\n        status: 'scheduled',\n        startsAt: record.scheduled_for || '',\n        latestUpdate: record.updated_at || '',\n        affectedService: region,\n        url: source.pageUrl || source.url || 'https://status.auth0.com/'\n      });\n      continue;\n    }\n\n    if (auth0Operational(record)) {\n      components.push({ name: region, status: 'operational' });\n      continue;\n    }\n\n    const severityText = \\`\\${record.impact || ''} \\${record.status || ''} \\${record.name || ''}\\`;\n    const major = /\\b(?:critical|major|major outage|complete outage|unavailable|down)\\b/i.test(severityText);\n    const status = major ? 'major_outage' : 'degraded_performance';\n    components.push({ name: region, status });\n    problems.push({ region, record, major });\n  }\n\n  if (problems.length) {\n    const color = problems.some(problem => problem.major) ? 'red' : 'amber';\n    const message = problems.map(({ region, record }) => {\n      const state = [clean(record.status), clean(record.impact)].filter(Boolean).join(', ');\n      const updated = toIso(record.updated_at || '');\n      return \\`\\${region}: \\${clean(record.name || 'current service impact')}\\${state ? \\` (\\${state})\\` : ''}\\${updated ? \\`; vendor snapshot updated \\${updated}\\` : ''}\\`;\n    }).join('; ');\n    return {\n      kind: 'component-state',\n      status: 'Auth0 reports current US Public Cloud service impact',\n      color,\n      message,\n      components,\n      maintenance\n    };\n  }\n\n  const unknownComponents = components.filter(component => component.status === 'unknown');\n  if (unknownComponents.length) {\n    return {\n      kind: 'limited',\n      message: \\`Auth0 server status data omitted a current status record for \\${unknownComponents.map(component => component.name).join(', ')}.\\`,\n      components,\n      maintenance\n    };\n  }\n\n  return {\n    kind: 'healthy',\n    status: 'Auth0 reports all US Public Cloud regions operational',\n    components,\n    maintenance\n  };\n}\n\n`;
structured = structured.replace(parserMarker, auth0Parser + parserMarker);
structured = structured.replace(
  "  if (mode === 'statuspage-json') return parseStatuspageSummary(value, provider, { ...structuredSourceOverrides[provider?.id], ...source });",
  "  if (mode === 'auth0-next-data') return parseAuth0NextData(value, provider, { ...structuredSourceOverrides[provider?.id], ...source });\n  if (mode === 'statuspage-json') return parseStatuspageSummary(value, provider, { ...structuredSourceOverrides[provider?.id], ...source });"
);
fs.writeFileSync(structuredPath, structured);

replaceExact(
  'scripts/source-intelligence.mjs',
  "const structuredModes = new Set(['statuspage-json', 'betterstack-json', 'provider-json']);",
  "const structuredModes = new Set(['statuspage-json', 'betterstack-json', 'provider-json', 'auth0-next-data']);",
  'Auth0 structured evidence tier'
);

replaceExact(
  'scripts/source-intelligence.mjs',
  "export function schemaFingerprint(value, mode = '') {\n  const text = String(value || '');\n  if (!text) return '';\n  if (structuredModes.has(mode) || /json/i.test(mode)) {",
  `export function schemaFingerprint(value, mode = '') {\n  const text = String(value || '');\n  if (!text) return '';\n  if (mode === 'auth0-next-data') {\n    const match = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\\s\\S]*?)<\\/script>/i.exec(text);\n    if (!match?.[1]) return '';\n    try {\n      return \\`json-\\${hashString(jsonShape(JSON.parse(match[1])))}\\`;\n    } catch {\n      return '';\n    }\n  }\n  if (structuredModes.has(mode) || /json/i.test(mode)) {`,
  'Auth0 embedded JSON schema fingerprint'
);

replaceExact(
  'scripts/validate-providers.mjs',
  "    'azure-status-html'\n]);",
  "    'azure-status-html',\n    'auth0-next-data'\n]);",
  'Auth0 catalog source type allowance'
);

const catalogPath = 'config/providers.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const auth0 = catalog.find(provider => provider.id === 'auth0');
if (!auth0) throw new Error('Missing Auth0 provider');
Object.assign(auth0, {
  sourceType: 'auth0-next-data',
  url: 'https://status.auth0.com/?environment=Production&region=US',
  message: 'Current Auth0 US Public Cloud health is read from the official server-rendered structured status snapshot.'
});
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');

const testPath = 'scripts/__tests__/auth0-next-data.test.js';
const tests = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { parseAuth0NextData, structuredSourceOverrides } from '../structured-source-adapters.mjs';\nimport { resolvePublicSource } from '../update-public-status.mjs';\nimport { schemaFingerprint, sourceEvidence } from '../source-intelligence.mjs';\n\nfunction page(activeIncidents) {\n  const json = { props: { pageProps: { activeIncidents } }, page: '/', query: { environment: 'Production', region: 'US' } };\n  return \\`<html><body><h1>Auth0 Status</h1><script id="__NEXT_DATA__" type="application/json">\\${JSON.stringify(json)}</script></body></html>\\`;\n}\n\nfunction row(region, incident, environment = 'Production') {\n  return { region, environment, response: { uptime: '99.99%', incidents: [incident] } };\n}\n\nconst operational = updated_at => ({ status: 'operational', name: 'All Systems Operational', id: '', updated_at, resolved_at: null, scheduled_for: null, impact: 'none', isPrivate: false });\n\ntest('Auth0 uses the official server-rendered structured snapshot without browser fallback', () => {\n  const source = resolvePublicSource({ id: 'auth0', name: 'Auth0', sourceType: 'auth0-next-data', url: 'https://status.auth0.com/?environment=Production&region=US' });\n  assert.equal(source.mode, 'auth0-next-data');\n  assert.equal(source.render, false);\n  assert.equal(source.discoverFeeds, false);\n  assert.equal(source.url, 'https://status.auth0.com/?environment=Production&region=US');\n  assert.equal(structuredSourceOverrides.auth0.mode, 'auth0-next-data');\n});\n\ntest('Auth0 current US service impact wins over operational regions and ignores foreign regions', () => {\n  const html = page([\n    row('US-1', operational('2026-08-09T01:29:53Z')),\n    row('US-3', operational('2026-08-09T01:29:53Z')),\n    row('US-4', operational('2026-08-09T01:29:53Z')),\n    row('US-5', { status: 'investigating', name: 'Tenant Logs and Group Memberships Impacted on US-5 Public Cloud', id: 's6nmyrpsnbmj', updated_at: '2026-01-01T00:00:00Z', resolved_at: null, scheduled_for: null, impact: 'minor', isPrivate: false }),\n    row('EU-1', { status: 'major_outage', name: 'European outage', id: 'eu', updated_at: '2026-08-09T01:29:53Z', resolved_at: null, scheduled_for: null, impact: 'critical', isPrivate: false })\n  ]);\n  const result = parseAuth0NextData(html, { id: 'auth0', name: 'Auth0' }, structuredSourceOverrides.auth0);\n  assert.equal(result.kind, 'component-state');\n  assert.equal(result.color, 'amber');\n  assert.match(result.message, /US-5: Tenant Logs and Group Memberships/);\n  assert.equal(result.components.length, 4);\n  assert.equal(result.components.find(component => component.name === 'US-5').status, 'degraded_performance');\n  assert.equal(result.components.some(component => component.name === 'EU-1'), false);\n});\n\ntest('Auth0 all-US operational snapshot is explicit healthy even if a foreign region is degraded', () => {\n  const html = page([\n    row('US-1', operational('2026-08-09T01:29:53Z')),\n    row('US-3', operational('2026-08-09T01:29:53Z')),\n    row('US-4', operational('2026-08-09T01:29:53Z')),\n    row('US-5', operational('2026-08-09T01:29:53Z')),\n    row('EU-1', { status: 'major_outage', name: 'European outage', id: 'eu', updated_at: '2026-08-09T01:29:53Z', resolved_at: null, scheduled_for: null, impact: 'critical', isPrivate: false })\n  ]);\n  const result = parseAuth0NextData(html, { id: 'auth0', name: 'Auth0' }, structuredSourceOverrides.auth0);\n  assert.equal(result.kind, 'healthy');\n  assert.equal(result.status, 'Auth0 reports all US Public Cloud regions operational');\n  assert.equal(result.components.length, 4);\n});\n\ntest('Auth0 structured snapshot fails closed when a US region lacks a current record', () => {\n  const html = page([row('US-1', operational('2026-08-09T01:29:53Z')), { region: 'US-5', environment: 'Production', response: { uptime: '99.9%', incidents: [] } }]);\n  const result = parseAuth0NextData(html, { id: 'auth0', name: 'Auth0' }, structuredSourceOverrides.auth0);\n  assert.equal(result.kind, 'limited');\n  assert.match(result.message, /US-5/);\n});\n\ntest('Auth0 embedded JSON is high-confidence structured evidence with a schema fingerprint', () => {\n  const html = page([row('US-1', operational('2026-08-09T01:29:53Z'))]);\n  assert.match(schemaFingerprint(html, 'auth0-next-data'), /^json-/);\n  const evidence = sourceEvidence('auth0-next-data', 'available', true);\n  assert.equal(evidence.evidence_tier, 'structured');\n  assert.equal(evidence.source_confidence, 'high');\n});\n`;
fs.writeFileSync(testPath, tests);

console.log('Applied Auth0 server structured status adapter.');
