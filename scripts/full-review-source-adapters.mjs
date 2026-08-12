import { parseStatuspageSummary } from './structured-source-adapters.mjs';
import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
import { regionScopeRelevant } from './region-scope.mjs';
import { componentStatusIsProblem } from './source-intelligence.mjs';

export const fullReviewOverrides = {
  kaseya: {
    mode: 'statuspage-json',
    url: 'https://status.kaseya.com/api/v2/summary.json',
    pageUrl: 'https://status.kaseya.com/',
    sourceName: 'Kaseya official Statuspage JSON',
    regionScope: 'us'
  },
  lastpass: {
    mode: 'statuspage-json',
    url: 'https://status.lastpass.com/api/v1/status.json',
    pageUrl: 'https://status.lastpass.com/',
    feedCandidates: ['https://status.lastpass.com/history.rss'],
    sourceName: 'LastPass official Rootly status JSON',
    regionScope: 'us'
  },
  '8x8': {
    mode: 'statuscast-json',
    url: 'https://8x8status.status.page/summary.json',
    pageUrl: 'https://status.8x8.com/',
    sourceName: '8x8 official StatusCast JSON',
    regionScope: 'us'
  },
  proofpoint: {
    mode: 'status-html',
    url: 'https://proofpoint.my.site.com/community/s/proofpoint-current-incidents',
    sourceName: 'Proofpoint official current incidents page',
    render: true,
    regionScope: 'us'
  },
  backblaze: {
    mode: 'firehydrant-json',
    url: 'https://status.backblaze.com/data/payload.json',
    pageUrl: 'https://status.backblaze.com/',
    feedCandidates: ['https://status.backblaze.com/data/rss.xml'],
    sourceName: 'Backblaze official FireHydrant payload',
    regionScope: 'us'
  },
  stripe: {
    mode: 'statuspage-json',
    url: 'https://www.stripestatus.com/api/v2/summary.json',
    pageUrl: 'https://www.stripestatus.com/',
    sourceName: 'Stripe official Statuspage JSON',
    regionScope: 'global'
  },
  paypal: {
    mode: 'status-html',
    url: 'https://www.paypal-status.com/product/production',
    pageUrl: 'https://www.paypal-status.com/product/production',
    sourceName: 'PayPal production status page',
    render: true,
    discoverFeeds: false,
    regionScope: 'global'
  },
  crowdstrike: {
    mode: 'status-access-reference',
    url: 'https://www.crowdstrike.com/en-us/contact-us/',
    pageUrl: 'https://supportportal.crowdstrike.com/',
    sourceName: 'CrowdStrike official support access page',
    healthAccess: 'authenticated',
    regionScope: 'us'
  },
  intermedia: {
    mode: 'status-access-reference',
    url: 'https://support.intermedia.com/',
    pageUrl: 'https://cp.intermedia.net/ControlPanel/Login?ClientType=ControlPanel',
    sourceName: 'Intermedia official system-status access page',
    healthAccess: 'authenticated',
    regionScope: 'us'
  }
};

