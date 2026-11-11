import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const COMPACT_DEVICE_MAX_WIDTH = 900;

function compactDeviceMediaContract(): Plugin {
  const compactMedia = /@media\s*\(\s*max-width\s*:\s*(\d+)px\s*\)(?!\s*and\s*\(\s*max-device-width)/g;

  return {
    name: 'compact-device-media-contract',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!cleanId.endsWith('.css')) return null;

      const transformed = code.replace(compactMedia, (match, rawWidth) => {
        const width = Number(rawWidth);
        if (!Number.isFinite(width) || width > COMPACT_DEVICE_MAX_WIDTH) return match;
        return `@media (max-width: ${width}px) and (max-device-width: ${width}px)`;
      });

      return transformed === code ? null : { code: transformed, map: null };
    }
  };
}

// Official Statuspage hosts whose address differs from the catalog entry. They
// mirror the collector's structured source overrides.
const STATUSPAGE_ORIGIN_OVERRIDES: Record<string, string> = {
  keeper: 'https://statuspage.keeper.io',
  'bitdefender-gravityzone': 'https://status.gravityzone.bitdefender.com'
};

function officialStatuspageConnectPolicy(): Plugin {
  type CatalogEntry = { id: string; enabled?: boolean; sourceType?: string; url?: string };
  const rawProviders = JSON.parse(readFileSync(new URL('./config/providers.json', import.meta.url), 'utf8')) as CatalogEntry[];
  const consolidation = JSON.parse(readFileSync(new URL('./config/provider-consolidation.json', import.meta.url), 'utf8')) as {
    excludedProviderIds?: string[];
    providerOverrides?: Record<string, Partial<CatalogEntry>>;
  };
  const excluded = new Set(consolidation.excludedProviderIds || []);
  // The same canonical catalog the collector and the browser bundle use, so a
  // consolidated provider is allowed under its real status host.
  const active = rawProviders
    .filter(provider => !excluded.has(provider.id))
    .map(provider => ({ ...provider, ...(consolidation.providerOverrides?.[provider.id] || {}) }))
    .filter(provider => provider.enabled !== false && provider.sourceType === 'statuspage' && provider.url);
  const origins = [...new Set(active.map(provider => STATUSPAGE_ORIGIN_OVERRIDES[provider.id] || new URL(provider.url as string).origin))]
    .sort();

  return {
    name: 'official-statuspage-connect-policy',
    transformIndexHtml(html) {
      const marker = "connect-src 'self' ws: wss:";
      if (!html.includes(marker)) throw new Error('index.html CSP connect-src marker is missing');
      return html.replace(marker, `${marker} ${origins.join(' ')}`);
    }
  };
}

export default defineConfig({
  base: '/sst/',
  publicDir: 'public',
  plugins: [compactDeviceMediaContract(), officialStatuspageConnectPolicy(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome98',
    cssTarget: 'chrome98'
  }
});
