import test from 'node:test';
import assert from 'node:assert/strict';
import { isAlertWithinWindow, parseAlertWindowMs, readWallboardRoute } from '../wallboardRoute.ts';

test('wallboard alert windows parse minute, hour, and day durations', () => {
  assert.equal(parseAlertWindowMs('90m'), 90 * 60 * 1000);
  assert.equal(parseAlertWindowMs('36h'), 36 * 60 * 60 * 1000);
  assert.equal(parseAlertWindowMs('2d'), 2 * 24 * 60 * 60 * 1000);
  assert.equal(parseAlertWindowMs('0h'), null);
  assert.equal(parseAlertWindowMs('31d'), null);
  assert.equal(parseAlertWindowMs('36'), null);
});

test('wallboard route reads the alert window from the URL', () => {
  assert.deepEqual(readWallboardRoute('?alerts=36h&view=wallboard'), {
    wallboardMode: true,
    alertWindowMs: 36 * 60 * 60 * 1000
  });
  assert.deepEqual(readWallboardRoute('?view=operator&alerts=36h'), {
    wallboardMode: false,
    alertWindowMs: 36 * 60 * 60 * 1000
  });
});

test('alerts outside the selected window are excluded', () => {
  const now = Date.parse('2026-08-06T13:00:00.000Z');
  const windowMs = parseAlertWindowMs('36h');

  assert.equal(isAlertWithinWindow('2026-08-05T01:00:00.000Z', now, windowMs), true);
  assert.equal(isAlertWithinWindow('2026-08-05T00:59:59.000Z', now, windowMs), false);
  assert.equal(isAlertWithinWindow('2026-08-04T16:00:00.000Z', now, windowMs), false);
  assert.equal(isAlertWithinWindow('invalid', now, windowMs), false);
  assert.equal(isAlertWithinWindow('2026-08-04T16:00:00.000Z', now, null), true);
});
