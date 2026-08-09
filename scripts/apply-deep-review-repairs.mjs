import fs from 'node:fs';

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No change applied to ${path}`);
  fs.writeFileSync(path, after);
}

function replaceOne(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing ${label}`);
  return source.replace(before, after);
}

update('scripts/source-intelligence.mjs', source => {
  source = replaceOne(source,
`function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}
`,
`function clean(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

export function componentStatusIsProblem(value) {
  const status = clean(value).toLowerCase().replace(/\\s+/g, '_');
  if (!status) return false;
  if (/^(?:operational|available|up|ok|none|good|normal|healthy|not_available|n\\/?a|not_applicable|unknown|under_maintenance|maintenance|scheduled_maintenance|planned_maintenance)$/.test(status)) return false;
  return /(?:degrad|partial[_-]?outage|major[_-]?outage|outage|unavailable|down|offline|disrupt|impaired|warning|error|failure)/.test(status);
}
`, 'component status helper insertion');
  source = replaceOne(source,
`    component_issue_count: components.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component.status || ''))).length
`,
`    component_issue_count: components.filter(component => componentStatusIsProblem(component.status)).length
`, 'component issue summary');
  return source;
});

update('scripts/collection-intelligence.mjs', source => {
  source = `import { componentStatusIsProblem } from './source-intelligence.mjs';\n\n${source}`;
  source = source.replace("const operationalComponent = /^(?:operational|available|up|ok|none|good)$/i;\n", '');
  source = replaceOne(source,
`  const problemComponents = (provider.component_status || []).filter(component => !operationalComponent.test(String(component.status || ''))).length;
`,
`  const problemComponents = (provider.component_status || []).filter(component => componentStatusIsProblem(component.status)).length;
`, 'collection component issue count');
  return source;
});

