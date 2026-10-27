# ADR-0011 — Il contratto di scrittura negli hub di scrobbling (`ScrobbleSink`)

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 56 (2026-10-27)
> Issue: #168 · Story: 1.5 (Scrobbling hub)
> Spec di riferimento: [`../20-SCROBBLING-HUB.md`](../20-SCROBBLING-HUB.md) v0.1 (🟡 DRAFT, Sessione 55, issue #164) §4
> Precedente: [`0010-remote-source-adapter.md`](0010-remote-source-adapter.md) — il percorso di **lettura** remota

## Contesto

### Il contratto che c'è descrive solo la lettura

`05-ARCHITECTURE.md` §4 definisce il contratto `PlatformAdapter`: ogni adapter espone `detect()`, `parse()`, `parseLibrary?()` e (dal 2026-10-26, ADR-0010) `parseRemote?()`. Tutte queste operazioni **leggono**: prendono un file, un blob o una sorgente remota e ne ricavano `RawListenEvent`.

La Story 1.5 (scrobbling hub) chiede l'operazione opposta: **mandare** i propri ascolti ai hub. La domanda che questo ADR risolve è dove vive quel contratto di scrittura.

Le due famiglie di oggetti non coincidono:

| | Piattaforma sorgente | Hub di scrobbling |
|---|---|---|
| Esempio | Spotify, YouTube Music, Apple Music, Last.fm, ListenBrainz | Last.fm, ListenBrainz (e, in Fase 2, Maloja) |
| Direzione | **lettura** (import) | **scrittura** (invio) |
| Identificatore | `PlatformId` | `ScrobbleHubId` |
| Membri dell'insieme | non ogni piattaforma scrobbla | non ogni piattaforma è un hub (`maloja`, `subsonic`, `roon` sono client, non fonti: `01-PLATFORMS.md` §3.9) |
| Credenziali | in lettura (`api_key`, User Token) | in scrittura (`api_key` + `shared secret` + `sk`, User Token) |

I due insiemi **si intersecano** (Last.fm e ListenBrainz sono entrambe le cose) ma non coincidono: un adapter che sa importare da Last.fm non sa necessariamente scrobblare, e un hub che sa ricevere scrobble non è necessariamente una fonte da cui importare.

### Il caso specifico: la coda ha bisogno di un contratto omogeneo

Il ciclo di invio della Story 1.5 è definito dalla spec §5 e §8:

```
claim() → batch → sink.submit(lotto) → markSent() / markFailed()
```

La coda (`packages/core/src/db/scrobbleOutbox.ts`) deve poter trattare i due hub **in modo omogeneo**: stessa macchina a stati (`pending → in_flight → sent | failed | dropped`), stesso backoff, stessa idempotenza (`hub|eventKey`), stessa regola di write-ahead. Senza un contratto, il core degenera in una sequenza di condizionali `if (hub === 'lastfm') … else if (hub === 'listenbrainz') …` e il batching diventa un `if` per hub: la classe di bug più costosa del progetto (la stessa che ADR-0010 ha evitato sul lato della lettura, dove due implementazioni divergenti della normalizzazione avrebbero prodotto `eventKey` diversi per lo stesso ascolto).

### Perché serve un ADR

`05-ARCHITECTURE.md` §4 è 🟢 APPROVED: modificarlo richiede un ADR, esattamente come per `parseRemote?()` (ADR-0010). L'issue #168 chiede la decisione su **dove** vive il contratto di scrittura; la spec `20-SCROBBLING-HUB.md` §4 ne ha già definito il **contenuto** (D-SH.7). Questo ADR formalizza la decisione, fissa i vincoli e dichiara le alternative scartate.

## Decisione

**Il contratto di scrittura vive in un'interfaccia dedicata `ScrobbleSink`, separata da `PlatformAdapter`.** È la libreria gemella del contratto di lettura: stessa forma, stesso ordine di segregazione delle responsabilità, ma un oggetto distinto.

```typescript
/**
 * Un sink di scrobbling: sa inviare ascolti a UN hub.
 * Il protocollo (endpoint, autenticazione, rate limit, formato del payload,
 * semantica degli errori) vive nel sink: il core non sa nulla del protocollo.
 */
export interface ScrobbleSink {
  /** Hub di destinazione. */
  readonly hub: ScrobbleHubId;
  /** Nome leggibile (UI, log). */
  readonly name: string;
  /** Versione del client del sink (semver). */
  readonly version: string;
  /** Il sink è pronto a inviare? (credenziali presenti, endpoint raggiungibile in configurazione) */
  isConfigured(): boolean;
  /**
   * Invia UN lotto di ascolti.
   * @throws ScrobbleError con `recoverable` = true per i fallimenti transitori.
   */
  submit(listens: ScrobblePayload[], options?: { signal?: AbortSignal }): Promise<ScrobbleResult>;
}
```

### I tipi di supporto

```typescript
/** Identificatore di un hub abilitato (non è un PlatformId: vedi V7). */
export type ScrobbleHubId = 'lastfm' | 'listenbrainz';

export interface ScrobblePayload {
  /** Chiave di idempotenza locale: `hub|eventKey`. */
  idempotencyKey: string;
  /** Inizio dell'ascolto, UNIX ms UTC (→ secondi alla serializzazione). */
  startedAt: number;
  /** Durata **catalogo** del brano in ms, se nota. */
  durationMs?: number;
  /** MBID del brano, se noto. */
  recordingMbid?: string;
  /** ISRC del brano, se noto. */
  isrc?: string;
  /** Nomi già normalizzati per la deduplicazione (non modificare qui). */
  artistName: string;
  trackName: string;
  albumName?: string;
}

export interface ScrobbleResult {
  /** Quanti elementi del lotto il hub ha accettato. */
  accepted: number;
  /** Quanti elementi del lotto il hub ha rifiutati (errore per elemento). */
  rejected: number;
}
```

**Il payload non è il `ListenEvent`**: è una copia minima, chiusa per costruzione (V8). Il `ListenEvent` locale resta la fonte; il payload è ciò che esce.

### Gli errori

```typescript
export type ScrobbleErrorCode =
  | 'HUB_UNCONFIGURED'      // credenziali assenti o hub non abilitato
  | 'AUTH_INVALID'           // token/sk non valido, scaduto, revocato, firma rifiutata
  | 'RATE_LIMITED'           // 429 o rate limit del protocollo
  | 'SOURCE_UNREACHABLE'     // rete, DNS, proxy assente/rotto, timeout
  | 'PAYLOAD_REJECTED'       // il hub ha rifiutato il contenuto (400, errore di forma)
  | 'HUB_ERROR';             // errore lato hub non classificabile

export class ScrobbleError extends Error {
  readonly code: ScrobbleErrorCode;
  readonly recoverable: boolean;   // true = si può ritentare
  readonly hub: ScrobbleHubId;
}
```

### Dove vive il codice

| Artefatto | Percorso | Contenuto |
|-----------|----------|-----------|
| Tipi del contratto | `packages/core/src/adapters/scrobble/types.ts` | `ScrobbleSink`, `ScrobblePayload`, `ScrobbleResult`, `ScrobbleError`, `ScrobbleErrorCode`, `ScrobbleHubId` |
| Registry dei sink | `packages/core/src/adapters/scrobble/index.ts` | `SCROBBLE_SINKS: Record<ScrobbleHubId, () => ScrobbleSink>` + `getSink(hub, config)` |
| Sink Last.fm | `packages/core/src/adapters/lastfm/scrobble.ts` | firma `api_sig` (md5), batch fino a 50, `track.scrobble` |
| Sink ListenBrainz | `packages/core/src/adapters/listenbrainz/scrobble.ts` | `POST /1/submit-listens`, `listen_type: import`, header `Authorization: Token …` + `User-Agent` |
| Coda | `packages/core/src/db/scrobbleOutbox.ts` | `enqueue()`, `claim()`, `markSent()`, `markFailed()`, `purge(hub)` |
| md5 | `packages/core/src/adapters/crypto.ts` | `md5Hex(input: string): string` (JS puro, D-SH.2) |

**Il sink non è un metodo di `PlatformAdapter`** e non è un quinto metodo del factory degli adapter: è un registry a parte (`adapters/scrobble/index.ts`), con la stessa forma di `parseRemote?()` — una libreria opzionale che esiste solo dove serve.

### I vincoli che l'ADR fissa

| # | Vincolo | Perché |
|---|---------|--------|
| **V1** | Il contratto di scrittura è **separato** da quello di lettura, ma ne riusa la **forma**: un'interfaccia dedicata con metodi opzionali, non un quinto metodo del factory | `PlatformAdapter` descrive la *lettura* di una piattaforma; non ogni piattaforma è un hub e un hub non è una piattaforma sorgente. `PlatformAdapter` **non cambia**: nessun adapter esistente è toccato, nessuna regressione possibile sul perimetro già consegnato |
| **V2** | Il **rate limiting è responsabilità del sink**, non del core | I due hub hanno limiti e semantica diversi: Last.fm ~5 req/s (token bucket, batch ≤ 50), ListenBrainz 1 req/s guidato dagli header `X-RateLimit-*`. Un limite globale sarebbe la media dei due. È V7 di ADR-0010, riportato sul lato della scrittura |
| **V3** | **Nessun segreto embedded nel bundle**: `api_key`, `shared secret`, `sk` e User Token sono **per-utente** e stanno in storage locale | I ToS Last.fm §4.4 vietano una key che serva N utenti; V4 di ADR-0010 vale per la scrittura come per la lettura |
| **V4** | **Nessun server di backend**: il proxy Last.fm è **di fiducia dell'utente** | ADR-0002 (local-first): il progetto non gestisce un proxy. Il proxy è dell'utente, con i suoi log |
| **V5** | **`AbortSignal`** per la cancellazione cooperativa | Un invio è un'operazione di rete che deve poter essere interrotta; coerente con `05§4` (`ParseOptions`) e con ADR-0010 V6 |
| **V6** | **`ScrobbleError` dedicato**, con `recoverable` = "**si può ritentare**" | `AdapterError` è orientato al **parsing** (`INVALID_FORMAT`, `TRUNCATED`): riusarlo per un invio darebbe all'utente una remediation sbagliata — la stessa lezione che ha prodotto `SOURCE_UNREACHABLE` in ADR-0010. La semantica di `recoverable` è **diversa**: in `AdapterError` significa "gli eventi validi sono persistiti", qui significa "lo stesso invio può essere ritentato senza intervento dell'utente" |
| **V7** | **`ScrobbleHubId`** come tipo dedicato: `scrobbleHubs` **non** è `PlatformId[]` | `maloja`, `subsonic` e `roon` sono client di scrobbling, non piattaforme sorgente (`01-PLATFORMS.md` §3.9): il tipo attuale non può rappresentarli. Il tipo dedicato è anche ciò che rende il toggle per-hub verificabile a compile time |
| **V8** | Il **payload è chiuso per costruzione**: il tipo `ScrobblePayload` non ha campi per contesto, device, IP o insight | G-SH.6 della spec: il contenuto inviato è chiuso dal *tipo*, non da una policy. Il toggle `retainIp` resta non applicabile al percorso di scrittura |
| **V9** | **Il core conosce solo il contratto**: endpoint, autenticazione, rate limit, formato del payload e semantica degli errori vivono nel sink | È V7 di ADR-0010 ("la conoscenza del protocollo resta nell'adapter") applicato al sink. Il core conosce `ScrobbleSink`, `ScrobblePayload` e basta |
| **V10** | **L'idempotenza è locale e verificabile**: chiave unica `hub\|eventKey` sulla coda, write-ahead (`in_flight` **prima** della richiesta) | Nessuna delle due API espone una chiave di deduplica lato server: l'unico modo di garantire "un ascolto, una volta" è una chiave unica locale. Il write-ahead dichiara il caso residuo (crash fra la richiesta e la conferma → doppio scrobble possibile, mai una perdita) invece di nasconderlo |

### Le garanzie ereditate dalla spec

L'ADR **non** reinventa le garanzie della spec: le recepisce e le rende vincolanti sul contratto.

| # | Garanzia (spec §4.4) | Come è ottenuta | Chi la fa rispettare |
|---|-----------------------|-----------------|---------------------|
| **G-SH.1** | Un ascolto locale è inviato a un hub al massimo una volta | Chiave unica `hub\|eventKey` sulla tabella `scrobbleOutbox`; l'inserimento che collide è ignorato, non è un errore | Core (coda) |
| **G-SH.2** | Un fallimento non perde l'ascolto | La riga resta in coda con `attempts` e `nextAttemptAt`; l'evento locale non viene mai cancellato | Core (coda) |
| **G-SH.3** | Nessuna scrittura senza consenso | La coda è alimentata solo per gli hub presenti in `scrobbleHubs`; togliere un hub dalla lista svuota la sua coda | Core (coda) + `isConfigured()` del sink |
| **G-SH.4** | Nessun segreto nel bundle | Credenziali per-utente in storage locale (`settings`), mai nel bundle, mai nei log, mai nelle fixture | Sink (V3) |
| **G-SH.5** | Il rate limit è rispettato | Il limiter è **per-hub** e sta nel sink | Sink (V2) |
| **G-SH.6** | Il payload non contiene nulla di non previsto | Il tipo `ScrobblePayload` non ha campi per contesto, device o IP | Tipo (V8) |

## Motivazioni

- **Il contratto segue la direzione, non l'oggetto.** `PlatformAdapter` dice "come si legge da questa piattaforma"; `ScrobbleSink` dice "come si scrive su questo hub". Un oggetto può essere entrambe le cose (Last.fm), ma le due operazioni hanno protocolli, credenziali, errori e garanzie diverse: accorparle in un unico contratto produce un'interfaccia con metodi che metà delle implementazioni non ha.
- **La simmetria con ADR-0010 è deliberata.** Il percorso di lettura ha risolto il problema "l'adapter non ha un file" con un metodo opzionale (`parseRemote?`) e una struttura dati (`RemoteSource`). Il percorso di scrittura risolve il problema "l'hub non è un adapter" con un'interfaccia dedicata: stessa idea di **opzionalità** (chi non scrobbla non implementa nulla), stessa idea di **segregazione del protocollo** (il core non sa cosa sia una `api_sig`), stessa idea che il contratto stia in `packages/core/src/adapters/` accanto agli adapter che lo implementano.
- **Il batching è una decisione del protocollo, non del core.** Last.fm accetta 50 scrobble per richiesta, ListenBrainz ha `MAX_LISTENS_PER_REQUEST`: i due limiti sono incompatibili. Se il core decidesse la dimensione del lotto, dovrebbe conoscere i limiti dei due protocolli — che è esattamente ciò che V2 vieta. Il core raggruppa le righe in coda; il sink decide come trasformarle in richieste.
- **L'errore è la parte che il payback rende insostenibile.** Un errore di rete, un token scaduto e un payload malformato hanno rimedi diverse: ritentare, riautenticare, correggere il codice. Un unico tipo di errore con una sola bandiera booleana costringerebbe a tirare a indovino, e l'utente riceverebbe una remediation sbagliata. `ScrobbleError` separa i tre casi con i codici giusti (`AUTH_INVALID` non recuperabile, `RATE_LIMITED` recuperabile con backoff, `PAYLOAD_REJECTED` non recuperabile).
- **La privacy è verificata per costruzione, non per policy.** V8 chiude il payload dal tipo: nessun campo per l'IP, nessun campo per il contesto, nessun campo per l'insight. Una regola "non inviare l'IP" è una promessa che un refactor può dimenticare; un campo che non esiste non può essere inviato per errore.

## Alternative considerate

| # | Alternativa | Esito | Motivo |
|---|-------------|-------|--------|
| **A1** | **Interfaccia `ScrobbleSink` dedicata** (proposta della spec, D-SH.7) | ✅ **adottata** | `PlatformAdapter` descrive la **lettura** di una piattaforma; non ogni piattaforma è un hub e un hub non è una piattaforma sorgente. Un secondo contratto accanto al primo, con la stessa forma di `parseRemote?()`: metodo/libreria separata, non un quinto metodo del factory. La coda della Story 1.5 tratta i due hub in modo omogeneo senza conoscere i protocolli |
| **A2** | Metodo `scrobble?()` su `PlatformAdapter` | ❌ scartata | Obbligherebbe ogni adapter a implementare (o a dichiarare di non implementare) la scrittura, e confonderebbe "questa piattaforma si può scrobblare" con "questa piattaforma si può importare". I cinque adapter consegnati (`spotify`, `youtube-music`, `apple-music`, `listenbrainz`, `lastfm`) resterebbero intatti solo per convenzione, non per tipo: un `scrobble?` opzionale che non esiste non è verificabile dal compilatore, e un adapter che implementa per sbaglio il metodo sbagliato non produce nessun errore |
| **A3** | Nessuna astrazione: un client per hub con interfacce implicite | ❌ scartata | Il ciclo della coda (`packages/core/src/db/scrobbleOutbox.ts`) deve poter trattare i due hub in modo omogeneo (claim → batch → markSent/markFailed). Senza un contratto il core duplica gli `if (hub === 'lastfm')` e la logica di batching diventa un condizionale per hub: è la divergenza fra due implementazioni, la classe di bug più costosa del progetto (cfr. la motivazione V2 di ADR-0010) |
| **A4** | Estendere `RemoteSource` con un flag "write" | ❌ scartata | `RemoteSource` è un contratto di **lettura** ratificato da ADR-0010 (V2: produce gli stessi `RawListenEvent`). Mischiarlo con la scrittura romperebbe la simmetria e le garanzie V1-V8: il tipo che descrive "da dove leggo" non può descrivere anche "a cosa scrivo" senza diventare un campo di bit da interrogare a runtime |
| **A5** | Un unico contratto bidirezionale (`PlatformAdapter` con `read`/`write` opzionali) | ❌ scartata | È la risposta "completa" in teoria, ma in pratica un'interfaccia che espone due direzioni opposte con credenziali, errori e semantiche diverse è un'interfaccia che ogni implementazione deve capire a metà. ADR-0010 ha già scelto la via della **decomposizione**: un contratto per direzione, con forme coerenti. Si estende quando emerge un caso reale (es. un hub che sia anche sorgente), non prima |

## Conseguenze

- **Positive**:
  - La Story 1.5 diventa implementabile: il ciclo di coda ha un contratto su cui scrivere, e i due sink (Last.fm, ListenBrainz) sono intercambiabili dal punto di vista del core
  - `PlatformAdapter` **non cambia**: nessun adapter esistente è toccato, nessuna regressione possibile sulle story già consegnate (1.1, 1.2, 1.3, 1.4)
  - La privacy è chiusa per costruzione (V8): il payload non ha campi per ciò che non deve uscire
  - Gli errori hanno una remediation per caso: l'utente sa se ritentare, riautenticare o segnalare un bug
  - Il secondo contratto è **più piccolo** del primo: cinque membri, un metodo di scrittura, un metodo di stato
- **Negative**:
  - `05§4` cresce di una sottosezione, di quattro tipi e di una classe di errore: chi legge il contratto degli adapter deve ora sapere che esiste un contratto **di scrittura**, separato
  - Nasce un **secondo registry** (`adapters/scrobble/index.ts`) accanto a quello degli adapter: due punti da mantenere allineati quando si aggiunge una piattaforma
  - Il core deve conoscere `ScrobbleHubId`, `ScrobblePayload` e `ScrobbleResult`: tre tipi in più nella sua superficie, e la regola di aciclicità (`05§9.2`) va verificata per il nuovo package `scrobble`
  - `ScrobbleError` è una seconda classe di errore accanto a `AdapterError`: la gestione degli errori dell'app ne ha due rami, non uno
- **Mitigazioni**:
  - La coda è l'unico punto che tocca entrambi i mondi: se un bug di implementazione lascia i due mondi divergere, il danno è confineso alla coda e agli errori, non al modello dati né alla pipeline di import
  - `isConfigured()` rende la configurazione **leggibile prima del primo invio** (U-SH.2 della spec): il fallimento di configurazione è un avviso, non un errore a runtime
  - Il payload minimo rende il diff fra le due implementazioni del protocollo **leggibile**: ogni sink serializza lo stesso tipo, e ogni differenza è nel client, non nel contratto

## Documenti da aggiornare

La ratifica di questo contratto dentro `05-ARCHITECTURE.md` §4 è l'atto che questo ADR rende possibile. Gli aggiornamenti si dividono in due gruppi.

**In questa PR (la ratifica del contratto)**:

| Documento | Modifica | Chi la scrive |
|----------|----------|----------------|
| `05-ARCHITECTURE.md` | §4: nuova sottosezione **"Contratto di scrittura (`ScrobbleSink`)"** (il tipo, i vincoli, la mappa degli errori) + header ("ADR collegati") + changelog | Questa PR |
| `13-ADR/0011-scrobble-sink.md` | questo documento | Questa PR |
| `11-BACKLOG.md` | Story 1.5: la dipendenza `ADR-0011` passa da "aperta" a "soddisfatta" (come per ADR-0010 nella Story 1.3) | Questa PR |
| `INDEX.md` | riga `13-ADR/`, conteggi legacy dei documenti APPROVED/DRAFT, "Prossimo passo tecnico" | Questa PR |

**Alla ratifica della spec (`20-SCROBBLING-HUB.md` v0.1 → v1.0 🟢)**: i documenti 🟢 APPROVED che la spec tocca non si modificano sulla base di una spec 🟡 DRAFT. Vanno aggiornati quando la spec è ratificata, perché è la spec ratificata a renderli vincolanti.

| Documento | Modifica | Riferimento spec |
|----------|----------|------------------|
| `02-DATA-SCHEMA.md` | §3.8: `scrobbleHubs: ScrobbleHubId[]` (tipo dedicato, P-SH.2) | `20§10.1` |
| `02-DATA-SCHEMA.md` | §6: tabella `scrobbleOutbox`, schema Dexie **v5** | `20§8.1` |
| `09-PRIVACY-SECURITY.md` | §3.3: la riga "scrobble" integrata con il payload esatto | `20§10.2` |
| `09-PRIVACY-SECURITY.md` | §4: inventario (User Token in scrittura, `sk`, payload di scrobbling) | `20§10.4` |
| `08-COPY-I18N.md` | §1: namespace `scrobble` · §2: i 15 codici i18n | `20§13.2` |
| `03-ADAPTERS/lastfm.md` | §10: contratto del proxy esteso al POST (E.SH.7) | `20§6.1` |
| `03-ADAPTERS/listenbrainz.md` | D-LB.5: il token passa da "solo lettura" a "lettura + scrittura" | `20§6.2` |

## Punti aperti

1. ~~**Il contratto di scrittura dentro `05§4`**~~ — **risolto da questo ADR**: la decisione è A1 (interfaccia `ScrobbleSink` separata), con i vincoli V1-V10 e le alternative A2-A5 scartate. **Ratificato dal Boss al merge della PR #170 (`8900c3b`): l'ADR passa a 🟢 APPROVED v1.0, nessuna modifica di contenuto.**
2. **I punti aperti della spec restano aperti** e non sono risolti da questo ADR: la firma md5 (JS puro o dipendenza), la finestra di candidatura predefinita, la durata di catalogo sconosciuta, il contratto del proxy Last.fm per la scrittura (`20§18` punti 2-5). Sono decisioni della **spec**, non del contratto: l'ADR dice *dove* vive `ScrobbleSink`, non *cosa* ci mette dentro il protocollo.
3. **Il percorso live (now playing) resta fuori perimetro.** `05§4.2` fissa il contratto di invio di scrobble storici; il "now playing" (`track.updateNowPlaying`, `playing_now`) è un'operazione diversa, con semantica diversa (non è un ascolto finito: non ha una regola di maturità). Se un giorno entra, avrà bisogno di un contratto proprio — o di un tipo di payload distinto — e l'ADR va esteso, non stirato.
4. **Il percorso incrementale di ListenBrainz non è un sink.** La sync continua (`20§9`) va dall'hub al DB locale: è il percorso di **lettura**, e usa il contratto di ADR-0010 (`parseRemote?()`), non questo. L'ADR non crea un terzo contratto: due direzioni, due contratti, nessuna sovrapposizione.

## Collegamenti

- `ADR-0002` local-first (nessun backend, nessuna egress dei dati non autorizzati) · `ADR-0003` adapter pattern
- `ADR-0010` — il precedente remoto: il **percorso di lettura** (`parseRemote?()` + `RemoteSource`), cui questo ADR fa simmetria (V1, V9)
- `05-ARCHITECTURE.md` §4 (contratto, da estendere con la sottosezione "Contratto di scrittura"), §4.1 (sorgenti remote), §9.2 (aciclicità dei package)
- `20-SCROBBLING-HUB.md` §4 (contratto), §5 (flusso), §8 (coda), §11 (errori), §13 (i18n), §14 (test), §18 punto 1 (questo ADR)
- `02-DATA-SCHEMA.md` §3.8 (`PrivacySettings.scrobbleHubs`), §6 (schema Dexie)
- `09-PRIVACY-SECURITY.md` §3.2, §3.3, §4 (cosa esce, inventario)
- `01-PLATFORMS.md` §3.7-3.8 (i due hub), §3.9 (i client di scrobbling non sono piattaforme sorgente)
- `03-ADAPTERS/lastfm.md` (firma `api_sig`, proxy, rate limit) · `03-ADAPTERS/listenbrainz.md` (User Token, `X-RateLimit-*`)
- `11-BACKLOG.md` §Story 1.5 (T1.5.6, dipendenza ADR-0011)
- Issue #168 (questo ADR), issue #164 (spec della Story 1.5)

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 56 (2026-10-27, issue #168) | Prima stesura. Decide **A1**: il contratto di scrittura vive in un'interfaccia `ScrobbleSink` separata da `PlatformAdapter`, con la stessa forma di `parseRemote?()` (ADR-0010). Fissa i vincoli **V1-V10** (separazione dal contratto di lettura con riuso della forma, rate limiting per-hub nel sink, nessun segreto nel bundle, nessun backend, `AbortSignal`, `ScrobbleError` dedicato con `recoverable` = "si può ritentare", `ScrobbleHubId` dedicato, payload chiuso per costruzione, protocollo ignoto al core, idempotenza locale write-ahead) e recepisce le garanzie G-SH.1…G-SH.6 della spec. Scarta A2 (metodo `scrobble?()` su `PlatformAdapter`), A3 (nessuna astrazione), A4 (flag "write" su `RemoteSource`) e A5 (contratto bidirezionale unico). Dichiara l'elenco dei documenti da aggiornare: `05§4` in questa PR, `02§3.8`+`§6`, `09§3.3`+`§4` e `08-COPY-I18N.md` alla ratifica della spec. Quattro punti aperti: i punti 2-5 della spec (`20§18`) restano alla spec; il percorso live (now playing) resta fuori perimetro; il percorso incrementale ListenBrainz resta sul contratto di lettura |
| 1.0 | Sessione 56 (2026-10-27, issue #168) | 🟢 APPROVED · **Ratifica del Boss al merge della PR #170** (`8900c3b`) — **nessuna modifica di contenuto**. L'ADR passa da 🟡 DRAFT v0.1 a 🟢 APPROVED v1.0: la decisione A1 (`ScrobbleSink` separato da `PlatformAdapter`) e i vincoli V1-V10 diventano vincolanti, e `05§4.2` è la loro sede. È il punto aperto 1 della spec `20-SCROBBLING-HUB.md` (§18), che si chiude. Restano aperti i punti 2-5 della spec, che sono decisioni di **protocollo** e non del contratto |
