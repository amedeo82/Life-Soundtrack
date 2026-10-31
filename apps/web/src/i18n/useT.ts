/**
 * Hook di traduzione per Life-Soundtrack (T0.6.4).
 * Wrapper su `useTranslation` di react-i18next: il componente che lo usa
 * ricalcola al cambio lingua, senza reload (AC Story 0.6).
 */

import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

/** Restituisce la funzione `t` collegata all'istanza i18n dell'app. */
export function useT(): TFunction {
  const { t } = useTranslation();
  return t;
}

/**
 * Lingua corrente dell'app (codice BCP-47, es. `it` / `en`).
 *
 * Serve ai componenti che devono formattare **dati** (date, numeri) nella
 * lingua dell'interfaccia: i nomi dei paesi e i titoli dei brani sono dati e
 * non si traducono, ma il modo in cui si presentano è della UI.
 */
export function useLanguage(): string {
  const { i18n } = useTranslation();
  return i18n.language;
}
