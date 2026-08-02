import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INCIDENT_MAX_AGE_HOURS,
  incidentEvidenceIsCurrent,
  incidentRegionIsCurrentScope
} from '../incident-freshness.mjs';

test('current incident evidence expires after 72 hours', () => {
  assert.equal(INCIDENT_MAX_AGE_HOURS, 72);
  const now = Date.parse('2026-08-02T13:44:00Z');
  assert.equal(incidentEvidenceIsCurrent({
    title: 'Monitoring an unresolved service issue',
    latest_update: '2026-07-29T18:40:09.147Z'
  }, now, undefined, { requireTimestamp: true }), false);
  assert.equal(incidentEvidenceIsCurrent({
    title: 'Monitoring a current service issue',
    latest_update: '2026-08-02T12:40:09.147Z'
  }, now, undefined, { requireTimestamp: true }), true);
});

test('default scope rejects explicit AWS Middle East regions', () => {
  assert.equal(incidentRegionIsCurrentScope({
    title: 'Connectivity disruption for AWS Bahrain',
    affected_service: 'AWS EC2 Health: me-south-1'
  }), false);
  assert.equal(incidentRegionIsCurrentScope({
    title: 'Network disruption in Manama',
    affected_service: 'Middle East region'
  }), false);
  assert.equal(incidentRegionIsCurrentScope({
    title: 'Global AWS connectivity disruption'
  }), true);
});
