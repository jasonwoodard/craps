import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Component/unit test config for web/. Kept separate from vite.config.ts so
 * the dev server config (proxy, tailwind) stays untouched by test concerns.
 *
 * The `@engine` alias is the single-source seam: web tests import the very
 * modules the app imports (src/dsl/units.ts, the canonical spec codec), so a
 * units-parity assertion compares rendered output against engine truth rather
 * than against a second copy of it.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../types'),
      '@engine': path.resolve(__dirname, '../src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
