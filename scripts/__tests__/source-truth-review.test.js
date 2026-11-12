import test from 'node:test';
import assert from 'node:assert/strict';
import { activeIncident, colorFromText } from '../update-status.mjs';
import { parseStatuspageSummary, parseStatusioJson } from '../structured-source-adapters.mjs';
import { parseGoogleIncidents, parseRingCentralStatus, parseSalesforceActiveIncidents } from '../official-json-adapters.mjs';
import { schemaFingerprint } from '../source-intelligence.mjs';

const hoursAgo = hours => new Date(Date.now() - hours * 3600000).toISOString();

function incident(overrides = {}) {
  return { title: 'Device sync delays', note: 'We are investigating.', status: 'monitoring', color: 'amber', latest_update: hoursAgo(2), first_detected: hoursAgo(20), ...overrides };
}

test('prose written during an open incident never closes it', () => {
  for (const note of [
    'Engineering has developed a fix. Deployment is planned for after hours today.',
    'The rollout will be completed tonight; we will update once it is resolved.',
    'Customers are unable to reopen closed tickets.',
    'A previous change was fixed but the backlog remains.',
    'This follows the scheduled maintenance last week.'
  ]) {
    assert.equal(activeIncident(incident({ note })), true, note);
  }
  assert.equal(activeIncident(incident({ title: 'Customers unable to reopen closed tickets', note: 'Investigating.' })), true);
});

test('the vendor lifecycle and an explicit title prefix still close an incident', () => {
  for (const status of ['resolved', 'Resolved', 'completed', 'postmortem', 'closed', 'cancelled']) assert.equal(activeIncident(incident({ status })), false, status);
  assert.equal(activeIncident(incident({ title: '[Resolved] Device sync delays', status: '' })), false);
  assert.equal(activeIncident(incident({ title: 'Resolved: Device sync delays', status: '' })), false);
});

test('planned work is classified from the title and lifecycle, not the note', () => {
  assert.equal(activeIncident(incident({ title: 'Scheduled maintenance for the billing database', status: 'scheduled' })), false);
  assert.equal(activeIncident(incident({ title: 'Planned upgrade of reporting servers', status: '' })), false);
  assert.equal(activeIncident(incident({ title: 'Emergency maintenance: service unavailable', status: 'in_progress' })), true);
  assert.equal(activeIncident(incident({ title: 'Email delivery delays', status: 'identified', note: 'A maintenance window is planned.' })), true);
});

test('stale and green records remain inactive', () => {
  assert.equal(activeIncident(incident({ latest_update: hoursAgo(80), first_detected: hoursAgo(90) })), false);
  assert.equal(activeIncident(incident({ color: 'green' })), false);
});

test('colorFromText reads negations and whole words', () => {
  assert.equal(colorFromText('Not operational'), 'red');
  assert.equal(colorFromText('Service not available'), 'red');
  assert.equal(colorFromText('Readings are abnormal'), 'red');
  assert.equal(colorFromText('Download portal operational'), 'green');
  assert.equal(colorFromText('All Systems Operational'), 'green');
  assert.equal(colorFromText('Degraded performance'), 'amber');
  assert.equal(colorFromText('Major outage'), 'red');
});

function kaseyaLikeSummary() {
  const groups = Array.from({ length: 30 }, (_, index) => ({ id: `g${index}`, name: index === 29 ? 'Datto RMM' : `Product ${index}`, status: 'operational', group: true }));
  const children = groups.flatMap(group => ['Agent Registration', 'Web Portal'].map((name, index) => ({
    id: `${group.id}-${index}`, name, group_id: group.id, group: false,
    status: group.name === 'Datto RMM' && name === 'Agent Registration' ? 'degraded_performance' : 'operational'
  })));
  return JSON.stringify({
    page: { url: 'https://status.example' },
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [...groups, ...children],
    incidents: [],
    scheduled_maintenances: []
  });
}

