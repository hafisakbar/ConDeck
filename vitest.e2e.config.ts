import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

/** E2E runs against the built mobile PWA, so it is a separate config/script. */
export default defineConfig({
  resolve: {
    alias: {
      '@condeck/shared': fromRoot('./packages/shared/src/index.ts'),
      '@condeck/database': fromRoot('./packages/database/src/index.ts'),
      '@condeck/action-engine': fromRoot('./packages/action-engine/src/index.ts'),
      '@condeck/obs-integration': fromRoot('./packages/obs-integration/src/index.ts'),
      '@condeck/websocket-protocol': fromRoot('./packages/websocket-protocol/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
