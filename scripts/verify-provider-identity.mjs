import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [targetUrl, desktopScreenshot = '/tmp/operator-providers.png', mobileScreenshot = '/tmp/operator-providers-mobile.png'] = process.argv.slice(2);
const browser = process.env.BROWSER;

if (!targetUrl) throw new Error('Usage: node scripts/verify-provider-identity.mjs <url> [desktop.png] [mobile.png]');
if (!browser) throw new Error('BROWSER environment variable is required.');

const url = new URL(targetUrl);
url.searchParams.set('view', 'providers');
const profile = `/tmp/provider-identity-${process.pid}`;
const common = [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--virtual-time-budget=7000',
  `--user-data-dir=${profile}`
];

function run(args, label, encoding) {
  const result = spawnSync(browser, args, {
    encoding,
    timeout: 35_000,
    maxBuffer: 12 * 1024 * 1024,
    stdio: encoding ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'pipe']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}: ${String(result.stderr || '').slice(-2400)}`);
  return result;
}

try {
  const domResult = run([...common, '--window-size=1440,960', '--dump-dom', url.href], 'Provider identity DOM probe', 'utf8');
  const html = String(domResult.stdout || '');
  if (!/Provider operations/i.test(html)) throw new Error('Provider operations view did not render.');
  if (/Status intelligence unavailable/i.test(html)) throw new Error('Provider identity verification rendered the unavailable state.');
  if (!/>NUSO</.test(html)) throw new Error('NUSO is missing from the deployed provider workspace.');

  const providerIdentityCount = (html.match(/class="provider-identity(?:\s|\")/g) || []).length;
  const brandMaskCount = (html.match(/provider-logo--brand-mask/g) || []).length;
  const generatedCount = (html.match(/provider-logo--generated/g) || []).length;
  const localLogoAssets = (html.match(/assets\/logos\//g) || []).length;
  const externalLogoSrc = [...html.matchAll(/<(?:img|span)[^>]*class="[^"]*provider-logo[^"]*"[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => /(?:src|--provider-logo-mask):?\s*=?.*https?:\/\//i.test(tag));

  if (providerIdentityCount < 80) throw new Error(`Expected at least 80 provider identities, found ${providerIdentityCount}.`);
  if (brandMaskCount < 25) throw new Error(`Expected broad exact-brand coverage, found only ${brandMaskCount} masked marks.`);
  if (generatedCount < 20) throw new Error(`Expected curated niche-provider identities, found only ${generatedCount}.`);
  if (localLogoAssets < 25) throw new Error(`Expected local bundled logo assets, found only ${localLogoAssets} references.`);
  if (externalLogoSrc.length) throw new Error(`Provider identity attempted external logo loading: ${externalLogoSrc[0]}`);

  run([...common, '--window-size=1440,960', `--screenshot=${desktopScreenshot}`, url.href], 'Provider identity desktop screenshot');
  run([...common, '--window-size=390,844', `--screenshot=${mobileScreenshot}`, url.href], 'Provider identity mobile screenshot');
  const desktopBytes = fs.statSync(desktopScreenshot).size;
  const mobileBytes = fs.statSync(mobileScreenshot).size;
  if (desktopBytes <= 30_000 || mobileBytes <= 20_000) throw new Error(`Provider screenshots are unexpectedly small: desktop=${desktopBytes}, mobile=${mobileBytes}.`);

  console.log(`PROVIDER_IDENTITY providers=${providerIdentityCount} exact_masks=${brandMaskCount} curated_generated=${generatedCount} local_assets=${localLogoAssets}`);
  console.log(`PROVIDER_IDENTITY_NUSO present=true desktop=${desktopBytes} mobile=${mobileBytes}`);
}
finally {
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { }
}
