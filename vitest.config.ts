import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@condeck/shared': fromRoot('./packages/shared/src/index.ts'),
      '@condeck/database': fromRoot('./packages/database/src/index.ts'),
      '@condeck/action-engine': fromRoot('./packages/action-engine/src/index.ts'),
      '@condeck/obs-integration': fromRoot('./packages/obs-integration/src/index.ts'),
      '@condeck/tiktok-live-studio-integration': fromRoot(
        './packages/tiktok-live-studio-integration/src/index.ts',
      ),
      '@condeck/websocket-protocol': fromRoot('./packages/websocket-protocol/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-electron/**'],
  },
});
