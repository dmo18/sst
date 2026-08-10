import providerCatalog from '../config/providers.json';
import providerConsolidation from '../config/provider-consolidation.json';
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
