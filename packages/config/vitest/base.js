export const vitestBase = {
  test: {
    globals: false,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.*', 'src/**/*.spec.*'],
    },
  },
};
