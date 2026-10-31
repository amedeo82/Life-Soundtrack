/**
 * Tipi e parametri dell'Event Detector — `04-ANALYSIS-ALGORITHMS.md` v1.2 🟢 §6.
 *
 * I parametri vivono qui, e solo qui: il `derivedVersion` (04§1.1, §9) è
 * l'hash di questo oggetto, quindi **ogni** parametro che influisce sul
 * risultato deve comparire in `EventConfig`. Un parametro fuori da qui
 * sarebbe un parametro non versionato: gli eventi vecchi non diventerebbero
 * `stale` al suo cambio (MIG-3, 02§7).
 *
 * I sei parametri della tabella 04§6.5 (`baselineDays`, `windowDays`,
 * `zScoreThreshold`, `silenceMinDays`, `explorationMinNewArtists`,
 * `strideDays`) sono il nucleo ratificato da `04§9`.
 *
 * **`minBaselineDays` e `minDominantShare` sono in più**: sono le due
 * condizioni che la spec non esplicita, dichiarate in
 * `docs/state/sessions/70-event-detector.md` (D.70.1, D.70.2) e riflesse
 * nel registro dei parametri di `04§9`.
 */

/**
 * Set di parametri dell'event detector — 04§6.5 + 04§9.
 */
export interface EventConfig {
  /** Finestra di baseline, in giorni — 04§6.5. */
  readonly baselineDays: number;
  /** Finestra di analisi, in giorni — 04§6.5. */
  readonly windowDays: number;
  /** Soglia dello z-score — 04§6.5. */
  readonly zScoreThreshold: number;
  /** Silenzio minimo, in giorni — 04§6.5. */
  readonly silenceMinDays: number;
  /** Artisti nuovi minimi in una finestra di esplorazione — 04§6.5. */
  readonly explorationMinNewArtists: number;
  /** Passo della griglia di analisi, in giorni — 04§6.5. */
  readonly strideDays: number;
  /**
   * Giorni **con dati** minimi perché una baseline sia utilizzabile.
   *
   * È la condizione che rende lo z-score calcolabile: una baseline con due
   * giorni non ha una deviazione standard, e la sua media non descrive
   * l'abitudine dell'utente (D.70.1).
   */
  readonly minBaselineDays: number;
  /**
   * Quota minima perché un artista o un genere **domini** la finestra.
   *
   * È la condizione che rende il detector a quota distinguibile da una
   * variazioneordinary: senza, ogni ascolto di un artista già noto sarebbe
   * un «picco» (D.70.2).
   */
  readonly minDominantShare: number;
}

/** Override dei parametri dell'event detector (configurazione parziale). */
export interface EventConfigOverrides {
  readonly baselineDays?: number;
  readonly windowDays?: number;
  readonly zScoreThreshold?: number;
  readonly silenceMinDays?: number;
  readonly explorationMinNewArtists?: number;
  readonly strideDays?: number;
  readonly minBaselineDays?: number;
  readonly minDominantShare?: number;
}

/**
 * Default dei parametri — 04§6.5.
 *
 * I sei valori ratificati vengono dalla tabella; `minBaselineDays` (14) è
 * metà della baseline e `minDominantShare` (30%) è la soglia di dominanza
 * dichiarata in D.70.1 e D.70.2.
 */
export const DEFAULT_EVENT_CONFIG: EventConfig = {
  baselineDays: 60,
  windowDays: 14,
  zScoreThreshold: 2,
  silenceMinDays: 3,
  explorationMinNewArtists: 10,
  strideDays: 7,
  minBaselineDays: 14,
  minDominantShare: 0.3,
};

/**
 * Applica gli override ai default mantenendo **l'ordine delle chiavi**:
 * `JSON.stringify(config)` deve essere deterministico, perché da lui dipende
 * la `derivedVersion` (04§1.1).
 */
export function resolveEventConfig(overrides: EventConfigOverrides = {}): EventConfig {
  return {
    baselineDays: overrides.baselineDays ?? DEFAULT_EVENT_CONFIG.baselineDays,
    windowDays: overrides.windowDays ?? DEFAULT_EVENT_CONFIG.windowDays,
    zScoreThreshold: overrides.zScoreThreshold ?? DEFAULT_EVENT_CONFIG.zScoreThreshold,
    silenceMinDays: overrides.silenceMinDays ?? DEFAULT_EVENT_CONFIG.silenceMinDays,
    explorationMinNewArtists:
      overrides.explorationMinNewArtists ?? DEFAULT_EVENT_CONFIG.explorationMinNewArtists,
    strideDays: overrides.strideDays ?? DEFAULT_EVENT_CONFIG.strideDays,
    minBaselineDays: overrides.minBaselineDays ?? DEFAULT_EVENT_CONFIG.minBaselineDays,
    minDominantShare: overrides.minDominantShare ?? DEFAULT_EVENT_CONFIG.minDominantShare,
  };
}

/**
 * Rapporto massimo fra la quota nella finestra e la quota in baseline — 04§6.2
 * («quota artista > 2× baseline»).
 *
 * È una **costante** dell'algoritmo, non un parametro: il valore 2 è
 * dichiarato nella tabella dei tipi di evento (`04§6.2`) e non nelle
 * impostazioni (`04§6.5`). Cambiarlo cambierebbe la natura del detector,
 * non una sua soglia: per questo vive qui e non in `EventConfig`.
 */
export const EVENT_QUOTA_RATIO = 2;
