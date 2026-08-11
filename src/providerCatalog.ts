import providerCatalog from '../config/providers.json' with { type: 'json' };
import providerConsolidation from '../config/provider-consolidation.json' with { type: 'json' };
import type { ProviderConfig } from './types';

type ProviderConsolidation = {
  excludedProviderIds: string[];
  providerOverrides: Record<string, Partial<ProviderConfig>>;
};

const consolidation = providerConsolidation as ProviderConsolidation;
const excludedProviderIds = new Set(consolidation.excludedProviderIds);

export const ACTIVE_PROVIDER_CATALOG: ProviderConfig[] = (providerCatalog as ProviderConfig[])
  .filter(provider => !excludedProviderIds.has(provider.id))
  .map(provider => ({ ...provider, ...(consolidation.providerOverrides[provider.id] || {}) }));

export const ACTIVE_PROVIDER_IDS = ACTIVE_PROVIDER_CATALOG.map(provider => provider.id);

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalValue);
    return normalized.every(item => ['string', 'number', 'boolean'].includes(typeof item))
      ? [...normalized].sort((left, right) => String(left).localeCompare(String(right)))
      : normalized;
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)])
  );
}

export function providerCatalogHash(catalog: readonly ProviderConfig[]): string {
  const canonical = canonicalValue([...catalog].sort((left, right) => left.id.localeCompare(right.id)));
  const signature = JSON.stringify(canonical);
  let hash = 0x811c9dc5;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export const ACTIVE_PROVIDER_CATALOG_HASH = providerCatalogHash(ACTIVE_PROVIDER_CATALOG);
