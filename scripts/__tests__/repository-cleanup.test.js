import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

const removed = [
  'heartbeat.json',
  '.github/provider-coverage-final-trigger',
  'src/styles/intelligence.css',
  'src/styles/mobile.css',
  'src/styles/site-guide.css',
  'src/styles/status-tweaks.css'
];

test('obsolete heartbeat, release trigger, and unreferenced legacy styles stay removed', () => {
  for (const relative of removed) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} should stay removed`);
  }
});

test('the runtime stylesheet entrypoint names only active owned stylesheets', () => {
  const main = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
  for (const legacy of ['intelligence.css', 'mobile.css', 'site-guide.css', 'status-tweaks.css']) {
    assert.doesNotMatch(main, new RegExp(legacy.replace('.', '\\.')));
  }
  for (const active of ['command-center.css', 'ultra-hd.css', 'mobile-ops.css', 'ultra-hd-tuning.css', 'wallboard-v2.css', 'wallboard-compat.css', 'wallboard-tv.css']) {
    assert.match(main, new RegExp(active.replace('.', '\\.')));
  }
});
