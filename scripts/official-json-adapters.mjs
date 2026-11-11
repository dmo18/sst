// Adapters for first-party, unauthenticated JSON that vendors publish for their
// own public status pages. Each parser returns the same conclusion shape as the
// other structured adapters:
//   { kind: 'healthy' | 'issues' | 'component-state' | 'limited', ... }
// and returns null when the document is not the expected shape, so a schema
// change fails closed instead of producing a health conclusion.
import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
import { isNonServiceAdvisory } from './incident-classification.mjs';
import { regionScopeRelevant } from './region-scope.mjs';
import { componentStatusIsProblem } from './source-intelligence.mjs';

function clean(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\*{1,3}|`+|(?:^|\s)#{1,6}(?=\s)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeJson(value) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}

function uniqueNames(values, limit = 8) {
  const names = [...new Set(values.map(clean).filter(Boolean))];
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} +${names.length - limit} more`;
}

// Vendor timestamps without a zone are documented as UTC by the sources below.
function utcIso(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  const timestamp = Date.parse(zoned);
  // Microsoft uses 0001-01-01 as "no value".
  if (!Number.isFinite(timestamp) || timestamp < Date.UTC(2000, 0, 1)) return '';
  return new Date(timestamp).toISOString();
}

function current(incident, requireTimestamp = true) {
  return incidentEvidenceIsCurrent(incident, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp });
}

function problemFirst(components, limit = 36) {
  const problems = components.filter(component => componentStatusIsProblem(component.status));
  const others = components.filter(component => !componentStatusIsProblem(component.status));
  return [...problems, ...others].slice(0, Math.max(limit, Math.min(problems.length, 96)));
}

// ---------------------------------------------------------------------------
// Microsoft 365: https://status.cloud.microsoft/api/posts/{mac,ppac,m365Consumer}
//
// These are the documents Microsoft's own public status page renders. They need
// no tenant, token, or sign-in. They state the availability of the Microsoft 365
// admin center, the Power Platform admin center, and each consumer workload.
// They do not state the health of an individual tenant.
// ---------------------------------------------------------------------------

export const MICROSOFT_PUBLIC_STATUS_PAGE = 'https://status.cloud.microsoft/';
export const MICROSOFT_PUBLIC_STATUS_ENDPOINTS = Object.freeze({
  mac: { url: 'https://status.cloud.microsoft/api/posts/mac', name: 'Microsoft 365 admin center', required: true },
  consumer: { url: 'https://status.cloud.microsoft/api/posts/m365Consumer', name: 'Microsoft 365 consumer services', required: true },
  ppac: { url: 'https://status.cloud.microsoft/api/posts/ppac', name: 'Power Platform admin center', required: false }
});

const MICROSOFT_HEALTHY = /^(?:available|operational|service restored)$/i;
const MICROSOFT_DEGRADED = /^service degradation$/i;

function microsoftComponentStatus(status) {
  const text = clean(status);
  if (MICROSOFT_HEALTHY.test(text)) return 'operational';
  if (MICROSOFT_DEGRADED.test(text)) return 'service_degradation';
  return 'unknown';
}

function microsoftPost(raw, fallbackName) {
  if (!raw || typeof raw !== 'object' || typeof raw.Status !== 'string') return null;
  return {
    name: clean(raw.ServiceDisplayName) || fallbackName,
    workload: clean(raw.ServiceWorkloadName),
    id: clean(raw.Id),
    title: clean(raw.Title),
    message: clean(raw.Message),
    status: clean(raw.Status),
    authored: utcIso(raw.AuthoredDateTime),
    updated: utcIso(raw.LastUpdatedTime)
  };
}

