import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value);
}

function lines(...values) {
  return values.join('\n');
}

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error('Missing ' + label);
  const next = source.replace(before, after);
  if (next === source) throw new Error('No change for ' + label);
  return next;
}

let structured = read('scripts/structured-source-adapters.mjs');
structured = replaceExact(
  structured,
  lines(
    'function uniqueNames(values, limit = 8) {',
    '  const names = [...new Set(values.map(clean).filter(Boolean))];',
    '  if (names.length <= limit) return names.join(\', \');',
    '  return `${names.slice(0, limit).join(\', \')} +${names.length - limit} more`;',
    '}'
  ),
  lines(
    'function uniqueNames(values, limit = 8) {',
    '  const names = [...new Set(values.map(clean).filter(Boolean))];',
    '  if (names.length <= limit) return names.join(\', \');',
    '  return `${names.slice(0, limit).join(\', \')} +${names.length - limit} more`;',
    '}',
    '',
    'function componentName(value) {',
    '  if (typeof value === \'string\') return clean(value);',
    '  return clean(value?.name || value?.display_name || value?.container_name || value?.public_name || value?.id || \'\');',
    '}',
    '',
    'function componentScopeText(value) {',
    '  if (!value || typeof value !== \'object\') return \'\';',
    '  return clean([value.group_id, value.group_name, value.group, value.description, value.location, value.region].filter(Boolean).join(\' \'));',
    '}',
    '',
    'function scopedAffectedService(values, source) {',
    '  const items = Array.isArray(values) ? values : [];',
    '  const relevant = source.regionScope === \'global\'',
    '    ? items',
    '    : items.filter(item => isUsRelevant(componentName(item), componentScopeText(item), source.regionScope));',
    '  return uniqueNames(relevant.map(componentName));',
    '}',
    '',
    'function componentStateColor(values, fallback = \'\') {',
    '  const text = values.map(item => clean(item?.status || item)).join(\' \') + \' \' + clean(fallback);',
    '  return /\\b(?:major|critical|complete[_ -]?outage|major[_ -]?outage|down|offline|unavailable)\\b/i.test(text) ? \'red\' : \'amber\';',
    '}'
  ),
  'structured component helpers'
);

structured = replaceExact(
  structured,
  lines(
    '    const affectedService = uniqueNames(affectedComponents.map(component => component?.name || component?.display_name || component?.id));',
    '    const regionText = `${affectedService} ${affectedComponents.map(component => `${component?.group_id || \'\'} ${component?.description || \'\'}`).join(\' \')}`;',
    '    if (!title || isGenericTitle(title) || isEditorial(title, note) || isNonServiceAdvisory(title, note, status) || isPlannedOnly(title, note, status)) continue;',
    '    if (!isUsRelevant(title, `${note} ${regionText}`, source.regionScope)) continue;'
  ),
  lines(
    '    const affectedService = scopedAffectedService(affectedComponents, source);',
    '    const regionText = affectedComponents.map(component => componentName(component) + \' \' + componentScopeText(component)).join(\' \');',
    '    if (!title || isGenericTitle(title) || isEditorial(title, note) || isNonServiceAdvisory(title, note, status) || isPlannedOnly(title, note, status)) continue;',
    '    if (!isUsRelevant(title, note + \' \' + regionText, source.regionScope)) continue;'
  ),
  'Statuspage incident affected service scoping'
);

structured = replaceExact(
  structured,
  lines(
    '    const affectedComponents = Array.isArray(event.components) ? event.components : [];',
    '    const affectedService = uniqueNames(affectedComponents.map(component => component?.name || component?.display_name || component?.id));',
    '    if (!title || isEditorial(title, note)) continue;',
    '    if (!isUsRelevant(title, `${note} ${affectedService}`, source.regionScope)) continue;'
  ),
  lines(
    '    const affectedComponents = Array.isArray(event.components) ? event.components : [];',
    '    const affectedService = scopedAffectedService(affectedComponents, source);',
    '    const allAffectedService = affectedComponents.map(componentName).join(\' \');',
    '    if (!title || isEditorial(title, note)) continue;',
    '    if (!isUsRelevant(title, note + \' \' + allAffectedService, source.regionScope)) continue;'
  ),
  'Statuspage maintenance affected service scoping'
);

