import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { vitestBase } from '@ls/config/vitest/base';
import { CONTENT_SECURITY_POLICY, CONTENT_SECURITY_POLICY_DEV } from './src/security/csp';

// Mock del virtual module esposto da `vite-plugin-pwa` per Vitest.
// In produzione è generato da Vite; in jsdom lo sostituiamo con uno stub.
const pwaMockPath = fileURLToPath(
  new URL('./src/__mocks__/virtual-pwa-register.ts', import.meta.url),
);

export default mergeConfig(
  vitestBase,
  defineConfig({
    plugins: [
      react(),
      VitePWA({
        // ⚠️ Story 0.5 — PWA e service worker.
        //
        // `registerType: 'prompt'` richiede interazione utente per
        // applicare gli update (default UX del banner in §11.3 di
        // `05-ARCHITECTURE.md`); 'autoUpdate' bypassa il prompt e può
        // lasciare l'utente su una versione cache buggata.
        registerType: 'prompt',
        // Inject automatico dell'update listener (`vite-plugin-pwa/register`)
        // per `useRegisterSW()` (hook `useAppUpdate` in T0.5.4).
        injectRegister: 'auto',
        // Manifest PWA (Web App Manifest spec, v0.2). Definito inline così
        // è versionato con il codice Vite e la build non ha side-effect su
        // /public. Theme color allineato a `design/tokens.json` brand.violet.
        manifest: {
          name: 'Life Soundtrack',
          short_name: 'Life-Soundtrack',
          description: 'La colonna sonora della tua vita, costruita localmente sui tuoi ascolti.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#0A0E1A',
          theme_color: '#8B5CF6',
          lang: 'it',
          categories: ['music', 'lifestyle'],
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          // Aggiornato manualmente in `version.json` al rilascio (Story 0.7
          // T0.7.6 implementerà il build script che lo genera da
          // `package.json` + `git rev-parse HEAD`).
        },
        // Strategia cache Workbox (vedi 05-ARCHITECTURE §11.2):
        //
        // - Precache shell: `vite build` include `index.html` + tutti gli
        //   asset JS/CSS bundlati. Gli URL precached finiscono in
        //   `self.__WB_MANIFEST` e vengono scaricati all'install del SW.
        // - Runtime cache "assets": Google Fonts/CDN statici non usati
        //   nel MVP, ma il glob è predisposto. Workbox gestisce `Revision`
        //   caching per il precache e CacheFirst per la runtime cache.
        // - `/version.json`: NetworkFirst con fallback cache, TTL breve —
        //   la hook `useAppUpdate()` confronta la versione cached con
        //   quella del server per decidere se mostrare il banner.
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/version\.json$/],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname === '/version.json',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'ls-version',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 1, maxAgeSeconds: 60 * 5 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ls-google-fonts',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
          cleanupOutdatedCaches: true,
          // Sorgente dati di cache = precache + runtime. Workbox lo gestisce
          // automaticamente; questa opzione silenzia il warning su dev.
          sourcemap: false,
        },
        // Disabilitato in dev: il SW può interferire con HMR; in build
        // il precache viene generato automaticamente.
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
        '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
        '@web': fileURLToPath(new URL('./src', import.meta.url)),
        // Virtual module di `vite-plugin-pwa` risolto a uno stub in test.
        // Vitest legge `resolve.alias` in fase di `vite-node`.
        'virtual:pwa-register/react': pwaMockPath,
      },
    },
    // La CSP dichiarata in `12-DEVOPS.md` §2.1 (v1.0) applicata al server:
    // `preview` serve la build di produzione e usa la policy di produzione;
    // `server` (dev) usa la stessa policy con il solo rilassamento di
    // `script-src` dichiarato in `src/security/csp.ts` (Vite inietta un
    // preamble inline per React Refresh).
    server: {
      headers: {
        'Content-Security-Policy': CONTENT_SECURITY_POLICY_DEV,
      },
    },
    preview: {
      headers: {
        'Content-Security-Policy': CONTENT_SECURITY_POLICY,
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./test-setup.ts'],
    },
  }),
);
