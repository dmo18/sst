const fs = require('fs');
const path = require('path');

const providers = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'providers.json'), 'utf8'));

const sev = { red: 3, amber: 2, blue: 1, green: 0 };
const RSS_MAX_AGE_HOURS = 72;
const FETCH_TIMEOUT_MS = 10000;

function stripHtml(value) {
  return String(value || '')
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
  if (/critical|major|outage|red|unavailable|down/.test(text)) return 'red';
  if (/minor|degrad|partial|warn|yellow|amber|investigat|monitor|issue|disruption|error|elevated/.test(text)) return 'amber';
  if (/none|operational|ok|good|normal|resolved|available/.test(text)) return 'green';
  return 'blue';
}

function isNoise(title, note, status = '') {
  const text = `${title} ${note} ${status}`.toLowerCase();
  const noise = /scheduled|maintenance|deprecation|deprecated|lifecycle|announcement|informational|notice|planned|upgrade|release|migration|cleanup|quarterly|policy|no customer impact|no disruption is expected/;
  const impact = /outage|degrad|disruption|unavailable|error|elevated|partial|down|fail|failing|latency|unable|investigat|monitor|identified|mitigat/;
  return noise.test(text) && !impact.test(text);
}

function isActiveStatus(status) {
  return !/(resolved|completed|postmortem|closed)/i.test(String(status || ''));
}

function matchesService(provider, title, note) {
  if (!provider.services || provider.services.length === 0) return true;
  if (provider.sourceType && provider.sourceType.includes('limited')) return true;
  const haystack = `${title} ${note}`.toLowerCase();
  return provider.services.some(service => haystack.includes(String(service).toLowerCase()));
}

function latestStatuspageNote(incident) {
  const updates = incident.incident_updates || [];
  const update = updates[0] || updates[updates.length - 1] || {};
  return stripHtml(update.body || incident.impact || incident.status || 'No detail text provided by feed.');
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

async function fetchLogged(provider, url, options = {}) {
  const started = new Date().toISOString();
  const startedMs = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || FETCH_TIMEOUT_MS);
  const log = {
    timestamp: started,
    url,
    source_type: provider.sourceType || 'unknown',
    ok: false,
    status: 'not started',
    message: '',
    error: ''
  };

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'user-agent': 'msp-status-hud/1.0',
        ...(options.headers || {})
      }
    });
    log.completed_at = new Date().toISOString();
    log.duration_ms = Date.now() - startedMs;
    log.ok = res.ok;
    log.status = `HTTP ${res.status}`;
    log.message = res.statusText || '';
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { downloadLog: log });
    return { res, log };
  } catch (error) {
    log.completed_at = new Date().toISOString();
    log.duration_ms = Date.now() - startedMs;
    log.error = String(error.message || error);
    log.status = log.status === 'not started' ? 'fetch failed' : log.status;
    throw Object.assign(error, { downloadLog: log });
  } finally {
    clearTimeout(timeout);
  }
}

async function getText(provider, url) {
  const { res, log } = await fetchLogged(provider, url);
  const text = await res.text();
  log.message = `${log.message || 'OK'}; received ${text.length} characters`;
  return { text, logs: [log] };
}

async function getJson(provider, url) {
  const { res, log } = await fetchLogged(provider, url, { headers: { accept: 'application/json' } });
  const text = await res.text();
  log.message = `${log.message || 'OK'}; received ${text.length} characters`;
  return { data: JSON.parse(text), logs: [log] };
}

