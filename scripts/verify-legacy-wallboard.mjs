import fs from 'node:fs';
import { spawn } from 'node:child_process';

const browser = process.env.LEGACY_BROWSER || process.argv[2];
const requestedBase = process.env.STATUS_BASE_URL || process.argv[3] || 'https://dmo18.github.io/sst/';
const htmlPath = process.env.LEGACY_HTML_PATH || '/tmp/legacy-wallboard.html';
const screenshotPath = process.env.LEGACY_SCREENSHOT_PATH || '/tmp/legacy-wallboard.png';
const debugPort = Number(process.env.LEGACY_DEBUG_PORT || 9225);
const timeoutMs = 45_000;

if (!browser) throw new Error('LEGACY_BROWSER or browser path argument is required.');
if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required.');

const base = new URL(requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`).href;
const url = new URL('?view=wallboard&alerts=24h', base).href;
const profileDir = `/tmp/legacy-wallboard-cdp-${process.pid}`;
const diagnostics = [];

const browserProcess = spawn(browser, [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  'about:blank'
], {
  stdio: ['ignore', 'ignore', 'pipe'],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG || 'C.UTF-8'
  }
});

browserProcess.stderr.setEncoding('utf8');
browserProcess.stderr.on('data', chunk => {
  const text = String(chunk).trim();
  if (text) diagnostics.push(`browser: ${text.slice(0, 3000)}`);
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      })
    ]);
  }
  finally {
    clearTimeout(timer);
  }
}

async function fetchJson(endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);
  return response.json();
}

async function waitForPageTarget() {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
      const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    }
    catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Legacy Chromium DevTools endpoint did not become ready${lastError ? `: ${lastError.message}` : ''}`);
}

class CdpSession {
  constructor(socketUrl) {
    this.socket = new WebSocket(socketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
    this.listeners = new Map();
  }

  async open() {
    await withTimeout(new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('Legacy Chromium CDP WebSocket connection failed.')), { once: true });
      this.socket.addEventListener('message', event => this.handleMessage(event));
    }), 10_000, 'Legacy Chromium CDP connection');
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
    if (!message.method) return;
    const listeners = this.listeners.get(message.method) || [];
    for (const listener of listeners) listener(message.params || {});
    const waiters = this.waiters.get(message.method) || [];
    this.waiters.delete(message.method);
    for (const resolve of waiters) resolve(message.params || {});
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, ms = timeoutMs) {
    return withTimeout(new Promise(resolve => {
      const waiters = this.waiters.get(method) || [];
      waiters.push(resolve);
      this.waiters.set(method, waiters);
    }), ms, method);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(session, expression) {
  const response = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(`Legacy runtime evaluation failed: ${response.exceptionDetails.text || 'unknown exception'}`);
  }
  return response.result?.value;
}

function structuralWallboardReady(state) {
  return Boolean(
    state?.marker
    && state?.shell
    && state?.priority
    && state?.telemetry
    && state?.providerRail
    && (state.signalCount > 0 || state.emptyState)
    && !state?.appError
  );
}

async function waitForWallboard(session) {
  const deadline = Date.now() + 25_000;
  let lastState;
  while (Date.now() < deadline) {
    lastState = await evaluate(session, `(() => {
      const root = document.documentElement;
      const shell = document.querySelector('.wallboard-shell, .wallboard-v2');
      const priority = document.querySelector('.wallboard-priority-v2');
      const telemetry = document.querySelector('.wallboard-mini-telemetry');
      const providerRail = document.querySelector('.wallboard-alert-provider-rail');
      const signalCount = document.querySelectorAll('.wallboard-priority-group:not(.wallboard-priority-copy) article').length;
      const emptyState = Boolean(document.querySelector('.wallboard-priority-list > .empty-state'));
      const bodyText = document.body?.innerText || '';
      return {
        className: root.className,
        marker: root.classList.contains('no-css-layers'),
        shell: Boolean(shell),
        priority: Boolean(priority),
        telemetry: Boolean(telemetry),
        providerRail: Boolean(providerRail),
        signalCount,
        emptyState,
        layoutProbe: shell?.dataset?.layoutProbe || '',
        layoutProbeDetail: shell?.dataset?.layoutProbeDetail || '',
        bodyText,
        appError: /status\\.json has an invalid or unsupported payload|Application failed|Status intelligence unavailable/i.test(bodyText),
        readyState: document.readyState
      };
    })()`);
    if (structuralWallboardReady(lastState)) return lastState;
    await sleep(250);
  }
  throw new Error(`Legacy wallboard did not become structurally ready: ${JSON.stringify({ ...lastState, bodyText: lastState?.bodyText?.slice(0, 800) })}`);
}