test('a degraded child is not hidden behind a healthy namesake or cut by the component limit', () => {
  const result = parseStatuspageSummary(kaseyaLikeSummary(), { id: 'kaseya', name: 'Kaseya' }, { regionScope: 'us' });
  assert.equal(result.kind, 'component-state');
  assert.equal(result.components[0].name, 'Datto RMM - Agent Registration');
  assert.equal(result.components[0].status, 'degraded_performance');
  assert.match(result.message, /Datto RMM - Agent Registration/);
});

test('a vendor-declared incident with no usable title is not published as healthy', () => {
  const result = parseStatuspageSummary(JSON.stringify({
    page: { url: 'https://status.example' },
    status: { indicator: 'major', description: 'Major Service Outage' },
    components: [{ id: 'a', name: 'API', status: 'operational' }],
    incidents: [{ id: 'x', name: 'Incident', status: 'investigating', created_at: hoursAgo(1), updated_at: hoursAgo(1), incident_updates: [] }],
    scheduled_maintenances: []
  }), { id: 'example', name: 'Example' }, { regionScope: 'us' });
  assert.equal(result.kind, 'limited');
  assert.match(result.message, /no usable title/i);
});

function statusioDocument(incidents = [], componentStatus = 'Operational') {
  return JSON.stringify({ result: {
    status_overall: { status: componentStatus === 'Operational' ? 'Operational' : 'Partial Service Disruption', status_code: componentStatus === 'Operational' ? 100 : 400 },
    status: [{ name: 'Recover', status: componentStatus, containers: [{ name: 'North America', status: componentStatus }, { name: 'EMEA', status: 'Operational' }] }],
    incidents,
    maintenance: { active: [], upcoming: [{ _id: 'm1', name: 'Scheduled maintenance: Recover', datetime_open: hoursAgo(100), datetime_planned_start: hoursAgo(-10), datetime_planned_end: hoursAgo(-13), messages: [{ details: 'Planned work.', state: 100, status: 200, datetime: hoursAgo(100) }], components_affected: [{ name: 'Recover' }], containers_affected: [{ name: 'North America' }] }] }
  } });
}

test('Status.io public API incidents use numeric lifecycle codes, affected components and locations', () => {
  const result = parseStatusioJson(statusioDocument([
    { _id: 'i1', name: 'Investigating - File browser offline', datetime_open: hoursAgo(30), current_active: true,
      messages: [{ details: 'The file browser is offline.', state: 100, status: 400, datetime: hoursAgo(30) }, { details: 'A fix is planned for tonight.', state: 300, status: 400, datetime: hoursAgo(3) }],
      components_affected: [{ name: 'Recover' }], containers_affected: [{ name: 'North America' }] },
    { _id: 'i2', name: 'EMEA sync delays', datetime_open: hoursAgo(5), current_active: true,
      messages: [{ details: 'Sync is delayed.', state: 200, status: 300, datetime: hoursAgo(5) }],
      components_affected: [{ name: 'Sync' }], containers_affected: [{ name: 'EMEA' }] },
    { _id: 'i3', name: 'Old portal issue', datetime_open: hoursAgo(900), current_active: true,
      messages: [{ details: 'Still open.', state: 100, status: 300, datetime: hoursAgo(900) }], components_affected: [{ name: 'Portal' }], containers_affected: [{ name: 'North America' }] }
  ], 'Partial Service Disruption'), { id: 'connectwise', name: 'ConnectWise' }, { regionScope: 'us', pageUrl: 'https://status.example/' });
  assert.equal(result.kind, 'issues');
  assert.deepEqual(result.incidents.map(item => item.id), ['i1']);
  assert.equal(result.incidents[0].title, 'File browser offline');
  assert.equal(result.incidents[0].status, 'monitoring');
  assert.equal(result.incidents[0].affectedService, 'Recover');
  assert.equal(result.incidents[0].note, 'A fix is planned for tonight.');
  assert.equal(result.components[0].name, 'Recover - North America');
  assert.equal(result.maintenance.length, 1);
  assert.equal(result.maintenance[0].status, 'scheduled');
});

