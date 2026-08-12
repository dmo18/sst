export * from './public-source-adapter-implementation.mjs';
import {
  additionalPublicOverrides as implementationAdditionalPublicOverrides,
  providerSpecificConclusion as implementationProviderSpecificConclusion
} from './public-source-adapter-implementation.mjs';
import { SourceAdapterRegistry } from './source-adapter-sdk.mjs';

// Microsoft's unauthenticated public incident feed is an incident/fallback signal, not
// authoritative health for Exchange, Teams, SharePoint, OneDrive, Intune, Apps,
// Defender, Power Platform, or a tenant. Keep active incident parsing, but do not
// convert an empty/readable feed into an operational Microsoft 365 conclusion.
implementationAdditionalPublicOverrides.microsoft365 = {
  mode: 'feed',
  url: 'https://status.cloud.microsoft/api/feed/mac',
  pageUrl: 'https://status.cloud.microsoft/',
  sourceName: 'Microsoft 365 public incident RSS',
  maxAgeHours: 336,
  allowEmpty: true,
  confirmHealthyFromFeed: false
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
