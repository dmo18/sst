import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

function auth0NextData(value) {
  const match = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(String(value || ''));
  if (!match?.[1]) return null;
  try {
    const json = JSON.parse(match[1]);
    return json && typeof json === 'object' ? json : null;
  } catch {
    return null;
  }
}

function auth0CurrentRecord(row) {
  const records = Array.isArray(row?.response?.incidents) ? row.response.incidents : [];
  const live = records.filter(record => record && typeof record === 'object' && !record.resolved_at);
  if (!live.length) return null;
  const impacted = live.filter(record => !/^(?:operational|resolved|completed)$/i.test(clean(record.status)) || !/^(?:none|)$/i.test(clean(record.impact)));
  return impacted[0] || live[0];
}

function auth0Operational(record) {
  return Boolean(record)
    && /^(?:operational|resolved|completed)$/i.test(clean(record.status))
    && /^(?:none|)$/i.test(clean(record.impact))
    && !record.scheduled_for;
}

function auth0Maintenance(record) {
  return Boolean(record) && (/\b(?:scheduled|maintenance)\b/i.test(clean(record.status)) || Boolean(record.scheduled_for));
}

function parseAuth0NextData(value, provider = {}, source = {}) {
  const json = auth0NextData(value);
  const rows = json?.props?.pageProps?.activeIncidents;
  if (!Array.isArray(rows)) return null;

  const currentUs = rows.filter(row => /^US(?:-\d+)?$/i.test(clean(row?.region)) && /^Production$/i.test(clean(row?.environment)));
  if (!currentUs.length) return null;

  const components = [];
  const problems = [];
  const maintenance = [];

  for (const row of currentUs) {
    const region = clean(row.region);
    const record = auth0CurrentRecord(row);
    if (!record) {
      components.push({ name: region, status: 'unknown' });
      continue;
    }

    if (auth0Maintenance(record) && !/\b(?:outage|degrad|disrupt|unavailable|error|failure)\b/i.test(clean(record.name))) {
      components.push({ name: region, status: 'operational' });
      maintenance.push({
        id: String(record.id || region),
        title: clean(record.name || 'Auth0 scheduled maintenance'),
        note: 'Auth0 reports scheduled maintenance for ' + region + '.',
        status: 'scheduled',
        startsAt: record.scheduled_for || '',
        latestUpdate: record.updated_at || '',
        affectedService: region,
        url: source.pageUrl || source.url || 'https://status.auth0.com/'
      });
      continue;
    }

    if (auth0Operational(record)) {
      components.push({ name: region, status: 'operational' });
      continue;
    }

    const severityText = String(record.impact || '') + ' ' + String(record.status || '') + ' ' + String(record.name || '');
    const major = /\b(?:critical|major|major outage|complete outage|unavailable|down)\b/i.test(severityText);
    const status = major ? 'major_outage' : 'degraded_performance';
    components.push({ name: region, status });
    problems.push({ region, record, major });
  }

  if (problems.length) {
    const color = problems.some(problem => problem.major) ? 'red' : 'amber';
    const message = problems.map(({ region, record }) => {
      const state = [clean(record.status), clean(record.impact)].filter(Boolean).join(', ');
      const updated = toIso(record.updated_at || '');
      let text = region + ': ' + clean(record.name || 'current service impact');
      if (state) text += ' (' + state + ')';
      if (updated) text += '; vendor snapshot updated ' + updated;
      return text;
    }).join('; ');
    return {
      kind: 'component-state',
      status: 'Auth0 reports current US Public Cloud service impact',
      color,
      message,
      components,
      maintenance
    };
  }

  const unknownComponents = components.filter(component => component.status === 'unknown');
  if (unknownComponents.length) {
    return {
      kind: 'limited',
      message: 'Auth0 server status data omitted a current status record for ' + unknownComponents.map(component => component.name).join(', ') + '.',
      components,
      maintenance
    };
  }

  return {
    kind: 'healthy',
    status: 'Auth0 reports all US Public Cloud regions operational',
    components,
    maintenance
  };
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
const auth0Parser = [
  auth0NextData.toString(),
  auth0CurrentRecord.toString(),
  auth0Operational.toString(),
  auth0Maintenance.toString(),
  parseAuth0NextData.toString().replace(/^function /, 'export function ')
].join('\n\n') + '\n\n';
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
  "export function schemaFingerprint(value, mode = '') {\n  const text = String(value || '');\n  if (!text) return '';\n  if (mode === 'auth0-next-data') {\n    const match = /<script[^>]+id=[\"']__NEXT_DATA__[\"'][^>]*>([\\s\\S]*?)<\\/script>/i.exec(text);\n    if (!match?.[1]) return '';\n    try {\n      return 'json-' + hashString(jsonShape(JSON.parse(match[1])));\n    } catch {\n      return '';\n    }\n  }\n  if (structuredModes.has(mode) || /json/i.test(mode)) {",
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
const tests = `import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuth0NextData, structuredSourceOverrides } from '../structured-source-adapters.mjs';
import { resolvePublicSource } from '../update-public-status.mjs';
import { schemaFingerprint, sourceEvidence } from '../source-intelligence.mjs';

function page(activeIncidents) {
  const json = { props: { pageProps: { activeIncidents } }, page: '/', query: { environment: 'Production', region: 'US' } };
  return '<html><body><h1>Auth0 Status</h1><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify(json) + '</script></body></html>';
}

function row(region, incident, environment = 'Production') {
  return { region, environment, response: { uptime: '99.99%', incidents: [incident] } };
}

const operational = updated_at => ({ status: 'operational', name: 'All Systems Operational', id: '', updated_at, resolved_at: null, scheduled_for: null, impact: 'none', isPrivate: false });

test('Auth0 uses the official server-rendered structured snapshot without browser fallback', () => {
  const source = resolvePublicSource({ id: 'auth0', name: 'Auth0', sourceType: 'auth0-next-data', url: 'https://status.auth0.com/?environment=Production&region=US' });
  assert.equal(source.mode, 'auth0-next-data');
  assert.equal(source.render, false);
  assert.equal(source.discoverFeeds, false);
  assert.equal(source.url, 'https://status.auth0.com/?environment=Production&region=US');
  assert.equal(structuredSourceOverrides.auth0.mode, 'auth0-next-data');
});

test('Auth0 current US service impact wins over operational regions and ignores foreign regions', () => {
  const html = page([
    row('US-1', operational('2026-08-09T01:29:53Z')),
    row('US-3', operational('2026-08-09T01:29:53Z')),
    row('US-4', operational('2026-08-09T01:29:53Z')),
    row('US-5', { status: 'investigating', name: 'Tenant Logs and Group Memberships Impacted on US-5 Public Cloud', id: 's6nmyrpsnbmj', updated_at: '2026-01-01T00:00:00Z', resolved_at: null, scheduled_for: null, impact: 'minor', isPrivate: false }),
    row('EU-1', { status: 'major_outage', name: 'European outage', id: 'eu', updated_at: '2026-08-09T01:29:53Z', resolved_at: null, scheduled_for: null, impact: 'critical', isPrivate: false })
  ]);
  const result = parseAuth0NextData(html, { id: 'auth0', name: 'Auth0' }, structuredSourceOverrides.auth0);
  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.match(result.message, /US-5: Tenant Logs and Group Memberships/);
  assert.equal(result.components.length, 4);
  assert.equal(result.components.find(component => component.name === 'US-5').status, 'degraded_performance');
  assert.equal(result.components.some(component => component.name === 'EU-1'), false);
});

test('Auth0 all-US operational snapshot is explicit healthy even if a foreign region is degraded', () => {
  const html = page([
    row('US-1', operational('2026-08-09T01:29:53Z')),
    row('US-3', operational('2026-08-09T01:29:53Z')),
    row('US-4', operational('2026-08-09T01:29:53Z')),
    row('US-5', operational('2026-08-09T01:29:53Z')),
    row('EU-1', { status: 'major_outage', name: 'European outage', id: 'eu', updated_at: '2026-08-09T01:29:53Z', resolved_at: null, scheduled_for: null, impact: 'critical', isPrivate: false })
  ]);
  const result = parseAuth0NextData(html, { id: 'auth0', name: 'Auth0' }, structuredSourceOverrides.auth0);
  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'Auth0 reports all US Public Cloud regions operational');
  assert.equal(result.components.length, 4);
});

test('Auth0 structured snapshot fails closed when a US region lacks a current record', () => {
  const html = page([row('US-1', operational('2026-08-09T01:29:53Z')), { region: 'US-5', environment: 'Production', response: { uptime: '99.9%', incidents: [] } }]);
  const result = parseAuth0NextData(html, { id: 'auth0', name: 'Auth0' }, structuredSourceOverrides.auth0);
  assert.equal(result.kind, 'limited');
  assert.match(result.message, /US-5/);
});

test('Auth0 embedded JSON is high-confidence structured evidence with a schema fingerprint', () => {
  const html = page([row('US-1', operational('2026-08-09T01:29:53Z'))]);
  assert.match(schemaFingerprint(html, 'auth0-next-data'), /^json-/);
  const evidence = sourceEvidence('auth0-next-data', 'available', true);
  assert.equal(evidence.evidence_tier, 'structured');
  assert.equal(evidence.source_confidence, 'high');
});
`;
fs.writeFileSync(testPath, tests);

console.log('Applied Auth0 server structured status adapter.');
