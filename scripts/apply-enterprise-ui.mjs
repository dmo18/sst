import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();

function decodeDirectory(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const encoded = fs.readdirSync(directory)
    .filter(name => name.endsWith('.txt'))
    .sort()
    .map(name => fs.readFileSync(path.join(directory, name), 'utf8').trim())
    .join('');
  return zlib.brotliDecompressSync(Buffer.from(encoded, 'base64')).toString('utf8');
}

function write(relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
}

write('src/IssueConsole.tsx', decodeDirectory('scripts/enterprise-ui-payload/IssueConsole'));
write('src/styles/command-center.css', decodeDirectory('scripts/enterprise-ui-payload/command-center'));

write('src/liveTelemetry.ts', `export function relativeAgeAt(value: string | undefined, now: number): string {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return 'Unknown';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 5) return 'Now';
  if (seconds < 60) return \`${'${seconds}'}s ago\`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return \`${'${minutes}'}m ago\`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return \`${'${hours}'}h ago\`;
  return \`${'${Math.floor(hours / 24)}'}d ago\`;
}

export function countdownLabel(target: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  if (seconds < 60) return \`${'${seconds}'}s\`;
  const minutes = Math.floor(seconds / 60);
  return \`${'${minutes}'}m ${'${String(seconds % 60).padStart(2, \'0\')}'}s\`;
}
`);

write('src/__tests__/liveTelemetry.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownLabel, relativeAgeAt } from '../liveTelemetry';

test('relative age updates at second, minute, hour, and day boundaries', () => {
  const now = Date.parse('2026-08-02T04:00:00.000Z');
  assert.equal(relativeAgeAt('2026-08-02T03:59:57.000Z', now), 'Now');
  assert.equal(relativeAgeAt('2026-08-02T03:59:18.000Z', now), '42s ago');
  assert.equal(relativeAgeAt('2026-08-02T03:42:00.000Z', now), '18m ago');
  assert.equal(relativeAgeAt('2026-08-02T01:00:00.000Z', now), '3h ago');
  assert.equal(relativeAgeAt('2026-07-30T04:00:00.000Z', now), '3d ago');
  assert.equal(relativeAgeAt(undefined, now), 'Unknown');
});

test('refresh countdown remains deterministic and never becomes negative', () => {
  const now = 1_000_000;
  assert.equal(countdownLabel(now + 42_000, now), '42s');
  assert.equal(countdownLabel(now + 125_000, now), '2m 05s');
  assert.equal(countdownLabel(now - 1, now), '0s');
});
`);

const indexPath = path.join(root, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
index = index
  .replace('<meta name="theme-color" content="#07100f">', '<meta name="theme-color" content="#11161d">')
  .replace('<meta name="description" content="A first-party public-source MSP service intelligence command center.">', '<meta name="description" content="Enterprise MSP service intelligence with live provider, incident, and source-reliability operations.">')
  .replace('<title>MSP Operations Command Center</title>', '<title>ServiceOps | MSP Service Intelligence</title>');
fs.writeFileSync(indexPath, index);

const packagePath = path.join(root, 'package.json');
const packageMetadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageMetadata.description = 'Enterprise first-party MSP service intelligence and live operations workspace.';
fs.writeFileSync(packagePath, `${JSON.stringify(packageMetadata, null, 2)}\n`);

const changelogPath = path.join(root, 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf8');
const release = `## [3.1.0] - 2026-08-02

### Enterprise application experience

- Replaced the decorative command-center presentation with a restrained enterprise SaaS shell: persistent workspace navigation, compact top bar, flat data surfaces, dense information hierarchy, and consistent operational tables.
- Replaced provider cards with a sortable provider operations table showing service state, source health, event counts, quality, request latency, request success, and observation age in directly comparable columns.
- Added continuously updating Eastern time, payload age, last browser check, next-refresh countdown, incident ages, source-observation ages, and wallboard timestamps without inventing streaming vendor data.
- Added a live KPI strip for incidents, affected providers, confirmed operational providers, coverage, collection quality, blind spots, request success, and p95 latency.
- Reworked incident operations, source reliability, timeline, maintenance, provider details, and wallboard layouts for clearer scanning and lower visual noise.
- Added deterministic tests for second-, minute-, hour-, and day-level relative time plus refresh-countdown boundaries.

### Trust and deployment safety

- Preserved the first-party-only, unauthenticated, fail-closed data contract and the separation between service health and collection health.
- Kept existing browser-render deployment markers while adding enterprise UI smoke assertions for live fields and provider tables.

`;
if (!changelog.includes('## [3.1.0]')) changelog = changelog.replace('## [3.0.0]', `${release}## [3.0.0]`);
fs.writeFileSync(changelogPath, changelog);

console.log('Applied the v3.1 enterprise SaaS workspace redesign.');
