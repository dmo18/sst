import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { emitStatusContract } from '../emit-status-contract.mjs';
import { SourceAdapterRegistry, normalizeCurrentPageConclusion } from '../source-adapter-sdk.mjs';
import { ACTIVE_PROVIDER_CATALOG, ACTIVE_PROVIDER_CATALOG_HASH, ACTIVE_PROVIDER_IDS, providerCatalogHash } from '../../src/providerCatalog.ts';
import { wirePayloadValidationErrors } from '../../src/wirePayloadValidation.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
const reliability = {
  window_days: 7,
  sample_count: 1,
  live_percent: 100,
  limited_percent: 0,
  unavailable_percent: 0,
  schema_change_count: 0,
  slo_state: 'warming',
  daily: [{ date: '2026-08-10', samples: 1, live: 1, limited: 0, unavailable: 0, schema_changes: 0 }],
  window_30d: {
    window_days: 30,
    sample_count: 1,
    live_percent: 100,
    limited_percent: 0,
    unavailable_percent: 0,
    schema_change_count: 0,
    slo_state: 'warming',
    daily: [{ date: '2026-08-10', samples: 1, live: 1, limited: 0, unavailable: 0, schema_changes: 0 }]
  }
};
const canary = { state: 'stable', observation: 'accepted', fingerprint: 'json-test', last_changed_at: '', quarantine_state: 'clear', quarantine_since: '', stable_observations: 1 };

function draftPayload() {
  const providers = ACTIVE_PROVIDER_CATALOG.map((provider, index) => ({
    id: provider.id,
    name: provider.name,
    category: provider.category,
    status: 'Operational',
    color: 'green',
    service_state: 'operational',
    source_state: 'available',
    attention: 'informational',
    ok: true,
    source: provider.url,
    priority: provider.priority || index,
    status_data_valid: true,
    source_reliability: structuredClone(reliability),
    schema_canary: { ...canary }
  }));
  const total = providers.length;
  return {
    schema_version: 2,
    generated_at: '2026-08-10T22:00:00.000Z',
    summary: {
      service_overall: 'operational', source_overall: 'available', active_incident_count: 0, affected_provider_count: 0,
      confirmed_operational_count: total, degraded_count: 0, major_count: 0, unknown_count: 0, limited_count: 0,
      unavailable_count: 0, disabled_count: 0, pending_count: 0, stale_count: 0, provider_total: total, enabled_provider_count: total,
      coverage_percent: 100, live_source_coverage_percent: 100, valid_status_count: total, invalid_status_count: 0,
      valid_status_percent: 100, confirmed_operational_percent: 100
    },
    providers,
    incidents: [],
    changes: [],
    history: []
  };
}

