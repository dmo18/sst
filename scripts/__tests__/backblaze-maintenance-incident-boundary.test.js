import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFireHydrantPayload, fullReviewOverrides } from '../full-review-source-adapters.mjs';

function recentIso(minutesAgo = 0) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function basePayload(incident) {
  return {
    config: {
      companyName: 'Backblaze',
      operationalMessage: 'All systems operational. Nothing to report.'
    },
    components: [
      { name: 'US West Region', id: 'us-west', customerCondition: 'Operational' },
      { name: 'US East Region', id: 'us-east', customerCondition: 'Operational' }
    ],
    conditions: {
      Degraded: 'DEGRADED',
      Unavailable: 'OFFLINE',
      Operational: 'OPERATIONAL',
      Maintenance: 'MAINTENANCE'
    },
    incidents: [incident],
    scheduledMaintenances: [{
      id: 'future-us-west-maintenance',
      name: 'US West Core Services Maintenance',
      summary: 'Routine scheduled maintenance.',
      startsAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      endsAt: new Date(Date.now() + 26 * 60 * 60_000).toISOString(),
      updatedAt: recentIso(10),
      componentConditions: { 'US West Region': 'Maintenance' }
    }]
  };
}

test('Backblaze FireHydrant incident array cannot turn maintenance-only activity into an alert', () => {
  const result = parseFireHydrantPayload(JSON.stringify(basePayload({
    id: 'same-day-us-east-maintenance',
    name: 'US East Core Services Maintenance - 8/12/2026',
    currentMilestone: 'active',
    timestamps: { started: recentIso(20) },
    componentConditions: { 'US East Region': 'Maintenance' },
    timeline: []
  })), { id: 'backblaze', name: 'Backblaze' }, fullReviewOverrides.backblaze);

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All systems operational. Nothing to report.');
  assert.equal(result.incidents, undefined);
  assert.deepEqual(result.maintenance.map(item => item.title), ['US West Core Services Maintenance']);
});

test('Backblaze maintenance-related record remains an incident when current customer impact is explicit', () => {
  const result = parseFireHydrantPayload(JSON.stringify(basePayload({
    id: 'maintenance-impact',
    name: 'US East Core Services Maintenance - 8/12/2026',
    currentMilestone: 'identified',
    summary: 'Customers are currently experiencing degraded uploads during maintenance.',
    timestamps: { started: recentIso(20) },
    componentConditions: { 'US East Region': 'Degraded' },
    timeline: []
  })), { id: 'backblaze', name: 'Backblaze' }, fullReviewOverrides.backblaze);

  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
  assert.equal(result.incidents[0].title, 'US East Core Services Maintenance - 8/12/2026');
  assert.match(result.incidents[0].note, /degraded uploads/i);
});
