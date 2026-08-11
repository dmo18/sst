import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChangeDigest,
  buildHandoffText,
  buildUniverseGraph,
  buildWorkspaceSearchIndex,
  effectiveOperatorStatus,
  emptyOperatorWorkspace,
  normalizeOperatorWorkspace,
  saveLens,
  searchWorkspace,
  togglePinnedProvider,
  updateIncidentAction
} from '../operatorWorkspace.ts';
import type { IssueConsoleModel } from '../statusViewModel.ts';

const generatedAt = '2026-08-11T12:00:00.000Z';

function fixture(): IssueConsoleModel {
  return {
    version: 'v3.3.0',
    generatedAt,
    collection: null,
    incidentCount: 2,
    affectedCount: 2,
    briefs: [
      {
        id: 'incident-a', providerId: 'alpha', provider: 'Alpha', category: 'Identity', title: 'Sign-in delays', note: 'Authentication is delayed.', source: 'status', url: 'https://status.example/alpha', time: generatedAt, color: 'red', service_state: 'major', attention: 'critical', priority: 90, label: 'Major', clientDraft: 'DRAFT alpha', affectedServiceLabel: 'sign-in', mspImpact: 'Users may be unable to sign in.', technicianAction: 'Test a known-good account.', operatorPriority: 'P1', evidenceLabel: 'Structured vendor incident'
      },
      {
        id: 'incident-b', providerId: 'beta', provider: 'Beta', category: 'Identity', title: 'MFA errors', note: 'MFA errors are elevated.', source: 'status', url: 'https://status.example/beta', time: generatedAt, color: 'amber', service_state: 'degraded', attention: 'action', priority: 80, label: 'Degraded', clientDraft: 'DRAFT beta', affectedServiceLabel: 'MFA', mspImpact: 'MFA may fail.', technicianAction: 'Capture timestamps.', operatorPriority: 'P2', evidenceLabel: 'Vendor feed'
      }
    ],
    maintenance: [],
    diagnostics: [
      {
        id: 'alpha', provider: 'Alpha', category: 'Identity', serviceState: 'major', sourceState: 'available', sourceHealth: 'healthy', truthBasis: 'vendor-incident', attention: 'critical', status: 'Major outage', message: 'Sign-in delays', source: 'https://status.example/alpha', sourceHost: 'status.example', ok: true, checkedAt: generatedAt, sourceType: 'statuspage', downloadLog: [], priority: 90, criticality: 'high', tags: ['identity'], services: ['SSO'], clientImpact: '', technicianAction: '', searchText: 'alpha identity sso', changed: true, evidenceTier: 'structured', sourceConfidence: 'high', parserVersion: '1', schemaFingerprint: 'a', schemaChanged: false, schemaCanary: null, sourceReliability: null, lastSuccessAt: generatedAt, consecutiveFailures: 0, lastSemanticChangeAt: generatedAt, componentStatus: [], dataQualityScore: 96, sourceLatencyMs: 120, collectionAttemptCount: 1, collectionSuccessCount: 1, collectionFailureCount: 0, freshnessState: 'fresh', activeIncidentCount: 1, maintenanceCount: 0, problemComponentCount: 0
      },
      {
        id: 'beta', provider: 'Beta', category: 'Identity', serviceState: 'degraded', sourceState: 'available', sourceHealth: 'watch', truthBasis: 'vendor-incident', attention: 'action', status: 'Degraded', message: 'MFA errors', source: 'https://status.example/beta', sourceHost: 'status.example', ok: true, checkedAt: generatedAt, sourceType: 'feed', downloadLog: [], priority: 80, criticality: 'medium', tags: ['identity'], services: ['MFA'], clientImpact: '', technicianAction: '', searchText: 'beta identity mfa', changed: true, evidenceTier: 'feed', sourceConfidence: 'medium', parserVersion: '1', schemaFingerprint: 'b', schemaChanged: false, schemaCanary: null, sourceReliability: null, lastSuccessAt: generatedAt, consecutiveFailures: 0, lastSemanticChangeAt: generatedAt, componentStatus: [], dataQualityScore: 82, sourceLatencyMs: 180, collectionAttemptCount: 1, collectionSuccessCount: 1, collectionFailureCount: 0, freshnessState: 'fresh', activeIncidentCount: 1, maintenanceCount: 0, problemComponentCount: 0
      }
    ],
    correlations: [{ id: 'correlation:alpha|beta', providerIds: ['alpha', 'beta'], providers: ['Alpha', 'Beta'], categories: ['Identity'], incidentIds: ['incident-a', 'incident-b'], startedAt: '2026-08-11T11:30:00.000Z', latestAt: '2026-08-11T11:40:00.000Z', confidence: 'medium', label: 'Identity activity cluster', rationale: '2 active vendor-timed incidents began within 20 minutes across 1 service category. Temporal correlation only; no causal relationship is inferred.' }],
    actionQueue: [],
    categoryPulse: [{ category: 'Identity', total: 2, operational: 0, affected: 2, unknown: 0, blind: 0, averageQuality: 89 }],
    changes: [{ id: 'change-new', type: 'incident_new', provider_id: 'alpha', provider: 'Alpha', detected_at: '2026-08-11T11:45:00.000Z', title: 'Alpha incident began', attention: 'critical' }],
    history: [
      { id: 'change-old', type: 'source_recovered', provider_id: 'beta', provider: 'Beta', detected_at: '2026-08-11T10:00:00.000Z', title: 'Beta source recovered', attention: 'informational' },
      { id: 'change-new', type: 'incident_new', provider_id: 'alpha', provider: 'Alpha', detected_at: '2026-08-11T11:45:00.000Z', title: 'Alpha incident began', attention: 'critical' }
    ],
    summary: {
      service_overall: 'major', source_overall: 'available', active_incident_count: 2, affected_provider_count: 2, confirmed_operational_count: 0, degraded_count: 1, major_count: 1, unknown_count: 0, limited_count: 0, unavailable_count: 0, disabled_count: 0, pending_count: 0, stale_count: 0, provider_total: 2, enabled_provider_count: 2, coverage_percent: 100, live_source_coverage_percent: 100, valid_status_count: 2, invalid_status_count: 0, valid_status_percent: 100, confirmed_operational_percent: 0
    },
    attentionCount: 2,
    newIncidentCount: 1,
    resolvedCount: 0,
    newUnavailableCount: 0,
    maintenanceCount: 0,
    ongoingMaintenanceCount: 0,
    schemaChangeCount: 0,
    failureStreakCount: 0,
    highConfidenceCount: 1,
    componentIssueCount: 0,
    qualityScore: 89,
    healthySourceCount: 1,
    watchSourceCount: 1,
    blindSpotCount: 0
  };
}

