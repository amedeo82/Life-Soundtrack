import { isZip, listZipEntries } from './zip';

/**
 * Rilevamento del formato export Spotify (spotify.md §2.2):
 *
 * - **ZIP**: deve contenere almeno un `Streaming_History_Audio_*.json`
 *   (il controllo avviene sul central directory, senza decomprimere).
 * - **JSON singolo**: array (o wrapper fixture `{"events":[...]}`) i cui
 *   eventi espongono i campi `ts` + `ms_played`; si richiede anche la
 *   presenza del nome campo `spotify_track_uri` (anche null: nei podcast
 *   il campo esiste ed è null — la detection lavora sui nomi di campo).
 *
 * Un ZIP con soli `CarDetectionEvent.json`/`Userdata.json` NON è un export
 * di streaming history ⇒ detect false (AC: rifiuto senza opt-in).
 */

/** Nomi di file la cui presenza qualifica lo ZIP come export Spotify. */
const AUDIO_FILE_RE = /^Streaming_History_Audio_.+\.json$/i;

/** Prefisso dei byte letti per la detection JSON (i campi chiave sono nei primi eventi). */
const JSON_PROBE_BYTES = 2 * 1024 * 1024;

/** Riconosce un export Spotify (ZIP con streaming history audio o JSON eventi). */
export async function detectSpotify(input: Blob): Promise<boolean> {
  if (input.size === 0) {
    return false;
  }
  if (await isZip(input)) {
    try {
      const names = await listZipEntries(input);
      return names.some((name) => AUDIO_FILE_RE.test(name));
    } catch {
      return false;
    }
  }
  const head = new Uint8Array(await input.slice(0, 6).arrayBuffer());
  const first = new TextDecoder().decode(head).trimStart();
  if (first.startsWith('[') || first.startsWith('{')) {
    return detectJsonHead(input);
  }
  return false;
}

/** Sonde sui nomi di campo nei primi 2MiB di un JSON eventi. */
async function detectJsonHead(input: Blob): Promise<boolean> {
  const probe = new TextDecoder().decode(
    new Uint8Array(await input.slice(0, JSON_PROBE_BYTES).arrayBuffer()),
  );
  const hasTs = probe.includes('"ts"');
  const hasMsPlayed = probe.includes('"ms_played"');
  const hasTrackContext =
    probe.includes('"spotify_track_uri"') || probe.includes('"master_metadata_track_name"');
  return hasTs && hasMsPlayed && hasTrackContext;
}
