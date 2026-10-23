import assert from 'node:assert/strict';
import test from 'node:test';
import { compactHeadline, compactSignals, compactDescription } from '../compactWallboard.ts';
import type { ActionItem } from '../statusViewModel.ts';

const item = (id: string, attention: ActionItem['attention'], updatedAt: string): ActionItem => ({
  id, attention, updatedAt, kind: 'incident', providerId: id, provider: id,
  title: 'Service disruption', detail: 'Calls cannot connect in the eastern region.', action: '', source: '', score: 0
});

test('compact ordering puts urgent issues first without removing or mutating incidents', () => {
  const signals = [item('new-watch', 'watch', '2026-10-23T12:00:00Z'), item('critical', 'critical', '2026-10-23T09:00:00Z'), item('old-watch', 'watch', '2026-10-23T10:00:00Z'), item('action', 'action', '2026-10-23T11:00:00Z')];
  assert.deepEqual(compactSignals(signals).map(i => i.id), ['critical', 'action', 'new-watch', 'old-watch']);
  assert.equal(signals[0].id, 'new-watch');
});

test('generic headlines use actual vendor detail; specific headlines are preserved', () => {
  assert.equal(compactHeadline({ title: 'Investigation Degraded Performance', detail: 'Calls cannot connect.' }), 'Calls cannot connect.');
  assert.equal(compactHeadline({ title: 'Exchange delivery delays in Europe', detail: 'Long update.' }), 'Exchange delivery delays in Europe');
  assert.equal(compactHeadline({ title: 'Investigating', detail: '' }), 'Investigating');
});

test('brief descriptions preserve vendor text, avoid duplicate headlines, and bound long updates', () => {
  assert.equal(compactDescription({ title: 'Mail delays', detail: '<p>Mail is queued in Europe.</p>' }), 'Mail is queued in Europe.');
  assert.equal(compactDescription({ title: 'Investigating', detail: 'Calls cannot connect.' }), 'Calls cannot connect.');
  assert.equal(compactDescription({ title: 'Mail delays', detail: '' }), '');
  const detail = 'Customers may experience delayed mail delivery. '.repeat(20);
  const brief = compactDescription({ title: 'Mail delays', detail });
  assert.ok(brief.length <= 180);
  assert.ok(brief.endsWith('…'));
  assert.ok(detail.startsWith(brief.slice(0, -1)));
});

test('collection estimate follows five-minute schedule and admits delays or missing data', async () => {
  const { nextCollectionSlot, compactCountdown } = await import('../compactWallboard.ts');
  const now = Date.parse('2026-10-23T12:03:30Z');
  assert.equal(nextCollectionSlot('2026-10-23T12:03:00Z'), Date.parse('2026-10-23T12:05:00Z'));
  assert.equal(compactCountdown(nextCollectionSlot('2026-10-23T12:03:00Z'), now), '1m 30s');
  assert.equal(compactCountdown(now, now), 'due / waiting');
  assert.equal(compactCountdown(now - 1000, now), 'due / waiting');
  assert.equal(compactCountdown(now + 500, now), '1s');
  assert.equal(nextCollectionSlot('bad'), null);
  assert.equal(compactCountdown(null, now), 'unknown');
});