export function parseMicrosoftPublicStatus(documents = {}, provider = {}) {
  const macRaw = safeJson(documents.mac);
  const consumerRaw = safeJson(documents.consumer);
  const ppacRaw = documents.ppac === undefined || documents.ppac === null || documents.ppac === '' ? undefined : safeJson(documents.ppac);

  const mac = microsoftPost(macRaw, MICROSOFT_PUBLIC_STATUS_ENDPOINTS.mac.name);
  const consumer = Array.isArray(consumerRaw) ? consumerRaw.map(item => microsoftPost(item, 'Microsoft consumer service')).filter(Boolean) : null;
  if (!mac || !consumer || consumer.length === 0 || consumer.length !== consumerRaw.length) return null;
  const ppac = ppacRaw === undefined ? null : microsoftPost(ppacRaw, MICROSOFT_PUBLIC_STATUS_ENDPOINTS.ppac.name);

  const posts = [
    { ...mac, name: MICROSOFT_PUBLIC_STATUS_ENDPOINTS.mac.name, scope: 'enterprise' },
    ...(ppac ? [{ ...ppac, name: MICROSOFT_PUBLIC_STATUS_ENDPOINTS.ppac.name, scope: 'enterprise' }] : []),
    ...consumer.map(post => ({ ...post, scope: 'consumer' }))
  ];
  const components = posts.map(post => ({
    name: post.name,
    status: microsoftComponentStatus(post.status),
    group: post.scope === 'enterprise' ? 'Microsoft admin centers' : 'Microsoft 365 consumer services'
  }));

  const degraded = posts.filter(post => MICROSOFT_DEGRADED.test(post.status));
  const unknown = posts.filter(post => microsoftComponentStatus(post.status) === 'unknown');
  const providerName = provider.name || 'Microsoft 365';

  if (degraded.length) {
    const incidents = degraded.map(post => {
      const title = post.title || `${post.name}: service degradation`;
      const note = post.message || `Microsoft's public status page reports service degradation for ${post.name}.`;
      const broad = post.scope === 'enterprise';
      return {
        id: post.id || `public-${(post.workload || post.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        note: note.slice(0, 900),
        status: 'Service degradation',
        firstDetected: post.authored || post.updated,
        latestUpdate: post.updated || post.authored,
        affectedService: post.name,
        // The admin-center post is how Microsoft announces a broad enterprise
        // incident. A single consumer workload is a narrower condition.
        color: broad || /\b(?:outage|unavailable|unable to (?:access|sign in|send|receive)|down)\b/i.test(`${title} ${note}`) ? 'red' : 'amber',
        url: MICROSOFT_PUBLIC_STATUS_PAGE,
        updates: [{ status: 'Service degradation', note: note.slice(0, 900), at: post.updated || post.authored }]
      };
    });
    return { kind: 'issues', incidents, components, maintenance: [] };
  }

  if (unknown.length) {
    return {
      kind: 'limited',
      message: `Microsoft's public status page returned an unrecognized state for ${uniqueNames(unknown.map(post => `${post.name} (${post.status || 'empty'})`))}. No operational conclusion was made.`,
      components,
      maintenance: []
    };
  }

  return {
    kind: 'healthy',
    status: `${providerName}: Microsoft reports the admin center available and ${consumer.length} consumer services operational`,
    components,
    maintenance: []
  };
}

// ---------------------------------------------------------------------------
// N-able and Cove Data Protection: the StatusDashboard document behind
// https://uptime.n-able.com/ (the same request the public page makes).
// ---------------------------------------------------------------------------

const NABLE_CLOSED = /^(?:resolved|closed|completed|complete|cancelled|canceled)$/i;

function nableServiceScope(provider, name) {
  const cove = /\bcove\b/i.test(name);
  if (provider.id === 'cove-data-protection') return cove;
  if (provider.id === 'n-able') return !cove;
  return true;
}

function nableRegionInScope(groupOrName, regionScope) {
  if (regionScope === 'global') return true;
  return /\b(?:americas|global)\b/i.test(String(groupOrName || ''));
}

function nableSeverityStatus(severity) {
  const text = clean(severity).toLowerCase();
  if (!text) return 'degraded_performance';
  if (/major|critical|outage/.test(text) && !/partial|minor/.test(text)) return 'major_outage';
  if (/partial/.test(text)) return 'partial_outage';
  return 'degraded_performance';
}

function nableTitle(description, fallback) {
  const lines = String(description || '').split(/\r?\n/).map(clean).filter(Boolean);
  if (!lines.length) return fallback;
  // Entries open with the product name on its own line, then the headline.
  const headline = lines[0].length <= 48 && lines[1] ? `${lines[0]}: ${lines[1]}` : lines[0];
  return headline.replace(/\s*:\s*$/, '').slice(0, 160);
}

function nableUpdates(event) {
  return (Array.isArray(event?.updates) ? event.updates : [])
    .map(update => ({ status: clean(update?.status), note: clean(update?.update || update?.description).slice(0, 900), at: utcIso(update?.date) }))
    .filter(update => update.note || update.at)
    .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
    .slice(0, 8);
}

export function parseNableDashboard(value, provider = {}, source = {}) {
  const json = safeJson(value);
  const board = Array.isArray(json?.objects) ? json.objects[0] : null;
  if (!board || !Array.isArray(board.services) || !board.events || typeof board.events !== 'object') return null;

  const regionScope = source.regionScope || 'us';
  const scopedServices = board.services
    .filter(service => service && typeof service.name === 'string')
    .filter(service => nableServiceScope(provider, service.name) && nableRegionInScope(`${service.group || ''} ${service.name}`, regionScope));
  if (!scopedServices.length) return null;
  const scopedNames = new Set(scopedServices.map(service => service.name));
  const pageUrl = source.pageUrl || 'https://uptime.n-able.com/';

  const openIncidents = (Array.isArray(board.events.incident) ? board.events.incident : [])
    .filter(event => event && !event.end && !NABLE_CLOSED.test(clean(event.status)));
  const severityByService = new Map();
  const incidents = [];
  let staleCount = 0;

  for (const event of openIncidents) {
    const affected = (Array.isArray(event.services) ? event.services : []).filter(name => scopedNames.has(name));
    if (!affected.length) continue;
    const severity = clean(event?.severity?.sev_value);
    for (const name of affected) severityByService.set(name, nableSeverityStatus(severity));
    const updates = nableUpdates(event);
    const title = nableTitle(event.description, `${provider.name || 'N-able'} incident`);
    const note = (updates[0]?.note || clean(event.description)).slice(0, 900);
    const status = clean(event.status) || 'active';
    const firstDetected = utcIso(event.start);
    const latestUpdate = updates[0]?.at || firstDetected;
    if (isNonServiceAdvisory(title, note, status) && !/outage|degrad|disrupt|performance/i.test(severity)) continue;
    if (!current({ title, note, status, firstDetected, latestUpdate, affectedService: affected.join(', ') })) {
      staleCount += 1;
      continue;
    }
    incidents.push({
      id: String(event.id || ''),
      title,
      note,
      status,
      firstDetected,
      latestUpdate,
      affectedService: uniqueNames(affected),
      color: nableSeverityStatus(severity) === 'major_outage' ? 'red' : 'amber',
      url: pageUrl,
      updates
    });
  }

  const components = problemFirst(scopedServices.map(service => ({
    name: service.name,
    status: severityByService.get(service.name) || (Number(service.status) === 0 ? 'operational' : 'unknown'),
    group: clean(service.group)
  })));

  const maintenance = [];
  for (const kind of ['maintenance', 'maintenance_planned']) {
    for (const event of Array.isArray(board.events[kind]) ? board.events[kind] : []) {
      const affected = (Array.isArray(event?.services) ? event.services : []).filter(name => scopedNames.has(name));
      if (!affected.length || NABLE_CLOSED.test(clean(event.status))) continue;
      maintenance.push({
        id: String(event.id || ''),
        title: nableTitle(event.description, `${provider.name || 'N-able'} planned maintenance`),
        note: clean(event.description).slice(0, 900),
        status: kind === 'maintenance' ? 'in_progress' : 'scheduled',
        startsAt: utcIso(event.start),
        endsAt: utcIso(event.end),
        announcedAt: '',
        latestUpdate: nableUpdates(event)[0]?.at || utcIso(event.start),
        affectedService: uniqueNames(affected),
        url: pageUrl,
        updates: nableUpdates(event)
      });
    }
  }

  const extras = { components, maintenance };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const problems = components.filter(component => componentStatusIsProblem(component.status));
  if (problems.length) {
    return {
      kind: 'component-state',
      status: `${provider.name || 'N-able'} reports current service impact`,
      color: problems.some(component => component.status === 'major_outage') ? 'red' : 'amber',
      message: `Current official service state: ${uniqueNames(problems.map(component => component.name))}`,
      ...extras
    };
  }
  const unknown = components.filter(component => component.status === 'unknown');
  if (unknown.length || staleCount) {
    return {
      kind: 'limited',
      message: `${provider.name || 'N-able'} lists ${unknown.length} service${unknown.length === 1 ? '' : 's'} in a state that is neither operational nor tied to a current incident. No operational conclusion was made.`,
      ...extras
    };
  }
  return {
    kind: 'healthy',
    status: provider.id === 'cove-data-protection'
      ? 'N-able reports Cove Data Protection services operational in the Americas'
      : 'N-able reports its Americas and global services operational',
    ...extras
  };
}

// ---------------------------------------------------------------------------
// RingCentral: https://status.ringcentral.com/status.json
// ---------------------------------------------------------------------------

const RINGCENTRAL_LEVEL_STATUS = { good: 'operational', information: 'operational', warning: 'degraded_performance', issue: 'service_disruption' };

function firstDate(record) {
  if (!record || typeof record !== 'object') return '';
  for (const key of ['updatedAt', 'updated', 'updateTime', 'time', 'timestamp', 'date', 'createdAt', 'created', 'startTime', 'start']) {
    const value = record[key];
    const iso = typeof value === 'number' ? (Number.isFinite(value) ? new Date(value < 1e12 ? value * 1000 : value).toISOString() : '') : utcIso(value);
    if (iso) return iso;
  }
  return '';
}

export function parseRingCentralStatus(value, provider = {}, source = {}) {
  const rows = safeJson(value);
  if (!Array.isArray(rows) || !rows.length) return null;
  const valid = rows.filter(row => row && typeof row.service === 'string' && typeof row.region === 'string' && typeof row.level === 'string');
  if (valid.length !== rows.length) return null;

  const regionScope = source.regionScope || 'us';
  const scoped = valid.filter(row => regionScope === 'global' || /^(?:americas|global|all|north america|us)$/i.test(row.region.trim()));
  if (!scoped.length) return null;
  const pageUrl = source.pageUrl || 'https://status.ringcentral.com/';

  const unknownLevels = new Set();
  const components = problemFirst(scoped.map(row => {
    const status = RINGCENTRAL_LEVEL_STATUS[row.level.trim().toLowerCase()];
    if (!status) unknownLevels.add(row.level.trim());
    return { name: row.service, status: status || 'unknown', group: clean(row.category) };
  }));

  const alerts = new Map();
  for (const row of scoped) {
    const entries = row.alerts && typeof row.alerts === 'object' && !Array.isArray(row.alerts) ? Object.entries(row.alerts) : [];
    for (const [id, alert] of entries) {
      if (!alert || typeof alert !== 'object') continue;
      const record = alerts.get(id) || { id, alert, services: [] };
      record.services.push(row.service);
      alerts.set(id, record);
    }
  }

  const incidents = [];
  for (const { id, alert, services } of alerts.values()) {
    const level = clean(alert.level).toLowerCase();
    if (level === 'information' || level === 'good') continue;
    const updates = (Array.isArray(alert.statusUpdates) ? alert.statusUpdates : [])
      .map(update => ({ status: clean(update?.status || update?.state), note: clean(update?.message).slice(0, 900), at: firstDate(update) }))
      .filter(update => update.note || update.at)
      .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
      .slice(0, 8);
    const description = clean(alert.description || alert.title || alert.summary);
    const title = (description.split(/(?<=[.!?])\s/)[0] || `RingCentral ${uniqueNames(services, 3)}: ${level || 'issue'}`).slice(0, 160);
    const note = (updates[0]?.note || description || 'RingCentral reports a current service issue.').slice(0, 900);
    const latestUpdate = updates[0]?.at || firstDate(alert);
    const firstDetected = updates.at(-1)?.at || firstDate(alert) || latestUpdate;
    const incident = {
      id: String(id),
      title,
      note,
      status: updates[0]?.status || 'active',
      firstDetected,
      latestUpdate,
      affectedService: uniqueNames(services),
      color: level === 'issue' ? 'red' : 'amber',
      url: pageUrl,
      updates,
      ...(latestUpdate ? {} : { evidenceBasis: 'current-page' })
    };
    if (!current(incident, false)) continue;
    incidents.push(incident);
  }

  const extras = { components, maintenance: [] };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const problems = components.filter(component => componentStatusIsProblem(component.status));
  if (problems.length) {
    return {
      kind: 'component-state',
      status: 'RingCentral reports current service issues',
      color: problems.some(component => component.status === 'service_disruption') ? 'red' : 'amber',
      message: `Current official service state: ${uniqueNames(problems.map(component => component.name))}`,
      ...extras
    };
  }
  if (unknownLevels.size) {
    return { kind: 'limited', message: `RingCentral returned an unrecognized service level (${[...unknownLevels].join(', ')}). No operational conclusion was made.`, ...extras };
  }
  return { kind: 'healthy', status: `RingCentral reports ${scoped.length} Americas services in good standing`, ...extras };
}

// ---------------------------------------------------------------------------
// Salesforce Trust: https://api.status.salesforce.com/v1/incidents/active
// ---------------------------------------------------------------------------

const SALESFORCE_US_INSTANCE = /^(?:NA|USA|US)\d/i;

export function parseSalesforceActiveIncidents(value, provider = {}, source = {}) {
  const rows = safeJson(value);
  if (!Array.isArray(rows)) return null;
  if (rows.some(row => !row || typeof row !== 'object' || (row.id === undefined && row.externalId === undefined))) return null;

  const regionScope = source.regionScope || 'us';
  const incidents = [];
  let outOfScope = 0;

  for (const row of rows) {
    if (!/^active$/i.test(clean(row.status || 'active'))) continue;
    const impacts = Array.isArray(row.IncidentImpacts) ? row.IncidentImpacts : [];
    const ongoing = impacts.filter(impact => !impact?.endTime);
    if (impacts.length && !ongoing.length) continue;
    const instances = Array.isArray(row.instanceKeys) ? row.instanceKeys.map(String) : [];
    const usInstances = instances.filter(key => SALESFORCE_US_INSTANCE.test(key));
    const inScope = regionScope === 'global' || row.affectsAll === true || !instances.length || usInstances.length > 0;
    if (!inScope) {
      outOfScope += 1;
      continue;
    }
    const events = (Array.isArray(row.IncidentEvents) ? row.IncidentEvents : [])
      .map(event => ({ status: clean(event?.type), note: clean(event?.message).slice(0, 900), at: utcIso(event?.createdAt) }))
      .filter(event => event.note || event.at)
      .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
      .slice(0, 8);
    const services = Array.isArray(row.serviceKeys) ? row.serviceKeys.map(clean).filter(Boolean) : [];
    const impactType = clean((ongoing[0] || impacts[0] || {}).type).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    const type = clean(row.type) || 'Incident';
    const title = `Salesforce ${type.toLowerCase()}${services.length ? `: ${uniqueNames(services, 4)}` : ''}${impactType ? ` (${impactType})` : ''}`;
    const note = events[0]?.note || `Salesforce Trust reports an active ${type.toLowerCase()}.`;
    const startTimes = impacts.map(impact => utcIso(impact?.startTime)).filter(Boolean).sort();
    const firstDetected = startTimes[0] || utcIso(row.createdAt);
    const latestUpdate = events[0]?.at || utcIso(row.updatedAt) || firstDetected;
    const severity = (ongoing.length ? ongoing : impacts).map(impact => clean(impact?.severity).toLowerCase());
    const incident = {
      id: String(row.externalId || row.id),
      title,
      note,
      status: 'active',
      firstDetected,
      latestUpdate,
      affectedService: uniqueNames([...services, ...(usInstances.length ? [`${usInstances.length} US instance${usInstances.length === 1 ? '' : 's'}`] : [])]),
      color: severity.some(level => /major|critical/.test(level)) || /outage|disruption/i.test(type) ? 'red' : 'amber',
      url: /^https:\/\//i.test(String(row.additionalInformation || '')) ? row.additionalInformation : `https://status.salesforce.com/incidents/${row.id}`,
      updates: events
    };
    if (!current(incident)) continue;
    incidents.push(incident);
  }

  if (incidents.length) return { kind: 'issues', incidents: incidents.slice(0, 12), components: [], maintenance: [] };
  return {
    kind: 'healthy',
    status: outOfScope
      ? 'Salesforce Trust reports no active US-relevant incident'
      : rows.length ? 'Salesforce Trust reports no current service-impacting incident' : 'Salesforce Trust reports no active incidents',
    components: [],
    maintenance: []
  };
}

// ---------------------------------------------------------------------------
// Google Workspace and Google Cloud: incidents.json (an incident is open while
// it has no "end").
// ---------------------------------------------------------------------------

export function parseGoogleIncidents(value, provider = {}, source = {}) {
  const rows = safeJson(value);
  if (!Array.isArray(rows)) return null;
  if (rows.some(row => !row || typeof row !== 'object' || typeof row.id !== 'string' || !('begin' in row))) return null;

  const regionScope = source.regionScope || 'us';
  const pageUrl = source.pageUrl || source.url || '';
  const incidents = [];
  let outOfScope = 0;

  for (const row of rows) {
    if (row.end) continue;
    if (/^SERVICE_INFORMATION$/i.test(clean(row.status_impact))) continue;
    const latest = row.most_recent_update && typeof row.most_recent_update === 'object' ? row.most_recent_update : {};
    const products = (Array.isArray(row.affected_products) ? row.affected_products : []).map(product => clean(product?.title)).filter(Boolean);
    const locations = (Array.isArray(row.currently_affected_locations) ? row.currently_affected_locations : []).map(location => clean(`${location?.title || ''} ${location?.id || ''}`)).filter(Boolean);
    const title = clean(row.external_desc).split(/(?<=[.!?])\s/)[0].slice(0, 180) || `${clean(row.service_name) || provider.name || 'Google'} incident`;
    const note = clean(latest.text || row.external_desc).slice(0, 900);
    if (!regionScopeRelevant(title, locations.join(' ') || note, regionScope)) {
      outOfScope += 1;
      continue;
    }
    const updates = (Array.isArray(row.updates) ? row.updates : [])
      .map(update => ({ status: clean(update?.status), note: clean(update?.text).slice(0, 900), at: utcIso(update?.when || update?.created) }))
      .filter(update => update.note || update.at)
      .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
      .slice(0, 8);
    const firstDetected = utcIso(row.begin) || utcIso(row.created);
    const latestUpdate = utcIso(latest.when || latest.created) || utcIso(row.modified) || firstDetected;
    const incident = {
      id: row.id,
      title,
      note,
      status: clean(latest.status).toLowerCase().replace(/_/g, ' ') || 'active',
      firstDetected,
      latestUpdate,
      affectedService: uniqueNames(products.length ? products : [clean(row.service_name)]),
      color: /^SERVICE_OUTAGE$/i.test(clean(row.status_impact)) || /^high$/i.test(clean(row.severity)) ? 'red' : 'amber',
      url: row.uri ? new URL(String(row.uri), pageUrl || 'https://status.cloud.google.com/').href : pageUrl,
      updates
    };
    if (!current(incident)) continue;
    incidents.push(incident);
  }

  if (incidents.length) return { kind: 'issues', incidents: incidents.slice(0, 12), components: [], maintenance: [] };
  return {
    kind: 'healthy',
    status: outOfScope
      ? `${provider.name || 'Google'} reports no open US-relevant incident`
      : `${provider.name || 'Google'} reports no open incidents`,
    components: [],
    maintenance: []
  };
}
