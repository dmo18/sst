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
import { additionalPublicOverrides, providerSpecificConclusion, renderPublicPage } from './public-source-repairs.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalogPath = path.join(root, 'config', 'providers.json');
const publicStatusPath = path.join(root, 'public', 'status.json');
const previousStatusPath = path.join(root, 'public', 'previous-status.json');
const concurrency = 10;
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
  backblaze: {
    mode: 'status-html',
    url: 'https://status.backblaze.com/',
    sourceName: 'Backblaze public status page'
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
  },
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

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toISOString().slice(5, 16).replace('T', ' ');
}

function makeIncident(provider, source, title, note, url, time = '', status = '', color = 'amber') {
  const cleanTitle = cleanText(title || 'Service incident');
  const serviceState = color === 'red' ? 'major' : 'degraded';
  return {
    id: `${provider.id}:${normalizeIncidentTitle(cleanTitle) || cleanTitle.toLowerCase()}`,
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title: cleanTitle,
    note: cleanText(note || 'The official public source reports a service issue.'),
    source: source.sourceName || source.mode,
    url: safeIncidentUrl(url, source.url),
    time: shortTime(time),
    rawTime: time || '',
    status: status || '',
    color,
    service_state: serviceState,
    attention: serviceState === 'major' ? 'critical' : 'action',
    priority: provider.priority || 0,
    first_detected: time || '',
    latest_update: time || '',
    client_impact: provider.client_impact,
    technician_action: provider.technician_action,
    affected_service: (provider.services || []).join(', ')
  };
}

function providerStatus(provider, source, status, color, ok, message, logs, incidents = [], sourceState) {
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
    incidents
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
  return /\b(outage|unavailable|down|degrad(?:ed|ation|ing)?|disruption|service impact|incident|intermittent|latency|elevated errors?|fail(?:ure|ures|ing|ed)?|partial outage|major outage|critical|investigat(?:e|ed|ing|ion)?|identified|monitoring)\b/i.test(value);
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
    if (!issueText(text) || resolvedText(text) || maintenanceOnly(text)) return false;
    const ms = Date.parse(item.time || '');
    if (!Number.isFinite(ms)) return true;
    const age = now - ms;
    return age >= -300000 && age <= maxAgeHours * 60 * 60 * 1000;
  });
}

function feedAvailableWithoutHealthConclusion(provider, source, logs) {
  return providerStatus(
    provider,
    source,
    'Official public incident feed is readable; no active incident was found',
    'blue',
    true,
    'The official incident feed is live and readable, but it does not confirm current component health. No operational conclusion was made.',
    logs,
    [],
    'available'
  );
}

