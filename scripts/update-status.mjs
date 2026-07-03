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
      headers: { accept, 'user-agent': 'msp-status-hud/2.0' }
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

function activeIncident(item) {
  const text = `${item.title} ${item.note} ${item.status}`.toLowerCase();
  if (/resolved|completed|postmortem|closed|fixed/.test(text)) return false;
  if (/scheduled|maintenance|planned|announcement|informational|deprecation/.test(text) && !/outage|degrad|disruption|error|latency|incident/.test(text)) return false;
  return item.color !== 'green';
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
  }).filter(activeIncident).slice(0, 10);
  return providerStatus(provider, items.length ? `${items.length} recent active RSS event${items.length === 1 ? '' : 's'}` : 'No active RSS events', items.length ? 'amber' : 'green', true, '', logs, items);
}

async function parseJson(provider) {
  const result = await fetchSource(provider, 'application/json');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);
  try {
    JSON.parse(result.body);
    return providerStatus(provider, 'JSON source reachable', 'blue', true, 'Generic JSON source is reachable. No provider-specific incident parser is configured yet.', logs);
  } catch (error) {
    return providerStatus(provider, 'Source returned non-JSON', 'blue', false, `JSON parser failed: ${error?.message || error}`, logs);
  }
}

async function parseHtml(provider) {
  const result = await fetchSource(provider, 'text/html, */*');
  const logs = [result.log];
  if (!result.ok) return providerStatus(provider, `Limited source unavailable: HTTP ${result.status || 'failed'}`, 'blue', false, result.log.error || result.log.message, logs);
  return providerStatus(provider, 'Public page reachable', 'blue', true, provider.message || 'Public status page is reachable, but no rich parser is configured yet.', logs);
}

async function parseListed(provider) {
  const now = new Date().toISOString();
  return providerStatus(provider, 'Listed source', 'blue', true, provider.message || 'Source is cataloged but not fetched by this parser type.', [{
    timestamp: now,
    completed_at: now,
    duration_ms: 0,
    url: provider.url,
    source_type: provider.sourceType || 'listed',
    ok: true,
    status: 'catalog only',
    message: 'No network fetch required for this limited source.'
  }]);
}

async function loadProvider(provider) {
  if (provider.enabled === false) return parseListed({ ...provider, message: provider.message || 'Disabled in catalog.' });
  if (provider.sourceType === 'statuspage') return parseStatuspage(provider);
  if (provider.sourceType === 'rss') return parseRss(provider);
  if (provider.sourceType === 'google-cloud-json' || provider.sourceType === 'slack') return parseJson(provider);
  if (provider.sourceType === 'html-limited' || provider.sourceType === 'okta-html') return parseHtml(provider);
  return parseListed(provider);
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