test('operator workspace normalizes storage and keeps local workflow explicit', () => {
  const state = normalizeOperatorWorkspace({ version: 99, pinnedProviderIds: ['alpha', 'alpha', 42], actions: { bad: { nope: true } } });
  assert.deepEqual(state.pinnedProviderIds, ['alpha']);
  assert.deepEqual(state.actions, {});
  assert.equal(state.version, 1);
});

test('incident action state supports acknowledgement follow snooze and expiration', () => {
  const start = Date.parse('2026-08-11T11:00:00.000Z');
  let state = updateIncidentAction(emptyOperatorWorkspace(), 'incident-a', { status: 'acknowledged', assignee: 'Day shift' }, start);
  assert.equal(state.actions['incident-a'].status, 'acknowledged');
  state = updateIncidentAction(state, 'incident-a', { status: 'snoozed', snoozedUntil: new Date(start + 30 * 60 * 1000).toISOString() }, start);
  assert.equal(effectiveOperatorStatus(state.actions['incident-a'], start + 10 * 60 * 1000), 'snoozed');
  assert.equal(effectiveOperatorStatus(state.actions['incident-a'], start + 31 * 60 * 1000), 'open');
});

test('watchlist pins and saved lenses are deterministic browser-local state', () => {
  let state = togglePinnedProvider(emptyOperatorWorkspace(), 'alpha');
  state = togglePinnedProvider(state, 'beta');
  state = saveLens(state, 'Identity watch', state.pinnedProviderIds, Date.parse(generatedAt));
  assert.deepEqual(state.pinnedProviderIds, ['alpha', 'beta']);
  assert.equal(state.lenses[0].name, 'Identity watch');
  assert.deepEqual(state.lenses[0].providerIds, ['alpha', 'beta']);
});

test('change digest respects explicit last-reviewed cutoff', () => {
  const digest = buildChangeDigest(fixture(), '2026-08-11T11:00:00.000Z');
  assert.equal(digest.changes.length, 1);
  assert.equal(digest.newIncidents, 1);
  assert.equal(digest.recoveries, 0);
});

test('universal search spans incidents providers correlations categories and history', () => {
  const index = buildWorkspaceSearchIndex(fixture());
  assert.equal(searchWorkspace(index, 'MFA')[0].kind, 'incident');
  assert.ok(searchWorkspace(index, 'activity cluster').some(entry => entry.kind === 'correlation'));
  assert.ok(searchWorkspace(index, 'Identity').some(entry => entry.kind === 'category'));
  assert.ok(searchWorkspace(index, 'source recovered').some(entry => entry.kind === 'change'));
});

test('dependency universe contains category gravity membership and temporal correlation edges', () => {
  const graph = buildUniverseGraph(fixture());
  assert.ok(graph.nodes.some(node => node.id === 'category:Identity'));
  assert.ok(graph.nodes.some(node => node.id === 'provider:alpha' && node.tone === 'critical'));
  assert.equal(graph.edges.filter(edge => edge.kind === 'membership').length, 2);
  assert.equal(graph.edges.filter(edge => edge.kind === 'correlation').length, 1);
});

test('handoff text preserves vendor truth and labels local operator state', () => {
  const model = fixture();
  const action = updateIncidentAction(emptyOperatorWorkspace(), 'incident-a', { status: 'following', assignee: 'Night shift', note: 'Validated tenant symptoms.' }).actions['incident-a'];
  const text = buildHandoffText(model.briefs[0], model.diagnostics[0], action, model.correlations[0]);
  assert.match(text, /Vendor state: major/);
  assert.match(text, /Local operator state: following/);
  assert.match(text, /Local assignee: Night shift/);
  assert.match(text, /do not modify vendor truth/);
});
