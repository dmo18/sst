import { payloadValidationErrors } from './payloadValidation.ts';
import { STATUS_CONTRACT_VERSION, STATUS_WIRE_SCHEMA_VERSION } from './statusContract.ts';
import type { StatusPayload } from './types';

export function wirePayloadValidationErrors(
  value: unknown,
  expectedProviderIds: readonly string[],
  expectedCatalogHash: string
): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return ['payload must be an object'];
  const payload = value as Record<string, unknown>;

  if (payload.schema_version !== STATUS_WIRE_SCHEMA_VERSION) errors.push('unsupported wire schema_version');
  if (payload.contract_version !== STATUS_CONTRACT_VERSION) errors.push('unsupported contract_version');
  if (typeof payload.catalog_hash !== 'string' || payload.catalog_hash !== expectedCatalogHash) errors.push('provider catalog hash mismatch');

  const internalDraft = { ...payload, schema_version: 2 };
  errors.push(...payloadValidationErrors(internalDraft, expectedProviderIds));
  return [...new Set(errors)];
}

export function isWireStatusPayload(
  value: unknown,
  expectedProviderIds: readonly string[],
  expectedCatalogHash: string
): value is StatusPayload {
  return wirePayloadValidationErrors(value, expectedProviderIds, expectedCatalogHash).length === 0;
}