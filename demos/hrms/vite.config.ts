import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/demos/hrms/',
  plugins: [react()],
  build: { outDir: '../../public/demos/hrms', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:4000' }, // API_URL lets the e2e suite run its own API
  },
});