test('canonical provider catalog hash is deterministic and semantic', () => {
  assert.match(ACTIVE_PROVIDER_CATALOG_HASH, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(providerCatalogHash(ACTIVE_PROVIDER_CATALOG), ACTIVE_PROVIDER_CATALOG_HASH);
  assert.equal(providerCatalogHash([...ACTIVE_PROVIDER_CATALOG].reverse()), ACTIVE_PROVIDER_CATALOG_HASH);
  const changed = ACTIVE_PROVIDER_CATALOG.map((provider, index) => index ? provider : { ...provider, priority: (provider.priority || 0) + 1 });
  assert.notEqual(providerCatalogHash(changed), ACTIVE_PROVIDER_CATALOG_HASH);
});

test('Status Contract v3 emitter binds the wire payload to the active catalog', () => {
  const wire = emitStatusContract(draftPayload());
  assert.equal(wire.schema_version, 3);
  assert.equal(wire.contract_version, 3);
  assert.equal(wire.catalog_hash, ACTIVE_PROVIDER_CATALOG_HASH);
  assert.deepEqual(wirePayloadValidationErrors(wire, ACTIVE_PROVIDER_IDS, ACTIVE_PROVIDER_CATALOG_HASH), []);
  assert.ok(wirePayloadValidationErrors({ ...wire, catalog_hash: 'fnv1a32:00000000' }, ACTIVE_PROVIDER_IDS, ACTIVE_PROVIDER_CATALOG_HASH).includes('provider catalog hash mismatch'));
});

test('source adapter SDK normalizes untimed current-page issues and prevents duplicate registration', () => {
  const provider = { id: 'example', name: 'Example', url: 'https://status.example.test/' };
  const normalized = normalizeCurrentPageConclusion(provider, { kind: 'issue', title: 'API degraded', note: 'Current status reports degradation' }, provider.url);
  assert.equal(normalized.evidenceBasis, 'current-page');
  assert.match(normalized.id, /^page-/);
  const timed = normalizeCurrentPageConclusion(provider, { kind: 'issue', title: 'API degraded', note: 'Timed', firstDetected: '2026-08-10T20:00:00Z' }, provider.url);
  assert.equal(timed.evidenceBasis, undefined);
  const registry = new SourceAdapterRegistry().register({ id: 'example', conclude: () => ({ kind: 'healthy', status: 'ok' }) });
  assert.deepEqual(registry.ids(), ['example']);
  assert.throws(() => registry.register({ id: 'example', conclude: () => null }), /Duplicate source adapter id/);
});

test('browser polling is isolated from the App composition layer', () => {
  const app = read('src/App.tsx');
  const poller = read('src/usePayloadPoller.ts');
  assert.match(app, /usePayloadPoller/);
  for (const concern of ['RequestOwnership', 'wirePayloadValidationErrors', 'MAX_BROWSER_PAYLOAD_BYTES', 'visibilitychange']) assert.doesNotMatch(app, new RegExp(concern));
  for (const concern of ['RequestOwnership', 'wirePayloadValidationErrors', 'MAX_BROWSER_PAYLOAD_BYTES', 'visibilitychange', 'ACTIVE_PROVIDER_CATALOG_HASH']) assert.match(poller, new RegExp(concern));
});

test('production HTML carries the restrictive static CSP', () => {
  const html = read('index.html');
  for (const directive of ["default-src 'self'", "script-src 'self'", "connect-src 'self' ws: wss:", "object-src 'none'", "base-uri 'self'", "form-action 'none'"]) assert.ok(html.includes(directive), directive);
  assert.doesNotMatch(html, /script-src[^>]*'unsafe-inline'/);
});

test('provider counts are derived rather than frozen as catalog literals', () => {
  const validator = read('scripts/validate-providers.mjs');
  assert.doesNotMatch(validator, /expectedRawProviderCount|expectedActiveProviderCount/);
  assert.match(validator, /catalog\.length - excluded\.size/);
});

test('quality scripts and executable pre-commit hook are wired through package scripts', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.quality, 'npm run lint && npm run format:check');
  assert.match(pkg.scripts['hooks:install'], /configure-git-hooks/);
  assert.match(read('.githooks/pre-commit'), /npm run quality/);
});

test('CI uses current immutable action generations and CodeQL is enabled', () => {
  const workflows = ['.github/workflows/test.yml', '.github/workflows/refresh-pages.yml', '.github/workflows/codeql.yml'].map(read).join('\n');
  for (const match of workflows.matchAll(/uses:\s+([^\s@]+)@([^\s#]+)/g)) assert.match(match[2], /^[0-9a-f]{40}$/, `${match[1]} is not immutable`);
  assert.match(workflows, /actions\/checkout@[0-9a-f]{40} # v7\.0\.1/);
  assert.match(workflows, /actions\/setup-node@[0-9a-f]{40} # v7\.0\.0/);
  assert.match(workflows, /github\/codeql-action\/init@[0-9a-f]{40} # v4/);
  assert.match(workflows, /github\/codeql-action\/analyze@[0-9a-f]{40} # v4/);
});

test('scheduled releases reuse a verified commit-keyed app shell and skip unchanged verification work', () => {
  const workflow = read('.github/workflows/refresh-pages.yml');
  assert.match(workflow, /verified-app-shell-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /if: github\.event_name != 'schedule'\n\s+run: npm test/);
  assert.match(workflow, /if: github\.event_name != 'schedule'\n\s+run: npm run typecheck/);
  assert.match(workflow, /if: github\.event_name != 'schedule'\n\s+run: npm audit --audit-level=high/);
  assert.match(workflow, /Restore verified application shell/);
  assert.match(workflow, /Fail-safe application build when reusable shell is unavailable/);
});

test('pinned pre-cascade-layer Chromium is a blocking non-scheduled release probe', () => {
  const workflow = read('.github/workflows/refresh-pages.yml');
  assert.match(read('vite.config.ts'), /target: 'chrome98'/);
  assert.match(workflow, /LEGACY_CHROMIUM_REVISION: "950365"/);
  assert.match(workflow, /verify-legacy-wallboard\.mjs/);
  assert.match(read('scripts/verify-legacy-wallboard.mjs'), /no-css-layers/);
});

test('reconciliation record explicitly rejects the previous reduced closure', () => {
  const record = read('docs/architecture-reconciliation.md');
  assert.match(record, /previous four-phase tracker was closed against a reduced implementation scope/i);
  assert.match(record, /Completion rule/);
});
