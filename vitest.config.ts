import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/lib/**', 'src/components/**', 'api/**'],
      exclude: ['**/*.test.*', '**/*.spec.*', 'test/**/*'],
    },
    exclude: ['node_modules', 'dist', '**/e2e/**', '.claude/**'],
  },
});
