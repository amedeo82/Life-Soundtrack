/**
 * Debounce di un valore — Story 3.3 (`docs/06-UX-FLOWS-STATES.md` §2.9).
 *
 * La ricerca di Esplora ha un debounce di **300 ms**: ogni tasto premuto
 * ricalcolerebbe i risultati su tutto il catalogo, e il campo si "impasta"
 * sotto le dita. Il valore corrente resta immediatamente visibile nel campo:
 * è la **ricerca** che è ritardata, non la scrittura.
 */

import { useEffect, useState } from 'react';

/** Il debounce della ricerca (ms). */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Ritarda il valore di `delayMs` millisecondi.
 *
 * Il valore iniziale è applicato **subito**: al primo render non c'è nessuna
 * ricerca da ritardare, e un ritardo iniziale mostrerebbe uno schermo vuoto
 * per un quarto di secondo senza motivo.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
