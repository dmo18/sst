import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const browser = process.env.LEGACY_BROWSER || process.argv[2];
const requestedBase = process.env.STATUS_BASE_URL || process.argv[3] || 'https://dmo18.github.io/sst/';
if (!browser) throw new Error('LEGACY_BROWSER or browser path argument is required.');
const base = new URL(requestedBase.endsWith('/') ? requestedBase : `${requestedBase}/`).href;
const url = new URL('?view=wallboard&alerts=24h', base).href;

const { stdout, stderr } = await execFileAsync(browser, [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--window-size=458,291',
  '--virtual-time-budget=20000',
  '--dump-dom',
  url
], { maxBuffer: 12 * 1024 * 1024, timeout: 45000, env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG || 'C.UTF-8' } });

if (stderr) console.log(stderr.trim().slice(0, 4000));
if (!/class=["'][^"']*no-css-layers/i.test(stdout)) throw new Error('Pinned legacy Chromium did not activate the no-css-layers compatibility marker.');
if (!/wallboard-shell|wallboard-v2/i.test(stdout)) throw new Error('Pinned legacy Chromium did not render the wallboard shell.');
if (!/Provider|ServiceOps|Status/i.test(stdout)) throw new Error('Pinned legacy Chromium wallboard did not render operational content.');
if (/status\.json has an invalid or unsupported payload|Application failed/i.test(stdout)) throw new Error('Pinned legacy Chromium rendered an application error.');
console.log(`Pinned legacy Chromium wallboard probe passed at 458x291: ${url}`);