import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensure assets use relative paths for GitHub Pages
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});
