import fs from 'node:fs';
import path from 'node:path';
import { ACTIVE_PROVIDER_CATALOG_HASH, ACTIVE_PROVIDER_IDS } from '../src/providerCatalog.ts';
import { wirePayloadValidationErrors } from '../src/wirePayloadValidation.ts';

const target = path.resolve(process.argv[2] || 'public/status.json');
const payload = JSON.parse(fs.readFileSync(target, 'utf8'));
const errors = wirePayloadValidationErrors(payload, ACTIVE_PROVIDER_IDS, ACTIVE_PROVIDER_CATALOG_HASH);
if (errors.length) {
  for (const error of errors) console.error(`BROWSER_PAYLOAD_ERROR ${error}`);
  throw new Error(`Browser payload validation failed with ${errors.length} error(s).`);
}
console.log(`Browser Status Contract v${payload.contract_version} validation passed: ${payload.providers.length} providers, catalog ${payload.catalog_hash}, ${payload.incidents.length} incidents, ${payload.maintenance?.length || 0} maintenance events.`);