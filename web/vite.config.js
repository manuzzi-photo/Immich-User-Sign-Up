import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During local development `npm run dev` proxies API calls to the backend
// running on port 2284. In production the backend serves the built assets.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:2284',
    },
  },
  build: {
    outDir: 'dist',
  },
});
