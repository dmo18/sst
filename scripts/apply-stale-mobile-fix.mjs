import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
function replaceOnce(path, before, after) {
  const content = read(path);
  if (!content.includes(before)) throw new Error(`Patch target not found in ${path}: ${before.slice(0, 100)}`);
  write(path, content.replace(before, after));
}

write('scripts/incident-freshness.mjs', `export const INCIDENT_MAX_AGE_DAYS = 45;

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const monthDate = new RegExp('\\\\b' + MONTH + '\\\\s+\\\\d{1,2}\\\\s*,\\\\s*\\\\d{4}(?:\\\\s*(?:-|at)?\\\\s*\\\\d{1,2}:\\\\d{2}(?::\\\\d{2})?\\\\s*(?:UTC|GMT|EDT|EST)?)?', 'gi');
const isoDate = /\\b20\\d{2}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?/gi;

function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function normalizedDateText(value) {
  return clean(value)
    .replace(/\\s+,/g, ',')
    .replace(/\\s+-\\s+/g, ' ')
    .replace(/\\bEDT\\b/gi, 'GMT-0400')
    .replace(/\\bEST\\b/gi, 'GMT-0500')
    .replace(/\\bUTC\\b/gi, 'GMT+0000');
}

function parseDate(value) {
  const parsed = Date.parse(normalizedDateText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dateLikeIncidentTitle(value) {
  const title = clean(value);
  if (!title) return false;
  const monthOnly = new RegExp('^' + MONTH + '\\\\s+\\\\d{1,2}\\\\s*,\\\\s*\\\\d{4}(?:\\\\s*(?:-|at)?\\\\s*\\\\d{1,2}:\\\\d{2}(?::\\\\d{2})?\\\\s*(?:UTC|GMT|EDT|EST)?)?$', 'i');
  return monthOnly.test(title) || /^20\\d{2}-\\d{2}-\\d{2}(?:[ T].*)?$/.test(title);
}

export function incidentTimestampMs(item) {
  for (const key of ['latestUpdate', 'latest_update', 'rawTime', 'time', 'updated_at', 'firstDetected', 'first_detected', 'created_at']) {
    const parsed = parseDate(item?.[key]);
    if (parsed) return parsed;
  }
  return 0;
}

export function embeddedIncidentDateMs(value) {
  const text = clean(value);
  const matches = [...text.matchAll(monthDate), ...text.matchAll(isoDate)];
  return matches.map(match => parseDate(match[0])).filter(Boolean).sort((a, b) => b - a)[0] || 0;
}

export function incidentEvidenceIsCurrent(item, now = Date.now(), maxAgeDays = INCIDENT_MAX_AGE_DAYS, options = {}) {
  if (!item || dateLikeIncidentTitle(item.title)) return false;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const timestamp = incidentTimestampMs(item);
  if (timestamp) {
    const age = now - timestamp;
    return age >= -5 * 60 * 1000 && age <= maxAgeMs;
  }
  const embedded = embeddedIncidentDateMs([item.title, item.note, item.status].filter(Boolean).join(' '));
  if (embedded) {
    const age = now - embedded;
    return age >= -5 * 60 * 1000 && age <= maxAgeMs;
  }
  return options.requireTimestamp !== true;
}
`);

replaceOnce('scripts/update-status.mjs',
  "import { fileURLToPath } from 'node:url';\n",
  "import { fileURLToPath } from 'node:url';\nimport { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';\n"
);
replaceOnce('scripts/update-status.mjs',
`export function activeIncident(item) {
    const timestamp = parseDateMs(item.rawTime);
    if (timestamp > Date.now() + 300000)
        return false;
    const text = \`${'${item.title} ${item.note} ${item.status}'}\`.toLowerCase();
    if (/resolved|completed|postmortem|closed|fixed/.test(text))
        return false;
    if (/scheduled|maintenance|planned|announcement|informational|deprecation/.test(text) && !/outage|degrad|disruption|error|latency|incident/.test(text))
        return false;
    return item.color !== 'green';
}`,
`export function activeIncident(item, now = Date.now(), maxAgeDays = INCIDENT_MAX_AGE_DAYS) {
    if (!incidentEvidenceIsCurrent(item, now, maxAgeDays))
        return false;
    const text = \`${'${item.title} ${item.note} ${item.status}'}\`.toLowerCase();
    if (/resolved|completed|postmortem|closed|fixed/.test(text))
        return false;
    if (/scheduled|maintenance|planned|announcement|informational|deprecation/.test(text) && !/outage|degrad|disruption|error|latency|incident/.test(text))
        return false;
    return item.color !== 'green';
}`
);

