import { parseStatuspageSummary } from './structured-source-adapters.mjs';

export const fullReviewOverrides = {
  kaseya: {
    mode: 'statuspage-json',
    url: 'https://status.kaseya.com/api/v2/summary.json',
    pageUrl: 'https://status.kaseya.com/',
    sourceName: 'Kaseya official Statuspage JSON',
    regionScope: 'us'
  },
  lastpass: {
    mode: 'statuspage-json',
    url: 'https://status.lastpass.com/api/v1/status.json',
    pageUrl: 'https://status.lastpass.com/',
    feedCandidates: ['https://status.lastpass.com/history.rss'],
    sourceName: 'LastPass official Rootly status JSON',
    regionScope: 'us'
  },
  '8x8': {
    mode: 'statuscast-json',
    url: 'https://8x8status.status.page/summary.json',
    pageUrl: 'https://status.8x8.com/',
    sourceName: '8x8 official StatusCast JSON',
    regionScope: 'us'
  }
};

function safeJson(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clean(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
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

function toIso(value) {
  if (!value) return '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function statusCastUpdates(incident) {
  const posts = Array.isArray(incident?.Posts) ? incident.Posts : [];
  return posts
    .map(post => ({
      status: clean(post?.Status || post?.PostType || incident?.Status || ''),
      note: clean(post?.Text || post?.Message || post?.Description || ''),
      at: toIso(post?.DateCreated || post?.DateUpdated || post?.Date || post?.CreatedAt || '')
    }))
    .filter(update => update.status || update.note || update.at)
    .sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
    .slice(0, 8);
}

function explicitNonUsOnly(value) {
  const text = clean(value);
  const us = /\b(?:united states|u\.s\.|usa|us|north america|americas|global|worldwide|all regions|multiple regions)\b/i.test(text);
  const nonUs = /\b(?:emea|europe|european|uk|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|japan|singapore|india|brazil)\b/i.test(text);
  return nonUs && !us;
}

function serviceImpact(value) {
  return /\b(?:major outage|partial outage|outage|unavailable|service down|degrad(?:ed|ation|ing)|performance issue|service disruption|service issue|latency|elevated errors?|failed requests?|connection failures?|intermittent|customers? (?:are|is) (?:currently )?(?:affected|impacted|unable|experiencing)|users? (?:are|is) (?:currently )?(?:affected|impacted|unable|experiencing))\b/i.test(clean(value));
}

function informationalOnly(value) {
  const text = clean(value);
  const noImpact = /\b(?:no planned impact to availability|no impact to (?:service|availability)|without service impact|informational only)\b/i.test(text);
  const editorial = /\b(?:knowledge\s*base|knowledgebase|support portal|documentation|release notes?|new user interface|static links?|bookmarked links?)\b/i.test(text);
  return noImpact || (editorial && !serviceImpact(text));
}

function statusCastColor(value) {
  return /\b(?:major|critical|complete outage|service down|unavailable)\b/i.test(clean(value)) ? 'red' : 'amber';
}

export function parseStatusCastSummary(value, provider = {}, source = {}) {
  const json = safeJson(value);
  if (!json || typeof json !== 'object' || !('Status' in json) || !Array.isArray(json.UnresolvedIncidents)) return null;

  const incidents = [];
  let explicitNonUsCount = 0;
  let ignoredInformationalCount = 0;

  for (const incident of json.UnresolvedIncidents) {
    const updates = statusCastUpdates(incident);
    const latest = updates[0] || {};
    const title = clean(incident?.Title || incident?.Name || '');
    const note = clean(latest.note || incident?.Description || incident?.Message || '');
    const status = clean(incident?.Status || incident?.IncidentType || 'active');
    const combined = `${title} ${note} ${status} ${incident?.IncidentType || ''}`;
    if (!title) continue;
    if (explicitNonUsOnly(combined) && source.regionScope !== 'global') {
      explicitNonUsCount += 1;
      continue;
    }
    if (informationalOnly(combined) || (/\binformational\b/i.test(String(incident?.IncidentType || '')) && !serviceImpact(combined))) {
      ignoredInformationalCount += 1;
      continue;
    }
    if (!serviceImpact(combined)) continue;

    const firstDetected = toIso(incident?.StartDate || incident?.DateCreated || updates.at(-1)?.at || '');
    const latestUpdate = toIso(incident?.DateUpdated || latest.at || incident?.DateCreated || incident?.StartDate || '');
    incidents.push({
      id: String(incident?.Id || incident?.ExternalId || ''),
      title,
      note: note || '8x8 reports an active service-impacting incident.',
      status: status || 'active',
      firstDetected,
      latestUpdate,
      affectedService: /\bamericas\b/i.test(combined) ? 'Americas' : '8x8 services',
      color: statusCastColor(combined),
      url: incident?.ShortUrl || source.pageUrl || source.url,
      updates
    });
  }

  if (incidents.length) return { kind: 'issues', incidents: incidents.slice(0, 12), maintenance: [], components: [] };

  const overall = clean(`${json.Status || ''} ${json.StatusText || ''}`);
  if (/\b(?:available|operational|normal|informational|information)\b/i.test(overall)) {
    const suffix = ignoredInformationalCount
      ? '; current informational notices do not report service impact'
      : explicitNonUsCount
        ? '; no active US-relevant service incident is reported'
        : '';
    return {
      kind: 'healthy',
      status: `8x8 reports ${clean(json.StatusText || json.Status || 'normal service').toLowerCase()}${suffix}`,
      maintenance: [],
      components: []
    };
  }

  if (explicitNonUsCount === json.UnresolvedIncidents.length && explicitNonUsCount > 0) {
    return { kind: 'healthy', status: '8x8 reports no active US-relevant service incidents', maintenance: [], components: [] };
  }

  if (/\b(?:degraded|performance|outage|unavailable|disruption|issue)\b/i.test(overall)) {
    return {
      kind: 'component-state',
      status: clean(json.StatusText || json.Status),
      color: statusCastColor(overall),
      message: '8x8 StatusCast reports a current service-impacting state without a specific US incident record in the summary.',
      maintenance: [],
      components: [{ name: '8x8 service status', status: clean(json.Status || json.StatusText) }]
    };
  }

  return null;
}

export function fullReviewConclusion(provider, value) {
  const source = fullReviewOverrides[provider?.id];
  if (!source) return null;
  if (provider.id === 'kaseya' || provider.id === 'lastpass') return parseStatuspageSummary(value, provider, source);
  if (provider.id === '8x8') return parseStatusCastSummary(value, provider, source);
  return null;
}
