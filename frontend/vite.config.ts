import { defineConfig } from 'vite';
import path from 'node:path';

// Vite config for Corgi Hop (Phaser 3 + TypeScript + Capacitor).
// The Emergent preview forwards `/` -> port 3000 and `/api/*` -> port 8001.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: {
      // Behind the emergent HTTPS proxy the HMR websocket needs to advertise
      // the public host on port 443 (wss) or it tries `ws://localhost:3000`.
      protocol: 'wss',
      clientPort: 443,
    },
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
