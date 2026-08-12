import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFireHydrantPayload, fullReviewOverrides } from '../full-review-source-adapters.mjs';
import { regionScopeRelevant } from '../region-scope.mjs';

test('Backblaze CA East labels are Canada and excluded from US scope', () => {
  assert.equal(regionScopeRelevant('CA East Core Services Maintenance - 8/12/2026', '', 'us'), false);
  assert.equal(regionScopeRelevant('CA East Region', '', 'us'), false);
  assert.equal(regionScopeRelevant('US East Core Services Maintenance - 8/12/2026', '', 'us'), true);
});

test('Backblaze operational US payload does not retain CA East maintenance as US context', () => {
  const result = parseFireHydrantPayload(JSON.stringify({
    config: {
      companyName: 'Backblaze',
      operationalMessage: 'All systems operational. Nothing to report.'
    },
    components: [
      { name: 'US East Region', id: 'us-east', customerCondition: 'Operational' },
      { name: 'CA East Region', id: 'ca-east', customerCondition: 'Operational' }
    ],
    conditions: {
      Degraded: 'DEGRADED',
      Unavailable: 'OFFLINE',
      Operational: 'OPERATIONAL',
      Maintenance: 'DEGRADED'
    },
    incidents: [],
    scheduledMaintenances: [{
      id: 'ca-east-maintenance',
      name: 'CA East Core Services Maintenance - 8/12/2026',
      summary: 'Routine scheduled maintenance for CA East.',
      startsAt: '2026-08-12T18:30:00Z',
      endsAt: '2026-08-12T20:30:00Z',
      updatedAt: '2026-08-12T18:00:00Z',
      componentConditions: { 'CA East Region': 'Maintenance' }
    }]
  }), { id: 'backblaze', name: 'Backblaze' }, fullReviewOverrides.backblaze);

  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All systems operational. Nothing to report.');
  assert.deepEqual(result.maintenance, []);
  assert.deepEqual(result.components.map(component => component.name), ['US East Region']);
});
