/**
 * Il fallback euristico — `21-AUDIO-FEATURES.md` v1.0 🟢 §8.
 *
 * Limiti dichiarati dalla spec, e rispettati qui:
 *
 * - stima **solo** campi ricavabili dai metadata **già presenti** (genere,
 *   durata): **nessuna** chiamata di rete;
 * - **non** stima `valence` ed `energy`: la tonalità da sola non dice il
 *   mood, e per D-AF.4 l'euristico non alimenta comunque il mood tracker;
 * - il `source` è `heuristic`: la UI lo dichiara come stima.
 *
 * Le tabelle sono **scelte di progetto dichiarate**, non misure: un peso
 * non dichiarato è un peso nascosto (la stessa regola che vale per la
 * derivazione mood → valence/energy di `21§7.3`).
 */

import { CURRENT_FEATURE_SCHEMA_VERSION } from './mapping';
import type { AudioFeatures, Track } from '../schema';
import type { AudioFeatureProvider, Clock, FeatureContext } from './types';

/** I BPM medi per genere (stima, non misura). */
export const GENRE_TEMPO: Readonly<Record<string, number>> = {
  ambient: 80,
  'bossa nova': 130,
  blues: 90,
  classical: 90,
  country: 110,
  disco: 120,
  'drum and bass': 174,
  dubstep: 140,
  edm: 128,
  electronic: 120,
  folk: 110,
  funk: 110,
  house: 128,
  'hip hop': 90,
  indie: 115,
  'indie rock': 120,
  jazz: 110,
  'k-pop': 120,
  latin: 100,
  metal: 140,
  pop: 120,
  punk: 160,
  rap: 90,
  'r&b': 90,
  reggae: 80,
  rock: 120,
  salsa: 100,
  soul: 85,
  soundtrack: 100,
  techno: 130,
  trance: 138,
};

/** La ballabilità stimata per genere (stima, non misura). */
export const GENRE_DANCEABILITY: Readonly<Record<string, number>> = {
  ambient: 0.2,
  'bossa nova': 0.55,
  blues: 0.35,
  classical: 0.25,
  country: 0.4,
  disco: 0.92,
  'drum and bass': 0.85,
  dubstep: 0.8,
  edm: 0.9,
  electronic: 0.75,
  folk: 0.35,
  funk: 0.85,
  house: 0.9,
  'hip hop': 0.85,
  indie: 0.5,
  'indie rock': 0.55,
  jazz: 0.35,
  'k-pop': 0.8,
  latin: 0.85,
  metal: 0.45,
  pop: 0.7,
  punk: 0.5,
  rap: 0.8,
  'r&b': 0.6,
  reggae: 0.6,
  rock: 0.6,
  salsa: 0.85,
  soul: 0.5,
  soundtrack: 0.45,
  techno: 0.88,
  trance: 0.85,
};

/** L'acustica stimata per genere (stima, non misura). */
export const GENRE_ACOUSTICNESS: Readonly<Record<string, number>> = {
  ambient: 0.8,
  'bossa nova': 0.85,
  blues: 0.85,
  classical: 0.95,
  country: 0.8,
  disco: 0.1,
  'drum and bass': 0.08,
  dubstep: 0.05,
  edm: 0.08,
  electronic: 0.1,
  folk: 0.9,
  funk: 0.15,
  house: 0.1,
  'hip hop': 0.15,
  indie: 0.4,
  'indie rock': 0.4,
  jazz: 0.75,
  'k-pop': 0.2,
  latin: 0.45,
  metal: 0.2,
  pop: 0.25,
  punk: 0.25,
  rap: 0.1,
  'r&b': 0.2,
  reggae: 0.6,
  rock: 0.35,
  salsa: 0.4,
  soul: 0.6,
  soundtrack: 0.5,
  techno: 0.05,
  trance: 0.05,
};

/**
 * Normalizza un genere per il confronto con le tabelle.
 *
 * @param genre - il genere grezzo.
 * @returns il genere normalizzato.
 */
export function normalizeGenre(genre: string): string {
  return genre.trim().toLowerCase();
}

/**
 * Il genere migliore da usare per la stima.
 *
 * Prima il **match esatto**; poi, se non c'è, il match per contenimento con
 * la chiave **più lunga** (e, a parità di lunghezza, la prima in ordine
 * alfabetico): così "electronic rock" cade su "electronic" (la chiave più
 * specifica) e non su "rock" in modo casuale. La regola è deterministica.
 *
 * @param genres - i generi disponibili.
 * @param table - la tabella da interrogare.
 * @returns il valore stimato, `null` se nessun genere corrisponde.
 */
export function estimateFromGenres<T extends Record<string, number>>(
  genres: readonly string[],
  table: Readonly<T>,
): number | null {
  const normalized = genres.map(normalizeGenre).filter((genre) => genre.length > 0);
  for (const genre of normalized) {
    const exact = table[genre];
    if (exact !== undefined) return exact;
  }
  const keys = Object.keys(table).sort((a, b) => b.length - a.length || a.localeCompare(b));
  for (const genre of normalized) {
    for (const key of keys) {
      if (!genre.includes(key)) continue;
      const value = table[key];
      if (value !== undefined) return value;
    }
  }
  return null;
}

/** Opzioni del provider euristico. */
export interface HeuristicProviderOptions {
  /** L'orologio iniettato. */
  readonly clock: Clock;
}

/**
 * Il provider euristico.
 *
 * È l'unico ramo che **non può fallire** (`21§5.1`): quando i generi non
 * bastano, non produce nulla (e la pipeline non scrive una riga vuota,
 * `21§11.3`).
 */
export function createHeuristicProvider(options: HeuristicProviderOptions): AudioFeatureProvider {
  const { clock } = options;

  return {
    id: 'heuristic',

    canHandle(): boolean {
      return true;
    },

    async fetch(track: Track, context: FeatureContext): Promise<AudioFeatures | null> {
      const genres = [...track.genres, ...(context.artistGenres ?? [])];
      const tempo = estimateFromGenres(genres, GENRE_TEMPO);
      const danceability = estimateFromGenres(genres, GENRE_DANCEABILITY);
      const acousticness = estimateFromGenres(genres, GENRE_ACOUSTICNESS);

      if (tempo === null && danceability === null && acousticness === null) {
        return null;
      }

      return {
        trackId: track.id,
        valence: null,
        energy: null,
        danceability,
        acousticness,
        instrumentalness: null,
        speechiness: null,
        liveness: null,
        tempo,
        key: null,
        mode: null,
        loudness: null,
        timeSignature: null,
        source: 'heuristic',
        fetchedAt: clock.now(),
        schemaVersion: CURRENT_FEATURE_SCHEMA_VERSION,
      };
    },
  };
}
