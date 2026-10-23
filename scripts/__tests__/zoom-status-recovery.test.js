import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStatuspageSummary } from '../structured-source-adapters.mjs';

const recent = new Date().toISOString();
const incident = {
  id: 'zoom-us-meetings', name: 'Service Degradation Affecting Zoom Meetings Services in the US.',
  status: 'monitoring', impact: 'minor', created_at: recent, updated_at: recent,
  components: [{ name: 'Zoom Meetings', status: 'operational' }],
  incident_updates: [{ status: 'monitoring', body: 'The service degradation affecting US meetings has been successfully resolved. Monitoring for stability.', created_at: recent, updated_at: recent }]
};
const fixture = (indicator, body = incident.incident_updates[0].body) => JSON.stringify({
  status: { indicator, description: indicator === 'none' ? 'All Systems Operational' : 'Partial System Outage' },
  components: [{ id: 'meetings', name: 'Zoom Meetings', status: 'operational' }],
  incidents: [{ ...incident, incident_updates: [{ ...incident.incident_updates[0], body }] }]
});

test('Zoom recovered monitoring record does not override an explicit all-green current status', () => {
  const result = parseStatuspageSummary(fixture('none'), { id: 'zoom', name: 'Zoom' }, { regionScope: 'us', url: 'https://www.zoomstatus.com/api/v2/summary.json' });
  assert.equal(result.kind, 'healthy');
  assert.equal(result.status, 'All Systems Operational');
});

test('a degraded overall indicator is not overridden by a recovered monitoring message', () => {
  const result = parseStatuspageSummary(fixture('minor'), { id: 'zoom', name: 'Zoom' }, { regionScope: 'us' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 1);
});

test('ongoing monitoring without explicit resolution is still an incident', () => {
  const result = parseStatuspageSummary(fixture('none', 'We continue to experience intermittent meeting disconnects in the US. Monitoring investigation.'), { id: 'zoom', name: 'Zoom' }, { regionScope: 'us' });
  assert.equal(result.kind, 'issues');
});
