import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCurrentPageEvidence } from '../normalize-current-page-evidence.mjs';

test('RingCentral untimed current-page incidents receive explicit snapshot provenance', () => {
  const payload = {
    generated_at: '2026-08-10T20:46:43.500Z',
    providers: [
      {
        id: 'ringcentral',
        source_state: 'available',
        checked_at: '2026-08-10T20:46:43.400Z'
      }
    ],
    incidents: [
      {
        id: 'ringcentral:ringcentral customer impacting service issue',
        providerId: 'ringcentral',
        source: 'RingCentral public status dashboard',
        url: 'https://status.ringcentral.com/',
        first_detected: '',
        latest_update: '',
        rawTime: '',
        observed_at: '2026-08-10T20:46:43.300Z'
      }
    ]
  };

  const normalized = normalizeCurrentPageEvidence(payload);
  assert.equal(normalized.incidents[0].evidence_basis, 'current-page');
  assert.equal(normalized.incidents[0].observed_at, '2026-08-10T20:46:43.400Z');
});

test('current-page normalization does not bless unrelated or unavailable incidents', () => {
  const payload = {
    generated_at: '2026-08-10T20:46:43.500Z',
    providers: [{ id: 'ringcentral', source_state: 'unavailable', checked_at: '2026-08-10T20:46:43.400Z' }],
    incidents: [
      {
        id: 'ringcentral:history',
        providerId: 'ringcentral',
        source: 'RingCentral public status dashboard',
        url: 'https://status.ringcentral.com/',
        first_detected: '',
        latest_update: '',
        rawTime: ''
      },
      {
        id: 'other:incident',
        providerId: 'other',
        source: 'Other source',
        url: 'https://example.com/',
        first_detected: '',
        latest_update: '',
        rawTime: ''
      }
    ]
  };

  const normalized = normalizeCurrentPageEvidence(payload);
  assert.equal(normalized.incidents[0].evidence_basis, undefined);
  assert.equal(normalized.incidents[1].evidence_basis, undefined);
});