update('scripts/structured-source-adapters.mjs', source => {
  source = replaceOne(source,
`import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
`,
`import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
import { isNonServiceAdvisory } from './incident-classification.mjs';
import { regionScopeRelevant } from './region-scope.mjs';
import { componentStatusIsProblem } from './source-intelligence.mjs';
`, 'structured imports');

  source = source.replace(/const globalRegionPattern = [\s\S]*?function isUsRelevant\(title, note = '', scope = ''\) \{[\s\S]*?\n\}\n\nfunction isGenericTitle/, `function isUsRelevant(title, note = '', scope = '') {
  return regionScopeRelevant(title, note, scope);
}

function isGenericTitle`);

  source = replaceOne(source,
`function componentRecords(values) {
  const records = [];
  const seen = new Set();
  for (const component of Array.isArray(values) ? values : []) {
    const name = clean(component?.name || component?.display_name || component?.public_name || component?.id);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    records.push({
      name,
      status: clean(component?.status || component?.state || 'unknown').toLowerCase().replace(/\\s+/g, '_'),
      group: clean(component?.group_name || component?.group || component?.group_id || '')
    });
    if (records.length >= 36) break;
  }
  return records;
}
`,
`function componentRecords(values, limit = 512) {
  const records = [];
  const seen = new Set();
  for (const component of Array.isArray(values) ? values : []) {
    const name = clean(component?.name || component?.display_name || component?.public_name || component?.id);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    records.push({
      name,
      status: clean(component?.status || component?.state || 'unknown').toLowerCase().replace(/\\s+/g, '_'),
      group: clean(component?.group_name || component?.group || component?.group_id || '')
    });
    if (records.length >= limit) break;
  }
  return records;
}
`, 'component records bound');

  source = source.replace(/\.filter\(component => isUsRelevant\(component\.name, component\.group \|\| '', source\.regionScope\)\);/g,
`.filter(component => isUsRelevant(component.name, component.group || '', source.regionScope))
    .slice(0, 36);`);

  source = source.replace(/if \(!title \|\| isGenericTitle\(title\) \|\| isEditorial\(title, note\) \|\| isPlannedOnly\(title, note, status\)\) continue;/g,
`if (!title || isGenericTitle(title) || isEditorial(title, note) || isNonServiceAdvisory(title, note, status) || isPlannedOnly(title, note, status)) continue;`);
  source = source.replace(/if \(!title \|\| isEditorial\(title, note\) \|\| !isUsRelevant\(title, `\$\{note\} \$\{affectedService\}`, source\.regionScope\)\) continue;/g,
`if (!title || isEditorial(title, note) || isNonServiceAdvisory(title, note, attributes.aggregate_state || attributes.status || '') || !isUsRelevant(title, \`${note} ${affectedService}\`, source.regionScope)) continue;`);
  source = source.replace(/if \(isEditorial\(title, note\) \|\| isPlannedOnly\(title, note, lifecycle\)\) continue;/g,
`if (isEditorial(title, note) || isNonServiceAdvisory(title, note, lifecycle) || isPlannedOnly(title, note, lifecycle)) continue;`);

  source = replaceOne(source,
`  const problemComponents = components.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component.status || '')));
`,
`  const problemComponents = components.filter(component => componentStatusIsProblem(component.status));
`, 'statuspage problem components');

  source = replaceOne(source,
`function vultrWindow(value, label) {
`,
`function dedupeIncidentPresentation(items) {
  const byPresentation = new Map();
  for (const item of items) {
    const key = [clean(item.title), clean(item.note), clean(item.affectedService), clean(item.status)].join('|').toLowerCase();
    const existing = byPresentation.get(key);
    if (!existing) {
      byPresentation.set(key, item);
      continue;
    }
    const existingTime = Date.parse(existing.latestUpdate || '') || 0;
    const itemTime = Date.parse(item.latestUpdate || '') || 0;
    const newer = itemTime >= existingTime ? item : existing;
    const older = newer === item ? existing : item;
    byPresentation.set(key, {
      ...newer,
      firstDetected: [existing.firstDetected, item.firstDetected].filter(Boolean).sort()[0] || newer.firstDetected,
      updates: boundedUpdates([...(existing.updates || []), ...(item.updates || [])]),
      collapsedRecordCount: Number(existing.collapsedRecordCount || 1) + Number(item.collapsedRecordCount || 1)
    });
  }
  return [...byPresentation.values()];
}

function vultrWindow(value, label) {
`, 'Vultr dedupe helper');
  source = replaceOne(source,
`  const extras = { maintenance, components: [] };
  if (incidents.length) return { kind: 'issues', incidents: incidents.slice(0, 12), ...extras };
`,
`  const dedupedIncidents = dedupeIncidentPresentation(incidents);
  const extras = { maintenance, components: [] };
  if (dedupedIncidents.length) return { kind: 'issues', incidents: dedupedIncidents.slice(0, 12), ...extras };
`, 'Vultr dedupe return');
  return source;
});

update('scripts/incident-freshness.mjs', source => {
  source = `import { regionScopeRelevant } from './region-scope.mjs';\n\n${source}`;
  source = source.replace(/const globalRegionPattern = [\s\S]*?const nonUsRegionPattern = .*?;\n\n/, '');
  source = source.replace(/export function incidentRegionIsCurrentScope\(item\) \{[\s\S]*?\n\}\n\nexport function incidentTimestampMs/, `export function incidentRegionIsCurrentScope(item) {
  const title = clean(item?.title || '');
  const details = clean([
    item?.affected_service,
    item?.affectedService,
    item?.region,
    item?.regions,
    item?.location,
    item?.locations,
    item?.components,
    item?.note,
    item?.status
  ].filter(Boolean).join(' ')).slice(0, 3000);
  return regionScopeRelevant(title, details, 'us');
}

export function incidentTimestampMs`);
  return source;
});

