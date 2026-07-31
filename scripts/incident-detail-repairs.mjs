const BLOCK_BREAK = /<\/?(?:article|section|main|header|footer|div|p|h[1-6]|li|ul|ol|table|tr|td|th|br|details|summary)[^>]*>/gi;

export const incidentDetailOverrides = {
  cloudflare: {
    mode: 'status-html',
    url: 'https://www.cloudflarestatus.com/',
    feedCandidates: [
      'https://www.cloudflarestatus.com/history.rss',
      'https://www.cloudflarestatus.com/history.atom'
    ],
    sourceName: 'Cloudflare public status page',
    regionScope: 'us'
  },
  docker: {
    mode: 'status-html',
    url: 'https://www.dockerstatus.com/',
    sourceName: 'Docker public systems status page',
    render: true,
    regionScope: 'us'
  },
  'cisco-umbrella': {
    mode: 'status-html',
    url: 'https://status.sse.cisco.com/',
    feedCandidates: [
      'https://status.sse.cisco.com/history.rss',
      'https://status.sse.cisco.com/history.atom'
    ],
    sourceName: 'Cisco Umbrella and Secure Access public status page',
    regionScope: 'us'
  },
  'n-able': {
    mode: 'status-html',
    url: 'https://uptime.n-able.com/',
    sourceName: 'N-able public uptime dashboard',
    render: true,
    regionScope: 'us'
  },
  'cove-data-protection': {
    mode: 'status-html',
    url: 'https://uptime.n-able.com/',
    sourceName: 'N-able public uptime dashboard',
    render: true,
    regionScope: 'us'
  }
};

