import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { incidentDetailOverrides, providerIncidentConclusion } from './incident-detail-repairs.mjs';
import { fullReviewConclusion, fullReviewOverrides } from './full-review-source-adapters.mjs';

const execFileAsync = promisify(execFile);

export const additionalPublicOverrides = {
  ringcentral: {
    mode: 'status-html',
    url: 'https://status.ringcentral.com/',
    sourceName: 'RingCentral public status dashboard',
    render: true
  },
  sophos: {
    mode: 'status-html',
    url: 'https://sophoscentral.status.page/',
    sourceName: 'Sophos Central public status page'
  },
  'bitdefender-gravityzone': {
    mode: 'status-html',
    url: 'https://ssems.gravityzone.bitdefender.com/',
    sourceName: 'Bitdefender GravityZone public status page'
  },
  bitwarden: {
    mode: 'status-html',
    url: 'https://status.bitwarden.com/',
    feedCandidates: ['https://status.bitwarden.com/state_feed/feed.atom'],
    sourceName: 'Bitwarden public status page'
  },
  'cove-data-protection': {
    mode: 'status-html',
    url: 'https://uptime.n-able.com/',
    sourceName: 'N-able public service status dashboard',
    render: true
  },
  crashplan: {
    mode: 'status-html',
    url: 'https://status.crashplan.com/',
    sourceName: 'CrashPlan public status page'
  },
  fortinet: {
    mode: 'status-html',
    url: 'https://status.forticloud.com/',
    feedCandidates: [
      'https://status.forticloud.com/history.rss',
      'https://status.forticloud.com/history.atom'
    ],
    sourceName: 'FortiCloud public status hub'
  },
  keeper: {
    mode: 'status-html',
    url: 'https://statuspage.keeper.io/',
    feedCandidates: [
      'https://statuspage.keeper.io/history.rss',
      'https://statuspage.keeper.io/history.atom'
    ],
    sourceName: 'Keeper public status page'
  },
  malwarebytes: {
    mode: 'status-html',
    url: 'https://status.malwarebytes.com/',
    sourceName: 'ThreatDown public system status',
    render: true
  },
  superops: {
    mode: 'status-html',
    url: 'https://status.superops.com/',
    feedCandidates: ['https://status.superops.com/feed'],
    sourceName: 'SuperOps public status page'
  },
  syncro: {
    mode: 'status-html',
    url: 'https://www.syncrostatus.com/',
    feedCandidates: ['https://www.syncrostatus.com/state_feed/feed.atom'],
    sourceName: 'Syncro public status page'
  },
  okta: {
    mode: 'status-html',
    url: 'https://status.okta.com/',
    sourceName: 'Okta public status page',
    regionScope: 'us'
  },
  salesforce: {
    mode: 'status-html',
    url: 'https://status.salesforce.com/current',
    sourceName: 'Salesforce Trust public status page',
    render: true
  },
  zendesk: {
    mode: 'status-html',
    url: 'https://status.zendesk.com/',
    sourceName: 'Zendesk public status page',
    render: true
  }
};

Object.assign(additionalPublicOverrides, incidentDetailOverrides);
Object.assign(additionalPublicOverrides, fullReviewOverrides);

function cleanRenderedText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const globalRegionPattern = /\b(?:global|worldwide|all regions|all customers|multiple regions|across regions)\b/i;
const usRegionPattern = /\b(?:united states|u\.s\.|usa|us|us customers?|us cells?|north america|america east|america west|us[- ](?:east|west|central|north|south)(?:[- ]\d+)?|us(?:e|w|c)\d+)\b|\bokta\.com:\d+\b|\boktapreview\.com:\d+\b/i;
const nonUsRegionPattern = /\b(?:emea|europe|eu(?:rope)?(?:[- ]?(?:cell|region|zone))?[- ]?\d*|uk(?:[- ]?(?:cell|region|zone))?[- ]?\d*|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|germany|german|france|spain|japan|singapore|india|brazil|okta-emea\.com:\d+)\b|\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)\d+(?:[-_a-z0-9]*)\b/i;

export function isUsRelevantIncident(value) {
  const text = cleanRenderedText(value);
  if (!text) return true;
  if (globalRegionPattern.test(text) || usRegionPattern.test(text)) return true;
  return !nonUsRegionPattern.test(text);
}

function healthy(status) {
  return { kind: 'healthy', status };
}

function issue(providerName, note, color = 'amber') {
  return {
    kind: 'issue',
    color,
    title: `${providerName} public status reports an active issue`,
    note
  };
}

