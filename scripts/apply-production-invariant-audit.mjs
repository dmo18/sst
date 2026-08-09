import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const current = fs.readFileSync(path, 'utf8');
  if (!current.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  const next = current.replace(before, after);
  if (next === current) throw new Error(`No change for ${label} in ${path}`);
  fs.writeFileSync(path, next);
}

replaceExact(
  'scripts/region-scope.mjs',
  "const NON_US_NAMED_SCOPE = /\\b(?:emea|europe|european|eu|uk|united kingdom|great britain|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|",
  "const NON_US_NAMED_SCOPE = /\\b(?:emea|europe|european|eu|uk|united kingdom|great britain|apac|asia(?: pacific)?|oceania|australia|new zealand|canada|latin america|latam|middle east|africa|",
  'Oceania region classification'
);

replaceExact(
  'scripts/source-intelligence.mjs',
  `function maintenanceState(value) {\n  const status = clean(value).toLowerCase();\n  if (/in[_ -]?progress|ongoing|underway|started/.test(status)) return 'in_progress';\n  if (/completed|resolved|cancelled|canceled|finished/.test(status)) return 'completed';\n  if (/scheduled|planned|upcoming|not[_ -]?started/.test(status)) return 'scheduled';\n  return 'unknown';\n}\n\nexport function normalizeMaintenanceState(value) {\n  return maintenanceState(value);\n}`,
  `function maintenanceState(value, startsAt = '', endsAt = '', now = Date.now()) {\n  const status = clean(value).toLowerCase();\n  const start = Date.parse(startsAt || '');\n  const end = Date.parse(endsAt || '');\n  if (/completed|resolved|cancelled|canceled|finished/.test(status)) return 'completed';\n  if (Number.isFinite(end) && end <= now) return 'completed';\n  if (Number.isFinite(start) && start > now) return 'scheduled';\n  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end > now)) return 'in_progress';\n  if (/in[_ -]?progress|ongoing|underway|started/.test(status)) return 'in_progress';\n  if (/scheduled|planned|upcoming|not[_ -]?started/.test(status)) return 'scheduled';\n  return 'unknown';\n}\n\nexport function normalizeMaintenanceState(value, startsAt = '', endsAt = '', now = Date.now()) {\n  return maintenanceState(value, startsAt, endsAt, now);\n}`,
  'time-aware maintenance lifecycle'
);

replaceExact(
  'scripts/source-intelligence.mjs',
  "  if (!item || maintenanceState(item.status) === 'completed') return false;",
  "  if (!item || maintenanceState(item.status, item.starts_at, item.ends_at, now) === 'completed') return false;",
  'maintenance relevance lifecycle'
);

replaceExact(
  'scripts/source-intelligence.mjs',
  "    ongoing_maintenance_count: maintenance.filter(item => maintenanceState(item.status) === 'in_progress').length,",
  "    ongoing_maintenance_count: maintenance.filter(item => maintenanceState(item.status, item.starts_at, item.ends_at) === 'in_progress').length,",
  'ongoing maintenance summary lifecycle'
);

replaceExact(
  'scripts/source-intelligence.mjs',
  "    if (maintenanceState(old.status) !== 'in_progress' && maintenanceState(item.status) === 'in_progress') {",
  "    if (maintenanceState(old.status, old.starts_at, old.ends_at) !== 'in_progress' && maintenanceState(item.status, item.starts_at, item.ends_at) === 'in_progress') {",
  'maintenance change lifecycle'
);

replaceExact(
  'scripts/update-public-status.mjs',
  "  const status = normalizeMaintenanceState(item.status || 'scheduled');",
  "  const startsAt = item.startsAt || item.starts_at || '';\n  const endsAt = item.endsAt || item.ends_at || '';\n  const status = normalizeMaintenanceState(item.status || 'scheduled', startsAt, endsAt);",
  'maintenance lifecycle inputs'
);
replaceExact(
  'scripts/update-public-status.mjs',
  "    starts_at: item.startsAt || item.starts_at || '',\n    ends_at: item.endsAt || item.ends_at || '',",
  "    starts_at: startsAt,\n    ends_at: endsAt,",
  'maintenance normalized times'
);

replaceExact(
  'scripts/collection-intelligence.mjs',
  `function truthBasis(provider) {\n  if (['major', 'degraded'].includes(provider.service_state) && provider.source_state === 'available') return 'vendor-incident';\n  if (provider.service_state === 'operational' && provider.source_state === 'available') return 'confirmed-operational';\n  if (provider.source_state === 'available') return 'observed-no-conclusion';\n  if (provider.source_state === 'stale') return 'last-known-official';\n  if (provider.source_state === 'limited') return 'limited-official';\n  return 'no-current-observation';\n}`,
  `function truthBasis(provider, incidentCount = 0, problemComponentCount = 0) {\n  if (['major', 'degraded'].includes(provider.service_state) && provider.source_state === 'available') {\n    if (incidentCount > 0) return 'vendor-incident';\n    if (problemComponentCount > 0) return 'vendor-component';\n    return 'observed-affected-no-detail';\n  }\n  if (provider.service_state === 'operational' && provider.source_state === 'available') return 'confirmed-operational';\n  if (provider.source_state === 'available') return 'observed-no-conclusion';\n  if (provider.source_state === 'stale') return 'last-known-official';\n  if (provider.source_state === 'limited') return 'limited-official';\n  return 'no-current-observation';\n}`,
  'truth basis distinction'
);
replaceExact(
  'scripts/collection-intelligence.mjs',
  "  const problemComponents = (provider.component_status || []).filter(component => componentStatusIsProblem(component.status)).length;",
  "  const problemComponents = (provider.component_status || []).filter(component => componentStatusIsProblem(component.status)).length;\n  const incidentCount = incidents.filter(item => item.providerId === provider.id).length;",
  'incident count reuse'
);
replaceExact(
  'scripts/collection-intelligence.mjs',
  "    truth_basis: truthBasis(provider),",
  "    truth_basis: truthBasis(provider, incidentCount, problemComponents),",
  'truth basis inputs'
);
replaceExact(
  'scripts/collection-intelligence.mjs',
  "    active_incident_count: incidents.filter(item => item.providerId === provider.id).length,",
  "    active_incident_count: incidentCount,",
  'active incident count reuse'
);

