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

function officialStatuspageConnectPolicy(): Plugin {
  const rawProviders = JSON.parse(readFileSync(new URL('./config/providers.json', import.meta.url), 'utf8')) as Array<{
    enabled?: boolean;
    sourceType?: string;
    url?: string;
  }>;
  const origins = [...new Set(rawProviders
    .filter(provider => provider.enabled !== false && provider.sourceType === 'statuspage' && provider.url)
    .map(provider => new URL(provider.url as string).origin))]
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
