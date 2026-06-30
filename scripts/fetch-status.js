const fs = require('fs');
const path = require('path');

const providers = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'providers.json'), 'utf8'));

const sev = { red: 3, amber: 2, blue: 1, green: 0 };
const RSS_MAX_AGE_HOURS = 72;

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

async function getText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'msp-status-hud/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'msp-status-hud/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function dedupeIncidents(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.providerId}:${item.title}`.toLowerCase().replace(/[^a-z0-9:]+/g, ' ').trim();
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }
    const existing = map.get(key);
    if (hoursOld(item.rawTime || item.time) < hoursOld(existing.rawTime || existing.time)) {
      map.set(key, item);
    }
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
  const data = await getJson(provider.url);
  const description = data.status?.description || 'Operational';
  const indicator = data.status?.indicator || 'none';
  const rawIncidents = data.incidents || [];

  const incidents = rawIncidents
    .filter(item => isActiveStatus(item.status))
    .map(item => {
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
    })
    .filter(item => keepIncident(provider, item));

  const active = dedupeIncidents(incidents);
  const color = active.length
    ? active.reduce((max, item) => sev[item.color] > sev[max] ? item.color : max, 'amber')
    : colorFromText(`${indicator} ${description}`) === 'green' ? 'green' : colorFromText(`${indicator} ${description}`);

  return providerResult(provider, active.length ? `${active.length} active issue${active.length === 1 ? '' : 's'}` : description, color, active, true);
}

function extractXml(item, tag) {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i').exec(item);
  if (cdata) return cdata[1];
  const normal = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item);
  return normal ? normal[1] : '';
}

async function parseAwsRss(provider) {
  const xml = await getText(provider.url);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(match => {
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
    })
    .filter(item => hoursOld(item.rawTime) <= RSS_MAX_AGE_HOURS)
    .filter(item => keepIncident(provider, item));

  const active = dedupeIncidents(items).slice(0, 8);
  return providerResult(provider, active.length ? `${active.length} recent active RSS event${active.length === 1 ? '' : 's'}` : 'No active RSS events', active.length ? 'amber' : 'green', active, true);
}

async function parseGoogleCloud(provider) {
  const data = await getJson(provider.url);
  const list = Array.isArray(data) ? data : [];
  const incidents = list
    .filter(item => !/resolved/i.test(`${item.status_impact || ''} ${item.current_status || ''}`))
    .map(item => {
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
    })
    .filter(item => keepIncident(provider, item))
    .slice(0, 8);
  return providerResult(provider, incidents.length ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}` : 'Operational', incidents.length ? 'amber' : 'green', incidents, true);
}

async function parseSlack(provider) {
  const data = await getJson(provider.url);
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
  return providerResult(provider, incidents.length ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}` : (data.status || 'Operational'), incidents.length ? 'amber' : 'green', incidents, true);
}

async function parseHtmlLimited(provider) {
  try {
    await getText(provider.url);
    return providerResult(provider, 'Public page reachable', 'blue', [], true, 'Limited public source, no active issue parser yet');
  } catch (error) {
    return providerResult(provider, 'Public source limited', 'blue', [], false, `Limited public source: ${error.message || error}`);
  }
}

async function parseLimitedMicrosoft(provider) {
  return providerResult(provider, 'Microsoft Graph needed', 'blue', [], true, 'Primary service. Public source is limited; rich Microsoft 365 service health requires authenticated Graph.');
}

function providerResult(provider, status, color, incidents, ok, message = '') {
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
    incidents: incidents || []
  };
}

async function loadProvider(provider) {
  try {
    if (!provider.enabled) return providerResult(provider, 'Disabled', 'blue', [], true);
    if (provider.sourceType === 'statuspage') return await parseStatuspage(provider);
    if (provider.sourceType === 'rss') return await parseAwsRss(provider);
    if (provider.sourceType === 'google-cloud-json') return await parseGoogleCloud(provider);
    if (provider.sourceType === 'slack') return await parseSlack(provider);
    if (provider.sourceType === 'html-limited') return await parseHtmlLimited(provider);
    if (provider.sourceType === 'limited-microsoft') return await parseLimitedMicrosoft(provider);
    return providerResult(provider, 'Unsupported source type', 'blue', [], false);
  } catch (error) {
    return providerResult(provider, 'Source unavailable', 'blue', [], false, String(error.message || error));
  }
}

function incidentWeight(item) {
  return (item.priority || 0) + (sev[item.color] || 0) * 20;
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
  fs.writeFileSync(path.join(__dirname, '..', 'status.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(`Wrote status.json with ${incidents.length} active incidents from ${results.length} providers`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