async function parsePublicFeed(provider, source) {
  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };
  const result = await fetchSource(requestProvider, 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain, */*');
  const logs = result.logs || [result.log];
  if (!result.ok) {
    return providerStatus(provider, source, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log?.error || result.log?.message, logs, [], 'unavailable');
  }
  const feedDocument = /<(?:rss|feed)\b/i.test(result.body);
  const entries = parseFeedEntries(result.body);
  if (!entries.length) {
    if (!feedDocument) {
      return providerStatus(provider, source, 'Limited official source', 'blue', false, 'The official feed loaded but was not a readable RSS or Atom document, so no service-health conclusion was made.', logs, [], 'limited');
    }
    if (source.allowEmpty === true && source.confirmHealthyFromFeed === true) {
      return providerStatus(provider, source, 'No active incidents in the official public feed', 'green', true, '', logs);
    }
    return feedAvailableWithoutHealthConclusion(provider, source, logs);
  }
  const relevantEntries = source.includePattern
    ? entries.filter(item => source.includePattern.test(`${item.title} ${item.note} ${item.status}`))
    : entries;
  const active = activeFeedEntries(relevantEntries, source.maxAgeHours || 168);
  const incidents = active.slice(0, 12).map(item => {
    const text = `${item.title} ${item.note} ${item.status}`;
    return makeIncident(provider, source, item.title, item.note, item.url || source.pageUrl || source.url, item.time, item.status, itemColor(text));
  });
  if (incidents.length) {
    const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
    return providerStatus(provider, source, `${incidents.length} active public incident${incidents.length === 1 ? '' : 's'}`, worst, true, '', logs, incidents);
  }
  if (source.confirmHealthyFromFeed === true) {
    return providerStatus(provider, source, 'No active incidents in the official public feed', 'green', true, '', logs);
  }
  return feedAvailableWithoutHealthConclusion(provider, source, logs);
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
  if (/cloudflare|attention required|verify you are human|captcha|access denied|enable javascript to run this app/.test(lower) && current.length < 4000) {
    return { kind: 'limited', message: 'The official page returned a bot challenge or JavaScript shell without readable service status.' };
  }
  if (provider.id === 'entra') return entraConclusion(current);

  const activeCount = /\b([1-9]\d*)\s+active incidents?\b/i.exec(current);
  if (activeCount) {
    return { kind: 'issue', color: 'amber', title: `${provider.name} public status page reports an active issue`, note: `${activeCount[1]} active incidents` };
  }

  const healthy = /\b(all systems operational|all systems working|all services operational|all services are operational|no active incidents|0 active incidents|no incidents reported|everything is operating normally)\b/i.exec(current);
  if (healthy) return { kind: 'healthy', status: cleanText(healthy[0]) };

  const issuePattern = /\b(major outage|partial outage|degraded performance|service disruption|service degradation|critical incident|active incident|investigating an issue|identified an issue|monitoring an issue)\b/i;
  const issue = issuePattern.exec(current);
  if (issue) {
    const text = issue[0];
    const color = /major|critical|outage/i.test(text) && !/partial/i.test(text) ? 'red' : 'amber';
    return { kind: 'issue', color, title: `${provider.name} public status page reports an active issue`, note: text };
  }

  const operationalMatches = current.match(/\bOperational\b/gi) || [];
  const problemMatches = current.match(/\b(Major Outage|Partial Outage|Degraded Performance|Service Disruption)\b/gi) || [];
  if (operationalMatches.length >= 2 && problemMatches.length === 0) {
    return { kind: 'healthy', status: `${provider.name} components report operational` };
  }
  return { kind: 'limited', message: 'The official page loaded but did not expose a stable readable current health conclusion.' };
}

export function entraConclusion(text) {
  const marker = /Microsoft Entra ID(?:\s*\(formerly Azure AD\))?/i.exec(text);
  if (!marker) return { kind: 'limited', message: 'The Azure public status page did not expose a readable Microsoft Entra ID row.' };
  const row = text.slice(marker.index, marker.index + 500);
  const tail = text.slice(marker.index + marker[0].length, marker.index + marker[0].length + 180);
  const firstStatus = /\b(Good|Information|Warning|Critical|Major|Outage|Degraded|Not available|N\/A)\b/i.exec(tail)?.[1]?.toLowerCase();
  if (firstStatus && /critical|major|outage/.test(firstStatus)) {
    return { kind: 'issue', color: 'red', title: 'Microsoft Entra ID public status reports a critical issue', note: cleanText(row).slice(0, 500) };
  }
  if (firstStatus && /warning|degraded|information/.test(firstStatus)) {
    return { kind: 'issue', color: 'amber', title: 'Microsoft Entra ID public status reports an issue', note: cleanText(row).slice(0, 500) };
  }
  if (firstStatus === 'good') return { kind: 'healthy', status: 'Microsoft Entra ID public status is Good' };
  return { kind: 'limited', message: 'The Microsoft Entra ID row was found, but its current status could not be determined.' };
}

async function tryFeedCandidates(provider, source, html, pageLogs) {
  const candidates = [...discoverFeedUrls(html, source.url), ...(source.feedCandidates || [])];
  const unique = [...new Set(candidates)].slice(0, 4);
  for (const url of unique) {
    const feedSource = { ...source, mode: 'feed', url, pageUrl: source.url, sourceName: `${provider.name} official public feed`, maxAgeHours: 336 };
    const result = await parsePublicFeed(provider, feedSource);
    if (result.source_state === 'available') {
      result.download_log = [...pageLogs, ...(result.download_log || [])];
      return result;
    }
  }
  return null;
}

async function parsePublicHtml(provider, source) {
  const requestProvider = { ...provider, url: source.url, sourceType: source.mode };
  const result = await fetchSource(requestProvider, 'text/html, text/plain, */*');
  const logs = result.logs || [result.log];
  if (!result.ok) {
    const feedResult = await tryFeedCandidates(provider, source, '', logs);
    if (feedResult?.source_state === 'available') return feedResult;
    return providerStatus(provider, source, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log?.error || result.log?.message, logs, [], 'unavailable');
  }
  let pageBody = result.body;
  let conclusion = htmlIssueConclusion(provider, source, pageBody);
  if (conclusion.kind === 'limited' && source.render === true) {
    const rendered = renderPublicPage(source);
    logs.push(rendered.log);
    if (rendered.ok) {
      pageBody = rendered.body;
      conclusion = htmlIssueConclusion(provider, source, pageBody);
    }
  }
  const feedResult = await tryFeedCandidates(provider, source, pageBody, logs);
  if (feedResult?.incidents?.length) return feedResult;
  if (conclusion.kind === 'issue') {
    const incident = makeIncident(provider, source, conclusion.title, conclusion.note, source.url, '', 'active', conclusion.color);
    return providerStatus(provider, source, conclusion.title, conclusion.color, true, '', logs, [incident]);
  }
  if (conclusion.kind === 'healthy') {
    return providerStatus(provider, source, conclusion.status || `${provider.name} reports normal service`, 'green', true, '', logs);
  }
  if (feedResult?.source_state === 'available') return feedResult;
  return providerStatus(provider, source, 'Limited official source', 'blue', false, conclusion.message, logs, [], 'limited');
}

