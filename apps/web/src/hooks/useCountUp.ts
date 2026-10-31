/**
 * Count-up delle StatCard — Story 3.1, `docs/07-UI-SPEC.md` §2.1 e §4.
 *
 * L'animazione dura **600 ms** con easing `ease-out` (i token del design
 * system: `motion.countUp.duration`) e parte all'**hover** del valore, non
 * al mount: una StatCard che si conta da sola consuma attenzione senza
 * informare.
 *
 * `prefers-reduced-motion: reduce` **disattiva** l'animazione: il valore
 * finale è mostrato subito (`07§4`).
 */

import { useEffect, useState } from 'react';

/** Durata della count-up in ms (`design/tokens.json` → `motion.countUp.duration`). */
export const COUNT_UP_DURATION_MS = 600;

/** L'utente ha chiesto meno animazioni? */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Easing `ease-out` (cubic) sulla progressione 0..1. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Il valore attuale della count-up: parte da `from` e va verso `to`.
 *
 * Con `active` falso il valore finale è mostrato subito — l'animazione è un
 * effetto, non un prerequisito del dato.
 */
export function useCountUp(from: number, to: number, active: boolean): number {
  const [value, setValue] = useState(active ? from : to);

  useEffect(() => {
    if (!active) {
      setValue(to);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    if (typeof requestAnimationFrame !== 'function') {
      setValue(to);
      return;
    }

    let frame = 0;
    let start: number | null = null;
    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / COUNT_UP_DURATION_MS);
      setValue(from + (to - from) * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [from, to, active]);

  return value;
}