structured = replaceExact(
  structured,
  lines(
    '  const extras = { maintenance, components };',
    '  if (incidents.length) return { kind: \'issues\', incidents, ...extras };',
    '  const indicator = String(json.status?.indicator || \'\').toLowerCase();',
    '  if (indicator === \'none\') return { kind: \'healthy\', status: clean(json.status?.description) || `${provider.name || \'Provider\'} reports all systems operational`, ...extras };',
    '  const problemComponents = components.filter(component => componentStatusIsProblem(component.status));',
    '  if (problemComponents.length && indicator && indicator !== \'none\') {',
    '    const status = clean(json.status?.description) || `${provider.name || \'Provider\'} reports current component degradation`;',
    '    const names = uniqueNames(problemComponents.map(component => component.name));',
    '    return {',
    '      kind: \'component-state\',',
    '      status,',
    '      color: /major|critical/i.test(indicator) ? \'red\' : \'amber\',',
    '      message: names ? `Current structured component state: ${names}` : \'The official structured source reports current component degradation.\',',
    '      ...extras',
    '    };',
    '  }'
  ),
  lines(
    '  const extras = { maintenance, components };',
    '  if (incidents.length) return { kind: \'issues\', incidents, ...extras };',
    '  const indicator = String(json.status?.indicator || \'\').toLowerCase();',
    '  const problemComponents = components.filter(component => componentStatusIsProblem(component.status));',
    '  if (problemComponents.length) {',
    '    const status = clean(json.status?.description) || `${provider.name || \'Provider\'} reports current component degradation`;',
    '    const names = uniqueNames(problemComponents.map(component => component.name));',
    '    return {',
    '      kind: \'component-state\',',
    '      status,',
    '      color: componentStateColor(problemComponents, indicator),',
    '      message: names ? `Current structured component state: ${names}` : \'The official structured source reports current component degradation.\',',
    '      ...extras',
    '    };',
    '  }',
    '  if (indicator === \'none\') return { kind: \'healthy\', status: clean(json.status?.description) || `${provider.name || \'Provider\'} reports all systems operational`, ...extras };'
  ),
  'Statuspage component precedence'
);

structured = replaceExact(
  structured,
  lines(
    '    const title = clean(event?.name || event?.title || \'Scheduled maintenance\');',
    '    const note = clean(event?.details || event?.message || event?.description || \'The provider has scheduled maintenance.\').slice(0, 900);',
    '    if (!title || isEditorial(title, note) || !isUsRelevant(title, note, source.regionScope)) continue;',
    '    records.push({'
  ),
  lines(
    '    const title = clean(event?.name || event?.title || \'Scheduled maintenance\');',
    '    const note = clean(event?.details || event?.message || event?.description || \'The provider has scheduled maintenance.\').slice(0, 900);',
    '    const affectedItems = [...(event?.components || []), ...(event?.containers || [])];',
    '    const affectedService = scopedAffectedService(affectedItems, source);',
    '    const allAffectedService = affectedItems.map(componentName).join(\' \');',
    '    if (!title || isEditorial(title, note) || !isUsRelevant(title, note + \' \' + allAffectedService, source.regionScope)) continue;',
    '    records.push({'
  ),
  'Status.io maintenance scope inputs'
);
structured = replaceExact(
  structured,
  '      affectedService: uniqueNames([...(event?.components || []), ...(event?.containers || [])].map(item => item?.name || item?.container_name || item)),',
  '      affectedService,',
  'Status.io maintenance scoped display'
);

structured = replaceExact(
  structured,
  lines(
    '    const affectedService = uniqueNames([...(incident?.components || []), ...(incident?.containers || [])].map(item => item?.name || item?.container_name || item));',
    '    if (!title || isGenericTitle(title) || isEditorial(title, note) || isNonServiceAdvisory(title, note, status) || isPlannedOnly(title, note, status)) continue;',
    '    if (!isUsRelevant(title, `${note} ${affectedService}`, source.regionScope)) continue;'
  ),
  lines(
    '    const affectedItems = [...(incident?.components || []), ...(incident?.containers || [])];',
    '    const affectedService = scopedAffectedService(affectedItems, source);',
    '    const allAffectedService = affectedItems.map(componentName).join(\' \');',
    '    if (!title || isGenericTitle(title) || isEditorial(title, note) || isNonServiceAdvisory(title, note, status) || isPlannedOnly(title, note, status)) continue;',
    '    if (!isUsRelevant(title, note + \' \' + allAffectedService, source.regionScope)) continue;'
  ),
  'Status.io incident affected service scoping'
);

