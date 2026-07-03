const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROVIDERS_PATH = path.join(ROOT, 'config', 'providers.json');
const STATUS_PATH = path.join(ROOT, 'status.json');
const PUBLIC_STATUS_PATH = path.join(ROOT, 'public', 'status.json');
const FETCH_TIMEOUT_MS = 12000;
const CONCURRENCY = 12;
const RSS_MAX_AGE_HOURS = 72;
const severityRank = { red: 4, amber: 3, blue: 2, green: 1 };

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function colorFromText(value) {
  const text = String(value || '').toLowerCase();
  if (/critical|major|outage|unavailable|down|severe|service disruption/.test(text)) return 'red';
  if (/minor|degrad|partial|warn|investigat|monitor|issue|disruption|error|elevated|latency|delayed|intermittent/.test(text)) return 'amber';
  if (/none|operational|ok|good|normal|resolved|available|all systems operational/.test(text)) return 'green';
  return 'blue';
}

function shortTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toISOString().slice(5, 16).replace('T', ' ');
}

function hoursOld(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / 36e5;
}

function isActiveStatus(status) {
  return !/(resolved|completed|postmortem|closed|fixed|done)/i.test(String(status || ''));
}

function isNoise(title, note, status = '') {
  const text = `${title} ${note} ${status}`.toLowerCase();
  const planned = /scheduled|maintenance|deprecation|deprecated|lifecycle|announcement|informational|notice|planned|upgrade|release|migration|cleanup|quarterly|policy|no customer impact|no disruption is expected/;
  const impact = /outage|degrad|disruption|unavailable|error|elevated|partial|down|fail|failing|latency|unable|investigat|monitor|identified|mitigat|incident/;
  return planned.test(text) && !impact.test(text);
}

function matchesService(provider, title, note) {
  if (!provider.services || provider.services.length === 0) return true;
  if (String(provider.sourceType || '').includes('limited')) return true;
  const text = `${title} ${note}`.toLowerCase();
  return provider.services.some(service => text.includes(String(service).toLowerCase()));
}

function downloadLog(provider, startedAt, startedMs, url, sourceType) {
  return {
    timestamp: startedAt,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedMs,
    url,
    source_type: sourceType || provider.sourceType || 'unknown',
    ok: false,
    status: 'not started',
    message: '',
    error: ''
  };
}

async function fetchWithLog(provider, url, options = {}) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const sourceType = options.sourceType || provider.sourceType || 'unknown';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || FETCH_TIMEOUT_MS);
  const log = downloadLog(provider, startedAt, startedMs, url, sourceType);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'accept': options.accept || '*/*',
        'user-agent': 'msp-status-aggregator/1.0',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    log.completed_at = new Date().toISOString();
    log.duration_ms = Date.now() - startedMs;
    log.ok = res.ok;
    log.status = `HTTP ${res.status}`;
    log.message = `${res.statusText || 'OK'}; content-type=${res.headers.get('content-type') || 'unknown'}; bytes=${text.length}`;
    return { ok: res.ok, status: res.status, text, log, contentType: res.headers.get('content-type') || '' };
  } catch (error) {
    log.completed_at = new Date().toISOString();
    log.duration_ms = Date.now() - startedMs;
    log.status = 'fetch failed';
    log.error = String(error.message || error);
    log.message = 'Fetch failed before a readable payload was returned.';
    return { ok: false, status: 0, text: '', log, contentType: '', error };
  } finally {
    clearTimeout(timer);
  }
}

function providerResult(provider, status, color, incidents, ok, message, logs) {
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
    download_log: logs && logs.length ? logs : [{
      timestamp: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      url: provider.url,
      source_type: provider.sourceType || 'unknown',
      ok,
      status,
      message: message || status
    }],
    incidents: incidents || []
  };
}

function incident(provider, title, note, source, url, time, rawTime, status, color) {
  return {
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title: stripHtml(title || 'Service incident'),
    note: stripHtml(note || 'No incident detail was returned by the source.'),
    source,
    url: url || provider.url,
    time: shortTime(time || rawTime),
    rawTime: rawTime || time || '',
    status: status || '',
    color: color || colorFromText(`${title} ${note} ${status}`),
    priority: provider.priority || 0
  };
}

function keepIncident(provider, item) {
  if (!item.title) return false;
  if (item.color === 'green') return false;
  if (!isActiveStatus(item.status)) return false;
  if (isNoise(item.title, item.note, item.status)) return false;
  if (!matchesService(provider, item.title, item.note)) return false;
  return true;
}

function latestStatuspageNote(item) {
  const updates = item.incident_updates || [];
  const update = updates[0] || updates[updates.length - 1] || {};
  return stripHtml(update.body || item.impact || item.status || 'No detail text provided by feed.');
}

function dedupe(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = `${item.providerId}:${item.title}`.toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
    const existing = byKey.get(key);
    if (!existing || hoursOld(item.rawTime || item.time) < hoursOld(existing.rawTime || existing.time)) byKey.set(key, item);
  }
  return [...byKey.values()];
}

