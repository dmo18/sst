import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

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
  },
  backblaze: {
    mode: 'status-html',
    url: 'https://status.backblaze.com/',
    sourceName: 'Backblaze public status page',
    render: true
  }
};

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

export function providerSpecificConclusion(provider, html) {
  const text = cleanRenderedText(html);
  if (!text) return null;

  switch (provider.id) {
    case 'ringcentral': {
      const active = /A portion of customers may be experiencing[\s\S]{0,1200}|Incident status updates[\s\S]{0,1200}/i.exec(text);
      if (active) return issue(provider.name, active[0].slice(0, 800));
      if (/No issues are being reported/i.test(text)) return healthy('RingCentral reports no issues');
      return null;
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

export function renderPublicPage(source) {
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

  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--virtual-time-budget=12000',
    '--dump-dom',
    source.url
  ], {
    encoding: 'utf8',
    timeout: 25000,
    maxBuffer: 5 * 1024 * 1024
  });
  const body = result.stdout || '';
  const ok = result.status === 0 && body.length >= 500;
  const error = result.error?.message || (result.signal ? `Renderer terminated by ${result.signal}` : '');
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
      error
    }
  };
}
