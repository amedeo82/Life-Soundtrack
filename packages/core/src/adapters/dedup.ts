import { sha1Hex } from './crypto';

/**
 * Regole di deduplicazione tracce — `02-DATA-SCHEMA.md` §5 (vincolante).
 *
 * Priorità `canonicalKey`: DEDUP-1 (ISRC) → DEDUP-2 (MBID) → DEDUP-3
 * (fuzzy name+artist+duration bucket 2s). L'export GDPR di Spotify non
 * fornisce ISRC né MBID (03-ADAPTERS/spotify.md §6), quindi la via
 * principale per Story 0.3 è DEDUP-3; la promozione a DEDUP-1/2 dopo
 * enrichment è il job `rekey()` della Story 1.4.
 */

/**
 * Rimuove le collocazioni feat./ft./with e l'eventuale collaboratore associato
 * (02§5: "rimuovi feat./ft./with"). Per la dedup, "Track feat. Someone" e
 * "Track" devono collassare alla stessa chiave, quindi la rimozione si
 * estende fino al delimitatore successivo (parentesi, virgola, fine stringa).
 */
const FEAT_RE = /\s(?:feat\.?|ft\.?|with)\b[^()]*?(?=[(,;]|$)/gi;

/**
 * Normalizza un nome per la dedup (02§5): lowercase → rimuovi feat./ft./with
 * → rimuovi i contenuti tra parentesi tonde/quadre → rimuovi punteggiatura
 * → collassa gli spazi → trim.
 *
 * Nota: la punteggiatura (incluso `&`) viene rimossa in modo deterministico:
 * la chiave canonica deve essere stabile, non leggibile ("Simon & Garfunkel"
 * e "Simon and Garfunkel" restano artisti distinti — fusioni false evitate).
 */
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(FEAT_RE, ' ')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bucket di durata da 2 secondi (02§5): assorbe il rounding ±1-2s tra piattaforme. */
export function durationBucketMs(durationMs: number): number {
  return Math.floor(durationMs / 2000) * 2000;
}

/** Campi usati dal calcolo del `canonicalKey` (02§5). */
export interface CanonicalKeyInput {
  name: string;
  /** Artista principale (campo artist della piattaforma, normalizzato qui). */
  artistPrincipal: string;
  /** Durata di riferimento: catalogo se noto, altrimenti proxy `ms_played` (spotify.md §3.1.1). */
  durationMs: number | null;
  isrc?: string | null;
  mbid?: string | null;
}

/**
 * Calcola il `canonicalKey` (02§5, valutato al momento dell'upsert):
 *
 * - DEDUP-1: `isrc:<ISRC upper>` se ISRC presente
 * - DEDUP-2: `mbid:<mbid>` se MBID presente (senza ISRC)
 * - DEDUP-3: `fuzzy:<sha1(normalize(name)+'|'+normalize(artist)+'|'+durationBucketMs)>`
 *
 * Con `durationMs` null il bucket è 0: usato solo da piattaforme senza durata.
 */
export async function canonicalKey(input: CanonicalKeyInput): Promise<string> {
  if (input.isrc) {
    return `isrc:${input.isrc.toUpperCase()}`;
  }
  if (input.mbid) {
    return `mbid:${input.mbid}`;
  }
  const bucket = durationBucketMs(input.durationMs ?? 0);
  const material = `${normalizeName(input.name)}|${normalizeName(input.artistPrincipal)}|${bucket}`;
  return `fuzzy:${await sha1Hex(material)}`;
}
