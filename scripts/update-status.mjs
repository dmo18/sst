import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const catalogPath = path.join(root, 'config', 'providers.json');
const publicStatusPath = path.join(root, 'public', 'status.json');
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
  const items = [...result.body.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const block = match[1];
    const title = cleanText((/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i.exec(block) || /<title>([\s\S]*?)<\/title>/i.exec(block) || [])[1]);
    const note = cleanText((/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i.exec(block) || /<description>([\s\S]*?)<\/description>/i.exec(block) || [])[1]);
    const time = cleanText((/<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block) || [])[1]);
    return incident(provider, title, note, 'RSS', provider.url, time, '', colorFromText(`${title} ${note}`));
  }).filter(item => activeIncident(item) && recentIncident(item, provider.id === 'aws' ? 7 : 14) && !noisyIncident(item)).slice(0, provider.id === 'aws' ? 6 : 10);
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

async function parseHerokuCurrentStatus(provider) {
  const result = await fetchSource(provider, 'application/json');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);
  try {
    const data = JSON.parse(result.body);
    const statusText = [data.status?.Production, data.status?.Development, data.status?.production, data.status?.development].filter(Boolean).join('; ') || data.status || 'Heroku current status reachable';
    const color = colorFromText(statusText);
    const incidents = color === 'green' ? [] : [incident(provider, 'Heroku current status', statusText, 'Heroku current status API', provider.url, data.updated_at || data.updatedAt, statusText, color)];
    return providerStatus(provider, incidents.length ? 'Heroku current status reports issues' : 'Heroku reports no active incidents', color, true, '', logs, incidents);
  } catch (error) {
    return providerStatus(provider, 'Parser failed', 'blue', false, `Heroku current status parser failed: ${error?.message || error}`, logs);
  }
}

async function parseLimitedMicrosoft(provider) {
  return parseLimitedSource(provider, 'Microsoft service health is tenant-scoped; this public endpoint does not provide complete account-specific Microsoft 365 or Entra incident detail.');
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
console.log(`Generated status for ${providerStatuses.length} providers and ${incidents.length} active incidents.`);
