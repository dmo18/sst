import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('changelog latest release matches package version', () => {
  const packageMetadata = readJson('package.json');
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const latestRelease = /^## \[(\d+\.\d+\.\d+)\]\s+-\s+\d{4}-\d{2}-\d{2}$/m.exec(changelog);

  assert.ok(latestRelease, 'CHANGELOG.md must start with a dated semantic-version release heading');
  assert.equal(latestRelease[1], packageMetadata.version);
});

test('changelog documents the current regional scope', () => {
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

  assert.match(changelog, /US-first/i);
  assert.match(changelog, /UK, EU, EMEA, APAC/i);
  assert.match(changelog, /global, worldwide/i);
});
