function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)));
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableSection(html, zoneName) {
  const source = String(html || '');
  const startPattern = new RegExp(`<table\\b[^>]*data-zone-name=["']${zoneName}["'][^>]*>`, 'i');
  const start = startPattern.exec(source);
  if (!start) return '';
  const end = source.indexOf('</table>', start.index + start[0].length);
  return end >= 0 ? source.slice(start.index, end + 8) : '';
}

function tagBlocks(value, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?</${tagName}>`, 'gi');
  return [...String(value || '').matchAll(pattern)].map(match => match[0]);
}

function statusLabel(cell) {
  const label = /data-label=["']([^"']+)["']/i.exec(String(cell || ''))?.[1];
  return cleanText(label || cell);
}

function normalizeHeader(value) {
  return cleanText(value).replace(/^\*+/, '').trim();
}

function isUsHeader(value) {
  const header = normalizeHeader(value);
  return /non-regional/i.test(header) || /\bUS(?:\s+\d+)?\b/i.test(header);
}

export function extractAzureEntraAmericasRow(html) {
  const americas = tableSection(html, 'americas');
  if (!americas) return null;

  const headers = tagBlocks(americas, 'th').map(cleanText);
  const row = tagBlocks(americas, 'tr').find(block => /Microsoft Entra ID(?:\s*\(formerly Azure AD\))?/i.test(cleanText(block)));
  if (!row) return null;

  const cells = tagBlocks(row, 'td');
  if (cells.length < 2) return null;

  const statuses = cells.slice(1).map((cell, index) => ({
    region: headers[index + 1] || (index === 0 ? '*Non-Regional' : `Unknown region ${index + 1}`),
    status: statusLabel(cell)
  }));
  const relevant = statuses.filter(item => isUsHeader(item.region));

  return {
    service: 'Microsoft Entra ID',
    headers,
    statuses,
    relevant: relevant.length ? relevant : statuses.slice(0, 1)
  };
}

function ignoredStatus(value) {
  return /^(?:not available|n\/?a|unknown|)$/i.test(String(value || '').trim());
}

function healthyStatus(value) {
  return /^(?:good|operational|available|normal|ok)$/i.test(String(value || '').trim());
}

function criticalStatus(value) {
  return /\b(?:critical|major|outage|unavailable|down)\b/i.test(String(value || ''));
}

function degradedStatus(value) {
  return /\b(?:warning|degrad|information|partial|impact|issue)\b/i.test(String(value || ''));
}

export function parseAzureEntraStatus(html) {
  const parsed = extractAzureEntraAmericasRow(html);
  if (!parsed) {
    return {
      kind: 'limited',
      message: 'The Azure public status page did not expose a readable Microsoft Entra ID row in the Americas table.'
    };
  }

  const components = parsed.relevant.map(item => ({
    name: normalizeHeader(item.region) || item.region,
    status: item.status
  }));
  const applicable = components.filter(item => !ignoredStatus(item.status));
  const critical = applicable.filter(item => criticalStatus(item.status));
  const degraded = applicable.filter(item => degradedStatus(item.status));

  if (critical.length) {
    return {
      kind: 'component-state',
      color: 'red',
      status: 'Microsoft Entra ID public status reports a critical US issue',
      message: critical.map(item => `${item.name}: ${item.status}`).join('; '),
      components
    };
  }

  if (degraded.length) {
    return {
      kind: 'component-state',
      color: 'amber',
      status: 'Microsoft Entra ID public status reports a US service issue',
      message: degraded.map(item => `${item.name}: ${item.status}`).join('; '),
      components
    };
  }

  if (applicable.length > 0 && applicable.every(item => healthyStatus(item.status))) {
    return {
      kind: 'healthy',
      status: 'Microsoft Entra ID public status is Good across currently reported US scope',
      components
    };
  }

  return {
    kind: 'limited',
    message: 'The Microsoft Entra ID Americas row was found, but its current US status could not be determined safely.',
    components
  };
}
