import fs from 'node:fs';
import { spawn } from 'node:child_process';

const WIDTH = 1440;
const HEIGHT = 960;
const SCALED_DESKTOP_WIDTH = 720;
const SCALED_DESKTOP_HEIGHT = 900;
const MOBILE_WIDTH = 390;
const MOBILE_HEIGHT = 844;
const DEBUG_PORT = 9228;
const TIMEOUT_MS = 20_000;
const STYLE_TIMEOUT_MS = 6_000;
const NAVIGATION_ATTEMPTS = 3;

const [targetUrl, desktopScreenshot = '/tmp/operator-providers.png', mobileScreenshot = '/tmp/operator-providers-mobile.png'] = process.argv.slice(2);
const browser = process.env.BROWSER;

if (!targetUrl) throw new Error('Usage: node scripts/verify-provider-identity.mjs <url> [desktop.png] [mobile.png]');
if (!browser) throw new Error('BROWSER environment variable is required.');
if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required.');

const profileDir = `/tmp/provider-identity-cdp-${process.pid}`;
const browserProcess = spawn(browser, [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], { stdio: ['ignore', 'ignore', 'inherit'] });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

async function waitForPageTarget() {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    }
    catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint did not become ready${lastError ? `: ${lastError.message}` : ''}`);
}

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
  }

  async open() {
    await withTimeout(new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('CDP WebSocket connection failed.')), { once: true });
      this.socket.addEventListener('message', event => this.handle(event));
    }), TIMEOUT_MS, 'CDP connection');
  }

  handle(event) {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
      return;
    }
    if (!message.method) return;
    const waiters = this.waiters.get(message.method) || [];
    this.waiters.delete(message.method);
    for (const resolve of waiters) resolve(message.params || {});
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method) {
    return withTimeout(new Promise(resolve => {
      const waiters = this.waiters.get(method) || [];
      waiters.push(resolve);
      this.waiters.set(method, waiters);
    }), TIMEOUT_MS, method);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(session, expression) {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(`Runtime evaluation failed: ${result.exceptionDetails.text || 'unknown error'}`);
  return result.result?.value;
}

async function setViewport(session, width, height, mobile = false, screenWidth = width, screenHeight = height) {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth,
    screenHeight,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });
}

async function navigate(session, url) {
  const loaded = session.waitForEvent('Page.loadEventFired');
  await session.send('Page.navigate', { url });
  await loaded;
}

function providerUrl(probe) {
  const url = new URL(targetUrl);
  url.searchParams.set('view', 'providers');
  url.searchParams.set('providerIdentityProbe', probe);
  return url.href;
}

async function waitForProviderTable(session, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(session, `(() => {
      const table = document.querySelector('.provider-data-table[aria-label="Provider operations"]');
      const identities = table ? table.querySelectorAll('.provider-identity').length : 0;
      return {
        ready: Boolean(table && identities >= 80),
        identities,
        unavailable: /Status intelligence unavailable/i.test(document.body.innerText)
      };
    })()`);
    if (last?.ready && !last?.unavailable) return last;
    await sleep(120);
  }
  throw new Error(`Provider workspace did not become structurally ready: ${JSON.stringify(last)}`);
}

async function styleContract(session, mobile) {
  return evaluate(session, `(() => {
    const shell = document.querySelector('.enterprise-shell');
    const sidebar = document.querySelector('.app-sidebar');
    const head = document.querySelector('.provider-data-table .data-table-head');
    const generated = document.querySelector('.provider-logo--generated');
    const bodyStyle = getComputedStyle(document.body);
    const shellStyle = shell ? getComputedStyle(shell) : null;
    const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;
    const headStyle = head ? getComputedStyle(head) : null;
    const generatedStyle = generated ? getComputedStyle(generated) : null;
    const styleSheets = [...document.styleSheets];
    return {
      bodyFont: bodyStyle.fontFamily,
      shellDisplay: shellStyle?.display || '',
      sidebarPosition: sidebarStyle?.position || '',
      tableHeadDisplay: headStyle?.display || '',
      generatedPadding: generatedStyle?.paddingTop || '',
      stylesheetCount: styleSheets.length,
      cssLinkCount: document.querySelectorAll('link[rel="stylesheet"]').length,
      viewportWidth: innerWidth,
      screenWidth: screen.width,
      expectedMobile: ${mobile ? 'true' : 'false'},
      ready: Boolean(
        styleSheets.length > 0 &&
        document.querySelector('link[rel="stylesheet"]') &&
        /Inter|system-ui/i.test(bodyStyle.fontFamily) &&
        generatedStyle?.paddingTop === '0px' &&
        (${mobile ? "sidebarStyle?.position === 'fixed' && headStyle?.display === 'none'" : "shellStyle?.display === 'grid' && sidebarStyle?.position !== 'fixed' && headStyle?.display !== 'none'"})
      )
    };
  })()`);
}

async function waitForProviderStyles(session, mobile, timeoutMs = STYLE_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await styleContract(session, mobile);
    if (last?.ready) return last;
    await sleep(150);
  }
  throw new Error(`Provider ${mobile ? 'mobile' : 'desktop'} styling did not become ready: ${JSON.stringify(last)}`);
}

async function navigateReadyProviderView(session, mobile) {
  let lastError;
  for (let attempt = 1; attempt <= NAVIGATION_ATTEMPTS; attempt += 1) {
    const probe = `${mobile ? 'mobile' : 'desktop'}-${Date.now()}-${attempt}`;
    try {
      await navigate(session, providerUrl(probe));
      await waitForProviderTable(session);
      const style = await waitForProviderStyles(session, mobile);
      return style;
    }
    catch (error) {
      lastError = error;
      if (attempt < NAVIGATION_ATTEMPTS) await sleep(500 * attempt);
    }
  }
  throw new Error(`Provider ${mobile ? 'mobile' : 'desktop'} view failed after ${NAVIGATION_ATTEMPTS} navigation attempts: ${lastError?.message || lastError}`);
}

async function capture(session, path) {
  const screenshot = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  fs.writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
  const bytes = fs.statSync(path).size;
  if (bytes <= 20_000) throw new Error(`Provider identity screenshot is unexpectedly small: ${path} ${bytes} bytes`);
  return bytes;
}

async function identityContract(session) {
  return evaluate(session, `(async () => {
    const table = document.querySelector('.provider-data-table[aria-label="Provider operations"]');
    const identities = [...(table?.querySelectorAll('.provider-identity') || [])];
    const logos = identities.map(identity => identity.querySelector('.provider-logo')).filter(Boolean);
    const maskUrl = element => {
      const value = element.style.getPropertyValue('--provider-logo-mask') || '';
      const match = value.match(/url\\(["']?([^"')]+)["']?\\)/i);
      return match ? match[1] : '';
    };
    const referenced = logos.map(element => element.tagName === 'IMG' ? element.getAttribute('src') || '' : maskUrl(element)).filter(Boolean);
    const resolved = referenced.map(value => new URL(value, location.href).href);
    const embeddedSvg = resolved.filter(value => value.startsWith('data:image/svg+xml,'));
    const unexpectedData = resolved.filter(value => value.startsWith('data:') && !value.startsWith('data:image/svg+xml,'));
    const networkRefs = resolved.filter(value => !value.startsWith('data:'));
    const localAssets = networkRefs.filter(value => {
      const parsed = new URL(value);
      return parsed.origin === location.origin && parsed.pathname.includes('/assets/logos/');
    });
    const external = networkRefs.filter(value => new URL(value).origin !== location.origin);
    const uniqueLocalAssets = [...new Set(localAssets)];
    const failedAssets = [];
    for (const asset of uniqueLocalAssets) {
      try {
        const response = await fetch(asset, { cache: 'no-store' });
        if (!response.ok) failedAssets.push(asset + ' HTTP ' + response.status);
      }
      catch (error) {
        failedAssets.push(asset + ' ' + String(error));
      }
    }
    const nuso = identities.find(identity => identity.querySelector('b')?.textContent?.trim() === 'NUSO');
    return {
      providerIdentityCount: identities.length,
      brandMaskCount: logos.filter(element => element.classList.contains('provider-logo--brand-mask')).length,
      generatedCount: logos.filter(element => element.classList.contains('provider-logo--generated')).length,
      embeddedSvgCount: embeddedSvg.length,
      unexpectedData,
      localLogoAssets: localAssets.length,
      uniqueLocalLogoAssets: uniqueLocalAssets.length,
      externalLogoSrc: external,
      failedAssets,
      nusoPresent: Boolean(nuso),
      nusoHasLogo: Boolean(nuso?.querySelector('.provider-logo')),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      unavailable: /Status intelligence unavailable/i.test(document.body.innerText)
    };
  })()`);
}

let session;
try {
  const page = await waitForPageTarget();
  session = new CdpSession(page.webSocketDebuggerUrl);
  await session.open();
  await session.send('Page.enable');
  await session.send('Runtime.enable');

  await setViewport(session, WIDTH, HEIGHT, false);
  const desktopStyle = await navigateReadyProviderView(session, false);
  const desktop = await identityContract(session);

  if (desktop.unavailable) throw new Error('Provider identity verification rendered the unavailable state.');
  if (!desktop.nusoPresent || !desktop.nusoHasLogo) throw new Error('NUSO is missing its deployed provider identity.');
  if (desktop.providerIdentityCount < 80) throw new Error(`Expected at least 80 provider identities, found ${desktop.providerIdentityCount}.`);
  if (desktop.brandMaskCount < 35) throw new Error(`Expected at least 35 exact masked brand marks, found ${desktop.brandMaskCount}.`);
  if (desktop.generatedCount > 35) throw new Error(`Too many providers regressed to generated recognition tiles: ${desktop.generatedCount}.`);
  if (desktop.embeddedSvgCount !== desktop.generatedCount) throw new Error(`Embedded local SVG count ${desktop.embeddedSvgCount} does not match generated identity count ${desktop.generatedCount}.`);
  if (desktop.unexpectedData.length) throw new Error(`Unexpected embedded provider asset type: ${desktop.unexpectedData[0]}`);
  if (desktop.localLogoAssets < 45) throw new Error(`Expected at least 45 local exact-logo references, found ${desktop.localLogoAssets}.`);
  if (desktop.externalLogoSrc.length) throw new Error(`Provider identity attempted external logo loading: ${desktop.externalLogoSrc[0]}`);
  if (desktop.failedAssets.length) throw new Error(`Bundled provider logo assets failed to load: ${desktop.failedAssets.join('; ')}`);
  if (desktop.horizontalOverflow > 1) throw new Error(`Provider desktop view has horizontal overflow: ${desktop.horizontalOverflow}px`);
  const desktopBytes = await capture(session, desktopScreenshot);

  await setViewport(session, SCALED_DESKTOP_WIDTH, SCALED_DESKTOP_HEIGHT, false, WIDTH, HEIGHT);
  const scaledDesktopStyle = await navigateReadyProviderView(session, false);
  if (scaledDesktopStyle.viewportWidth !== SCALED_DESKTOP_WIDTH || scaledDesktopStyle.screenWidth !== WIDTH) {
    throw new Error(`Scaled desktop metrics mismatch: viewport=${scaledDesktopStyle.viewportWidth} screen=${scaledDesktopStyle.screenWidth}`);
  }
  if (scaledDesktopStyle.shellDisplay !== 'grid' || scaledDesktopStyle.sidebarPosition === 'fixed' || scaledDesktopStyle.tableHeadDisplay === 'none') {
    throw new Error(`Scaled desktop incorrectly entered compact shell: ${JSON.stringify(scaledDesktopStyle)}`);
  }

  await setViewport(session, MOBILE_WIDTH, MOBILE_HEIGHT, true);
  const mobileStyle = await navigateReadyProviderView(session, true);
  const mobile = await evaluate(session, `(() => {
    const table = document.querySelector('.provider-data-table[aria-label="Provider operations"]');
    const identities = [...(table?.querySelectorAll('.provider-identity') || [])];
    const nuso = identities.find(identity => identity.querySelector('b')?.textContent?.trim() === 'NUSO');
    const row = nuso?.closest('.data-table-row');
    row?.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = row?.getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      identities: identities.length,
      nusoPresent: Boolean(nuso),
      nusoVisible: Boolean(rect && rect.bottom > 0 && rect.top < innerHeight),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      unavailable: /Status intelligence unavailable/i.test(document.body.innerText)
    };
  })()`);
  await sleep(150);

  if (mobile.width !== MOBILE_WIDTH || mobile.height !== MOBILE_HEIGHT) throw new Error(`Provider mobile viewport mismatch: ${mobile.width}x${mobile.height}`);
  if (mobile.identities < 80) throw new Error(`Mobile provider workspace expected 80 identities, found ${mobile.identities}.`);
  if (!mobile.nusoPresent || !mobile.nusoVisible) throw new Error('NUSO is not visible in the mobile provider evidence frame.');
  if (mobile.horizontalOverflow > 1) throw new Error(`Provider mobile view has horizontal overflow: ${mobile.horizontalOverflow}px`);
  if (mobile.unavailable) throw new Error('Mobile provider identity verification rendered the unavailable state.');
  const mobileBytes = await capture(session, mobileScreenshot);

  console.log(`PROVIDER_IDENTITY providers=${desktop.providerIdentityCount} exact_masks=${desktop.brandMaskCount} curated_generated=${desktop.generatedCount} embedded_svg=${desktop.embeddedSvgCount} local_assets=${desktop.localLogoAssets} unique_assets=${desktop.uniqueLocalLogoAssets}`);
  console.log(`PROVIDER_IDENTITY_STYLE desktop_shell=${desktopStyle.shellDisplay} desktop_sidebar=${desktopStyle.sidebarPosition} scaled_viewport=${scaledDesktopStyle.viewportWidth} scaled_screen=${scaledDesktopStyle.screenWidth} scaled_shell=${scaledDesktopStyle.shellDisplay} mobile_sidebar=${mobileStyle.sidebarPosition} stylesheets=${desktopStyle.stylesheetCount}`);
  console.log(`PROVIDER_IDENTITY_NUSO present=true visible_mobile=true desktop=${desktopBytes} mobile=${mobileBytes}`);
}
finally {
  session?.close();
  browserProcess.kill('SIGTERM');
  await Promise.race([new Promise(resolve => browserProcess.once('exit', resolve)), sleep(1000)]);
  if (browserProcess.exitCode === null) {
    browserProcess.kill('SIGKILL');
    await Promise.race([new Promise(resolve => browserProcess.once('exit', resolve)), sleep(1000)]);
  }
  try {
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    console.warn(`Provider identity browser profile cleanup warning (${code}); provider assertions and screenshots are already complete.`);
  }
}
