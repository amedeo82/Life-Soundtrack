/**
 * Contratti della pipeline delle audio features — `21-AUDIO-FEATURES.md`
 * v1.0 🟢 §4.
 *
 * Il core espone **porte e orchestratore puri** (D-AF.5): nessuna
 * dipendenza da React, nessun accesso diretto alla rete. `fetch`, clock,
 * logger e storage sono **iniettati**, così i test non toccano mai la rete
 * (`10-TESTING.md` §8: "Mai chiamate reali in CI").
 */

import type { AudioFeatures, Track } from '../schema';
import type { Logger } from '../logger';

export type { Logger };

/** La sorgente di una feature: i quattro valori chiusi da `02§3.4`. */
export type FeatureSource = AudioFeatures['source'];

/**
 * L'origine di un campo della feature.
 *
 * Le tre categorie sono quelle del glossario (`14-GLOSSARY.md`, voce
 * "Audio features"): **misurata** (calcolata dal segnale audio),
 * **derivata** (ricavata da altri predittori) e **stimata** (euristica dai
 * soli metadata). La distinzione è ciò che rende trasparente la cascata
 * (`21§2.3`).
 *
 * `none` significa che il provider **non copre** il campo: il valore resta
 * `null` (`21§6.1`: nessun provider misura onestamente
 * `acousticness`/`instrumentalness`/`speechiness`/`liveness` in questa
 * tranche, e inventarli sarebbe falsificare la misura).
 */
export type FeatureOrigin = 'measured' | 'derived' | 'estimated' | 'none';

/** I campi numerici di `AudioFeatures` soggetti all'invariante `10§7`. */
export type FeatureField =
  | 'valence'
  | 'energy'
  | 'danceability'
  | 'acousticness'
  | 'instrumentalness'
  | 'speechiness'
  | 'liveness'
  | 'tempo'
  | 'key'
  | 'mode'
  | 'loudness'
  | 'timeSignature';

/**
 * Contesto del brano, necessario ai provider.
 *
 * `Track` (`02§3.3`) non porta il **nome dell'artista**: la ricerca del
 * preview audio lo richiede (D-AF.1: `term=<brano>&artist=<artista>`), e
 * il nome dell'artista è un dato **del brano**, non dell'utente
 * (`09§3.3`: "Solo stringhe titolo/artista").
 */
export interface FeatureContext {
  /** Nome dell'artista del brano. */
  readonly artistName: string;
  /** Genere dell'artista, se noto (usato dal fallback euristico). */
  readonly artistGenres?: readonly string[];
}

/**
 * Una fonte di audio features per un brano — `21§4.1`.
 *
 * Il provider è una **porta**, non un adapter: non ha credenziali e non
 * produce `ListenEvent`. Produce `AudioFeatures`.
 */
export interface AudioFeatureProvider {
  /** Identificatore stabile del provider: coincide con `AudioFeatures.source`. */
  readonly id: FeatureSource;
  /**
   * True se il provider può rispondere per questo brano, **senza farlo**.
   *
   * Serve a skippare un ramo della cascata senza tentativi ed errori
   * (`21§5.1`): senza MBID il ramo AcousticBrainz salta, senza preview il
   * ramo Essentia salta.
   */
  canHandle(track: Track): boolean;
  /**
   * Calcola le feature del brano.
   *
   * Non deve scrivere sul DB: la persistenza è compito della cascata
   * (`21§4.2`), così il provider resta puro e testabile. Un provider che
   * fallisce restituisce `null` o lascia emergere l'errore: la cascata lo
   * traduce in `null` + log (failure isolation, `05§7.2`).
   */
  fetch(track: Track, context: FeatureContext): Promise<AudioFeatures | null>;
  /**
   * Il motivo dell'ultimo salto, se il provider lo dichiara.
   *
   * È **opzionale**: il contratto minimo della spec (`21§4.1`) è
   * `id`/`canHandle`/`fetch`. Il motivo serve alla UI per distinguere
   * "nessun audio disponibile" (`no_audio`) da "nessun risultato"
   * (`none`): i due stati hanno testi diversi (`08§2.17`).
   */
  lastSkipReason?(): string | null;
}

/**
 * Lo stato della pipeline per un brano.
 *
 * I primi cinque valori corrispondono alle chiavi i18n `enrichment.status.*`
 * (`08§2.17`): `queued`, `analyzing`, `done`, `estimated`, `no_audio`,
 * `disabled`. `cached` e `none` sono stati interni dell'orchestratore.
 */