async function parseStatuspage(provider) {
  const first = await fetchWithLog(provider, provider.url, { accept: 'application/json' });
  const logs = [first.log];
  if (!first.ok) {
    return providerResult(provider, `Source unavailable: HTTP ${first.status || 'failed'}`, 'blue', [], false, first.log.error || first.log.message, logs);
  }

  let data;
  try {
    data = JSON.parse(first.text);
  } catch (error) {
    return providerResult(provider, 'Source returned non-JSON', 'blue', [], false, `Parser failed: ${error.message || error}`, logs);
  }

  const pageStatus = data.status || {};
  const rawIncidents = Array.isArray(data.incidents) ? data.incidents : [];
  const incidents = rawIncidents.map(item => {
    const note = latestStatuspageNote(item);
    const color = colorFromText(`${item.impact || ''} ${item.status || ''} ${note}`);
    return incident(provider, item.name, note, 'Statuspage API', item.shortlink || item.url || provider.url, item.updated_at || item.created_at, item.updated_at || item.created_at, item.status, color);
  }).filter(item => keepIncident(provider, item));

  const active = dedupe(incidents);
  if (active.length) {
    const worst = active.reduce((current, item) => severityRank[item.color] > severityRank[current] ? item.color : current, 'amber');
    return providerResult(provider, `${active.length} active issue${active.length === 1 ? '' : 's'}`, worst, active, true, '', logs);
  }

  const statusText = pageStatus.description || 'All Systems Operational';
  return providerResult(provider, statusText, colorFromText(`${pageStatus.indicator || ''} ${statusText}`), [], true, '', logs);
}

function extractXml(item, tag) {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(item);
  if (cdata) return cdata[1];
  const normal = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item);
  return normal ? normal[1] : '';
}

async function parseRss(provider) {
  const first = await fetchWithLog(provider, provider.url, { accept: 'application/rss+xml, application/xml, text/xml, */*' });
  const logs = [first.log];
  if (!first.ok) return providerResult(provider, `Source unavailable: HTTP ${first.status || 'failed'}`, 'blue', [], false, first.log.error || first.log.message, logs);

  const items = [...first.text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const block = match[1];
    const title = stripHtml(extractXml(block, 'title'));
    const note = stripHtml(extractXml(block, 'description'));
    const pubDate = stripHtml(extractXml(block, 'pubDate'));
    const color = /service is operating normally|informational message|resolved/i.test(`${title} ${note}`) ? 'green' : colorFromText(`${title} ${note}`);
    return incident(provider, title, note, 'RSS', provider.url, pubDate, pubDate, '', color);
  }).filter(item => hoursOld(item.rawTime) <= RSS_MAX_AGE_HOURS).filter(item => keepIncident(provider, item));

  const active = dedupe(items).slice(0, 10);
  return providerResult(provider, active.length ? `${active.length} recent active RSS event${active.length === 1 ? '' : 's'}` : 'No active RSS events', active.length ? 'amber' : 'green', active, true, '', logs);
}

async function parseGoogleCloud(provider) {
  const first = await fetchWithLog(provider, provider.url, { accept: 'application/json' });
  const logs = [first.log];
  if (!first.ok) return providerResult(provider, `Source unavailable: HTTP ${first.status || 'failed'}`, 'blue', [], false, first.log.error || first.log.message, logs);

  let data;
  try { data = JSON.parse(first.text); } catch (error) { return providerResult(provider, 'Source returned non-JSON', 'blue', [], false, `Parser failed: ${error.message || error}`, logs); }
  const list = Array.isArray(data) ? data : [];
  const active = list.map(item => {
    const updates = item.updates || [];
    const update = updates[0] || updates[updates.length - 1] || {};
    const title = item.external_desc || item.name || 'Google Cloud incident';
    const note = update.text || item.most_recent_update?.text || item.status_impact || 'No detail text provided by feed.';
    return incident(provider, title, note, 'Google Cloud JSON', provider.url, item.begin || item.created, item.begin || item.created, item.current_status || '', colorFromText(`${item.severity || ''} ${item.status_impact || ''} ${item.current_status || ''} ${note}`));
  }).filter(item => keepIncident(provider, item)).slice(0, 10);

  return providerResult(provider, active.length ? `${active.length} active issue${active.length === 1 ? '' : 's'}` : 'Operational', active.length ? 'amber' : 'green', active, true, '', logs);
}

