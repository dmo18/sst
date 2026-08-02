import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownLabel, relativeAgeAt } from '../liveTelemetry.ts';

test('relative age updates at second, minute, hour, and day boundaries', () => {
  const now = Date.parse('2026-08-02T04:00:00.000Z');
  assert.equal(relativeAgeAt('2026-08-02T03:59:57.000Z', now), 'Now');
  assert.equal(relativeAgeAt('2026-08-02T03:59:18.000Z', now), '42s ago');
  assert.equal(relativeAgeAt('2026-08-02T03:42:00.000Z', now), '18m ago');
  assert.equal(relativeAgeAt('2026-08-02T01:00:00.000Z', now), '3h ago');
  assert.equal(relativeAgeAt('2026-07-30T04:00:00.000Z', now), '3d ago');
  assert.equal(relativeAgeAt(undefined, now), 'Unknown');
});

test('refresh countdown remains deterministic and never becomes negative', () => {
  const now = 1_000_000;
  assert.equal(countdownLabel(now + 42_000, now), '42s');
  assert.equal(countdownLabel(now + 125_000, now), '2m 05s');
  assert.equal(countdownLabel(now - 1, now), '0s');
});
