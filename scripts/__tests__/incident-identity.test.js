import assert from 'node:assert/strict';
import test from 'node:test';
import { fallbackIncidentToken, uniqueIncidentIds } from '../incident-identity.mjs';
import { providerSpecificConclusion } from '../public-source-repairs.mjs';

test('fallback incident tokens are deterministic and distinguish semantic records', () => {
  const first = fallbackIncidentToken({ provider: 'Vendor', title: 'Service issue', note: 'API requests are failing', source: 'current-page' });
  const again = fallbackIncidentToken({ provider: 'Vendor', title: 'Service issue', note: 'API requests are failing', source: 'current-page' });
  const second = fallbackIncidentToken({ provider: 'Vendor', title: 'Service issue', note: 'Login requests are failing', source: 'current-page' });
  assert.equal(first, again);
  assert.notEqual(first, second);
});

test('duplicate incident ids are only disambiguated after the first occurrence', () => {
  const records = uniqueIncidentIds([
    { id: 'vendor:incident', providerId: 'vendor', title: 'Issue', note: 'API impact', url: 'https://status.vendor.test/' },
    { id: 'vendor:incident', providerId: 'vendor', title: 'Issue', note: 'Login impact', url: 'https://status.vendor.test/' }
  ]);
  assert.equal(records[0].id, 'vendor:incident');
  assert.match(records[1].id, /^vendor:incident:/);
  assert.notEqual(records[0].id, records[1].id);
});

test('current-page source conclusions publish a stable source-level id', () => {
  const one = providerSpecificConclusion(
    { id: 'ringcentral', name: 'RingCentral' },
    '<main>A portion of customers may be experiencing SMS impact. Incident status updates Investigating</main>'
  );
  const two = providerSpecificConclusion(
    { id: 'ringcentral', name: 'RingCentral' },
    '<main>A portion of customers may be experiencing SMS impact. Incident status updates Investigating</main>'
  );
  assert.ok(one?.id);
  assert.equal(one?.id, two?.id);
});
