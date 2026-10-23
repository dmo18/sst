import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTIVE_PROVIDER_IDS } from '../src/providerCatalog.ts';

const payload = JSON.parse(fs.readFileSync(process.argv[2] || 'public/status.json', 'utf8'));
const providers = Array.isArray(payload.providers) ? payload.providers : [];
const ids = new Set(ACTIVE_PROVIDER_IDS);
assert.equal(providers.length, ids.size, 'Every enabled provider must have one status record.');
assert.deepEqual(providers.map(p => p.id).sort(), [...ids].sort(), 'Payload has disabled or missing providers.');
const generated = Date.parse(payload.generated_at);
assert.ok(Number.isFinite(generated) && Math.abs(Date.now() - generated) <= 300000, 'Collection must be fresh.');
const problems = [];
const unresolved = [];
const totals = { available: 0, limited: 0, stale: 0, operational: 0, degraded: 0, major: 0, unknown: 0 };
for (const [i, provider] of providers.entries()) {
  const p = provider;
  const logs = Array.isArray(p.download_log) ? p.download_log : [];
  const age = Math.round((generated - Date.parse(p.checked_at)) / 1000);
  const successes = logs.filter(log => log.ok === true).length;
  const failures = logs.filter(log => log.ok === false).length;
  const reason = logs.map(log => log.error || (log.ok === false ? log.message || log.status : '')).filter(Boolean).at(-1) || p.message || '';
  if (p.source_state === 'available' && p.ok === true) totals.available++;
  if (p.source_state === 'limited') totals.limited++;
  if (p.source_state === 'stale') totals.stale++;
  totals[p.service_state] = (totals[p.service_state] || 0) + 1;
  console.log('PROVIDER_AUDIT ' + JSON.stringify({
    position: i + 1, id: p.id, name: p.name, service: p.service_state,
    source_state: p.source_state, source_health: p.source_health,
    status: p.status, message: String(p.message || '').slice(0, 220),
    source_url: p.source, source_type: p.source_type, checked_at: p.checked_at, age_seconds: age,
    official_fetch_successes: successes, official_fetch_failures: failures,
    last_error: String(reason).slice(0, 190), basis: p.status_data_basis,
    confidence: p.source_confidence, tier: p.evidence_tier,
    active_incident_count: p.active_incident_count || 0, data_quality: p.data_quality_score
  }));
  if (p.status_data_valid !== true) problems.push(p.id + ': invalid status');
  if (!Number.isFinite(age) || age < -300 || age > 300) problems.push(p.id + ': stale observation');
  if (p.source_state === 'disabled' || p.source_state === 'pending') problems.push(p.id + ': disabled/pending leaked');
  if (p.service_state === 'operational' && (p.source_state !== 'available' || p.ok !== true)) problems.push(p.id + ': operational without live official evidence');
  if (p.source_state === 'available' && successes === 0) problems.push(p.id + ': claimed live without successful official request');
  if (p.source_state !== 'available' || p.ok !== true || p.service_state === 'unknown') unresolved.push(p.id);
}
console.log('PROVIDER_AUDIT_SUMMARY ' + JSON.stringify({ total: providers.length, ...totals, unresolved, errors: problems, generated_at: payload.generated_at }));
if (problems.length) {
  console.error('Provider evidence correctness failures: ' + problems.join('; '));
  process.exitCode = 1;
}

// Probe the raw Zoom Statuspage summary only when its current health is inconclusive.
// No source bodies or private tokens are logged.
if (unresolved.includes('zoom')) {
  try {
    const response = await fetch('https://www.zoomstatus.com/api/v2/summary.json', { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
    const j = await response.json();
    console.log('ZOOM_SOURCE_DIAGNOSTIC ' + JSON.stringify({
      http: response.status, status: j.status, page: j.page?.url,
      unresolved: (j.incidents || []).filter(x => !/^(resolved|completed|postmortem)$/i.test(x.status || '')).slice(0, 8).map(x => ({
        id: x.id, name: x.name, status: x.status, impact: x.impact, created_at: x.created_at, updated_at: x.updated_at,
        affected: (x.components || []).map(c => c.name), updates: (x.incident_updates || []).slice(0, 2).map(u => ({created_at:u.created_at,updated_at:u.updated_at,status:u.status}))
      })),
      problem_components: (j.components || []).filter(x => !x.group && x.status !== 'operational').slice(0, 15).map(x => ({name:x.name,status:x.status})),
      total_incidents: j.incidents?.length
    }));
  } catch (err) { console.log('ZOOM_SOURCE_DIAGNOSTIC_FAILED ' + String(err)); }
}