test('Status.io public API reports healthy only from an operational overall state', () => {
  assert.equal(parseStatusioJson(statusioDocument(), { id: 'halopsa', name: 'HaloPSA' }, { regionScope: 'us' }).kind, 'healthy');
  assert.equal(parseStatusioJson(statusioDocument([], 'Degraded Performance'), { id: 'halopsa', name: 'HaloPSA' }, { regionScope: 'us' }).kind, 'component-state');
  assert.equal(parseStatusioJson('{"result":{}}', { id: 'halopsa', name: 'HaloPSA' }, {}), null);
});

test('RingCentral service levels map to health for the Americas only', () => {
  const rows = [
    { category: 'Core Services', service: 'Calling - Inbound', region: 'Americas', level: 'Good', alerts: [] },
    { category: 'Core Services', service: 'Messaging', region: 'Americas', level: 'Good', alerts: [] },
    { category: 'Core Services', service: 'Calling - Inbound', region: 'EMEA', level: 'Issue', alerts: { e1: { level: 'Issue', description: 'EMEA calling outage.', statusUpdates: [] } } }
  ];
  const healthy = parseRingCentralStatus(JSON.stringify(rows), { id: 'ringcentral', name: 'RingCentral' }, { regionScope: 'us' });
  assert.equal(healthy.kind, 'healthy');
  assert.equal(healthy.components.length, 2);

  rows[1] = { ...rows[1], level: 'Warning', alerts: { a1: { level: 'Warning', description: 'Some users may see delayed messages. We are investigating.', statusUpdates: [{ message: 'Investigating delayed messages.', updatedAt: hoursAgo(1) }] } } };
  const issue = parseRingCentralStatus(JSON.stringify(rows), { id: 'ringcentral', name: 'RingCentral' }, { regionScope: 'us' });
  assert.equal(issue.kind, 'issues');
  assert.equal(issue.incidents.length, 1);
  assert.equal(issue.incidents[0].title, 'Some users may see delayed messages.');
  assert.equal(issue.incidents[0].affectedService, 'Messaging');
  assert.equal(issue.incidents[0].color, 'amber');

  assert.equal(parseRingCentralStatus(JSON.stringify([{ service: 'X', region: 'Americas', level: 'Purple', alerts: [] }]), { name: 'RingCentral' }, {}).kind, 'limited');
  assert.equal(parseRingCentralStatus(JSON.stringify([{ unexpected: true }]), { name: 'RingCentral' }, {}), null);
  assert.equal(parseRingCentralStatus('[]', { name: 'RingCentral' }, {}), null);
});

test('Salesforce active incidents are scoped to US instances and current impact', () => {
  const base = { id: 1, externalId: '900', status: 'Active', type: 'Degradation', affectsAll: false, createdAt: hoursAgo(40), updatedAt: hoursAgo(2), serviceKeys: ['CoreService'],
    IncidentImpacts: [{ startTime: hoursAgo(41), endTime: null, type: 'performanceDegradation', severity: 'minor' }],
    IncidentEvents: [{ type: 'update', message: 'We are deploying a fix.', createdAt: hoursAgo(2) }] };
  const us = parseSalesforceActiveIncidents(JSON.stringify([{ ...base, instanceKeys: ['AUS4S', 'NA211', 'USA254'] }]), { id: 'salesforce', name: 'Salesforce' }, { regionScope: 'us' });
  assert.equal(us.kind, 'issues');
  assert.equal(us.incidents[0].id, '900');
  assert.match(us.incidents[0].title, /Salesforce degradation: CoreService \(performance degradation\)/);
  assert.match(us.incidents[0].affectedService, /2 US instances/);
  assert.equal(us.incidents[0].color, 'amber');

  const foreign = parseSalesforceActiveIncidents(JSON.stringify([{ ...base, instanceKeys: ['AUS4S', 'EU50'] }]), { id: 'salesforce', name: 'Salesforce' }, { regionScope: 'us' });
  assert.equal(foreign.kind, 'healthy');
  assert.match(foreign.status, /no active US-relevant incident/);

  const ended = parseSalesforceActiveIncidents(JSON.stringify([{ ...base, instanceKeys: ['NA211'], IncidentImpacts: [{ startTime: hoursAgo(41), endTime: hoursAgo(1), severity: 'major' }] }]), { name: 'Salesforce' }, {});
  assert.equal(ended.kind, 'healthy');
  assert.equal(parseSalesforceActiveIncidents('[]', { name: 'Salesforce' }, {}).kind, 'healthy');
  assert.equal(parseSalesforceActiveIncidents('{"error":"x"}', { name: 'Salesforce' }, {}), null);
});

