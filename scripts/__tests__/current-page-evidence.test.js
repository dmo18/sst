import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCurrentPageEvidence } from '../normalize-current-page-evidence.mjs';

test('RingCentral untimed current-page incidents receive explicit snapshot provenance', () => {
  const payload = {
    generated_at: '2026-08-10T20:46:43.500Z',
    providers: [
      {
        id: 'ringcentral',
        source: 'https://status.ringcentral.com/',
        source_state: 'available',
        checked_at: '2026-08-10T20:46:43.400Z'
      }
    ],
    incidents: [
      {
        id: 'ringcentral:ringcentral customer impacting service issue',
        providerId: 'ringcentral',
        source: 'Rendered RingCentral incident text',
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

test('current-page normalization does not bless unrelated, unavailable, or wrong-source incidents', () => {
  const unavailablePayload = {
    generated_at: '2026-08-10T20:46:43.500Z',
    providers: [{ id: 'ringcentral', source: 'https://status.ringcentral.com/', source_state: 'unavailable', checked_at: '2026-08-10T20:46:43.400Z' }],
    incidents: [{ id: 'ringcentral:history', providerId: 'ringcentral', first_detected: '', latest_update: '', rawTime: '' }]
  };
  assert.equal(normalizeCurrentPageEvidence(unavailablePayload).incidents[0].evidence_basis, undefined);

  const wrongSourcePayload = {
    generated_at: '2026-08-10T20:46:43.500Z',
    providers: [{ id: 'ringcentral', source: 'https://example.com/history', source_state: 'available', checked_at: '2026-08-10T20:46:43.400Z' }],
    incidents: [{ id: 'ringcentral:history', providerId: 'ringcentral', first_detected: '', latest_update: '', rawTime: '' }]
  };
  assert.equal(normalizeCurrentPageEvidence(wrongSourcePayload).incidents[0].evidence_basis, undefined);

  const unrelatedPayload = {
    generated_at: '2026-08-10T20:46:43.500Z',
    providers: [{ id: 'ringcentral', source: 'https://status.ringcentral.com/', source_state: 'available', checked_at: '2026-08-10T20:46:43.400Z' }],
    incidents: [{ id: 'other:incident', providerId: 'other', first_detected: '', latest_update: '', rawTime: '' }]
  };
  assert.equal(normalizeCurrentPageEvidence(unrelatedPayload).incidents[0].evidence_basis, undefined);
});
