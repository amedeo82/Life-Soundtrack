import { react } from '@ls/config/eslint/react';

export default [
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  ...react,
];
