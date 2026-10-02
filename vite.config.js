import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages hosts this repository under /QuestAR/. Keep the root path
  // for local development and the existing Node/Railway deployment.
  base: process.env.GITHUB_PAGES === 'true' ? '/QuestAR/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
});
