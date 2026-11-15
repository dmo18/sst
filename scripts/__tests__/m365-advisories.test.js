import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { advisoriesDocument, parsePennIncidents, parsePennTime } from '../collect-m365-advisories.mjs';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-08-02T13:44:00Z');

function block({ id, title, status = 'serviceDegradation', end = 'Not ended yet', service = 'Exchange Online', classification = 'incident', start = 'Sun Aug 2 10:05:00 2026 UTC (Sun Aug 2 06:05:00 2026 EDT)' }) {
  return `<h4>${id} - ${title}</h4><table>
    <tr><th class="hright">Status:</th><td>${status}</td></tr>
    <tr><th class="hright">Start Time:</th><td>${start}</td></tr>
    <tr><th class="hright">End Time:</th><td>${end}</td></tr>
    <tr><th class="hright">Service:</th><td>${service}</td></tr>
    <tr><th class="hright">Feature Group:</th><td>E-Mail and calendar access</td></tr>
    <tr><th class="hright">Classification:</th><td>${classification}</td></tr>
    <tr><th class="hright">Last Updated:</th><td>Sun Aug 2 13:00:00 2026 UTC (Sun Aug 2 09:00:00 2026 EDT)</td></tr>
  </table><table>
    <tr><th class="vtop hright">Time:</th><td>Sun Aug 2 13:00:00 2026 UTC</td></tr>
    <tr><th class="vtop hright">Description:</th><td><b>Title</b>: ${title}<br>
<b>User impact</b>: Users may be unable to connect &amp; read mail.<br>
<b>Current status</b>: We&rsquo;re restarting affected <i>infrastructure</i>.<br>
<b>Next update by</b>: Sunday, August 2, 2026, at 3:00 PM UTC</td></tr>
    <tr><th class="vtop hright">Description:</th><td><b>User impact</b>: an older update</td></tr></table><hr>`;
}

const page = body => `<p>This extract was generated Sun Aug 2 09:30:00 2026 EDT.</p>${body}`;

test('Penn times are read as UTC, with or without a zone, and Eastern stamps are converted', () => {
  assert.equal(parsePennTime('Thu Nov 12 10:05:00 2026 UTC (Thu Nov 12 05:05:00 2026 EST)'), '2026-11-12T10:05:00.000Z');
  assert.equal(parsePennTime('Thu Nov 12 18:26:10 2026'), '2026-11-12T18:26:10.000Z');
  assert.equal(parsePennTime('Sat Nov 14 22:20:01 2026 EST'), '2026-11-15T03:20:01.000Z');
  assert.equal(parsePennTime('Sun Aug 2 09:30:00 2026 EDT'), '2026-08-02T13:30:00.000Z');
  assert.equal(parsePennTime('N/A'), '');
});

test('only open incidents and advisories are kept, incidents first, with the latest text', () => {
  const parsed = parsePennIncidents(page([
    block({ id: 'MP1507695', title: 'Audit log delays', classification: 'advisory', service: 'Microsoft Purview' }),
    block({ id: 'EX1550543', title: 'Mailbox connection failures' }),
    block({ id: 'TM1550488', title: 'Teams restored', status: 'serviceRestored', end: 'Sun Aug 2 12:00:00 2026 UTC' }),
    block({ id: 'CP1527498', title: 'Review published', status: 'postIncidentReviewPublished', end: 'Sat Aug 1 12:00:00 2026 UTC' }),
    block({ id: 'ZZ1', title: 'Malformed identifier' }),
    block({ id: 'IT1549049', title: 'Unknown class', classification: 'planned' })
  ].join('')), NOW);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.items.map(item => item.id), ['EX1550543', 'MP1507695']);
  const [incident] = parsed.items;
  assert.equal(incident.service, 'Exchange Online');
  assert.equal(incident.started_at, '2026-08-02T10:05:00.000Z');
  assert.equal(incident.user_impact, 'Users may be unable to connect & read mail.');
  assert.equal(incident.current_status, "We're restarting affected infrastructure.");
});

test('relayed text can never carry markup', () => {
  const hostile = block({ id: 'EX1550543', title: 'Nested <scr<script>ipt>alert(1)</scr</script>ipt> and &lt;img src=x&gt; title' });
  const [item] = parsePennIncidents(page(hostile), NOW).items;
  assert.doesNotMatch(item.title, /[<>]/);
  assert.doesNotMatch(JSON.stringify(item), /<script|<img/i);
});

test('a stale, undated or unrecognized page yields no items and is not ok', () => {
  const stale = parsePennIncidents(page(block({ id: 'EX1550543', title: 'Old' })), NOW + 3 * 60 * 60 * 1000);
  assert.equal(stale.ok, false);
  assert.deepEqual(stale.items, []);
  const undated = parsePennIncidents(block({ id: 'EX1550543', title: 'No stamp' }), NOW);
  assert.equal(undated.ok, false);
  const login = parsePennIncidents('<html><body>Please sign in</body></html>', NOW);
  assert.equal(login.ok, false);
  assert.deepEqual(login.items, []);
  const document = advisoriesDocument(login, '2026-08-02T13:44:00.000Z');
  assert.equal(document.kind, 'supplement');
  assert.equal(document.ok, false);
});

test('the supplement stays out of the status payload, the wallboard and the totals', async () => {
  const [collector, pkg, release, ignore, wallboard, compact, model, home, reader] = await Promise.all([
    read('scripts/collect-m365-advisories.mjs'), read('package.json'), read('.github/workflows/refresh-pages.yml'), read('.gitignore'),
    read('src/WallboardV2.tsx'), read('src/CompactIncidentBoard.tsx'), read('src/statusViewModel.ts'), read('src/StatusHome.tsx'), read('src/microsoftAdvisories.ts')
  ]);
  assert.doesNotMatch(collector, /status\.json/);
  assert.match(collector, /finally\(\(\) => process\.exit\(0\)\)/);
  assert.match(pkg, /emit-status-contract && node scripts\/collect-m365-advisories\.mjs"/);
  assert.match(release, /cp public\/m365-advisories\.json dist\/ 2>\/dev\/null \|\| rm -f dist\/m365-advisories\.json/);
  assert.match(ignore, /^public\/m365-advisories\.json$/m);
  for (const source of [wallboard, compact, model]) assert.doesNotMatch(source, /advisor/i);
  assert.match(home, /Unofficial/);
  assert.match(home, /It may not match your tenants and it does not change the status above\./);
  assert.match(reader, /document\.ok !== true/);
  assert.match(reader, /ADVISORIES_MAX_AGE_MS = 60 \* 60 \* 1000/);
});