function safeJson(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clean(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIso(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function timeValue(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusCastUpdates(incident) {
  const posts = Array.isArray(incident?.Posts) ? incident.Posts : [];
  return posts
    .map(post => ({
      status: clean(post?.Status || post?.PostType || incident?.Status || ''),
      note: clean(post?.Text || post?.Message || post?.Description || ''),
      at: toIso(post?.DateCreated || post?.DateUpdated || post?.Date || post?.CreatedAt || '')
    }))
    .filter(update => update.status || update.note || update.at)
    .sort((a, b) => timeValue(b.at) - timeValue(a.at))
    .slice(0, 8);
}

function explicitNonUsOnly(value) {
  return !regionScopeRelevant('', clean(value), 'us');
}

function serviceImpact(value) {
  return /\b(?:major outage|partial outage|outage|unavailable|service down|degrad(?:ed|ation|ing)|performance issue|service disruption|service issue|latency|elevated errors?|failed requests?|connection failures?|intermittent|customers? (?:are|is) (?:currently )?(?:affected|impacted|unable|experiencing)|users? (?:are|is) (?:currently )?(?:affected|impacted|unable|experiencing))\b/i.test(clean(value));
}

function informationalOnly(value) {
  const text = clean(value);
  const noImpact = /\b(?:no planned impact to availability|no impact to (?:service|availability)|without service impact|informational only)\b/i.test(text);
  const editorial = /\b(?:knowledge\s*base|knowledgebase|support portal|documentation|release notes?|new user interface|static links?|bookmarked links?)\b/i.test(text);
  return noImpact || (editorial && !serviceImpact(text));
}

function statusCastColor(value) {
  return /\b(?:major|critical|complete outage|service down|unavailable)\b/i.test(clean(value)) ? 'red' : 'amber';
}

export function parseStatusCastSummary(value, provider = {}, source = {}) {
  const json = safeJson(value);
  if (!json || typeof json !== 'object' || !('Status' in json) || !Array.isArray(json.UnresolvedIncidents)) return null;

  const incidents = [];
  let explicitNonUsCount = 0;
  let ignoredInformationalCount = 0;

  for (const incident of json.UnresolvedIncidents) {
    const updates = statusCastUpdates(incident);
    const latest = updates[0] || {};
    const title = clean(incident?.Title || incident?.Name || '');
    const note = clean(latest.note || incident?.Description || incident?.Message || '');
    const status = clean(incident?.Status || incident?.IncidentType || 'active');
    const combined = `${title} ${note} ${status} ${incident?.IncidentType || ''}`;
    if (!title) continue;
    if (explicitNonUsOnly(combined) && source.regionScope !== 'global') {
      explicitNonUsCount += 1;
      continue;
    }
    if (informationalOnly(combined) || (/\binformational\b/i.test(String(incident?.IncidentType || '')) && !serviceImpact(combined))) {
      ignoredInformationalCount += 1;
      continue;
    }
    if (!serviceImpact(combined)) continue;

    const firstDetected = toIso(incident?.StartDate || incident?.DateCreated || updates.at(-1)?.at || '');
    const latestUpdate = toIso(incident?.DateUpdated || latest.at || incident?.DateCreated || incident?.StartDate || '');
    if (!incidentEvidenceIsCurrent({ title, note, status, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;
    incidents.push({
      id: String(incident?.Id || incident?.ExternalId || ''),
      title,
      note: note || '8x8 reports an active service-impacting incident.',
      status: status || 'active',
      firstDetected,
      latestUpdate,
      affectedService: /\bamericas\b/i.test(combined) ? 'Americas' : '8x8 services',
      color: statusCastColor(combined),
      url: incident?.ShortUrl || source.pageUrl || source.url,
      updates
    });
  }

  if (incidents.length) return { kind: 'issues', incidents: incidents.slice(0, 12), maintenance: [], components: [] };

  const overall = clean(`${json.Status || ''} ${json.StatusText || ''}`);
  if (/\b(?:available|operational|normal|informational|information)\b/i.test(overall)) {
    const suffix = ignoredInformationalCount
      ? '; current informational notices do not report service impact'
      : explicitNonUsCount
        ? '; no active US-relevant service incident is reported'
        : '';
    return {
      kind: 'healthy',
      status: `8x8 reports ${clean(json.StatusText || json.Status || 'normal service').toLowerCase()}${suffix}`,
      maintenance: [],
      components: []
    };
  }

  if (explicitNonUsCount === json.UnresolvedIncidents.length && explicitNonUsCount > 0) {
    return { kind: 'healthy', status: '8x8 reports no active US-relevant service incidents', maintenance: [], components: [] };
  }

  if (/\b(?:degraded|performance|outage|unavailable|disruption|issue)\b/i.test(overall)) {
    return {
      kind: 'component-state',
      status: clean(json.StatusText || json.Status),
      color: statusCastColor(overall),
      message: '8x8 StatusCast reports a current service-impacting state without a specific US incident record in the summary.',
      maintenance: [],
      components: [{ name: '8x8 service status', status: clean(json.Status || json.StatusText) }]
    };
  }

  return null;
}

function fireHydrantTimeline(incident) {
  const timeline = Array.isArray(incident?.timeline) ? incident.timeline : [];
  return timeline
    .map(event => {
      const details = event?.details && typeof event.details === 'object' ? event.details : {};
      const status = clean(details.currentMilestone || details.milestone || event?.type || incident?.currentMilestone || '');
      const note = clean(details.note || details.summary || details.description || event?.summary || event?.description || '');
      const at = toIso(event?.occurredAt || event?.time || event?.createdAt || event?.updatedAt || '');
      return { status, note, at };
    })
    .filter(update => update.status || update.note || update.at)
    .sort((a, b) => timeValue(b.at) - timeValue(a.at))
    .slice(0, 8);
}

function fireHydrantComponentConditions(incident) {
  const raw = incident?.componentConditions;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw).map(([name, status]) => ({ name: clean(name), status: clean(status) })).filter(item => item.name);
}

function fireHydrantColor(value) {
  const text = clean(value);
  return /\b(?:unavailable|offline|major|critical|complete outage|down)\b/i.test(text) ? 'red' : 'amber';
}

function fireHydrantMaintenanceOnly(title, note, status, components, timeline) {
  if (!/\bmaintenance\b/i.test(clean(`${title} ${status}`))) return false;
  if (components.some(component => componentStatusIsProblem(component.status))) return false;
  const explicitImpact = clean(`${title} ${note} ${status} ${(timeline || []).map(update => `${update.status} ${update.note}`).join(' ')}`);
  return !serviceImpact(explicitImpact);
}

function fireHydrantMaintenance(json, source = {}) {
  const records = Array.isArray(json?.scheduledMaintenances) ? json.scheduledMaintenances : [];
  return records.map(item => {
    const allComponents = item?.componentConditions && typeof item.componentConditions === 'object'
      ? Object.keys(item.componentConditions).map(clean).filter(Boolean)
      : [];
    const title = clean(item?.name || 'Backblaze scheduled maintenance');
    const note = clean(item?.summary || item?.description || '');
    if (!regionScopeRelevant(title, note + ' ' + allComponents.join(' '), source.regionScope || 'us')) return null;
    const components = source.regionScope === 'global' ? allComponents : allComponents.filter(name => regionScopeRelevant(name, '', source.regionScope || 'us'));
    return {
      id: String(item?.id || ''),
      title,
      note,
      status: timeValue(item?.startsAt) <= Date.now() && timeValue(item?.endsAt) >= Date.now() ? 'in_progress' : 'scheduled',
      startsAt: toIso(item?.startsAt || ''),
      endsAt: toIso(item?.endsAt || ''),
      latestUpdate: toIso(item?.updatedAt || item?.createdAt || ''),
      affectedService: components.join(', '),
      url: 'https://status.backblaze.com/'
    };
  }).filter(Boolean);
}

export function parseFireHydrantPayload(value, provider = {}, source = {}) {
  const json = safeJson(value);
  if (!json || typeof json !== 'object' || !json.config || !Array.isArray(json.components) || !json.conditions) return null;

  const rawIncidents = Array.isArray(json.incidents) ? json.incidents : [];
  const active = rawIncidents.filter(incident => !incident?.timestamps?.resolved && !/\bresolved\b/i.test(clean(incident?.currentMilestone || incident?.status || '')));
  const incidents = [];
  let explicitNonUsCount = 0;

  for (const incident of active) {
    const components = fireHydrantComponentConditions(incident);
    const componentText = components.map(item => `${item.name} ${item.status}`).join(' ');
    const title = clean(incident?.name || incident?.title || incident?.summary || '');
    const timeline = fireHydrantTimeline(incident);
    const latest = timeline[0] || {};
    const note = clean(latest.note || incident?.summary || incident?.description || '');
    const status = clean(latest.status || incident?.currentMilestone || incident?.status || 'active');
    const combined = `${title} ${note} ${status} ${componentText}`;
    if (explicitNonUsOnly(combined) && source.regionScope !== 'global') {
      explicitNonUsCount += 1;
      continue;
    }
    if (fireHydrantMaintenanceOnly(title, note, status, components, timeline)) continue;
    const firstDetected = toIso(incident?.timestamps?.started || incident?.startedAt || incident?.createdAt || timeline.at(-1)?.at || '');
    const latestUpdate = toIso(latest.at || incident?.updatedAt || incident?.timestamps?.started || '');
    if (!incidentEvidenceIsCurrent({ title, note, status, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;
    incidents.push({
      id: String(incident?.id || ''),
      title: title || `${provider.name || 'Backblaze'} service incident`,
      note: note || `${provider.name || 'Backblaze'} reports an active service incident.`,
      status: status || 'active',
      firstDetected,
      latestUpdate,
      affectedService: components.filter(item => regionScopeRelevant(item.name, item.status, source.regionScope || 'us')).map(item => item.name).join(', ') || provider.name || 'Backblaze services',
      color: fireHydrantColor(combined),
      url: source.pageUrl || source.url,
      updates: timeline
    });
  }

  const maintenance = fireHydrantMaintenance(json, source);
  const components = json.components.map(item => ({
    name: clean(item?.name || ''),
    status: clean(item?.customerCondition || item?.condition || item?.status || 'operational')
  })).filter(item => item.name && regionScopeRelevant(item.name, item.status, source.regionScope || 'us'));

  if (incidents.length) return { kind: 'issues', incidents: incidents.slice(0, 12), maintenance, components };
  if (explicitNonUsCount === active.length && active.length > 0) {
    return { kind: 'healthy', status: `${provider.name || 'Backblaze'} reports no active US-relevant service incidents`, maintenance, components };
  }

  const explicitProblems = components.filter(component => componentStatusIsProblem(component.status));
  if (explicitProblems.length) {
    const message = explicitProblems.map(component => `${component.name}: ${component.status}`).join('; ');
    return {
      kind: 'component-state',
      status: `${provider.name || 'Backblaze'} reports current component degradation`,
      color: fireHydrantColor(message),
      message,
      maintenance,
      components
    };
  }

  const operationalMessage = clean(json.config?.operationalMessage || '');
  if (/\b(?:all systems operational|nothing to report|all services operational|operating normally)\b/i.test(operationalMessage)) {
    return { kind: 'healthy', status: operationalMessage, maintenance, components };
  }

  if (rawIncidents.length === 0 && components.length > 0) {
    return { kind: 'healthy', status: `${provider.name || 'Backblaze'} reports no active service incidents`, maintenance, components };
  }

  return null;
}

export function parseProofpointCurrentIncidents(value, provider = {}) {
  const text = clean(value);
  if (!/\bProofpoint Current Incidents\b/i.test(text)) return null;
  if (/\bNo current identified incidents\b/i.test(text)) {
    return { kind: 'healthy', status: 'Proofpoint reports no current identified incidents', maintenance: [], components: [] };
  }
  if (/\b(?:communication error|page has an error|error loading|sorry to interrupt)\b/i.test(text) && !serviceImpact(text)) return null;

  const marker = text.search(/\bProofpoint Current Incidents\b/i);
  const current = marker >= 0 ? text.slice(marker + 'Proofpoint Current Incidents'.length, marker + 20000) : text;
  if (serviceImpact(current)) {
    const issue = /\b(?:major outage|partial outage|outage|unavailable|degrad(?:ed|ation|ing)|service disruption|performance issue|investigating|identified|monitoring)\b/i.exec(current);
    const excerpt = clean(current.slice(Math.max(0, (issue?.index || 0) - 600), Math.min(current.length, (issue?.index || 0) + 1800)));
    return {
      kind: 'component-state',
      status: 'Proofpoint reports current service-impacting incident activity',
      color: statusCastColor(current),
      message: excerpt || 'Proofpoint reports current service-impacting incident activity.',
      maintenance: [],
      components: [{ name: provider.name || 'Proofpoint', status: issue?.[0] || 'service impact' }]
    };
  }
  return null;
}

export function parseAuthenticatedStatusReference(value, provider = {}) {
  const text = clean(value);
  if (provider.id === 'crowdstrike') {
    const confirmsPortal = /Log in to the CrowdStrike Support portal/i.test(text);
    const confirmsAlerts = /subscribe to Tech Alerts/i.test(text);
    if (!confirmsPortal || !confirmsAlerts) return null;
    return {
      kind: 'access-gated',
      status: 'Current CrowdStrike service notices require authenticated Support Portal access',
      message: 'CrowdStrike confirms that technical support and Tech Alerts are delivered through its authenticated Support Portal. The public source confirms the current official access path; no Falcon operational conclusion is inferred from the public page.'
    };
  }
  if (provider.id === 'intermedia') {
    const confirmsStatus = /System Status/i.test(text);
    const confirmsLogin = /status dashboard can be seen on the homepage of your control panel when you log in/i.test(text);
    if (!confirmsStatus || !confirmsLogin) return null;
    return {
      kind: 'access-gated',
      status: 'Current Intermedia system status requires authenticated HostPilot access',
      message: 'Intermedia confirms that its system-status dashboard is displayed after logging in to HostPilot. The public support page confirms the current official access path; no Intermedia operational conclusion is inferred from the public page.'
    };
  }
  return null;
}

export function parsePayPalProductionStatus(value) {
  const text = clean(value);
  if (!/\bPayPal Status Page\b/i.test(text) || !/\bProduction Sandbox Services\b/i.test(text)) return null;

  const subscribeAnchor = text.search(/\bProduction Sandbox\s+Subscribe\b/i);
  const productionAnchor = text.search(/\bProduction Sandbox\b/i);
  const servicesAnchor = text.search(/\bProduction Sandbox Services\b/i);
  const start = subscribeAnchor >= 0 ? subscribeAnchor : productionAnchor >= 0 ? productionAnchor : servicesAnchor;
  const end = text.search(/\bView history\b/i);
  const currentSection = start >= 0 ? text.slice(start, end > start ? end : start + 12000) : text.slice(0, 12000);
  const legend = currentSection.search(/\bOperational\s+Major Outage\s+Degraded Performance\s+Maintenance\s+Bulletin\b/i);
  const statusSection = legend > 0 ? currentSection.slice(0, legend) : currentSection;

  if (/\bAll Production Systems Operational\b/i.test(statusSection)) {
    return {
      kind: 'healthy',
      status: 'All Production Systems Operational',
      components: [{ name: 'PayPal Production', status: 'Operational' }],
      maintenance: []
    };
  }

  const explicit = /\b(?:Production Systems? (?:Degraded|Unavailable)|Service (?:Outage|Disruption)|Major Outage|Degraded Performance|Partial Outage)\b/i.exec(statusSection);
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

export function fullReviewConclusion(provider, value) {
  const source = fullReviewOverrides[provider?.id];
  if (!source) return null;
  if (provider.id === 'kaseya' || provider.id === 'lastpass' || provider.id === 'stripe') return parseStatuspageSummary(value, provider, source);
  if (provider.id === 'paypal') return parsePayPalProductionStatus(value);
  if (provider.id === '8x8') return parseStatusCastSummary(value, provider, source);
  if (provider.id === 'proofpoint') return parseProofpointCurrentIncidents(value, provider);
  if (provider.id === 'backblaze') return parseFireHydrantPayload(value, provider, source);
  if (provider.id === 'crowdstrike' || provider.id === 'intermedia') return parseAuthenticatedStatusReference(value, provider);
  return null;
}