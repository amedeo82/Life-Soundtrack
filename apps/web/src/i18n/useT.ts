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
