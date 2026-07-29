import test from 'node:test';
import assert from 'node:assert/strict';
import { dataAge, gridDimensions, paginate, parseWallboardSettings, rotationEnabled } from '../wallboard.ts';

test('wallboard query parameters parse with safe rotation bounds', () => {
  assert.deepEqual(parseWallboardSettings('?view=wallboard&screen=providers&rotate=15&density=compact'), { view: 'wallboard', screen: 'providers', rotateSeconds: 15, density: 'compact' });
  assert.equal(parseWallboardSettings('?rotate=99999').rotateSeconds, 3600);
  assert.equal(parseWallboardSettings('?rotate=-2&screen=invalid').rotateSeconds, 0);
  assert.equal(parseWallboardSettings('?screen=invalid').screen, 'heads-up');
});

test('target viewport capacities match centralized grid dimensions', () => {
  assert.deepEqual(gridDimensions(3840, 2160, 'compact'), { columns: 10, rows: 6, capacity: 60 });
  assert.equal(gridDimensions(3840, 2160, 'comfortable').capacity, 40);
  assert.equal(gridDimensions(1920, 1080, 'comfortable').capacity, 24);
  assert.equal(gridDimensions(1366, 768, 'comfortable').capacity, 15);
  assert.equal(gridDimensions(1280, 720, 'comfortable').capacity, 12);
});

test('all 90 providers are paginated exactly once', () => {
  const providers = Array.from({ length: 90 }, (_, index) => `provider-${index}`);
  for (const capacity of [60, 40, 24, 15, 12, 8]) {
    const flattened = paginate(providers, capacity).flat();
    assert.deepEqual(flattened, providers);
    assert.equal(new Set(flattened).size, 90);
    assert.ok(paginate(providers, capacity).every(page => page.length <= capacity));
  }
});

test('stale thresholds warn at 40 minutes and become critical at 60', () => {
  const now = Date.parse('2026-07-24T12:00:00Z');
  assert.equal(dataAge('2026-07-24T11:21:00Z', now).level, 'current');
  assert.equal(dataAge('2026-07-24T11:20:00Z', now).level, 'warning');
  assert.equal(dataAge('2026-07-24T11:00:00Z', now).level, 'critical');
});

test('reduced motion disables controlled rotation', () => {
  assert.equal(rotationEnabled(15, false), true);
  assert.equal(rotationEnabled(15, true), false);
  assert.equal(rotationEnabled(0, false), false);
});
