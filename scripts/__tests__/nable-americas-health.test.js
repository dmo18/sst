import test from 'node:test';
import assert from 'node:assert/strict';
import { providerIncidentConclusion } from '../incident-detail-repairs.mjs';

const provider = (id) => ({ id, name: id === 'n-able' ? 'N-able' : 'Cove Data Protection' });
const dashboard = (americanStatus = 'Operational', coveStatus = 'Operational', other = 'Operational') => `
  <main><h1>Status Dashboard</h1>
    <section>Planned Scheduled Maintenance</section>
    <div>Americas ${americanStatus}</div>
    <div>N-central Hosted (Americas) ${other}</div>
    <div>Cove Data Protection (Americas) ${coveStatus}</div>
    <div>Endpoint Detection&Response (Americas) Operational</div>
    <div>APAC Degraded Performance</div>
    <div>Cove Data Protection (APAC) Degraded Performance</div>
    <div>Europe Under Maintenance</div>
    <h2>Incident &amp; Maintenance History</h2>
  </main>`;

test('explicit Americas green matrix remains trustworthy during a non-US issue or scheduled maintenance', () => {
  const html = dashboard();
  assert.equal(providerIncidentConclusion(provider('n-able'), html)?.kind, 'healthy');
  assert.equal(providerIncidentConclusion(provider('cove-data-protection'), html)?.kind, 'healthy');
});

test('Cove Americas degradation is never misreported operational', () => {
  const result = providerIncidentConclusion(provider('cove-data-protection'), dashboard('Degraded Performance', 'Degraded Performance'));
  assert.equal(result?.kind, 'component-state');
  assert.match(result?.status || '', /Cove Data Protection.*Degraded Performance/);
  assert.equal(result?.components?.[0]?.status, 'degraded_performance');
});

test('an explicit non-Cove Americas degradation blocks an all-clear N-able conclusion', () => {
  const result = providerIncidentConclusion(provider('n-able'), dashboard('Operational', 'Operational', 'Degraded Performance'));
  assert.notEqual(result?.kind, 'healthy');
});

test('historical green badges and empty markup do not establish current Americas health', () => {
  const html = '<main><h2>Incident History</h2><p>Americas was operational in August.</p></main>';
  assert.equal(providerIncidentConclusion(provider('n-able'), html), null);
  assert.equal(providerIncidentConclusion(provider('cove-data-protection'), html), null);
});