replaceExact(
  'scripts/structured-source-adapters.mjs',
  "      status: 'ongoing',\n      affectedService: details,\n      color: /major outage|service outage/i.test(subject) ? 'red' : 'amber',\n      url: `https://status.salesforce.com/incidents/${id}`",
  "      status: 'ongoing',\n      affectedService: details,\n      evidenceBasis: 'current-page',\n      color: /major outage|service outage/i.test(subject) ? 'red' : 'amber',\n      url: `https://status.salesforce.com/incidents/${id}`",
  'Salesforce current-page evidence marker'
);
replaceExact(
  'scripts/structured-source-adapters.mjs',
  "      status: 'ongoing',\n      affectedService: details,\n      color: /major outage|service outage/i.test(subject) ? 'red' : 'amber',\n      url: 'https://status.salesforce.com/current'",
  "      status: 'ongoing',\n      affectedService: details,\n      evidenceBasis: 'current-page',\n      color: /major outage|service outage/i.test(subject) ? 'red' : 'amber',\n      url: 'https://status.salesforce.com/current'",
  'Salesforce fallback evidence marker'
);

replaceExact(
  'scripts/update-public-status.mjs',
  "    latest_update: latestUpdate,\n    client_impact: provider.client_impact,",
  "    latest_update: latestUpdate,\n    observed_at: new Date().toISOString(),\n    ...(item.evidenceBasis || item.evidence_basis ? { evidence_basis: item.evidenceBasis || item.evidence_basis } : {}),\n    client_impact: provider.client_impact,",
  'incident observation provenance'
);

replaceExact(
  'scripts/ensure-valid-status.mjs',
  "  if (normalized.summary.coverage_percent !== normalized.summary.live_source_coverage_percent) throw new Error('Coverage metrics must reconcile to live official source coverage.');\n  return normalized;",
  `  if (normalized.summary.coverage_percent !== normalized.summary.live_source_coverage_percent) throw new Error('Coverage metrics must reconcile to live official source coverage.');\n\n  const nowMs = Date.parse(now) || Date.now();\n  const futureActiveMaintenance = normalized.maintenance.filter(item => item.status === 'in_progress' && Number.isFinite(Date.parse(item.starts_at || '')) && Date.parse(item.starts_at) > nowMs + 5 * 60 * 1000);\n  if (futureActiveMaintenance.length) throw new Error(\`Future maintenance cannot be in progress: \${futureActiveMaintenance.map(item => item.id).join(', ')}\`);\n  const expiredMaintenance = normalized.maintenance.filter(item => Number.isFinite(Date.parse(item.ends_at || '')) && Date.parse(item.ends_at) < nowMs - 15 * 60 * 1000);\n  if (expiredMaintenance.length) throw new Error(\`Expired maintenance cannot remain active: \${expiredMaintenance.map(item => item.id).join(', ')}\`);\n  const incidentCounts = new Map();\n  for (const incident of normalized.incidents || []) incidentCounts.set(incident.providerId, Number(incidentCounts.get(incident.providerId) || 0) + 1);\n  const incidentCountMismatches = normalized.providers.filter(provider => Number(provider.active_incident_count || 0) !== Number(incidentCounts.get(provider.id) || 0));\n  if (incidentCountMismatches.length) throw new Error(\`Provider incident counts do not reconcile: \${incidentCountMismatches.map(provider => provider.id).join(', ')}\`);\n  const affectedCount = normalized.providers.filter(provider => ['major', 'degraded'].includes(provider.service_state)).length;\n  if (Number(normalized.summary.affected_provider_count) !== affectedCount) throw new Error(\`Affected provider count does not reconcile: expected \${affectedCount}, received \${normalized.summary.affected_provider_count}\`);\n  const unprovenUntimed = (normalized.incidents || []).filter(incident => !incident.latest_update && !incident.first_detected && !incident.rawTime && !(incident.evidence_basis === 'current-page' && Number.isFinite(Date.parse(incident.observed_at || ''))));\n  if (unprovenUntimed.length) throw new Error(\`Untimed incidents require explicit current-page evidence: \${unprovenUntimed.map(incident => incident.id).join(', ')}\`);\n  return normalized;`,
  'payload invariant enforcement'
);

console.log('Applied production invariant audit repairs.');
