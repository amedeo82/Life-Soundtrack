/**
 * Persistenza `PrivacySettings` (02-DATA-SCHEMA.md §3.8) in localStorage.
 * Chiave `ls:privacy`.
 *
 * I default **non** sono tutti `off`: i toggle che descrivono dati già
 * conservati e non identificativi (`retainCountry`, `retainDeviceType`) sono
 * `true`, quelli che riguardano dati identificanti o stimati (`retainIp`,
 * `retainCity`, `retainDeviceDetail`) sono `false`
 * (19-GEO-CONTEXT.md §7.1, decisione del project owner sull'issue #108).
 */
import type { PrivacySettings } from '@core/schema';

const STORAGE_KEY = 'ls:privacy';

export const DEFAULT_PRIVACY: PrivacySettings = {
  retainIp: false,
  retainCountry: true,
  retainCity: false,
  retainDeviceType: true,
  retainDeviceDetail: false,
  deriveContext: true,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

/** Carica le impostazioni privacy (default se assenti/malformate). */
export function loadPrivacy(): PrivacySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PRIVACY };
    }
    const parsed = JSON.parse(raw) as Partial<PrivacySettings>;
    return {
      ...DEFAULT_PRIVACY,
      ...parsed,
      scrobbleHubs: Array.isArray(parsed.scrobbleHubs) ? parsed.scrobbleHubs : [],
    };
  } catch {
    return { ...DEFAULT_PRIVACY };
  }
}

/** Salva le impostazioni privacy (fallback silenzioso se localStorage assente). */
export function savePrivacy(privacy: PrivacySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(privacy));
  } catch {
    // localStorage indisponibile o quota esaurita: ignora senza bloccare l'UI.
  }
}
