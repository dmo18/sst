import fs from 'node:fs';

const patchPath = 'scripts/apply-last-mile-hardening.mjs';
let patch = fs.readFileSync(patchPath, 'utf8');

const reconcileStart = "publicStatus = replaceExact(\n  publicStatus,\n  lines(\n    '  return {',";
const reconcileEnd = "  'service evidence reconciliation source health separation'\n);\n";
const start = patch.indexOf(reconcileStart);
if (start < 0) throw new Error('Missing reconciliation source-health rewrite');
const end = patch.indexOf(reconcileEnd, start);
if (end < 0) throw new Error('Missing reconciliation source-health rewrite terminator');
patch = patch.slice(0, start) + patch.slice(end + reconcileEnd.length);

const oldTest = `test('service evidence reconciliation never downgrades a successfully readable source', () => {\n  const stale = { id: 'old', title: 'Old outage', note: 'Customers were affected.', status: 'monitoring', color: 'amber', rawTime: '2026-01-01T00:00:00Z', latest_update: '2026-01-01T01:00:00Z' };\n  const result = reconcileProviderIncidentEvidence({ status: '1 active public incident', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [stale], component_status: [] }, auditNow);\n  assert.equal(result.service_state, 'unknown');\n  assert.equal(result.source_state, 'available');\n  assert.equal(result.ok, true);\n});`;
const newTest = `test('unsupported affected state fails closed when current incident and component evidence are absent', () => {\n  const stale = { id: 'old', title: 'Old outage', note: 'Customers were affected.', status: 'monitoring', color: 'amber', rawTime: '2026-01-01T00:00:00Z', latest_update: '2026-01-01T01:00:00Z' };\n  const result = reconcileProviderIncidentEvidence({ status: '1 active public incident', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [stale], component_status: [] }, auditNow);\n  assert.equal(result.service_state, 'unknown');\n  assert.equal(result.source_state, 'limited');\n  assert.equal(result.ok, false);\n});`;
if (!patch.includes(oldTest)) throw new Error('Missing last-mile reconciliation regression test');
patch = patch.replace(oldTest, newTest);

const testInsertMarker = "const tests = `import test from 'node:test';";
const fixturePatch = `let fullReviewTests = read('scripts/__tests__/full-review-source-adapters.test.js');\nfullReviewTests = fullReviewTests\n  .replaceAll('2026-08-05T19:40:45Z', '2026-08-02T10:40:45Z')\n  .replaceAll('2026-08-07T16:08:45Z', '2026-08-02T12:08:45Z')\n  .replaceAll('2026-08-07T20:10:00Z', '2026-08-02T11:10:00Z')\n  .replaceAll('2026-08-07T20:25:00Z', '2026-08-02T12:25:00Z')\n  .replaceAll('2026-08-07T22:10:00Z', '2026-08-02T12:10:00Z')\n  .replaceAll('2026-08-07T22:25:00Z', '2026-08-02T12:25:00Z')\n  .replace(\n    \"  assert.equal(result.kind, 'component-state');\\n  assert.match(result.status, /Partially Degraded Service/);\\n  assert.match(result.message, /Datto SaaS Protection Backups/);\",\n    \"  assert.equal(result.kind, 'issues');\\n  assert.equal(result.incidents.length, 1);\\n  assert.match(result.incidents[0].title, /Datto SaaS Protection/);\\n  assert.match(result.incidents[0].affectedService, /Datto SaaS Protection Backups/);\"\n  );\nwrite('scripts/__tests__/full-review-source-adapters.test.js', fullReviewTests);\n\n`;
if (!patch.includes(testInsertMarker)) throw new Error('Missing last-mile generated test marker');
patch = patch.replace(testInsertMarker, fixturePatch + testInsertMarker);

fs.writeFileSync(patchPath, patch);
console.log('Corrected last-mile patch contract, current-evidence fixtures, and Kaseya incident expectation.');
