import { mergeConfig } from 'vitest/config';
import { vitestBase } from '@ls/config/vitest/base';

export default mergeConfig(vitestBase, {
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      // I file **solo tipi** (`types.ts`) e i **barrel** (`index.ts`) non
      // contengono una sola istruzione eseguibile: il provider v8 li
      // mappa come 0% coperto e abbassano la percentuale del modulo sotto
      // il target dichiarato in `10-TESTING.md` §2 (≥ 75% per
      // `packages/core/enrichment/*`). Escluderli **non** indebolisce il
      // gate: il codice che contiene logica resta misurato.
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/types.ts',
        'src/**/index.ts',
      ],
    },
  },
});