update('scripts/incident-detail-repairs.mjs', source => {
  source = replaceOne(source,
`import { structuredSourceConclusion, structuredSourceOverrides } from './structured-source-adapters.mjs';
import { INCIDENT_MAX_AGE_DAYS, dateLikeIncidentTitle, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
`,
`import { structuredSourceConclusion, structuredSourceOverrides } from './structured-source-adapters.mjs';
import { INCIDENT_MAX_AGE_DAYS, dateLikeIncidentTitle, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
import { isNonServiceAdvisory } from './incident-classification.mjs';
import { hasExplicitNonUsScope, hasExplicitUsScope, regionScopeRelevant } from './region-scope.mjs';
`, 'incident detail imports');
  source = source.replace(/const globalRegionPattern = [\s\S]*?export function isIncidentUsRelevant\(item\) \{[\s\S]*?\n\}\n\nexport function isGenericIncidentTitle/, `export function isIncidentUsRelevant(item) {
  return regionScopeRelevant(clean(item?.title || ''), clean(item?.note || ''), 'us');
}

export function isGenericIncidentTitle`);
  source = source.replace(
`    if (plannedOnly(combined) || isEditorialIncidentEntry({ title, note })) continue;
`,
`    if (plannedOnly(combined) || isEditorialIncidentEntry({ title, note }) || isNonServiceAdvisory(title, note, status)) continue;
`);
  source = replaceOne(source,
`    const note = [summary, latestNote && \`Latest update: \${latestNote}\`].filter(Boolean).join(' ').slice(0, 900);
    records.push({
`,
`    const note = [summary, latestNote && \`Latest update: \${latestNote}\`].filter(Boolean).join(' ').slice(0, 900);
    if (isNonServiceAdvisory(summary || serviceTitle, note, status)) continue;
    records.push({
`, 'N-able advisory filter');
  source = source.replace(/  const currentHasOnlyNonUs = currentStatusPageIncidents\([\s\S]*?\n  \)\.length === 0 && nonUsRegionPattern\.test\(text\);/, `  const currentHasOnlyNonUs = hasExplicitNonUsScope(text) && !hasExplicitUsScope(text);`);
  return source;
});

update('scripts/entra-status-adapter.mjs', source => {
  source = replaceOne(source,
`  const components = parsed.relevant.map(item => ({
    name: normalizeHeader(item.region) || item.region,
    status: item.status
  }));
  const applicable = components.filter(item => !ignoredStatus(item.status));
`,
`  const components = parsed.relevant.map(item => ({
    name: normalizeHeader(item.region) || item.region,
    status: item.status
  })).filter(item => !ignoredStatus(item.status));
  const applicable = components;
`, 'Entra applicable component filtering');
  return source;
});

update('scripts/update-public-status.mjs', source => {
  source = replaceOne(source,
`  enrichProviderHistory,
  maintenanceIsRelevant,
`,
`  componentStatusIsProblem,
  enrichProviderHistory,
  maintenanceIsRelevant,
`, 'public status component helper import');
  source = replaceOne(source,
`async function tryFeedCandidates(provider, source, html, pageLogs) {
  const candidates = [...discoverFeedUrls(html, source.url), ...(source.feedCandidates || [])];
`,
`export async function tryFeedCandidates(provider, source, html, pageLogs) {
  if (source.discoverFeeds === false) return null;
  const candidates = [...discoverFeedUrls(html, source.url), ...(source.feedCandidates || [])];
`, 'feed discovery guard');

  source = source.replace(/export function reconcileProviderIncidentEvidence\(result, now = Date\.now\(\)\) \{[\s\S]*?\n\}\n\nexport async function generatePublicStatus/, `export function reconcileProviderIncidentEvidence(result, now = Date.now()) {
  const incidents = (result?.incidents || []).filter(item => activeIncident(item, now));
  const problemComponents = (result?.component_status || []).filter(component => componentStatusIsProblem(component?.status));
  const affected = ['major', 'degraded'].includes(result?.service_state);

  if (!affected) return { ...result, incidents };

  if (incidents.length) {
    const incidentColor = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
    const componentIsMajor = problemComponents.some(component => /\\b(?:major|critical|complete[_ -]?outage|down|offline|unavailable)\\b/i.test(String(component?.status || '')));
    const color = componentIsMajor ? 'red' : incidentColor;
    const scope = /US public incident/i.test(String(result.status || '')) ? 'US public' : 'current public';
    return {
      ...result,
      incidents,
      status: \`${incidents.length} active ${scope} incident${incidents.length === 1 ? '' : 's'}\`,
      color,
      service_state: color === 'red' ? 'major' : 'degraded',
      attention: color === 'red' ? 'critical' : 'action'
    };
  }

  if (problemComponents.length) {
    const major = problemComponents.some(component => /\\b(?:major|critical|complete[_ -]?outage|down|offline|unavailable)\\b/i.test(String(component?.status || '')));
    const names = problemComponents.map(component => component.name).filter(Boolean).slice(0, 8).join(', ');
    return {
      ...result,
      incidents: [],
      status: \`${problemComponents.length} current degraded component${problemComponents.length === 1 ? '' : 's'}\`,
      color: major ? 'red' : 'amber',
      service_state: major ? 'major' : 'degraded',
      attention: major ? 'critical' : 'action',
      message: result.message || (names ? \`Current structured component state: ${names}\` : 'The official source reports current component degradation.')
    };
  }

  return {
    ...result,
    incidents: [],
    status: 'Current incident evidence unavailable',
    color: 'blue',
    service_state: 'unknown',
    source_state: result.source_state === 'available' ? 'limited' : result.source_state,
    attention: 'watch',
    ok: false,
    message: 'The official source exposed an issue state without current timestamped incident evidence. It was not presented as an active provider incident.'
  };
}

export async function generatePublicStatus`);
  return source;
});

