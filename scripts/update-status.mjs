export * from './status-core.mjs';
import { validatePayload as validateCorePayload } from './status-core.mjs';

export function validatePayload(payload) {
  const internal = payload?.schema_version === 3 ? { ...payload, schema_version: 2 } : payload;
  return validateCorePayload(internal);
}