async function parseSlack(provider) {
  const first = await fetchWithLog(provider, provider.url, { accept: 'application/json' });
  const logs = [first.log];
  if (!first.ok) return providerResult(provider, `Source unavailable: HTTP ${first.status || 'failed'}`, 'blue', [], false, first.log.error || first.log.message, logs);

  let data;
  try { data = JSON.parse(first.text); } catch (error) { return providerResult(provider, 'Source returned non-JSON', 'blue', [], false, `Parser failed: ${error.message || error}`, logs); }
  const raw = data.active_incidents || data.incidents || [];
  const active = raw.map(item => incident(provider, item.title || 'Slack incident', item.notes?.[0]?.body || item.status || 'No detail text provided by feed.', 'Slack Status API', provider.url, item.date_created ? new Date(item.date_created * 1000).toISOString() : '', item.date_created ? new Date(item.date_created * 1000).toISOString() : '', item.status || '', 'amber')).filter(item => keepIncident(provider, item));
  return providerResult(provider, active.length ? `${active.length} active issue${active.length === 1 ? '' : 's'}` : (data.status || 'Operational'), active.length ? 'amber' : 'green', active, true, '', logs);
}

async function parseHtmlLimited(provider) {
  const first = await fetchWithLog(provider, provider.url, { accept: 'text/html, */*' });
  const logs = [first.log];
  if (!first.ok) return providerResult(provider, `Limited source unavailable: HTTP ${first.status || 'failed'}`, 'blue', [], false, provider.message || first.log.error || first.log.message, logs);
  return providerResult(provider, 'Public page reachable', 'blue', [], true, provider.message || 'Public source is reachable, but no rich active incident parser is available yet.', logs);
}

async function parseOfficialLimited(provider) {
  const message = provider.message || 'Official public status source is listed, but no reliable unauthenticated parser is available yet.';
  return providerResult(provider, 'Official source limited', 'blue', [], true, message, [{
    timestamp: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 0,
    url: provider.url,
    source_type: provider.sourceType || 'official-limited',
    ok: true,
    status: 'listed only',
    message
  }]);
}

async function loadProvider(provider) {
  if (!provider || !provider.id || !provider.name || !provider.url) {
    return providerResult({ id: provider?.id || 'invalid-provider', name: provider?.name || 'Invalid provider', category: provider?.category || 'Invalid', url: provider?.url || '', sourceType: 'invalid', priority: 0 }, 'Invalid provider config', 'blue', [], false, 'Provider entry is missing id, name, or url.', []);
  }

  try {
    if (provider.enabled === false) return providerResult(provider, 'Disabled', 'blue', [], true, 'Provider is disabled in the catalog.', []);
    if (provider.sourceType === 'statuspage') return await parseStatuspage(provider);
    if (provider.sourceType === 'rss') return await parseRss(provider);
    if (provider.sourceType === 'google-cloud-json') return await parseGoogleCloud(provider);
    if (provider.sourceType === 'slack') return await parseSlack(provider);
    if (provider.sourceType === 'html-limited' || provider.sourceType === 'okta-html') return await parseHtmlLimited(provider);
    if (provider.sourceType === 'official-limited' || provider.sourceType === 'limited-microsoft') return await parseOfficialLimited(provider);
    return await parseHtmlLimited(provider);
  } catch (error) {
    return providerResult(provider, 'Parser failure', 'blue', [], false, String(error.message || error), []);
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

function sortProviders(a, b) {
  return (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)) || a.name.localeCompare(b.name);
}

function sortIncidents(a, b) {
  return (severityRank[b.color] - severityRank[a.color]) || ((b.priority || 0) - (a.priority || 0)) || String(b.rawTime || '').localeCompare(String(a.rawTime || ''));
}

function writeJson(filePath, output) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(output, null, 2)}\n`);
}

async function main() {
  const catalog = readJson(PROVIDERS_PATH);
  const byId = new Map();
  for (const provider of catalog) byId.set(provider.id, provider);
  const providers = [...byId.values()];

  const results = await mapLimit(providers, CONCURRENCY, loadProvider);
  const incidents = results.flatMap(result => result.incidents || []).filter(item => item.color !== 'green').sort(sortIncidents);
  const providerStatuses = results.map(({ incidents: _incidents, ...rest }) => rest).sort(sortProviders);
  const overall = incidents.reduce((color, item) => severityRank[item.color] > severityRank[color] ? item.color : color, 'green');
  const output = {
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

  writeJson(STATUS_PATH, output);
  writeJson(PUBLIC_STATUS_PATH, output);
  console.log(`Wrote ${providerStatuses.length} provider diagnostics and ${incidents.length} active incidents.`);
}

main().catch(error => {
  console.error(error);
  const catalog = fs.existsSync(PROVIDERS_PATH) ? readJson(PROVIDERS_PATH) : [];
  const fallback = {
    generated_at: new Date().toISOString(),
    summary: { overall: 'blue', active_incident_count: 0, providers_ok: 0, providers_total: catalog.length },
    providers: catalog.map(provider => providerResult(provider, 'Refresh failed before provider fetch', 'blue', [], false, String(error.message || error), [])).map(({ incidents: _incidents, ...rest }) => rest),
    incidents: [],
    history: []
  };
  writeJson(STATUS_PATH, fallback);
  writeJson(PUBLIC_STATUS_PATH, fallback);
  process.exit(0);
});
