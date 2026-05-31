import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['lib/**/*.test.js', 'content/**/*.test.js', 'sidepanel/**/*.test.js'],
    globals: false,
  },
});
