import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const catalogPath = path.join(root, 'config', 'providers.json');
const publicStatusPath = path.join(root, 'public', 'status.json');
const rootStatusPath = path.join(root, 'status.json');
const timeoutMs = 12000;
const concurrency = 12;
const severityRank = { red: 4, amber: 3, blue: 2, green: 1 };

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function cleanText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function colorFromText(value) {
  const text = String(value || '').toLowerCase();
  if (/critical|major|outage|unavailable|down|severe/.test(text)) return 'red';
  if (/minor|degrad|partial|warning|investigat|monitor|issue|disruption|error|elevated|latency|delayed|intermittent/.test(text)) return 'amber';
  if (/none|operational|ok|good|normal|resolved|available|all systems operational/.test(text)) return 'green';
  return 'blue';
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toISOString().slice(5, 16).replace('T', ' ');
}

function providerStatus(provider, status, color, ok, message, logs, incidents = []) {
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status,
    color,
    message: message || '',
    ok,
    source: provider.url,
    priority: provider.priority || 0,
    checked_at: new Date().toISOString(),
    source_type: provider.sourceType || 'unknown',
    download_log: logs,
    incidents
  };
}

function makeLog(provider, startedAt, startedMs, status, ok, message, error = '') {
  return {
    timestamp: startedAt,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    url: provider.url,
    source_type: provider.sourceType || 'unknown',
    ok,
    status,
    message,
    error
  };
}

async function fetchSource(provider, accept = '*/*') {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(provider.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept, 'user-agent': 'msp-status-hud/2.1.1' }
    });
    const body = await response.text();
    const contentType = response.headers.get('content-type') || 'unknown';
    const log = makeLog(provider, startedAt, startedMs, `HTTP ${response.status}`, response.ok, `${response.statusText || 'OK'}; content-type=${contentType}; bytes=${body.length}`);
    return { ok: response.ok, status: response.status, body, log };
  } catch (error) {
    const log = makeLog(provider, startedAt, startedMs, 'fetch failed', false, 'Fetch failed before a readable response was returned.', String(error?.message || error));
    return { ok: false, status: 0, body: '', log };
  } finally {
    clearTimeout(timeout);
  }
}

function incident(provider, title, note, source, url, time, status, color) {
  return {
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title: cleanText(title || 'Service incident'),
    note: cleanText(note || 'No incident detail was returned by the source.'),
    source,
    url: url || provider.url,
    time: shortTime(time),
    rawTime: time || '',
    status: status || '',
    color,
    priority: provider.priority || 0
  };
}

function parseDateMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}


