import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const sharedEntry = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));

/**
 * The renderer is loaded from disk in production (file://), where response
 * headers cannot carry a CSP. The policy is injected into the built HTML instead
 * so the dev server (which needs inline HMR scripts) stays untouched.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicyPlugin(): Plugin {
  return {
    name: 'condeck-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          '<!-- CSP_PLACEHOLDER -->',
          `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`,
        );
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicyPlugin()],
  resolve: {
    alias: {
      '@condeck/shared': sharedEntry,
    },
  },
  server: {
    port: 5273,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'chrome130',
  },
});
