import { defineConfig } from 'vite';

export default defineConfig({
  base: '/sst/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
