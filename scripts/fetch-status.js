const fs = require('fs');
const path = require('path');

const providers = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'providers.json'), 'utf8'));

const sev = { red: 3, amber: 2, blue: 1, green: 0 };

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function colorFromText(value) {
  const text = String(value || '').toLowerCase();
  if (/critical|major|outage|red|unavailable/.test(text)) return 'red';
  if (/minor|degrad|partial|maintenance|warn|yellow|amber|investigat|monitor|issue|disruption/.test(text)) return 'amber';
  if (/none|operational|ok|good|normal|resolved|available/.test(text)) return 'green';
  return 'blue';
}

function matchesService(provider, title, note) {
  if (!provider.services || provider.services.length === 0) return true;
  if (provider.sourceType === 'limited') return true;
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

async function parseStatuspage(provider) {
  const data = await getJson(provider.url);
  const description = data.status?.description || 'Operational';
  const indicator = data.status?.indicator || 'none';
  const incidents = [...(data.incidents || []), ...(data.scheduled_maintenances || [])]
    .filter(item => !/(resolved|completed)/i.test(item.status || ''))
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
        color: colorFromText(`${item.impact || ''} ${item.status || ''} ${indicator}`),
        priority: provider.priority
      };
    })
    .filter(item => matchesService(provider, item.title, item.note));

  const color = incidents.length ? incidents.reduce((max, item) => sev[item.color] > sev[max] ? item.color : max, colorFromText(`${indicator} ${description}`)) : colorFromText(`${indicator} ${description}`);

  return providerResult(provider, description, color, incidents, true);
}

async function parseAwsRss(provider) {
  const xml = await getText(provider.url);
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 30).map(match => {
    const item = match[1];
    const title = stripHtml((item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i) || [])[1] || (item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const note = stripHtml((item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i) || [])[1] || (item.match(/<description>([\s\S]*?)<\/description>/i) || [])[1]);
    const pubDate = stripHtml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const isClear = /service is operating normally|informational message/i.test(`${title} ${note}`);
    return { providerId: provider.id, provider: provider.name, category: provider.category, title, note, source: 'AWS RSS', url: provider.url, time: shortTime(pubDate), color: isClear ? 'green' : 'amber', priority: provider.priority };
  }).filter(item => item.title && item.color !== 'green' && matchesService(provider, item.title, item.note));
  return providerResult(provider, items.length ? `${items.length} public RSS event${items.length === 1 ? '' : 's'}` : 'No current RSS events', items.length ? 'amber' : 'green', items.slice(0, 8), true);
}

async function parseGoogleCloud(provider) {
  const data = await getJson(provider.url);
  const list = Array.isArray(data) ? data : [];
  const incidents = list.filter(item => !/resolved/i.test(`${item.status_impact || ''} ${item.current_status || ''}`)).map(item => {
    const updates = item.updates || [];
    const update = updates[0] || updates[updates.length - 1] || {};
    const title = stripHtml(item.external_desc || item.name || 'Google Cloud incident');
    const note = stripHtml(update.text || item.most_recent_update?.text || item.status_impact || 'No detail text provided by feed.');
    return { providerId: provider.id, provider: provider.name, category: provider.category, title, note, source: 'Google Cloud JSON', url: provider.url, time: shortTime(item.begin || item.created), color: colorFromText(`${item.severity || ''} ${item.status_impact || ''} ${item.current_status || ''}`), priority: provider.priority };
  }).filter(item => matchesService(provider, item.title, item.note)).slice(0, 8);
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
    color: 'amber',
    priority: provider.priority
  })).filter(item => matchesService(provider, item.title, item.note));
  return providerResult(provider, incidents.length ? `${incidents.length} active issue${incidents.length === 1 ? '' : 's'}` : (data.status || 'Operational'), incidents.length ? 'amber' : 'green', incidents, true);
}

async function parseHtmlLimited(provider) {
  await getText(provider.url);
  return providerResult(provider, 'Public page reachable', 'blue', [], true, 'Public page needs custom parser or limited detail');
}

async function parseLimited(provider) {
  return providerResult(provider, 'Public summary limited', 'blue', [], true, 'Detailed service health requires authenticated Microsoft Graph');
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
    if (provider.sourceType === 'html') return await parseHtmlLimited(provider);
    if (provider.sourceType === 'limited') return await parseLimited(provider);
    return providerResult(provider, 'Unsupported source type', 'blue', [], false);
  } catch (error) {
    return providerResult(provider, 'Source unavailable', 'blue', [{ providerId: provider.id, provider: provider.name, category: provider.category, title: 'Feed could not be read', note: String(error.message || error), source: provider.url, url: provider.url, time: 'now', color: 'blue', priority: provider.priority }], false, String(error.message || error));
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
  console.log(`Wrote status.json with ${incidents.length} incidents from ${results.length} providers`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
