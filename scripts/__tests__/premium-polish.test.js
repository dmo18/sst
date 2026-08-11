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

test('persistent operator controls live in application chrome rather than over workspace content', async () => {
  const main = await read('src/main.tsx');
  const polish = await read('src/styles/premium-final-polish.css');
  const polishIndex = main.indexOf("./styles/premium-final-polish.css");
  const wallboardIndex = main.indexOf("./styles/wallboard-v2.css");

  assert.ok(polishIndex >= 0, 'final polish stylesheet must be loaded');
  assert.ok(wallboardIndex > polishIndex, 'wallboard geometry must still override operator polish');
  assert.match(polish, /@media \(min-width: 901px\)[\s\S]*\.experience-pulse\s*\{[\s\S]*left: 14px[\s\S]*width: calc\(var\(--px-sidebar\) - 28px\)/);
  assert.match(polish, /@media \(min-width: 901px\)[\s\S]*\.ops-intel-trigger\s*\{[\s\S]*left: 14px[\s\S]*width: calc\(var\(--px-sidebar\) - 28px\)/);
  assert.match(polish, /\.experience-pulse > div span\s*\{[\s\S]*display: none/);
  assert.match(polish, /\.experience-pulse > button span\s*\{[\s\S]*display: none/);
});

test('mobile intelligence control is docked into the sticky topbar', async () => {
  const polish = await read('src/styles/premium-final-polish.css');
  assert.match(polish, /@media \(max-width: 900px\)[\s\S]*\.ops-intel-trigger\s*\{[\s\S]*top: 13px[\s\S]*right: 116px[\s\S]*bottom: auto/);
  assert.match(polish, /\.ops-intel-trigger\s*\{[\s\S]*width: 40px[\s\S]*height: 40px/);
  assert.match(polish, /\.ops-intel-trigger::before/);
  assert.match(polish, /\.ops-intel-trigger span\s*\{[\s\S]*position: absolute/);
});

test('product verifier owns profile cleanup without workflow exception handling', async () => {
  const workflow = await read('.github/workflows/product-experience.yml');
  const verifier = await read('scripts/verify-operator-experience.mjs');

  assert.match(workflow, /set -o pipefail/);
  assert.match(workflow, /operator-experience-verifier\.log/);
  assert.doesNotMatch(workflow, /ENOTEMPTY\|EBUSY/);
  assert.doesNotMatch(workflow, /STATUS=\$\{PIPESTATUS\[0\]\}/);
  assert.match(verifier, /maxRetries: 3, retryDelay: 100/);
  assert.match(verifier, /Browser profile cleanup warning/);
  assert.match(verifier, /browserProcess\.kill\('SIGKILL'\)/);
});