function limitedStatus(provider, source) {
  const message = provider.message || 'The official public source requires account, tenant, address, location, or interactive access.';
  return providerStatus(provider, source, 'Limited official source', 'blue', false, message, [logEntry(source, false, 'limited source', message)], [], 'limited');
}

export async function loadPublicProvider(provider) {
  const source = resolvePublicSource(provider);
  try {
    if (source.mode === 'limited') return limitedStatus(provider, source);
    if (source.mode === 'feed') return await parsePublicFeed(provider, source);
    return await parsePublicHtml(provider, source);
  } catch (error) {
    const message = error?.message || String(error);
    return providerStatus(provider, source, 'Parser failed', 'blue', false, message, [logEntry(source, false, 'parser failed', message, message)], [], 'unavailable');
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]);
    }
  }));
  return results;
}

export async function generatePublicStatus() {
  const catalog = readJson(catalogPath);
  if (!Array.isArray(catalog)) throw new Error('Provider catalog must be an array.');
  const ids = new Set();
  for (const provider of catalog) {
    if (ids.has(provider.id)) throw new Error(`Duplicate provider id: ${provider.id}`);
    ids.add(provider.id);
  }
  const results = await mapLimit(catalog, concurrency, loadPublicProvider);
  const incidents = results.flatMap(result => result.incidents || [])
    .filter(activeIncident)
    .sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)));
  const providers = results.map(({ incidents: _incidents, ...provider }) => provider)
    .sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)) || a.name.localeCompare(b.name));
  const generatedAt = new Date().toISOString();
  const base = {
    schema_version: 2,
    generated_at: generatedAt,
    summary: summarizeProviders(providers, incidents),
    providers,
    incidents
  };
  let previous = null;
  try {
    previous = readJson(previousStatusPath);
    validatePayload(previous);
  } catch { }
  const changes = compareSnapshots(previous, base, generatedAt);
  const payload = { ...base, changes, history: [...changes, ...(previous?.history || [])].slice(0, 100) };
  validatePayload(payload);
  writeJson(publicStatusPath, payload);
  console.log(`Generated free public-source status for ${providers.length} providers: ${payload.summary.coverage_percent}% readable live coverage, ${incidents.length} active incidents.`);
  return payload;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generatePublicStatus();
}