structured = replaceExact(
  structured,
  lines(
    '  const extras = { maintenance, components };',
    '  if (incidents.length) return { kind: \'issues\', incidents, ...extras };',
    '  const overall = clean(result.status_overall?.status || result.status_overall?.name || result.status_overall?.message);',
    '  if (/operational|all systems (?:are )?(?:operational|normal)|all services (?:are )?(?:operating normally|operational)/i.test(overall)) {',
    '    return { kind: \'healthy\', status: overall || `${provider.name || \'Provider\'} reports all systems operational`, ...extras };',
    '  }'
  ),
  lines(
    '  const extras = { maintenance, components };',
    '  if (incidents.length) return { kind: \'issues\', incidents, ...extras };',
    '  const overall = clean(result.status_overall?.status || result.status_overall?.name || result.status_overall?.message);',
    '  const problemComponents = components.filter(component => componentStatusIsProblem(component.status));',
    '  if (problemComponents.length) {',
    '    const names = uniqueNames(problemComponents.map(component => component.name));',
    '    return {',
    '      kind: \'component-state\',',
    '      status: `${provider.name || \'Provider\'} reports current component degradation`,',
    '      color: componentStateColor(problemComponents, overall),',
    '      message: names ? `Current structured component state: ${names}` : \'The official Status.io source reports current component degradation.\',',
    '      ...extras',
    '    };',
    '  }',
    '  if (/operational|all systems (?:are )?(?:operational|normal)|all services (?:are )?(?:operating normally|operational)/i.test(overall)) {',
    '    return { kind: \'healthy\', status: overall || `${provider.name || \'Provider\'} reports all systems operational`, ...extras };',
    '  }'
  ),
  'Status.io component precedence'
);

structured = replaceExact(
  structured,
  lines(
    '    const affectedService = uniqueNames(affected.map(item => resources.get(String(item.status_page_resource_id))?.public_name || item.status_page_resource_id));',
    '    const title = clean(attributes.title);',
    '    const note = clean(latest.message || attributes.message || attributes.description || \'\').slice(0, 900);',
    '    if (!title || isEditorial(title, note) || isNonServiceAdvisory(title, note, attributes.aggregate_state || attributes.status || \'\') || !isUsRelevant(title, `${note} ${affectedService}`, source.regionScope)) continue;'
  ),
  lines(
    '    const affectedNames = affected.map(item => resources.get(String(item.status_page_resource_id))?.public_name || item.status_page_resource_id).map(clean).filter(Boolean);',
    '    const affectedService = uniqueNames(affectedNames.filter(name => isUsRelevant(name, \'\', source.regionScope)));',
    '    const title = clean(attributes.title);',
    '    const note = clean(latest.message || attributes.message || attributes.description || \'\').slice(0, 900);',
    '    if (!title || isEditorial(title, note) || isNonServiceAdvisory(title, note, attributes.aggregate_state || attributes.status || \'\') || !isUsRelevant(title, note + \' \' + affectedNames.join(\' \'), source.regionScope)) continue;'
  ),
  'Better Stack affected service scoping'
);

structured = replaceExact(
  structured,
  lines(
    '  const extras = { maintenance, components };',
    '  if (incidents.length) return { kind: \'issues\', incidents, ...extras };',
    '  const aggregate = String(json.data.attributes.aggregate_state || \'\').toLowerCase();',
    '  if (staleReportCount && ![\'operational\', \'maintenance\'].includes(aggregate)) return { kind: \'limited\', message: `${provider.name || \'Provider\'} has unresolved structured records without a recent official update. They were not presented as current.`, ...extras };',
    '  if (aggregate === \'operational\' || aggregate === \'maintenance\') {'
  ),
  lines(
    '  const extras = { maintenance, components };',
    '  if (incidents.length) return { kind: \'issues\', incidents, ...extras };',
    '  const aggregate = String(json.data.attributes.aggregate_state || \'\').toLowerCase();',
    '  const problemComponents = components.filter(component => componentStatusIsProblem(component.status));',
    '  if (problemComponents.length) {',
    '    const names = uniqueNames(problemComponents.map(component => component.name));',
    '    return {',
    '      kind: \'component-state\',',
    '      status: `${provider.name || \'Provider\'} reports current component degradation`,',
    '      color: componentStateColor(problemComponents, aggregate),',
    '      message: names ? `Current structured component state: ${names}` : \'The official Better Stack source reports current component degradation.\',',
    '      ...extras',
    '    };',
    '  }',
    '  if (staleReportCount && ![\'operational\', \'maintenance\'].includes(aggregate)) return { kind: \'limited\', message: `${provider.name || \'Provider\'} has unresolved structured records without a recent official update. They were not presented as current.`, ...extras };',
    '  if (aggregate === \'operational\' || aggregate === \'maintenance\') {'
  ),
  'Better Stack component precedence'
);
write('scripts/structured-source-adapters.mjs', structured);

