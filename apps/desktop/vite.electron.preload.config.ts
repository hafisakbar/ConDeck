import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const nodeBuiltins = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

const sharedEntry = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@condeck/shared': sharedEntry,
    },
  },
  build: {
    target: 'node20',
    outDir: 'dist-electron/preload',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    lib: {
      entry: 'electron/preload/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.cjs',
    },
    rollupOptions: {
      external: ['electron', ...nodeBuiltins],
    },
  },
});
