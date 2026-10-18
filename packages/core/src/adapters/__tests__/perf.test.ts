import { describe, it } from 'vitest';

/**
 * Performance target AC Story 0.3:
 *   "Import di file reale (≥50k eventi) in < 30s, memoria < 500MB"
 *
 * Con `fake-indexeddb` (ambiente di test) il throughput è di ordini di
 * grandezza inferiore al browser reale, e la pipeline (sha1 per
 * canonicalKey + lookup DB per artista/album) amplifica ulteriormente il
 * costo. La validazione del target verrà eseguita in ambiente browser
 * nativo prima del rilascio della milestone.
 */
describe('performance — import 50k eventi (todo: validazione su IndexedDB nativo)', () => {
  it.todo('importa 50.000 eventi in < 30s e heap delta < 500MB');
});