let publicStatus = read('scripts/update-public-status.mjs');
publicStatus = replaceExact(
  publicStatus,
  "import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';",
  lines(
    "import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';",
    "import { isNonServiceAdvisory } from './incident-classification.mjs';"
  ),
  'public status advisory import'
);
publicStatus = replaceExact(
  publicStatus,
  '    if (isEditorialIncidentEntry(item) || isGenericIncidentTitle(item.title) || !issueText(text) || resolvedText(text) || maintenanceOnly(text)) return false;',
  '    if (isEditorialIncidentEntry(item) || isGenericIncidentTitle(item.title) || isNonServiceAdvisory(item.title, item.note, item.status) || !issueText(text) || resolvedText(text) || maintenanceOnly(text)) return false;',
  'feed advisory suppression'
);
publicStatus = replaceExact(
  publicStatus,
  '  const boundary = /\\b(?:incident history|past incidents|previous incidents|resolved incidents|historical incidents|uptime history)\\b/i.exec(text);',
  '  const boundary = /\\b(?:view history|incident history|past incidents|previous incidents|resolved incidents|historical incidents|uptime history)\\b/i.exec(text);',
  'HTML history boundary'
);
publicStatus = replaceExact(
  publicStatus,
  'function htmlIssueConclusion(provider, source, html) {',
  'export function htmlIssueConclusion(provider, source, html) {',
  'HTML conclusion export'
);
publicStatus = replaceExact(
  publicStatus,
  lines(
    '  const current = currentHtmlSection(html);',
    '  const lower = current.toLowerCase();',
    '  if (/cloudflare|attention required|verify you are human|captcha|access denied|enable javascript to run this app/.test(lower) && current.length < 4000) return { kind: \'limited\', message: \'The official page returned a bot challenge or JavaScript shell without readable service status.\' };',
    '  if (provider.id === \'entra\') return entraConclusion(current);',
    '  const activeCount = /\\b([1-9]\\d*)\\s+active incidents?\\b/i.exec(current);',
    '  if (activeCount) return { kind: \'issue\', color: \'amber\', title: `${provider.name} public status page reports an active issue`, note: `${activeCount[1]} active incidents` };',
    '  const healthy = /\\b(all systems operational|all systems working|all services operational|all services are operational|no active incidents|0 active incidents|no incidents reported|everything is operating normally)\\b/i.exec(current);',
    '  if (healthy) return { kind: \'healthy\', status: cleanText(healthy[0]) };',
    '  const issuePattern = /\\b(major outage|partial outage|degraded performance|service disruption|service degradation|critical incident|active incident|investigating an issue|identified an issue|monitoring an issue)\\b/i;',
    '  const issue = issuePattern.exec(current);',
    '  if (issue) {',
    '    const text = issue[0];',
    '    return { kind: \'issue\', color: /major|critical|outage/i.test(text) && !/partial/i.test(text) ? \'red\' : \'amber\', title: `${provider.name} public status page reports an active issue`, note: text };',
    '  }',
    '  const operationalMatches = current.match(/\\bOperational\\b/gi) || [];',
    '  const problemMatches = current.match(/\\b(Major Outage|Partial Outage|Degraded Performance|Service Disruption)\\b/gi) || [];'
  ),
  lines(
    '  const current = currentHtmlSection(html);',
    '  const lower = current.toLowerCase();',
    '  if (/cloudflare|attention required|verify you are human|captcha|access denied|enable javascript to run this app/.test(lower) && current.length < 4000) return { kind: \'limited\', message: \'The official page returned a bot challenge or JavaScript shell without readable service status.\' };',
    '  if (provider.id === \'entra\') return entraConclusion(current);',
    '  const signal = current',
    '    .replace(/\\bOperational(?:\\s+(?:Major Outage|Partial Outage|Degraded Performance|Maintenance|Bulletin)){2,}\\b/gi, \' \')',
    '    .replace(/\\bMajor Outage\\s+Partial Outage\\s+Degraded Performance\\s+Operational(?:\\s+Maintenance)?\\b/gi, \' \');',
    '  const activeCount = /\\b([1-9]\\d*)\\s+active incidents?\\b/i.exec(signal);',
    '  if (activeCount) return { kind: \'issue\', color: \'amber\', title: `${provider.name} public status page reports an active issue`, note: `${activeCount[1]} active incidents` };',
    '  const issuePattern = /\\b(major outage|partial outage|degraded performance|service disruption|service degradation|critical incident|investigating an issue|identified an issue|monitoring an issue)\\b/i;',
    '  const issue = issuePattern.exec(signal);',
    '  if (issue) {',
    '    const text = issue[0];',
    '    return { kind: \'issue\', color: /major|critical|outage/i.test(text) && !/partial/i.test(text) ? \'red\' : \'amber\', title: `${provider.name} public status page reports an active issue`, note: text };',
    '  }',
    '  const healthy = /\\b(all systems operational|all systems working|all services operational|all services are operational|no active incidents|0 active incidents|no incidents reported|everything is operating normally)\\b/i.exec(signal);',
    '  if (healthy) return { kind: \'healthy\', status: cleanText(healthy[0]) };',
    '  const operationalMatches = signal.match(/\\bOperational\\b/gi) || [];',
    '  const problemMatches = signal.match(/\\b(Major Outage|Partial Outage|Degraded Performance|Service Disruption)\\b/gi) || [];'
  ),
  'generic HTML signal ordering and legend filtering'
);
publicStatus = replaceExact(
  publicStatus,
  lines(
    '  return {',
    '    ...result,',
    '    incidents: [],',
    '    status: \'Current incident evidence unavailable\',',
    '    color: \'blue\',',
    '    service_state: \'unknown\',',
    '    source_state: result.source_state === \'available\' ? \'limited\' : result.source_state,',
    '    attention: \'watch\',',
    '    ok: false,',
    '    message: \'The official source exposed an issue state without current timestamped incident evidence. It was not presented as an active provider incident.\'',
    '  };'
  ),
  lines(
    '  return {',
    '    ...result,',
    '    incidents: [],',
    '    status: \'Current incident evidence unavailable\',',
    '    color: \'blue\',',
    '    service_state: \'unknown\',',
    '    attention: \'watch\',',
    '    message: \'The official source exposed an issue state without current timestamped incident evidence. It was not presented as an active provider incident.\'',
    '  };'
  ),
  'service evidence reconciliation source health separation'
);
write('scripts/update-public-status.mjs', publicStatus);

