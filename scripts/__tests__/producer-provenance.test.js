import assert from 'node:assert/strict';
import test from 'node:test';
import { providerSpecificConclusion } from '../public-source-repairs.mjs';

test('rendered current-page issue conclusions carry explicit provenance', () => {
  const ringCentral = providerSpecificConclusion(
    { id: 'ringcentral', name: 'RingCentral' },
    '<main>A portion of customers may be experiencing issues sending SMS messages. Incident status updates Investigating</main>'
  );
  assert.equal(ringCentral?.kind, 'issue');
  assert.equal(ringCentral?.evidenceBasis, 'current-page');

  const salesforce = providerSpecificConclusion(
    { id: 'salesforce', name: 'Salesforce' },
    '<main>Current Status Feature Degradation Services Ongoing Recently Viewed Instances</main>'
  );
  assert.equal(salesforce?.kind, 'issue');
  assert.equal(salesforce?.evidenceBasis, 'current-page');
});
