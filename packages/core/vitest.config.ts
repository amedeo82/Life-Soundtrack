import { mergeConfig } from 'vitest/config';
import { vitestBase } from '@ls/config/vitest/base';

export default mergeConfig(vitestBase, {
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
