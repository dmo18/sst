import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const content = fs.readFileSync(path, 'utf8');
  if (!content.includes(before)) throw new Error(`Refinement target missing in ${path}: ${before.slice(0, 100)}`);
  fs.writeFileSync(path, content.replace(before, after));
}

replaceOnce('scripts/update-public-status.mjs',
`export async function generatePublicStatus() {
`,
`export function reconcileProviderIncidentEvidence(result, now = Date.now()) {
  const incidents = (result?.incidents || []).filter(item => activeIncident(item, now));
  if (incidents.length || !['major', 'degraded'].includes(result?.service_state)) return { ...result, incidents };
  return {
    ...result,
    incidents: [],
    status: 'Current incident evidence unavailable',
    color: 'blue',
    service_state: 'unknown',
    source_state: result.source_state === 'available' ? 'limited' : result.source_state,
    attention: 'watch',
    ok: false,
    message: 'The official source exposed an issue state without current timestamped incident evidence. It was not presented as an active provider incident.'
  };
}

export async function generatePublicStatus() {
`
);
replaceOnce('scripts/update-public-status.mjs',
`  const results = await collectWithBudgets(catalog, resolvePublicSource, loadPublicProvider, collectionLimits);
  const incidents = results.flatMap(result => result.incidents || [])
`,
`  const collectedResults = await collectWithBudgets(catalog, resolvePublicSource, loadPublicProvider, collectionLimits);
  const results = collectedResults.map(result => reconcileProviderIncidentEvidence(result));
  const incidents = results.flatMap(result => result.incidents || [])
`
);

replaceOnce('scripts/__tests__/incident-freshness.test.js',
`import { providerIncidentConclusion } from '../incident-detail-repairs.mjs';
`,
`import { providerIncidentConclusion } from '../incident-detail-repairs.mjs';
import { reconcileProviderIncidentEvidence } from '../update-public-status.mjs';
`
);
replaceOnce('scripts/__tests__/incident-freshness.test.js',
`test('Cisco update dates cannot become incident titles or bypass US scope', () => {
`,
`test('provider state cannot remain affected after stale incident evidence is removed', () => {
  const stale = reconcileProviderIncidentEvidence({
    id: 'vendor',
    name: 'Vendor',
    service_state: 'major',
    source_state: 'available',
    attention: 'critical',
    color: 'red',
    ok: true,
    incidents: [{ title: 'Old issue', note: 'Investigating', status: 'investigating', color: 'red', rawTime: '2026-03-03T19:55:00Z' }]
  }, now);
  assert.equal(stale.service_state, 'unknown');
  assert.equal(stale.source_state, 'limited');
  assert.equal(stale.incidents.length, 0);
  assert.equal(stale.ok, false);

  const current = reconcileProviderIncidentEvidence({
    id: 'vendor',
    name: 'Vendor',
    service_state: 'degraded',
    source_state: 'available',
    attention: 'action',
    color: 'amber',
    ok: true,
    incidents: [{ title: 'Current issue', note: 'Investigating', status: 'investigating', color: 'amber', rawTime: '2026-08-02T05:30:00Z' }]
  }, now);
  assert.equal(current.service_state, 'degraded');
  assert.equal(current.incidents.length, 1);
});

test('Cisco update dates cannot become incident titles or bypass US scope', () => {
`
);

fs.appendFileSync('src/styles/mobile-ops.css', `
@media (max-width: 900px) {
  .metric-tile { position: relative; }
  .metric-tile header { display: block; padding-right: 0; }
  .metric-tile header em { display: none; }
  .metric-tile header::after {
    width: 6px;
    height: 6px;
    position: absolute;
    top: 13px;
    right: 13px;
    border-radius: 999px;
    background: #4be2ad;
    box-shadow: 0 0 0 4px rgba(75, 226, 173, .08);
    content: '';
  }
  .data-table-row.service-major { border-left: 3px solid var(--red); }
  .data-table-row.service-degraded { border-left: 3px solid var(--amber); }
  .data-table-row.source-blind:not(.service-major):not(.service-degraded) { border-left: 3px solid #8494aa; }
}
`);

console.log('Applied provider evidence reconciliation and mobile polish.');
