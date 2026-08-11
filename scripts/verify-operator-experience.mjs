import fs from 'node:fs';
import { spawn } from 'node:child_process';

const WIDTH = 1440;
const HEIGHT = 960;
const MOBILE_WIDTH = 390;
const MOBILE_HEIGHT = 844;
const DEBUG_PORT = 9224;
const DEFAULT_TIMEOUT_MS = 20_000;

const [
  targetUrl,
  htmlPath = '/tmp/operator-experience.html',
  screenshotPath = '/tmp/operator-experience.png',
  commandScreenshotPath = '/tmp/operator-command.png',
  mobileScreenshotPath = '/tmp/operator-mobile.png'
] = process.argv.slice(2);
const browser = process.env.BROWSER;

if (!targetUrl) throw new Error('Usage: node scripts/verify-operator-experience.mjs <url> [html-path] [screenshot-path] [command-screenshot-path] [mobile-screenshot-path]');
if (!browser) throw new Error('BROWSER environment variable is required.');
if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required.');

const profileDir = `/tmp/operator-experience-cdp-${process.pid}`;
const browserProcess = spawn(browser, [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], {
  stdio: ['ignore', 'ignore', 'inherit']
});

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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

async function waitForPageTarget(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
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
    this.eventWaiters = new Map();
  }

  async open() {
    await withTimeout(new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('CDP WebSocket connection failed.')), { once: true });
      this.socket.addEventListener('message', event => this.handleMessage(event));
    }), DEFAULT_TIMEOUT_MS, 'CDP connection');
  }

  handleMessage(event) {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
      return;
    }
    if (message.method) {
      const waiters = this.eventWaiters.get(message.method) || [];
      this.eventWaiters.delete(message.method);
      for (const resolve of waiters) resolve(message.params || {});
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return withTimeout(new Promise(resolve => {
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push(resolve);
      this.eventWaiters.set(method, waiters);
    }), timeoutMs, method);
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

async function setViewport(session, width, height, mobile = false) {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });
}

async function navigate(session, url) {
  const loadEvent = session.waitForEvent('Page.loadEventFired');
  await session.send('Page.navigate', { url });
  await loadEvent;
}

async function waitForOperator(session, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(session, `(() => ({
      shell: Boolean(document.querySelector('.enterprise-shell')),
      hero: Boolean(document.querySelector('.posture-panel')),
      pulse: Boolean(document.querySelector('.experience-pulse')),
      tone: document.documentElement.dataset.operationalTone || '',
      unavailable: /Status intelligence unavailable/i.test(document.body.innerText)
    }))()`);
    if (last?.shell && last?.hero && last?.pulse && last?.tone && !last?.unavailable) return last;
    await sleep(250);
  }
  throw new Error(`Premium operator surface did not become ready: ${JSON.stringify(last)}`);
}

async function capture(session, path) {
  const screenshot = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  fs.writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
  const bytes = fs.statSync(path).size;
  if (bytes <= 10_000) throw new Error(`Operator screenshot is unexpectedly small: ${bytes} bytes`);
  return bytes;
}

