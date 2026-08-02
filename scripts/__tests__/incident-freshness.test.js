import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { activeIncident } from '../update-status.mjs';
import { dateLikeIncidentTitle, incidentEvidenceIsCurrent, incidentRegionIsCurrentScope } from '../incident-freshness.mjs';
import { providerIncidentConclusion } from '../incident-detail-repairs.mjs';
import { reconcileProviderIncidentEvidence } from '../update-public-status.mjs';

const now = Date.parse('2026-08-02T13:44:00Z');

test('date-only incident headings are never current incidents', () => {
  assert.equal(dateLikeIncidentTitle('Mar 03 , 2026 - 19:55 UTC'), true);
  assert.equal(activeIncident({ title: 'Mar 03 , 2026 - 19:55 UTC', note: 'Investigating', status: 'update', color: 'amber' }, now), false);
});

test('active incident evidence expires after 72 hours without a vendor update', () => {
  assert.equal(incidentEvidenceIsCurrent({
    title: 'Protect blank purchasing page on store.knowbe4.com',
    status: 'monitoring',
    first_detected: '2026-07-17T13:18:28.778Z',
    latest_update: '2026-07-29T18:40:09.147Z'
  }, now, undefined, { requireTimestamp: true }), false);

  assert.equal(incidentEvidenceIsCurrent({
    title: 'Long-running mitigation',
    first_detected: '2025-12-03T15:15:27Z',
    latest_update: '2026-08-01T13:55:20Z'
  }, now, undefined, { requireTimestamp: true }), true);
});

test('the newest vendor timeline update controls current evidence', () => {
  assert.equal(incidentEvidenceIsCurrent({
    title: 'Long-running incident with a current update',
    first_detected: '2026-03-02T06:23:20Z',
    latest_update: '2026-07-01T00:00:00Z',
    updates: [
      { at: '2026-07-01T00:00:00Z', note: 'Older update' },
      { at: '2026-08-02T12:00:00Z', note: 'Current vendor confirmation' }
    ]
  }, now, undefined, { requireTimestamp: true }), true);
});

test('explicit non-US regions are rejected across every adapter', () => {
  assert.equal(incidentRegionIsCurrentScope({
    title: 'Connectivity disruption for AWS Bahrain (me-south-1)',
    affected_service: 'AWS EC2 Health: me-south-1',
    note: 'Existing deployments in Bahrain remain inaccessible.'
  }), false);
  assert.equal(incidentEvidenceIsCurrent({
    title: 'Connectivity disruption for AWS Bahrain (me-south-1)',
    latest_update: '2026-08-02T12:00:00Z'
  }, now, undefined, { requireTimestamp: true }), false);
  assert.equal(incidentRegionIsCurrentScope({ title: 'United States and Canada messaging degradation' }), true);
  assert.equal(incidentRegionIsCurrentScope({ title: 'Global authentication outage' }), true);
});

test('provider state cannot remain affected after stale incident evidence is removed', () => {
  const stale = reconcileProviderIncidentEvidence({
    id: 'vendor',
    name: 'Vendor',
    service_state: 'major',
    source_state: 'available',
    attention: 'critical',
    color: 'red',
    ok: true,
    incidents: [{ title: 'Old issue', note: 'Investigating', status: 'investigating', color: 'red', rawTime: '2026-07-29T18:40:09.147Z' }]
  }, now);
  assert.equal(stale.service_state, 'unknown');
  assert.equal(stale.source_state, 'limited');
  assert.equal(stale.incidents.length, 0);
  assert.equal(stale.ok, false);

  const current = reconcileProviderIncidentEvidence({
    id: 'vendor',
    name: 'Vendor',
    service_state: 'degraded',
    source_state: 'available',
    attention: 'action',
    color: 'amber',
    ok: true,
    incidents: [{ title: 'Current issue', note: 'Investigating', status: 'investigating', color: 'amber', rawTime: '2026-08-02T13:30:00Z' }]
  }, now);
  assert.equal(current.service_state, 'degraded');
  assert.equal(current.incidents.length, 1);
});

test('Cisco update dates cannot become incident titles or bypass US scope', () => {
  const html = '<main>' +
    '<h2>Active Incidents</h2>' +
    '<h3>Secure Access service availability issue in Dubai</h3>' +
    '<p>Identified - We are working with cloud partners and recommend alternate regions in Mumbai or Hyderabad.</p>' +
    '<p>Apr 27 , 2026 - 17:47 UTC</p>' +
    '<p>Update - We are continuing to investigate this issue.</p>' +
    '<p>Mar 03 , 2026 - 19:55 UTC</p>' +
    '<p>Investigating - Some users in Dubai may experience timeouts.</p>' +
    '<p>Mar 02 , 2026 - 06:18 UTC</p>' +
    '</main>';
  const result = providerIncidentConclusion({ id: 'cisco-umbrella', name: 'Cisco Umbrella' }, html);
  assert.notEqual(result?.kind, 'issues');
});

test('age-aware activeIncident is never passed directly to Array.filter', () => {
  for (const path of ['scripts/update-status.mjs', 'scripts/update-public-status.mjs']) {
    const source = fs.readFileSync(path, 'utf8');
    assert.equal(source.includes('.filter(activeIncident)'), false, path);
  }
});