test('Google incidents are open only while they have no end', () => {
  const open = { id: 'abc', begin: hoursAgo(3), created: hoursAgo(3), modified: hoursAgo(1), external_desc: 'Gmail delivery is delayed. We are investigating.', status_impact: 'SERVICE_DISRUPTION', severity: 'medium',
    service_name: 'Gmail', affected_products: [{ title: 'Gmail' }], uri: 'incidents/abc', most_recent_update: { when: hoursAgo(1), text: 'Mitigation is in progress.', status: 'SERVICE_DISRUPTION' }, updates: [] };
  const result = parseGoogleIncidents(JSON.stringify([open, { ...open, id: 'closed', end: hoursAgo(1) }, { ...open, id: 'info', status_impact: 'SERVICE_INFORMATION' }]), { id: 'google-workspace', name: 'Google Workspace' }, { regionScope: 'us', pageUrl: 'https://www.google.com/appsstatus/dashboard/' });
  assert.equal(result.kind, 'issues');
  assert.deepEqual(result.incidents.map(item => item.id), ['abc']);
  assert.equal(result.incidents[0].title, 'Gmail delivery is delayed.');
  assert.equal(result.incidents[0].url, 'https://www.google.com/appsstatus/dashboard/incidents/abc');
  assert.equal(parseGoogleIncidents(JSON.stringify([{ ...open, end: hoursAgo(1) }]), { name: 'Google Cloud' }, {}).kind, 'healthy');
  const regional = parseGoogleIncidents(JSON.stringify([{ ...open, external_desc: 'Networking issues in europe-west2.', currently_affected_locations: [{ title: 'London (europe-west2)', id: 'europe-west2' }] }]), { name: 'Google Cloud' }, { regionScope: 'us' });
  assert.equal(regional.kind, 'healthy');
  assert.match(regional.status, /no open US-relevant incident/);
  assert.equal(parseGoogleIncidents('{"incidents":[]}', { name: 'Google Cloud' }, {}), null);
});

test('an incident opening is content, not a schema change', () => {
  const quiet = JSON.stringify({ page: { id: 'p', url: 'u' }, status: { indicator: 'none' }, components: [], incidents: [], scheduled_maintenances: [] });
  const busy = JSON.stringify({ page: { id: 'p', url: 'u' }, status: { indicator: 'major' }, components: [{ id: 'c', name: 'API' }], incidents: [{ id: 'i', name: 'Outage', incident_updates: [{ body: 'x' }] }], scheduled_maintenances: [] });
  const drifted = JSON.stringify({ page: { id: 'p', url: 'u' }, state: { indicator: 'none' }, components: [], events: [] });
  assert.equal(schemaFingerprint(quiet, 'statuspage-json'), schemaFingerprint(busy, 'statuspage-json'));
  assert.notEqual(schemaFingerprint(quiet, 'statuspage-json'), schemaFingerprint(drifted, 'statuspage-json'));
  assert.equal(schemaFingerprint('[]', 'salesforce-json'), schemaFingerprint('[]', 'salesforce-json'));
  assert.match(schemaFingerprint(quiet, 'statuspage-json'), /^jsonv2-/);
});

