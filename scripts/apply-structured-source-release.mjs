import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function replaceOnce(path, before, after) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Expected text not found in ${path}`);
  fs.writeFileSync(path, current.replace(before, after));
}

function writeJson(path, mutate) {
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  mutate(value);
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

replaceOnce(
  'scripts/update-public-status.mjs',
  `async function fetchPublicHtml(requestProvider) {
  const accept = 'text/html, text/plain, */*';
  const key = \`${'${requestProvider.url}'}|${'${accept}'}\`;
  if (!publicHtmlRequestCache.has(key)) {
    publicHtmlRequestCache.set(key, fetchSource(requestProvider, accept));
  }
  return publicHtmlRequestCache.get(key);
}`,
  `async function fetchPublicHtml(requestProvider, source) {
  const accept = /-json$/i.test(source.mode)
    ? 'application/json, text/json, */*'
    : 'text/html, text/plain, */*';
  const key = \`${'${requestProvider.url}'}|${'${accept}'}\`;
  if (!publicHtmlRequestCache.has(key)) {
    publicHtmlRequestCache.set(key, fetchSource(requestProvider, accept));
  }
  return publicHtmlRequestCache.get(key);
}`
);
replaceOnce(
  'scripts/update-public-status.mjs',
  '  const result = await fetchPublicHtml(requestProvider);',
  '  const result = await fetchPublicHtml(requestProvider, source);'
);
replaceOnce(
  'scripts/update-public-status.mjs',
  '  const feedResult = await tryFeedCandidates(provider, source, pageBody, logs);',
  "  const feedResult = /-json$/i.test(source.mode) ? null : await tryFeedCandidates(provider, source, pageBody, logs);"
);

replaceOnce(
  'scripts/structured-source-adapters.mjs',
  `function safeJson(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}`,
  `function safeJson(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}

function toIso(value) {
  const normalized = clean(value)
    .replace(/(\\d)(AM|PM)\\b/i, '$1 $2')
    .replace(/\\bEDT\\b/i, 'GMT-0400')
    .replace(/\\bEST\\b/i, 'GMT-0500')
    .replace(/\\bUTC\\b/i, 'GMT+0000');
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}`
);

replaceOnce(
  'scripts/structured-source-adapters.mjs',
  `export const structuredSourceOverrides = Object.fromEntries(
  Object.entries(statuspageCandidates).map(([id, [url, name]]) => [id, statuspageSource(url, name)])
);`,
  `const enabledStatuspageIds = new Set([
  'cloudflare', 'openai', 'anthropic', 'sentinelone', 'dnsfilter', 'ninjaone',
  'meraki', 'digitalocean', 'zoom', '1password', 'duo', 'huntress', 'twilio',
  'discord', 'notion'
]);

export const structuredSourceOverrides = Object.fromEntries(
  Object.entries(statuspageCandidates)
    .filter(([id]) => enabledStatuspageIds.has(id))
    .map(([id, [url, name]]) => [id, statuspageSource(url, name)])
);`
);

const adapterPath = 'scripts/structured-source-adapters.mjs';
const adapter = fs.readFileSync(adapterPath, 'utf8');
const statusioStart = adapter.indexOf('export function parseStatusioPage');
const statusioEnd = adapter.indexOf('\nexport function structuredSourceConclusion', statusioStart);
if (statusioStart < 0 || statusioEnd < 0) throw new Error('Status.io parser block not found');
const statusioParser = `export function parseStatusioPage(value, provider = {}, source = {}) {
  const lines = textLines(value);
  const pageBoundary = lines.findIndex(line => /^(?:scheduled maintenance|past incidents?|incident history)$/i.test(line));
  const current = pageBoundary >= 0 ? lines.slice(0, pageBoundary) : lines.slice(0, 1200);
  const markers = current
    .map((line, index) => /^active incident$/i.test(line) ? index : -1)
    .filter(index => index >= 0);

  if (!markers.length) {
    if (current.some(line => /all systems operational|0 active incidents?/i.test(line))) {
      return { kind: 'healthy', status: \`${'${provider.name || \'Provider\'}'} reports all systems operational\` };
    }
    return null;
  }

  const incidents = [];
  let foundSpecificIncident = false;
  let foundNonUsIncident = false;

  for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
    const segment = current.slice(markers[markerIndex] + 1, markers[markerIndex + 1] ?? current.length);
    const severityIndex = segment.findIndex(line => /^(?:degraded performance|partial outage|major outage)$/i.test(line));
    const lifecycleIndex = segment.findIndex(line => /^(?:investigating|identified|monitoring|update|in progress)$/i.test(line));
    const anchor = severityIndex >= 0 ? severityIndex : lifecycleIndex;
    if (anchor < 0) continue;

    let title = '';
    for (let index = anchor - 1; index >= 0; index -= 1) {
      const candidate = clean(segment[index]);
      if (!candidate || TITLE_NOISE.test(candidate) || DATE_LINE.test(candidate) || STATUS_LINE.test(candidate)) continue;
      if (/^(?:operational|degraded performance|partial outage|major outage)$/i.test(candidate)) continue;
      title = candidate;
      break;
    }
    if (!title || isGenericTitle(title)) continue;
    foundSpecificIncident = true;

    const componentsIndex = segment.findIndex(line => /^components?$/i.test(line));
    const locationsIndex = segment.findIndex(line => /^locations?$/i.test(line));
    const firstDateIndex = segment.findIndex(line => DATE_LINE.test(line));
    const componentEnd = [locationsIndex, firstDateIndex, lifecycleIndex].filter(index => index > componentsIndex).sort((a, b) => a - b)[0] ?? segment.length;
    const locationEnd = [firstDateIndex, lifecycleIndex].filter(index => index > locationsIndex).sort((a, b) => a - b)[0] ?? segment.length;
    const components = componentsIndex >= 0 ? segment.slice(componentsIndex + 1, componentEnd).filter(line => !TITLE_NOISE.test(line)) : [];
    const locations = locationsIndex >= 0 ? segment.slice(locationsIndex + 1, locationEnd).filter(line => !TITLE_NOISE.test(line)) : [];
    const dates = segment.filter(line => DATE_LINE.test(line)).map(toIso).filter(Boolean).sort();
    const lifecycle = lifecycleIndex >= 0 ? clean(segment[lifecycleIndex]) : clean(segment[severityIndex] || 'active');
    const noteStart = lifecycleIndex >= 0 ? lifecycleIndex + 1 : Math.max(severityIndex + 1, firstDateIndex + 1);
    const note = clean(segment.slice(noteStart).filter(line => !DATE_LINE.test(line) && !TITLE_NOISE.test(line)).join(' ')).slice(0, 900);
    const affectedService = uniqueNames([...components, ...locations]);
    if (isEditorial(title, note) || isPlannedOnly(title, note, lifecycle)) continue;
    if (!isUsRelevant(title, \`${'${note}'} ${'${locations.join(\' \')}'}\`, source.regionScope)) {
      foundNonUsIncident = true;
      continue;
    }

    incidents.push({
      title,
      note: note || \`${'${lifecycle}'} update from the official status page.\`,
      status: lifecycle.toLowerCase(),
      firstDetected: dates[0] || '',
      latestUpdate: dates.at(-1) || dates[0] || '',
      affectedService,
      color: colorFor(\`${'${segment[severityIndex] || \'\'}'} ${'${lifecycle}'} ${'${title}'} ${'${note}'}\`),
      url: source.url
    });
  }

  if (incidents.length) return { kind: 'issues', incidents };
  if (foundSpecificIncident && foundNonUsIncident) {
    return { kind: 'healthy', status: \`${'${provider.name || \'Provider\'}'} reports no active US-relevant incidents\` };
  }
  return null;
}
`;
fs.writeFileSync(adapterPath, `${adapter.slice(0, statusioStart)}${statusioParser}${adapter.slice(statusioEnd)}`);

