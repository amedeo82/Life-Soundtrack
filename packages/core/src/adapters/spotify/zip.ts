/**
 * Shim di compatibilità: l'implementazione è stata spostata in `../zip.ts`
 * (utility condivisa anche dall'adapter YouTube Music). Tutti gli import
 * esistenti `./zip` continuano a funzionare.
 */
export { extractZipEntry, isZip, listZipEntries } from '../zip';