test('Statuspage maintenance indicator is planned work, not an incident or an unknown state', () => {
  const result = parseStatuspageSummary(JSON.stringify({
    page: { url: 'https://status.example' },
    status: { indicator: 'maintenance', description: 'Service Under Maintenance' },
    components: [{ id: 'a', name: 'United States (US)', status: 'under_maintenance' }, { id: 'b', name: 'API', status: 'operational' }],
    incidents: [],
    scheduled_maintenances: []
  }), { id: 'ninjaone', name: 'NinjaOne' }, { regionScope: 'us' });
  assert.equal(result.kind, 'healthy');
  assert.match(result.status, /no incident; planned maintenance is in progress \(United States \(US\)\)/);
});

test('Statuspage-compatible documents may omit an empty incident list but not the whole schema', () => {
  const compatible = parseStatuspageSummary(JSON.stringify({
    page: { url: 'https://status.example' },
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [{ id: 'a', name: 'Chat Completions', status: 'operational' }]
  }), { id: 'openai', name: 'OpenAI' }, { regionScope: 'us' });
  assert.equal(compatible.kind, 'healthy');
  const degraded = parseStatuspageSummary(JSON.stringify({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [{ id: 'a', name: 'Chat Completions', status: 'degraded_performance' }]
  }), { id: 'openai', name: 'OpenAI' }, { regionScope: 'us' });
  assert.equal(degraded.kind, 'component-state');
  assert.equal(parseStatuspageSummary(JSON.stringify({ status: { indicator: 'none' } }), { name: 'X' }, {}), null);
  assert.equal(parseStatuspageSummary(JSON.stringify({ status: { indicator: 'none' }, components: [], incidents: 'none' }), { name: 'X' }, {}), null);
});

test('vendor text is reduced to plain text with entities decoded exactly once', () => {
  const rows = [{ id: 1, externalId: '901', status: 'Active', type: 'Degradation', createdAt: hoursAgo(3), updatedAt: hoursAgo(1), instanceKeys: ['NA1'], serviceKeys: [],
    IncidentImpacts: [{ startTime: hoursAgo(3), endTime: null, severity: 'minor' }],
    IncidentEvents: [{ type: 'update', message: '<p>Errors &amp;lt;5% &amp; falling</p><script >alert(1)</script foo>', createdAt: hoursAgo(1) }] }];
  const note = parseSalesforceActiveIncidents(JSON.stringify(rows), { name: 'Salesforce' }, { regionScope: 'us' }).incidents[0].note;
  assert.equal(note, 'Errors &lt;5% & falling');
});

test('N-able maintenance in progress is planned work, not an unknown state', async () => {
  const { parseNableDashboard } = await import('../official-json-adapters.mjs');
  const board = status => JSON.stringify({ objects: [{
    services: [{ name: 'Cove Data Protection (Americas)', group: 'Americas', status }, { name: 'Cove DRaaS (Americas)', group: 'Americas', status: 0 }],
    events: { incident: [], maintenance_planned: [], maintenance: status === 1 ? [{ id: 9, status: 'In Progress', start: hoursAgo(5).slice(0, 19), end: null, description: 'Cove storage maintenance', services: ['Cove Data Protection (Americas)'], updates: [] }] : [] }
  }] });
  const cove = { id: 'cove-data-protection', name: 'Cove Data Protection' };
  const maintained = parseNableDashboard(board(1), cove, { regionScope: 'us' });
  assert.equal(maintained.kind, 'healthy');
  assert.match(maintained.status, /no incident; planned maintenance is in progress \(Cove Data Protection \(Americas\)\)/);
  assert.equal(maintained.components.find(item => item.name === 'Cove Data Protection (Americas)').status, 'under_maintenance');
  assert.equal(maintained.maintenance.length, 1);
  assert.equal(maintained.maintenance[0].status, 'in_progress');
  // A non-operational status that no current event explains is still unknown.
  assert.equal(parseNableDashboard(board(3), cove, { regionScope: 'us' }).kind, 'limited');
});
