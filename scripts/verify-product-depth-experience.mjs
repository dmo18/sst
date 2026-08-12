import fs from 'node:fs';
import { spawn } from 'node:child_process';

const WIDTH = 1440;
const HEIGHT = 960;
const MOBILE_WIDTH = 390;
const MOBILE_HEIGHT = 844;
const DEBUG_PORT = 9226;
const TIMEOUT_MS = 20_000;

const [
  targetUrl,
  universeScreenshot = '/tmp/operator-universe.png',
  searchScreenshot = '/tmp/operator-search.png',
  incidentScreenshot = '/tmp/operator-incident.png',
  mobileUniverseScreenshot = '/tmp/operator-universe-mobile.png'
] = process.argv.slice(2);
const browser = process.env.BROWSER;

if (!targetUrl) throw new Error('Usage: node scripts/verify-product-depth-experience.mjs <url> [universe.png] [search.png] [incident.png] [mobile-universe.png]');
if (!browser) throw new Error('BROWSER environment variable is required.');
if (typeof WebSocket !== 'function') throw new Error('Node WebSocket support is required.');

const profileDir = `/tmp/product-depth-cdp-${process.pid}`;
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
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); })
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

  close() { this.socket.close(); }
}

async function evaluate(session, expression) {
  const result = await session.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`Runtime evaluation failed: ${result.exceptionDetails.text || 'unknown error'}`);
  return result.result?.value;
}

async function setViewport(session, width, height, mobile = false) {
  await session.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile,
    screenWidth: width, screenHeight: height,
    positionX: 0, positionY: 0, dontSetVisibleSize: false
  });
}

async function navigate(session, url) {
  const loaded = session.waitForEvent('Page.loadEventFired');
  await session.send('Page.navigate', { url });
  await loaded;
}

function urlWith(params) {
  const url = new URL(targetUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.href;
}

async function waitFor(session, expression, label, timeoutMs = TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(session, expression);
    if (last?.ready) return last;
    await sleep(120);
  }
  throw new Error(`${label} did not become ready: ${JSON.stringify(last)}`);
}

async function capture(session, path) {
  const result = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(path, Buffer.from(result.data, 'base64'));
  const bytes = fs.statSync(path).size;
  if (bytes <= 10_000) throw new Error(`Product-depth screenshot is unexpectedly small: ${path} ${bytes} bytes`);
  return bytes;
}

async function viewportContract(session) {
  return evaluate(session, `(() => ({
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth - innerWidth,
    unavailable: /Status intelligence unavailable/i.test(document.body.innerText)
  }))()`);
}

function assertUniverseReadability(metrics, label, mobile = false) {
  const minimumGraphWidth = mobile ? MOBILE_WIDTH * 1.35 : 700;
  const minimumGraphHeight = mobile ? 360 : 430;
  const minimumLabelHeight = mobile ? 8 : 7;
  const collisionLimit = Math.max(4, Math.ceil(metrics.visibleLabels * (mobile ? 0.45 : 0.35)));
  if (metrics.graphWidth < minimumGraphWidth || metrics.graphHeight < minimumGraphHeight) {
    throw new Error(`${label} graph footprint is too small: ${metrics.graphWidth}x${metrics.graphHeight}`);
  }
  if (metrics.visibleLabels > 0 && metrics.medianLabelHeight < minimumLabelHeight) {
    throw new Error(`${label} labels are too small to scan: median=${metrics.medianLabelHeight}px`);
  }
  if (metrics.labelCollisions > collisionLimit) {
    throw new Error(`${label} label collisions are too dense: ${metrics.labelCollisions}/${metrics.visibleLabels}`);
  }
}

const deployedStatusUrl = new URL('status.json', targetUrl).href;
const payload = await fetchJson(deployedStatusUrl);
const providerName = String(payload.providers?.[0]?.provider || payload.providers?.[0]?.name || '').trim();
const incidentId = String(payload.incidents?.[0]?.id || '').trim();
if (!providerName) throw new Error('Deployed status payload did not expose a provider for universal-search verification.');