let session;
try {
  const page = await waitForPageTarget();
  session = new CdpSession(page.webSocketDebuggerUrl);
  await session.open();
  session.on('Runtime.exceptionThrown', params => {
    const description = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'unknown runtime exception';
    diagnostics.push(`runtime: ${description}`);
  });
  session.on('Runtime.consoleAPICalled', params => {
    const values = (params.args || []).map(arg => arg.value ?? arg.description ?? '').join(' ');
    if (values) diagnostics.push(`console.${params.type}: ${values}`);
  });

  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: 458,
    height: 291,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 458,
    screenHeight: 291,
    positionX: 0,
    positionY: 0,
    dontSetVisibleSize: false
  });

  const loaded = session.waitForEvent('Page.loadEventFired');
  await session.send('Page.navigate', { url });
  await loaded;
  const state = await waitForWallboard(session);

  const contract = await evaluate(session, `(() => {
    const root = document.documentElement;
    const wallboard = document.querySelector('.wallboard-v2, .wallboard-shell');
    const rect = wallboard?.getBoundingClientRect();
    const priority = document.querySelector('.wallboard-priority-v2');
    const telemetry = document.querySelector('.wallboard-mini-telemetry');
    const providerRail = document.querySelector('.wallboard-alert-provider-rail');
    const signalCount = document.querySelectorAll('.wallboard-priority-group:not(.wallboard-priority-copy) article').length;
    const emptyState = Boolean(document.querySelector('.wallboard-priority-list > .empty-state'));
    const bodyText = document.body?.innerText || '';
    return {
      html: root.outerHTML,
      marker: root.classList.contains('no-css-layers'),
      shell: Boolean(wallboard),
      priority: Boolean(priority),
      telemetry: Boolean(telemetry),
      providerRail: Boolean(providerRail),
      signalCount,
      emptyState,
      layoutProbe: wallboard?.dataset?.layoutProbe || '',
      layoutProbeDetail: wallboard?.dataset?.layoutProbeDetail || '',
      width: innerWidth,
      height: innerHeight,
      wallboardWidth: rect?.width || 0,
      wallboardHeight: rect?.height || 0,
      horizontalOverflow: root.scrollWidth - innerWidth,
      bodyText,
      appError: /status\\.json has an invalid or unsupported payload|Application failed|Status intelligence unavailable/i.test(bodyText)
    };
  })()`);

  fs.writeFileSync(htmlPath, contract.html, 'utf8');
  const screenshot = await session.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false
  });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  if (!contract.marker) throw new Error('Pinned legacy Chromium did not activate the no-css-layers compatibility marker.');
  if (!structuralWallboardReady(contract)) throw new Error(`Pinned legacy Chromium wallboard did not render the structural operational contract: ${JSON.stringify({ priority: contract.priority, telemetry: contract.telemetry, providerRail: contract.providerRail, signalCount: contract.signalCount, emptyState: contract.emptyState, layoutProbe: contract.layoutProbe, layoutProbeDetail: contract.layoutProbeDetail })}`);
  if (contract.appError) throw new Error('Pinned legacy Chromium rendered an application error.');
  if (contract.width !== 458 || contract.height !== 291) throw new Error(`Pinned legacy Chromium viewport mismatch: ${contract.width}x${contract.height}`);
  if (contract.wallboardWidth < 440 || contract.wallboardHeight < 275) throw new Error(`Pinned legacy Chromium wallboard geometry is unexpectedly small: ${contract.wallboardWidth}x${contract.wallboardHeight}`);
  if (contract.horizontalOverflow > 1) throw new Error(`Pinned legacy Chromium wallboard has horizontal overflow: ${contract.horizontalOverflow}px`);

  const screenshotBytes = fs.statSync(screenshotPath).size;
  if (screenshotBytes < 5_000) throw new Error(`Pinned legacy Chromium screenshot is unexpectedly small: ${screenshotBytes} bytes`);

  console.log(`LEGACY_WALLBOARD_VIEWPORT ${contract.width}x${contract.height}`);
  console.log(`LEGACY_WALLBOARD_GEOMETRY ${Math.round(contract.wallboardWidth)}x${Math.round(contract.wallboardHeight)}`);
  console.log(`LEGACY_WALLBOARD_CONTENT signals=${contract.signalCount} empty=${contract.emptyState} layout=${contract.layoutProbe || 'pending'}`);
  console.log(`LEGACY_WALLBOARD_SCREENSHOT_BYTES ${screenshotBytes}`);
  console.log(`Pinned legacy Chromium wallboard probe passed at 458x291: ${url}`);
}
catch (error) {
  if (diagnostics.length) {
    console.error('LEGACY_BROWSER_DIAGNOSTICS');
    for (const line of diagnostics.slice(-20)) console.error(line);
  }
  throw error;
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