let session;
try {
  const page = await waitForPageTarget();
  session = new CdpSession(page.webSocketDebuggerUrl);
  await session.open();
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await setViewport(session, WIDTH, HEIGHT, false);
  await navigate(session, targetUrl);
  await waitForOperator(session);

  const contract = await evaluate(session, `(() => {
    const shell = document.querySelector('.enterprise-shell');
    const sidebar = document.querySelector('.app-sidebar');
    const hero = document.querySelector('.posture-panel');
    const heroTitle = hero?.querySelector('h2');
    const pulse = document.querySelector('.experience-pulse');
    const commandButton = pulse?.querySelector('button');
    const rootStyle = getComputedStyle(document.documentElement);
    const heroStyle = heroTitle ? getComputedStyle(heroTitle) : null;
    const sidebarRect = sidebar?.getBoundingClientRect();
    const heroRect = hero?.getBoundingClientRect();
    return {
      html: document.documentElement.outerHTML,
      viewport: { width: innerWidth, height: innerHeight },
      shell: Boolean(shell),
      sidebarWidth: sidebarRect?.width || 0,
      heroHeight: heroRect?.height || 0,
      heroFontSize: heroStyle ? parseFloat(heroStyle.fontSize) : 0,
      premiumToken: rootStyle.getPropertyValue('--px-bg').trim(),
      commandText: commandButton?.textContent || '',
      operationalTone: document.documentElement.dataset.operationalTone || '',
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      unavailable: /Status intelligence unavailable/i.test(document.body.innerText),
      headline: heroTitle?.textContent || ''
    };
  })()`);

  fs.writeFileSync(htmlPath, contract.html, 'utf8');

  if (contract.viewport.width !== WIDTH || contract.viewport.height !== HEIGHT) throw new Error(`Operator viewport mismatch: ${contract.viewport.width}x${contract.viewport.height}`);
  if (!contract.shell) throw new Error('Enterprise shell is missing.');
  if (contract.sidebarWidth < 220) throw new Error(`Premium sidebar is unexpectedly narrow: ${contract.sidebarWidth}px`);
  if (contract.heroHeight < 180) throw new Error(`Premium posture hero is unexpectedly short: ${contract.heroHeight}px`);
  if (contract.heroFontSize < 30) throw new Error(`Premium posture headline is too small: ${contract.heroFontSize}px`);
  if (!contract.premiumToken) throw new Error('Premium design tokens are not active.');
  if (!/Command/i.test(contract.commandText)) throw new Error('Command launcher is missing.');
  if (!contract.operationalTone) throw new Error('State-aware operational atmosphere is not active.');
  if (contract.horizontalOverflow > 1) throw new Error(`Operator surface has horizontal overflow: ${contract.horizontalOverflow}px`);
  if (contract.unavailable) throw new Error('Operator surface rendered the unavailable state.');
  if (!contract.headline) throw new Error('Operational posture headline is missing.');

  const screenshotBytes = await capture(session, screenshotPath);

  await evaluate(session, `document.querySelector('.experience-pulse button')?.click()`);
  const palette = await withTimeout((async () => {
    while (true) {
      const state = await evaluate(session, `(() => {
        const palette = document.querySelector('.command-palette');
        const input = palette?.querySelector('input');
        const commands = palette ? palette.querySelectorAll('.command-list > button').length : 0;
        const selected = palette?.querySelector('[role="option"][aria-selected="true"]')?.id || '';
        return { visible: Boolean(palette), focused: document.activeElement === input, commands, selected };
      })()`);
      if (state.visible && state.focused && state.selected) return state;
      await sleep(100);
    }
  })(), 4_000, 'Command palette');

  if (palette.commands < 7) throw new Error(`Command palette has too few actions: ${palette.commands}`);
  const beforeSelection = palette.selected;
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown' });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown' });
  const afterSelection = await withTimeout((async () => {
    while (true) {
      const selected = await evaluate(session, `document.querySelector('[role="option"][aria-selected="true"]')?.id || ''`);
      if (selected && selected !== beforeSelection) return selected;
      await sleep(50);
    }
  })(), 2_000, 'Command keyboard selection');
  if (!afterSelection) throw new Error('Arrow-key command selection did not move.');
  const commandScreenshotBytes = await capture(session, commandScreenshotPath);

  await setViewport(session, MOBILE_WIDTH, MOBILE_HEIGHT, true);
  const mobileUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}mobileExperienceProbe=1`;
  await navigate(session, mobileUrl);
  await waitForOperator(session);

  const mobileContract = await evaluate(session, `(() => {
    const nav = document.querySelector('.app-sidebar');
    const navStyle = nav ? getComputedStyle(nav) : null;
    const navRect = nav?.getBoundingClientRect();
    const hero = document.querySelector('.posture-panel');
    const heroTitle = hero?.querySelector('h2');
    const heroStyle = heroTitle ? getComputedStyle(heroTitle) : null;
    const pulse = document.querySelector('.experience-pulse');
    const pulseStyle = pulse ? getComputedStyle(pulse) : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      navPosition: navStyle?.position || '',
      navBottomGap: navRect ? innerHeight - navRect.bottom : 999,
      navButtons: nav?.querySelectorAll('nav button').length || 0,
      heroFontSize: heroStyle ? parseFloat(heroStyle.fontSize) : 0,
      pulseDisplay: pulseStyle?.display || '',
      operationalTone: document.documentElement.dataset.operationalTone || '',
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      unavailable: /Status intelligence unavailable/i.test(document.body.innerText)
    };
  })()`);

  if (mobileContract.viewport.width !== MOBILE_WIDTH || mobileContract.viewport.height !== MOBILE_HEIGHT) throw new Error(`Mobile viewport mismatch: ${mobileContract.viewport.width}x${mobileContract.viewport.height}`);
  if (mobileContract.navPosition !== 'fixed') throw new Error(`Mobile navigation is not fixed: ${mobileContract.navPosition || 'missing'}`);
  if (Math.abs(mobileContract.navBottomGap) > 2) throw new Error(`Mobile navigation does not reach the viewport bottom: ${mobileContract.navBottomGap}px`);
  if (mobileContract.navButtons !== 5) throw new Error(`Mobile navigation expected 5 destinations, found ${mobileContract.navButtons}`);
  if (mobileContract.heroFontSize < 18) throw new Error(`Mobile posture headline is too small: ${mobileContract.heroFontSize}px`);
  if (mobileContract.pulseDisplay !== 'none') throw new Error(`Desktop pulse dock should collapse on mobile, found display=${mobileContract.pulseDisplay}`);
  if (!mobileContract.operationalTone) throw new Error('Mobile operational atmosphere is not active.');
  if (mobileContract.horizontalOverflow > 1) throw new Error(`Mobile operator surface has horizontal overflow: ${mobileContract.horizontalOverflow}px`);
  if (mobileContract.unavailable) throw new Error('Mobile operator surface rendered the unavailable state.');
  const mobileScreenshotBytes = await capture(session, mobileScreenshotPath);

  console.log(`OPERATOR_VIEWPORT ${WIDTH}x${HEIGHT}`);
  console.log(`OPERATOR_HERO_HEIGHT ${Math.round(contract.heroHeight)}`);
  console.log(`OPERATOR_HERO_FONT ${contract.heroFontSize}`);
  console.log(`OPERATOR_TONE ${contract.operationalTone}`);
  console.log(`OPERATOR_SCREENSHOT_BYTES ${screenshotBytes}`);
  console.log(`OPERATOR_COMMAND_SCREENSHOT_BYTES ${commandScreenshotBytes}`);
  console.log(`OPERATOR_COMMANDS ${palette.commands}`);
  console.log(`OPERATOR_COMMAND_SELECTION ${beforeSelection} -> ${afterSelection}`);
  console.log(`OPERATOR_MOBILE_VIEWPORT ${MOBILE_WIDTH}x${MOBILE_HEIGHT}`);
  console.log(`OPERATOR_MOBILE_SCREENSHOT_BYTES ${mobileScreenshotBytes}`);
}
finally {
  session?.close();
  browserProcess.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => browserProcess.once('exit', resolve)),
    sleep(1000)
  ]);
  if (browserProcess.exitCode === null) browserProcess.kill('SIGKILL');
  fs.rmSync(profileDir, { recursive: true, force: true });
}