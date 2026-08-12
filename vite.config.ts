import react from '@vitejs/plugin-react';
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

export default defineConfig({
  base: '/sst/',
  publicDir: 'public',
  plugins: [compactDeviceMediaContract(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome98',
    cssTarget: 'chrome98'
  }
});