export type EnrichmentStatus =
  | 'cached'
  | 'essentia'
  | 'acousticbrainz'
  | 'heuristic'
  | 'manual'
  | 'disabled'
  | 'no_audio'
  | 'none';

/** L'esito dell'arricchimento di un brano. */
export interface EnrichmentOutcome {
  /** Lo stato della pipeline. */
  readonly status: EnrichmentStatus;
  /** La feature prodotta (o `null` se nessuna). */
  readonly feature: AudioFeatures | null;
  /** Motivo interno (codice, mai PII). */
  readonly reason?: string;
}

/** I tre trigger della pipeline (`05§6.1`, D-AF.7). */
export type EnrichmentTrigger = 'on-import' | 'on-demand' | 'scheduled';

/**
 * Il negozio delle feature: la porta sulla tabella `features`.
 *
 * L'implementazione Dexie vive in `storage.ts`; la cascata dipende solo
 * da questa interfaccia, così è testabile senza IndexedDB.
 */
export interface FeatureStore {
  /** La feature di un brano (undefined se assente). */
  get(trackId: string): Promise<AudioFeatures | undefined>;
  /** Scrive (o sovrascrive) la feature di un brano. */
  put(feature: AudioFeatures): Promise<void>;
  /** Tutte le feature presenti. */
  all(): Promise<AudioFeatures[]>;
  /** Quante feature sono presenti. */
  count(): Promise<number>;
  /** Elimina la feature di un brano. */
  delete(trackId: string): Promise<void>;
}

/**
 * La porta del toggle `PrivacySettings.enrichMetadata` (`02§3.8`).
 *
 * Con il toggle spento la pipeline non esce, non scrive e **non legge** la
 * cache (`21§10.4`): è la regola più restrittiva e la più facile da
 * sbagliare, quindi il controllo sta **prima** di ogni altro accesso.
 */
export interface EnrichmentPolicy {
  /** Il toggle dell'arricchimento è acceso? */
  isEnabled(): boolean | Promise<boolean>;
}

/** Opzioni di una richiesta HTTP. */
export interface HttpRequestInit {
  /** Metodo (default `GET`). */
  readonly method?: 'GET' | 'POST';
  /** Header della richiesta. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Corpo della richiesta. */
  readonly body?: string;
  /** Tipo di risposta atteso (default `text`). */
  readonly responseType?: 'text' | 'binary';
  /** Segnale di interruzione. */
  readonly signal?: AbortSignal;
}

/** La risposta di una richiesta HTTP. */
export interface HttpResponse {
  /** Codice di stato HTTP. */
  readonly status: number;
  /** Header della risposta (chiavi in minuscolo). */
  readonly headers: Readonly<Record<string, string>>;
  /** Corpo testuale (vuoto se `responseType` è `binary`). */
  readonly body: string;
  /** Byte della risposta (presenti se `responseType` è `binary`). */
  readonly bytes?: ArrayBuffer;
}

/**
 * Il client HTTP iniettato.
 *
 * La pipeline non chiama `fetch` globale: il client è passato dalla factory
 * (`21§15.2`), così il test è deterministico e non serve `nock`/`msw`.
 */
export interface HttpClient {
  /** Esegue una richiesta. */
  request(url: string, init?: HttpRequestInit): Promise<HttpResponse>;
}

/** L'orologio iniettato (unix ms). */
export interface Clock {
  /** Ora corrente, in unix ms. */
  now(): number;
}

/** La funzione di attesa iniettata (ms). */
export type Sleep = (ms: number) => Promise<void>;

/**
 * Il limiter di richieste.
 *
 * Due implementazioni (`rateLimiter.ts`): a **intervallo fisso** (MusicBrainz
 * 1 req/s, iTunes ~20 req/min) e **a header** (AcousticBrainz, che legge
 * `X-RateLimit-*`: nessuna costante hard-coded, D-AF.6).
 */
export interface RateLimiter {
  /** Attende il prossimo slot disponibile. */
  acquire(): Promise<void>;
  /** Aggiorna lo stato del limiter con gli header di una risposta. */
  observe(headers: Readonly<Record<string, string>>): void;
  /** Blocca il limiter per un tempo determinato (es. dopo un 429). */
  cooldown(ms: number): void;
}
