// Mock di `vite-plugin-pwa/react` (`virtual:pwa-register/react`).
//
// Vitest non è in grado di risolvere il virtual module esposto dal plugin
// Vite (è generato a build-time). Questo file viene usato come alias via
// `resolve.alias` in `vite.config.ts`: il test riceve `{ needRefresh: false,
// offlineReady: false, updateServiceWorker: () => Promise.resolve() }` di default.
//
// I test che vogliono simulare uno stato di "update available" o "offline
// ready" usano `vi.mock('virtual:pwa-register/react', () => mockFactory(...))`
// con factory custom (vedi `use-app-update.test.tsx` quando sarà aggiunto).

/**
 * @typedef {Object} RegisterSWOptions
 * @property {(swScriptUrl: string) => void} [onRegisteredSW]
 * @property {(error: unknown) => void} [onRegisterError]
 */

/**
 * @returns {{
 *   needRefresh: [boolean, (v: boolean | ((prev: boolean) => boolean)) => void],
 *   offlineReady: [boolean, (v: boolean | ((prev: boolean) => boolean)) => void],
 *   updateServiceWorker: (reloadPage?: boolean) => Promise<void>,
 * }}
 */
export function useRegisterSW() {
  const noop = () => {};
  return {
    needRefresh: [false, noop],
    offlineReady: [false, noop],
    updateServiceWorker: () => Promise.resolve(),
  };
}
