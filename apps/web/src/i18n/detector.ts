/**
 * Rilevamento lingua per Life-Soundtrack (T0.6.2).
 * Ordine di risoluzione: localStorage (`ls.language`) → lingua del browser → 'en'.
 * Lingue MVP: it, en (08-COPY-I18N header; 00-VISION §Perimetro MVP).
 */

export type AppLanguage = 'it' | 'en';

export const LANGUAGE_STORAGE_KEY = 'ls.language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'it' || value === 'en';
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Legge la lingua persistita dall'utente (scelte precedenti in Settings).
 * Valori corrotti o non supportati vengono ignorati (nessun crash).
 */
export function readStoredLanguage(
  storage: Pick<Storage, 'getItem'> | null = defaultStorage(),
): AppLanguage | null {
  try {
    const raw = storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    return isAppLanguage(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Persiste la lingua scelta dall'utente. Se lo storage non è disponibile
 * (private mode, quota), la scelta resta valida solo per la sessione corrente.
 */
export function persistLanguage(
  lang: AppLanguage,
  storage: Pick<Storage, 'setItem'> | null = defaultStorage(),
): void {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // storage non disponibile: nessun fallimento visibile per l'utente
  }
}

export interface DetectLanguageDeps {
  /** Sorgente alternativa per la lingua persistita (test). */
  getStored?: () => string | null;
  /** Lingua browser alternativa (test). */
  navigatorLanguage?: string;
}

/**
 * Ordine `localStorage → browser` (AC T0.6.2). Lingue browser non supportate
 * (es. `fr-FR`) degradano a 'en', default internazionale del MVP.
 */
export function detectLanguage(deps: DetectLanguageDeps = {}): AppLanguage {
  const stored = deps.getStored !== undefined ? deps.getStored() : readStoredLanguage();
  if (isAppLanguage(stored)) {
    return stored;
  }
  const browser =
    deps.navigatorLanguage ?? (typeof navigator !== 'undefined' ? navigator.language : undefined);
  return browser !== undefined && browser.toLowerCase().startsWith('it') ? 'it' : 'en';
}
