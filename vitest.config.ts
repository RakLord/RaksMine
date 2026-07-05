import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so `vite build` never loads test-only config.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