function decode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textLines(value) {
  return decode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(BLOCK_BREAK, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function clean(value) {
  return textLines(value).join(' ').replace(/\s+/g, ' ').trim();
}

const globalRegionPattern = /\b(?:global|worldwide|all regions|all customers|multiple regions|across regions)\b/i;
const usRegionPattern = /\b(?:united states|u\.s\.|usa|us|north america|americas|us customers?|us cells?|us[- ](?:east|west|central|north|south)(?:[- ]\d+)?|us(?:e|w|c)\d+)\b/i;
const nonUsRegionPattern = /\b(?:emea|europe|european|eu(?:rope)?(?:[- ]?(?:cell|region|zone))?[- ]?\d*|uk(?:[- ]?(?:cell|region|zone))?[- ]?\d*|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|germany|france|spain|japan|singapore|india|brazil|china|beijing|hong kong|korea|dubai|uae|istanbul|türkiye|turkey|london|amsterdam|berlin|tokyo|sydney|frankfurt|paris|madrid|milan|warsaw|stockholm|kochi|kuala lumpur)\b|\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)\d+(?:[-_a-z0-9]*)\b/i;

export function isIncidentUsRelevant(item) {
  const title = clean(item?.title || '');
  const note = clean(item?.note || '');
  if (globalRegionPattern.test(title) || usRegionPattern.test(title)) return true;
  if (nonUsRegionPattern.test(title)) return false;

  const regionalDetail = [
    /(?:affected data centers?|data centers?|regions?|locations?|cells?|services impacted)\s*:?\s*([^.;]{1,300})/i.exec(note)?.[1],
    note.slice(0, 900)
  ].filter(Boolean).join(' ');
  if (globalRegionPattern.test(regionalDetail) || usRegionPattern.test(regionalDetail)) return true;
  return !nonUsRegionPattern.test(regionalDetail);
}

export function isGenericIncidentTitle(value) {
  const title = clean(value).toLowerCase().replace(/[.:\-]+$/g, '').trim();
  return /^(?:active incidents?|incident|service incident|status|status update|current status|degraded service|partial outage|major outage|report issue|this is a scheduled event|[^\n]{2,180} public status(?: page)? reports an active issue)$/i.test(title);
}

export function isEditorialIncidentEntry(item) {
  const title = clean(item?.title || '');
  const note = clean(item?.note || '');
  const text = `${title} ${note}`;
  const editorial = /\b(?:q[1-4]\s+wrap[- ]?up|quarter(?:ly)?\s+(?:wrap[- ]?up|review)|wrap[- ]?up|release notes?|what'?s new|new features?|feature release|general availability|product update|roadmap|advance notice|releasing\s+(?:monday|tuesday|wednesday|thursday|friday)|broader coverage|faster investigation|partner operations)\b/i.test(text);
  const operationalImpact = /\b(?:outage|unavailable|service down|degrad(?:ed|ation|ing)|disruption|elevated errors?|failed requests?|connection failures?|customers? (?:are|is) (?:currently )?(?:affected|impacted|unable|experiencing))\b/i.test(text);
  return editorial && !operationalImpact;
}

function isoDate(value) {
  const normalized = clean(value)
    .replace(/\s+-\s+/g, ' ')
    .replace(/\bUTC\b/i, ' UTC');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function colorFor(value) {
  return /\b(?:critical|major outage|complete outage|service down|unavailable)\b/i.test(value) ? 'red' : 'amber';
}

function plannedOnly(value) {
  const text = clean(value);
  const planned = /\b(?:this is a scheduled event|scheduled event|scheduled maintenance|planned maintenance|maintenance window|will be performing maintenance|will be performing scheduled maintenance)\b/i.test(text);
  const escalated = /\b(?:unplanned|emergency|critical incident|major service outage|widespread outage|complete outage|unexpected outage)\b/i.test(text)
    || (/\b(?:investigating|identified|monitoring)\b/i.test(text)
      && /\b(?:customers?|users?)\s+(?:are|is)\s+(?:currently\s+)?(?:experiencing|unable|affected|impacted)\b/i.test(text));
  return planned && !escalated;
}

function resolved(value) {
  return /\b(?:resolved|completed|closed|cancelled|postmortem)\b/i.test(value);
}

const STATUS_LINE = /^(Investigating|Identified|Monitoring|Update|In progress|Scheduled|Resolved|Completed)\s*[-:]\s*(.*)$/i;
const DATE_LINE = /^(?:[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s*(?:-|at)?\s*\d{1,2}:\d{2}(?::\d{2})?\s*UTC|[A-Z][a-z]{2}\s+\d{1,2},\s*\d{1,2}:\d{2}\s*UTC)$/i;
const TITLE_NOISE = /^(?:status|active incidents?|current incidents?|subscribe to incident|subscribe|components?|affected components?|affected data centers?|we'?re here to help|past incidents?|incident history|report issue|updated a few seconds ago)$/i;

function meaningfulTitle(line) {
  const value = clean(line);
  return value.length >= 5
    && value.length <= 220
    && !TITLE_NOISE.test(value)
    && !DATE_LINE.test(value)
    && !STATUS_LINE.test(value)
    && !isGenericIncidentTitle(value)
    && !/^all systems operational$/i.test(value)
    && !/^no incidents reported/i.test(value);
}

function currentStatusPageIncidents(provider, html) {
  const lines = textLines(html);
  const pastIndex = lines.findIndex(line => /^(?:past incidents?|incident history)$/i.test(line));
  const current = pastIndex >= 0 ? lines.slice(0, pastIndex) : lines.slice(0, 1200);
  const byTitle = new Map();

  for (let index = 0; index < current.length; index += 1) {
    const statusMatch = STATUS_LINE.exec(current[index]);
    if (!statusMatch) continue;
    const status = statusMatch[1];
    if (resolved(status)) continue;

    let title = '';
    for (let cursor = index - 1; cursor >= Math.max(0, index - 14); cursor -= 1) {
      if (meaningfulTitle(current[cursor])) {
        title = current[cursor];
        break;
      }
    }
    if (!title || isGenericIncidentTitle(title)) continue;

    const detail = [statusMatch[2]];
    let time = '';
    for (let cursor = index + 1; cursor < Math.min(current.length, index + 16); cursor += 1) {
      const line = current[cursor];
      if (DATE_LINE.test(line)) {
        time ||= isoDate(line);
        break;
      }
      if (STATUS_LINE.test(line) || /^(?:subscribe to incident|past incidents?)$/i.test(line)) break;
      if (!TITLE_NOISE.test(line)) detail.push(line);
    }

    const note = clean(detail.join(' ')).slice(0, 900);
    const combined = `${title} ${status} ${note}`;
    if (plannedOnly(combined) || isEditorialIncidentEntry({ title, note })) continue;
    const item = {
      title,
      note: note || `${status} update from the official status page.`,
      status: status.toLowerCase(),
      firstDetected: time,
      latestUpdate: time,
      color: colorFor(combined),
      affectedService: ''
    };
    if (!isIncidentUsRelevant(item)) continue;

    const existing = byTitle.get(title.toLowerCase());
    if (!existing || Date.parse(item.latestUpdate || '') >= Date.parse(existing.latestUpdate || '')) byTitle.set(title.toLowerCase(), item);
  }
  return [...byTitle.values()];
}

export function parseNableIncidentRecords(html) {
  const text = textLines(html).join(' ');
  const activeIndex = text.search(/\bActive Incidents?\b/i);
  if (activeIndex < 0) return [];
  const tail = text.slice(activeIndex);
  const resolvedIndex = tail.search(/\b(?:Resolved Incidents?|Past Incidents?|Incident History)\b/i);
  const active = resolvedIndex > 0 ? tail.slice(0, resolvedIndex) : tail.slice(0, 100000);
  const boundaries = [...active.matchAll(/(?:Active Incident|Planned Scheduled Maintenance|Scheduled Maintenance) ID:\s*(\d+)/gi)];
  const records = [];

  for (let index = 0; index < boundaries.length; index += 1) {
    const marker = boundaries[index];
    if (!/^Active Incident ID:/i.test(marker[0])) continue;
    const block = active.slice(marker.index, boundaries[index + 1]?.index ?? active.length);
    const id = marker[1];
    const startRaw = /Start:\s*(.+?)\s+End:/i.exec(block)?.[1] || '';
    const severity = /Severity:\s*(.+?)\s+Status:/i.exec(block)?.[1] || '';
    const statusMatch = /Status:\s*(Investigating|Identified|Monitoring|Update|Major Outage|Minor Outage|Degraded|Operational)/i.exec(block);
    const status = statusMatch?.[1] || 'active';
    const summaryStart = statusMatch ? statusMatch.index + statusMatch[0].length : 0;
    const servicesIndex = block.search(/\bServices Impacted\b/i);
    const timelineIndex = block.search(/\bTimeline\b/i);
    const summaryEnd = servicesIndex > summaryStart ? servicesIndex : timelineIndex > summaryStart ? timelineIndex : block.length;
    const summary = clean(block.slice(summaryStart, summaryEnd));
    const servicesEnd = timelineIndex > servicesIndex ? timelineIndex : block.length;
    const affectedService = servicesIndex >= 0
      ? clean(block.slice(servicesIndex + 'Services Impacted'.length, servicesEnd)).replace(/\bTimeline\b.*$/i, '').slice(0, 280)
      : '';
    const timeline = timelineIndex >= 0 ? block.slice(timelineIndex + 'Timeline'.length) : '';
    const updateMatches = [...timeline.matchAll(/(?:Update|Investigating|Identified|Monitoring)\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+UTC)\s+([\s\S]*?)(?=(?:Update|Investigating|Identified|Monitoring)\s+[A-Z][a-z]{2}\s+\d{1,2},|$)/gi)];
    const latest = updateMatches[0];
    const latestNote = clean(latest?.[2] || '');
    const firstDetected = isoDate(startRaw);
    const latestUpdate = isoDate(latest?.[1] || startRaw);
    const prefix = /^(?:N[- ]?able®?\s*)?(.+?)(?=\s+(?:There|Some|Customers?|Users?|We|An?|The)\b)/i.exec(summary)?.[1];
    const serviceTitle = clean(prefix || affectedService || 'N-able service').replace(/\s{2,}/g, ' ').slice(0, 180);
    const note = [summary, latestNote && `Latest update: ${latestNote}`].filter(Boolean).join(' ').slice(0, 900);
    records.push({
      id,
      title: `${serviceTitle}: ${severity || status}`,
      note: note || 'The N-able uptime dashboard reports an active service issue.',
      status,
      severity,
      firstDetected,
      latestUpdate,
      affectedService: affectedService || serviceTitle,
      color: colorFor(`${severity} ${status} ${summary}`),
      regionText: `${serviceTitle} ${affectedService} ${summary}`
    });
  }
  return records;
}

function nableConclusion(provider, html) {
  const allRecords = parseNableIncidentRecords(html);
  if (!allRecords.length) {
    const text = clean(html);
    if (/\b(?:no active incidents?|all services operational|all systems operational)\b/i.test(text)) {
      return { kind: 'healthy', status: `${provider.name} reports no active US-relevant incidents` };
    }
    return null;
  }

  const records = allRecords.filter(record => {
    const identityText = `${record.title} ${record.affectedService}`;
    const isCove = /\bcove(?: data protection| draas)?\b/i.test(identityText);
    const isNcentral = /\bn[- ]?central\b/i.test(identityText);
    if (provider.id === 'cove-data-protection' && (!isCove || isNcentral)) return false;
    if (provider.id === 'n-able' && isCove) return false;
    return isIncidentUsRelevant({ title: record.title, note: record.regionText });
  });

  if (!records.length) {
    return {
      kind: 'healthy',
      status: provider.id === 'cove-data-protection'
        ? 'N-able reports no active US-relevant Cove Data Protection incident'
        : 'N-able reports no active US-relevant non-Cove incident'
    };
  }
  return { kind: 'issues', incidents: records };
}

export function providerIncidentConclusion(provider, html) {
  if (!provider?.id) return null;
  if (provider.id === 'n-able' || provider.id === 'cove-data-protection') return nableConclusion(provider, html);
  if (!['cloudflare', 'docker', 'cisco-umbrella'].includes(provider.id)) return null;

  const incidents = currentStatusPageIncidents(provider, html);
  if (incidents.length) return { kind: 'issues', incidents };

  const text = clean(html);
  if (/\ball systems operational\b/i.test(text) || /\bno incidents reported(?: today)?\b/i.test(text)) {
    return { kind: 'healthy', status: `${provider.name} reports no active US-relevant incidents` };
  }

  const currentHasOnlyNonUs = currentStatusPageIncidents(
    provider,
    String(html).replace(nonUsRegionPattern, 'NON_US_REGION')
  ).length === 0 && nonUsRegionPattern.test(text);
  if (currentHasOnlyNonUs) return { kind: 'healthy', status: `${provider.name} reports no active US-relevant incidents` };
  return null;
}
