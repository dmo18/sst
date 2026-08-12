import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [targetUrl, htmlPath = '/tmp/operator-live-truth.html'] = process.argv.slice(2);
const browser = process.env.BROWSER;
const CLAUDE_SUMMARY = 'https://status.claude.com/api/v2/summary.json';

if (!targetUrl) throw new Error('Usage: node scripts/verify-live-status-truth.mjs <url> [html-path]');
if (!browser) throw new Error('BROWSER environment variable is required.');

function attribute(html, name) {
  return new RegExp(`${name}="([^"]*)"`, 'i').exec(html)?.[1] || '';
}

function list(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

async function officialClaude() {
  const url = new URL(CLAUDE_SUMMARY);
  url.searchParams.set('verifyTruth', String(Date.now()));
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { accept: 'application/json', 'user-agent': 'ServiceOps live truth verifier/3.3' },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`Claude official summary returned HTTP ${response.status}`);
  const body = await response.json();
  const incidents = Array.isArray(body.incidents)
    ? body.incidents.filter(item => !['resolved', 'completed', 'postmortem'].includes(String(item?.status || '').toLowerCase()))
    : [];
  const problemComponents = Array.isArray(body.components)
    ? body.components.filter(item => ['major_outage', 'partial_outage', 'degraded_performance'].includes(String(item?.status || '').toLowerCase()))
    : [];
  const indicator = String(body.status?.indicator || '').toLowerCase();
  return {
    active: incidents.length > 0 || problemComponents.length > 0 || ['minor', 'major', 'critical'].includes(indicator),
    incidentTitles: incidents.map(item => String(item?.name || '').trim()).filter(Boolean),
    incidentIds: incidents.map(item => String(item?.id || '').trim()).filter(Boolean),
    problemComponents: problemComponents.map(item => String(item?.name || '').trim()).filter(Boolean),
    indicator
  };
}

const official = await officialClaude();
const profile = `/tmp/live-truth-${process.pid}`;
const url = new URL(targetUrl);
url.searchParams.set('liveTruthProbe', String(Date.now()));

try {
  const result = spawnSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=1440,960',
    '--virtual-time-budget=12000',
    `--user-data-dir=${profile}`,
    '--dump-dom',
    url.href
  ], {
    encoding: 'utf8',
    timeout: 35_000,
    maxBuffer: 12 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Live-truth browser probe failed with exit ${result.status}: ${String(result.stderr || '').slice(-2000)}`);

  const html = String(result.stdout || '');
  fs.writeFileSync(htmlPath, html, 'utf8');
  if (/Status intelligence unavailable/i.test(html)) throw new Error('Live-truth probe rendered Status intelligence unavailable.');

  const attempted = Number(attribute(html, 'data-live-truth-attempted') || 0);
  const successes = Number(attribute(html, 'data-live-truth-successes') || 0);
  const failures = Number(attribute(html, 'data-live-truth-failures') || 0);
  const checkedAt = attribute(html, 'data-live-truth-checked-at');
  const activeProviders = list(attribute(html, 'data-live-truth-active-providers'));
  const successfulProviders = list(attribute(html, 'data-live-truth-successful-providers'));
  const failedProviders = list(attribute(html, 'data-live-truth-failed-providers'));

  if (!checkedAt || !Number.isFinite(Date.parse(checkedAt))) throw new Error('Browser live-truth check timestamp is missing.');
  if (attempted < 10) throw new Error(`Browser live-truth overlay attempted only ${attempted} standardized providers.`);
  if (successes + failures !== attempted) throw new Error(`Browser live-truth accounting mismatch: attempted=${attempted} successes=${successes} failures=${failures}.`);
  if (successes < Math.ceil(attempted * 0.75)) throw new Error(`Browser live-truth success coverage is too low: ${successes}/${attempted}.`);
  if (!successfulProviders.includes('anthropic')) throw new Error(`Anthropic live official truth was not successfully observed in the browser. Failures: ${failedProviders.join(',') || 'none'}`);

  const browserClaudeActive = activeProviders.includes('anthropic');
  if (browserClaudeActive !== official.active) {
    throw new Error(`Claude live truth mismatch: official=${official.active ? 'active' : 'clear'} browser=${browserClaudeActive ? 'active' : 'clear'} official_incidents=${official.incidentIds.join(',') || 'none'} official_components=${official.problemComponents.join(',') || 'none'}`);
  }
  if (official.incidentTitles.length && !official.incidentTitles.some(title => html.includes(title))) {
    throw new Error(`Browser marked Claude active but did not render any current official incident title: ${official.incidentTitles.join(' | ')}`);
  }

  console.log(`LIVE_TRUTH_COVERAGE attempted=${attempted} successes=${successes} failures=${failures} checked=${checkedAt}`);
  console.log(`LIVE_TRUTH_CLAUDE official=${official.active ? 'active' : 'clear'} browser=${browserClaudeActive ? 'active' : 'clear'} indicator=${official.indicator || 'unknown'} incidents=${official.incidentIds.join(',') || 'none'} components=${official.problemComponents.join(',') || 'none'}`);
  console.log(`LIVE_TRUTH_ACTIVE_PROVIDERS ${activeProviders.join(',') || 'none'}`);
}
finally {
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { }
}
