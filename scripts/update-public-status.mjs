import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activeIncident,
  colorFromText,
  compareSnapshots,
  fetchSource,
  safeIncidentUrl,
  summarizeProviders,
  validatePayload
} from './update-status.mjs';
import {
  additionalPublicOverrides,
  providerSpecificConclusion,
  renderPublicPage
} from './public-source-repairs.mjs';
import { isEditorialIncidentEntry, isGenericIncidentTitle, isIncidentUsRelevant } from './incident-detail-repairs.mjs';
import { INCIDENT_MAX_AGE_DAYS, dateLikeIncidentTitle, incidentEvidenceIsCurrent } from './incident-freshness.mjs';
import {
  enrichProviderHistory,
  maintenanceIsRelevant,
  normalizeMaintenanceState,
  schemaFingerprint,
  sourceEvidence,
  sourceIntelligenceChanges
} from './source-intelligence.mjs';
import { buildCollectionIntelligence, collectWithBudgets } from './collection-intelligence.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalogPath = path.join(root, 'config', 'providers.json');
const consolidationPath = path.join(root, 'config', 'provider-consolidation.json');
const publicStatusPath = path.join(root, 'public', 'status.json');
const previousStatusPath = path.join(root, 'public', 'previous-status.json');
const collectionLimits = Object.freeze({ globalLimit: 10, perOriginLimit: 2 });
const severityRank = { red: 4, amber: 3, blue: 2, green: 1 };

const publicOverrides = {
  microsoft365: {
    mode: 'feed',
    url: 'https://status.cloud.microsoft/api/feed/mac',
    pageUrl: 'https://status.cloud.microsoft/',
    sourceName: 'Microsoft 365 public RSS',
    maxAgeHours: 336,
    allowEmpty: true,
    confirmHealthyFromFeed: true
  },
  entra: {
    mode: 'feed',
    url: 'https://rssfeed.azure.status.microsoft/en-us/status/feed/',
    pageUrl: 'https://azure.status.microsoft/en-us/status',
    sourceName: 'Azure public status RSS',
    maxAgeHours: 336,
    includePattern: /Microsoft Entra ID|Azure Active Directory|\bEntra\b|identity|authentication|sign-?in/i
  },
  'google-workspace': {
    mode: 'feed',
    url: 'https://www.google.com/appsstatus/dashboard/en/feed.atom',
    pageUrl: 'https://www.google.com/appsstatus/dashboard/',
    sourceName: 'Google Workspace public Atom feed',
    maxAgeHours: 336,
    confirmHealthyFromFeed: true
  },
  'google-cloud': {
    mode: 'feed',
    url: 'https://status.cloud.google.com/en/feed.atom',
    pageUrl: 'https://status.cloud.google.com/',
    sourceName: 'Google Cloud public Atom feed',
    maxAgeHours: 336,
    confirmHealthyFromFeed: true
  },
  slack: {
    mode: 'feed',
    url: 'https://slack-status.com/feed/rss',
    pageUrl: 'https://slack-status.com/',
    sourceName: 'Slack public RSS',
    maxAgeHours: 336,
    confirmHealthyFromFeed: true
  },
  halopsa: {
    mode: 'status-html',
    url: 'https://status.haloservicesolutions.com/',
    sourceName: 'HaloPSA public status page'
  },
  connectwise: {
    mode: 'status-html',
    url: 'https://status.connectwise.com/',
    sourceName: 'ConnectWise public status page'
  },
  'quickbooks-online': {
    mode: 'status-html',
    url: 'https://status.quickbooks.intuit.com/',
    feedCandidates: [
      'https://status.quickbooks.intuit.com/history.rss',
      'https://status.quickbooks.intuit.com/history.atom'
    ],
    sourceName: 'QuickBooks public status page'
  },
  salesforce: {
    mode: 'status-html',
    url: 'https://status.salesforce.com/current',
    sourceName: 'Salesforce Trust public status page'
  }
};

Object.assign(publicOverrides, additionalPublicOverrides);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

export function canonicalizeProviderCatalog(catalog, consolidation = readJson(consolidationPath)) {
  const excluded = new Set(consolidation?.excludedProviderIds || []);
  const overrides = consolidation?.providerOverrides || {};
  return catalog
    .filter(provider => !excluded.has(provider.id))
    .map(provider => ({ ...provider, ...(overrides[provider.id] || {}) }));
}

