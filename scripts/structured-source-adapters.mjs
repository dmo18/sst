import { INCIDENT_MAX_AGE_DAYS, incidentEvidenceIsCurrent } from './incident-freshness.mjs';

const STATUSPAGE_SUFFIX = '/api/v2/summary.json';

function clean(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/?(?:article|section|main|header|footer|div|p|h[1-6]|li|ul|ol|table|tr|td|th|br|details|summary)[^>]*>/gi, '\n')
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

function textLines(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/?(?:article|section|main|header|footer|div|p|h[1-6]|li|ul|ol|table|tr|td|th|br|details|summary)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

const globalRegionPattern = /\b(?:global|worldwide|all regions|all customers|multiple regions|across regions)\b/i;
const usRegionPattern = /\b(?:united states|u\.s\.|usa|us|north america|americas|us customers?|us cells?|us[- ](?:east|west|central|north|south)(?:[- ]\d+)?|us(?:e|w|c)\d+)\b/i;
const nonUsRegionPattern = /\b(?:emea|europe|european|eu(?:rope)?(?:[- ]?(?:cell|region|zone))?[- ]?\d*|uk(?:[- ]?(?:cell|region|zone))?[- ]?\d*|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|germany|france|spain|japan|singapore|india|brazil|china|beijing|hong kong|korea|dubai|uae|istanbul|türkiye|turkey|london|amsterdam|berlin|tokyo|sydney|frankfurt|paris|madrid|milan|warsaw|stockholm|kochi|kuala lumpur)\b|\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)\d+(?:[-_a-z0-9]*)\b/i;

function isUsRelevant(title, note = '', scope = '') {
  if (scope === 'global') return true;
  const heading = clean(title);
  const details = clean(note).slice(0, 1800);
  if (globalRegionPattern.test(heading) || usRegionPattern.test(heading)) return true;
  if (nonUsRegionPattern.test(heading)) return false;
  if (globalRegionPattern.test(details) || usRegionPattern.test(details)) return true;
  return !nonUsRegionPattern.test(details);
}

function isGenericTitle(value) {
  const title = clean(value).toLowerCase().replace(/[.:\-]+$/g, '').trim();
  return /^(?:active incidents?|incident|service incident|status|status update|current status|degraded service|partial outage|major outage|report issue|this is a scheduled event|[^\n]{2,180} public status(?: page)? reports an active issue)$/i.test(title);
}