function decodeEmbeddedJson(value) {
  return String(value || '')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractMarkedJsonObjects(value, marker) {
  const text = decodeEmbeddedJson(value);
  const records = [];
  let cursor = 0;
  while (cursor < text.length) {
    const markerIndex = text.indexOf(marker, cursor);
    if (markerIndex < 0) break;
    const start = text.lastIndexOf('{"attributes"', markerIndex);
    if (start < cursor) {
      cursor = markerIndex + marker.length;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') {
        inString = true;
        continue;
      }
      if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    if (end < 0) break;
    try {
      records.push(JSON.parse(text.slice(start, end)));
    } catch { }
    cursor = end;
  }
  return records;
}

export function parseOktaIncidentRecords(html) {
  return extractMarkedJsonObjects(html, '"type":"Incident__c"')
    .filter(record => record && typeof record === 'object' && record.Incident_Title__c);
}

function oktaConclusion(html) {
  const records = parseOktaIncidentRecords(html);
  if (!records.length) return null;
  const active = records.filter(record => !/\b(?:resolved|completed|closed|postmortem|cancelled)\b/i.test(String(record.Status__c || '')));
  const activeUs = active.filter(record => isUsRelevantIncident([
    record.Incident_Title__c,
    record.Log__c,
    record.Impacted_Cells__c,
    record.CurrencyIsoCode
  ].filter(Boolean).join(' ')));
  if (!activeUs.length) return healthy('Okta reports no active US service incidents');
  return {
    kind: 'issues',
    incidents: activeUs.map(record => {
      const text = `${record.Incident_Title__c || ''} ${record.Log__c || ''} ${record.Category__c || ''}`;
      return {
        title: record.Incident_Title__c || record.Name || 'Okta service incident',
        note: record.Log__c || 'Okta reports an active service incident.',
        color: record.Is_Mis_Red__c === true || /\b(?:critical|major outage|complete outage|unavailable)\b/i.test(text) ? 'red' : 'amber',
        firstDetected: record.Start_Time__c || record.CreatedDate || record.Start_Date__c || '',
        latestUpdate: record.Last_Updated__c || record.LastModifiedDate || record.CreatedDate || '',
        status: record.Status__c || 'active',
        affectedService: [record.Okta_Sub_Service__c, record.Service_Feature__c].filter(Boolean).join(' / ')
      };
    })
  };
}

function eightByEightConclusion(text) {
  const statusStart = text.search(/Service Status/i);
  if (statusStart < 0) return null;
  const status = text.slice(statusStart, statusStart + 24000);
  const americasStart = status.search(/\bAmericas\b/i);
  if (americasStart < 0) return null;
  const tail = status.slice(americasStart);
  const nextRegion = tail.search(/\b(?:EMEA|APAC)\b/i);
  const americas = nextRegion > 0 ? tail.slice(0, nextRegion) : tail.slice(0, 10000);
  const problem = /\b(?:Investigating|Monitoring|Identified|Performance Issue|Service Outage|Outage)\b/i.exec(americas);
  if (problem) return { kind: 'limited', message: '8x8 Americas currently reports ' + problem[0] + '; a specific incident record was not derived from the service matrix.' };
  const normalCount = (americas.match(/\bNormal\b/gi) || []).length;
  return normalCount >= 5 ? healthy('8x8 Americas services report normal status') : null;
}

export function providerSpecificConclusion(provider, html) {
  const text = cleanRenderedText(html);
  if (!text) return null;
  const reviewed = fullReviewConclusion(provider, html);
  if (reviewed) return reviewed;
  if (provider.id === '8x8') {
    const scoped = eightByEightConclusion(text);
    if (scoped) return scoped;
  }
  const detailed = providerIncidentConclusion(provider, html);
  if (detailed) return detailed;

  switch (provider.id) {
    case 'ringcentral': {
      const active = /A portion of customers may be experiencing[\s\S]{0,1200}|Incident status updates[\s\S]{0,1200}/i.exec(text);
      if (active) return issue(provider.name, active[0].slice(0, 800));
      if (/No issues are being reported/i.test(text)) return healthy('RingCentral reports no issues');
      return null;
    }
    case '8x8': {
      const statusStart = text.search(/Service Status/i);
      if (statusStart < 0) return null;
      const status = text.slice(statusStart, statusStart + 24000);
      const americasStart = status.search(/\bAmericas\b/i);
      if (americasStart < 0) return null;
      const tail = status.slice(americasStart);
      const nextRegion = tail.search(/\b(?:EMEA|APAC)\b/i);
      const americas = nextRegion > 0 ? tail.slice(0, nextRegion) : tail.slice(0, 10000);
      const problem = /\b(?:Investigating|Monitoring|Identified|Performance Issue|Service Outage|Outage)\b/i.exec(americas);
      if (problem) return { kind: 'limited', message: '8x8 Americas currently reports ' + problem[0] + '; a specific incident record was not derived from the service matrix.' };
      const normalCount = (americas.match(/\bNormal\b/gi) || []).length;
      return normalCount >= 5 ? healthy('8x8 Americas services report normal status') : null;
    }
    case 'sophos':
      return /All systems normal/i.test(text) ? healthy('Sophos reports all systems normal') : null;
    case 'bitdefender-gravityzone':
      return /All systems are go/i.test(text) ? healthy('Bitdefender GravityZone reports all systems are go') : null;
    case 'bitwarden':
      return /Operating Normally/i.test(text) ? healthy('Bitwarden reports normal operation') : null;
    case 'cove-data-protection': {
      const activeStart = text.search(/Active Incidents/i);
      if (activeStart < 0) return null;
      const activeTail = text.slice(activeStart);
      const boundary = activeTail.search(/\b(?:Resolved Incidents|Past Incidents|Incident History|Scheduled Events|Maintenance Events)\b/i);
      const activeSection = boundary > 0 ? activeTail.slice(0, boundary) : activeTail.slice(0, 30000);
      const coveIndex = activeSection.search(/Cove Data Protection/i);
      if (coveIndex >= 0) return issue(provider.name, activeSection.slice(Math.max(0, coveIndex - 180), coveIndex + 1200));
      return healthy('N-able reports no active Cove Data Protection incident');
    }
    case 'crashplan':
      return /All Systems Operational/i.test(text) ? healthy('CrashPlan reports all systems operational') : null;
    case 'fortinet':
      return /All Systems Operational/i.test(text) ? healthy('FortiCloud reports all systems operational') : null;
    case 'keeper':
      return /All Systems Operational/i.test(text) ? healthy('Keeper reports all systems operational') : null;
    case 'malwarebytes': {
      const current = /Current Status\s+(Available|Operational|Degraded|Unavailable|Outage)/i.exec(text);
      if (!current) return null;
      if (/Available|Operational/i.test(current[1])) return healthy('ThreatDown reports current services available');
      return issue(provider.name, `Current Status ${current[1]}`, /Unavailable|Outage/i.test(current[1]) ? 'red' : 'amber');
    }
    case 'superops':
      return /All services are online/i.test(text) ? healthy('SuperOps reports all services online') : null;
    case 'syncro':
      return /Operating Normally/i.test(text) ? healthy('Syncro reports normal operation') : null;
    case 'okta':
      return oktaConclusion(html);
    case 'salesforce': {
      const start = text.search(/Current Status/i);
      if (start < 0) return null;
      const tail = text.slice(start);
      const end = tail.search(/Recently Viewed Instances/i);
      const current = end > 0 ? tail.slice(0, end) : tail.slice(0, 20000);
      const major = /(?:Major Outage|Service Outage|Unavailable)[\s\S]{0,400}\bOngoing\b/i.exec(current);
      if (major) return issue(provider.name, major[0].slice(0, 800), 'red');
      const degraded = /(?:Feature Degradation|Service Degradation|Performance Degradation|Service Disruption)[\s\S]{0,400}\bOngoing\b/i.exec(current);
      if (degraded) return issue(provider.name, degraded[0].slice(0, 800));
      if (/ID\s+Subject\s+Instances\s+Services\s+Status/i.test(current)) return healthy('Salesforce reports no active service-impacting global incident');
      return null;
    }
    case 'zendesk':
      if (/No incidents with Zendesk/i.test(text)) return healthy('Zendesk reports no active incidents');
      if (/\bStarted:\s*[A-Z][a-z]{2}\s+\d{2},\s+\d{4}/i.test(text)) return issue(provider.name, text.slice(0, 1200));
      return null;
    case 'backblaze':
      return /All systems operational\.?(?:\s+Nothing to report\.)?/i.test(text)
        ? healthy('Backblaze reports all systems operational')
        : null;
    default:
      return null;
  }
}

function chromeExecutable() {
  return [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

export async function renderPublicPage(source) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const chrome = chromeExecutable();
  if (!chrome) {
    return {
      ok: false,
      body: '',
      log: {
        timestamp: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        url: source.url,
        source_type: 'rendered-html',
        ok: false,
        status: 'renderer unavailable',
        message: 'Chrome or Chromium was not available.',
        error: 'No supported browser executable was found.'
      }
    };
  }

  try {
    const result = await execFileAsync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--virtual-time-budget=20000',
      '--dump-dom',
      source.url
    ], {
      encoding: 'utf8',
      timeout: 35000,
      maxBuffer: 5 * 1024 * 1024
    });
    const body = result.stdout || '';
    const ok = body.length >= 500;
    return {
      ok,
      body,
      log: {
        timestamp: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        url: source.url,
        source_type: 'rendered-html',
        ok,
        status: ok ? 'rendered public page' : 'render failed',
        message: ok ? `Rendered ${new TextEncoder().encode(body).byteLength} bytes from the public page.` : 'The public page could not be rendered into readable HTML.',
        error: ''
      }
    };
  } catch (error) {
    const body = typeof error?.stdout === 'string' ? error.stdout : '';
    return {
      ok: false,
      body,
      log: {
        timestamp: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedMs,
        url: source.url,
        source_type: 'rendered-html',
        ok: false,
        status: 'render failed',
        message: 'The public page could not be rendered into readable HTML.',
        error: error?.message || String(error)
      }
    };
  }
}
