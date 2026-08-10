export * from './public-source-adapter-implementation.mjs';
import { providerSpecificConclusion as implementationProviderSpecificConclusion } from './public-source-adapter-implementation.mjs';
import { SourceAdapterRegistry } from './source-adapter-sdk.mjs';

const registry = new SourceAdapterRegistry().register({
  id: 'provider-specific-current-page',
  conclude: (provider, html) => implementationProviderSpecificConclusion(provider, html)
});

export const PUBLIC_SOURCE_ADAPTER_IDS = registry.ids();

export function providerSpecificConclusion(provider, html) {
  return registry.conclude('provider-specific-current-page', provider, html, {
    currentPage: true,
    sourceUrl: provider?.url || ''
  });
}
