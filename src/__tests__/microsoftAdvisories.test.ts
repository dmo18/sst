import test from 'node:test';
import assert from 'node:assert/strict';
import { readMicrosoftAdvisories } from '../microsoftAdvisories.ts';

const now = Date.parse('2026-08-02T13:44:00Z');
const base = {
  schema: 1, kind: 'supplement', ok: true, publisher: 'University of Pennsylvania (PennO365)', source_url: 'https://mailservices.isc.upenn.edu/x.html', fetched_at: '2026-08-02T13:40:00Z',
  items: [
    { id: 'EX1550543', classification: 'incident', service: 'Exchange Online', title: 'Mailbox connection failures', started_at: '2026-08-02T10:05:00Z', last_updated: '2026-08-02T13:00:00Z', user_impact: 'Users may be unable to connect.', current_status: 'Next update by 15:00 UTC.' },
    { id: 'bad', classification: 'incident', service: 'x', title: 'x', started_at: '2026-08-02T10:05:00Z' },
    { id: 'MP1507695', classification: 'planned', service: 'x', title: 'x', started_at: '2026-08-02T10:05:00Z' }
  ]
};

test('a fresh supplement is read, malformed items are dropped, and its times are Eastern', () => {
  const result = readMicrosoftAdvisories(base, now);
  assert.ok(result);
  assert.deepEqual(result.items.map(item => item.id), ['EX1550543']);
  assert.equal(result.items[0].currentStatus, 'Next update by 11:00 AM EDT.');
});

test('a failed, stale, future-dated or malformed supplement is no supplement', () => {
  assert.equal(readMicrosoftAdvisories({ ...base, ok: false }, now), null);
  assert.equal(readMicrosoftAdvisories({ ...base, fetched_at: '2026-08-02T12:00:00Z' }, now), null);
  assert.equal(readMicrosoftAdvisories({ ...base, fetched_at: '2026-08-02T15:00:00Z' }, now), null);
  assert.equal(readMicrosoftAdvisories({ ...base, kind: 'status' }, now), null);
  assert.equal(readMicrosoftAdvisories({ ...base, source_url: 'javascript:alert(1)' }, now), null);
  assert.equal(readMicrosoftAdvisories(null, now), null);
  assert.equal(readMicrosoftAdvisories('text', now), null);
});