let review = read('scripts/full-review-source-adapters.mjs');
review = replaceExact(
  review,
  "import { parseStatuspageSummary } from './structured-source-adapters.mjs';",
  lines(
    "import { parseStatuspageSummary } from './structured-source-adapters.mjs';",
    "import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';",
    "import { regionScopeRelevant } from './region-scope.mjs';",
    "import { componentStatusIsProblem } from './source-intelligence.mjs';"
  ),
  'full review shared policy imports'
);
review = replaceExact(
  review,
  lines(
    'function explicitNonUsOnly(value) {',
    '  const text = clean(value);',
    '  const us = /\\b(?:united states|u\\.s\\.|usa|us|north america|americas|global|worldwide|all regions|multiple regions)\\b/i.test(text);',
    '  const nonUs = /\\b(?:emea|europe|european|eu central|uk|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|ca east|latin america|latam|middle east|africa|japan|singapore|india|brazil)\\b/i.test(text);',
    '  return nonUs && !us;',
    '}'
  ),
  lines(
    'function explicitNonUsOnly(value) {',
    '  return !regionScopeRelevant(\'\', clean(value), \'us\');',
    '}'
  ),
  'full review non-US policy'
);
review = replaceExact(
  review,
  lines(
    '    const firstDetected = toIso(incident?.StartDate || incident?.DateCreated || updates.at(-1)?.at || \'\');',
    '    const latestUpdate = toIso(incident?.DateUpdated || latest.at || incident?.DateCreated || incident?.StartDate || \'\');',
    '    incidents.push({'
  ),
  lines(
    '    const firstDetected = toIso(incident?.StartDate || incident?.DateCreated || updates.at(-1)?.at || \'\');',
    '    const latestUpdate = toIso(incident?.DateUpdated || latest.at || incident?.DateCreated || incident?.StartDate || \'\');',
    '    if (!incidentEvidenceIsCurrent({ title, note, status, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;',
    '    incidents.push({'
  ),
  'StatusCast current evidence freshness'
);
review = replaceExact(
  review,
  'function fireHydrantMaintenance(json) {',
  'function fireHydrantMaintenance(json, source = {}) {',
  'FireHydrant maintenance source context'
);
review = replaceExact(
  review,
  lines(
    '  return records.map(item => {',
    '    const components = item?.componentConditions && typeof item.componentConditions === \'object\'',
    '      ? Object.keys(item.componentConditions).map(clean).filter(Boolean)',
    '      : [];',
    '    return {',
    '      id: String(item?.id || \'\'),',
    '      title: clean(item?.name || \'Backblaze scheduled maintenance\'),',
    '      note: clean(item?.summary || item?.description || \'\'),'
  ),
  lines(
    '  return records.map(item => {',
    '    const allComponents = item?.componentConditions && typeof item.componentConditions === \'object\'',
    '      ? Object.keys(item.componentConditions).map(clean).filter(Boolean)',
    '      : [];',
    '    const title = clean(item?.name || \'Backblaze scheduled maintenance\');',
    '    const note = clean(item?.summary || item?.description || \'\');',
    '    if (!regionScopeRelevant(title, note + \' \' + allComponents.join(\' \'), source.regionScope || \'us\')) return null;',
    '    const components = source.regionScope === \'global\' ? allComponents : allComponents.filter(name => regionScopeRelevant(name, \'\', source.regionScope || \'us\'));',
    '    return {',
    '      id: String(item?.id || \'\'),',
    '      title,',
    '      note,'
  ),
  'FireHydrant maintenance scoping'
);
review = replaceExact(
  review,
  '  });\n}\n\nexport function parseFireHydrantPayload',
  '  }).filter(Boolean);\n}\n\nexport function parseFireHydrantPayload',
  'FireHydrant maintenance null filtering'
);
review = replaceExact(
  review,
  lines(
    '    const firstDetected = toIso(incident?.timestamps?.started || incident?.startedAt || incident?.createdAt || timeline.at(-1)?.at || \'\');',
    '    const latestUpdate = toIso(latest.at || incident?.updatedAt || incident?.timestamps?.started || \'\');',
    '    incidents.push({'
  ),
  lines(
    '    const firstDetected = toIso(incident?.timestamps?.started || incident?.startedAt || incident?.createdAt || timeline.at(-1)?.at || \'\');',
    '    const latestUpdate = toIso(latest.at || incident?.updatedAt || incident?.timestamps?.started || \'\');',
    '    if (!incidentEvidenceIsCurrent({ title, note, status, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;',
    '    incidents.push({'
  ),
  'FireHydrant current evidence freshness'
);
review = replaceExact(
  review,
  '      affectedService: components.map(item => item.name).join(\', \') || provider.name || \'Backblaze services\',',
  '      affectedService: components.filter(item => regionScopeRelevant(item.name, item.status, source.regionScope || \'us\')).map(item => item.name).join(\', \') || provider.name || \'Backblaze services\',',
  'FireHydrant incident affected service scoping'
);
review = replaceExact(
  review,
  '  const maintenance = fireHydrantMaintenance(json);',
  '  const maintenance = fireHydrantMaintenance(json, source);',
  'FireHydrant maintenance call'
);
review = replaceExact(
  review,
  lines(
    '  const components = json.components.map(item => ({',
    '    name: clean(item?.name || \'\'),',
    '    status: clean(item?.customerCondition || item?.condition || item?.status || \'operational\')',
    '  })).filter(item => item.name);'
  ),
  lines(
    '  const components = json.components.map(item => ({',
    '    name: clean(item?.name || \'\'),',
    '    status: clean(item?.customerCondition || item?.condition || item?.status || \'operational\')',
    '  })).filter(item => item.name && regionScopeRelevant(item.name, item.status, source.regionScope || \'us\'));'
  ),
  'FireHydrant component region scoping'
);
review = replaceExact(
  review,
  '  const explicitProblems = components.filter(component => !/^(?:operational|available|up|ok|none|good)$/i.test(component.status));',
  '  const explicitProblems = components.filter(component => componentStatusIsProblem(component.status));',
  'FireHydrant component problem semantics'
);
write('scripts/full-review-source-adapters.mjs', review);

