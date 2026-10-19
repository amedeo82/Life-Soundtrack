/**
 * Rollback del Service Worker in caso di fallimento di migrazione DB
 * (05-ARCHITECTURE.md §11.4, Story 0.7 T0.7.6).
 *
 * Quando una nuova versione del SW introduce una migrazione DB che fallisce,
 * l'operatore può richiedere il ripristino della versione precedente. Questa
 * funzione annulla l'update in attesa e riporta il controllo allo SW corrente.
 *
 * In ambiente di test (jsdom) il modulo `navigator.serviceWorker` può non
 * essere disponibile: la funzione degrada con grazia restituendo `false`.
 *
 * @returns true se il rollback è stato richiesto con successo, false altrimenti.
 */
export async function rollbackServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[sw:rollback] service worker non disponibile in questo ambiente');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // Se c'è un worker in attesa (waiting), lo attiviamo per ripristinare
    // il controllo immediato; altrimenti la registration corrente è già
    // attiva e non c'è nulla da rollbackare.
    if (registration.waiting) {
      void registration.waiting.postMessage({ type: 'LS_ROLLBACK_ACTIVATE' });
      return true;
    }
    return true;
  } catch (err) {
    console.error('[sw:rollback] rollback fallito', err);
    return false;
  }
}