update('scripts/update-status.mjs', source => {
  source = replaceOne(source,
`    return { service_overall, source_overall, active_incident_count: incidents.length, affected_provider_count: new Set(incidents.map(x => x.providerId)).size, confirmed_operational_count, degraded_count, major_count, unknown_count, limited_count, unavailable_count, disabled_count, pending_count, stale_count, provider_total: providers.length, enabled_provider_count: enabled.length, coverage_percent: enabled.length ? Math.round(available / enabled.length * 100) : 0, confirmed_operational_percent: enabled.length ? Math.round(confirmed_operational_count / enabled.length * 100) : 0 };
`,
`    return { service_overall, source_overall, active_incident_count: incidents.length, affected_provider_count: degraded_count + major_count, confirmed_operational_count, degraded_count, major_count, unknown_count, limited_count, unavailable_count, disabled_count, pending_count, stale_count, provider_total: providers.length, enabled_provider_count: enabled.length, coverage_percent: enabled.length ? Math.round(available / enabled.length * 100) : 0, confirmed_operational_percent: enabled.length ? Math.round(confirmed_operational_count / enabled.length * 100) : 0 };
`, 'affected provider reconciliation');
  return source;
});

update('scripts/full-review-source-adapters.mjs', source => {
  source = source.replace(/export function parsePayPalProductionStatus\(value\) \{[\s\S]*?\n\}\n\nexport function fullReviewConclusion/, `export function parsePayPalProductionStatus(value) {
  const text = clean(value);
  if (!/\\bPayPal Status Page\\b/i.test(text) || !/\\bProduction Sandbox Services\\b/i.test(text)) return null;

  const subscribeAnchor = text.search(/\\bProduction Sandbox\\s+Subscribe\\b/i);
  const servicesAnchor = text.search(/\\bProduction Sandbox Services\\b/i);
  const start = subscribeAnchor >= 0 ? subscribeAnchor : servicesAnchor;
  const end = text.search(/\\bView history\\b/i);
  const currentSection = start >= 0 ? text.slice(start, end > start ? end : start + 12000) : text.slice(0, 12000);
  const legend = currentSection.search(/\\bOperational\\s+Major Outage\\s+Degraded Performance\\s+Maintenance\\s+Bulletin\\b/i);
  const statusSection = legend > 0 ? currentSection.slice(0, legend) : currentSection;

  if (/\\bAll Production Systems Operational\\b/i.test(statusSection)) {
    return {
      kind: 'healthy',
      status: 'All Production Systems Operational',
      components: [{ name: 'PayPal Production', status: 'Operational' }],
      maintenance: []
    };
  }

  const explicit = /\\b(?:Production Systems? (?:Degraded|Unavailable)|Service (?:Outage|Disruption)|Major Outage|Degraded Performance|Partial Outage)\\b/i.exec(statusSection);
  if (explicit) {
    return {
      kind: 'component-state',
      status: 'PayPal production status reports current service impact',
      color: /major outage|unavailable|service outage/i.test(explicit[0]) ? 'red' : 'amber',
      message: clean(statusSection.slice(Math.max(0, explicit.index - 500), Math.min(statusSection.length, explicit.index + 1600))),
      components: [{ name: 'PayPal Production', status: explicit[0] }],
      maintenance: []
    };
  }

  return {
    kind: 'limited',
    message: 'The PayPal production status page rendered, but did not expose an explicit current operational or service-impact state.'
  };
}

export function fullReviewConclusion`);
  return source;
});