replaceOnce(
  'scripts/__tests__/update-public-status.test.js',
  "    assert.equal(source.mode, 'status-html');",
  "    assert.equal(source.mode, id === 'superops' ? 'betterstack-json' : 'status-html');"
);

replaceOnce(
  'src/IssueConsole.tsx',
  `        <div><dt>Affected service</dt><dd>{affectedService(item)}</dd></div>
        <div><dt>First detected</dt><dd>{timeLabel(item.first_detected || item.rawTime || item.time)}</dd></div>`,
  `        <div><dt>Affected service</dt><dd>{affectedService(item)}</dd></div>
        <div><dt>Incident stage</dt><dd>{item.status || 'active'}</dd></div>
        <div><dt>First detected</dt><dd>{timeLabel(item.first_detected || item.rawTime || item.time)}</dd></div>`
);
replaceOnce(
  'src/IssueConsole.tsx',
  `        <p><b>Status captured:</b> {source.ok ? \`yes, ${'${timeLabel(source.checkedAt)}'}\` : \`no, last attempt ${'${timeLabel(source.checkedAt)}'}\`}</p>`,
  `        <p><b>Status captured:</b> {source.ok ? \`yes, ${'${timeLabel(source.checkedAt)}'}\` : \`no, last attempt ${'${timeLabel(source.checkedAt)}'}\`}</p>
        <p><b>Source adapter:</b> {source.sourceType.replaceAll('-', ' ')}</p>`
);

writeJson('package.json', value => { value.version = '2.4.0'; });
writeJson('package-lock.json', value => {
  value.version = '2.4.0';
  if (value.packages?.['']) value.packages[''].version = '2.4.0';
});

replaceOnce(
  'CHANGELOG.md',
  '## [2.3.9] - 2026-07-31',
  `## [2.4.0] - 2026-07-31

### Added

- Added first-party structured adapters for Atlassian Statuspage JSON, Better Stack public status JSON, and rendered Status.io pages.
- Added lifecycle, affected-component, official incident-link, first-detected, and latest-update extraction for structured incident records.
- Added source-adapter labels in provider diagnostics and incident-stage labels on incident cards.

### Changed

- Moved selected existing providers from broad HTML interpretation to their official public Statuspage JSON summaries.
- Moved SuperOps to its official public Better Stack JSON document.
- Added component and location-aware Status.io parsing for ConnectWise and HaloPSA.
- Kept scheduled maintenance, resolved incidents, editorial content, generic headings, and explicitly non-US-only incidents out of active incident output.
- Made malformed or non-operational structured responses without a usable incident record fail closed.

## [2.3.9] - 2026-07-31`
);

for (const path of [
  'docs/structured-source-release-notes.md',
  'docs/source-adapter-matrix.md',
  'docs/.structured-adapter-review',
  '.github/structured-source-adapters.md'
]) {
  fs.rmSync(path, { force: true });
}

fs.writeFileSync('.github/workflows/test.yml', `name: Pull request checks
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

fs.rmSync(fileURLToPath(import.meta.url), { force: true });
console.log('Applied structured source release patch.');