function dedupeIncidents(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.providerId}:${item.title}`.toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
    const existing = map.get(key);
    if (!existing || hoursOld(item.rawTime || item.time) < hoursOld(existing.rawTime || existing.time)) map.set(key, item);
  }
  return [...map.values()];
}

function keepIncident(provider, item) {
  if (!item.title) return false;
  if (item.color === 'green') return false;
  if (isNoise(item.title, item.note, item.status)) return false;
  if (!matchesService(provider, item.title, item.note)) return false;
  return true;
}

async function parseStatuspage(provider) {
  const { data, logs } = await getJson(provider, provider.url);
  const description = data.status?.description || 'Operational';
  const indicator = data.status?.indicator || 'none';
  const rawIncidents = data.incidents || [];
  const incidents = rawIncidents.filter(item => isActiveStatus(item.status)).map(item => {
    const note = latestStatuspageNote(item);
    return {
      providerId: provider.id,
      provider: provider.name,
      category: provider.category,
      title: item.name || 'Incident',
      note,
      source: 'Statuspage API',
      url: item.shortlink || item.url || provider.url,
      time: shortTime(item.updated_at || item.created_at),
      rawTime: item.updated_at || item.created_at,
      status: item.status || '',
      color: colorFromText(`${item.impact || ''} ${item.status || ''} ${note}`),
      priority: provider.priority
    };
  }).filter(item => keepIncident(provider, item));
  const active = dedupeIncidents(incidents);
  const color = active.length ? active.reduce((max, item) => sev[item.color] > sev[max] ? item.color : max, 'amber') : colorFromText(`${indicator} ${description}`);
  return providerResult(provider, active.length ? `${active.length} active issue${active.length === 1 ? '' : 's'}` : description, color, active, true, '', logs);
}

function extractXml(item, tag) {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(item);
  if (cdata) return cdata[1];
  const normal = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item);
  return normal ? normal[1] : '';
}

async function parseAwsRss(provider) {
  const { text, logs } = await getText(provider, provider.url);
  const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const title = stripHtml(extractXml(item, 'title'));
    const note = stripHtml(extractXml(item, 'description'));
    const pubDate = stripHtml(extractXml(item, 'pubDate'));
    const isClear = /service is operating normally|informational message|resolved/i.test(`${title} ${note}`);
    return {
      providerId: provider.id,
      provider: provider.name,
      category: provider.category,
      title,
      note,
      source: 'AWS RSS',
      url: provider.url,
      time: shortTime(pubDate),
      rawTime: pubDate,
      status: '',
      color: isClear ? 'green' : colorFromText(`${title} ${note}`),
      priority: provider.priority
    };
  }).filter(item => hoursOld(item.rawTime) <= RSS_MAX_AGE_HOURS).filter(item => keepIncident(provider, item));
  const active = dedupeIncidents(items).slice(0, 8);
  return providerResult(provider, active.length ? `${active.length} recent active RSS event${active.length === 1 ? '' : 's'}` : 'No active RSS events', active.length ? 'amber' : 'green', active, true, '', logs);
}

async function parseGoogleCloud(provider) {
  const { data, logs } = await getJson(provider, provider.url);
  const list = Array.isArray(data) ? data : [];
  const incidents = list.filter(item => !/resolved/i.test(`${item.status_impact || ''} ${item.current_status || ''}`)).map(item => {
    const updates = item.updates || [];
    const update = updates[0] || updates[updates.length - 1] || {};
    const title = stripHtml(item.external_desc || item.name || 'Google Cloud incident');
    const note = stripHtml(update.text || item.most_recent_update?.text || item.status_impact || 'No detail text provided by feed.');
    return {
      providerId: provider.id,
      provider: provider.name,
      category: provider.category,
      title,
      note,
      source: 'Google Cloud JSON',
      url: provider.url,
      time: shortTime(item.begin || item.created),
      rawTime: item.begin || item.created,
      status: item.current_status || '',
      color: colorFromText(`${item.severity || ''} ${item.status_impact || ''} ${item.current_status || ''} ${note}`),
      priority: provider.priority
    };
  }).filter(item => keepIncident(provider, item)).slice(0, 8);
  return providerResult(provider, incidents.length ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}` : 'Operational', incidents.length ? 'amber' : 'green', incidents, true, '', logs);
}

async function parseSlack(provider) {
  const { data, logs } = await getJson(provider, provider.url);
  const active = data.active_incidents || data.incidents || [];
  const incidents = active.map(item => ({
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title: item.title || 'Slack incident',
    note: stripHtml(item.notes?.[0]?.body || item.status || 'No detail text provided by feed.'),
    source: 'Slack Status API',
    url: provider.url,
    time: item.date_created ? shortTime(new Date(item.date_created * 1000).toISOString()) : '',
    rawTime: item.date_created ? new Date(item.date_created * 1000).toISOString() : '',
    status: item.status || '',
    color: 'amber',
    priority: provider.priority
  })).filter(item => keepIncident(provider, item));
  return providerResult(provider, incidents.length ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}` : (data.status || 'Operational'), incidents.length ? 'amber' : 'green', incidents, true, '', logs);
}

function extractObjectsWithField(text, field) {
  const objects = [];
  const marker = `"${field}"`;
  let pos = 0;
  while ((pos = text.indexOf(marker, pos)) !== -1) {
    let start = pos;
    while (start >= 0 && text[start] !== '{') start -= 1;
    if (start < 0) break;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let end = start; end < text.length; end += 1) {
      const ch = text[end];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (depth === 0) {
        try { objects.push(JSON.parse(text.slice(start, end + 1))); } catch {}
        pos = end + 1;
        break;
      }
    }
  }
  return objects;
}

async function parseOktaHtml(provider) {
  const { text, logs } = await getText(provider, provider.url);
  const objects = extractObjectsWithField(text, 'Incident_Title__c');
  const incidents = objects.filter(item => isActiveStatus(item.Status__c || '')).map(item => ({
    providerId: provider.id,
    provider: provider.name,
    category: provider.category,
    title: stripHtml(item.Incident_Title__c || item.Name || 'Okta incident'),
    note: stripHtml(item.Log__c || item.Category__c || 'No detail text provided by feed.'),
    source: 'Okta status page',
    url: provider.url,
    time: shortTime(item.Last_Updated__c || item.Start_Time__c || item.CreatedDate),
    rawTime: item.Last_Updated__c || item.Start_Time__c || item.CreatedDate,
    status: item.Status__c || '',
    color: colorFromText(`${item.Category__c || ''} ${item.Log__c || ''} ${item.Status__c || ''}`),
    priority: provider.priority
  })).filter(item => keepIncident(provider, item));
  return providerResult(provider, incidents.length ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}` : 'No active incidents', incidents.length ? 'amber' : 'green', incidents, true, '', logs);
}

