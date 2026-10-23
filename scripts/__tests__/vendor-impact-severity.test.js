import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStatuspageSummary } from '../structured-source-adapters.mjs';

const now = new Date().toISOString();
const parse = (impact, name) => parseStatuspageSummary(JSON.stringify({
  status: { indicator: 'minor', description: 'Partial System Outage' },
  components: [],
  incidents: [{ id: 'status-test', name, status: 'investigating', impact, created_at: now, updated_at: now,
    incident_updates: [{ body: 'We are investigating.', updated_at: now }] }]
}), { id: 'example', name: 'Example' }, { url: 'https://status.example.com/api/v2/summary.json' });

test('vendor minor impact is not escalated to a major outage by the word unavailable', () => {
  const result = parse('minor', 'Support helpdesk temporarily unavailable');
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents[0].color, 'amber');
});

test('vendor major impact remains major even when the title sounds limited', () => {
  const result = parse('major', 'Elevated latency in one component');
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents[0].color, 'red');
});