export function decodeEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)));
}

export function cleanText(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIncidentTitle(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b(?:update|resolved|monitoring|investigating|identified|completed|scheduled|maintenance)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableHash(value) {
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
  return `${slug}-${stableHash(signature)}`;
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toISOString().slice(5, 16).replace('T', ' ');
}

function boundedTimeline(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => ({
      status: cleanText(value?.status || ''),
      note: cleanText(value?.note || value?.body || value?.message || ''),
      at: value?.at || value?.updated_at || value?.created_at || value?.published_at || ''
    }))
    .filter(value => value.status || value.note || value.at)
    .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
    .slice(0, 8);
}

function affectedServiceForIncident(provider, title, note) {
  if (provider.id !== 'kaseya') return (provider.services || []).join(', ');
  const text = `${title || ''} ${note || ''}`;
  const mappings = [
    [/\bautotask\b/i, 'Autotask PSA'],
    [/\bdatto rmm\b|\brmm\b/i, 'Datto RMM'],
    [/\bsaas protection\b|\bbackupify\b/i, 'Datto SaaS Protection'],
    [/\bbcdr\b|\bbusiness continuity\b|\bcontinuity\b/i, 'Datto BCDR'],
    [/\bkaseya vsa\b|\bvsa\b/i, 'Kaseya VSA'],
    [/\bkaseya bms\b|\bbms\b/i, 'Kaseya BMS']
  ];
  const matches = mappings.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
  return matches.length ? [...new Set(matches)].join(', ') : (provider.services || []).join(', ');
}

function makeIncident(provider, source, item) {
  const title = cleanText(item.title || 'Service incident');
  const color = item.color === 'red' ? 'red' : 'amber';
  const serviceState = color === 'red' ? 'major' : 'degraded';
  const latestUpdate = item.latestUpdate || item.latest_update || item.firstDetected || item.time || '';
  const firstDetected = item.firstDetected || item.first_detected || latestUpdate;
  const vendorId = cleanText(item.id || '');
  return {
    id: `${provider.id}:${vendorId || normalizeIncidentTitle(title) || title.toLowerCase()}`,
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title,
    note: cleanText(item.note || 'The official public source reports a service issue.'),
    source: source.sourceName || source.mode,
    url: safeIncidentUrl(item.url || source.pageUrl || source.url, source.url),
    time: shortTime(latestUpdate),
    rawTime: latestUpdate,
    status: item.status || '',
    color,
    service_state: serviceState,
    attention: serviceState === 'major' ? 'critical' : 'action',
    priority: provider.priority || 0,
    first_detected: firstDetected,
    latest_update: latestUpdate,
    client_impact: provider.client_impact,
    technician_action: provider.technician_action,
    affected_service: item.affectedService || item.affected_service || affectedServiceForIncident(provider, title, item.note),
    updates: boundedTimeline(item.updates)
  };
}

export function makeMaintenance(provider, source, item) {
  const title = cleanText(item.title || 'Scheduled maintenance');
  const token = maintenanceToken(source, item, title);
  const status = normalizeMaintenanceState(item.status || 'scheduled');
  return {
    id: `${provider.id}:${token}:maintenance`,
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title,
    note: cleanText(item.note || 'The official source reports planned maintenance.'),
    source: source.sourceName || source.mode,
    url: safeIncidentUrl(item.url || source.pageUrl || source.url, source.url),
    status,
    starts_at: item.startsAt || item.starts_at || '',
    ends_at: item.endsAt || item.ends_at || '',
    announced_at: item.announcedAt || item.announced_at || '',
    latest_update: item.latestUpdate || item.latest_update || item.announcedAt || '',
    affected_service: item.affectedService || item.affected_service || (provider.services || []).join(', '),
    priority: provider.priority || 0,
    attention: status === 'in_progress' ? 'action' : 'watch',
    updates: boundedTimeline(item.updates)
  };
}

export function dedupeMaintenanceRecords(items) {
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

function providerStatus(provider, source, status, color, ok, message, logs, incidents = [], maintenance = [], sourceState, extras = {}) {
  const serviceState = color === 'red' ? 'major' : color === 'amber' ? 'degraded' : color === 'green' ? 'operational' : 'unknown';
  const resolvedSourceState = sourceState || (!ok ? 'unavailable' : color === 'blue' ? 'limited' : 'available');
  const critical = provider.criticality === 'high' || (provider.priority || 0) >= 85;
  const attention = serviceState === 'major'
    ? 'critical'
    : serviceState === 'degraded'
      ? 'action'
      : serviceState === 'unknown'
        ? 'watch'
        : resolvedSourceState === 'unavailable' && critical
          ? 'action'
          : ['limited', 'unavailable', 'stale'].includes(resolvedSourceState)
            ? 'watch'
            : 'informational';
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status,
    color,
    service_state: serviceState,
    source_state: resolvedSourceState,
    attention,
    message: message || '',
    ok,
    source: source.url,
    priority: provider.priority || 0,
    criticality: provider.criticality,
    tags: provider.tags || [],
    services: provider.services || [],
    client_impact: provider.client_impact,
    technician_action: provider.technician_action,
    checked_at: new Date().toISOString(),
    source_type: source.mode,
    download_log: logs,
    incidents,
    maintenance,
    component_status: extras.components || [],
    schema_fingerprint: extras.schemaFingerprint || '',
    ...(extras.healthAccess ? { health_access: extras.healthAccess } : {}),
    ...(typeof extras.healthObservable === 'boolean' ? { health_observable: extras.healthObservable } : {}),
    ...sourceEvidence(source.mode, resolvedSourceState, ok)
  };
}

function logEntry(source, ok, status, message, error = '') {
  const now = new Date().toISOString();
  return {
    timestamp: now,
    completed_at: now,
    duration_ms: 0,
    url: source.url,
    source_type: source.mode,
    ok,
    status,
    message,
    error
  };
}

export function publicPageUrl(value) {
  const url = new URL(value);
  if (/\/api\/v2\/summary\.json$/i.test(url.pathname)) {
    url.pathname = '/';
    url.search = '';
    url.hash = '';
  }
  return url.href;
}

export function resolvePublicSource(provider) {
  if (publicOverrides[provider.id]) return { ...publicOverrides[provider.id] };
  if (provider.sourceType === 'rss') {
    return { mode: 'feed', url: provider.url, sourceName: `${provider.name} public RSS`, maxAgeHours: provider.maxAgeHours || 168, confirmHealthyFromFeed: true };
  }
  if (/\/api\/v2\/summary\.json$/i.test(new URL(provider.url).pathname)) {
    const pageUrl = publicPageUrl(provider.url);
    return {
      mode: 'status-html',
      url: pageUrl,
      feedCandidates: [new URL('history.rss', pageUrl).href, new URL('history.atom', pageUrl).href],
      sourceName: `${provider.name} public status page`
    };
  }
  if (/limited|official-limited|html-limited/i.test(provider.sourceType || '')) {
    return { mode: 'limited', url: provider.url, sourceName: `${provider.name} official public page` };
  }
  return { mode: 'status-html', url: provider.url, sourceName: `${provider.name} public status page` };
}

function extractTag(block, names) {
  for (const name of names) {
    const cdata = new RegExp(`<${name}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${name}>`, 'i').exec(block);
    if (cdata?.[1]) return cleanText(cdata[1]);
    const plain = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block);
    if (plain?.[1]) return cleanText(plain[1]);
  }
  return '';
}

