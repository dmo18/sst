import assert from 'node:assert/strict';
import test from 'node:test';
import { componentStatusDisposition, componentStatusIsProblem } from '../componentStatus.ts';
import { payloadValidationErrors } from '../payloadValidation.ts';
import { effectiveIncidentTime, incidentTemporalEvidence } from '../statusContract.ts';
import { buildIssueConsoleModel } from '../statusViewModel.ts';
import { isAlertWithinWindow } from '../wallboardRoute.ts';
import type { Incident, StatusPayload } from '../types.ts';

function currentPageIncident(observedAt: string): Incident {
  return {
    id: 'ringcentral:current-page',
    providerId: 'ringcentral',
    provider: 'RingCentral',
    category: 'Communications',
    title: 'RingCentral public status reports an active issue',
    note: 'A portion of customers may be experiencing service impact.',
    source: 'RingCentral public status dashboard',
    url: 'https://status.ringcentral.com/',
    time: '',
    rawTime: '',
    first_detected: '',
    latest_update: '',
    observed_at: observedAt,
    evidence_basis: 'current-page',
    status: 'active',
    color: 'amber',
    service_state: 'degraded',
    attention: 'action',
    priority: 90
  };
}

function minimalPayload(incident: Incident): StatusPayload {
  return {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    providers: [{
      id: 'ringcentral',
      name: 'RingCentral',
      category: 'Communications',
      status: '1 active current public incident',
      color: 'amber',
      service_state: 'degraded',
      source_state: 'available',
      source_health: 'healthy',
      truth_basis: 'vendor-incident',
      attention: 'action',
      ok: true,
      source: 'https://status.ringcentral.com/',
      priority: 90,
      status_data_valid: true,
      evidence_tier: 'rendered-page',
      source_confidence: 'medium',
      component_status: [],
      data_quality_score: 80,
      collection_attempt_count: 1,
      collection_success_count: 1,
      collection_failure_count: 0
    }],
    incidents: [incident],
    maintenance: [],
    changes: [],
    history: [],
    summary: {
      service_overall: 'degraded',
      source_overall: 'available',
      active_incident_count: 1,
      affected_provider_count: 1,
      confirmed_operational_count: 0,
      degraded_count: 1,
      major_count: 0,
      unknown_count: 0,
      limited_count: 0,
      unavailable_count: 0,
      disabled_count: 0,
      pending_count: 0,
      stale_count: 0,
      provider_total: 1,
      enabled_provider_count: 1,
      coverage_percent: 100,
      live_source_coverage_percent: 100,
      valid_status_count: 1,
      invalid_status_count: 0,
      valid_status_percent: 100,
      confirmed_operational_percent: 0
    }
  };
}

test('current-page evidence has a canonical effective time and remains inside wallboard alert windows', () => {
  const now = Date.parse('2026-08-10T21:00:00.000Z');
  const observedAt = '2026-08-10T20:59:00.000Z';
  const incident = currentPageIncident(observedAt);
  assert.equal(effectiveIncidentTime(incident), observedAt);
  assert.equal(incidentTemporalEvidence(incident, now).valid, true);
  assert.equal(isAlertWithinWindow(effectiveIncidentTime(incident), now, 36 * 60 * 60 * 1000), true);

  const model = buildIssueConsoleModel(minimalPayload(incident), 'vtest');
  assert.equal(model.actionQueue[0]?.updatedAt, observedAt);
});

test('browser validation requires fresh explicit provenance for untimed current-page incidents', () => {
  const observedAt = new Date(Date.now() - 60_000).toISOString();
  const valid = minimalPayload(currentPageIncident(observedAt));
  assert.equal(payloadValidationErrors(valid, ['ringcentral']).includes('invalid incident temporal evidence ringcentral:current-page'), false);

  const missingBasis = minimalPayload({ ...currentPageIncident(observedAt), evidence_basis: undefined });
  assert.equal(payloadValidationErrors(missingBasis, ['ringcentral']).includes('invalid incident temporal evidence ringcentral:current-page'), true);

  const stale = minimalPayload(currentPageIncident(new Date(Date.now() - 73 * 60 * 60 * 1000).toISOString()));
  assert.equal(payloadValidationErrors(stale, ['ringcentral']).includes('invalid incident temporal evidence ringcentral:current-page'), true);
});

test('browser validation enforces canonical provider identity parity', () => {
  const payload = minimalPayload(currentPageIncident(new Date(Date.now() - 60_000).toISOString()));
  const errors = payloadValidationErrors(payload, ['ringcentral', 'github']);
  assert.equal(errors.some(error => error.includes('provider catalog mismatch') && error.includes('github')), true);
});

test('component status policy distinguishes healthy, problem, and neutral states', () => {
  assert.equal(componentStatusDisposition('Operational'), 'healthy');
  assert.equal(componentStatusDisposition('Major Outage'), 'problem');
  assert.equal(componentStatusDisposition('Unknown'), 'neutral');
  assert.equal(componentStatusDisposition('Scheduled Maintenance'), 'neutral');
  assert.equal(componentStatusIsProblem('Unknown'), false);
  assert.equal(componentStatusIsProblem('Degraded Performance'), true);
});
