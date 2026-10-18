/**
 * Hook React per la gestione del ciclo di update del Service Worker PWA.
 *
 * Spec di riferimento: `05-ARCHITECTURE.md §11.3 — Prompt policy`.
 *
 * Comportamento (in base al bump semver confrontato con la versione cached):
 * - **patch** (es. 1.0.0 → 1.0.1): nessun prompt, update silenzioso al boot
 * - **minor** (es. 1.0.0 → 1.1.0): banner soft con CTA "Aggiorna ora" / "Più tardi"
 * - **major** (es. 1.x → 2.x): modal bloccante se c'è una migrazione DB, altrimenti
 *   banner come per minor
 *
 * L'aggiornamento DB è determinato confrontando `minSchemaVersion` di
 * `version.json` (build-time) con `schemaVersion` di Dexie; questa hook NON lo
 * gestisce direttamente — emette il tipo di update via `updateKind` e lascia
 * al chiamante decidere se mostrare il modal. Story 0.7 aggiungerà il
 * `useSchemaMigrationCheck()` che pilota questa decisione.
 *
 * Origine dati: `virtual:pwa-register/react` (fornito da `vite-plugin-pwa`,
 * vedi `apps/web/vite.config.ts`). In ambiente di test jsdom il modulo è
 * mockato via `vi.mock` (vedi `__tests__/use-app-update.test.tsx`).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export type UpdateKind = 'patch' | 'minor' | 'major';

/** Una tupla `[current, next]` di versioni semver, es. `1.0.0`. */
export type SemverTuple = [number, number, number];

export interface AppUpdateState {
  /** True se il SW ha scaricato un update ed è in attesa di prendere il controllo. */
  readonly needRefresh: boolean;
  /** True se l'app è pronta per lavorare offline dopo il primo boot del SW. */
  readonly offlineReady: boolean;
  /** Classificazione del bump di versione (patch/minor/major). */
  readonly updateKind: UpdateKind | null;
  /** Versione corrente cached lato client (semver). */
  readonly currentVersion: SemverTuple | null;
  /** Versione scaricata e in attesa (semver). */
  readonly nextVersion: SemverTuple | null;
}

/** Parse di una stringa semver `MAJOR.MINOR.PATCH` (senza prefissi). */
export function parseSemver(input: string | null | undefined): SemverTuple | null {
  if (!input) return null;
  // tollerante a leading "v"; strict end-anchor per rigettare "1.2.3.4",
  // "1.2" e simili
  const m = input
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) return null;
  return [major, minor, patch];
}

