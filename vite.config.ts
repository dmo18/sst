import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function compactDeviceMediaContract(): Plugin {
  const compactQueries = [
    { width: 900, deviceWidth: 900 },
    { width: 370, deviceWidth: 370 }
  ];

  return {
    name: 'compact-device-media-contract',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.css')) return null;

      let transformed = code;
      for (const query of compactQueries) {
        const media = new RegExp(`@media\\s*\\(\\s*max-width\\s*:\\s*${query.width}px\\s*\\)(?!\\s*and\\s*\\(\\s*max-device-width)`, 'g');
        transformed = transformed.replace(
          media,
          `@media (max-width: ${query.width}px) and (max-device-width: ${query.deviceWidth}px)`
        );
      }

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