function isEditorial(title, note) {
  const text = `${clean(title)} ${clean(note)}`;
  const editorial = /\b(?:q[1-4]\s+wrap[- ]?up|quarter(?:ly)?\s+(?:wrap[- ]?up|review)|wrap[- ]?up|release notes?|what'?s new|new features?|feature release|general availability|product update|roadmap|advance notice|broader coverage|faster investigation|partner operations)\b/i.test(text);
  const impact = /\b(?:outage|unavailable|service down|degrad(?:ed|ation|ing)|disruption|elevated errors?|failed requests?|connection failures?|customers? (?:are|is) (?:currently )?(?:affected|impacted|unable|experiencing))\b/i.test(text);
  return editorial && !impact;
}

function isPlannedOnly(title, note, status = '') {
  const text = `${clean(title)} ${clean(note)} ${clean(status)}`;
  const planned = /\b(?:this is a scheduled event|scheduled event|scheduled maintenance|planned maintenance|maintenance window|will be performing (?:scheduled )?maintenance)\b/i.test(text);
  const escalated = /\b(?:unplanned|emergency|critical incident|major service outage|widespread outage|complete outage|unexpected outage)\b/i.test(text)
    || (/\b(?:investigating|identified|monitoring)\b/i.test(text)
      && /\b(?:customers?|users?)\s+(?:are|is)\s+(?:currently\s+)?(?:experiencing|unable|affected|impacted)\b/i.test(text));
  return planned && !escalated;
}

function colorFor(value, impact = '') {
  return /\b(?:critical|major|major outage|complete outage|service down|unavailable|downtime)\b/i.test(`${impact} ${value}`) ? 'red' : 'amber';
}

function uniqueNames(values, limit = 8) {
  const names = [...new Set(values.map(clean).filter(Boolean))];
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} +${names.length - limit} more`;
}

function safeJson(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return null;
  }
}

function toIso(value) {
  const normalized = clean(value)
    .replace(/(\d)(AM|PM)\b/i, '$1 $2')
    .replace(/\bEDT\b/i, 'GMT-0400')
    .replace(/\bEST\b/i, 'GMT-0500')
    .replace(/\bUTC\b/i, 'GMT+0000');
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function boundedUpdates(values) {
  return (Array.isArray(values) ? [...values] : [])
    .sort((a, b) => Date.parse(b?.updated_at || b?.created_at || b?.display_at || b?.published_at || '') - Date.parse(a?.updated_at || a?.created_at || a?.display_at || a?.published_at || ''))
    .slice(0, 8)
    .map(update => ({
      status: clean(update?.status || ''),
      note: clean(update?.body || update?.message || update?.description || ''),
      at: update?.updated_at || update?.created_at || update?.display_at || update?.published_at || ''
    }))
    .filter(update => update.note || update.status || update.at);
}

function componentRecords(values) {
  const records = [];
  const seen = new Set();
  for (const component of Array.isArray(values) ? values : []) {
    const name = clean(component?.name || component?.display_name || component?.public_name || component?.id);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    records.push({
      name,
      status: clean(component?.status || component?.state || 'unknown').toLowerCase().replace(/\s+/g, '_'),
      group: clean(component?.group_name || component?.group || component?.group_id || '')
    });
    if (records.length >= 36) break;
  }
  return records;
}

function maintenanceState(value) {
  const status = clean(value).toLowerCase();
  if (/in[_ -]?progress|ongoing|underway|started/.test(status)) return 'in_progress';
  if (/completed|resolved|cancelled|canceled|finished/.test(status)) return 'completed';
  if (/scheduled|planned|upcoming|not[_ -]?started|maintenance/.test(status)) return 'scheduled';
  return 'unknown';
}

function statuspageSource(url, name, regionScope = 'us') {
  const pageUrl = url.endsWith(STATUSPAGE_SUFFIX) ? `${url.slice(0, -STATUSPAGE_SUFFIX.length)}/` : url;
  return {
    mode: 'statuspage-json',
    url,
    pageUrl,
    feedCandidates: [new URL('history.rss', pageUrl).href, new URL('history.atom', pageUrl).href],
    sourceName: `${name} official Statuspage JSON`,
    regionScope
  };
}

const statuspageCandidates = {
  cloudflare: ['https://www.cloudflarestatus.com/api/v2/summary.json', 'Cloudflare'],
  openai: ['https://status.openai.com/api/v2/summary.json', 'OpenAI'],
  anthropic: ['https://status.claude.com/api/v2/summary.json', 'Anthropic'],
  sentinelone: ['https://status.sentinelone.com/api/v2/summary.json', 'SentinelOne'],
  dnsfilter: ['https://status.dnsfilter.com/api/v2/summary.json', 'DNSFilter'],
  ninjaone: ['https://status.ninjaone.com/api/v2/summary.json', 'NinjaOne'],
  meraki: ['https://status.meraki.net/api/v2/summary.json', 'Cisco Meraki'],
  ubiquiti: ['https://status.ui.com/api/v2/summary.json', 'Ubiquiti'],
  digitalocean: ['https://status.digitalocean.com/api/v2/summary.json', 'DigitalOcean'],
  lumen: ['https://lumen.statuspage.io/api/v2/summary.json', 'Lumen'],
  dropbox: ['https://status.dropbox.com/api/v2/summary.json', 'Dropbox'],
  box: ['https://status.box.com/api/v2/summary.json', 'Box'],
  wasabi: ['https://status.wasabi.com/api/v2/summary.json', 'Wasabi'],
  zoom: ['https://www.zoomstatus.com/api/v2/summary.json', 'Zoom'],
  '1password': ['https://status.1password.com/api/v2/summary.json', '1Password'],
  duo: ['https://status.duo.com/api/v2/summary.json', 'Duo'],
  jumpcloud: ['https://status.jumpcloud.com/api/v2/summary.json', 'JumpCloud'],
  auth0: ['https://status.auth0.com/api/v2/summary.json', 'Auth0'],
  lastpass: ['https://status.lastpass.com/api/v2/summary.json', 'LastPass'],
  jamf: ['https://status.jamf.com/api/v2/summary.json', 'Jamf'],
  addigy: ['https://status.addigy.com/api/v2/summary.json', 'Addigy'],
  atera: ['https://status.atera.com/api/v2/summary.json', 'Atera'],
  huntress: ['https://status.huntress.com/api/v2/summary.json', 'Huntress'],
  eset: ['https://status.eset.com/api/v2/summary.json', 'ESET'],
  mimecast: ['https://status.mimecast.com/api/v2/summary.json', 'Mimecast'],
  barracuda: ['https://status.barracuda.com/api/v2/summary.json', 'Barracuda'],
  knowbe4: ['https://status.knowbe4.com/api/v2/summary.json', 'KnowBe4'],
  sharefile: ['https://status.sharefile.com/api/v2/summary.json', 'ShareFile'],
  ultradns: ['https://status.ultradns.com/api/v2/summary.json', 'UltraDNS'],
  godaddy: ['https://status.godaddy.com/api/v2/summary.json', 'GoDaddy'],
  linode: ['https://status.linode.com/api/v2/summary.json', 'Linode'],
  vercel: ['https://status.vercel.com/api/v2/summary.json', 'Vercel'],
  nextiva: ['https://status.nextiva.com/api/v2/summary.json', 'Nextiva'],
  twilio: ['https://status.twilio.com/api/v2/summary.json', 'Twilio'],
  discord: ['https://discordstatus.com/api/v2/summary.json', 'Discord'],
  'elastic-cloud': ['https://status.elastic.co/api/v2/summary.json', 'Elastic Cloud'],
  hubspot: ['https://status.hubspot.com/api/v2/summary.json', 'HubSpot'],
  notion: ['https://status.notion.so/api/v2/summary.json', 'Notion'],
  asana: ['https://status.asana.com/api/v2/summary.json', 'Asana'],
  'monday-com': ['https://status.monday.com/api/v2/summary.json', 'monday.com'],
  docusign: ['https://status.docusign.com/api/v2/summary.json', 'DocuSign']
};

export const structuredSourceOverrides = Object.fromEntries(
  Object.entries(statuspageCandidates).map(([id, [url, name]]) => [id, statuspageSource(url, name)])
);

structuredSourceOverrides.superops = {
  mode: 'betterstack-json',
  url: 'https://status.superops.com/index.json',
  pageUrl: 'https://status.superops.com/',
  feedCandidates: ['https://status.superops.com/feed'],
  sourceName: 'SuperOps official Better Stack JSON',
  regionScope: 'us'
};

structuredSourceOverrides.connectwise = {
  mode: 'statusio-html',
  url: 'https://status.connectwise.com/',
  sourceName: 'ConnectWise official Status.io page',
  render: true,
  regionScope: 'us'
};

structuredSourceOverrides.halopsa = {
  mode: 'statusio-html',
  url: 'https://status.haloservicesolutions.com/',
  sourceName: 'HaloPSA official Status.io page',
  render: true,
  regionScope: 'us'
};

export function parseStatuspageSummary(value, provider = {}, source = {}) {
  const json = safeJson(value);
  if (!json || typeof json !== 'object' || !Array.isArray(json.incidents) || !json.status) return null;

  const components = componentRecords(json.components)
    .filter(component => isUsRelevant(component.name, component.group || '', source.regionScope));
  const unresolved = json.incidents.filter(incident => !/^(?:resolved|completed|closed|postmortem|cancelled)$/i.test(String(incident?.status || '')));
  const incidents = [];
  let staleIncidentCount = 0;

  for (const incident of unresolved) {
    const updates = boundedUpdates(incident.incident_updates);
    const latest = updates[0] || {};
    const title = clean(incident.name || incident.title);
    const note = clean(latest.note || incident.body || incident.description).slice(0, 900);
    const status = clean(incident.status || latest.status || 'active');
    const affectedComponents = [
      ...(Array.isArray(incident.components) ? incident.components : []),
      ...(Array.isArray(incident?.incident_updates?.[0]?.affected_components) ? incident.incident_updates[0].affected_components : [])
    ];
    const affectedService = uniqueNames(affectedComponents.map(component => component?.name || component?.display_name || component?.id));
    const regionText = `${affectedService} ${affectedComponents.map(component => `${component?.group_id || ''} ${component?.description || ''}`).join(' ')}`;
    if (!title || isGenericTitle(title) || isEditorial(title, note) || isPlannedOnly(title, note, status)) continue;
    if (!isUsRelevant(title, `${note} ${regionText}`, source.regionScope)) continue;
    const firstDetected = incident.started_at || incident.created_at || updates.at(-1)?.at || '';
    const latestUpdate = incident.updated_at || latest.at || firstDetected;
    if (!incidentEvidenceIsCurrent({ title, note, status, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) {
      staleIncidentCount += 1;
      continue;
    }
    incidents.push({
      id: String(incident.id || ''),
      title,
      note: note || `${status} update from the official status page.`,
      status,
      firstDetected,
      latestUpdate,
      affectedService,
      color: colorFor(`${title} ${note}`, incident.impact),
      url: incident.shortlink || incident.incident_url || incident.html_url || json.page?.url || source.pageUrl || source.url,
      updates
    });
  }

  const maintenance = [];
  for (const event of Array.isArray(json.scheduled_maintenances) ? json.scheduled_maintenances : []) {
    const status = maintenanceState(event.status);
    if (status === 'completed') continue;
    const updates = boundedUpdates(event.incident_updates);
    const latest = updates[0] || {};
    const title = clean(event.name || event.title || 'Scheduled maintenance');
    const note = clean(latest.note || event.body || event.description || 'The provider has scheduled maintenance.').slice(0, 900);
    const affectedComponents = Array.isArray(event.components) ? event.components : [];
    const affectedService = uniqueNames(affectedComponents.map(component => component?.name || component?.display_name || component?.id));
    if (!title || isEditorial(title, note)) continue;
    if (!isUsRelevant(title, `${note} ${affectedService}`, source.regionScope)) continue;
    maintenance.push({
      id: String(event.id || ''),
      title,
      note,
      status,
      startsAt: event.scheduled_for || event.starts_at || event.created_at || '',
      endsAt: event.scheduled_until || event.ends_at || '',
      announcedAt: event.created_at || updates.at(-1)?.at || '',
      latestUpdate: event.updated_at || latest.at || event.created_at || '',
      affectedService,
      url: event.shortlink || event.incident_url || event.html_url || json.page?.url || source.pageUrl || source.url,
      updates
    });
  }

  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  if (staleIncidentCount) return { kind: 'limited', message: `${provider.name || 'Provider'} lists ${staleIncidentCount} unresolved incident record${staleIncidentCount === 1 ? '' : 's'} without an official update in the last ${INCIDENT_MAX_AGE_DAYS} days. The records were not presented as current.`, ...extras };
  if (unresolved.length) return { kind: 'healthy', status: `${provider.name || 'Provider'} reports no active US-relevant incidents`, ...extras };
  const indicator = String(json.status?.indicator || '').toLowerCase();
  if (indicator === 'none') return { kind: 'healthy', status: clean(json.status?.description) || `${provider.name || 'Provider'} reports all systems operational`, ...extras };
  return null;
}

function relationshipIds(record, name) {
  const data = record?.relationships?.[name]?.data;
  if (!Array.isArray(data)) return [];
  return data.map(item => String(item?.id || '')).filter(Boolean);
}

export function parseBetterStackIndex(value, provider = {}, source = {}) {
  const json = safeJson(value);
  if (!json || typeof json !== 'object' || !json.data?.attributes || !Array.isArray(json.included)) return null;

  const resources = new Map(json.included.filter(item => item?.type === 'status_page_resource').map(item => [String(item.id), item.attributes || {}]));
  const components = componentRecords([...resources.entries()].map(([id, attributes]) => ({ id, name: attributes.public_name, status: attributes.status })))
    .filter(component => isUsRelevant(component.name, component.group || '', source.regionScope));
  const updates = new Map(json.included.filter(item => item?.type === 'status_update').map(item => [String(item.id), item.attributes || {}]));
  const reports = json.included.filter(item => item?.type === 'status_report');
  const incidents = [];
  const maintenance = [];
  let staleReportCount = 0;

  for (const report of reports) {
    const attributes = report.attributes || {};
    const reportUpdates = relationshipIds(report, 'status_updates')
      .map(id => ({ id, ...(updates.get(id) || {}) }))
      .sort((a, b) => Date.parse(b.published_at || '') - Date.parse(a.published_at || ''));
    const timeline = boundedUpdates(reportUpdates);
    const latest = reportUpdates[0] || {};
    const affected = Array.isArray(latest.affected_resources) && latest.affected_resources.length
      ? latest.affected_resources
      : Array.isArray(attributes.affected_resources) ? attributes.affected_resources : [];
    const affectedService = uniqueNames(affected.map(item => resources.get(String(item.status_page_resource_id))?.public_name || item.status_page_resource_id));
    const title = clean(attributes.title);
    const note = clean(latest.message || attributes.message || attributes.description || '').slice(0, 900);
    if (!title || isEditorial(title, note) || !isUsRelevant(title, `${note} ${affectedService}`, source.regionScope)) continue;

    const reportType = String(attributes.report_type || '').toLowerCase();
    const aggregate = String(attributes.aggregate_state || '').toLowerCase();
    if (reportType === 'maintenance' || aggregate === 'maintenance') {
      if (attributes.ends_at && Date.parse(attributes.ends_at) < Date.now() - 15 * 60 * 1000) continue;
      maintenance.push({
        id: String(report.id || ''),
        title,
        note: note || 'The provider has scheduled maintenance.',
        status: maintenanceState(attributes.status || aggregate || reportType),
        startsAt: attributes.starts_at || attributes.created_at || '',
        endsAt: attributes.ends_at || '',
        announcedAt: attributes.created_at || timeline.at(-1)?.at || '',
        latestUpdate: latest.published_at || attributes.updated_at || attributes.starts_at || '',
        affectedService,
        url: source.pageUrl || source.url,
        updates: timeline
      });
      continue;
    }

    if (attributes.ends_at || !['degraded', 'downtime'].includes(aggregate)) continue;
    if (isGenericTitle(title) || isPlannedOnly(title, note, reportType)) continue;
    const firstDetected = attributes.starts_at || attributes.created_at || '';
    const latestUpdate = latest.published_at || attributes.updated_at || firstDetected;
    if (!incidentEvidenceIsCurrent({ title, note, status: latest.status || aggregate, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) {
      staleReportCount += 1;
      continue;
    }
    incidents.push({
      id: String(report.id || ''),
      title,
      note: note || 'The official status page reports an active service issue.',
      status: clean(latest.status || attributes.aggregate_state || 'active'),
      firstDetected,
      latestUpdate,
      affectedService,
      color: aggregate === 'downtime' ? 'red' : 'amber',
      url: source.pageUrl || source.url,
      updates: timeline
    });
  }

  const extras = { maintenance, components };
  if (incidents.length) return { kind: 'issues', incidents, ...extras };
  const aggregate = String(json.data.attributes.aggregate_state || '').toLowerCase();
  if (staleReportCount && !['operational', 'maintenance'].includes(aggregate)) return { kind: 'limited', message: `${provider.name || 'Provider'} has unresolved structured records without a recent official update. They were not presented as current.`, ...extras };
  if (aggregate === 'operational' || aggregate === 'maintenance') {
    return { kind: 'healthy', status: aggregate === 'maintenance' ? `${provider.name || 'Provider'} reports scheduled maintenance only` : `${provider.name || json.data.attributes.company_name || 'Provider'} reports all systems operational`, ...extras };
  }
  return null;
}

const STATUS_LINE = /^(Investigating|Identified|Monitoring|Update|In progress|Degraded Performance|Partial Outage|Major Outage|Resolved|Completed)\s*(?:[-:]\s*(.*))?$/i;
const DATE_LINE = /^(?:[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}(?:AM|PM)?\s+(?:EDT|EST|UTC)|[A-Z][a-z]{2}\s+\d{1,2},\s+\d{1,2}:\d{2}\s+UTC)$/i;
const TITLE_NOISE = /^(?:status|active incident|active incidents?|incident status|components?|locations?|updated a few seconds ago|scheduled maintenance|past incidents?|incident history|subscribe)$/i;

export function parseStatusioPage(value, provider = {}, source = {}) {
  const lines = textLines(value);
  const pageBoundary = lines.findIndex(line => /^(?:scheduled maintenance|past incidents?|incident history)$/i.test(line));
  const current = pageBoundary >= 0 ? lines.slice(0, pageBoundary) : lines.slice(0, 1200);
  const markers = current.map((line, index) => /^active incident$/i.test(line) ? index : -1).filter(index => index >= 0);
  if (!markers.length) {
    if (current.some(line => /all systems operational|0 active incidents?/i.test(line))) return { kind: 'healthy', status: `${provider.name || 'Provider'} reports all systems operational`, maintenance: [], components: [] };
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
      if (!candidate || TITLE_NOISE.test(candidate) || DATE_LINE.test(candidate) || STATUS_LINE.test(candidate) || /^(?:operational|degraded performance|partial outage|major outage)$/i.test(candidate)) continue;
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
    const componentNames = componentsIndex >= 0 ? segment.slice(componentsIndex + 1, componentEnd).filter(line => !TITLE_NOISE.test(line)) : [];
    const locations = locationsIndex >= 0 ? segment.slice(locationsIndex + 1, locationEnd).filter(line => !TITLE_NOISE.test(line)) : [];
    const dates = segment.filter(line => DATE_LINE.test(line)).map(toIso).filter(Boolean).sort();
    const lifecycle = lifecycleIndex >= 0 ? clean(segment[lifecycleIndex]) : clean(segment[severityIndex] || 'active');
    const noteStart = lifecycleIndex >= 0 ? lifecycleIndex + 1 : Math.max(severityIndex + 1, firstDateIndex + 1);
    const note = clean(segment.slice(noteStart).filter(line => !DATE_LINE.test(line) && !TITLE_NOISE.test(line)).join(' ')).slice(0, 900);
    const affectedService = uniqueNames([...componentNames, ...locations]);
    if (isEditorial(title, note) || isPlannedOnly(title, note, lifecycle)) continue;
    if (!isUsRelevant(title, `${note} ${locations.join(' ')}`, source.regionScope)) {
      foundNonUsIncident = true;
      continue;
    }
    const firstDetected = dates[0] || '';
    const latestUpdate = dates.at(-1) || dates[0] || '';
    if (!incidentEvidenceIsCurrent({ title, note, status: lifecycle, firstDetected, latestUpdate }, Date.now(), INCIDENT_MAX_AGE_DAYS, { requireTimestamp: true })) continue;
    incidents.push({
      title,
      note: note || `${lifecycle} update from the official status page.`,
      status: lifecycle.toLowerCase(),
      firstDetected,
      latestUpdate,
      affectedService,
      color: colorFor(`${segment[severityIndex] || ''} ${lifecycle} ${title} ${note}`),
      url: source.url,
      updates: [{ status: lifecycle.toLowerCase(), note: note || `${lifecycle} update from the official status page.`, at: dates.at(-1) || dates[0] || '' }]
    });
  }
  if (incidents.length) return { kind: 'issues', incidents, maintenance: [], components: [] };
  if (foundSpecificIncident && foundNonUsIncident) return { kind: 'healthy', status: `${provider.name || 'Provider'} reports no active US-relevant incidents`, maintenance: [], components: [] };
  return null;
}

export function structuredSourceConclusion(provider, value, source = {}) {
  const mode = source.mode || structuredSourceOverrides[provider?.id]?.mode || '';
  if (mode === 'statuspage-json') return parseStatuspageSummary(value, provider, { ...structuredSourceOverrides[provider?.id], ...source });
  if (mode === 'betterstack-json') return parseBetterStackIndex(value, provider, { ...structuredSourceOverrides[provider?.id], ...source });
  if (mode === 'statusio-html') return parseStatusioPage(value, provider, { ...structuredSourceOverrides[provider?.id], ...source });
  return null;
}
