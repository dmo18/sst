import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('operational posture copy agrees in singular and plural states', async () => {
  const source = await read('src/IssueConsole.tsx');
  assert.match(source, /major_count === 1 \? 'requires' : 'require'/);
  assert.match(source, /degraded_count === 1 \? 'is' : 'are'/);
  assert.match(source, /blindSpotCount === 1 \? 'remains' : 'remain'/);
  assert.doesNotMatch(source, /issue\$\{model\.summary\.major_count === 1 \? '' : 's'\} require validation/);
});

test('last-mile polish clears the desktop pulse and compacts mobile intelligence', async () => {
  const main = await read('src/main.tsx');
  const polish = await read('src/styles/premium-final-polish.css');
  const polishIndex = main.indexOf("./styles/premium-final-polish.css");
  const wallboardIndex = main.indexOf("./styles/wallboard-v2.css");

  assert.ok(polishIndex >= 0, 'final polish stylesheet must be loaded');
  assert.ok(wallboardIndex > polishIndex, 'wallboard geometry must still override operator polish');
  assert.match(polish, /\.workspace-main\s*\{[\s\S]*padding-bottom: 112px/);
  assert.match(polish, /\.ops-intel-trigger\s*\{[\s\S]*width: 48px[\s\S]*height: 48px/);
  assert.match(polish, /\.ops-intel-trigger::before/);
  assert.match(polish, /\.ops-intel-trigger span\s*\{[\s\S]*position: absolute/);
});

test('product verifier cleanup cannot mask completed UX evidence', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  assert.match(workflow, /OPERATOR_MOBILE_SCREENSHOT_BYTES/);
  assert.match(workflow, /ENOTEMPTY\|EBUSY/);
  assert.match(workflow, /operator-experience-verifier\.log/);
  assert.match(workflow, /exit "\$STATUS"/);
  assert.match(workflow, /rm -rf \/tmp\/operator-experience-cdp-\* \|\| true/);
});
