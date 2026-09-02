import test from 'node:test';
import assert from 'node:assert/strict';
import { statusPathFromDeployment } from '../deployed-status.mjs';

test('deployment metadata selects only a safe immutable status payload path', () => {
  const deployment = statusPathFromDeployment('commit: abc\nrun_id: 42\ngenerated_at: 2026-09-02T17:29:07.882Z\nstatus_path: status-42.json\n');
  assert.equal(deployment.statusPath, 'status-42.json');
  assert.equal(deployment.metadata.run_id, '42');
  assert.throws(() => statusPathFromDeployment('status_path: ../../status.json\n'), /unsafe/);
});

test('legacy deployment metadata safely falls back to the stable status path', () => {
  assert.equal(statusPathFromDeployment('commit: abc\n').statusPath, 'status.json');
});