function normalizeIncidentTitle(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\b(?:update|resolved|monitoring|investigating|identified|completed|scheduled|maintenance)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clearActiveRssIncident(item) {
  const text = `${item.title} ${item.note} ${item.status}`.toLowerCase();
  if (/(?:outage|unavailable|down|degrad|disruption|elevated|latency|error|fail(?:ure|ing)?|incident|service impact|intermittent|impaired)/.test(text)) return true;
  if (/(?:investigat|monitor|identified|mitigat|partial|major|critical|minor) issue/.test(text)) return true;
  return false;
}

function inactiveRssIncident(item) {
  const text = `${item.title} ${item.note} ${item.status}`.toLowerCase();
  if (/(?:resolved|completed|postmortem|closed|fixed|restored|recovered|remediated|cancelled)/.test(text)) return true;
  if (/(?:informational|history|historical|scheduled maintenance|planned maintenance|maintenance window|lifecycle|end[ -]?of[ -]?life|end[ -]?of[ -]?support|deprecation|deprecated)/.test(text)) return true;
  return false;
}

function recentRssIncident(item, maxAgeHours) {
  const ms = parseDateMs(item.rawTime);
  if (!ms) return clearActiveRssIncident(item);
  return Date.now() - ms <= maxAgeHours * 60 * 60 * 1000;
}

function activeIncident(item) {
  const text = `${item.title} ${item.note} ${item.status}`.toLowerCase();
  if (/resolved|completed|postmortem|closed|fixed/.test(text)) return false;
  if (/scheduled|maintenance|planned|announcement|informational|deprecation/.test(text) && !/outage|degrad|disruption|error|latency|incident/.test(text)) return false;
  return item.color !== 'green';
}

function recentIncident(item, maxAgeDays = 14) {
  const ms = parseDateMs(item.rawTime);
  if (!ms) return true;
  return Date.now() - ms <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function noisyIncident(item) {
  const text = `${item.title} ${item.note} ${item.status}`.toLowerCase();
  return /(?:informational|maintenance|scheduled|completed|resolved|postmortem|customer action required|between \d{1,2}:\d{2})/.test(text)
    && !/(?:outage|degrad|disruption|error|latency|unavailable|elevated|incident)/.test(text);
}

async function parseStatuspage(provider) {
  const result = await fetchSource(provider, 'application/json');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);

  try {
    const data = JSON.parse(result.body);
    const items = Array.isArray(data.incidents) ? data.incidents : [];
    const incidents = items.map(item => {
      const update = item.incident_updates?.[0] || item.incident_updates?.at?.(-1) || {};
      const note = update.body || item.impact || item.status || '';
      const color = colorFromText(`${item.impact || ''} ${item.status || ''} ${note}`);
      return incident(provider, item.name, note, 'Statuspage API', item.shortlink || item.url || provider.url, item.updated_at || item.created_at, item.status, color);
    }).filter(activeIncident);
    if (incidents.length) {
      const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return providerStatus(provider, `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}`, worst, true, '', logs, incidents);
    }
    const statusText = data.status?.description || 'All Systems Operational';
    return providerStatus(provider, statusText, colorFromText(`${data.status?.indicator || ''} ${statusText}`), true, '', logs);
  } catch (error) {
    return providerStatus(provider, 'Parser failed', 'blue', false, `Statuspage parser failed: ${error?.message || error}`, logs);
  }
}

async function parseRss(provider) {
  const result = await fetchSource(provider, 'application/rss+xml, application/xml, text/xml, */*');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);

  const maxAgeHours = Number.isFinite(Number(provider.maxAgeHours)) && Number(provider.maxAgeHours) > 0 ? Number(provider.maxAgeHours) : 72;
  const seen = new Set();
  const items = [...result.body.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const block = match[1];
    const title = cleanText((/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i.exec(block) || /<title>([\s\S]*?)<\/title>/i.exec(block) || [])[1]);
    const note = cleanText((/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i.exec(block) || /<description>([\s\S]*?)<\/description>/i.exec(block) || [])[1]);
    const time = cleanText((/<pubDate><!\[CDATA\[([\s\S]*?)\]\]><\/pubDate>/i.exec(block) || /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block) || [])[1]);
    return incident(provider, title, note, 'RSS', provider.url, time, '', colorFromText(`${title} ${note}`));
  }).filter(item => {
    const key = `${provider.id}:${normalizeIncidentTitle(item.title)}`;
    if (!normalizeIncidentTitle(item.title) || seen.has(key)) return false;
    if (inactiveRssIncident(item) || noisyIncident(item)) return false;
    if (!recentRssIncident(item, maxAgeHours)) return false;
    if (!activeIncident(item)) return false;
    seen.add(key);
    return true;
  }).slice(0, provider.id === 'aws' ? 6 : 10);

  const worst = items.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
  return providerStatus(provider, items.length ? `${items.length} recent active RSS event${items.length === 1 ? '' : 's'}` : 'No active RSS events', items.length ? worst : 'green', true, '', logs, items);
}

async function parseGoogleCloudIncidents(provider) {
  const result = await fetchSource(provider, 'application/json');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);
  try {
    const data = JSON.parse(result.body);
    const items = Array.isArray(data) ? data : (Array.isArray(data.incidents) ? data.incidents : []);
    const incidents = items.map(item => {
      const updates = Array.isArray(item.updates) ? item.updates : [];
      const update = updates.at(-1) || updates[0] || {};
      const note = update.text || item.external_desc || item.description || item.service_name || item.status_impact || '';
      const status = item.status || item.state || item.incident_state || '';
      const color = colorFromText(`${item.severity || ''} ${item.status_impact || ''} ${status} ${note}`);
      return incident(provider, item.external_desc || item.service_name || item.id || 'Google Cloud incident', note, 'Google Cloud incidents JSON', item.uri || provider.url, update.when || item.modified || item.begin, status, color);
    }).filter(item => activeIncident(item) && recentIncident(item, 21));
    if (incidents.length) {
      const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return providerStatus(provider, `${incidents.length} active Google Cloud incident${incidents.length === 1 ? '' : 's'}`, worst, true, '', logs, incidents.slice(0, 10));
    }
    return providerStatus(provider, 'No active Google Cloud incidents', 'green', true, '', logs);
  } catch (error) {
    return providerStatus(provider, 'Parser failed', 'blue', false, `Google Cloud incidents parser failed: ${error?.message || error}`, logs);
  }
}

