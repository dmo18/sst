import test from 'node:test';
import assert from 'node:assert/strict';
import { utcTextToEastern } from '../easternTime.ts';

const ref = '2026-11-12T20:30:00Z';

test('UTC times inside vendor text are shown in Eastern time', () => {
  assert.equal(utcTextToEastern('Next update by: Thursday, November 12, 2026, at 10:30 PM UTC', ref), 'Next update by: Nov 12, 2026, 5:30 PM EST');
  assert.equal(utcTextToEastern('Last updated: Thursday, November 12, 2026 at 7:30:36 PM UTC', ref), 'Last updated: Nov 12, 2026, 2:30 PM EST');
  assert.equal(utcTextToEastern('Nov 12, 2026 - 20:12 UTC', ref), 'Nov 12, 2026, 3:12 PM EST');
  assert.equal(utcTextToEastern('Began at 2026-11-12T19:36:00Z.', ref), 'Began at Nov 12, 2026, 2:36 PM EST.');
  assert.equal(utcTextToEastern('We expect recovery by 21:00 UTC.', ref), 'We expect recovery by 4:00 PM EST.');
  assert.equal(utcTextToEastern('Mitigated at 3:05 AM GMT', ref), 'Mitigated at 10:05 PM EST');
});

test('a date crossing midnight moves to the previous Eastern day, and summer uses daylight time', () => {
  assert.equal(utcTextToEastern('November 13, 2026 at 02:00 UTC', ref), 'Nov 12, 2026, 9:00 PM EST');
  assert.equal(utcTextToEastern('July 4, 2026 at 14:00 UTC', '2026-07-04T14:00:00Z'), 'Jul 4, 2026, 10:00 AM EDT');
  assert.equal(utcTextToEastern('by 14:00 UTC', '2026-07-04T13:00:00Z'), 'by 10:00 AM EDT');
});

test('text without a UTC time, or with an impossible one, is left exactly as written', () => {
  assert.equal(utcTextToEastern('Users may be unable to sign in.', ref), 'Users may be unable to sign in.');
  assert.equal(utcTextToEastern('Version 15.2.0 released', ref), 'Version 15.2.0 released');
  assert.equal(utcTextToEastern('at 5:30 PM EST', ref), 'at 5:30 PM EST');
  assert.equal(utcTextToEastern('code 99:99 UTC', ref), 'code 99:99 UTC');
  assert.equal(utcTextToEastern('', ref), '');
});
