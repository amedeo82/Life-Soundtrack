import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
