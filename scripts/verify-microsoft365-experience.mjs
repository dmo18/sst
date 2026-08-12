import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [targetUrl, desktopScreenshot = '/tmp/operator-m365.png', mobileScreenshot = '/tmp/operator-m365-mobile.png'] = process.argv.slice(2);
const browser = process.env.BROWSER;

if (!targetUrl) throw new Error('Usage: node scripts/verify-microsoft365-experience.mjs <url> [desktop.png] [mobile.png]');
if (!browser) throw new Error('BROWSER environment variable is required.');

const url = new URL(targetUrl);
url.searchParams.set('m365', '1');
const profile = `/tmp/m365-experience-${process.pid}`;
const common = [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--virtual-time-budget=6500',
  `--user-data-dir=${profile}`
];

function run(args, label, encoding) {
  const result = spawnSync(browser, args, {
    encoding,
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: encoding ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}: ${String(result.stderr || '').slice(-2000)}`);
  return result;
}

function sourceCardState(html, providerId) {
  const match = new RegExp(`<button\\b([^>]*)data-provider-id="${providerId}"([^>]*)>`, 'i').exec(html);
  if (!match) throw new Error(`Microsoft 365 deployed surface is missing source card ${providerId}.`);
  const attributes = `${match[1]} ${match[2]}`;
  return {
    className: /class="([^"]*)"/i.exec(attributes)?.[1] || '',
    serviceState: /data-service-state="([^"]*)"/i.exec(attributes)?.[1] || '',
    evidenceTone: /data-evidence-tone="([^"]*)"/i.exec(attributes)?.[1] || ''
  };
}

function assertServiceTone(providerId, card) {
  const expected = card.serviceState === 'major'
    ? 'is-critical'
    : card.serviceState === 'degraded'
      ? 'is-warning'
      : card.serviceState === 'operational'
        ? 'is-positive'
        : 'is-unknown';
  if (!card.className.split(/\s+/).includes(expected)) {
    throw new Error(`${providerId} service state ${card.serviceState || 'missing'} rendered ${card.className || 'no class'} instead of ${expected}; evidence=${card.evidenceTone || 'missing'}.`);
  }
  if (card.serviceState === 'operational' && card.className.includes('is-warning')) {
    throw new Error(`${providerId} operational service was promoted to a warning by evidence state.`);
  }
}

try {
  const domResult = run([...common, '--window-size=1440,960', '--dump-dom', url.href], 'Microsoft 365 DOM probe', 'utf8');
  const html = String(domResult.stdout || '');
  for (const required of [
    'data-m365-critical-suite="open"',
    'Microsoft 365 coverage',
    'Microsoft 365 broad public signal',
    'Microsoft 365 suite',
    'Exchange Online',
    'Microsoft Teams',
    'SharePoint Online',
    'OneDrive for Business',
    'Microsoft Entra ID',
    'Microsoft Intune',
    'Microsoft 365 Apps',
    'Microsoft Defender for Microsoft 365',
    'Microsoft Power Platform',
    'Public does not mean tenant-complete',
    'Service truth and evidence quality are deliberately separate',
    'ServiceHealth.Read.All',
    '/admin/serviceAnnouncement/healthOverviews',
    '/admin/serviceAnnouncement/issues',
    'data-m365-current-incidents=',
    'data-evidence-tone='
  ]) {
    if (!html.includes(required)) throw new Error(`Microsoft 365 deployed surface is missing ${JSON.stringify(required)}.`);
  }
  const facetCount = (html.match(/data-m365-service=/g) || []).length;
  if (facetCount !== 10) throw new Error(`Microsoft 365 deployed surface expected 10 service facets, found ${facetCount}.`);
  if (/Status intelligence unavailable/i.test(html)) throw new Error('Microsoft 365 verification rendered the unavailable state.');

  const microsoft = sourceCardState(html, 'microsoft365');
  const entra = sourceCardState(html, 'entra');
  assertServiceTone('microsoft365', microsoft);
  assertServiceTone('entra', entra);

  if (microsoft.serviceState === 'operational') {
    const umbrellaInformationalCount = (html.match(/m365-service-card is-informational/g) || []).length;
    if (umbrellaInformationalCount < 8) {
      throw new Error(`Microsoft broad source is operational but only ${umbrellaInformationalCount} umbrella facets preserve the non-granular informational boundary.`);
    }
  }

  run([...common, '--window-size=1440,960', `--screenshot=${desktopScreenshot}`, url.href], 'Microsoft 365 desktop screenshot');
  run([...common, '--window-size=390,844', `--screenshot=${mobileScreenshot}`, url.href], 'Microsoft 365 mobile screenshot');

  const desktopBytes = fs.statSync(desktopScreenshot).size;
  const mobileBytes = fs.statSync(mobileScreenshot).size;
  if (desktopBytes <= 10_000 || mobileBytes <= 10_000) throw new Error(`Microsoft 365 screenshots are unexpectedly small: desktop=${desktopBytes}, mobile=${mobileBytes}.`);

  console.log(`MICROSOFT365_CRITICAL facets=${facetCount} desktop=${desktopBytes} mobile=${mobileBytes}`);
  console.log(`MICROSOFT365_SERVICE_TRUTH microsoft365=${microsoft.serviceState}/${microsoft.className} evidence=${microsoft.evidenceTone} entra=${entra.serviceState}/${entra.className} evidence=${entra.evidenceTone}`);
  console.log('MICROSOFT365_EVIDENCE public-broad + dedicated-entra; tenant-detail=private-graph-required; evidence-health-does-not-set-service-tone');
}
finally {
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { }
}
