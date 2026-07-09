import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (normalizedId.includes('/node_modules/phaser/')) {
            return 'phaser';
          }

          if (normalizedId.includes('/node_modules/')) {
            return 'vendor';
          }

          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'node',
    globals: false
  }
});
