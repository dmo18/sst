import test from 'node:test';
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
