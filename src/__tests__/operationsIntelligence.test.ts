import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('operations intelligence is operator-only and never changes wallboard composition', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /<OperationsIntelligencePanel model=\{model\} \/>/);
  const wallboardBranch = app.match(/route\.wallboardMode[\s\S]*?:\s*<>([\s\S]*?)<\/>/);
  assert.ok(wallboardBranch);
  assert.match(wallboardBranch[1], /IssueConsole/);
  assert.match(wallboardBranch[1], /OperationsIntelligencePanel/);
});

test('operator intelligence states evidence boundaries explicitly', async () => {
  const panel = await read('src/OperationsIntelligencePanel.tsx');
  assert.match(panel, /evidence controls, not vendor service health/);
  assert.match(panel, /never causal claims/);
  assert.match(panel, /Snapshot-only current-page observations are intentionally excluded/);
  assert.doesNotMatch(panel, /client name|tenant name|ticket id/i);
});

test('schema canary is separate from service-state decision logic', async () => {
  const source = await read('scripts/source-intelligence.mjs');
  const reliability = await read('scripts/source-reliability.mjs');
  assert.match(source, /schema_canary: schemaCanary/);
  assert.doesNotMatch(reliability, /service_state\s*=|serviceState\s*=/);
});