let region = read('scripts/region-scope.mjs');
region = replaceExact(
  region,
  'const NON_US_NAMED_SCOPE = /\\b(?:emea|europe|european|united kingdom|apac|asia(?: pacific)?|',
  'const NON_US_NAMED_SCOPE = /\\b(?:emea|europe|european|eu|united kingdom|apac|asia(?: pacific)?|',
  'EU region token'
);
write('scripts/region-scope.mjs', region);

const tests = `import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBetterStackIndex, parseStatusioJson, parseStatuspageSummary } from '../structured-source-adapters.mjs';
import { parseFireHydrantPayload, parseStatusCastSummary } from '../full-review-source-adapters.mjs';
import { activeFeedEntries, htmlIssueConclusion, reconcileProviderIncidentEvidence } from '../update-public-status.mjs';

const auditNow = Date.parse('2026-08-02T13:44:00Z');

function statuspage(data) {
  return JSON.stringify({ page: { url: 'https://status.example/' }, incidents: [], scheduled_maintenances: [], ...data });
}

test('structured component degradation wins over contradictory aggregate healthy states', () => {
  const statuspageResult = parseStatuspageSummary(statuspage({
    status: { indicator: 'none', description: 'All Systems Operational' },
    components: [{ name: 'US API', status: 'degraded_performance' }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(statuspageResult.kind, 'component-state');

  const statusioResult = parseStatusioJson(JSON.stringify({ result: {
    status_overall: { status: 'Operational', status_code: 100 },
    status: [{ name: 'North America', containers: [{ name: 'US API', status: 'Degraded Performance' }] }],
    maintenance: { active: [], upcoming: [] },
    incidents: []
  } }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(statusioResult.kind, 'component-state');

  const betterStackResult = parseBetterStackIndex(JSON.stringify({
    data: { type: 'status_page', attributes: { company_name: 'Example', aggregate_state: 'operational' } },
    included: [{ id: 'us-api', type: 'status_page_resource', attributes: { public_name: 'US API', status: 'degraded' } }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(betterStackResult.kind, 'component-state');
});

test('mixed-region Statuspage incidents display only US-relevant affected components', () => {
  const result = parseStatuspageSummary(statuspage({
    status: { indicator: 'major', description: 'Major Service Outage' },
    components: [{ name: 'US-East', status: 'partial_outage' }],
    incidents: [{
      id: 'mixed', name: 'Global API disruption', status: 'investigating', impact: 'major',
      created_at: '2026-08-02T12:00:00Z', updated_at: '2026-08-02T13:00:00Z',
      components: [{ name: 'US-East' }, { name: 'API Europe', description: 'London Europe' }],
      incident_updates: [{ status: 'investigating', body: 'Customers in multiple regions are experiencing failed requests.', created_at: '2026-08-02T13:00:00Z' }]
    }]
  }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(result.kind, 'issues');
  assert.equal(result.incidents[0].affectedService, 'US-East');
});

test('foreign-only Status.io maintenance does not leak into the US maintenance list', () => {
  const result = parseStatusioJson(JSON.stringify({ result: {
    status_overall: { status: 'Operational', status_code: 100 },
    status: [{ name: 'North America', containers: [{ name: 'US API', status: 'Operational' }] }],
    maintenance: { active: [], upcoming: [{ id: 'eu-maint', name: 'Database maintenance', status: 'Scheduled', components: [{ name: 'EU API' }] }] },
    incidents: []
  } }), { name: 'Example' }, { regionScope: 'us' });
  assert.equal(result.kind, 'healthy');
  assert.equal(result.maintenance.length, 0);
});

test('Backblaze FireHydrant uses shared US scope and neutral maintenance component semantics', () => {
  const result = parseFireHydrantPayload(JSON.stringify({
    config: { companyName: 'Backblaze', operationalMessage: 'All systems operational. Nothing to report.' },
    conditions: { Operational: 'OPERATIONAL', Maintenance: 'MAINTENANCE' },
    components: [
      { name: 'US East Region', customerCondition: 'Operational' },
      { name: 'EU Region', customerCondition: 'Maintenance' }
    ],
    incidents: [],
    scheduledMaintenances: [{ id: 'eu-maint', name: 'Database maintenance', startsAt: '2026-08-03T12:00:00Z', endsAt: '2026-08-03T13:00:00Z', componentConditions: { 'EU Region': 'Maintenance' } }]
  }), { name: 'Backblaze' }, { regionScope: 'us', pageUrl: 'https://status.backblaze.com/' });
  assert.equal(result.kind, 'healthy');
  assert.deepEqual(result.components.map(item => item.name), ['US East Region']);
  assert.equal(result.maintenance.length, 0);
});

test('stale unresolved StatusCast and FireHydrant records never remain current incidents', () => {
  const statusCast = parseStatusCastSummary(JSON.stringify({
    Status: 'Operational', StatusText: 'Available', UnresolvedIncidents: [{
      Id: 'old', Title: 'Americas Contact Center degradation', Status: 'Monitoring', IncidentType: 'Performance Issue',
      StartDate: '2026-01-01T00:00:00Z', DateUpdated: '2026-01-01T01:00:00Z', Posts: [{ Text: 'Customers in the Americas are experiencing intermittent errors.', DateCreated: '2026-01-01T01:00:00Z' }]
    }]
  }), { name: '8x8' }, { regionScope: 'us' });
  assert.equal(statusCast.kind, 'healthy');
  assert.equal(statusCast.incidents, undefined);

  const fireHydrant = parseFireHydrantPayload(JSON.stringify({
    config: { companyName: 'Backblaze', operationalMessage: 'All systems operational. Nothing to report.' },
    conditions: { Operational: 'OPERATIONAL' },
    components: [{ name: 'US East Region', customerCondition: 'Operational' }],
    incidents: [{ id: 'old', name: 'US East API degradation', summary: 'Customers are experiencing elevated API errors.', currentMilestone: 'monitoring', timestamps: { started: '2026-01-01T00:00:00Z' }, updatedAt: '2026-01-01T01:00:00Z', componentConditions: { 'US East Region': 'Degraded' } }],
    scheduledMaintenances: []
  }), { name: 'Backblaze' }, { regionScope: 'us' });
  assert.equal(fireHydrant.kind, 'healthy');
});

test('public incident feeds suppress non-service security and product advisories', () => {
  const entries = activeFeedEntries([{ title: 'Security vulnerability hotfix', note: 'A security advisory requires a hotfix. There is no impact to service availability.', status: 'investigating', time: '2026-08-02T12:00:00Z' }], 168, auditNow);
  assert.equal(entries.length, 0);
});

test('generic HTML ignores static legends, respects view-history boundaries, and still sees current issues', () => {
  const provider = { id: 'example', name: 'Example' };
  const source = { regionScope: 'us' };
  const legend = htmlIssueConclusion(provider, source, '<main>Status Operational Major Outage Partial Outage Degraded Performance Maintenance Bulletin View history Major Outage old incident</main>');
  assert.equal(legend.kind, 'limited');
  const issue = htmlIssueConclusion(provider, source, '<main>Status Investigating an issue Customers are currently experiencing failed requests. View history All Systems Operational</main>');
  assert.equal(issue.kind, 'issue');
});

test('service evidence reconciliation never downgrades a successfully readable source', () => {
  const stale = { id: 'old', title: 'Old outage', note: 'Customers were affected.', status: 'monitoring', color: 'amber', rawTime: '2026-01-01T00:00:00Z', latest_update: '2026-01-01T01:00:00Z' };
  const result = reconcileProviderIncidentEvidence({ status: '1 active public incident', color: 'amber', service_state: 'degraded', source_state: 'available', attention: 'action', ok: true, incidents: [stale], component_status: [] }, auditNow);
  assert.equal(result.service_state, 'unknown');
  assert.equal(result.source_state, 'available');
  assert.equal(result.ok, true);
});
`;
write('scripts/__tests__/last-mile-hardening.test.js', tests);

console.log('Applied last-mile audit hardening.');
