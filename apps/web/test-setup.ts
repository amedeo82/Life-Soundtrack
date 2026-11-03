import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// `@testing-library/jest-dom` espone i matcher DOM. L'entry point `vitest`
// registra i matcher su `expect` di Vitest: l'entry point di default
// (`@testing-library/jest-dom`) assume i globali di Jest e fallisce con
// `ReferenceError: expect is not defined` in un ambiente `globals: false`
// (vedi `packages/config/vitest/base.js`).
import '@testing-library/jest-dom/vitest';
// Dexie usa IndexedDB: in jsdom non esiste, e senza questa polyfill ogni
// test che tocchi il DB muore con `MissingAPIError: IndexedDB API missing`.
// Stessa polyfill usata da `packages/core/vitest.setup.ts`.
import 'fake-indexeddb/auto';

// `@testing-library/react` lascia residui nel DOM di jsdom se non si chiama
// `cleanup()` tra un test e l'altro. Senza questo setup, le query successive
// (es. `screen.getByTestId('x')`) trovano match accumulati nei render
// precedenti. Con `globals: false` in `vitestBase.js`, l'auto-cleanup NON
// scatta — va abilitato manualmente.
//
// Vedi `packages/core/vitest.setup.ts` per il setup equivalente (fake-indexeddb
// + globali), che NON copre il cleanup perché `@testing-library/react` non
// serve in `@ls/core`.
afterEach(() => {
  cleanup();
});
