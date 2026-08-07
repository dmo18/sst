import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BROWSER_REFRESH_MS,
  isAlertWithinWindow,
  parseAlertWindowMs,
  parseRefreshIntervalMs,
  readWallboardRoute
} from '../wallboardRoute.ts';

test('wallboard alert windows parse minute, hour, and day durations', () => {
  assert.equal(parseAlertWindowMs('90m'), 90 * 60 * 1000);
  assert.equal(parseAlertWindowMs('36h'), 36 * 60 * 60 * 1000);
  assert.equal(parseAlertWindowMs('2d'), 2 * 24 * 60 * 60 * 1000);
  assert.equal(parseAlertWindowMs('0h'), null);
  assert.equal(parseAlertWindowMs('31d'), null);
  assert.equal(parseAlertWindowMs('36'), null);
});

test('browser refresh intervals parse bounded second, minute, and hour durations', () => {
  assert.equal(parseRefreshIntervalMs('15s'), 15 * 1000);
  assert.equal(parseRefreshIntervalMs('45s'), 45 * 1000);
  assert.equal(parseRefreshIntervalMs('1.5m'), 90 * 1000);
  assert.equal(parseRefreshIntervalMs('1h'), 60 * 60 * 1000);
  assert.equal(parseRefreshIntervalMs('14s'), DEFAULT_BROWSER_REFRESH_MS);
  assert.equal(parseRefreshIntervalMs('61m'), DEFAULT_BROWSER_REFRESH_MS);
  assert.equal(parseRefreshIntervalMs('60'), DEFAULT_BROWSER_REFRESH_MS);
  assert.equal(parseRefreshIntervalMs(null), DEFAULT_BROWSER_REFRESH_MS);
});

test('wallboard route reads alert and browser refresh options from the URL', () => {
  assert.deepEqual(readWallboardRoute('?alerts=36h&view=wallboard&refresh=30s'), {
    wallboardMode: true,
    alertWindowMs: 36 * 60 * 60 * 1000,
    refreshIntervalMs: 30 * 1000
  });
  assert.deepEqual(readWallboardRoute('?view=operator&alerts=36h'), {
    wallboardMode: false,
    alertWindowMs: 36 * 60 * 60 * 1000,
    refreshIntervalMs: DEFAULT_BROWSER_REFRESH_MS
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