async function parseSlackCurrentStatus(provider) {
  const result = await fetchSource(provider, 'application/json');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);
  try {
    const data = JSON.parse(result.body);
    const active = Array.isArray(data.active_incidents) ? data.active_incidents : [];
    const incidents = active.map(item => {
      const note = item.notes?.at?.(-1)?.body || item.notes?.[0]?.body || item.services?.map(service => service.name).join(', ') || item.status || '';
      const color = colorFromText(`${item.type || ''} ${item.status || ''} ${note}`);
      return incident(provider, item.title || item.id || 'Slack incident', note, 'Slack current status API', item.url || provider.url, item.date_updated || item.date_created, item.status, color);
    }).filter(activeIncident);
    if (incidents.length) {
      const worst = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return providerStatus(provider, `${incidents.length} active Slack incident${incidents.length === 1 ? '' : 's'}`, worst, true, '', logs, incidents);
    }
    const status = data.status || 'ok';
    return providerStatus(provider, status === 'ok' ? 'Slack reports no active incidents' : `Slack status: ${status}`, colorFromText(status), true, '', logs);
  } catch (error) {
    return providerStatus(provider, 'Parser failed', 'blue', false, `Slack current status parser failed: ${error?.message || error}`, logs);
  }
}

function herokuStatusColor(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'green' || status === 'normal' || status === 'operational') return 'green';
  if (status === 'yellow' || status === 'amber' || status === 'degraded' || status === 'degradation' || status === 'performance degradation' || status === 'minor') return 'amber';
  if (status === 'red' || status === 'outage' || status === 'service disruption' || status === 'disruption' || status === 'major') return 'red';
  return 'blue';
}

function parseHerokuStatusSystems(data) {
  if (Array.isArray(data.status)) {
    return data.status.map(item => {
      if (!item || typeof item !== 'object') throw new Error('status entries must be objects');
      const system = item.system || item.name;
      if (typeof system !== 'string' || typeof item.status !== 'string') throw new Error('status entries must include system and status strings');
      return { system, status: item.status, color: herokuStatusColor(item.status) };
    });
  }

  if (data.status && typeof data.status === 'object') {
    const systems = [];
    for (const key of ['Production', 'Development', 'production', 'development']) {
      if (typeof data.status[key] === 'string') systems.push({ system: key[0].toUpperCase() + key.slice(1).toLowerCase(), status: data.status[key], color: herokuStatusColor(data.status[key]) });
    }
    if (systems.length) return systems;
  }

  throw new Error('status must be an array of system status objects or production/development status fields');
}

function herokuIncidentActive(item) {
  const state = String(item?.state || item?.status || '').toLowerCase();
  if (/resolved|closed|complete|postmortem/.test(state) || item?.resolved === true || item?.resolved_at) return false;
  const systems = Array.isArray(item?.systems) ? item.systems : [];
  if (systems.some(system => herokuStatusColor(system?.status) !== 'green')) return true;
  if (/investigating|identified|monitoring|unresolved|open|active/.test(state)) return true;
  return false;
}