async function parseHtmlLimited(provider) {
  try {
    const { logs } = await getText(provider, provider.url);
    return providerResult(provider, 'Official page reachable', 'blue', [], true, 'Official public status source is reachable, but no active issue parser is available yet.', logs);
  } catch (error) {
    return providerResult(provider, 'Official source limited', 'blue', [], true, `Official public source could not be parsed from GitHub Actions: ${error.message || error}`, [error.downloadLog].filter(Boolean));
  }
}

function syntheticLog(provider, status, message, ok = true) {
  const now = new Date().toISOString();
  return [{ timestamp: now, completed_at: now, duration_ms: 0, url: provider.url, source_type: provider.sourceType || 'unknown', ok, status, message }];
}

async function parseOfficialLimited(provider) {
  const message = provider.message || 'Official public status source is not reliably readable from GitHub Actions, so it is listed but not parsed.';
  return providerResult(provider, 'Official source limited', 'blue', [], true, message, syntheticLog(provider, 'listed only', message));
}

async function parseLimitedMicrosoft(provider) {
  const message = 'Primary service. Public source is limited; rich Microsoft 365 service health requires authenticated Graph.';
  return providerResult(provider, 'Microsoft Graph needed', 'blue', [], true, message, syntheticLog(provider, 'listed only', message));
}

function providerResult(provider, status, color, incidents, ok, message = '', downloadLog = []) {
  return {
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status,
    color,
    message,
    ok,
    source: provider.url,
    priority: provider.priority,
    checked_at: new Date().toISOString(),
    source_type: provider.sourceType || 'unknown',
    download_log: downloadLog,
    incidents: incidents || []
  };
}

async function loadProvider(provider) {
  try {
    if (!provider.enabled) return providerResult(provider, 'Disabled', 'blue', [], true, 'Provider is disabled.', syntheticLog(provider, 'disabled', 'Provider is disabled.'));
    if (provider.sourceType === 'statuspage') return await parseStatuspage(provider);
    if (provider.sourceType === 'rss') return await parseAwsRss(provider);
    if (provider.sourceType === 'google-cloud-json') return await parseGoogleCloud(provider);
    if (provider.sourceType === 'slack') return await parseSlack(provider);
    if (provider.sourceType === 'okta-html') return await parseOktaHtml(provider);
    if (provider.sourceType === 'html-limited') return await parseHtmlLimited(provider);
    if (provider.sourceType === 'official-limited') return await parseOfficialLimited(provider);
    if (provider.sourceType === 'limited-microsoft') return await parseLimitedMicrosoft(provider);
    return providerResult(provider, 'Unsupported source type', 'blue', [], false, 'Provider source type is not part of the status aggregator contract.', syntheticLog(provider, 'unsupported source type', 'Provider source type is not part of the status aggregator contract.', false));
  } catch (error) {
    return providerResult(provider, 'Source unavailable', 'blue', [], false, String(error.message || error), [error.downloadLog].filter(Boolean));
  }
}

function incidentWeight(item) {
  return (item.priority || 0) + (sev[item.color] || 0) * 20;
}

function writeJson(targetPath, output) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(output, null, 2) + '\n');
}

async function main() {
  const results = await Promise.all(providers.map(loadProvider));
  const incidents = results.flatMap(result => result.incidents || []).filter(item => item.color !== 'green');
  incidents.sort((a, b) => incidentWeight(b) - incidentWeight(a));
  const history = incidents.slice(0, 20).map(item => `${item.provider}: ${item.title}`);
  const worst = incidents.reduce((color, item) => (sev[item.color] || 0) > (sev[color] || 0) ? item.color : color, 'green');
  const output = {
    generated_at: new Date().toISOString(),
    summary: {
      overall: worst,
      active_incident_count: incidents.length,
      providers_ok: results.filter(r => r.ok).length,
      providers_total: results.length
    },
    providers: results.map(({ incidents, ...rest }) => rest),
    incidents,
    history
  };
  writeJson(path.join(__dirname, '..', 'status.json'), output);
  writeJson(path.join(__dirname, '..', 'public', 'status.json'), output);
  console.log(`Wrote status.json and public/status.json with ${incidents.length} active incidents from ${results.length} providers`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
