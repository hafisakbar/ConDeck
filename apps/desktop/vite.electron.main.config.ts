import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const nodeBuiltins = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

const sharedEntry = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const databaseEntry = fileURLToPath(new URL('../../packages/database/src/index.ts', import.meta.url));
const actionEngineEntry = fileURLToPath(
  new URL('../../packages/action-engine/src/index.ts', import.meta.url),
);
const obsIntegrationEntry = fileURLToPath(
  new URL('../../packages/obs-integration/src/index.ts', import.meta.url),
);
const websocketProtocolEntry = fileURLToPath(
  new URL('../../packages/websocket-protocol/src/index.ts', import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      '@condeck/shared': sharedEntry,
      '@condeck/database': databaseEntry,
      '@condeck/action-engine': actionEngineEntry,
      '@condeck/obs-integration': obsIntegrationEntry,
      '@condeck/websocket-protocol': websocketProtocolEntry,
    },
  },
  build: {
    target: 'node20',
    outDir: 'dist-electron/main',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: 'electron/main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      // electron itself and the native SQLite binding must stay outside the bundle.
      external: ['electron', 'better-sqlite3', 'ws', 'qrcode', ...nodeBuiltins],
    },
  },
});