replaceOnce('scripts/structured-source-adapters.mjs',
  "const STATUSPAGE_SUFFIX = '/api/v2/summary.json';\n",
  "import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';\n\nconst STATUSPAGE_SUFFIX = '/api/v2/summary.json';\n"
);
replaceOnce('scripts/structured-source-adapters.mjs',
`  const unresolved = json.incidents.filter(incident => !/^(?:resolved|completed|closed|postmortem|cancelled)$/i.test(String(incident?.status || '')));
  const incidents = [];
`,
`  const unresolved = json.incidents.filter(incident => !/^(?:resolved|completed|closed|postmortem|cancelled)$/i.test(String(incident?.status || '')));
  const incidents = [];
  let staleIncidentCount = 0;
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`    const firstDetected = incident.started_at || incident.created_at || updates.at(-1)?.at || '';
    const latestUpdate = incident.updated_at || latest.at || firstDetected;
    incidents.push({
`,
`    const firstDetected = incident.started_at || incident.created_at || updates.at(-1)?.at || '';
    const latestUpdate = incident.updated_at || latest.at || firstDetected;
    if (!incidentEvidenceIsCurrent({ title, note, status, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) {
      staleIncidentCount += 1;
      continue;
    }
    incidents.push({
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  if (unresolved.length) return { kind: 'healthy', status: \`${'${provider.name || \'Provider\'}'} reports no active US-relevant incidents\`, ...extras };
`,
`  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  if (staleIncidentCount) return { kind: 'limited', message: \`${'${provider.name || \'Provider\'}'} lists ${'${staleIncidentCount}'} unresolved incident record${'${staleIncidentCount === 1 ? \'\' : \'s\'}'} without an official update in the last ${'${INCIDENT_MAX_AGE_DAYS}'} days. The records were not presented as current.\`, ...extras };
  if (unresolved.length) return { kind: 'healthy', status: \`${'${provider.name || \'Provider\'}'} reports no active US-relevant incidents\`, ...extras };
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`  const reports = json.included.filter(item => item?.type === 'status_report');
  const incidents = [];
  const maintenance = [];
`,
`  const reports = json.included.filter(item => item?.type === 'status_report');
  const incidents = [];
  const maintenance = [];
  let staleReportCount = 0;
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`    if (attributes.ends_at || !['degraded', 'downtime'].includes(aggregate)) continue;
    if (isGenericTitle(title) || isPlannedOnly(title, note, reportType)) continue;
    incidents.push({
`,
`    if (attributes.ends_at || !['degraded', 'downtime'].includes(aggregate)) continue;
    if (isGenericTitle(title) || isPlannedOnly(title, note, reportType)) continue;
    const firstDetected = attributes.starts_at || attributes.created_at || '';
    const latestUpdate = latest.published_at || attributes.updated_at || firstDetected;
    if (!incidentEvidenceIsCurrent({ title, note, status: latest.status || aggregate, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) {
      staleReportCount += 1;
      continue;
    }
    incidents.push({
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`      firstDetected: attributes.starts_at || attributes.created_at || '',
      latestUpdate: latest.published_at || attributes.updated_at || attributes.starts_at || '',
`,
`      firstDetected,
      latestUpdate,
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const aggregate = String(json.data.attributes.aggregate_state || '').toLowerCase();
  if (aggregate === 'operational' || aggregate === 'maintenance') {
`,
`  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const aggregate = String(json.data.attributes.aggregate_state || '').toLowerCase();
  if (staleReportCount && !['operational', 'maintenance'].includes(aggregate)) return { kind: 'limited', message: \`${'${provider.name || \'Provider\'}'} has unresolved structured records without a recent official update. They were not presented as current.\`, ...extras };
  if (aggregate === 'operational' || aggregate === 'maintenance') {
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`    if (!isUsRelevant(title, \`${'${note} ${locations.join(\' \')}'}\`, source.regionScope)) {
      foundNonUsIncident = true;
      continue;
    }
    incidents.push({
`,
`    if (!isUsRelevant(title, \`${'${note} ${locations.join(\' \')}'}\`, source.regionScope)) {
      foundNonUsIncident = true;
      continue;
    }
    const firstDetected = dates[0] || '';
    const latestUpdate = dates.at(-1) || dates[0] || '';
    if (!incidentEvidenceIsCurrent({ title, note, status: lifecycle, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;
    incidents.push({
`
);
replaceOnce('scripts/structured-source-adapters.mjs',
`      firstDetected: dates[0] || '',
      latestUpdate: dates.at(-1) || dates[0] || '',
`,
`      firstDetected,
      latestUpdate,
`
);

replaceOnce('scripts/incident-detail-repairs.mjs',
  "import { structuredSourceConclusion, structuredSourceOverrides } from './structured-source-adapters.mjs';\n",
  "import { structuredSourceConclusion, structuredSourceOverrides } from './structured-source-adapters.mjs';\nimport { INCIDENT_MAX_AGE_DAYS, dateLikeIncidentTitle, incidentEvidenceIsCurrent } from './incident-freshness.mjs';\n"
);
replaceOnce('scripts/incident-detail-repairs.mjs',
  'kochi|kuala lumpur)\\b|\\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)',
  'kochi|kuala lumpur|mumbai|hyderabad|delhi)\\b|\\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)'
);
replaceOnce('scripts/incident-detail-repairs.mjs',
`  const normalized = clean(value)
    .replace(/\\s+-\\s+/g, ' ')
    .replace(/\\bUTC\\b/i, ' UTC');
`,
`  const normalized = clean(value)
    .replace(/\\s+,/g, ',')
    .replace(/\\s+-\\s+/g, ' ')
    .replace(/\\bUTC\\b/i, ' UTC');
`
);
replaceOnce('scripts/incident-detail-repairs.mjs',
`const DATE_LINE = /^(?:[A-Z][a-z]{2}\\s+\\d{1,2},\\s+\\d{4}\\s*(?:-|at)?\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*UTC|[A-Z][a-z]{2}\\s+\\d{1,2},\\s*\\d{1,2}:\\d{2}\\s*UTC)$/i;
`,
`const DATE_LINE = /^(?:[A-Z][a-z]{2,8}\\s+\\d{1,2}\\s*,\\s*\\d{4}\\s*(?:-|at)?\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:UTC|EDT|EST)|[A-Z][a-z]{2}\\s+\\d{1,2}\\s*,\\s*\\d{1,2}:\\d{2}\\s*UTC)$/i;
`
);
replaceOnce('scripts/incident-detail-repairs.mjs',
`    && !TITLE_NOISE.test(value)
    && !DATE_LINE.test(value)
    && !STATUS_LINE.test(value)
`,
`    && !TITLE_NOISE.test(value)
    && !DATE_LINE.test(value)
    && !dateLikeIncidentTitle(value)
    && !STATUS_LINE.test(value)
    && value.split(/\\s+/).length <= 18
    && !/^(?:we|our|customers?|users?|some|the team|engineering)\\b/i.test(value)
    && !/[.!?]$/.test(value)
`
);
replaceOnce('scripts/incident-detail-repairs.mjs',
`    for (let cursor = index - 1; cursor >= Math.max(0, index - 14); cursor -= 1) {
`,
`    for (let cursor = index - 1; cursor >= Math.max(0, index - 40); cursor -= 1) {
`
);
replaceOnce('scripts/incident-detail-repairs.mjs',
`    const detail = [statusMatch[2]];
    let time = '';
    for (let cursor = index + 1; cursor < Math.min(current.length, index + 16); cursor += 1) {
`,
`    const detail = [statusMatch[2]];
    let time = '';
    for (let cursor = index - 1; cursor >= Math.max(0, index - 6); cursor -= 1) {
      if (DATE_LINE.test(current[cursor])) { time = isoDate(current[cursor]); break; }
      if (STATUS_LINE.test(current[cursor])) break;
    }
    for (let cursor = index + 1; cursor < Math.min(current.length, index + 16); cursor += 1) {
`
);
replaceOnce('scripts/incident-detail-repairs.mjs',
`    if (!isIncidentUsRelevant(item)) continue;

    const existing = byTitle.get(title.toLowerCase());
`,
`    if (!isIncidentUsRelevant(item)) continue;
    if (!incidentEvidenceIsCurrent(item, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;

    const existing = byTitle.get(title.toLowerCase());
`
);

replaceOnce('scripts/update-public-status.mjs',
  "import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';\n",
  "import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';\nimport { INCIDENT_MAX_AGE_DAYS, dateLikeIncidentTitle, incidentEvidenceIsCurrent } from './incident-freshness.mjs';\n"
);
replaceOnce('scripts/update-public-status.mjs',
`function structuredIncidents(provider, source, conclusion) {
  return (conclusion.incidents || []).slice(0, 12).map(item => makeIncident(provider, source, item));
}
`,
`function structuredIncidents(provider, source, conclusion) {
  return (conclusion.incidents || [])
    .filter(item => incidentEvidenceIsCurrent(item, Date.now(), INCIDENT_MAX_AGE_DAYS))
    .slice(0, 12)
    .map(item => makeIncident(provider, source, item));
}
`
);
replaceOnce('scripts/update-public-status.mjs',
`  if (conclusion.kind === 'issues') {
    const incidents = structuredIncidents(provider, source, conclusion);
    if (incidents.length) {
      const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return providerStatus(provider, source, \`${'${incidents.length}'} active US public incident${'${incidents.length === 1 ? \'\' : \'s\'}'}\`, worst, true, '', logs, incidents, maintenance, undefined, extras);
    }
  }
`,
`  if (conclusion.kind === 'issues') {
    const incidents = structuredIncidents(provider, source, conclusion);
    if (incidents.length) {
      const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return providerStatus(provider, source, \`${'${incidents.length}'} active US public incident${'${incidents.length === 1 ? \'\' : \'s\'}'}\`, worst, true, '', logs, incidents, maintenance, undefined, extras);
    }
    return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page exposed unresolved incident records without current, timestamped evidence. They were not published as active.', logs, [], maintenance, 'limited', extras);
  }
`
);
replaceOnce('scripts/update-public-status.mjs',
`  if (conclusion.kind === 'issue') {
    if (isGenericIncidentTitle(conclusion.title)) return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page reported an issue state without a specific incident title or details, so no incident was published.', logs, [], maintenance, 'limited', extras);
    const incident = makeIncident(provider, source, conclusion);
`,
`  if (conclusion.kind === 'issue') {
    if (isGenericIncidentTitle(conclusion.title)) return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page reported an issue state without a specific incident title or details, so no incident was published.', logs, [], maintenance, 'limited', extras);
    if (!incidentEvidenceIsCurrent(conclusion, Date.now(), INCIDENT_MAX_AGE_DAYS)) return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page reported an unresolved issue without recent official evidence, so it was not published as active.', logs, [], maintenance, 'limited', extras);
    const incident = makeIncident(provider, source, conclusion);
`
);
replaceOnce('scripts/update-public-status.mjs',
`  const changes = [...compareSnapshots(previous, base, generatedAt), ...sourceIntelligenceChanges(previous, base, generatedAt)]
    .filter((change, index, all) => all.findIndex(candidate => candidate.id === change.id) === index);
  const payload = { ...base, changes, history: [...changes, ...(previous?.history || [])].slice(0, 200) };
`,
`  const changes = [...compareSnapshots(previous, base, generatedAt), ...sourceIntelligenceChanges(previous, base, generatedAt)]
    .filter(change => !dateLikeIncidentTitle(change.title))
    .filter((change, index, all) => all.findIndex(candidate => candidate.id === change.id) === index);
  const retainedHistory = (previous?.history || []).filter(change => !dateLikeIncidentTitle(change.title));
  const payload = { ...base, changes, history: [...changes, ...retainedHistory].slice(0, 200) };
`
);

replaceOnce('src/main.tsx',
  "import './styles/ultra-hd.css';\n",
  "import './styles/ultra-hd.css';\nimport './styles/mobile-ops.css';\n"
);

write('src/styles/mobile-ops.css', `/* Purpose-built phone and small-tablet operating experience. */
@media (max-width: 900px) {
  :root {
    --mobile-nav-height: 70px;
    font-size: 15px;
  }

  html, body { background: #050912; }
  body {
    background: #050912;
    overscroll-behavior-y: none;
  }
  body::before, .enterprise-shell::after { display: none; }

  .enterprise-shell { display: block; min-height: 100dvh; background: #050912; }
  .app-workspace { min-height: 100dvh; padding-bottom: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom)); }

  .app-sidebar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 100;
    width: 100%;
    height: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom));
    display: block;
    border: 0;
    border-top: 1px solid rgba(139, 171, 214, .2);
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(6, 11, 19, .96);
    box-shadow: 0 -16px 44px rgba(0, 0, 0, .38);
    backdrop-filter: blur(18px) saturate(130%);
    overflow: visible;
  }
  .sidebar-brand, .sidebar-workspace, .app-sidebar footer, .nav-section-label { display: none !important; }
  .app-sidebar nav {
    height: var(--mobile-nav-height);
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0;
    border: 0;
    padding: 6px 4px 5px;
    overflow: visible;
  }
  .app-sidebar nav button {
    position: relative;
    min-width: 0;
    min-height: 58px;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 24px 18px;
    place-items: center;
    gap: 0;
    border: 0;
    border-radius: 12px;
    padding: 5px 2px;
    color: #8190a5;
    background: transparent;
    font-size: .68rem;
    line-height: 1;
    text-align: center;
    transform: none !important;
  }
  .app-sidebar nav button[aria-current='page'] {
    color: #eaf4ff;
    background: rgba(70, 132, 255, .15);
    box-shadow: inset 0 0 0 1px rgba(105, 164, 255, .2);
  }
  .app-sidebar nav button > span:nth-child(2) { display: none; }
  .app-sidebar nav button::after { font-size: .67rem; font-weight: 720; letter-spacing: -.01em; }
  .app-sidebar nav button:nth-of-type(1)::after { content: 'Home'; }
  .app-sidebar nav button:nth-of-type(2)::after { content: 'Incidents'; }
  .app-sidebar nav button:nth-of-type(3)::after { content: 'Providers'; }
  .app-sidebar nav button:nth-of-type(4)::after { content: 'Sources'; }
  .app-sidebar nav button:nth-of-type(5)::after { content: 'Timeline'; }
  .nav-glyph { color: currentColor; font-size: 1rem; line-height: 1; }
  .app-sidebar nav button em {
    position: absolute;
    top: 2px;
    right: 8px;
    min-width: 18px;
    padding: 2px 4px;
    font-size: .55rem;
    line-height: 1;
  }

  .workspace-topbar {
    position: sticky;
    top: 0;
    z-index: 60;
    min-height: 62px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    border-bottom-color: rgba(139, 171, 214, .16);
    padding: 9px 12px;
    background: rgba(5, 10, 18, .95);
    box-shadow: 0 10px 28px rgba(0,0,0,.25);
    backdrop-filter: blur(16px);
  }
  .topbar-title > span, .topbar-title p { display: none; }
  .topbar-title h1 { margin: 0; font-size: 1.16rem; line-height: 1.2; }
  .topbar-title::after {
    display: block;
    margin-top: 2px;
    color: #8495ab;
    content: 'Live MSP service intelligence';
    font-size: .66rem;
  }
  .topbar-live { display: none !important; }
  .topbar-actions { width: auto; display: block; }
  .topbar-actions .ui-button:first-child { display: none; }
  .topbar-actions .ui-button-primary {
    min-width: 92px;
    min-height: 40px;
    border-radius: 11px;
    padding: 0 13px;
    font-size: .72rem;
  }

  .lifecycle-strip {
    min-height: 34px;
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 7px;
    padding: 7px 12px;
    font-size: .68rem;
  }
  .lifecycle-strip > span:not(.connection-indicator), .lifecycle-spacer { display: none; }
  .lifecycle-strip small { justify-self: end; font-size: .62rem; }

  .workspace-main { width: 100%; min-height: 0; padding: 12px; }
  .workspace-stack { gap: 12px; }

  .posture-panel, .page-summary {
    min-height: 0;
    align-items: flex-start;
    gap: 12px;
    border-radius: 16px;
    padding: 16px;
    box-shadow: none;
  }
  .posture-panel { border-left-width: 1px; }
  .posture-panel h2, .page-summary h2 { margin-bottom: 5px; font-size: 1.25rem; line-height: 1.15; }
  .posture-panel p { margin: 0; font-size: .72rem; line-height: 1.45; }
  .posture-actions { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 8px; }
  .posture-actions .ui-button { width: auto; min-height: 42px; padding: 0 12px; font-size: .7rem; }
  .posture-actions .ui-button-secondary { min-width: 106px; }
  .summary-stat, .quality-score { min-width: 0; text-align: left; }
  .summary-stat strong, .quality-score strong { font-size: 1.65rem; }

  .metric-strip, .metric-strip-six {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px;
    border: 0;
    background: transparent;
    overflow: visible;
  }
  .metric-tile, .metric-strip-six .metric-tile {
    min-height: 96px;
    border: 1px solid rgba(139, 171, 214, .15) !important;
    border-radius: 14px;
    padding: 12px;
    box-shadow: none;
  }
  .metric-tile header span { font-size: .58rem; }
  .metric-tile strong { font-size: 1.48rem; }
  .metric-tile small { font-size: .61rem; line-height: 1.25; }

  .workspace-panel, .filter-bar { border-radius: 16px; box-shadow: none; }
  .section-header { min-height: 0; align-items: flex-start; padding: 13px 14px; }
  .section-header h2 { font-size: 1rem; }
  .section-header p { font-size: .67rem; line-height: 1.35; }
  .section-actions { width: auto; }
  .link-button { font-size: .65rem; }

  .filter-bar { position: sticky; top: 62px; z-index: 20; gap: 8px; padding: 10px; background: rgba(10, 17, 28, .97); }
  .filter-bar input, .filter-bar select { height: 42px; }

  .table-panel { overflow: visible; }
  .data-table { min-width: 0; display: grid; gap: 9px; padding: 9px; }
  .data-table-head { display: none; }
  .data-table-body { display: grid; gap: 9px; }
  .data-table-row {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(98px, auto);
    gap: 0;
    border: 1px solid rgba(139, 171, 214, .15);
    border-radius: 14px;
    padding: 11px;
    background: rgba(12, 20, 33, .8);
    box-shadow: none !important;
  }
  .data-table-row > span {
    display: grid;
    align-content: center;
    gap: 3px;
    border: 0;
    padding: 6px 4px;
  }
  .data-table-row > span:nth-child(1) { grid-column: 1 / -1; border-bottom: 1px solid rgba(139,171,214,.11); padding: 0 0 9px; }
  .data-table-row > span:nth-child(2), .data-table-row > span:nth-child(3) { padding-top: 9px; }
  .data-table-row > span:nth-child(4), .data-table-row > span:nth-child(5), .data-table-row > span:nth-child(6), .data-table-row > span:nth-child(7) { grid-template-columns: auto 1fr; align-items: baseline; gap: 6px; }
  .data-table-row > span:nth-child(6) { display: none; }
  .data-table-row strong { font-size: .78rem; }
  .data-table-row small { font-size: .61rem; }
  .provider-logo, .provider-identity.is-compact .provider-logo { width: 36px; height: 36px; border-radius: 10px; }
  .provider-identity b { font-size: .83rem; }
  .provider-identity small { font-size: .63rem; }
  .status-chip { min-height: 21px; font-size: .58rem; }

  .attention-table, .category-table { min-width: 0; }
  .attention-head, .category-head { display: none; }
  .attention-row {
    min-height: 0;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    gap: 9px;
    padding: 12px;
  }
  .attention-row > div { grid-column: 2 / -1; padding: 0; }
  .attention-row time { grid-column: 2; }
  .attention-row > p { grid-column: 1 / -1; margin: 0; padding-top: 5px; }
  .attention-row > a { grid-column: 3; grid-row: 2; }
  .priority-index { width: 34px; }
  .attention-row h3 { font-size: .82rem; line-height: 1.3; }

  .category-table { display: grid; gap: 8px; padding: 9px; }
  .category-row {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) repeat(4, auto);
    gap: 8px;
    border: 1px solid rgba(139,171,214,.14);
    border-radius: 13px;
    padding: 11px;
  }
  .category-row > span:nth-child(2) { grid-column: 1 / -1; grid-row: 2; }

  .incident-list, .maintenance-list, .maintenance-grid { display: grid; grid-template-columns: 1fr; }
  .incident-record, .maintenance-record { padding: 14px; }
  .incident-record header, .maintenance-record header { align-items: flex-start; flex-direction: column; }
  .incident-record header > div { justify-content: flex-start; flex-wrap: wrap; }
  .incident-title { margin-top: 10px; }
  .incident-title h3 { font-size: 1rem; line-height: 1.28; }
  .incident-title p, .maintenance-record > p { font-size: .72rem; line-height: 1.5; }
  .record-facts { grid-template-columns: 1fr 1fr; }
  .record-facts > div { min-height: 58px; padding: 8px 9px; }
  .record-facts dt { font-size: .56rem; }
  .record-facts dd { font-size: .67rem; }
  .incident-guidance { grid-template-columns: 1fr; }

  .timeline-head { display: none; }
  .timeline-row { min-height: 0; grid-template-columns: 110px minmax(0, 1fr); gap: 8px; padding: 11px; }
  .timeline-row > span:nth-child(3) { grid-column: 1 / -1; }
  .timeline-row > span:nth-child(4) { grid-column: 2; }

  .drawer-layer { align-items: stretch; }
  .provider-drawer { width: 100vw; max-width: none; height: 100dvh; border-left: 0; }
  .drawer-header { min-height: 66px; padding: 11px 13px; }
  .drawer-summary { grid-template-columns: 1fr 1fr; }
  .drawer-summary > div { min-height: 68px; }
  .drawer-content { padding: 12px; }
  .drawer-facts { grid-template-columns: 1fr; }
  .drawer-facts > div { border-right: 0 !important; }
  .drawer-footer { padding-bottom: calc(12px + env(safe-area-inset-bottom)); }

  .workspace-footer { display: none; }
  .wallboard-shell { display: none; }
}

@media (max-width: 370px) {
  :root { font-size: 14px; }
  .workspace-main { padding: 9px; }
  .metric-tile { min-height: 90px; padding: 10px; }
  .posture-panel, .page-summary { padding: 14px; }
  .posture-actions { grid-template-columns: 1fr; }
  .posture-actions .ui-button-secondary { display: none; }
  .app-sidebar nav button em { display: none; }
}
`);

write('scripts/__tests__/incident-freshness.test.js', `import test from 'node:test';
import assert from 'node:assert/strict';
import { activeIncident } from '../update-status.mjs';
import { dateLikeIncidentTitle, incidentEvidenceIsCurrent } from '../incident-freshness.mjs';
import { providerIncidentConclusion } from '../incident-detail-repairs.mjs';

const now = Date.parse('2026-08-02T06:00:00Z');

test('date-only incident headings are never current incidents', () => {
  assert.equal(dateLikeIncidentTitle('Mar 03 , 2026 - 19:55 UTC'), true);
  assert.equal(activeIncident({ title: 'Mar 03 , 2026 - 19:55 UTC', note: 'Investigating', status: 'update', color: 'amber' }, now), false);
});

test('structured incidents require a recent official update', () => {
  assert.equal(incidentEvidenceIsCurrent({ title: 'Old incident', latest_update: '2026-03-03T19:55:00Z' }, now, 45, { requireTimestamp: true }), false);
  assert.equal(incidentEvidenceIsCurrent({ title: 'Long-running mitigation', first_detected: '2025-12-03T15:15:27Z', latest_update: '2026-07-03T13:55:20Z' }, now, 45, { requireTimestamp: true }), true);
});

test('Cisco update dates cannot become incident titles or bypass US scope', () => {
  const html = `<main>
    <h2>Active Incidents</h2>
    <h3>Secure Access service availability issue in Dubai</h3>
    <p>Identified - We are working with cloud partners and recommend alternate regions in Mumbai or Hyderabad.</p>
    <p>Apr 27 , 2026 - 17:47 UTC</p>
    <p>Update - We are continuing to investigate this issue.</p>
    <p>Mar 03 , 2026 - 19:55 UTC</p>
    <p>Investigating - Some users in Dubai may experience timeouts.</p>
    <p>Mar 02 , 2026 - 06:18 UTC</p>
  </main>`;
  const result = providerIncidentConclusion({ id: 'cisco-umbrella', name: 'Cisco Umbrella' }, html);
  assert.notEqual(result?.kind, 'issues');
});
`);

console.log('Applied stale incident and mobile UX repair patch.');
