import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function replaceOnce(value, before, after, label) {
  const index = value.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}`);
  if (value.indexOf(before, index + before.length) >= 0) throw new Error(`Found multiple ${label} matches`);
  return `${value.slice(0, index)}${after}${value.slice(index + before.length)}`;
}

let publicStatus = read('scripts/update-public-status.mjs');
publicStatus = replaceOnce(
  publicStatus,
  "} from './source-intelligence.mjs';\n\nconst root",
  "} from './source-intelligence.mjs';\nimport { buildCollectionIntelligence, collectWithBudgets } from './collection-intelligence.mjs';\n\nconst root",
  'collection intelligence import'
);
publicStatus = replaceOnce(
  publicStatus,
  'const concurrency = 10;',
  'const collectionLimits = Object.freeze({ globalLimit: 10, perOriginLimit: 2 });',
  'collection concurrency constant'
);
const mapStart = publicStatus.indexOf('async function mapLimit(items, limit, mapper) {');
const generatorStart = publicStatus.indexOf('export async function generatePublicStatus() {');
if (mapStart < 0 || generatorStart < 0 || generatorStart <= mapStart) throw new Error('Could not locate legacy mapLimit block');
publicStatus = `${publicStatus.slice(0, mapStart)}${publicStatus.slice(generatorStart)}`;
publicStatus = replaceOnce(
  publicStatus,
  '  const results = await mapLimit(catalog, concurrency, loadPublicProvider);',
  "  const collectionStartedAt = new Date().toISOString();\n  const results = await collectWithBudgets(catalog, resolvePublicSource, loadPublicProvider, collectionLimits);",
  'provider collection call'
);
const providerBlockStart = publicStatus.indexOf('  const rawProviders = results.map');
const changesBlockStart = publicStatus.indexOf('  const changes = ', providerBlockStart);
if (providerBlockStart < 0 || changesBlockStart < 0) throw new Error('Could not locate provider enrichment block');
const replacementProviderBlock = `  const rawProviders = results.map(({ incidents: _incidents, maintenance: _maintenance, ...provider }) => provider);\n  const historicalProviders = enrichProviderHistory(rawProviders, previous, incidents, generatedAt);\n  const collectionIntelligence = buildCollectionIntelligence(historicalProviders, incidents, maintenance, collectionStartedAt, generatedAt);\n  const providers = collectionIntelligence.providers\n    .sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)) || a.name.localeCompare(b.name));\n  const base = {\n    schema_version: 2,\n    generated_at: generatedAt,\n    summary: { ...summarizeProviders(providers, incidents, maintenance), ...collectionIntelligence.summary },\n    collection: collectionIntelligence.collection,\n    providers,\n    incidents,\n    maintenance\n  };\n`;
publicStatus = `${publicStatus.slice(0, providerBlockStart)}${replacementProviderBlock}${publicStatus.slice(changesBlockStart)}`;
publicStatus = replaceOnce(
  publicStatus,
  '  console.log(`Generated free public-source status for ${providers.length} providers: ${payload.summary.coverage_percent}% live coverage, ${incidents.length} active incidents, ${maintenance.length} maintenance events.`);',
  '  console.log(`Generated v3 public-source intelligence for ${providers.length} providers: ${payload.summary.coverage_percent}% live coverage, quality ${payload.collection.quality_score}/100, ${payload.collection.origin_count} origins, ${incidents.length} incidents, ${maintenance.length} maintenance events.`);',
  'generation log'
);
write('scripts/update-public-status.mjs', publicStatus);

let updateStatus = read('scripts/update-status.mjs');
const validatorStart = updateStatus.indexOf('export function validatePayload(payload) {');
const statusGeneratorStart = updateStatus.indexOf('export async function generateStatus() {', validatorStart);
if (validatorStart < 0 || statusGeneratorStart < 0) throw new Error('Could not locate server validator');
const validator = `export function validatePayload(payload) {\n    const errors = [];\n    if (!payload || typeof payload !== 'object')\n        throw new Error('Generated payload validation failed: payload must be an object');\n    const providers = Array.isArray(payload.providers) ? payload.providers : [];\n    const incidents = Array.isArray(payload.incidents) ? payload.incidents : [];\n    const maintenance = Array.isArray(payload.maintenance) ? payload.maintenance : [];\n    if (!Array.isArray(payload.providers)) errors.push('providers must be an array');\n    if (!Array.isArray(payload.incidents)) errors.push('incidents must be an array');\n    if (payload.maintenance !== undefined && !Array.isArray(payload.maintenance)) errors.push('maintenance must be an array');\n    const ids = new Set();\n    for (const provider of providers) {\n        if (ids.has(provider.id)) errors.push(\`duplicate provider \${provider.id}\`);\n        ids.add(provider.id);\n        if (!['operational', 'degraded', 'major', 'unknown'].includes(provider.service_state)) errors.push(\`invalid service state \${provider.id}\`);\n        if (!['available', 'limited', 'unavailable', 'disabled', 'pending', 'stale'].includes(provider.source_state)) errors.push(\`invalid source state \${provider.id}\`);\n        if (provider.source_health !== undefined && !['healthy', 'watch', 'blind'].includes(provider.source_health)) errors.push(\`invalid source health \${provider.id}\`);\n        if (provider.truth_basis !== undefined && !['vendor-incident', 'confirmed-operational', 'observed-no-conclusion', 'last-known-official', 'limited-official', 'no-current-observation'].includes(provider.truth_basis)) errors.push(\`invalid truth basis \${provider.id}\`);\n        if (typeof provider.ok !== 'boolean' || !Number.isFinite(provider.priority) || !/^https?:/.test(provider.source)) errors.push(\`invalid provider \${provider.id}\`);\n        if (provider.data_quality_score !== undefined && (!Number.isFinite(provider.data_quality_score) || provider.data_quality_score < 0 || provider.data_quality_score > 100)) errors.push(\`invalid quality score \${provider.id}\`);\n        for (const field of ['source_latency_ms', 'collection_attempt_count', 'collection_success_count', 'collection_failure_count', 'freshness_seconds', 'active_incident_count', 'maintenance_count', 'problem_component_count'])\n            if (provider[field] !== undefined && (!Number.isFinite(provider[field]) || provider[field] < 0)) errors.push(\`invalid \${field} \${provider.id}\`);\n        if (provider.collection_attempt_count !== undefined && provider.collection_success_count !== undefined && provider.collection_failure_count !== undefined && provider.collection_attempt_count !== provider.collection_success_count + provider.collection_failure_count) errors.push(\`collection counts do not reconcile \${provider.id}\`);\n    }\n    const incidentIds = new Set();\n    for (const incident of incidents) {\n        if (!ids.has(incident.providerId)) errors.push(\`unknown incident provider \${incident.providerId}\`);\n        if (incidentIds.has(incident.id)) errors.push(\`duplicate incident \${incident.id}\`);\n        incidentIds.add(incident.id);\n        try { if (!['http:', 'https:'].includes(new URL(incident.url).protocol)) errors.push(\`invalid incident URL \${incident.id}\`); } catch { errors.push(\`invalid incident URL \${incident.id}\`); }\n        if (incident.rawTime && Date.parse(incident.rawTime) > Date.now() + 300000) errors.push(\`future incident \${incident.id}\`);\n    }\n    const maintenanceIds = new Set();\n    for (const item of maintenance) {\n        if (!ids.has(item.providerId)) errors.push(\`unknown maintenance provider \${item.providerId}\`);\n        if (!item.id || maintenanceIds.has(item.id)) errors.push(\`duplicate maintenance \${item.id || 'missing'}\`);\n        maintenanceIds.add(item.id);\n        try { if (!['http:', 'https:'].includes(new URL(item.url).protocol)) errors.push(\`invalid maintenance URL \${item.id}\`); } catch { errors.push(\`invalid maintenance URL \${item.id}\`); }\n        if (!['scheduled', 'in_progress', 'completed', 'unknown'].includes(item.status)) errors.push(\`invalid maintenance state \${item.id}\`);\n        for (const field of ['starts_at', 'ends_at', 'announced_at', 'latest_update']) if (item[field] && !Number.isFinite(Date.parse(item[field]))) errors.push(\`invalid maintenance \${field} \${item.id}\`);\n    }\n    if (!Array.isArray(payload.changes) || !Array.isArray(payload.history)) errors.push('changes and history must be arrays');\n    const expected = summarizeProviders(providers, incidents);\n    for (const [key, value] of Object.entries(expected)) if (payload.summary?.[key] !== value) errors.push(\`summary mismatch \${key}\`);\n    if (payload.collection !== undefined) {\n        const collection = payload.collection;\n        if (!collection || typeof collection !== 'object') errors.push('collection must be an object');\n        else {\n            for (const field of ['pipeline_version', 'run_id']) if (typeof collection[field] !== 'string' || !collection[field]) errors.push(\`invalid collection \${field}\`);\n            for (const field of ['started_at', 'completed_at']) if (!Number.isFinite(Date.parse(collection[field] || ''))) errors.push(\`invalid collection \${field}\`);\n            for (const field of ['duration_ms', 'provider_count', 'origin_count', 'unique_source_count', 'shared_source_count', 'request_count', 'successful_request_count', 'failed_request_count', 'request_success_percent', 'median_request_ms', 'p95_request_ms', 'quality_score', 'healthy_source_count', 'watch_source_count', 'blind_spot_count'])\n                if (!Number.isFinite(collection[field]) || collection[field] < 0) errors.push(\`invalid collection \${field}\`);\n            const attempts = providers.reduce((sum, provider) => sum + Number(provider.collection_attempt_count || 0), 0);\n            const successes = providers.reduce((sum, provider) => sum + Number(provider.collection_success_count || 0), 0);\n            const failures = providers.reduce((sum, provider) => sum + Number(provider.collection_failure_count || 0), 0);\n            const quality = providers.map(provider => Number(provider.data_quality_score)).filter(Number.isFinite);\n            const averageQuality = quality.length ? Math.round(quality.reduce((sum, value) => sum + value, 0) / quality.length) : 0;\n            if (collection.provider_count !== providers.length) errors.push('collection provider count mismatch');\n            if (collection.request_count !== attempts || collection.successful_request_count !== successes || collection.failed_request_count !== failures) errors.push('collection request counts mismatch');\n            if (collection.quality_score !== averageQuality) errors.push('collection quality mismatch');\n            if (collection.healthy_source_count !== providers.filter(provider => provider.source_health === 'healthy').length || collection.watch_source_count !== providers.filter(provider => provider.source_health === 'watch').length || collection.blind_spot_count !== providers.filter(provider => provider.source_health === 'blind').length) errors.push('collection source health mismatch');\n        }\n    }\n    if (payload.schema_version !== 2 || !Number.isFinite(Date.parse(payload.generated_at))) errors.push('invalid schema metadata');\n    if (errors.length) throw new Error(\`Generated payload validation failed: \${errors.join('; ')}\`);\n    return true;\n}\n`;
updateStatus = `${updateStatus.slice(0, validatorStart)}${validator}${updateStatus.slice(statusGeneratorStart)}`;
write('scripts/update-status.mjs', updateStatus);

let intelligence = read('scripts/source-intelligence.mjs');
intelligence = replaceOnce(intelligence, "export const PARSER_VERSION = '2.5.1';", "export const PARSER_VERSION = '3.0.0';", 'parser version');
write('scripts/source-intelligence.mjs', intelligence);

let intelligenceTest = read('scripts/__tests__/source-intelligence.test.js');
intelligenceTest = intelligenceTest.replaceAll("parser_version: '2.5.1'", "parser_version: '3.0.0'");
write('scripts/__tests__/source-intelligence.test.js', intelligenceTest);

let consoleView = read('src/IssueConsole.tsx');
consoleView = replaceOnce(consoleView, "import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';", "import { useEffect, useMemo, useState, type CSSProperties } from 'react';", 'unused search ref import');
consoleView = replaceOnce(consoleView, "  const searchRef = useRef<HTMLInputElement>(null);\n", '', 'search ref state');
consoleView = replaceOnce(consoleView, "if (event.key === '/') { event.preventDefault(); navigate('providers'); window.setTimeout(() => searchRef.current?.focus(), 0); }", "if (event.key === '/') { event.preventDefault(); navigate('providers'); window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-command-search]')?.focus(), 0); }", 'search keyboard shortcut');
consoleView = consoleView.replaceAll('<input type="search" value={query}', '<input data-command-search type="search" value={query}');
consoleView = replaceOnce(consoleView, "      {view === 'providers' && <input ref={searchRef} className=\"sr-only\" aria-hidden tabIndex={-1} />}\n", '', 'hidden search field');
write('src/IssueConsole.tsx', consoleView);

let readme = read('README.md');
readme = replaceOnce(readme, '# MSP Service Heads-Up Console', '# MSP Operations Command Center', 'README title');
const commandCenterSection = `## Version 3 command center\n\nVersion 3 rebuilds the product around two independent questions: **what is the vendor reporting?** and **how trustworthy is the collector observation?** The collection pipeline uses origin-aware global and per-host concurrency budgets, reuses shared first-party sources, measures request success and latency, scores every provider observation, and publishes a complete collection-run contract with quality, freshness, evidence, parser, and blind-spot metrics.\n\nThe interface is now an operator command center rather than a long status page. Overview prioritizes the action queue and dependency landscape; Incident Room combines vendor lifecycle, impact, technician guidance, and client-safe drafts; Provider Intelligence makes every dependency explorable; Source Integrity exposes the complete evidence and collection trace; Timeline retains bounded operational changes; and Wallboard presents the highest-value signals without interaction. Service state and source health remain visually and semantically separate everywhere.\n\n`;
readme = replaceOnce(readme, '## Operational workflow\n', `${commandCenterSection}## Operational workflow\n`, 'README command center section');
readme = replaceOnce(
  readme,
  'config/providers.json -> validation -> bounded official retrieval -> validated public/status.json',
  'config/providers.json -> origin-aware bounded retrieval -> adapter normalization -> collection intelligence -> dual validation -> public/status.json',
  'README architecture flow'
);
write('README.md', readme);

let changelog = read('CHANGELOG.md');
const release = `## [3.0.0] - 2026-08-01\n\n### Rebuilt\n\n- Replaced the long-form dashboard with an operator-first command center: Overview, Incident Room, Provider Intelligence, Source Integrity, Timeline, and a full-screen wallboard.\n- Added an action queue that ranks active vendor incidents, in-progress maintenance, critical source blind spots, repeated collection failures, and parser schema drift.\n- Added provider detail drawers with the observation contract, evidence tier, truth basis, quality score, freshness, parser, schema, request trace, incidents, maintenance, and component state.\n- Added a responsive dependency landscape, collection trust distribution, source-quality table, keyboard navigation, accessible focus behavior, and reduced-motion support.\n\n### Data collection\n\n- Replaced unrestricted catalog fan-out with global and per-origin collection budgets and round-robin origin scheduling.\n- Added per-provider source health, truth basis, data-quality scoring, source host, request latency, attempt counts, freshness, incident count, maintenance count, and component-issue count.\n- Added a top-level collection-run contract with run ID, pipeline version, duration, origin and source counts, request success, median and p95 latency, quality score, and healthy/watch/blind source distribution.\n- Preserved free, unauthenticated, first-party-only collection with no API keys, credentials, paid services, commercial aggregators, crowdsourced data, or browser-side vendor calls.\n\n### Validation and UX safety\n\n- Added server and browser validation for the collection intelligence contract and reconciliation of provider, request, source-health, and quality metrics.\n- Kept service state and source health independent so a collector failure cannot become an outage or an operational confirmation.\n- Added deterministic tests for origin budgets, quality scoring, collection metrics, action prioritization, source-health filtering, and category reconciliation.\n\n`;
changelog = replaceOnce(changelog, '## [2.5.1] - 2026-07-31\n', `${release}## [2.5.1] - 2026-07-31\n`, '3.0.0 changelog insertion');
write('CHANGELOG.md', changelog);

console.log('Applied v3 data pipeline and command center integration patch.');
