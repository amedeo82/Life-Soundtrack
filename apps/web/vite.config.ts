import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestBase } from '@ls/config/vitest/base';

export default mergeConfig(
  vitestBase,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
        '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
        '@web': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
