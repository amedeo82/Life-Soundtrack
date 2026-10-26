import type { RawListenEvent } from '../types';
import { lastfmMinuteKey } from './mapEvent';

/**
 * Costruzione dell'`eventKey` Last.fm (`03-ADAPTERS/lastfm.md` §3.1, D-LF.7).
 *
 * La spec dichiara la formula `lastfm:<YYYY-MM-DDTHH:MM>|<mbid ?? name|artist>`
 * e, nello stesso documento, due proprietà che quella formula non riesce a
 * soddisfare insieme:
 *
 * - **E.LF.16 / E.LF.19**: il re-import **misto** (API + file) non deve
 *   duplicare nessuno scrobble. Ma l'API e l'export `ghan.nl` non espongono
 *   il MBID con la stessa copertura: l'API lo espone spesso **vuoto**
 *   (E.LF.5), il CSV lo porta. Con il mbid nella chiave, lo stesso scrobble
 *   avrebbe due chiavi diverse a seconda del percorso.
 * - **E.LF.4**: due scrobble diversi (stesso minuto, stesso nome e artista ma
 *   registrazioni diverse) vanno tenuti distinti: serve il mbid.
 *
 * Il compromesso: **il mbid entra nella chiave solo quando serve a
 * disambiguare**, cioè quando nello stesso minuto la stessa coppia
 * nome|artista compare con **MBID diversi**. In tutti gli altri casi la
 * chiave è `<minuto>|<nome>|<artista>`, che è la forma che converge tra i
 * due percorsi.
 *
 * La perdita residua è quella già dichiarata dalla spec: due scrobble dello
 * **stesso** brano nello stesso minuto si fondono (D-LF.7, E.LF.16) — il
 * mbid non li distingue comunque, perché è lo stesso brano.
 */

/** Identità del brano dentro un minuto: nome + artista (mai divisi). */
function identityOf(raw: RawListenEvent): string {
  return `${raw.sourceTrackName}|${raw.sourceArtistName ?? ''}`;
}

interface PendingEvent {
  raw: RawListenEvent;
  identity: string;
  mbid: string | null;
}

export class LastfmEventKeyBuilder {
  private minute: string | null = null;

  private pending: PendingEvent[] = [];

  /**
   * Accetta un evento grezzo e restituisce gli eventi con chiave **risolta**
   * (quelli del minuto precedente, che non può più cambiare).
   */
  push(raw: RawListenEvent): RawListenEvent[] {
    const minute = lastfmMinuteKey(raw.rawTimestamp / 1000);
    if (this.minute !== null && minute !== this.minute) {
      const flushed = this.flush();
      this.minute = minute;
      this.pending.push({ raw, identity: identityOf(raw), mbid: raw.mbid });
      return flushed;
    }
    this.minute = minute;
    this.pending.push({ raw, identity: identityOf(raw), mbid: raw.mbid });
    return [];
  }

  /** Svuota il buffer: va chiamato a fine stream. */
  flush(): RawListenEvent[] {
    if (this.pending.length === 0) {
      return [];
    }
    const minute = this.minute ?? lastfmMinuteKey(this.pending[0]!.raw.rawTimestamp / 1000);
    const mbidsByIdentity = new Map<string, Set<string | null>>();
    for (const item of this.pending) {
      const set = mbidsByIdentity.get(item.identity) ?? new Set<string | null>();
      set.add(item.mbid);
      mbidsByIdentity.set(item.identity, set);
    }
    const resolved = this.pending.map((item) => {
      const ambiguous = (mbidsByIdentity.get(item.identity)?.size ?? 1) > 1;
      const material = ambiguous && item.mbid ? item.mbid : item.identity;
      return { ...item.raw, sourceEventId: `${minute}|${material}` };
    });
    this.pending = [];
    return resolved;
  }
}