async function parseHerokuCurrentStatus(provider) {
  const result = await fetchSource(provider, 'application/json');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);
  try {
    const data = JSON.parse(result.body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('response must be a JSON object');

    const systems = parseHerokuStatusSystems(data);
    if (!systems.length) throw new Error('response did not include any platform status entries');
    const unknown = systems.find(system => system.color === 'blue');
    if (unknown) throw new Error(`unknown Heroku status value for ${unknown.system}: ${unknown.status}`);

    const active = Array.isArray(data.incidents) ? data.incidents.filter(herokuIncidentActive) : [];
    if (!Array.isArray(data.incidents)) throw new Error('incidents must be an array');

    const incidents = active.map(item => {
      const updates = Array.isArray(item.updates) ? item.updates : [];
      const update = updates[0] || updates.at?.(-1) || {};
      const affectedSystems = Array.isArray(item.systems) ? item.systems.map(system => `${system.name || 'Heroku'} ${system.status || ''}`.trim()).join(', ') : '';
      const note = update.contents || affectedSystems || item.state || 'Heroku reports an active incident.';
      const color = (Array.isArray(item.systems) ? item.systems : []).reduce((current, system) => {
        const systemColor = herokuStatusColor(system?.status);
        return severityRank[systemColor] > severityRank[current] ? systemColor : current;
      }, colorFromText(`${item.title || ''} ${item.state || ''} ${note}`));
      return incident(provider, item.title || item.id || 'Heroku incident', note, 'Heroku current status API', item.full_url || item.url || item.href || provider.url, update.created_at || item.updated_at || item.created_at, item.state || item.status, color === 'blue' ? 'amber' : color);
    });

    const platformColor = systems.reduce((current, system) => severityRank[system.color] > severityRank[current] ? system.color : current, 'green');
    const incidentColor = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'green');
    const color = severityRank[incidentColor] > severityRank[platformColor] ? incidentColor : platformColor;
    const statusText = systems.map(system => `${system.system}: ${system.status}`).join('; ');

    if (incidents.length) {
      return providerStatus(provider, `${incidents.length} active Heroku incident${incidents.length === 1 ? '' : 's'} (${statusText})`, color, true, '', logs, incidents);
    }
    return providerStatus(provider, color === 'green' ? 'Heroku reports normal service' : `Heroku platform status: ${statusText}`, color, true, '', logs);
  } catch (error) {
    return providerStatus(provider, 'Parser failed', 'blue', false, `Heroku current status parser failed: ${error?.message || error}`, logs);
  }
}


const microsoftGraphRequiredMessage = 'Unauthenticated public Microsoft status data is insufficient for reliable Microsoft 365 and Entra ID service-health detail; tenant-authenticated Microsoft Graph service communications auth is required.';

function microsoftKeywordPattern(provider) {
  if (provider.id === 'entra') {
    return /\b(entra|azure\s+ad|aad|identity|sign-?in|single\s+sign|\bsso\b|mfa|multi-?factor|token|authenticat|authorization|conditional\s+access|identity\s+protection)\b/i;
  }

  return /\b(microsoft\s*365|m365|office\s*365|exchange|outlook|teams|sharepoint|one\s*drive|onedrive|intune|defender|power\s+(?:platform|apps|automate|bi)|copilot|service\s+health|admin\s+center|office\b)\b/i;
}

function collectMicrosoftRecords(value, records = []) {
  if (!value || typeof value !== 'object') return records;
  if (Array.isArray(value)) {
    for (const item of value) collectMicrosoftRecords(item, records);
    return records;
  }

  const keys = Object.keys(value);
  const hasIncidentShape = keys.some(key => /title|name|service|workload|feature|id|incident|advisory|message|status|state|impact|classification/i.test(key));
  if (hasIncidentShape) records.push(value);

  for (const key of keys) {
    const child = value[key];
    if (child && typeof child === 'object') collectMicrosoftRecords(child, records);
  }
  return records;
}

function microsoftField(item, names) {
  for (const name of names) {
    const value = item?.[name];
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value) && value.length) return value.map(entry => typeof entry === 'string' ? entry : (entry?.name || entry?.displayName || entry?.title || '')).filter(Boolean).join(', ');
    if (value && typeof value === 'object') {
      const nested = value.displayName || value.name || value.title || value.value || value.text;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }
  return '';
}

function microsoftIncidentFromRecord(provider, item) {
  const title = microsoftField(item, ['title', 'name', 'displayName', 'serviceName', 'workloadDisplayName', 'featureName', 'incidentTitle', 'advisoryTitle', 'messageTitle', 'id']) || 'Microsoft service advisory';
  const note = microsoftField(item, ['description', 'summary', 'message', 'impactDescription', 'impact', 'latestMessage', 'lastMessage', 'details', 'body', 'status']) || title;
  const status = microsoftField(item, ['status', 'state', 'classification', 'incidentStatus', 'eventStatus', 'healthStatus']);
  const service = microsoftField(item, ['service', 'serviceName', 'workload', 'workloadDisplayName', 'feature', 'featureName', 'affectedServices', 'affectedWorkloads']);
  const text = `${title} ${note} ${status} ${service}`;
  const relevant = microsoftKeywordPattern(provider).test(text);
  const color = colorFromText(`${status} ${note} ${title}`);
  const time = microsoftField(item, ['lastUpdatedTime', 'lastModifiedDateTime', 'updatedDateTime', 'updated_at', 'modified', 'startTime', 'startDateTime', 'createdDateTime']);
  const url = microsoftField(item, ['url', 'link', 'serviceUrl', 'portalUrl']);
  const candidate = incident(provider, service ? `${service}: ${title}` : title, note, 'Microsoft public status API', url || provider.url, time, status, color);
  return relevant && activeIncident(candidate) ? candidate : null;
}

