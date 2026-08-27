import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10 * 60_000,
    hookTimeout: 15 * 60_000,
    reporters: ['default'],
    sequence: { concurrent: false },
    disableConsoleIntercept: true,
  },
});