update('scripts/__tests__/final-public-health-conclusions.test.js', source => {
  source = source.replaceAll('2026-08-07T23:30:00Z', '2026-08-02T11:30:00Z')
    .replaceAll('2026-08-08T00:20:00Z', '2026-08-02T12:20:00Z');
  return source;
});

const regressionTest = `import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { componentStatusIsProblem, sourceIntelligenceSummary } from '../source-intelligence.mjs';
import { parseStatuspageSummary, parseVultrStatus } from '../structured-source-adapters.mjs';
import { parseAzureEntraStatus } from '../entra-status-adapter.mjs';
import { parseNableIncidentRecords } from '../incident-detail-repairs.mjs';
import { parsePayPalProductionStatus } from '../full-review-source-adapters.mjs';
import { reconcileProviderIncidentEvidence, tryFeedCandidates } from '../update-public-status.mjs';
import { summarizeProviders } from '../update-status.mjs';
import { regionScopeRelevant } from '../region-scope.mjs';

function statuspage(data) {
  return JSON.stringify({ page: { url: 'https://status.example/' }, incidents: [], scheduled_maintenances: [], ...data });
}

test('US scope excludes explicit foreign POPs and cloud regions while retaining US and global components', () => {
  assert.equal(regionScopeRelevant('Arica, Chile - (ARI)', '', 'us'), false);
  assert.equal(regionScopeRelevant('Baghdad, Iraq - (BGW)', '', 'us'), false);
  assert.equal(regionScopeRelevant('AWS EC2 Health: me-south-1', '', 'us'), false);
  assert.equal(regionScopeRelevant('GCP northamerica-northeast1', '', 'us'), false);
  assert.equal(regionScopeRelevant('Azure azure-westeurope', '', 'us'), false);
  assert.equal(regionScopeRelevant('Ashburn, VA, United States - (IAD)', '', 'us'), true);
  assert.equal(regionScopeRelevant('AWS EC2 Health: us-east-1', '', 'us'), true);
  assert.equal(regionScopeRelevant('Elasticsearch connectivity: Azure azure-westus2', '', 'us'), true);
  assert.equal(regionScopeRelevant('Global services', '', 'us'), true);
});

test('Statuspage component slicing happens after region filtering and excludes foreign degradation', () => {
  const foreign = Array.from({ length: 50 }, (_, index) => ({ name: \`City ${index}, Chile - (C${String(index).padStart(2, '0')})\`, status: index === 4 ? 'major_outage' : 'operational' }));
  const result = parseStatuspageSummary(statuspage({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      ...foreign,
      { name: 'Ashburn, VA, United States - (IAD)', status: 'operational' },
      { name: 'Atlanta, GA, United States - (ATL)', status: 'degraded_performance' }
    ]
  }), { id: 'cloudflare', name: 'Cloudflare' }, { regionScope: 'us', url: 'https://status.example/api/v2/summary.json' });
  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.deepEqual(result.components.map(item => item.name), ['Ashburn, VA, United States - (IAD)', 'Atlanta, GA, United States - (ATL)']);
});

test('non-service product advisories cannot become outages even when the historical impact field is major', () => {
  const result = parseStatuspageSummary(statuspage({
    status: { indicator: 'minor', description: 'Partially Degraded Service' },
    components: [
      { name: 'Elasticsearch connectivity: Azure azure-westus2', status: 'degraded_performance' },
      { name: 'AWS EC2 Health: me-south-1', status: 'major_outage' }
    ],
    incidents: [{
      id: 'advisory-1',
      name: 'Elasticsearch 9.5.0 contains a query-correctness defect',
      status: 'identified',
      impact: 'major',
      created_at: '2026-08-02T10:00:00Z',
      updated_at: '2026-08-02T12:00:00Z',
      incident_updates: [{ status: 'identified', created_at: '2026-08-02T12:00:00Z', body: 'A patch release is in progress. There is no impact to cluster availability, connectivity, or data ingestion. Defer upgrading until the patch is available.' }]
    }]
  }), { id: 'elastic-cloud', name: 'Elastic Cloud' }, { regionScope: 'us', url: 'https://status.example/api/v2/summary.json' });
  assert.equal(result.kind, 'component-state');
  assert.equal(result.color, 'amber');
  assert.equal(result.components.some(item => /me-south-1/i.test(item.name)), false);
});

test('N-able security hotfix advisories without current customer service impact are suppressed', () => {
  const records = parseNableIncidentRecords(\`
    <main>Active Incidents
    Active Incident ID: 12345 Start: Aug 02, 2026 10:00:00 UTC End:
    Severity: Minor Status: Monitoring
    URGENT: N-CENTRAL SECOND HOTFIX - IMMEDIATE ACTION REQUIRED As our investigation into the recent N-central security vulnerability continues, we are proactively expanding protections in response to monitoring of threat actors.
    Services Impacted N-central
    Timeline Monitoring Aug 02, 2026 12:00:00 UTC A second security hotfix is available and should be installed immediately.
    Resolved Incidents</main>
  \`);
  assert.equal(records.length, 0);
});

test('security-related records remain incidents when they contain explicit current service impact', () => {
  const records = parseNableIncidentRecords(\`
    <main>Active Incidents
    Active Incident ID: 12346 Start: Aug 02, 2026 10:00:00 UTC End:
    Severity: Minor Status: Investigating
    N-central authentication issue. Customers are currently experiencing login failures while we investigate a security-related change.
    Services Impacted N-central
    Timeline Investigating Aug 02, 2026 12:00:00 UTC Customers are currently experiencing login failures.
    Resolved Incidents</main>
  \`);
  assert.equal(records.length, 1);
});

test('Entra omits not-applicable regional cells from component issue telemetry', () => {
  const html = \`<table data-zone-name="americas"><thead><tr><th>Products and services</th><th>*Non-Regional</th><th>East US</th><th>West US</th></tr></thead><tbody><tr><td>Microsoft Entra ID (formerly Azure AD)</td><td><span data-label="Good"></span></td><td><span data-label="Not available"></span></td><td><span data-label="Not available"></span></td></tr></tbody></table>\`;
  const result = parseAzureEntraStatus(html);
  assert.equal(result.kind, 'healthy');
  assert.deepEqual(result.components, [{ name: 'Non-Regional', status: 'Good' }]);
});

test('component issue telemetry excludes maintenance, unknown, and not-applicable states', () => {
  for (const value of ['operational', 'Good', 'Not available', 'n/a', 'unknown', 'under_maintenance', 'scheduled_maintenance']) assert.equal(componentStatusIsProblem(value), false, value);
  for (const value of ['degraded_performance', 'partial_outage', 'major_outage', 'unavailable']) assert.equal(componentStatusIsProblem(value), true, value);
  const summary = sourceIntelligenceSummary([{ source_state: 'available', ok: true, component_status: [{ status: 'Not available' }, { status: 'under_maintenance' }, { status: 'degraded_performance' }] }], []);
  assert.equal(summary.component_issue_count, 1);
});

test('affected provider count reconciles all degraded and major providers, including component-only states', () => {
  const providers = [
    { service_state: 'major', source_state: 'available' },
    { service_state: 'degraded', source_state: 'available' },
    { service_state: 'operational', source_state: 'available' },
    { service_state: 'unknown', source_state: 'available' }
  ];
  const summary = summarizeProviders(providers, [{ providerId: 'only-one-incident' }]);
  assert.equal(summary.affected_provider_count, 2);
  assert.equal(summary.major_count + summary.degraded_count, summary.affected_provider_count);
});

test('incident reconciliation updates stale count labels and preserves current component-only degradation', () => {
  const current = { id: 'p', name: 'Provider', title: 'Current outage', note: 'Customers are currently affected.', status: 'investigating', color: 'amber', rawTime: '2026-08-02T12:00:00Z', latest_update: '2026-08-02T12:00:00Z' };
  const stale = { ...current, id: 'old', title: 'Old outage', rawTime: '2026-07-20T12:00:00Z', latest_update: '2026-07-20T12:00:00Z' };
  const reconciled = reconcileProviderIncidentEvidence({ status: '2 active US public incidents', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [current, stale], component_status: [] }, Date.parse('2026-08-02T13:44:00Z'));
  assert.equal(reconciled.incidents.length, 1);
  assert.equal(reconciled.status, '1 active US public incident');

  const components = reconcileProviderIncidentEvidence({ status: '1 active US public incident', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [stale], component_status: [{ name: 'API', status: 'degraded_performance' }] }, Date.parse('2026-08-02T13:44:00Z'));
  assert.equal(components.incidents.length, 0);
  assert.equal(components.status, '1 current degraded component');
  assert.equal(components.service_state, 'degraded');
});

test('Vultr collapses indistinguishable duplicate public alerts without hiding distinct incidents', () => {
  const duplicate = id => ({ id, subject: 'Partial Outage', status: 'ongoing', start_date: '2026-08-02T12:00:00Z', updated_at: '2026-08-02T12:30:00Z', message: 'An outage or maintenance window is affecting a subset of users in this region.' });
  const result = parseVultrStatus(JSON.stringify({ regions: { ord: { country: 'US', location: 'Chicago', alerts: [duplicate('a'), duplicate('b'), { id: 'c', subject: 'Chicago power issue', status: 'ongoing', start_date: '2026-08-02T12:10:00Z', updated_at: '2026-08-02T12:40:00Z', message: 'Customers are currently experiencing intermittent connectivity.' }] } } }), { id: 'vultr', name: 'Vultr' }, { regionScope: 'us', url: 'https://status.vultr.com/status.json' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents.length, 2);
  assert.equal(result.incidents.find(item => /Partial Outage/.test(item.title)).collapsedRecordCount, 2);
});

test('disabled feed discovery performs no network request', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('should not fetch'); };
  try {
    const result = await tryFeedCandidates({ id: 'paypal', name: 'PayPal' }, { url: 'https://www.paypal-status.com/product/production', discoverFeeds: false }, '<link rel="alternate" href="/history.rss">', []);
    assert.equal(result, null);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('PayPal health is scoped before history and static legend text', () => {
  const staleHealthy = parsePayPalProductionStatus('PayPal Status Page Production Sandbox Subscribe Production Sandbox Services PayPal Degraded Performance Checkout users are experiencing elevated errors Operational Major Outage Degraded Performance Maintenance Bulletin View history All Production Systems Operational');
  assert.equal(staleHealthy.kind, 'component-state');
  const noCurrentSignal = parsePayPalProductionStatus('PayPal Status Page Production Sandbox Subscribe Production Sandbox Services APIs Operational Major Outage Degraded Performance Maintenance Bulletin View history All Production Systems Operational');
  assert.equal(noCurrentSignal.kind, 'limited');
});

test('deep review helper files are production code, not temporary patch artifacts', () => {
  for (const path of ['scripts/region-scope.mjs', 'scripts/incident-classification.mjs']) assert.equal(fs.existsSync(path), true);
});
`;
fs.writeFileSync('scripts/__tests__/deep-review-regressions.test.js', regressionTest);

console.log('Applied deep review repairs.');
