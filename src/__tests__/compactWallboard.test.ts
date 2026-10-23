import assert from 'node:assert/strict';
import test from 'node:test';
import { compactHeadline, compactSignals, COMPACT_PAGE_SIZE, COMPACT_PAGE_MS } from '../compactWallboard.ts';
import type { ActionItem } from '../statusViewModel.ts';

const item = (id: string, attention: ActionItem['attention'], updatedAt: string): ActionItem => ({
  id, attention, updatedAt, kind: 'incident', providerId: id, provider: id,
  title: 'Service disruption', detail: 'Calls cannot connect in the eastern region.', action: '', source: '', score: 0
});

test('compact ordering puts urgent issues first without removing or mutating incidents', () => {
  const signals = [item('new-watch', 'watch', '2026-10-23T12:00:00Z'), item('critical', 'critical', '2026-10-23T09:00:00Z'), item('old-watch', 'watch', '2026-10-23T10:00:00Z'), item('action', 'action', '2026-10-23T11:00:00Z')];
  assert.deepEqual(compactSignals(signals).map(i => i.id), ['critical', 'action', 'new-watch', 'old-watch']);
  assert.equal(signals[0].id, 'new-watch');
  assert.equal(COMPACT_PAGE_SIZE, 4);
  assert.equal(COMPACT_PAGE_MS, 8000);
});

test('generic headlines use actual vendor detail; specific headlines are preserved', () => {
  assert.equal(compactHeadline({ title: 'Investigation Degraded Performance', detail: 'Calls cannot connect.' }), 'Calls cannot connect.');
  assert.equal(compactHeadline({ title: 'Exchange delivery delays in Europe', detail: 'Long update.' }), 'Exchange delivery delays in Europe');
  assert.equal(compactHeadline({ title: 'Investigating', detail: '' }), 'Investigating');
});
