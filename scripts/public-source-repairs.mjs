export * from './public-source-repairs-legacy.mjs';
import { providerSpecificConclusion as legacyProviderSpecificConclusion } from './public-source-repairs-legacy.mjs';
import { normalizeCurrentPageConclusion } from './source-adapter-sdk.mjs';

export function providerSpecificConclusion(provider, html) {
  return normalizeCurrentPageConclusion(
    provider,
    legacyProviderSpecificConclusion(provider, html),
    provider?.url || ''
  );
}
