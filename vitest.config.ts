// ABOUTME: Vitest configuration for unit tests.
// ABOUTME: Runs TypeScript tests under tests/ with node environment.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'node',
  },
});
