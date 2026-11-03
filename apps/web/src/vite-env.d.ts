/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
// Matcher DOM di `@testing-library/jest-dom` per Vitest: il reference
// all'entry point `/vitest` dichiara l'augmentazione di `vitest.Assertion`
// (i matcher `toBeInTheDocument`, `toHaveTextContent`, ...).
//
// Il reference è qui, e non nel file di test, per due motivi:
//  1. `apps/web/tsconfig.json` include `src` ma NON `test-setup.ts`: un
//     import di tipo dentro `test-setup.ts` non verrebbe visto dal
//     typecheck (`tsc -p tsconfig.json --noEmit`).
//  2. `vitestBase` ha `globals: false`: il tipo di `expect` arriva solo
//     dall'import esplicito da `vitest`, mai dai globali.
/// <reference types="@testing-library/jest-dom/vitest" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
