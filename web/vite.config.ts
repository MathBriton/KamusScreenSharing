import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 127.0.0.1, não "localhost": no Node 17+ (e no Windows) "localhost" pode virar ::1 (IPv6),
      // e a API escuta só em IPv4 → "http proxy error".
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
