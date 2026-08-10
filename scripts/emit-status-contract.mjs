import fs from 'node:fs';
import path from 'node:path';
import { ACTIVE_PROVIDER_CATALOG_HASH, ACTIVE_PROVIDER_IDS } from '../src/providerCatalog.ts';
import { STATUS_CONTRACT_VERSION, STATUS_WIRE_SCHEMA_VERSION } from '../src/statusContract.ts';
import { wirePayloadValidationErrors } from '../src/wirePayloadValidation.ts';

export function emitStatusContract(payload) {
  const wire = {
    ...payload,
    schema_version: STATUS_WIRE_SCHEMA_VERSION,
    contract_version: STATUS_CONTRACT_VERSION,
    catalog_hash: ACTIVE_PROVIDER_CATALOG_HASH
  };
  const errors = wirePayloadValidationErrors(wire, ACTIVE_PROVIDER_IDS, ACTIVE_PROVIDER_CATALOG_HASH);
  if (errors.length) throw new Error(`Status Contract v3 emission failed: ${errors.join('; ')}`);
  return wire;
}

export function emitStatusContractFile(target = 'public/status.json') {
  const resolved = path.resolve(target);
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const wire = emitStatusContract(payload);
  const temporary = `${resolved}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(wire, null, 2)}\n`);
  fs.renameSync(temporary, resolved);
  return wire;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const wire = emitStatusContractFile(process.argv[2] || 'public/status.json');
  console.log(`Emitted Status Contract v${wire.contract_version} schema ${wire.schema_version} with catalog ${wire.catalog_hash}.`);
}