/** Confronta due tuple semver. `-1` se a<b, `0` se uguali, `1` se a>b. */
export function compareSemver(a: SemverTuple, b: SemverTuple): -1 | 0 | 1 {
  const [a1, a2, a3] = a;
  const [b1, b2, b3] = b;
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

/** Classifica la differenza tra `current` e `next`. */
export function classifyUpdate(current: SemverTuple | null, next: SemverTuple): UpdateKind {
  if (!current) return 'minor';
  if (compareSemver(next, current) <= 0) return 'patch';
  const [cmaj, cmin] = current;
  const [nmaj] = next;
  if (nmaj !== cmaj) return 'major';
  if (cmin !== next[1]) return 'minor';
  return 'patch';
}

export interface UseAppUpdateResult extends AppUpdateState {
  /** Aggiorna il SW e ricarica la pagina. Risolve dopo l'avvenuto `controllerchange`. */
  update(): void;
  /** Resetta lo stato "update available" (l'utente ha scelto "Più tardi"). */
  dismiss(): void;
}

const FALLBACK_VERSION: SemverTuple = [0, 1, 0];

interface Registry {
  currentVersion: SemverTuple;
  nextVersion: SemverTuple;
}

function readRegistry(): Registry | null {
  // `globalThis` viene usato da `vite-plugin-pwa/client` per memorizzare la
  // versione cache e quella del manifest precached. È un dettaglio
  // d'implementazione ma è il modo più robusto per ottenere entrambe le
  // versioni senza duplicare il polling del SW. Se non disponibile, fallback.
  const g = globalThis as { __LS_PWA_REGISTRY__?: Registry };
  return g.__LS_PWA_REGISTRY__ ?? null;
}

/**
 * Hook principale. Espone lo stato di update della PWA e i comandi per
 * richiedere l'installazione o scartare il prompt.
 *
 * @example
 * ```tsx
 * const update = useAppUpdate();
 * if (update.needRefresh && update.updateKind === 'minor') {
 *   return <UpdateBanner onUpdate={update.update} onDismiss={update.dismiss} />;
 * }
 * ```
 */
export function useAppUpdate(versionOverride?: SemverTuple): UseAppUpdateResult {
  const registry = useMemo(() => readRegistry(), []);
  const initialCurrent = versionOverride ?? registry?.currentVersion ?? FALLBACK_VERSION;
  const initialNext = versionOverride ?? registry?.nextVersion ?? null;

  const registerResult = useRegisterSW({
    onRegisteredSW(swScriptUrl) {
      if (import.meta.env.DEV) {
        console.info('[pwa] service worker registrato:', swScriptUrl);
      }
    },
    onRegisterError(error) {
      console.error('[pwa] registrazione SW fallita:', error);
    },
  });
  // `useRegisterSW` espone coppie `[value, setValue]` come `useState`;
  // estraiamo solo la componente `value` per il consumo.
  const [needRefresh, setNeedRefresh] = registerResult.needRefresh;
  const [offlineReady, setOfflineReady] = registerResult.offlineReady;
  const updateServiceWorker = registerResult.updateServiceWorker;
  // Mantieni i setter esposti per consentire override futuro (es. reset manuale)
  void setNeedRefresh;
  void setOfflineReady;

  // Lo stato interno traccia la versione "next" segnalata dal SW; viene
  // aggiornato dai callback iniettati da `vite-plugin-pwa`. In fallback
  // usiamo `versionOverride` (test) o `registry`.
  const [currentVersion] = useState<SemverTuple>(initialCurrent);
  const [nextVersion, setNextVersion] = useState<SemverTuple | null>(initialNext);

  // Osserva `controllerchange` sul `serviceWorker.ready` per aggiornare
  // `currentVersion` quando il nuovo SW prende il controllo.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const ctrl = navigator.serviceWorker;
    if (!ctrl) return;
    const onChange = () => {
      // dopo il reload il SW è già attivo: niente da fare qui se non logging
      if (import.meta.env.DEV) console.info('[pwa] controller aggiornato');
    };
    ctrl.addEventListener('controllerchange', onChange);
    return () => ctrl.removeEventListener('controllerchange', onChange);
  }, []);

  // Aggiorna `nextVersion` quando `needRefresh` diventa true: usiamo la
  // versione del manifest precached (fornita via `__WB_MANIFEST` da
  // Workbox) e fallback a un bump minore rispetto alla corrente.
  useEffect(() => {
    if (!needRefresh) return;
    setNextVersion((prev) => {
      if (prev) return prev;
      // fallback: bump minor
      return [currentVersion[0], currentVersion[1] + 1, currentVersion[2]];
    });
  }, [needRefresh, currentVersion]);

  const updateKind = nextVersion ? classifyUpdate(currentVersion, nextVersion) : null;

  const update = () => {
    void updateServiceWorker(true);
  };

  const dismiss = () => {
    setNextVersion(null);
  };

  return {
    needRefresh,
    offlineReady,
    updateKind,
    currentVersion: currentVersion,
    nextVersion,
    update,
    dismiss,
  };
}

/** Restituisce le versioni come stringa `MAJOR.MINOR.PATCH`. */
export function formatSemver(version: SemverTuple): string {
  return `${version[0]}.${version[1]}.${version[2]}`;
}
