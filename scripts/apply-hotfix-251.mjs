import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  fs.writeFileSync(path, value);
}

function replaceOnce(value, search, replacement, label) {
  const index = value.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}`);
  if (value.indexOf(search, index + search.length) >= 0) throw new Error(`Found multiple matches for ${label}`);
  return `${value.slice(0, index)}${replacement}${value.slice(index + search.length)}`;
}

function replaceRange(value, start, end, replacement, label) {
  const startIndex = value.indexOf(start);
  if (startIndex < 0) throw new Error(`Could not find start of ${label}`);
  const endIndex = value.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`Could not find end of ${label}`);
  return `${value.slice(0, startIndex)}${replacement}${value.slice(endIndex)}`;
}

let publicStatus = read('scripts/update-public-status.mjs');
publicStatus = replaceOnce(
  publicStatus,
  `function shortTime(value) {`,
  `function stableHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function canonicalMaintenanceTime(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : cleanText(value || '');
}

function maintenanceToken(source, item, title) {
  const vendorId = cleanText(item.id || '');
  if (vendorId) return vendorId;
  const normalizedTitle = normalizeIncidentTitle(title) || cleanText(title).toLowerCase() || 'maintenance';
  const sourceUrl = safeIncidentUrl(item.url || source.pageUrl || source.url, source.pageUrl || source.url);
  const signature = [
    normalizedTitle,
    canonicalMaintenanceTime(item.startsAt || item.starts_at || item.time),
    canonicalMaintenanceTime(item.endsAt || item.ends_at),
    sourceUrl
  ].join('|');
  const slug = normalizedTitle.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'maintenance';
  return \`${'${slug}'}-${'${stableHash(signature)}'}\`;
}

function shortTime(value) {`,
  'maintenance identity helpers'
);
publicStatus = replaceOnce(
  publicStatus,
  `function makeMaintenance(provider, source, item) {
  const title = cleanText(item.title || 'Scheduled maintenance');
  const vendorId = cleanText(item.id || '');
  const status = normalizeMaintenanceState(item.status || 'scheduled');
  return {
    id: \`${'${provider.id}'}:${'${vendorId || normalizeIncidentTitle(title) || title.toLowerCase()}'}:maintenance\`,`,
  `export function makeMaintenance(provider, source, item) {
  const title = cleanText(item.title || 'Scheduled maintenance');
  const token = maintenanceToken(source, item, title);
  const status = normalizeMaintenanceState(item.status || 'scheduled');
  return {
    id: \`${'${provider.id}'}:${'${token}'}:maintenance\`,`,
  'makeMaintenance identity'
);
publicStatus = replaceOnce(
  publicStatus,
  `function providerStatus(provider, source, status, color, ok, message, logs, incidents = [], maintenance = [], sourceState, extras = {}) {`,
  `export function dedupeMaintenanceRecords(items) {
  const records = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) continue;
    const current = records.get(item.id);
    if (!current) {
      records.set(item.id, { ...item, updates: boundedTimeline(item.updates) });
      continue;
    }
    const currentTime = Date.parse(current.latest_update || current.announced_at || '') || 0;
    const itemTime = Date.parse(item.latest_update || item.announced_at || '') || 0;
    const newer = itemTime >= currentTime ? item : current;
    const older = itemTime >= currentTime ? current : item;
    records.set(item.id, {
      ...older,
      ...newer,
      starts_at: newer.starts_at || older.starts_at || '',
      ends_at: newer.ends_at || older.ends_at || '',
      announced_at: newer.announced_at || older.announced_at || '',
      latest_update: newer.latest_update || older.latest_update || '',
      affected_service: newer.affected_service || older.affected_service || '',
      updates: boundedTimeline([...(current.updates || []), ...(item.updates || [])])
    });
  }
  return [...records.values()];
}

function providerStatus(provider, source, status, color, ok, message, logs, incidents = [], maintenance = [], sourceState, extras = {}) {`,
  'maintenance deduplication helper'
);
publicStatus = replaceOnce(
  publicStatus,
  `  const maintenance = results.flatMap(result => result.maintenance || [])
    .filter(item => maintenanceIsRelevant(item))
    .sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || (Date.parse(a.starts_at || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(b.starts_at || '') || Number.MAX_SAFE_INTEGER));`,
  `  const maintenance = dedupeMaintenanceRecords(
    results.flatMap(result => result.maintenance || [])
      .filter(item => maintenanceIsRelevant(item))
  ).sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || (Date.parse(a.starts_at || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(b.starts_at || '') || Number.MAX_SAFE_INTEGER));`,
  'global maintenance aggregation'
);
write('scripts/update-public-status.mjs', publicStatus);

let updateStatus = read('scripts/update-status.mjs');
const validator = `export function validatePayload(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object')
        throw new Error('Generated payload validation failed: payload must be an object');
    const providers = Array.isArray(payload.providers) ? payload.providers : [];
    const incidents = Array.isArray(payload.incidents) ? payload.incidents : [];
    const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance : [];
    if (!Array.isArray(payload.providers))
        errors.push('providers must be an array');
    if (!Array.isArray(payload.incidents))
        errors.push('incidents must be an array');
    if (payload.maintenance !== undefined && !Array.isArray(payload.maintenance))
        errors.push('maintenance must be an array');
    const ids = new Set();
    for (const provider of providers) {
        if (ids.has(provider.id))
            errors.push(\`duplicate provider \${provider.id}\`);
        ids.add(provider.id);
        if (!['operational', 'degraded', 'major', 'unknown'].includes(provider.service_state))
            errors.push(\`invalid service state \${provider.id}\`);
        if (!['available', 'limited', 'unavailable', 'disabled', 'pending', 'stale'].includes(provider.source_state))
            errors.push(\`invalid source state \${provider.id}\`);
        if (typeof provider.ok !== 'boolean' || !Number.isFinite(provider.priority) || !/^https?:/.test(provider.source))
            errors.push(\`invalid provider \${provider.id}\`);
    }
    const incidentIds = new Set();
    for (const incident of incidents) {
        if (!ids.has(incident.providerId))
            errors.push(\`unknown incident provider \${incident.providerId}\`);
        if (incidentIds.has(incident.id))
            errors.push(\`duplicate incident \${incident.id}\`);
        incidentIds.add(incident.id);
        try {
            if (!['http:', 'https:'].includes(new URL(incident.url).protocol))
                errors.push(\`invalid incident URL \${incident.id}\`);
        }
        catch {
            errors.push(\`invalid incident URL \${incident.id}\`);
        }
        if (incident.rawTime && Date.parse(incident.rawTime) > Date.now() + 300000)
            errors.push(\`future incident \${incident.id}\`);
    }
    const maintenanceIds = new Set();
    for (const item of maintenance) {
        if (!ids.has(item.providerId))
            errors.push(\`unknown maintenance provider \${item.providerId}\`);
        if (!item.id || maintenanceIds.has(item.id))
            errors.push(\`duplicate maintenance \${item.id || 'missing'}\`);
        maintenanceIds.add(item.id);
        try {
            if (!['http:', 'https:'].includes(new URL(item.url).protocol))
                errors.push(\`invalid maintenance URL \${item.id}\`);
        }
        catch {
            errors.push(\`invalid maintenance URL \${item.id}\`);
        }
        if (!['scheduled', 'in_progress', 'completed', 'unknown'].includes(item.status))
            errors.push(\`invalid maintenance state \${item.id}\`);
        for (const field of ['starts_at', 'ends_at', 'announced_at', 'latest_update']) {
            if (item[field] && !Number.isFinite(Date.parse(item[field])))
                errors.push(\`invalid maintenance \${field} \${item.id}\`);
        }
    }
    if (!Array.isArray(payload.changes) || !Array.isArray(payload.history))
        errors.push('changes and history must be arrays');
    const expected = summarizeProviders(providers, incidents);
    for (const [key, value] of Object.entries(expected))
        if (payload.summary?.[key] !== value)
            errors.push(\`summary mismatch \${key}\`);
    if (payload.schema_version !== 2 || !Number.isFinite(Date.parse(payload.generated_at)))
        errors.push('invalid schema metadata');
    if (errors.length)
        throw new Error(\`Generated payload validation failed: \${errors.join('; ')}\`);
    return true;
}
`;
updateStatus = replaceRange(
  updateStatus,
  'export function validatePayload(payload)',
  'export async function generateStatus()',
  `${validator}export async function generateStatus()`,
  'server payload validator'
);
write('scripts/update-status.mjs', updateStatus);

let intelligence = read('scripts/source-intelligence.mjs');
intelligence = replaceOnce(intelligence, `export const PARSER_VERSION = '2.5.0';`, `export const PARSER_VERSION = '2.5.1';`, 'parser version');
write('scripts/source-intelligence.mjs', intelligence);

write('scripts/validate-browser-payload.mjs', `import fs from 'node:fs';
import path from 'node:path';
import { payloadValidationErrors } from '../src/payloadValidation.ts';

const target = path.resolve(process.argv[2] || 'public/status.json');
const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
const errors = payloadValidationErrors(payload);
if (errors.length) {
  for (const error of errors) console.error(\`BROWSER_PAYLOAD_ERROR \${error}\`);
  throw new Error(\`Browser payload validation failed with \${errors.length} error(s).\`);
}
console.log(\`Browser payload validation passed: \${payload.providers.length} providers, \${payload.incidents.length} incidents, \${payload.maintenance?.length || 0} maintenance events.\`);
`);

write('scripts/production-smoke.mjs', `import { payloadValidationErrors } from '../src/payloadValidation.ts';

const requestedBase = process.argv[2] || 'https://dmo18.github.io/sst/';
const base = new URL(requestedBase.endsWith('/') ? requestedBase : \`${'${requestedBase}'}/\`).href;
const cacheBust = Date.now();
const htmlResponse = await fetch(\`${'${base}'}?smoke=${'${cacheBust}'}\`, { redirect: 'follow', cache: 'no-store' });
console.log(\`INDEX \${htmlResponse.status} \${htmlResponse.url} \${htmlResponse.headers.get('content-type') || ''}\`);
const html = await htmlResponse.text();
console.log(\`INDEX_BYTES \${Buffer.byteLength(html)}\`);
if (!htmlResponse.ok) throw new Error(\`index failed with HTTP \${htmlResponse.status}\`);

const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(match => new URL(match[1], base).href);
const styles = [...html.matchAll(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi)].map(match => new URL(match[1], base).href).filter(url => /\\.css(?:\\?|$)/.test(url));
console.log(\`SCRIPTS \${scripts.join(' ') || 'none'}\`);
console.log(\`STYLES \${styles.join(' ') || 'none'}\`);
if (!scripts.length) throw new Error('no JavaScript bundle found in index');

for (const url of [...scripts, ...styles]) {
  const response = await fetch(url, { redirect: 'follow', cache: 'no-store' });
  const body = await response.arrayBuffer();
  console.log(\`ASSET \${response.status} \${body.byteLength} \${response.headers.get('content-type') || ''} \${url}\`);
  if (!response.ok || body.byteLength === 0) throw new Error(\`asset failed: \${url}\`);
}

const statusUrl = new URL('status.json', base);
statusUrl.searchParams.set('smoke', String(cacheBust));
const statusResponse = await fetch(statusUrl, { redirect: 'follow', cache: 'no-store' });
console.log(\`STATUS \${statusResponse.status} \${statusResponse.headers.get('content-type') || ''}\`);
const statusText = await statusResponse.text();
console.log(\`STATUS_BYTES \${Buffer.byteLength(statusText)}\`);
if (!statusResponse.ok) throw new Error(\`status failed with HTTP \${statusResponse.status}\`);
const payload = JSON.parse(statusText);
const errors = payloadValidationErrors(payload);
console.log(\`PAYLOAD_VERSION \${payload?.schema_version}\`);
console.log(\`GENERATED_AT \${payload?.generated_at}\`);
console.log(\`PROVIDERS \${payload?.providers?.length}\`);
console.log(\`INCIDENTS \${payload?.incidents?.length}\`);
console.log(\`MAINTENANCE \${payload?.maintenance?.length}\`);
console.log(\`VALIDATION_ERRORS \${errors.length}\`);
for (const error of errors) console.log(\`VALIDATION_ERROR \${error}\`);
if (errors.length) throw new Error(\`deployed payload rejected by browser validator: \${errors.join('; ')}\`);
`);

write('scripts/__tests__/maintenance-identity.test.js', `import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeMaintenanceRecords, makeMaintenance } from '../update-public-status.mjs';
import { summarizeProviders, validatePayload } from '../update-status.mjs';

const provider = {
  id: 'stripe',
  name: 'Stripe',
  category: 'Payments',
  priority: 80,
  services: ['Payments']
};
const source = {
  mode: 'feed',
  url: 'https://status.stripe.com/history.rss',
  pageUrl: 'https://status.stripe.com/',
  sourceName: 'Stripe official feed'
};

function maintenance(overrides = {}) {
  return makeMaintenance(provider, source, {
    title: 'Maintenance for TWINT',
    note: 'Planned maintenance.',
    status: 'scheduled',
    startsAt: '2026-08-01T01:00:00Z',
    endsAt: '2026-08-01T02:00:00Z',
    announcedAt: '2026-07-31T12:00:00Z',
    latestUpdate: '2026-07-31T12:00:00Z',
    url: 'https://status.stripe.com/',
    ...overrides
  });
}

test('same-title recurring maintenance receives date-specific stable IDs', () => {
  const first = maintenance();
  const repeated = maintenance();
  const nextWindow = maintenance({
    startsAt: '2026-08-08T01:00:00Z',
    endsAt: '2026-08-08T02:00:00Z'
  });
  assert.equal(first.id, repeated.id);
  assert.notEqual(first.id, nextWindow.id);
});

test('true duplicate maintenance records merge into one bounded timeline', () => {
  const first = maintenance({ updates: [{ status: 'scheduled', note: 'Announced', at: '2026-07-31T12:00:00Z' }] });
  const updated = maintenance({
    latestUpdate: '2026-07-31T13:00:00Z',
    updates: [{ status: 'scheduled', note: 'Timing confirmed', at: '2026-07-31T13:00:00Z' }]
  });
  const records = dedupeMaintenanceRecords([first, updated]);
  assert.equal(records.length, 1);
  assert.equal(records[0].latest_update, '2026-07-31T13:00:00Z');
  assert.equal(records[0].updates.length, 2);
});

test('server validator rejects duplicate maintenance IDs', () => {
  const providerStatus = {
    id: 'stripe', name: 'Stripe', category: 'Payments', status: 'Operational', color: 'green',
    service_state: 'operational', source_state: 'available', attention: 'informational', ok: true,
    source: 'https://status.stripe.com/', priority: 80
  };
  const item = maintenance();
  const payload = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    providers: [providerStatus],
    incidents: [],
    maintenance: [item, { ...item }],
    changes: [],
    history: [],
    summary: summarizeProviders([providerStatus], [])
  };
  assert.throws(() => validatePayload(payload), /duplicate maintenance/);
});
`);

let packageJson = JSON.parse(read('package.json'));
packageJson.scripts['validate-browser-payload'] = 'node --experimental-strip-types scripts/validate-browser-payload.mjs';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

let changelog = read('CHANGELOG.md');
const release = `## [2.5.1] - 2026-07-31

### Fixed

- Fixed recurring same-title maintenance windows producing duplicate IDs that caused the deployed browser validator to reject the entire payload.
- Added deterministic maintenance identity based on the vendor ID when available, otherwise the normalized title, maintenance window, and official source URL.
- Added global maintenance deduplication that merges repeated updates into one bounded timeline.
- Added maintenance validation parity to the server-side generator so duplicate IDs, invalid states, timestamps, providers, or URLs fail before publication.

### Deployment safety

- Added the exact browser payload validator as a mandatory pre-deployment check.
- Added deployed HTML, JavaScript, CSS, and status-payload smoke checks after GitHub Pages publication.
- Added a headless-browser render assertion before the deployment success marker is published.

`;
changelog = replaceOnce(changelog, '## [2.5.0] - 2026-07-31', `${release}## [2.5.0] - 2026-07-31`, 'changelog release heading');
write('CHANGELOG.md', changelog);

let readme = read('README.md');
readme = replaceOnce(
  readme,
  `.github/workflows/test.yml\` runs \`npm ci\`, provider validation, deterministic tests, typecheck, and \`build:app\` on pull requests without vendors. The sole Pages workflow triggers on \`main\`, manual dispatch, and at minutes 7, 19, 31, 43, and 55. Its **build** job has only \`contents: read\`, runs catalog validation, one live generation, payload checks, and one Vite build; its dependent **deploy** job alone has \`pages: write\` and \`id-token: write\`. One concurrency group prevents overlapping deployments. Vite base \`/sst/\` is fixed for Pages; \`status.json\` and logos are copied into \`dist\`.`,
  `.github/workflows/test.yml\` runs \`npm ci\`, provider validation, deterministic tests, typecheck, and \`build:app\` on pull requests without vendors. The sole Pages workflow triggers on \`main\`, manual dispatch, and at minutes 7, 19, 31, 43, and 55. Its **build** job has only \`contents: read\`, runs catalog validation, one live generation, both server and browser payload validation, and one Vite build. Its dependent **deploy** job alone has \`pages: write\` and \`id-token: write\`; after publication it fetches the deployed HTML, JavaScript, CSS, and status payload and renders the live page in headless Chrome. The deployment success marker is written only after those production smoke checks pass. One concurrency group prevents overlapping deployments. Vite base \`/sst/\` is fixed for Pages; \`status.json\` and logos are copied into \`dist\`.`,
  'README deployment contract'
);
write('README.md', readme);

write('.github/workflows/test.yml', `name: Pull request checks
on:
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run validate-providers
      - run: npm test
      - run: npm run typecheck
      - run: npm run build:app
`);

let pages = read('.github/workflows/refresh-pages.yml');
pages = replaceOnce(
  pages,
  `      - run: npm run update-status
      - name: Verify truthful source coverage and payload freshness`,
  `      - run: npm run update-status
      - name: Verify browser payload compatibility before deployment
        run: npm run validate-browser-payload
      - name: Verify truthful source coverage and payload freshness`,
  'pre-deploy browser payload gate'
);
pages = replaceOnce(
  pages,
  `    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
      - name: Publish deployed status data verification`,
  `    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - name: Smoke-test deployed assets and browser payload
        env:
          PAGE_URL: \${{ steps.deployment.outputs.page_url }}
        run: node --experimental-strip-types scripts/production-smoke.mjs "$PAGE_URL"
      - name: Render deployed page in headless Chrome
        env:
          PAGE_URL: \${{ steps.deployment.outputs.page_url }}
        run: |
          BROWSER="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
          test -n "$BROWSER"
          "$BROWSER" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=20000 --dump-dom "${'${PAGE_URL}'}?smoke=${'${GITHUB_RUN_ID}'}" > /tmp/live-dom.html
          echo "DOM_BYTES $(wc -c < /tmp/live-dom.html)"
          grep -q 'Technician briefing' /tmp/live-dom.html
          grep -q 'Provider diagnostics and evidence' /tmp/live-dom.html
          ! grep -q 'Status intelligence unavailable' /tmp/live-dom.html
          ! grep -q 'Load failed; no health conclusion is available' /tmp/live-dom.html
      - name: Publish deployed status data verification`,
  'post-deploy browser smoke gate'
);
write('.github/workflows/refresh-pages.yml', pages);

console.log('Applied 2.5.1 production recovery patch.');
