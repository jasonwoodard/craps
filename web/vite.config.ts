import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/distribution/stream': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        headers: { 'Cache-Control': 'no-cache' },
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../types'),
      // Single-source seam: web imports the engine's unit system and canonical
      // spec codec directly rather than re-deriving either (webui-plan.md W1).
      '@engine': path.resolve(__dirname, '../src'),
    },
  },
});