let session;
try {
  const page = await waitForPageTarget();
  session = new CdpSession(page.webSocketDebuggerUrl);
  await session.open();
  await session.send('Page.enable');
  await session.send('Runtime.enable');

  await setViewport(session, WIDTH, HEIGHT, false);
  await navigate(session, urlWith({ focus: 'universe', depthProbe: String(Date.now()) }));
  const universe = await waitFor(session, `(() => {
    const shell = document.querySelector('.depth-shell-universe');
    const graph = document.querySelector('.dependency-universe');
    const launcher = document.querySelector('.depth-launcher');
    const nodes = document.querySelectorAll('.depth-provider-node').length;
    const categories = document.querySelectorAll('.depth-category-node').length;
    const correlationEdges = document.querySelectorAll('.depth-edge-correlation').length;
    const graphRect = graph?.getBoundingClientRect();
    const labels = [...document.querySelectorAll('.depth-provider-node text, .depth-category-node text')].filter(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .05;
    });
    const rects = labels.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    let labelCollisions = 0;
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left];
        const b = rects[right];
        if (a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2) labelCollisions += 1;
      }
    }
    const heights = rects.map(rect => rect.height).sort((a, b) => a - b);
    return {
      ready: Boolean(shell && graph && launcher && nodes > 0 && categories > 0),
      nodes, categories, correlationEdges,
      cautious: /temporal correlations only|Temporal correlation only/i.test(document.body.innerText),
      replay: /Signal replay/i.test(document.body.innerText),
      localBoundary: /recorded changes only/i.test(document.body.innerText),
      overflow: document.documentElement.scrollWidth - innerWidth,
      graphWidth: Math.round((graphRect?.width || 0) * 10) / 10,
      graphHeight: Math.round((graphRect?.height || 0) * 10) / 10,
      visibleLabels: rects.length,
      medianLabelHeight: heights.length ? Math.round(heights[Math.floor(heights.length / 2)] * 10) / 10 : 0,
      labelCollisions
    };
  })()`, 'Dependency Universe');
  if (!universe.cautious) throw new Error('Dependency Universe does not expose the cautious temporal-correlation boundary.');
  if (!universe.replay || !universe.localBoundary) throw new Error('Dependency Universe signal-replay evidence boundary is missing.');
  if (universe.overflow > 1) throw new Error(`Dependency Universe has horizontal overflow: ${universe.overflow}px`);
  assertUniverseReadability(universe, 'Dependency Universe');
  const universeBytes = await capture(session, universeScreenshot);

  await navigate(session, urlWith({ focus: 'search', depthProbe: String(Date.now()) }));
  await waitFor(session, `(() => ({
    ready: Boolean(document.querySelector('.depth-search-view input') && document.querySelector('.depth-search-results')),
    overflow: document.documentElement.scrollWidth - innerWidth
  }))()`, 'Universal search');
  await evaluate(session, `document.querySelector('.depth-search-view input')?.focus()`);
  await session.send('Input.insertText', { text: providerName });
  const search = await waitFor(session, `(() => {
    const results = [...document.querySelectorAll('.depth-search-result')];
    const keys = results.map(item => [
      item.querySelector('.depth-kind')?.textContent || '',
      item.querySelector('b')?.textContent || '',
      item.querySelector('small')?.textContent || ''
    ].join('|').toLowerCase());
    return {
      ready: results.length > 0,
      count: results.length,
      first: results[0]?.innerText || '',
      kinds: results.map(item => item.querySelector('.depth-kind')?.textContent || ''),
      duplicates: keys.length - new Set(keys).size,
      overflow: document.documentElement.scrollWidth - innerWidth
    };
  })()`, 'Universal search results', 5_000);
  if (search.overflow > 1) throw new Error(`Universal search has horizontal overflow: ${search.overflow}px`);
  if (search.duplicates > 0) throw new Error(`Universal search contains ${search.duplicates} duplicate semantic result rows.`);
  if (!search.first.toLowerCase().includes(providerName.toLowerCase())) throw new Error(`Universal search did not rank the live provider query: ${providerName}`);
  const searchBytes = await capture(session, searchScreenshot);

  let incidentBytes = 0;
  let incidentVerified = false;
  if (incidentId) {
    await navigate(session, urlWith({ focus: `incident:${incidentId}`, depthProbe: String(Date.now()) }));
    const incident = await waitFor(session, `(() => {
      const room = document.querySelector('.depth-incident-room');
      return {
        ready: Boolean(room && /Operator action loop/i.test(room.innerText)),
        browserLocal: /Browser-only workflow state/i.test(room?.innerText || ''),
        acknowledge: [...room?.querySelectorAll('button') || []].some(button => /Acknowledge/i.test(button.textContent || '')),
        handoff: [...room?.querySelectorAll('button') || []].some(button => /Copy handoff bundle/i.test(button.textContent || '')),
        clientDraft: [...room?.querySelectorAll('button') || []].some(button => /Copy client-safe update/i.test(button.textContent || '')),
        overflow: document.documentElement.scrollWidth - innerWidth
      };
    })()`, 'Incident Focus');
    if (!incident.browserLocal || !incident.acknowledge || !incident.handoff || !incident.clientDraft) throw new Error(`Incident Focus action contract is incomplete: ${JSON.stringify(incident)}`);
    if (incident.overflow > 1) throw new Error(`Incident Focus has horizontal overflow: ${incident.overflow}px`);
    incidentBytes = await capture(session, incidentScreenshot);
    incidentVerified = true;
  }

  await setViewport(session, MOBILE_WIDTH, MOBILE_HEIGHT, true);
  await navigate(session, urlWith({ focus: 'universe', depthMobileProbe: String(Date.now()) }));
  const mobile = await waitFor(session, `(() => {
    const shell = document.querySelector('.depth-shell-universe');
    const graph = document.querySelector('.dependency-universe');
    const launcher = document.querySelector('.depth-launcher');
    const launcherRect = launcher?.getBoundingClientRect();
    const intelligence = document.querySelector('.operations-intelligence-trigger');
    const intelligenceRect = intelligence?.getBoundingClientRect();
    const overlaps = launcherRect && intelligenceRect
      ? !(launcherRect.right <= intelligenceRect.left || launcherRect.left >= intelligenceRect.right || launcherRect.bottom <= intelligenceRect.top || launcherRect.top >= intelligenceRect.bottom)
      : false;
    const graphRect = graph?.getBoundingClientRect();
    const labels = [...document.querySelectorAll('.depth-provider-node text, .depth-category-node text')].filter(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > .05;
    });
    const rects = labels.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    let labelCollisions = 0;
    for (let left = 0; left < rects.length; left += 1) {
      for (let right = left + 1; right < rects.length; right += 1) {
        const a = rects[left];
        const b = rects[right];
        if (a.right > b.left + 2 && b.right > a.left + 2 && a.bottom > b.top + 2 && b.bottom > a.top + 2) labelCollisions += 1;
      }
    }
    const heights = rects.map(rect => rect.height).sort((a, b) => a - b);
    return {
      ready: Boolean(shell && graph && launcher),
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
      overlaps,
      nodes: document.querySelectorAll('.depth-provider-node').length,
      graphWidth: Math.round((graphRect?.width || 0) * 10) / 10,
      graphHeight: Math.round((graphRect?.height || 0) * 10) / 10,
      visibleLabels: rects.length,
      medianLabelHeight: heights.length ? Math.round(heights[Math.floor(heights.length / 2)] * 10) / 10 : 0,
      labelCollisions
    };
  })()`, 'Mobile Dependency Universe');
  if (mobile.width !== MOBILE_WIDTH || mobile.height !== MOBILE_HEIGHT) throw new Error(`Mobile Dependency Universe viewport mismatch: ${mobile.width}x${mobile.height}`);
  if (mobile.overflow > 1) throw new Error(`Mobile Dependency Universe has horizontal overflow: ${mobile.overflow}px`);
  if (mobile.overlaps) throw new Error('Mobile Dependency Universe launcher overlaps Operations Intelligence chrome.');
  assertUniverseReadability(mobile, 'Mobile Dependency Universe', true);
  const mobileUniverseBytes = await capture(session, mobileUniverseScreenshot);

  const finalViewport = await viewportContract(session);
  if (finalViewport.unavailable) throw new Error('Product-depth verification rendered the unavailable state.');

  console.log(`PRODUCT_DEPTH_UNIVERSE providers=${universe.nodes} categories=${universe.categories} correlations=${universe.correlationEdges} labels=${universe.visibleLabels} collisions=${universe.labelCollisions} label_height=${universe.medianLabelHeight} graph=${universe.graphWidth}x${universe.graphHeight} screenshot=${universeBytes}`);
  console.log(`PRODUCT_DEPTH_SEARCH query=${JSON.stringify(providerName)} results=${search.count} duplicates=${search.duplicates} kinds=${search.kinds.join(',')} screenshot=${searchBytes}`);
  console.log(`PRODUCT_DEPTH_INCIDENT ${incidentVerified ? `verified id=${incidentId} screenshot=${incidentBytes}` : 'skipped no-live-incident'}`);
  console.log(`PRODUCT_DEPTH_MOBILE ${MOBILE_WIDTH}x${MOBILE_HEIGHT} providers=${mobile.nodes} labels=${mobile.visibleLabels} collisions=${mobile.labelCollisions} label_height=${mobile.medianLabelHeight} graph=${mobile.graphWidth}x${mobile.graphHeight} screenshot=${mobileUniverseBytes}`);
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
    console.warn(`Product-depth browser profile cleanup warning (${code}); product assertions and screenshots are already complete.`);
  }
}