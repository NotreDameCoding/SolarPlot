import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the built site works at any URL (GitHub Pages, Netlify, Cloudflare Pages).
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
