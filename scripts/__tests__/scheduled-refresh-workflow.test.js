import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const workflow = fs.readFileSync(new URL('../../.github/workflows/refresh-pages.yml', import.meta.url), 'utf8');

test('scheduled status refresh runs every five minutes', () => {
  assert.match(workflow, /cron:\s*["']\*\/5 \* \* \* \*["']/);
});

test('freshness recovery is data-only and preserves the five-minute schedule', () => {
  assert.match(workflow, /repository_dispatch:\s*\n\s+types: \[freshness-recovery\]/);
  assert.match(workflow, /github\.event_name != 'schedule' && github\.event_name != 'repository_dispatch'/);
  assert.match(workflow, /github\.event_name == 'schedule' \|\| github\.event_name == 'repository_dispatch'/);
});

test('scheduled refresh retries transient Pages deployment failures', () => {
  assert.match(workflow, /name: Deploy Pages, attempt 1[\s\S]*continue-on-error: true/);
  assert.match(workflow, /name: Deploy Pages, attempt 2[\s\S]*continue-on-error: true/);
  assert.match(workflow, /name: Deploy Pages, final attempt/);
  assert.match(workflow, /name: Back off after first Pages failure/);
  assert.match(workflow, /name: Back off after second Pages failure/);
});

test('release-only browser and wallboard certification does not run on five-minute polls', () => {
  const releaseOnlySteps = [
    'Render deployed enterprise workspace in headless Chrome',
    'Resolve published pre-cascade-layer Chromium snapshot',
    'Verify pinned pre-cascade-layer Chromium wallboard runtime',
    'Verify 458x291 Yodeck wallboard contract',
  ];

  for (const name of releaseOnlySteps) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(workflow, new RegExp(`name: ${escaped}\\n\\s+if: github\\.event_name != 'schedule'`));
  }
});

test('scheduled refresh keeps collection, payload validation and production smoke strict', () => {
  assert.match(workflow, /name: Collect and validate public status data without GitHub credentials\n\s+run:/);
  assert.match(workflow, /name: Verify browser payload compatibility before deployment\n\s+run:/);
  assert.match(workflow, /name: Verify truthful coverage, collection intelligence, and freshness\n\s+id: verify-status\n\s+run:/);
  assert.match(workflow, /name: Smoke-test deployed assets, payload, and collection contract\n\s+env:/);
  assert.doesNotMatch(workflow, /jobs:\n\s+build:\n\s+continue-on-error:/);
  assert.doesNotMatch(workflow, /\n\s+deploy:\n\s+continue-on-error:/);
});

test('every deployment exposes an immutable payload selected by deploy-version metadata', () => {
  assert.match(workflow, /node scripts\/prepare-versioned-status\.mjs dist/);
});
