import fs from 'node:fs';
import { spawn } from 'node:child_process';

const WIDTH = 458;
const HEIGHT = 291;
const DEBUG_PORT = 9222;
const DEFAULT_TIMEOUT_MS = 20_000;

const [targetUrl, htmlPath = '/tmp/yodeck-wallboard.html', screenshotPath = '/tmp/yodeck-wallboard.png'] = process.argv.slice(2);
const browser = process.env.BROWSER;

if (!targetUrl) throw new Error('Usage: node scripts/verify-yodeck-wallboard.mjs <url> [html-path] [screenshot-path]');
if (!browser) throw new Error('BROWSER environment variable is required.');
if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required.');

const profileDir = `/tmp/yodeck-cdp-${process.pid}`;
const browserProcess = spawn(browser, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
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

async function fetchJson(url, options) {
  const response = await fetch(url, options);
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

async function waitForProbe(session, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last = { state: null, detail: null, updatedAt: '', browserCheckedAt: '', refreshMs: 0 };

  while (Date.now() < deadline) {
    last = await evaluate(session, `(() => {
      const shell = document.querySelector('.wallboard-shell');
      return {
        state: shell?.dataset.layoutProbe || null,
        detail: shell?.dataset.layoutProbeDetail || null,
        updatedAt: shell?.getAttribute('data-wallboard-updated-at') || '',
        browserCheckedAt: shell?.getAttribute('data-wallboard-browser-checked-at') || '',
        refreshMs: Number(shell?.getAttribute('data-wallboard-refresh-ms') || '0')
      };
    })()`);

    const layoutResolved = last?.state === 'pass' || last?.state === 'fail';
    const freshnessReady = Boolean(last?.updatedAt && last?.browserCheckedAt && last?.refreshMs >= 15_000);
    if (layoutResolved && freshnessReady) return last;
    await sleep(250);
  }

  const readiness = `updated=${last?.updatedAt || 'missing'} checked=${last?.browserCheckedAt || 'missing'} refreshMs=${last?.refreshMs || 0}`;
  throw new Error(`Yodeck layout/freshness probe timed out${last?.detail ? `: ${last.detail}` : ''}; ${readiness}`);
}

async function providerRotationProbe(session) {
  const before = await evaluate(session, `(() => {
    const rail = document.querySelector('.wallboard-alert-provider-rail');
    const track = document.querySelector('.wallboard-alert-provider-track');
    return {
      count: Number(rail?.getAttribute('data-provider-count') || '0'),
      looping: Boolean(track?.classList.contains('is-looping')),
      transform: track ? getComputedStyle(track).transform : 'none'
    };
  })()`);
  if (!before || before.count <= 1) return { ...before, moved: false, required: false };
  await sleep(750);
  const afterTransform = await evaluate(session, `(() => {
    const track = document.querySelector('.wallboard-alert-provider-track');
    return track ? getComputedStyle(track).transform : 'none';
  })()`);
  return {
    ...before,
    required: true,
    afterTransform,
    moved: Boolean(before.looping && before.transform !== afterTransform)
  };
}

let session;
try {
  const page = await waitForPageTarget();
  session = new CdpSession(page.webSocketDebuggerUrl);
  await session.open();

  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: WIDTH,
    screenHeight: HEIGHT,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });

  const loadEvent = session.waitForEvent('Page.loadEventFired');
  await session.send('Page.navigate', { url: targetUrl });
  await loadEvent;

  const viewport = await evaluate(session, `({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio
  })`);

  console.log(`YODECK_VIEWPORT ${viewport.width}x${viewport.height} dpr=${viewport.devicePixelRatio}`);
  if (viewport.width !== WIDTH || viewport.height !== HEIGHT) {
    throw new Error(`CDP viewport mismatch: expected ${WIDTH}x${HEIGHT}, received ${viewport.width}x${viewport.height}`);
  }

  const probe = await waitForProbe(session);
  console.log(`YODECK_LAYOUT_PROBE ${probe.state}`);
  console.log(`YODECK_LAYOUT_DETAIL ${probe.detail || ''}`);
  console.log(`YODECK_READINESS updated=${probe.updatedAt} checked=${probe.browserCheckedAt} refresh_ms=${probe.refreshMs}`);

  const contract = await evaluate(session, `(() => {
    const html = document.documentElement.outerHTML;
    const shell = document.querySelector('.wallboard-shell');
    const freshness = document.querySelector('.wallboard-freshness');
    return {
      html,
      hasPrioritySignals: /Priority signals/i.test(document.body.innerText),
      alertWindowMs: document.querySelector('[data-alert-window-ms]')?.getAttribute('data-alert-window-ms') || null,
      hasUnavailableState: /Status intelligence unavailable/i.test(document.body.innerText),
      freshnessText: freshness?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      updatedAt: shell?.getAttribute('data-wallboard-updated-at') || '',
      browserCheckedAt: shell?.getAttribute('data-wallboard-browser-checked-at') || '',
      refreshMs: Number(shell?.getAttribute('data-wallboard-refresh-ms') || '0')
    };
  })()`);

  fs.writeFileSync(htmlPath, contract.html, 'utf8');

  if (probe.state !== 'pass') throw new Error(`Yodeck layout probe failed: ${probe.detail || 'no detail'}`);
  if (!contract.hasPrioritySignals) throw new Error('Priority signals heading is missing.');
  if (contract.alertWindowMs !== '129600000') throw new Error(`Unexpected alert window: ${contract.alertWindowMs || 'missing'}`);
  if (contract.hasUnavailableState) throw new Error('Wallboard rendered Status intelligence unavailable.');
  if (!/Updated/i.test(contract.freshnessText) || !/Checked/i.test(contract.freshnessText) || !/Next/i.test(contract.freshnessText) || !/Browser refresh/i.test(contract.freshnessText)) {
    throw new Error(`Wallboard header freshness telemetry is incomplete: ${contract.freshnessText || 'missing'}`);
  }
  if (!contract.updatedAt || !contract.browserCheckedAt || contract.refreshMs < 15_000) {
    throw new Error(`Wallboard freshness timestamps are incomplete: updated=${contract.updatedAt || 'missing'} checked=${contract.browserCheckedAt || 'missing'} refreshMs=${contract.refreshMs}`);
  }

  const rotation = await providerRotationProbe(session);
  console.log(`YODECK_PROVIDER_ROTATION providers=${rotation?.count || 0} looping=${Boolean(rotation?.looping)} moved=${Boolean(rotation?.moved)} required=${Boolean(rotation?.required)}`);
  if (rotation?.required && !rotation.moved) {
    throw new Error(`Wallboard provider header rail did not move while ${rotation.count} alert providers were present.`);
  }

  const screenshot = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  const screenshotBytes = fs.statSync(screenshotPath).size;
  if (screenshotBytes <= 3000) throw new Error(`Yodeck screenshot is unexpectedly small: ${screenshotBytes} bytes`);

  console.log(`YODECK_FRESHNESS updated=${contract.updatedAt} checked=${contract.browserCheckedAt} refresh_ms=${contract.refreshMs}`);
  console.log(`YODECK_HTML_BYTES ${Buffer.byteLength(contract.html, 'utf8')}`);
  console.log(`YODECK_SCREENSHOT_BYTES ${screenshotBytes}`);
}
finally {
  session?.close();
  browserProcess.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => browserProcess.once('exit', resolve)),
    sleep(1000)
  ]);
  if (browserProcess.exitCode === null) browserProcess.kill('SIGKILL');
}
