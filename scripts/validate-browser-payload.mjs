import fs from 'node:fs';
import path from 'node:path';
import { payloadValidationErrors } from '../src/payloadValidation.ts';
import { ACTIVE_PROVIDER_IDS } from '../src/providerCatalog.ts';

const target = path.resolve(process.argv[2] || 'public/status.json');
const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
const errors = payloadValidationErrors(payload, ACTIVE_PROVIDER_IDS);
if (errors.length) {
  for (const error of errors) console.error(`BROWSER_PAYLOAD_ERROR ${error}`);
  throw new Error(`Browser payload validation failed with ${errors.length} error(s).`);
}
console.log(`Browser payload validation passed: ${payload.providers.length} providers, ${payload.incidents.length} incidents, ${payload.maintenance?.length || 0} maintenance events.`);
