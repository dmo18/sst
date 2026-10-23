import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const release = read('../../.github/workflows/refresh-pages.yml');
const codeql = read('../../.github/workflows/codeql.yml');
const dependabot = read('../../.github/dependabot.yml');
const lock = JSON.parse(read('../../package-lock.json'));

test('scheduled Pages releases report official-source coverage per run instead of exhausting commit statuses', () => {
  assert.match(release, /GITHUB_STEP_SUMMARY/);
  assert.match(release, /STATUS_STATE/);
  assert.match(release, /STATUS_DESCRIPTION/);
  assert.match(release, /warning title=Incomplete official-source coverage/);
  assert.doesNotMatch(release, /statuses:\s*write/);
  assert.doesNotMatch(release, /\/statuses\//);
});

test('CodeQL init and analyze use the same SHA and Dependabot groups their updates', () => {
  const pinned = [...codeql.matchAll(/uses:\s*github\/codeql-action\/(?:init|analyze)@([0-9a-f]{40})/g)].map(match => match[1]);
  assert.equal(pinned.length, 2);
  assert.equal(new Set(pinned).size, 1);
  assert.match(dependabot, /github\/codeql-action\*/);
});

test('source-map-js lockfile version includes the fix for GHSA-68fv-2mgg-jv7q', () => {
  const entry = lock.packages['node_modules/source-map-js'];
  assert.ok(entry?.version, 'source-map-js must remain explicitly resolved');
  const [major, minor, patch] = entry.version.split('.').map(Number);
  assert.ok(major > 1 || (major === 1 && (minor > 2 || (minor === 2 && patch >= 2))));
  assert.match(entry.integrity, /^sha512-/);
});
