import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 1500,
    // Phaser (the game engine) is big and rarely changes: keeping it in its own file lets a phone cache it between updates.
    rollupOptions: { output: { manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined) } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