function extractLink(block) {
  const rssLink = extractTag(block, ['link', 'guid']);
  if (rssLink && /^https?:/i.test(rssLink)) return rssLink;
  const atomLink = /<link[^>]+href=["']([^"']+)["'][^>]*>/i.exec(block)?.[1];
  return atomLink || '';
}

export function parseFeedEntries(xml) {
  const blocks = [
    ...[...String(xml || '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => match[1]),
    ...[...String(xml || '').matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => match[1])
  ];
  return blocks.map(block => ({
    title: extractTag(block, ['title']),
    note: extractTag(block, ['description', 'summary', 'content']),
    time: extractTag(block, ['pubDate', 'updated', 'published', 'dc:date']),
    status: extractTag(block, ['status']),
    url: extractLink(block)
  })).filter(item => item.title || item.note);
}

function issueText(value) {
  return /\b(outage|unavailable|down|degrad(?:ed|ation|ing)?|disruption|service impact|incident|intermittent|latency|elevated errors?|fail(?:ure|ures|ing|ed)?|partial outage|major outage|critical|investigat(?:e|ed|ing)?|identified|monitoring)\b/i.test(value);
}

function resolvedText(value) {
  return /\b(resolved|completed|postmortem|closed|fixed|restored|recovered|remediated|cancelled)\b/i.test(value);
}

function plannedMaintenanceText(value) {
  return /\b(this is a scheduled event|scheduled event|scheduled maintenance|planned maintenance|maintenance window|maintenance is currently in progress|will be performing (?:scheduled )?maintenance|deprecation|end of life|end of support)\b/i.test(value);
}

function maintenanceEscalationText(value) {
  const text = String(value || '');
  if (/\b(?:unplanned|emergency)\s+(?:maintenance|work|change|event)\b/i.test(text)) return true;
  if (/\b(?:critical incident|major service outage|widespread outage|complete outage|incident declared|outage detected|unexpected (?:outage|impact|disruption))\b/i.test(text)) return true;
  const responseState = /\b(?:investigating|identified|monitoring)\b/i.test(text);
  const currentImpact = /\b(?:customers?|users?)\s+(?:are|is)\s+(?:currently\s+)?(?:experiencing|unable|affected|impacted)\b|\b(?:currently|actively)\s+(?:experiencing|impacting|affecting)\b|\b(?:service|services|requests?|traffic|connections?|api)\s+(?:is|are)\s+(?:currently\s+)?(?:unavailable|degraded|failing|down|timing out)\b|\b(?:network performance issues?|service disruption|service degradation|elevated errors?|increased errors?|failed requests?|connection failures?)\b/i.test(text);
  return responseState && currentImpact;
}

function maintenanceOnly(value) {
  return plannedMaintenanceText(value) && !maintenanceEscalationText(value);
}

function itemColor(value) {
  if (/\b(critical|major outage|widespread outage|unavailable|service down|complete outage)\b/i.test(value)) return 'red';
  const color = colorFromText(value);
  return color === 'red' ? 'red' : 'amber';
}

export function activeFeedEntries(entries, maxAgeHours = 168, now = Date.now()) {
  return entries.filter(item => {
    const text = `${item.title} ${item.note} ${item.status}`;
    if (isEditorialIncidentEntry(item) || isGenericIncidentTitle(item.title) || !issueText(text) || resolvedText(text) || maintenanceOnly(text)) return false;
    const ms = Date.parse(item.time || '');
    if (!Number.isFinite(ms)) return true;
    const age = now - ms;
    return age >= -300000 && age <= maxAgeHours * 60 * 60 * 1000;
  });
}

export function maintenanceFeedEntries(entries, maxAgeHours = 720, now = Date.now()) {
  return entries.filter(item => {
    const text = `${item.title} ${item.note} ${item.status}`;
    if (!plannedMaintenanceText(text) || maintenanceEscalationText(text) || resolvedText(text) || isEditorialIncidentEntry(item)) return false;
    const ms = Date.parse(item.time || '');
    if (!Number.isFinite(ms)) return true;
    const age = now - ms;
    return age >= -300000 && age <= maxAgeHours * 60 * 60 * 1000;
  });
}

export function scopeFeedEntries(entries, source = {}) {
  if (source.regionScope === 'global') return entries;
  return entries.filter(item => isIncidentUsRelevant(item));
}

export function dedupeIncidentEntries(entries) {
  const records = new Map();
  for (const item of entries) {
    const titleKey = normalizeIncidentTitle(item.title) || cleanText(item.title).toLowerCase();
    const urlKey = cleanText(item.url || '').replace(/[?#].*$/, '');
    const key = `${titleKey}|${urlKey}`;
    const current = records.get(key);
    if (!current) {
      records.set(key, { ...item, firstTime: item.time || '' });
      continue;
    }
    const currentMs = Date.parse(current.time || '');
    const itemMs = Date.parse(item.time || '');
    const firstCandidates = [current.firstTime, current.time, item.time]
      .filter(Boolean)
      .map(value => ({ value, ms: Date.parse(value) }))
      .filter(entry => Number.isFinite(entry.ms))
      .sort((a, b) => a.ms - b.ms);
    const firstTime = firstCandidates[0]?.value || current.firstTime || current.time || item.time || '';
    if (Number.isFinite(itemMs) && (!Number.isFinite(currentMs) || itemMs >= currentMs)) records.set(key, { ...current, ...item, firstTime });
    else records.set(key, { ...current, firstTime });
  }
  return [...records.values()];
}

function feedAvailableWithoutHealthConclusion(provider, source, logs, maintenance, fingerprint) {
  return providerStatus(
    provider,
    source,
    'Official public incident feed is readable; no active incident was found',
    'blue',
    true,
    'The official incident feed is live and readable, but it does not confirm current component health. No operational conclusion was made.',
    logs,
    [],
    maintenance,
    'available',
    { schemaFingerprint: fingerprint }
  );
}

export async function parsePublicFeed(provider, source) {
  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };
  const result = await fetchSource(requestProvider, 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain, */*');
  const logs = result.logs || [result.log];
  if (!result.ok) return providerStatus(provider, source, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log?.error || result.log?.message, logs, [], [], 'unavailable');
  const feedDocument = /<(?:rss|feed)\b/i.test(result.body);
  const fingerprint = schemaFingerprint(result.body, source.mode);
  const entries = parseFeedEntries(result.body);
  if (!entries.length) {
    if (!feedDocument) return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The official feed loaded but was not a readable RSS or Atom document, so no service-health conclusion was made.', logs, [], [], 'limited', { schemaFingerprint: fingerprint });
    if (source.allowEmpty === true && source.confirmHealthyFromFeed === true) return providerStatus(provider, source, 'No active incidents in the official public feed', 'green', true, '', logs, [], [], undefined, { schemaFingerprint: fingerprint });
    return feedAvailableWithoutHealthConclusion(provider, source, logs, [], fingerprint);
  }
  const relevantEntries = source.includePattern ? entries.filter(item => source.includePattern.test(`${item.title} ${item.note} ${item.status}`)) : entries;
  const scopedEntries = scopeFeedEntries(relevantEntries, source);
  const active = dedupeIncidentEntries(activeFeedEntries(scopedEntries, source.maxAgeHours || 168));
  const planned = dedupeIncidentEntries(maintenanceFeedEntries(scopedEntries, Math.max(source.maxAgeHours || 168, 720)));
  const incidents = active.slice(0, 12).map(item => makeIncident(provider, source, {
    ...item,
    firstDetected: item.firstTime || item.time,
    latestUpdate: item.time,
    color: itemColor(`${item.title} ${item.note} ${item.status}`),
    url: item.url || source.pageUrl || source.url,
    updates: [{ status: item.status, note: item.note, at: item.time }]
  }));
  const maintenance = planned.slice(0, 12).map(item => makeMaintenance(provider, source, {
    ...item,
    status: /in[_ -]?progress/i.test(item.status || item.note || '') ? 'in_progress' : 'scheduled',
    startsAt: item.time,
    announcedAt: item.time,
    latestUpdate: item.time,
    url: item.url || source.pageUrl || source.url,
    updates: [{ status: item.status, note: item.note, at: item.time }]
  })).filter(item => maintenanceIsRelevant(item));
  if (incidents.length) {
    const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
    return providerStatus(provider, source, `${incidents.length} active public incident${incidents.length === 1 ? '' : 's'}`, worst, true, '', logs, incidents, maintenance, undefined, { schemaFingerprint: fingerprint });
  }
  if (source.confirmHealthyFromFeed === true) return providerStatus(provider, source, 'No active incidents in the official public feed', 'green', true, '', logs, [], maintenance, undefined, { schemaFingerprint: fingerprint });
  return feedAvailableWithoutHealthConclusion(provider, source, logs, maintenance, fingerprint);
}

function currentHtmlSection(html) {
  const withoutScripts = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = cleanText(withoutScripts);
  const boundary = /\b(?:incident history|past incidents|previous incidents|resolved incidents|historical incidents|uptime history)\b/i.exec(text);
  return boundary ? text.slice(0, boundary.index) : text.slice(0, 80000);
}

export function discoverFeedUrls(html, pageUrl) {
  const urls = [];
  const patterns = [
    /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi,
    /<a[^>]+href=["']([^"']+(?:\.rss|\.atom|\/rss|\/atom|feed\/rss|feed\.atom))[^"']*["'][^>]*>/gi
  ];
  for (const pattern of patterns) {
    for (const match of String(html || '').matchAll(pattern)) {
      try {
        const url = new URL(match[1], pageUrl).href;
        if (!urls.includes(url)) urls.push(url);
      } catch { }
    }
  }
  return urls;
}

function htmlIssueConclusion(provider, source, html) {
  const specific = providerSpecificConclusion(provider, html);
  if (specific) return specific;
  const current = currentHtmlSection(html);
  const lower = current.toLowerCase();
  if (/cloudflare|attention required|verify you are human|captcha|access denied|enable javascript to run this app/.test(lower) && current.length < 4000) return { kind: 'limited', message: 'The official page returned a bot challenge or JavaScript shell without readable service status.' };
  if (provider.id === 'entra') return entraConclusion(current);
  const activeCount = /\b([1-9]\d*)\s+active incidents?\b/i.exec(current);
  if (activeCount) return { kind: 'issue', color: 'amber', title: `${provider.name} public status page reports an active issue`, note: `${activeCount[1]} active incidents` };
  const healthy = /\b(all systems operational|all systems working|all services operational|all services are operational|no active incidents|0 active incidents|no incidents reported|everything is operating normally)\b/i.exec(current);
  if (healthy) return { kind: 'healthy', status: cleanText(healthy[0]) };
  const issuePattern = /\b(major outage|partial outage|degraded performance|service disruption|service degradation|critical incident|active incident|investigating an issue|identified an issue|monitoring an issue)\b/i;
  const issue = issuePattern.exec(current);
  if (issue) {
    const text = issue[0];
    return { kind: 'issue', color: /major|critical|outage/i.test(text) && !/partial/i.test(text) ? 'red' : 'amber', title: `${provider.name} public status page reports an active issue`, note: text };
  }
  const operationalMatches = current.match(/\bOperational\b/gi) || [];
  const problemMatches = current.match(/\b(Major Outage|Partial Outage|Degraded Performance|Service Disruption)\b/gi) || [];
  if (operationalMatches.length >= 2 && problemMatches.length === 0) return { kind: 'healthy', status: `${provider.name} components report operational` };
  return { kind: 'limited', message: 'The official page loaded but did not expose a stable readable current health conclusion.' };
}

export function entraConclusion(text) {
  const marker = /Microsoft Entra ID(?:\s*\(formerly Azure AD\))?/i.exec(text);
  if (!marker) return { kind: 'limited', message: 'The Azure public status page did not expose a readable Microsoft Entra ID row.' };
  const row = text.slice(marker.index, marker.index + 500);
  const tail = text.slice(marker.index + marker[0].length, marker.index + marker[0].length + 180);
  const firstStatus = /\b(Good|Information|Warning|Critical|Major|Outage|Degraded|Not available|N\/A)\b/i.exec(tail)?.[1]?.toLowerCase();
  if (firstStatus && /critical|major|outage/.test(firstStatus)) return { kind: 'issue', color: 'red', title: 'Microsoft Entra ID public status reports a critical issue', note: cleanText(row).slice(0, 500) };
  if (firstStatus && /warning|degraded|information/.test(firstStatus)) return { kind: 'issue', color: 'amber', title: 'Microsoft Entra ID public status reports an issue', note: cleanText(row).slice(0, 500) };
  if (firstStatus === 'good') return { kind: 'healthy', status: 'Microsoft Entra ID public status is Good' };
  return { kind: 'limited', message: 'The Microsoft Entra ID row was found, but its current status could not be determined.' };
}

async function tryFeedCandidates(provider, source, html, pageLogs) {
  const candidates = [...discoverFeedUrls(html, source.url), ...(source.feedCandidates || [])];
  for (const url of [...new Set(candidates)].slice(0, 4)) {
    const feedSource = { ...source, mode: 'feed', url, pageUrl: source.url, sourceName: `${provider.name} official public feed`, maxAgeHours: 336 };
    const result = await parsePublicFeed(provider, feedSource);
    if (result.source_state === 'available') {
      result.download_log = [...pageLogs, ...(result.download_log || [])];
      return result;
    }
  }
  return null;
}

function structuredIncidents(provider, source, conclusion) {
  return (conclusion.incidents || [])
    .filter(item => incidentEvidenceIsCurrent(item, Date.now(), INCIDENT_MAX_AGE_DAYS))
    .slice(0, 12)
    .map(item => makeIncident(provider, source, item));
}

function structuredMaintenance(provider, source, conclusion) {
  return (conclusion.maintenance || []).slice(0, 16).map(item => makeMaintenance(provider, source, item)).filter(item => maintenanceIsRelevant(item));
}

const publicHtmlRequestCache = new Map();

async function fetchPublicHtml(requestProvider, source) {
  const accept = /-json$/i.test(source.mode) ? 'application/json, text/json, */*' : 'text/html, text/plain, */*';
  const key = `${requestProvider.url}|${accept}`;
  if (!publicHtmlRequestCache.has(key)) publicHtmlRequestCache.set(key, fetchSource(requestProvider, accept));
  return publicHtmlRequestCache.get(key);
}

async function parsePublicHtml(provider, source) {
  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };
  const result = await fetchPublicHtml(requestProvider, source);
  const logs = [...(result.logs || [result.log])];
  let pageBody = result.ok ? result.body : '';
  let renderedAlready = false;
  if (!result.ok) {
    const feedResult = await tryFeedCandidates(provider, source, '', logs);
    if (feedResult?.source_state === 'available') return feedResult;
    if (source.render === true) {
      const rendered = await renderPublicPage(source);
      logs.push(rendered.log);
      if (rendered.ok) {
        pageBody = rendered.body;
        renderedAlready = true;
      } else {
        return providerStatus(provider, source, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, rendered.log?.error || result.log?.error || result.log?.message, logs, [], [], 'unavailable');
      }
    } else {
      return providerStatus(provider, source, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log?.error || result.log?.message, logs, [], [], 'unavailable');
    }
  }
  let conclusion = htmlIssueConclusion(provider, source, pageBody);
  if ((conclusion.kind === 'limited' || (conclusion.kind === 'issue' && isGenericIncidentTitle(conclusion.title))) && source.render === true && !renderedAlready) {
    const rendered = await renderPublicPage(source);
    logs.push(rendered.log);
    if (rendered.ok) {
      pageBody = rendered.body;
      conclusion = htmlIssueConclusion(provider, source, pageBody);
      renderedAlready = true;
    }
  }
  const fingerprint = schemaFingerprint(pageBody, source.mode);
  const feedResult = /-json$/i.test(source.mode) ? null : await tryFeedCandidates(provider, source, pageBody, logs);
  if (feedResult?.incidents?.length) return feedResult;
  const maintenance = structuredMaintenance(provider, source, conclusion);
  const extras = { components: conclusion.components || [], schemaFingerprint: fingerprint };
  if (conclusion.kind === 'component-state') {
    return providerStatus(provider, source, conclusion.status || `${provider.name} reports current component degradation`, conclusion.color === 'red' ? 'red' : 'amber', true, conclusion.message || '', logs, [], maintenance, undefined, extras);
  }
  if (conclusion.kind === 'issues') {
    const incidents = structuredIncidents(provider, source, conclusion);
    if (incidents.length) {
      const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return providerStatus(provider, source, `${incidents.length} active US public incident${incidents.length === 1 ? '' : 's'}`, worst, true, '', logs, incidents, maintenance, undefined, extras);
    }
    return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page exposed unresolved incident records without current, timestamped evidence. They were not published as active.', logs, [], maintenance, 'limited', extras);
  }
  if (conclusion.kind === 'issue') {
    if (isGenericIncidentTitle(conclusion.title)) return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page reported an issue state without a specific incident title or details, so no incident was published.', logs, [], maintenance, 'limited', extras);
    if (!incidentEvidenceIsCurrent(conclusion, Date.now(), INCIDENT_MAX_AGE_DAYS)) return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The page reported an unresolved issue without recent official evidence, so it was not published as active.', logs, [], maintenance, 'limited', extras);
    const incident = makeIncident(provider, source, conclusion);
    return providerStatus(provider, source, conclusion.title, conclusion.color, true, '', logs, [incident], maintenance, undefined, extras);
  }
  if (conclusion.kind === 'access-gated') return providerStatus(provider, source, conclusion.status || `${provider.name} current health requires authenticated vendor access`, 'blue', true, conclusion.message || 'The public source confirms the official authenticated status channel. No operational conclusion was inferred.', logs, [], maintenance, 'available', { ...extras, healthAccess: 'authenticated', healthObservable: false });
  if (conclusion.kind === 'healthy') return providerStatus(provider, source, conclusion.status || `${provider.name} reports normal service`, 'green', true, '', logs, [], maintenance, undefined, extras);
  if (feedResult?.source_state === 'available') return feedResult;
  return providerStatus(provider, source, 'Limited official source', 'blue', false, conclusion.message, logs, [], maintenance, 'limited', extras);
}

function limitedStatus(provider, source) {
  const message = provider.message || 'The official public source requires account, tenant, address, location, or interactive access.';
  return providerStatus(provider, source, 'Limited official source', 'blue', false, message, [logEntry(source, false, 'limited source', message)], [], [], 'limited');
}

export async function loadPublicProvider(provider) {
  const source = resolvePublicSource(provider);
  try {
    if (source.mode === 'limited') return limitedStatus(provider, source);
    if (source.mode === 'feed') return await parsePublicFeed(provider, source);
    return await parsePublicHtml(provider, source);
  } catch (error) {
    const message = error?.message || String(error);
    return providerStatus(provider, source, 'Parser failed', 'blue', false, message, [logEntry(source, false, 'parser failed', message, message)], [], [], 'unavailable');
  }
}

export function reconcileProviderIncidentEvidence(result, now = Date.now()) {
  const incidents = (result?.incidents || []).filter(item => activeIncident(item, now));
  const hasCurrentComponentIssue = Array.isArray(result?.component_status) && result.component_status.some(component => !/^(?:operational|available|up|ok|none|good)$/i.test(String(component?.status || '')));
  if (incidents.length || hasCurrentComponentIssue || !['major', 'degraded'].includes(result?.service_state)) return { ...result, incidents };
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

export async function generatePublicStatus() {
  const rawCatalog = readJson(catalogPath);
  if (!Array.isArray(rawCatalog)) throw new Error('Provider catalog must be an array.');
  const catalog = canonicalizeProviderCatalog(rawCatalog);
  const ids = new Set();
  for (const provider of catalog) {
    if (ids.has(provider.id)) throw new Error(`Duplicate provider id: ${provider.id}`);
    ids.add(provider.id);
  }

  let previous = null;
  try {
    previous = readJson(previousStatusPath);
    validatePayload(previous);
  } catch {
    previous = null;
  }

  const collectionStartedAt = new Date().toISOString();
  const collectedResults = await collectWithBudgets(catalog, resolvePublicSource, loadPublicProvider, collectionLimits);
  const results = collectedResults.map(result => reconcileProviderIncidentEvidence(result));
  const incidents = results.flatMap(result => result.incidents || [])
    .filter(item => activeIncident(item))
    .sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)));
  const maintenance = dedupeMaintenanceRecords(
    results.flatMap(result => result.maintenance || [])
      .filter(item => maintenanceIsRelevant(item))
  ).sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress') || (Date.parse(a.starts_at || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(b.starts_at || '') || Number.MAX_SAFE_INTEGER));
  const generatedAt = new Date().toISOString();
  const rawProviders = results.map(({ incidents: _incidents, maintenance: _maintenance, ...provider }) => provider);
  const historicalProviders = enrichProviderHistory(rawProviders, previous, incidents, generatedAt);
  const collectionIntelligence = buildCollectionIntelligence(historicalProviders, incidents, maintenance, collectionStartedAt, generatedAt);
  const providers = collectionIntelligence.providers
    .sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)) || a.name.localeCompare(b.name));
  const base = {
    schema_version: 2,
    generated_at: generatedAt,
    summary: { ...summarizeProviders(providers, incidents, maintenance), ...collectionIntelligence.summary },
    collection: collectionIntelligence.collection,
    providers,
    incidents,
    maintenance
  };
  const changes = [...compareSnapshots(previous, base, generatedAt), ...sourceIntelligenceChanges(previous, base, generatedAt)]
    .filter(change => !dateLikeIncidentTitle(change.title))
    .filter((change, index, all) => all.findIndex(candidate => candidate.id === change.id) === index);
  const retainedHistory = (previous?.history || []).filter(change => !dateLikeIncidentTitle(change.title));
  const payload = { ...base, changes, history: [...changes, ...retainedHistory].slice(0, 200) };
  validatePayload(payload);
  writeJson(publicStatusPath, payload);
  console.log(`Generated v3 public-source intelligence for ${providers.length} providers: ${payload.summary.coverage_percent}% live coverage, quality ${payload.collection.quality_score}/100, ${payload.collection.origin_count} origins, ${incidents.length} incidents, ${maintenance.length} maintenance events.`);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await generatePublicStatus();
