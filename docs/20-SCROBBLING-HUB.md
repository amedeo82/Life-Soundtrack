# 20 — Scrobbling hub (invio scrobble, sync continua, toggle)

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 55 (2026-10-27)
> Issue: #164 · Story: 1.5 (`11-BACKLOG.md`)
> Spec collegata a: `01-PLATFORMS.md` §3.7-3.8 · `02-DATA-SCHEMA.md` §3.8 · `03-ADAPTERS/lastfm.md` · `03-ADAPTERS/listenbrainz.md` · `13-ADR/0010-remote-source-adapter.md`
> Da ratificare in: `05-ARCHITECTURE.md` §4 (via **ADR-0011**, vedi §18) · `02-DATA-SCHEMA.md` §3.8 e §6 · `09-PRIVACY-SECURITY.md` §3.3 e §4 · `08-COPY-I18N.md` §2
> Decisione architetturale collegata: [`13-ADR/0010-remote-source-adapter.md`](13-ADR/0010-remote-source-adapter.md) (percorso **di lettura** remota — questa spec copre il percorso **di scrittura**)

---

## 1. Il problema e il perimetro

La Story 1.3 ha costruito il **canale di lettura** dai hub: gli adapter `lastfm` e `listenbrainz` esistono, sono testati, e sanno importare uno storico (`03-ADAPTERS/lastfm.md` §2, `03-ADAPTERS/listenbrainz.md` §2). La Story 1.5 è il **canale di scrittura**: mandare i propri ascolti ai hub, tenere il profilo dell'utente aggiornato, e farlo senza violare le promesse di privacy già scritte.

La Story 1.5 era nata come "sorgente continua di ascolti" ed è stata ridimensionata in Sessione 47 a tre cose: **invio** degli scrobble (T1.5.6), **sync continua** incrementale (T1.5.2, per ListenBrainz) e **toggle** `PrivacySettings.scrobbleHubs` (T1.5.4) con il rispetto del **rate limit** (T1.5.5). Maloja (T1.5.3) resta scope Fase 2.

**Che cosa non è in perimetro**

| Fuori scope | Motivo |
|-------------|--------|
| "Now playing" (`track.updateNowPlaying`, `playing_now`) | Richiede un player live: vedi §3 |
| Maloja / Subsonic / Roon (T1.5.3) | Fase 2: self-hosted, protocollo diverso, nessun vantaggio per la prima tranche |
| Refresh automatico dei token | ADR-0010 §"Punti aperti" 3: il rinnovo resta manuale |
| Rinvio / correzione di uno scrobble già inviato | Nessuna delle due API lo supporta in modo affidabile |
| Push in tempo reale (server push) | Nessuna delle due piattaforme offre un canale push all'utente |
| Arricchimento dei metadati inviati (ISRC/MBID dal MusicBrainz) | È la Story 4.2; qui si invia quello che l'app **ha già** |

## 2. Le decisioni dell'issue #164

L'issue chiede cinque decisioni prima di scrivere la spec. Le risposte sono qui sotto, in forma di **proposta** da ratificare: la ratifica è il merge di questo documento a v1.0 🟢 (PR di approvazione separata, come per `03-ADAPTERS/lastfm.md` e `13-ADR/0010`).

