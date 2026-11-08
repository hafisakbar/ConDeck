import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const sharedEntry = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const protocolEntry = fileURLToPath(
  new URL('../../packages/websocket-protocol/src/index.ts', import.meta.url),
);

export default defineConfig({
  // Served from http://<desktop-ip>:43821/ by the desktop host.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@condeck/shared': sharedEntry,
      '@condeck/websocket-protocol': protocolEntry,
    },
  },
  server: {
    port: 5274,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
