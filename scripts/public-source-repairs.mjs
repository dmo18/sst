export * from './public-source-adapter-implementation.mjs';
import {
  additionalPublicOverrides as implementationAdditionalPublicOverrides,
  providerSpecificConclusion as implementationProviderSpecificConclusion
} from './public-source-adapter-implementation.mjs';
import { SourceAdapterRegistry } from './source-adapter-sdk.mjs';

// Microsoft 365 is read from the JSON documents behind Microsoft's own public
// status page (admin center, Power Platform admin center, consumer workloads).
// They need no tenant or credential. They describe Microsoft's public status,
// not the health of an individual tenant, and the provider is labelled that way.
implementationAdditionalPublicOverrides.microsoft365 = {
  mode: 'microsoft-public-json',
  url: 'https://status.cloud.microsoft/api/posts/mac',
  pageUrl: 'https://status.cloud.microsoft/',
  sourceName: 'Microsoft official public service status',
  discoverFeeds: false,
  regionScope: 'global'
};

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