| # | Decisione | Proposta | Motivazione sintetica |
|---|-----------|----------|-----------------------|
| **D-SH.1** | Quali hub nella prima tranche? | **Last.fm + ListenBrainz**. Maloja in Fase 2 | Sono i due hub Tier S del perimetro (`01-PLATFORMS.md` §3.7-3.8); Maloja è self-hosted e ha un protocollo proprio (T1.5.3) |
| **D-SH.2** | Percorso Last.fm con `sk` (E.LF.21) | **md5 in JS puro** nel repo (`crypto.ts`), nessuna dipendenza nuova; il proxy CORS dell'utente (D-LF.0) è il trasporto della scrittura | `Web Crypto` non supporta md5; una dipendenza per 4 KB di bundle è un costo sproporzionato; il repo ha già la policy "nessuna dipendenza nuova" (`03-ADAPTERS/lastfm.md` §10) |
| **D-SH.3** | Semantica dell'invio | **Un scrobble per ascolto locale eleggibile**; `timestamp` = `startedAt` in secondi UNIX UTC (granularità **al secondo**, non al minuto); regola di maturità Last.fm (> 30 s **e** metà della durata **o** 4 minuti, il prima dei due); "now playing" **differito** | `timestamp` = inizio dello scrobble in entrambe le API; la normalizzazione al minuto è un artefatto di **dedup** del percorso di lettura (D-LF.7), non una semantica dell'evento |
| **D-SH.4** | Consenso e granularità | `scrobbleHubs` è un elenco **per-hub esplicito** (default `[]`); nessun toggle globale; revoca = stop immediato + svuotamento della coda del hub; **indipendente** da `retainIp`, `enrichMetadata`, `carDetectionConsent` | `09-PRIVACY-SECURITY.md` §3.3 scrive già "brano + timestamp" come l'unico contenuto inviato; ogni hub ha credenziali proprie, quindi un consenso per-hub è il minimo comune |
| **D-SH.5** | Coda e idempotenza | Tabella Dexie dedicata **`scrobbleOutbox`** (schema v5) con chiave unica `hub\|eventKey`; write-ahead (`in_flight` **prima** della richiesta); retry con backoff esponenziale; errori terminali senza retry | La tabella `settings` è per impostazioni, non per code (`11-BACKLOG.md` T1.5.6); l'idempotenza deve essere **locale e verificabile**, perché nessuna delle due API ha una chiave di deduplica lato server |
| **D-SH.6** | Dove vive la spec | Documento nuovo **`docs/20-SCROBBLING-HUB.md`** (non una `03-ADAPTERS/*.md`) | L'oggetto è il **protocollo di scrittura verso più piattaforme**, non la lettura di una singola piattaforma; le due famiglie di spec restano separate |
| **D-SH.7** | Contratto di scrittura | Interfaccia **`ScrobbleSink`** in `packages/core/src/adapters/scrobble/types.ts`, **non** un metodo su `PlatformAdapter` | `PlatformAdapter` descrive la lettura di una piattaforma; non ogni piattaforma è un hub e un hub non è una piattaforma sorgente. La ratifica in `05§4` richiede **ADR-0011** (§18, issue **#168**) |
| **D-SH.8** | Rate limit | **Per-hub, nel client di scrobbling**: Last.fm ~5 req/s (token bucket, batch fino a 50 scrobble); ListenBrainz 1 req/s **guidato dagli header** `X-RateLimit-*`. Nessun rate limit condiviso fra hub, ma **un solo job seriale** sulla coda | ADR-0010 V7: il rate limiting è responsabilità dell'adapter; i due hub hanno limiti e semantica diversi, un limite globale sarebbe la media dei due |
| **D-SH.9** | Mappa errori | **`ScrobbleError` dedicato** (`HUB_UNCONFIGURED`, `AUTH_INVALID`, `RATE_LIMITED`, `SOURCE_UNREACHABLE`, `PAYLOAD_REJECTED`, `HUB_ERROR`) con `recoverable` = "si può ritentare" | `AdapterError` è orientato al **parsing** (`INVALID_FORMAT`, `TRUNCATED`, `UNSUPPORTED_VERSION`): riusarlo per un invio darebbe all'utente una remediation sbagliata — la stessa lezione di ADR-0010 §"Punti aperti" 1 |
| **D-SH.10** | Origine degli eventi da scrobblare | Gli eventi inviati sono gli **ascolti locali** della tabella `listens`, filtrati per una **finestra di candidatura** | Una PWA non osserva la riproduzione di altre app: vedi §3, che è la premessa onesta della story |

## 3. La premessa che la story non dichiarava: l'app non è un player

`11-BACKLOG.md` chiama la 1.5 "Sorgente continua di ascolti tramite hub di scrobbling" e `01-PLATFORMS.md` §3.9 la colloca nell'area dei client di scrobbling (Navidrome, Plex, Roon: "integrazione via scrobbling"). Entrambe le descrizioni presuppongono un **processo che osserva la riproduzione in tempo reale**.

**La PWA non ha questa capacità.** Le web API non espongono la sessione di media di altre app: `navigator.mediaSession` governa il media *di una pagina*, non quello di Spotify o di un lettore nativo; non esiste un bridge standard "ascolto in corso" fra il sistema operativo e una web app. Le app native possono farlo (MediaSession, listener di sessione Android, `MPNowPlayingInfoCenter`), una web app no.

Quindi "invio scrobble" in un PWA significa, nella prima tranche:

> **Rispecchiare sul proprio profilo hub uno storico locale già acquisito**, non registrare l'ascolto in tempo reale.

Ne segue la conseguenza operativa che questa spec dichiara esplicitamente:

1. la sorgente degli eventi è la tabella **`listens`** locale, non un callback di riproduzione;
2. gli eventi inviati sono **storici** (non "in corso"), quindi il tipo di invio corretto su ListenBrainz è `import`, non `single`;
3. la "sync continua" è una **finestra incrementale** che si ri-apre periodicamente, non uno stream;
4. il percorso "live" (now playing + `single`) è **differito** a quando esisterà un bridge di sessione media (o un player nell'app): è fuori perimetro e resta un punto aperto (§18).

Il perimetro di questa prima tranche è dunque: **uno specchio fedele e idempotente dello storico locale verso i hub che l'utente abilita**, con le garanzie di consenso, rate limit e coda che §4-§10 definiscono.

## 4. Il contratto di scrittura (`ScrobbleSink`)

### 4.1 Il tipo

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

### 4.2 Il payload e il risultato

```typescript
/** Identificatore di un hub abilitato (non è un PlatformId: vedi D-SH.4). */
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

**Il payload è una copia minima, non il `ListenEvent`**: nessun contesto, nessun device, nessun IP, nessun insight. Il `ListenEvent` locale resta la fonte; il payload è ciò che esce (cfr. §10).

### 4.3 Dove vive il codice

| Artefatto | Percorso | Contenuto |
|-----------|----------|-----------|
| Tipi del contratto | `packages/core/src/adapters/scrobble/types.ts` | `ScrobbleSink`, `ScrobblePayload`, `ScrobbleResult`, `ScrobbleError`, `ScrobbleErrorCode` |
| Registry dei sink | `packages/core/src/adapters/scrobble/index.ts` | `SCROBBLE_SINKS: Record<ScrobbleHubId, () => ScrobbleSink>` + `getSink(hub, config)` |
| Sink Last.fm | `packages/core/src/adapters/lastfm/scrobble.ts` | firma `api_sig` (md5), batch fino a 50, `track.scrobble` |
| Sink ListenBrainz | `packages/core/src/adapters/listenbrainz/scrobble.ts` | `POST /1/submit-listens`, `listen_type: import`, header `Authorization: Token …` + `User-Agent` |
| Coda | `packages/core/src/db/scrobbleOutbox.ts` | `enqueue()`, `claim()`, `markSent()`, `markFailed()`, `purge(hub)` |
| md5 | `packages/core/src/adapters/crypto.ts` | `md5Hex(input: string): string` (JS puro, D-SH.2) |

**Il sink non è un metodo di `PlatformAdapter`** (D-SH.7): il contratto degli adapter descrive la lettura; un hub non è una piattaforma sorgente. La ratifica di questo contratto dentro `05§4` è il compito di **ADR-0011** (§18).

### 4.4 Le garanzie che il contratto promette

| # | Garanzia | Come è ottenuta |
|---|----------|-----------------|
| **G-SH.1** | **Un ascolto locale è inviato a un hub al massimo una volta** | Chiave unica `hub\|eventKey` sulla tabella `scrobbleOutbox`; l'inserimento che collide è ignorato, non è un errore |
| **G-SH.2** | **Un fallimento non perde l'ascolto** | La riga resta in coda con `attempts` e `nextAttemptAt`; l'evento locale non viene mai cancellato |
| **G-SH.3** | **Nessuna scrittura senza consenso** | La coda è alimentata solo per gli hub presenti in `scrobbleHubs`; togliere un hub dalla lista svuota la sua coda (§10) |
| **G-SH.4** | **Nessun segreto nel bundle** | Credenziali per-utente in storage locale (`settings`), mai nel bundle, mai nei log, mai nelle fixture (V4 di ADR-0010) |
| **G-SH.5** | **Il rate limit è rispettato** | Il limiter è **per-hub** e sta nel sink (D-SH.8): il core non conosce i limiti |
| **G-SH.6** | **Il payload non contiene nulla di non previsto** | Il tipo `ScrobblePayload` non ha campi per contesto, device o IP: il contenuto inviato è **chiuso per costruzione**, non per policy |

## 5. Il flusso di invio

```
[1] Trigger: apertura dell'app, sync del DB, o azione esplicita dell'utente
[2] Lettura di PrivacySettings.scrobbleHubs  →  elenco dei sink attivi
[3] Per ogni sink attivo:
    [3a] verifica isConfigured()  →  se no, warning e skip (zero richieste)
    [3b] query dei candidati: ascolti locali nella finestra, non già in coda per questo hub
    [3c] enqueue()  →  una riga outbox per (hub, eventKey), in scrittura singola
[4] Loop sulla coda (seriale, un hub alla volta):
    [4a] claim()  →  la riga passa a `in_flight` (write-ahead) e viene riservata
    [4b] raggruppa le righe `in_flight` dello stesso hub in un lotto (batch)
    [4c] sink.submit(lotto)
    [4d] esito: markSent() / markFailed(recoverable?) / markFailed(terminale)
[5] Il ciclo si ripete: al prossimo trigger, oppure al cambio di stato `nextAttemptAt`
```

**Il passo [3b] è il filtro di eleggibilità.** Un ascolto locale è candidato per l'hub H se:

| # | Condizione | Motivazione |
|---|------------|-------------|
| 1 | `H ∈ PrivacySettings.scrobbleHubs` | Consenso esplicito (D-SH.4) |
| 2 | `platform` dell'ascolto **non** è un hub | Evita il loop: uno scrobble Letto da Last.fm non viene rimandato a Last.fm |
| 3 | `timestamp` nella **finestra di candidatura** | Perimetro dichiarato (§8) |
| 4 | `skipped !== true` | Uno skip esplicito non è un ascolto |
| 5 | **maturato** secondo la regola del §7 | Regola Last.fm (≥ 30 s e metà durata o 4 minuti) |
| 6 | `eventKey` assente dalla coda per H | Idempotenza locale (G-SH.1) |

**Il passo [4a] è write-ahead**: la riga diventa `in_flight` **prima** della richiesta di rete. Se il processo muore dopo la richiesta e prima della conferma, la riga resta `in_flight`: al riavvio il sistema **non** la ritenta da solo, perché non può sapere se il hub l'ha registrata (E.SH.6). La riga viene mostrata all'utente come "invio non confermato" con un'azione esplicita.

## 6. I vincoli di piattaforma

### 6.1 Last.fm — `track.scrobble`

| Aspetto | Vincolo | Fonte |
|---------|---------|-------|
| Endpoint | `POST https://ws.audioscrobbler.com/2.0/` con `method=track.scrobble` | doc Last.fm API |
| Autenticazione | **`sk` obbligatoria** + `api_key` + `api_sig` — è un *write service*, tutti i write service richiedono sessione | doc Last.fm API (scrobbling) |
| Firma | `api_sig = md5(parametri ordinati alfabeticamente + shared secret)` | doc Last.fm API (authentication) |
| Batch | Fino a **50 scrobble** per richiesta, notazione ad array (`artist[0]`, `track[0]`, `timestamp[0]`) | doc Last.fm API |
| `timestamp` | Intero UNIX **UTC**, l'istante in cui il brano **ha iniziato** di suonare | doc Last.fm API |
| Regola di scrobble | Il brano deve durare **più di 30 s** **e** essere stato ascoltato per **almeno metà** della durata **o per 4 minuti**, il prima dei due. La richiesta può essere inviata **in qualsiasi momento** dopo | doc Last.fm API (scrobbling) |
| CORS | L'API **non** emette `Access-Control-Allow-Origin`: la POST da una PWA è bloccata dal browser | `03-ADAPTERS/lastfm.md` §1 (verificato in Sessione 50) |
| Rate limit | Non pubblicato; ~5 req/s misurati dai client (token bucket) | `03-ADAPTERS/lastfm.md` §10 |
| Errori (scrittura) | 9 `sk` non valida · 10 `api_key` non valida · 13 firma non valida · 26 key sospesa · 29 rate limit · 11/16 temporanei · gli altri = richiesta malformata, **non ritentare** | doc Last.fm API (scrobbling) |

**Il trasporto della scrittura è il proxy dell'utente (D-LF.0)**, ma con un contratto **esteso**: il proxy deve inoltrare una **POST con body** e rispondere con CORS. Il contratto attuale (D-LF.0, `03-ADAPTERS/lastfm.md` §10) descrive un proxy che risponde JSON a una GET. Un proxy che inoltra solo GET **non** può trasportare la scrittura: in quel caso Last.fm resta disponibile in sola lettura e l'utente riceve un avviso esplicito (E.SH.7).

**La firma in un batch** è il punto più delicato del protocollo (E.SH.8): i parametri hanno nome indicizzato (`artist[0]`, `artist[1]`, …) e il server li ordina **per nome, alfabeticamente, come stringhe**. L'ordinamento lessicografico di `artist[10]` rispetto a `artist[2]` **non** coincide con l'ordinamento numerico: l'implementazione deve ordinare le **stringhe** dei nomi, non gli indici.

### 6.2 ListenBrainz — `POST /1/submit-listens`

| Aspetto | Vincolo | Fonte |
|---------|---------|-------|
| Endpoint | `POST https://api.listenbrainz.org/1/submit-listens` | doc ListenBrainz (JSON) |
| Autenticazione | Header `Authorization: Token <user token>` | doc ListenBrainz (API) |
| `User-Agent` | **Obbligatorio**, formato `NomeApp/<versione> ( url-contatto )`: senza, le richieste possono essere bloccate **senza preavviso** | doc ListenBrainz (API) |
| Tipi di invio | `single` (un ascolto appena finito) · `playing_now` (appena iniziato: va **rispedito** come `single`/`import` per essere salvato) · `import` (ascolti già salvati, uno o più) | doc ListenBrainz (JSON) |
| Body | `{ "listen_type": …, "payload": [ { "listened_at": <unix s>, "track_metadata": { "artist_name", "track_name", "release_name"? }, "additional_info": { … }? } ] }` | doc ListenBrainz (JSON) |
| Limiti di payload | `MAX_LISTEN_PAYLOAD_SIZE` per richiesta e `MAX_LISTENS_PER_REQUEST` elementi per richiesta | doc ListenBrainz (JSON) |
| `listened_at` | Intero UNIX UTC, l'istante in cui il brano **ha iniziato** di suonare | doc ListenBrainz (JSON) |
| Rate limit | **1 richiesta al secondo**, con header `X-RateLimit-Limit` / `-Remaining` / `-Reset-In` / `-Reset`; `429` se superato; un token valido può ottenere limiti più alti | doc ListenBrainz (API) |
| CORS | Abilitato (`@crossdomain` su tutti gli endpoint del blueprint) | `03-ADAPTERS/listenbrainz.md` §1 |
| Errori | 400 payload non valido · 401 token non valido · 404 utente inesistente · 429 rate limit · 5xx lato server | doc ListenBrainz (API) |

**D-SH.8 — perché `import` e non `single`**: il limite di ListenBrainz è **per richiesta**, non per ascolto. La convenzione diffusa fra i client ("uno scrobble ogni 5 s") vale per i client che inviano un ascolto per richiesta; con il batch diventa irrilevante. Inoltre la semantica dei nostri dati è storica (§3): `import` è il tipo dichiarato dalla piattaforma per "ascolti già salvati", mentre `single` significa "l'utente ha appena finito di ascoltare" — che non è la nostra situazione.

### 6.3 Confronto

| | Last.fm | ListenBrainz |
|---|---|---|
| Direzione | scrittura (e lettura in 1.3) | scrittura (e lettura in 1.3) |
| CORS | ❌ serve proxy dell'utente | ✅ nativo |
| Credenziale | `api_key` + `shared secret` + `sk` | User Token |
| Firme | md5 (`api_sig`) | nessuna |
| Batch | ≤ 50 scrobble | `MAX_LISTENS_PER_REQUEST` |
| Rate limit | ~5 req/s (stimato) | 1 req/s (header) |
| Deduplica lato server | ❌ | ❌ (niente chiave di idempotenza) |
| `now playing` | `track.updateNowPlaying` (differito) | `playing_now` (differito) |

## 7. Semantica temporale e regola di maturità

| # | Regola | Dettaglio |
|---|--------|----------|
| **T-SH.1** | `timestamp` inviato = `startedAt` dell'ascolto locale, in **secondi** UNIX UTC | Non il `timestamp` normalizzato (`= startedAt + durationMs`, che per le fonti senza durata coincide con l'inizio): l'evento inviato è l'**inizio** dell'ascolto, come le due API definiscono |
| **T-SH.2** | Granularità **al secondo** | La normalizzazione al minuto (D-LF.7) è un artefatto della chiave di dedup del percorso di lettura: non si applica all'invio, altrimenti due scrobble distinti dello stesso brano in due minuti diversi diverebbero indistinguibili |
| **T-SH.3** | Regola di maturità | Un ascolto è maturo quando sono soddisfatte entrambe le condizioni: durata **> 30 s** e tempo ascoltato **≥ min(metà della durata, 4 minuti)**. Con durata ignota si usa il solo criterio dei 4 minuti, e l'evento resta **non maturo** se non si può stabilire che il brano è durato più di 30 s |
| **T-SH.4** | "Tempo ascoltato" | Nel modello locale è `durationMs` dell'evento quando noto; quando è `0` (fonti senza durata) si usa `Track.durationMs` (durata **catalogo**) come miglior stima disponibile, dichiarando il bias (§9) |
| **T-SH.5** | Semantica del tempo di invio | L'invio può avvenire **in qualsiasi momento** dopo la maturità: la coda conserva il `startedAt` originale, non l'ora di invio |

**Il bias dichiarato**: per gli ascolti importati da fonti senza durata (Last.fm, ListenBrainz) la maturità è stimata sulla durata di catalogo del brano. Un ascolto reale di 30 secondi di un brano di 4 minuti passerebbe la soglia "metà durata" solo se la durata di catalogo fosse nota: in quel caso l'app invierebbe uno scrobble che l'utente considera uno skip. È il prezzo di non avere il contatore di riproduzione, ed è dichiarato qui e nell'AC (§14).

## 8. La coda: persistenza, idempotenza, retry

### 8.1 Lo schema

La coda **non** può stare in `settings`: `settings` è una tabella chiave/valore per impostazioni (`02-DATA-SCHEMA.md` §6.1), e una coda ha stato per elemento, tentativi e indice unico. Serve una tabella nuova → **schema Dexie v5**.

```typescript
// packages/core/src/db/db.ts — DB_SCHEMA_V5
export const DB_SCHEMA_V5: Record<string, string> = {
  ...DB_SCHEMA_V4,
  scrobbleOutbox: '&idempotencyKey, hub, status, createdAt, nextAttemptAt',
};
```

| Campo | Tipo | Note |
|-------|------|------|
| `idempotencyKey` | string | PK: `hub\|eventKey` — **unico per costruzione** (G-SH.1) |
| `hub` | `ScrobbleHubId` | indice: il ciclo lavora per hub |
| `eventKey` | string | l'`eventKey` locale dell'ascolto (`05§3.2`) |
| `payload` | `ScrobblePayload` | la copia che verrà inviata (serializzabile, senza segreti) |
| `status` | `'pending' \| 'in_flight' \| 'sent' \| 'failed' \| 'dropped'` | macchina a stati di §8.2 |
| `attempts` | number | numero di tentativi effettuati |
| `nextAttemptAt` | number | ts (unix ms) del prossimo tentativo consentito |
| `lastError` | `{ code, message, recoverable } \| null` | mai un segreto: solo codice e messaggio |
| `createdAt` | number | ts di enqueue |
| `sentAt` | number \| null | ts di conferma |

### 8.2 La macchina a stati della riga

```
        enqueue()
            │
            ▼
        ┌────────┐   claim()    ┌───────────┐  ok   ┌──────┐
        │ pending│─────────────▶│ in_flight │──────▶│ sent │
        └────────┘              └───────────┘       └──────┘
            │                       │
            │                       ├─ errore recuperabile + tentativi < max ─▶ back to pending (nextAttemptAt = now + backoff)
            │                       │
            │                       └─ errore terminale  ──────────────────────▶ ┌────────┐
            │                                                                   │ failed │
            │  revoca del consenso (§10) / hub rimosso dalla lista              └────────┘
            └───────────────────────────────────────────────────────────────────▶ ┌────────┐
                                                                                  │ dropped│
                                                                                  └────────┘
```

| Stato | Significato | Chi lo cambia |
|-------|-------------|---------------|
| `pending` | In coda, in attesa del prossimo giro | `enqueue`, il ciclo di retry |
| `in_flight` | Riservata e in uscita verso il hub | `claim` (write-ahead), poi `markSent`/`markFailed` |
| `sent` | Il hub ha confermato | `markSent` |
| `failed` | Errore **terminale**: serve un'azione dell'utente | `markFailed` con `recoverable: false` |
| `dropped` | Scartata senza invio (revoca del consenso, hub rimosso, evento non eleggibile) | `purge`, `drop` |

### 8.3 Idempotenza

| Livello | Meccanismo | Copre |
|---------|-----------|-------|
| **Locale** | PK `hub\|eventKey` sulla coda | Doppia enqueue, doppio giro del ciclo, re-import dello stesso file |
| **Write-ahead** | `in_flight` scritta **prima** della richiesta | Crash dopo l'invio e prima della conferma: la riga non viene ritentata in automatico (E.SH.6) |
| **Lato hub** | **Nessuno**: nessuna delle due API espone una chiave di deduplica | Il caso residuo è dichiarato, non risolto: il costo è **un** scrobble duplicato in un hub, non una perdita di dati locali |

### 8.4 Retry

| # | Regola |
|---|---------|
| **R-SH.1** | Backoff esponenziale con jitter: `delay = min(base × 2^(attempts-1), cap)`, `base = 30 s`, `cap = 1 h` |
| **R-SH.2** | Massimo **5 tentativi** per riga; al superamento la riga passa a `failed` e l'utente vede un avviso con l'azione suggerita |
| **R-SH.3** | Un errore **terminale** (token scaduto, `api_sig` non valido, payload rifiutato) porta subito a `failed`: ritentare produrrebbe lo stesso errore e consumerebbe quota |
| **R-SH.4** | Il `429` e i `5xx` sono recuperabili: il backoff **rispetta** `X-RateLimit-Reset-In` di ListenBrainz quando presente |
| **R-SH.5** | Il ciclo è **seriale**: un solo invio in volo per hub, e un solo ciclo attivo per app (niente concorrenza fra worker e UI) |

## 9. Sync continua incrementale (T1.5.2)

Il percorso incrementale di **ListenBrainz** (`GET /1/user/{username}/listens`) è il secondo pezzo della story: mantiene il DB locale allineato con l'hub **senza** re-importare lo storico.

| # | Regola | Dettaglio |
|---|--------|----------|
| **C-SH.1** | Il cursore è **persistito** per hub: chiave `settings` `scrobble.cursor.listenbrainz` = `{ maxTs, lastSyncedAt }` | Senza persistenza ogni sync ripartirebbe da capo (AC "non re-import da zero") |
| **C-SH.2** | Anti-loop: la richiesta successiva usa `max_ts = ultimoTs - 1` | E.LB.7: cursore e ultimo `listened_at` coincidenti = loop infinito |
| **C-SH.3** | Stop pulito a **pagina vuota** (`count = 0`) | E.LB.6 |
| **C-SH.4** | `count` = 1000 (il massimo dichiarato: `MAX_ITEMS_PER_GET`) | doc ListenBrainz |
| **C-SH.5** | User-Agent obbligatorio + `Authorization: Token …` | E.LB.18 |
| **C-SH.6** | Rate limit 1 req/s guidato dagli header | D-SH.8 |
| **C-SH.7** | Il percorso passa dal contratto `parseRemote?()` di ADR-0010: l'adapter ListenBrainz **implementa** il metodo opzionale | È esattamente il caso previsto da ADR-0010 §"Contesto" (la 1.5 eredità quel contratto) |
| **C-SH.8** | Gli eventi letti dal percorso incrementale hanno `platform = 'listenbrainz'`: **non** vengono rimandati al sync in scrittura | È la condizione 2 del filtro di eleggibilità (§5): evita il loop ping-pong |

**Last.fm non ha un percorso incrementale dichiarato**: `user.getRecentTracks` è paginato e non ha un cursore temporale documentato per l'uso continuo; la pagina 1 con `from`/`to` potrebbe essere usata come finestra, ma **non è specificato** in questa prima tranche (punto aperto §18).

## 10. Consenso, privacy e dati che escono

### 10.1 Il toggle

| Regola | Contenuto |
|--------|-----------|
| **P-SH.1** | `PrivacySettings.scrobbleHubs` è l'elenco dei hub abilitati; **default `[]`** (nessuna scrittura) — invariato |
| **P-SH.2** | Il tipo del toggle **non** è `PlatformId[]`: `maloja`/`subsonic`/`roon` non sono piattaforme sorgente (`01-PLATFORMS.md` §3.9). Serve un tipo dedicato `ScrobbleHubId` — modifica di `02§3.8` (🟢 APPROVED) da ratificare |
| **P-SH.3** | Scrivere su H richiede **entrambi**: `H ∈ scrobbleHubs` **e** credenziali valide di H. Senza credenziali → zero richieste (nessun tentativo anonimo) |
| **P-SH.4** | **Revoca immediata**: togliere H dalla lista ferma i nuovi invii e **svuota** la coda di H (`status = dropped`). I dati locali (`listens`) non si toccano: la revoca del consenso all'invio non cancella lo storico locale |
| **P-SH.5** | Il toggle è **indipendente** dagli altri tre: `retainIp` (l'IP non esce mai in nessun caso, §10.3), `enrichMetadata` (arricchimento: altra destinazione), `carDetectionConsent` (rilevamento auto in macchina: evento locale, che per essere inviato richiede comunque `H ∈ scrobbleHubs`) |

### 10.2 Che cosa esce, per hub

| Hub | Dato inviato | Non inviato |
|-----|-------------|-------------|
| Last.fm | `artist`, `track`, `album` (se noto), `timestamp` (unix s UTC), `duration` (se nota), `api_key`, `sk`, `api_sig` | device, contesto, IP (come **dato**), genere, insight, mood, play count, cronologia aggregata |
| ListenBrainz | `track_metadata.artist_name`, `track_metadata.track_name`, `track_metadata.release_name` (se noto), `listened_at`, `additional_info` (`recording_mbid`, `artist_mbids`, `isrc`, `duration_ms` — solo se già noti), User Token nell'header | idem |

### 10.3 Che cosa non esce mai

Coerente con `09-PRIVACY-SECURITY.md` §3.2 e con `02-DATA-SCHEMA.md` §3.8:

- **IP e paese**: non sono nel payload. Il toggle `retainIp` resta **non applicabile** al percorso di scrittura, come già dichiarato per Last.fm e ListenBrainz in `03-ADAPTERS/lastfm.md` §7 e `03-ADAPTERS/listenbrainz.md` §7. *Nota dichiarata*: l'hub vede comunque l'IP della connessione, come qualsiasi server vede chi si connette — il toggle riguarda la **conservazione locale** dell'IP degli import, non ciò che il destinatario osserva.
- **Insight, mood, ere, memorie**: mai.
- **Cronologia aggregata**: mai; solo scrobble individuali.
- **Contesto di dispositivo**: mai (`deviceType`/`deviceDetail` non fanno parte del payload).

### 10.4 Base giuridica e inventario

`09-PRIVACY-SECURITY.md` §5 dichiara già "Scrobbling a hub terzi — Art. 6.1.a — Consenso". Da aggiungere in §4 (inventario) le righe: `sk` Last.fm (segreto, già presente), User Token ListenBrainz in scrittura (oggi dichiarato solo per la lettura, D-LB.5), payload di scrobbling (brano + timestamp). La revoca (§10.1 P-SH.4) è la revoca del consenso: da quel momento non esce più nulla.

## 11. La mappa degli errori

### 11.1 `ScrobbleError`

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

**La semantica di `recoverable` è diversa da quella di `AdapterError`**: in `AdapterError` significa "il file era parzialmente leggibile e gli eventi validi sono persistiti"; qui significa "**si può ritentare lo stesso invio** senza intervento dell'utente". Un errore di autenticazione è **non** recuperabile: ritentare produrrebbe lo stesso errore e consumerebbe quota.

### 11.2 La mappa

| Hub | Condizione | Codice | `recoverable` | Azione |
|-----|------------|--------|--------------|--------|
| Last.fm | errore **9** (`sk` non valida) | `AUTH_INVALID` | ❌ | Guida: riautenticare (web auth §6.1) |
| Last.fm | errore **10** (`api_key` non valida) | `AUTH_INVALID` | ❌ | Guida: registrare una key propria |
| Last.fm | errore **13** (firma non valida) | `AUTH_INVALID` | ❌ | Guida: verificare `shared secret` e implementazione md5 |
| Last.fm | errore **26** (key sospesa) | `AUTH_INVALID` | ❌ | Guida: contattare il supporto Last.fm |
| Last.fm | errore **29** (rate limit) | `RATE_LIMITED` | ✅ | Backoff rispettando il limite del protocollo |
| Last.fm | errori **11**, **16** (temporanei) | `HUB_ERROR` | ✅ | Backoff esponenziale |
| Last.fm | altri codici (3, 5, 6, 8, 14, ecc.) | `PAYLOAD_REJECTED` | ❌ | La doc dice: richiesta malformata, non ritentare |
| Last.fm | proxy assente / non raggiungibile / HTML | `SOURCE_UNREACHABLE` | ✅ | Avviso: configurare il proxy (D-LF.0) |
| ListenBrainz | **401** (token non valido) | `AUTH_INVALID` | ❌ | Guida: resettare il token nelle impostazioni LB |
| ListenBrainz | **404** (username inesistente) | `PAYLOAD_REJECTED` | ❌ | Guida: verificare l'username |
| ListenBrainz | **400** (payload non valido) | `PAYLOAD_REJECTED` | ❌ | Bug di implementazione o limite di batch: va diagnosticato, non ritentato |
| ListenBrainz | **429** | `RATE_LIMITED` | ✅ | Backoff **rispettando `X-RateLimit-Reset-In`** |
| ListenBrainz | **5xx** | `HUB_ERROR` | ✅ | Backoff esponenziale |
| Entrambi | credenziali assenti | `HUB_UNCONFIGURED` | ❌ | Zero richieste: l'hub è semplicemente saltato |
| Entrambi | rete/DNS/timeout | `SOURCE_UNREACHABLE` | ✅ | Backoff |

## 12. Edge case

| # | Descrizione | Impatto | Azione | Warning i18n |
|---|-------------|---------|--------|-------------|
| E.SH.1 | Hub non raggiungibile (proxy rotto, rete assente) | Invio differito | La riga resta `pending`, backoff, avviso all'utente | `scrobble.warn.hubUnreachable` |
| E.SH.2 | Rate limit (429 / errore 29) | Invio differito | Backoff rispettando gli header; nessun loop stretto | `scrobble.warn.rateLimited` |
| E.SH.3 | Token ListenBrainz scaduto o revocato | **Tutti** gli invii falliscono | `failed` terminale + guida al reset (E.LB.3) | `scrobble.error.tokenExpired` |
| E.SH.4 | `sk` Last.fm revocata dall'utente | Tutti gli invii falliscono | `failed` terminale + guida alla riautenticazione (E.LF.12) | `scrobble.error.sessionRevoked` |
| E.SH.5 | `api_sig` rifiutata (errore 13) | Invio sempre fallito | `failed` terminale: la firma o il `shared secret` sono sbagliati | `scrobble.error.invalidSignature` |
| E.SH.6 | Crash fra la richiesta e la conferma | **Possibile doppio scrobble** lato hub | La riga resta `in_flight`: **non** si ritenta in automatico; l'utente vede "invio non confermato" e decide | `scrobble.warn.unconfirmedSend` |
| E.SH.7 | Proxy CORS che inoltra solo GET | Last.fm non scrivibile | Il sink è "non configurato" per la scrittura: avviso esplicito, zero richieste | `scrobble.warn.writeProxyMissing` |
| E.SH.8 | Firma in batch con indici ≥ 10 | `api_sig` errata → errore 13 | L'ordinamento è **lessicografico sulle stringhe** dei nomi dei parametri (`artist[10]` prima di `artist[2]`), non numerico | `scrobble.error.invalidSignature` |
| E.SH.9 | L'utente toglie l'hub dalla lista con la coda non vuota | Scrobble inviati per un hub non più autorizzato | La coda del hub viene svuotata (`dropped`); nessun invio in volo | `scrobble.info.hubDisabled` |
| E.SH.10 | Ascolto locale senza durata nota | Maturità stimata sulla durata di catalogo | Si invia quando la stima supera la soglia; bias dichiarato (§7) | `scrobble.warn.durationEstimated` |
| E.SH.11 | Brano di durata ignota e inferiore a 30 s | Non si può stabilire la maturità | L'evento **non** viene inviato; conteggio degli scarti | `scrobble.warn.tooShortSkipped` |
| E.SH.12 | Loop: un ascolto letto da Last.fm viene rimandato a Last.fm | Scrobble ricorsivo | Il filtro esclude gli eventi con `platform` = hub | — |
| E.SH.13 | Il payload di un lotto supera `MAX_LISTEN_PAYLOAD_SIZE` | Invio rifiutato con 400 | Il lotto viene spezzato in sotto-lotti entro i limiti documentati | `scrobble.error.payloadTooLarge` |
| E.SH.14 | Il DB è in modalità read-only (quota esaurita) | La coda non può essere scritta | Nessun invio (la coda è la garanzia di non perdere); avviso all'utente | `scrobble.warn.dbReadOnly` |
| E.SH.15 | L'hub accetta il lotto ma ne rifiuta un elemento | Scrobble parziale | Il risultato dichiara `accepted`/`rejected`; gli elementi rifiutati tornano `pending` per il retry | `scrobble.warn.partialAccept` |
| E.SH.16 | Cambio di `scrobbleHubs` mentre il ciclo è in corso | Scrobble inviato a un hub appena tolto | Il ciclo verifica la lista **prima** di ogni lotto; un lotto già partito non viene annullato (la richiesta è in volo) | `scrobble.info.hubDisabled` |

## 13. UI e i18n

### 13.1 Dove vive il toggle

**Oggi non esiste una UI per `scrobbleHubs`**: `PrivacyScreen` espone quattro toggle booleani (`retainIp`, `enrichMetadata`, `carDetectionConsent`, `syncCloud`) e l'elenco dei hub non è editabile (`apps/web/src/onboarding/OnboardingRouter.tsx`, `apps/web/src/onboarding/PrivacySettings.ts`).

Questa spec **non** disegna la schermata (è materia di `07-UI-SPEC.md` 🟡 DRAFT): dichiara il **minimo** che l'implementazione deve fornire.

| # | Requisito | Motivazione |
|---|-----------|-------------|
| **U-SH.1** | Un selettore per-hub nell'area privacy, con default **vuoto** e stato **chiaro** ("nessun hub: non viene inviato nulla") | Il consenso deve essere visibile e revocabile |
| **U-SH.2** | Per ogni hub abilitato, uno stato della configurazione (manca la `api_key` / manca il `shared secret` / manca la `sk` / manca il proxy scrivibile / manca il User Token) | `isConfigured()` va detto all'utente **prima** del primo invio, non al primo errore |
| **U-SH.3** | Una vista della coda: quante righe in attesa, in volo, fallite, con l'azione "ritenta" / "scarta" | Il retry terminale e il caso E.SH.6 richiedono un'interfaccia: senza, l'utente non può chiudere `failed` |
| **U-SH.4** | Il consenso è **per-hub** e non un interruttore globale | D-SH.4 |
| **U-SH.5** | L'app non invia nulla finché l'utente non ha abilitato almeno un hub **e** la configurazione è completa | G-SH.3 |

### 13.2 i18n

Namespace nuovo **`scrobble.*`** (da aggiungere a `08-COPY-I18N.md` §1 e alla lista `NAMESPACES` in `apps/web/src/i18n/index.ts`).

| Codice | Messaggio (IT) | Quando |
|--------|----------------|--------|
| `scrobble.info.hubEnabled` | "Invio degli ascolti attivo su {hub}" | abilitazione |
| `scrobble.info.hubDisabled` | "Invio degli ascolti disattivato su {hub}: la coda è stata svuotata" | revoca (E.SH.9) |
| `scrobble.info.batchSent` | "{count} ascolti inviati a {hub}" | esito positivo |
| `scrobble.warn.hubUnreachable` | "{hub} non è raggiungibile: gli invii sono in attesa" | E.SH.1 |
| `scrobble.warn.rateLimited` | "{hub} ha limitato le richieste: gli invii riprenderanno più tardi" | E.SH.2 |
| `scrobble.warn.unconfirmedSend` | "{count} invii a {hub} non sono stati confermati: controlla il profilo per evitare duplicati" | E.SH.6 |
| `scrobble.warn.writeProxyMissing` | "Il proxy configurato non inoltra le scritture: {hub} può essere solo in lettura" | E.SH.7 |
| `scrobble.warn.durationEstimated` | "{count} ascolti inviati con durata stimata" | E.SH.10 |
| `scrobble.warn.tooShortSkipped` | "{count} ascolti troppo brevi esclusi" | E.SH.11 |
| `scrobble.warn.partialAccept` | "{hub} ha accettato {accepted} invii su {total}: i restanti verranno ritentati" | E.SH.15 |
| `scrobble.error.tokenExpired` | "Il token di {hub} non è più valido: rinnovalo nelle impostazioni" | E.SH.3 |
| `scrobble.error.sessionRevoked` | "La sessione di {hub} è stata revocata: riautenticati" | E.SH.4 |
| `scrobble.error.invalidSignature` | "{hub} ha rifiutato la firma della richiesta: verifica le credenziali" | E.SH.5, E.SH.8 |
| `scrobble.error.payloadTooLarge` | "Il lotto di invio supera il limite di {hub}: è stato suddiviso" | E.SH.13 |
| `scrobble.error.dbReadOnly` | "Il database è in sola lettura: gli invii sono sospesi" | E.SH.14 |

## 14. Test e fixture

### 14.1 Fixture

| Fixture | Contenuto |
|---------|----------|
| `fixtures/synthetic-history/scrobble-hub-sample.json` | 10 ascolti locali sintetici (`_case` + `_expectedOutput`, convenzione `10-TESTING.md` §3.1) con: durata nota, durata zero, durata di catalogo, brano sotto i 30 s, ascolto già maturato, ascolto non ancora maturato, `skipped: true`, ascolto con MBID, ascolto senza MBID, ascolto di piattaforma hub (da escludere) |
| `fixtures/synthetic-history/scrobble-payloads-sample.json` | Per ogni hub: il **payload atteso** (corpo pronto per la firma o per il JSON) a partire dagli stessi 10 ascolti, con l'expected `api_sig` (Last.fm) e l'expected body (ListenBrainz) |

Convenzione: `_case` e `_expectedOutput` sono **ignorati** dal codice, come in tutti gli altri fixture (`10-TESTING.md` §3.1).

### 14.2 Il mock

Il mock è `fetch` iniettato, come in `packages/core/src/adapters/lastfm/__tests__/lastfm-remote.test.ts`: nessuna dipendenza nuova (`msw` **non** si aggiunge). L'orologio è iniettato (`now`/`sleep`) per testare maturità, backoff e rate limit senza timer reali. Nessuna chiamata di rete in CI (`10-TESTING.md` §5).

### 14.3 Casi di test minimi

| # | Caso | Cosa dimostra |
|---|------|--------------|
| 1 | Happy path Last.fm | 1 lotto, 1 richiesta POST, `api_sig` corretta, `timestamp` al secondo |
| 2 | Happy path ListenBrainz | 1 richiesta `POST /1/submit-listens`, `listen_type: import`, `User-Agent` presente, `Authorization: Token` |
| 3 | **Toggle vuoto** | `scrobbleHubs: []` → **zero richieste** e zero righe in coda |
| 4 | Hub non configurato | Credenziali assenti → zero richieste, `HUB_UNCONFIGURED` |
| 5 | Maturità (T-SH.3) | Un ascolto sotto la soglia non entra in coda; uno sopra sì |
| 6 | Brano sotto 30 s | Escluso (E.SH.11) |
| 7 | `skipped: true` | Escluso |
| 8 | Evento di piattaforma hub | Escluso (E.SH.12, anti-loop) |
| 9 | **Idempotenza** | Il ciclo girato due volte → una sola riga in coda, una sola richiesta |
| 10 | Enqueue doppia della stessa chiave | La seconda è ignorata, nessun errore (G-SH.1) |
| 11 | 429 ListenBrainz | Backoff rispettando `X-RateLimit-Reset-In`; la riga torna `pending` |
| 12 | 429 Last.fm (errore 29) | Idem |
| 13 | 401 ListenBrainz | `failed` **terminale**: nessun secondo tentativo |
| 14 | Errore 9 Last.fm | `failed` terminale + guida |
| 15 | Errore 13 Last.fm | `failed` terminale + guida |
| 16 | Errore non mappato (es. 8) | `PAYLOAD_REJECTED`, non recuperabile (la doc dice: non ritentare) |
| 17 | Proxy che non risponde | `SOURCE_UNREACHABLE`, recuperabile, la riga resta in coda |
| 18 | Proxy che risponde HTML | `SOURCE_UNREACHABLE` (non un crash di parsing) |
| 19 | **Crash simulato** fra richiesta e conferma | La riga resta `in_flight`; al riavvio **non** viene ritentata (E.SH.6) |
| 20 | Revoca del consenso con la coda non vuota | Le righe passano a `dropped`; zero richieste successive (E.SH.9) |
| 21 | Batch Last.fm da 50 scrobble | Una sola richiesta, 50 coppie `artist[i]`/`track[i]`/`timestamp[i]` |
| 22 | **Firma in batch con ≥ 10 elementi** | L'ordinamento lessicografico delle stringhe produce la firma attesa (E.SH.8) |
| 23 | `md5Hex` | Vettori di test RFC 1321 + il valore noto dell'esempio `api_sig` (D-SH.2) |
| 24 | Rate limit | Il token bucket **spazia** le richieste (clock iniettato) |
| 25 | Sync incrementale ListenBrainz | Cursore persistito, seconda chiamata con `max_ts = ultimoTs - 1` (C-SH.2) |
| 26 | Sync incrementale a pagina vuota | Stop pulito, cursore invariato (C-SH.3) |
| 27 | Schema Dexie v5 | Migrazione v4→v5, tabella `scrobbleOutbox` creata, indice unico su `idempotencyKey` |
| 28 | Privacy | Nessun segreto nel bundle, nei log o nelle fixture; `ip`/`country` mai nel payload |
| 29 | UI | Il selettore per-hub rispetta il default vuoto e la revoca (U-SH.1, U-SH.4) |

## 15. Criteri di accettazione della Story 1.5

Derivati dagli AC della story (`11-BACKLOG.md`) e dai vincoli di questa spec.

| # | AC | Task coperti | Verificabile da |
|---|----|--------------|-----------------|
| **AC-SH.1** | `scrobbleHubs` vuoto ⇒ **zero richieste** e zero righe in coda | T1.5.4 | test 3 |
| **AC-SH.2** | Un ascolto locale maturato viene inviato al hub abilitato, con `timestamp` = inizio in secondi UTC | T1.5.6 | test 1, 2, 5 |
| **AC-SH.3** | Un ascolto già inviato a un hub **non** viene inviato una seconda volta (anche dopo un crash) | T1.5.6 | test 9, 10, 19 |
| **AC-SH.4** | Un invio fallito in modo recuperabile resta in coda e viene ritentato con backoff; un errore terminale non viene ritentato | T1.5.6 | test 11-16 |
| **AC-SH.5** | Il rate limit di ciascun hub è rispettato (Last.fm ~5 req/s, ListenBrainz 1 req/s con header) | T1.5.5 | test 24 |
| **AC-SH.6** | Il percorso incrementale di ListenBrainz usa un cursore persistito e **non** re-importa da zero | T1.5.2 | test 25, 26 |
| **AC-SH.7** | L'adapter ListenBrainz implementa `parseRemote?()` e produce gli stessi `RawListenEvent` del percorso file (V2 di ADR-0010) | T1.5.2 | test 25 |
| **AC-SH.8** | Il percorso web auth di Last.fm (`sk`) è implementato, con `api_sig` calcolata in md5 e i parametri ordinati come li ordina il server | T1.5.6 | test 21-23 |
| **AC-SH.9** | Il payload inviato contiene **solo** brano, artista, album (se noto) e timestamp (+ identificativi MusicBrainz se già noti) | T1.5.4 | test 28 |
| **AC-SH.10** | Tutti i test sono coperti da mock: nessuna chiamata di rete in CI | T1.5.5 | test 1-29 |
| **AC-SH.11** | **MBID da ListenBrainz alimenta DEDUP-2 e genera `track.genres` via MusicBrainz lookup** | (Story 1.3 → 4.2) | esistente in `03-ADAPTERS/listenbrainz.md` §6; da verificare nel percorso incrementale |

**Dipendenza dichiarata**: l'AC della story "il percorso incrementale richiede il metodo opzionale `parseRemote?()` → ADR-0010" è **soddisfatto**: ADR-0010 è 🟢 APPROVED v1.0.

## 16. Deliverable di implementazione

Cosa l'issue di implementazione (da aprire all'approvazione di questa spec, come fu fatto per #155) deve consegnare.

| # | Deliverable | Percorso |
|---|-------------|----------|
| 1 | `ScrobbleSink`, `ScrobblePayload`, `ScrobbleResult`, `ScrobbleError` | `packages/core/src/adapters/scrobble/types.ts` |
| 2 | Registry dei sink | `packages/core/src/adapters/scrobble/index.ts` |
| 3 | Sink Last.fm: firma md5, batch ≤ 50, `track.scrobble`, mappa errori | `packages/core/src/adapters/lastfm/scrobble.ts` |
| 4 | Sink ListenBrainz: `POST /1/submit-listens`, `listen_type: import`, `User-Agent`, `Authorization` | `packages/core/src/adapters/listenbrainz/scrobble.ts` |
| 5 | `md5Hex` + vettori RFC 1321 | `packages/core/src/adapters/crypto.ts` |
| 6 | Tabella `scrobbleOutbox` + schema Dexie v5 + test di migrazione | `packages/core/src/db/db.ts`, `packages/core/src/db/scrobbleOutbox.ts` |
| 7 | Ciclo della coda: enqueue, claim, markSent, markFailed, purge | `packages/core/src/db/scrobbleOutbox.ts` |
| 8 | `parseRemote?()` sull'adapter ListenBrainz (cursore, anti-loop, User-Agent) | `packages/core/src/adapters/listenbrainz/adapter.ts` |
| 9 | Percorso web auth Last.fm (`auth.getToken` → `auth.getSession`) e `sk` in storage locale | `apps/web/src/onboarding/LastfmPanel.tsx`, `packages/core/src/db/settings.ts` |
| 10 | Chiave di settings per il token ListenBrainz e per i cursori | `packages/core/src/db/settings.ts` |
| 11 | Selettore per-hub + vista coda | `apps/web/src/onboarding/` |
| 12 | Namespace i18n `scrobble.*` (IT + EN) | `apps/web/src/i18n/locales/{it,en}.json`, `apps/web/src/i18n/index.ts` |
| 13 | Fixture `scrobble-hub-sample.json` + `scrobble-payloads-sample.json` | `fixtures/synthetic-history/` |
| 14 | Test: i 29 casi di §14.3 | `packages/core/src/adapters/**/__tests__/`, `packages/core/src/db/__tests__/` |
| 15 | Aggiornamenti di schema e privacy | `02-DATA-SCHEMA.md` §3.8 e §6, `09-PRIVACY-SECURITY.md` §3.3 e §4, `08-COPY-I18N.md` §2, `05-ARCHITECTURE.md` §4 |

## 17. Impatto sui documenti

| Documento | Modifica | Sessione |
|----------|----------|----------|
| `05-ARCHITECTURE.md` | §4: nuova sottosezione "Contratto di scrittura (`ScrobbleSink`)" — **via ADR-0011** | 55 (spec) → ratifica |
| `02-DATA-SCHEMA.md` | §3.8: `scrobbleHubs: ScrobbleHubId[]` (tipo dedicato); §6: tabella `scrobbleOutbox` (schema Dexie v5) | 55 (spec) → ratifica |
| `09-PRIVACY-SECURITY.md` | §3.3: riga "scrobble" già presente da integrare con il payload esatto; §4: inventario (User Token in scrittura, `sk`, payload) | 55 (spec) → ratifica |
| `08-COPY-I18N.md` | §1: namespace `scrobble`; §2: tabella dei codici (§13.2) | 55 (spec) → ratifica |
| `03-ADAPTERS/lastfm.md` | §4 E.LF.21: risolto da D-SH.2 (md5 in JS puro); §10: contratto del proxy esteso al POST (E.SH.7) | ratifica |
| `03-ADAPTERS/listenbrainz.md` | §3.4: il percorso `/listens` è specificato in `20-SCROBBLING-HUB.md` §9; D-LB.5: il token passa da "solo lettura" a "lettura + scrittura" | ratifica |
| `01-PLATFORMS.md` | §3.7-3.8: rimando alla spec di scrittura | ratifica |
| `11-BACKLOG.md` | Story 1.5: `**Stato**:` e `**Spec**:` allineati a questa spec | 55 (fatto) |
| `docs/INDEX.md` | Riga del documento 20 nella tabella "Documenti fondamentali"; "Prossimo passo tecnico" aggiornato | 55 (fatto) |

## 18. Punti aperti (bloccano la ratifica)

1. **ADR-0011 — il contratto di scrittura dentro `05§4`.** `05-ARCHITECTURE.md` §4 è 🟢 APPROVED: modificarlo richiede un ADR, come per `parseRemote?()` (ADR-0010). Il contenuto dell'ADR è **già definito** da §4 di questa spec; l'ADR formalizza la decisione e le alternative (metodo su `PlatformAdapter` vs `ScrobbleSink` dedicato vs nessuna astrazione). **Issue aperta: #168** (`needs-spec`, `area:adapter`, `size:M`, `phase-1`).
2. **Firma md5: JS puro o dipendenza esterna.** La proposta è JS puro in `crypto.ts` (D-SH.2), per non aggiungere dipendenze a un bundle PWA. La controparte è una dipendenza mantenuta (`hash-wasm`), che aggiunge peso ma ha una garanzia di correttezza documentata. **Da ratificare.**
3. **Finestra di candidatura predefinita.** §5 la richiede ma non la fissa: 24 h, 7 giorni o "fino all'ultimo sync"? Il default influenza sia l'uso (quanti scrobble escono) sia il costo (quante richieste). **Da ratificare.**
4. **Durata di catalogo sconosciuta: inviare o no?** T-SH.3 dice che senza durata nota l'evento non matura (E.SH.11), il che **esclude** la maggior parte degli ascolti provenienti da Last.fm e ListenBrainz (durata `0`): alternative possibili sono usare la soglia dei 4 minuti sul tempo trascorso, o inviare comunque. **Da ratificare** — è la decisione con il maggiore impatto sul comportamento reale.
5. **Contratto del proxy Last.fm per la scrittura.** D-SH.2 assume che il proxy dell'utente inoltri POST con body. Molti proxy "JSON" inoltravano solo GET. Serve decidere se la 1.5 pretende un proxy con scrittura (e come lo si dichiara nelle impostazioni) oppure se la scrittura su Last.fm è "best effort". **Da ratificare.**
6. **Percorso incrementale Last.fm.** Non esiste un cursore documentato per `user.getRecentTracks` (§9): la finestra `from`/`to` sulla pagina 1 è un'alternativa plausibile, ma non è specificata. **Fuori perimetro della prima tranche** — da aprire come punto separato se il Boss lo vuole.
7. **"Now playing" e scrobbling live.** §3 dichiara che la PWA non può osservare la riproduzione di altre app: se il perimetro della 1.5 include il "live", serve una capability nuova (bridge di sessione media, player nell'app, o companion app). **Da ratificare come scope**, non come dettaglio.

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 55 (2026-10-27, issue #164) | Prima stesura. Risponde alle 5 decisioni richieste dall'issue (D-SH.1…D-SH.10): hub della prima tranche (Last.fm + ListenBrainz, Maloja Fase 2), semantica dell'invio (un scrobble per ascolto maturato, timestamp al secondo, regola ≥ 30 s e metà durata o 4 minuti), consenso per-hub indipendente dagli altri toggle, coda con tabella Dexie v5 e chiave `hub|eventKey`, collocazione del documento (`docs/20-SCROBBLING-HUB.md`). Dichiara la premessa mancante nella issue: la PWA non osserva la riproduzione di altre app, quindi la prima tranche è uno specchio dello storico locale, non uno scrobbling live. Definisce il contratto `ScrobbleSink` (da ratificare via ADR-0011), la mappa `ScrobbleError` (separata da `AdapterError`, che è orientato al parsing), i vincoli di protocollo dei due hub verificati sulle doc ufficiali, 16 edge case, 15 codici i18n, 29 casi di test e 15 deliverable di implementazione |