async function parseLimitedMicrosoft(provider) {
  const result = await fetchSource(provider, 'application/json, text/json, */*');
  const logs = [result.log];
  const finish = (status, color, ok, message, incidents = []) => {
    logs.push({
      timestamp: result.log.timestamp,
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      url: provider.url,
      source_type: provider.sourceType || 'limited-microsoft',
      ok,
      status: 'parser result',
      message: incidents.length ? `Parsed ${incidents.length} active Microsoft advisory record${incidents.length === 1 ? '' : 's'}.` : message
    });
    return providerStatus(provider, status, color, ok, message, logs, incidents);
  };

  if (!result.ok) {
    return finish('Limited official source', 'blue', false, `${result.log.error || result.log.message}. ${microsoftGraphRequiredMessage}`);
  }

  try {
    const data = JSON.parse(result.body);
    const records = collectMicrosoftRecords(data);
    const incidents = records.map(item => microsoftIncidentFromRecord(provider, item)).filter(Boolean);
    const unique = [...new Map(incidents.map(item => [`${item.title}|${item.rawTime}|${item.status}`, item])).values()].slice(0, 12);
    if (unique.length) {
      const worst = unique.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
      return finish(`${unique.length} active Microsoft advisory${unique.length === 1 ? '' : 'ies'}`, worst, true, '', unique);
    }

    return finish('Limited official source', 'blue', true, microsoftGraphRequiredMessage);
  } catch (error) {
    return finish('Limited official source', 'blue', false, `Microsoft public status parser could not read unauthenticated service-health data: ${error?.message || error}. ${microsoftGraphRequiredMessage}`);
  }
}

async function parseLimitedPublicPage(provider) {
  return parseLimitedSource(provider, provider.message || 'Official public status is limited by account, region, location, tenant, login, or bot filtering; results are intentionally catalog-only.');
}

async function parseLimitedSource(provider, message) {
  const now = new Date().toISOString();
  return providerStatus(provider, 'Limited official source', 'blue', true, message, [{
    timestamp: now,
    completed_at: now,
    duration_ms: 0,
    url: provider.url,
    source_type: provider.sourceType || 'limited',
    ok: true,
    status: 'limited source',
    message
  }]);
}

async function loadProvider(provider) {
  if (provider.enabled === false) return parseLimitedSource({ ...provider, message: provider.message || 'Disabled in catalog.' }, provider.message || 'Disabled in catalog.');
  switch (provider.sourceType) {
    case 'statuspage': return parseStatuspage(provider);
    case 'rss': return parseRss(provider);
    case 'google-cloud-incidents': return parseGoogleCloudIncidents(provider);
    case 'slack-current-status': return parseSlackCurrentStatus(provider);
    case 'heroku-current-status': return parseHerokuCurrentStatus(provider);
    case 'limited-microsoft': return parseLimitedMicrosoft(provider);
    case 'limited-public-page':
    case 'official-limited':
    case 'html-limited':
    case 'okta-html': return parseLimitedPublicPage(provider);
    default: return parseLimitedSource(provider, `Unsupported source type: ${provider.sourceType || 'unknown'}.`);
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

const catalog = readJson(catalogPath);
const providersById = new Map(catalog.map(provider => [provider.id, provider]));
const providers = [...providersById.values()];
const results = await mapLimit(providers, concurrency, loadProvider);
const incidents = results.flatMap(result => result.incidents || []).sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)));
const providerStatuses = results.map(({ incidents: _incidents, ...rest }) => rest).sort((a, b) => (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)) || a.name.localeCompare(b.name));
const overall = incidents.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'green');
const payload = {
  generated_at: new Date().toISOString(),
  summary: {
    overall,
    active_incident_count: incidents.length,
    providers_ok: providerStatuses.filter(provider => provider.ok).length,
    providers_total: providerStatuses.length
  },
  providers: providerStatuses,
  incidents,
  history: incidents.slice(0, 50).map(item => `${item.provider}: ${item.title}`)
};

writeJson(publicStatusPath, payload);
writeJson(rootStatusPath, payload);
console.log(`Generated status for ${providerStatuses.length} providers and ${incidents.length} active incidents.`);
