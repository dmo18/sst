// Supplementary Microsoft 365 workload advisories.
//
// Microsoft's public status page only carries broad outages. The per-service
// incidents and advisories are published to tenant administrators. The
// University of Pennsylvania republishes that feed for its own tenant on a
// public page. It is read here as a labelled supplement only:
//
//   - it is a third party relaying Microsoft's text for one tenant;
//   - it never sets a provider's state, never creates an incident in
//     the status payload, and never reaches the wallboard;
//   - any failure writes an empty, not-ok document and exits 0.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PENN_SOURCE_URL = 'https://mailservices.isc.upenn.edu/computing/email/penno365/alerts/ms-incidents.html';
export const PENN_PUBLISHER = 'University of Pennsylvania (PennO365)';
const OUTPUT = 'public/m365-advisories.json';
const MAX_ITEMS = 40;
const MAX_TEXT = 700;
const MAX_EXTRACT_AGE_MS = 2 * 60 * 60 * 1000;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const ZONE_OFFSET_HOURS = { UTC: 0, GMT: 0, EST: -5, EDT: -4 };

/**
 * Plain text only. Tags are removed until none remain, angle brackets are
 * never produced from entities, and any bracket left over is dropped, so the
 * result cannot contain markup.
 */
function decode(value) {
  let text = String(value).replace(/<br\s*\/?>/gi, '\n');
  let previous;
  do {
    previous = text;
    text = text.replace(/<[^>]*>/g, '');
  } while (text !== previous);
  return text
    .replace(/[<>]/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;|&gt;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function clip(value) {
  const text = decode(value).replace(/\n+/g, ' ');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 3).trimEnd()}...` : text;
}

/** "Thu Nov 12 10:05:00 2026 UTC (...)" or the same without a zone (then UTC). */
export function parsePennTime(value) {
  const match = /[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})(?:\s+([A-Z]{3,4}))?/.exec(String(value || ''));
  if (!match) return '';
  const month = MONTHS[match[1].toLowerCase()];
  const offset = ZONE_OFFSET_HOURS[match[7] || 'UTC'];
  if (month === undefined || offset === undefined) return '';
  const timestamp = Date.UTC(Number(match[6]), month, Number(match[2]), Number(match[3]) - offset, Number(match[4]), Number(match[5]));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function field(block, label) {
  const match = new RegExp(`<th[^>]*>\\s*${label}:\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i').exec(block);
  return match ? decode(match[1]) : '';
}

function described(description, label) {
  const match = new RegExp(`<b>\\s*${label}\\s*</b>\\s*:\\s*([\\s\\S]*?)(?=<b>[^<]{2,40}</b>\\s*:|$)`, 'i').exec(description);
  return match ? clip(match[1]) : '';
}

/**
 * Parse Penn's page into the items that are still open. Anything that does not
 * look exactly like an incident block is skipped rather than guessed at.
 */
export function parsePennIncidents(html, now = Date.now()) {
  const text = String(html || '');
  const generatedMatch = /This extract was generated\s+([^.<]+)/i.exec(text);
  const extractGeneratedAt = generatedMatch ? parsePennTime(generatedMatch[1]) : '';
  const blocks = text.split(/<h4>/i).slice(1);
  const items = [];
  for (const block of blocks) {
    const heading = /^\s*([A-Z]{2}\d{5,8})\s+-\s+([\s\S]*?)<\/h4>/.exec(block);
    if (!heading) continue;
    const status = field(block, 'Status');
    const endTime = field(block, 'End Time');
    const classification = field(block, 'Classification').toLowerCase();
    if (!/^not ended/i.test(endTime)) continue;
    if (!/^(serviceDegradation|serviceInterruption|investigating|extendedRecovery|restoringService|verifyingService)$/i.test(status)) continue;
    if (classification !== 'incident' && classification !== 'advisory') continue;
    const startedAt = parsePennTime(field(block, 'Start Time'));
    const lastUpdated = parsePennTime(field(block, 'Last Updated'));
    const service = field(block, 'Service');
    if (!startedAt || !service) continue;
    const descriptionMatch = /<th[^>]*>\s*Description:\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i.exec(block);
    const description = descriptionMatch ? descriptionMatch[1] : '';
    items.push({
      id: heading[1],
      title: clip(heading[2]),
      service: clip(service),
      feature_group: clip(field(block, 'Feature Group')),
      classification,
      status,
      started_at: startedAt,
      last_updated: lastUpdated || startedAt,
      user_impact: described(description, 'User impact'),
      current_status: described(description, 'Current status')
    });
  }
  items.sort((a, b) => Number(b.classification === 'incident') - Number(a.classification === 'incident')
    || Date.parse(b.last_updated) - Date.parse(a.last_updated));
  const extractAgeMs = extractGeneratedAt ? now - Date.parse(extractGeneratedAt) : Number.POSITIVE_INFINITY;
  const fresh = extractAgeMs >= -10 * 60 * 1000 && extractAgeMs <= MAX_EXTRACT_AGE_MS;
  return {
    ok: blocks.length > 0 && fresh,
    reason: !blocks.length ? 'The page did not contain any incident blocks.' : !fresh ? 'The page extract is missing a time or is more than two hours old.' : '',
    extract_generated_at: extractGeneratedAt,
    items: fresh ? items.slice(0, MAX_ITEMS) : []
  };
}

export function advisoriesDocument(parsed, fetchedAt) {
  return {
    schema: 1,
    kind: 'supplement',
    publisher: PENN_PUBLISHER,
    source_url: PENN_SOURCE_URL,
    note: 'Microsoft 365 admin-console advisories relayed by a third party for its own tenant. Supplementary only: this never sets a service state.',
    fetched_at: fetchedAt,
    ok: Boolean(parsed.ok),
    reason: parsed.reason || '',
    extract_generated_at: parsed.extract_generated_at || '',
    items: parsed.items || []
  };
}

async function main() {
  const fetchedAt = new Date().toISOString();
  let parsed = { ok: false, reason: 'Not fetched.', extract_generated_at: '', items: [] };
  try {
    const response = await fetch(PENN_SOURCE_URL, { redirect: 'follow', signal: AbortSignal.timeout(25_000), headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (compatible; status-supplement)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!/text\/html/i.test(type)) throw new Error(`Unexpected content type ${type}`);
    const body = await response.text();
    if (body.length > 8 * 1024 * 1024) throw new Error('Page is larger than 8 MiB.');
    parsed = parsePennIncidents(body);
  }
  catch (error) {
    parsed = { ok: false, reason: `Could not read the page: ${error instanceof Error ? error.message : String(error)}`, extract_generated_at: '', items: [] };
  }
  const document = advisoriesDocument(parsed, fetchedAt);
  fs.writeFileSync(OUTPUT, `${JSON.stringify(document)}\n`, 'utf8');
  console.log(`M365_ADVISORIES ok=${document.ok} items=${document.items.length} incidents=${document.items.filter(item => item.classification === 'incident').length}${document.reason ? ` reason="${document.reason}"` : ''}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  // A supplement must never fail the release.
  main().catch(error => { console.log(`M365_ADVISORIES ok=false reason="${error?.message || error}"`); }).finally(() => process.exit(0));
}
