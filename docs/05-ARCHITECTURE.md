# 05 — Architettura Tecnica

> Status: 🟢 APPROVED
> Versione: 1.5
> Ultima modifica: Sessione 65 (2026-10-30) — §6 Pipeline di arricchimento allineata all'emendamento della **D-A.6** (issue #193): il fallback mood-by-genre **non esiste** (`04§11.1`)
> ADR collegati: 0001-pwa-first, 0002-local-first, 0003-adapter-pattern, 0005-sync-cloud (Fase 2), 0010-remote-source-adapter (🟢 APPROVED v1.0), 0011-scrobble-sink (🟢 APPROVED v1.0)

---

## 1. Principi architetturali

| Principio | Conseguenza |
|-----------|-------------|
| **Local-first** | Tutti i dati vivono nel browser (IndexedDB). L'app funziona offline dopo il primo caricamento |
| **Privacy-first** | Nessuna telemetria (D.A.1). Le uniche chiamate di rete sono: arricchimento metadati (opzionale, governed by `PrivacySettings.enrichMetadata`), scrobbling hub (opzionale), sync cloud (Fase 2, ADR-0005) |
| **Adapter pattern** | Ogni piattaforma è un modulo indipendente che produce il formato unificato; aggiungere una piattaforma = aggiungere un adapter |
| **Analisi deterministica e documentata** | Ogni insight deriva da formule specificate in `04-ANALYSIS-ALGORITHMS.md`, testabili con fixture |
| **Progressive enhancement** | Funziona con una sola piattaforma; migliora con più sorgenti |

## 2. Diagramma a layer

    ┌────────────────────────────────────────────────┐
    │ LIVELLO 4 — PRESENTAZIONE (React PWA)          │
    │  Timeline · Home · Esplora · Analisi · Ricordi │
    │  Impostazioni · Import · Share                 │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 3 — ANALYSIS ENGINE (Web Worker)       │
    │  MoodTracker · EraDetector · EventDetector     │
    │  MemoryEngine · PatternAnalyzer                │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 2 — ENRICHMENT PIPELINE                │
    │  AudioFeatures · MusicBrainz lookup · Generi   │
    │  (React Query — vedi §8)                       │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 1 — IMPORT ENGINE (Adapters)           │
    │  spotify · youtube · apple · deezer · tidal    │
    │  soundcloud · lastfm · listenbrainz · plex     │
    │  navidrome · manual                            │
    │            ↓ formato unificato ↓               │
    │  LOCAL DATABASE (IndexedDB / Dexie 4, schema v2)│
    └────────────────────────────────────────────────┘

## 3. Formato unificato (record di ascolto)

Gli adapter producono record conformi a `02-DATA-SCHEMA.md §3.2 (ListenEvent)`. Forma **piatta**, allineata allo schema, NON nested come nella v0.1:

    {
      "id": "uuid",
      "eventKey": "spotify:abc123",
      "platform": "spotify",
      "importId": "import-uuid",
      "timestamp": 1710523800000,      // unix ms UTC, fine ascolto
      "startedAt": 1710523555000,     // unix ms UTC, inizio ascolto (null se non noto)
      "durationMs": 245000,
      "trackId": "track-uuid",
      "completed": true,
      "skipped": false,
      "shuffle": true,
      "offline": false,
      "incognito": false,
      "reasonStart": "playbtn",
      "reasonEnd": "endplay",
      "deviceType": "mobile",
      "deviceDetail": "iPhone 15",
      "ip": null,                     // popolato SOLO se PrivacySettings.retainIp
      "country": "IT",                // sempre derivato (privacy-by-design)
      "day": "2024-03-15"             // derivato, indicizzato
    }

I campi contestuali sono **opzionali**: le piattaforme che non li forniscono li lasciano null. Le analisi devono degradare con grazia in loro assenza.

### 3.1 Trasformazione adapter → core

L'adapter emette un `RawListenEvent` con metadati nativi della piattaforma (`sourceTrackUri`, `sourceArtistName`, `sourceAlbumName`, `rawTimestamp`, `sourceDurationMs`, ...).

Il core trasforma ogni `RawListenEvent` in `ListenEvent` (persistito in `02§3.2`) applicando in ordine:

1. **Normalizzazione timestamp** → UTC unix ms (`timestamp` = fine ascolto, `startedAt` se noto)
2. **Calcolo `eventKey`** (vedi §3.2)
3. **Risoluzione `trackId`** via regole DEDUP di `02§5` (ISRC → MBID → fuzzy con `durationBucketMs`)
4. **Derivazione `day`** da `timestamp` (UTC, formato `YYYY-MM-DD`)
5. **Mapping `platform` raw** → `PlatformId` normalizzato
6. **Mapping device** (es. Spotify `iOS`+`iPhone15,2` → `DeviceType.mobile` + `deviceDetail` libero)

Questa separazione permette di:
- Testare la pipeline di normalizzazione in isolamento con fixture (`10-TESTING.md` §3)
- Cambiare il formato nativo di un adapter senza toccare lo schema
- Far evolvere `DEDUP` senza riscrivere gli adapter

### 3.2 Calcolo `eventKey`

    eventKey =
      platform + ':' +
      (sourceEventId ?? sha1(trackId + '|' + timestamp + '|' + durationMs))

`sourceEventId` è fornito dall'adapter se la piattaforma espone un identificativo nativo stabile (es. Spotify `trackId` + `played_at`); altrimenti fallback SHA-1. Garantisce idempotenza (D.1.2): reimportare lo stesso file non duplica nulla.

## 4. Adapter pattern — contratto

Ogni adapter espone la stessa interfaccia logica:

    interface PlatformAdapter {
      readonly platform: PlatformId;
      readonly name: string;          // es. "Spotify"
      readonly version: string;       // semver adapter
      detect(input: File | Blob): boolean | Promise<boolean>;
      parse(
        input: File | Blob,
        options?: ParseOptions
      ): AsyncIterable<RawListenEvent>;
      parseLibrary?(input: File | Blob): Promise<LibrarySnapshot>;
      // Presente SOLO negli adapter con sorgente remota (ADR-0010)
      parseRemote?(
        source: RemoteSource,
        options?: ParseOptions
      ): AsyncIterable<RawListenEvent>;
    }

    /** Opzioni condivise dai due percorsi di parsing. */
    interface ParseOptions {
      signal?: AbortSignal;          // cancellazione cooperativa
    }

**Regole**:
- `parse` è **streaming** (AsyncIterable): mai caricare 200k eventi in memoria in un colpo
- **Cancellazione cooperativa**: l'utente può annullare l'import a metà (vedi `06§2.4 Processing`); l'adapter controlla `signal.aborted` ad ogni `yield` (o ogni N eventi per performance) e lancia `DOMException('AbortError')` su cancel
- **Partial recovery**: se il file è corrotto a metà, gli eventi validi parsati prima dell'errore sono **persistiti** (transazione in `02§7`)
- `detect()` ritorna `boolean | Promise<boolean>` (D.A.8): supporta detection statica (euristica su header/campi) **e** remota (ping credenziali, Fase 2). I caller devono **sempre** trattarlo come Promise con `await`
- Ogni adapter dichiara i propri edge case in `01-PLATFORMS.md` §5
- Output grezzo → normalizzazione UTC → `eventKey` calcolato (`§3.2`) → DEDUP (`02§5`) → upsert in Dexie

### 4.1 Sorgenti remote (ADR-0010)

Il contratto è nato **file-only** (i tre adapter del perimetro e ListenBrainz consumano tutti un export scaricato dall'utente). Last.fm è la prima piattaforma che non ha un export utilizzabile dall'app: l'unico canale è l'API `user.getRecentTracks`, paginata e autenticata. Il contratto cresce quindi di **un metodo opzionale**, non di una seconda interfaccia.

    /** Sorgente dati remota per gli adapter che non consumano un file. */
    interface RemoteSource {
      endpoint: string;                // URL base dell'API, o del proxy configurato dall'utente
      credentials?: {
        apiKey?: string;               // chiave API per-app (es. Last.fm api_key)
        sessionKey?: string;           // chiave di sessione (es. Last.fm sk)
      };
      pagination?: {
        limit?: number;                // massimo elementi per richiesta
        from?: number;                 // finestra temporale iniziale (unix secondi UTC)
        to?: number;                   // finestra temporale finale (unix secondi UTC)
      };
      headers?: Record<string, string>; // header extra (es. User-Agent obbligatorio su ListenBrainz)
      signal?: AbortSignal;            // cancellazione cooperativa
    }

**Regole**:

- `parseRemote?` è **opzionale**: gli adapter file-only non lo implementano, e i suoi assenti non cambiano il loro comportamento
- Il percorso remoto produce **gli stessi `RawListenEvent`** del percorso file: la pipeline di `§3.1` è **riusata invariata** (nessuna seconda implementazione della normalizzazione)
- **Non esiste `detectRemote`**: un'API non si "rileva", si *configura*. La validazione delle credenziali avviene al primo uso e il suo fallimento è un errore recuperabile
- Il **rate limiting è responsabilità dell'adapter**, non del core: ogni piattaforma ha limiti e semantica degli header diversi (Last.fm ~5 req/s non pubblicato, ListenBrainz 1 req/s con `X-RateLimit-*`)
- Il payload raw **non** è persistito, come per il percorso file (`ADR-0003`): il DB locale non immagazzina 200k payload
- Nessun segreto è embedded nel bundle: le credenziali sono **per-utente** e restano in storage locale
- "Sorgente non raggiungibile" (proxy assente, DNS fallito, timeout) è un errore **recuperabile**: gli eventi già raccolti restano persistiti

Dettagli, motivazioni e alternative scartate in `13-ADR/0010-remote-source-adapter.md`.

**Errori**:

    class AdapterError extends Error {
      code: 'INVALID_FORMAT' | 'TRUNCATED' | 'UNSUPPORTED_VERSION' | 'INTERNAL' | 'SOURCE_UNREACHABLE';
      recoverable: boolean;   // se true, partialEvents è stato persistito
      partialEvents: number;  // quanti eventi validi parsati prima dell'errore
    }

| `code` | Quando | `recoverable` |
|--------|--------|---------------|
| `INVALID_FORMAT` | File completamente sbagliato o versione non supportata | `false` |
| `TRUNCATED` | File/zip corrotto a metà | `true` |
| `UNSUPPORTED_VERSION` | Schema della piattaforma cambiato, serve aggiornare adapter | `false` |
| `INTERNAL` | Bug dell'adapter | dipende |
| `SOURCE_UNREACHABLE` | Sorgente remota irraggiungibile: proxy assente, DNS fallito, timeout, risposta non JSON (ADR-0010 §4.1) | `true` |

`sourceEventId` (citato dalla regola `eventKey` in `02§3.2`) è opzionale e fornito dall'adapter quando la piattaforma espone un ID nativo stabile (es. Spotify `trackId` + `played_at`). In assenza, si usa lo SHA-1 di fallback.

### 4.2 Contratto di scrittura (`ScrobbleSink`) (ADR-0011)

Il contratto di `§4` descrive la **lettura** (import). La Story 1.5 chiede l'operazione opposta: **inviare** i propri ascolti ai hub di scrobbling. I due insiemi non coincidono — non ogni piattaforma scrobbla, e `maloja`/`subsonic`/`roon` sono client di scrobbling, non fonti (`01§3.9`) — quindi il contratto di scrittura è **separato**, con la stessa forma di `parseRemote?()`: una libreria dedicata, non un quinto metodo del factory.

    /** Un sink di scrobbling: sa inviare ascolti a UN hub. */
    interface ScrobbleSink {
      readonly hub: ScrobbleHubId;
      readonly name: string;          // es. "Last.fm"
      readonly version: string;       // semver del client del sink
      isConfigured(): boolean;        // credenziali presenti, proxy scrivibile
      submit(
        listens: ScrobblePayload[],
        options?: { signal?: AbortSignal }
      ): Promise<ScrobbleResult>;
    }

    /** Identificatore di un hub abilitato (NON è un PlatformId). */
    type ScrobbleHubId = 'lastfm' | 'listenbrainz';

    /** Payload: copia minima dell'ascolto, chiusa per costruzione. */
    interface ScrobblePayload {
      idempotencyKey: string;         // `hub|eventKey`
      startedAt: number;              // UNIX ms UTC (→ secondi alla serializzazione)
      durationMs?: number;            // durata catalogo, se nota
      recordingMbid?: string;
      isrc?: string;
      artistName: string;
      trackName: string;
      albumName?: string;
    }

    interface ScrobbleResult {
      accepted: number;               // elementi accettati dal hub
      rejected: number;               // elementi rifiutati (errore per elemento)
    }

**Regole**:

- Il contratto di scrittura è **separato** da quello di lettura, ma ne riusa la forma: `PlatformAdapter` **non cambia** e nessun adapter esistente è toccato
- `ScrobbleHubId` è un tipo **dedicato**: `PrivacySettings.scrobbleHubs` **non** è `PlatformId[]` (`maloja`/`subsonic`/`roon` non sono piattaforme sorgente)
- Il **payload è chiuso per costruzione**: nessun campo per contesto, device, IP o insight — il contenuto inviato è chiuso dal *tipo*, non da una policy
- Il **rate limiting è responsabilità del sink**, non del core: Last.fm ~5 req/s (token bucket, batch ≤ 50), ListenBrainz 1 req/s guidato dagli header `X-RateLimit-*`
- **Nessun segreto embedded nel bundle**: `api_key`, `shared secret`, `sk` e User Token sono **per-utente** e stanno in storage locale
- **Nessun server di backend**: il proxy Last.fm è **di fiducia dell'utente**
- **`AbortSignal`** per la cancellazione cooperativa
- Il **protocollo vive nel sink**: endpoint, autenticazione, rate limit, formato del payload e semantica degli errori sono ignoti al core
- L'**idempotenza è locale e verificabile**: chiave unica `hub|eventKey` sulla coda `scrobbleOutbox`, con scrittura **write-ahead** (`in_flight` prima della richiesta)
- Il percorso **incrementale** (sync continua ListenBrainz) è un percorso di *lettura*: usa `parseRemote?()` (`§4.1`), non questo contratto

**Errori**:

    class ScrobbleError extends Error {
      code: 'HUB_UNCONFIGURED' | 'AUTH_INVALID' | 'RATE_LIMITED' | 'SOURCE_UNREACHABLE' | 'PAYLOAD_REJECTED' | 'HUB_ERROR';
      recoverable: boolean;   // true = si può ritentare lo stesso invio
      hub: ScrobbleHubId;
    }

| `code` | Quando | `recoverable` |
|--------|--------|---------------|
| `HUB_UNCONFIGURED` | Credenziali assenti o hub non abilitato | `false` |
| `AUTH_INVALID` | `sk`/token non valido, scaduto, revocato, firma rifiutata | `false` |
| `RATE_LIMITED` | 429 o rate limit del protocollo | `true` |
| `SOURCE_UNREACHABLE` | Rete, DNS, proxy assente o rotto, timeout | `true` |
| `PAYLOAD_REJECTED` | Il hub ha rifiutato il contenuto (400, errore di forma) | `false` |
| `HUB_ERROR` | Errore lato hub non classificabile | `true` |

`recoverable` ha qui una **semantica diversa** da quella di `AdapterError`: in `AdapterError` significa "gli eventi validi sono stati persistiti", in `ScrobbleError` significa "**lo stesso invio può essere ritentato** senza intervento dell'utente". Un errore di autenticazione non è recuperabile: ritentare produrrebbe lo stesso errore e consumerebbe quota.

Dettagli, motivazioni e alternative scartate in `13-ADR/0011-scrobble-sink.md`.

## 5. Database locale

- **Engine**: IndexedDB via Dexie.js
- **Versione corrente**: Dexie 4 (schema v2, vedi `02-DATA-SCHEMA.md §6`)
- **Tabelle (12)**: `listens`, `tracks`, `artists`, `albums`, `features`, `sessions`, `insights`, `imports`, `library`, `playlists`, `playlistItems`, `searchQueries`
- **PK reali**:
  - `listens`: `eventKey` (UNIQUE, idempotenza)
  - `tracks`: `canonicalKey` (UNIQUE, dedup)
  - `features`: `trackId` (1:1)
  - `playlistItems`: `[playlistId+trackId]` (composita)
- **Indici critici**: `listens.timestamp`, `listens.day`, `listens.trackId`, `tracks.isrc`, `tracks.mbid`, `searchQueries.[platform+normalized]`
- **Migrazioni**: versionate in Dexie; ogni cambio schema = nuova versione + funzione di upgrade; **mai drop di tabelle utente** (MIG-1)
- **Transazioni**: ogni import scrive in una **singola transazione** che include `listens` + `tracks` + `artists` upsert. In caso di `AdapterError` con `recoverable: true` (`§4`), la tx viene committata con i record validi già scritti; se `recoverable: false`, rollback totale
- **Read-only mode**: se IndexedDB è in quota esaurita, in `VersionError` (DB lock) o in blocco browser (private mode Safari, edge cases), l'app entra in **read-only mode**: nessuna scrittura accettata, messaggio utente localizzato in `error.dbCritical` / nuovo `error.dbReadOnly`, e un banner persistente invita a liberare spazio o ricaricare **(futuro — Story 0.7)**.
- Dettaglio completo in `02-DATA-SCHEMA.md`

## 6. Pipeline di arricchimento

Problema: Spotify ha deprecato le audio-features (nov 2024); Apple non le ha mai avute.

**Strategia a cascata per ogni traccia** (D.A.6):

1. **Cache locale** (feature già calcolata/scaricata)
2. **Essentia.js (WASM) in-browser** — provider di default quando è disponibile un preview audio (30s) dal catalogo. **La fonte del preview è l'iTunes Search API** (`previewUrl`, senza autenticazione): i preview di Spotify non sono più disponibili per le app nuove e quelli di Apple Music richiedono un account Developer a pagamento (`21-AUDIO-FEATURES.md` §2.1, D-AF.1). `valence` ed `energy` sono misurati sui classification head **DEAM** (`deam-msd-musicnn-2`), normalizzati da [1,9] a [0,1]
3. **AcousticBrainz** — bonus se il brano ha un MBID mappato (lookup per recording_id). L'API fornisce **classificazioni `mood_*` e `danceability`**, non `valence`/`energy`: i due campi che il mood tracker legge sono **derivati** da quelle probabilità (`21` §7.3, D-AF.8)
4. **Fallback euristico** (`source: 'heuristic'`) — stime da metadata (BPM da genre, energia da popolarità, valence da key/mode); qualità bassa ma copre il 100% del catalogo. **Non alimenta il mood tracker**: il layer di analisi legge solo `source ∈ {essentia, acousticbrainz, manual}` (`21` §12, D-AF.4)
5. **Niente feature**: le analisi basate su valence/energy **non producono insight** e il mood tracker segnala la copertura mancante con un **warning aggregato per periodo** (`04§1.4`). **Non** esiste un fallback mood-by-genre: la mappa genre→valence/energy non è ratificata in nessun documento e inventarla sarebbe il "segnale inventato" che la D-A.1 esclude (decisione **D-A.6**, `04§11.1`, issue #193)

Ogni feature salvata registra la **fonte** (`AudioFeatures.source: 'essentia' | 'acousticbrainz' | 'heuristic' | 'manual'`) per trasparenza e ricalcolo futuro. **Rimosse** le voci placeholder `api_freqblog` / `api_musicae` (non sono provider reali).

La specifica completa del provider (contratto, mappatura dei campi, normalizzazione, privacy, CSP, stoccaggio, costi misurati e test) è **`21-AUDIO-FEATURES.md` (v1.1 🟢 APPROVED)**.

### 6.1 Trigger conditions

La pipeline di arricchimento è invocata in 3 contesti:

| Trigger | Quando | Comportamento |
|---------|--------|---------------|
| **on-import** | Al termine di un import (transazione `02§7` committata) | Per ogni nuovo `trackId` senza `AudioFeatures`, prova Essentia → AB → euristica |
| **on-demand** | L'utente apre una schermata analisi (`06§2.9 Analisi`, `QuadrantChart`) | Refresh lazy delle feature mancanti per i brani nel viewport |
| **scheduled** | Job in Web Worker idle (`requestIdleCallback`), max 5 min/giorno | Backfill di feature mancanti in batch; throttle 1 track/sec per non impattare la UI |

L'arricchimento **non blocca mai l'import**: se Essentia o AB falliscono, si cade immediatamente al fallback euristico, e l'utente vede i risultati senza attendere.

### 6.2 Caching policy

- **Cache locale**: tabella `features` con PK `trackId` (1:1), indicizzata per `source`
- **TTL**: nessuno per i risultati Essentia/heuristica (calcolo locale, deterministico). Per AcousticBrainz: 90 giorni (i dataset AB sono congelati per data di dump)
- **LRU**: limite 50k record; oltre, evict LRU basato su `lastSeenAt` del track
- **Invalidazione**: bump del `schemaVersion` in `AudioFeatures` (vedi `02§3.4`) quando cambia la versione Essentia o il modello euristica; i record con `schemaVersion` vecchio vengono ricalcolati al prossimo trigger
- **Disattivazione**: se `PrivacySettings.enrichMetadata === false`, la cache non viene letta né scritta; le analisi basate su valence/energy **non producono insight** (D-A.6, `04§11.1`: il fallback mood-by-genre non esiste)

## 7. Analysis engine

Esegue in **Web Worker** dedicato per non bloccare la UI. Moduli: MoodTracker, EraDetector, EventDetector, MemoryEngine, PatternAnalyzer. Ogni algoritmo è specificato con formula, parametri e esempio input→output in `04-ANALYSIS-ALGORITHMS.md`. I risultati sono persistiti in `insights` con versionamento del parametro-set (`derivedVersion`) per ricalcolo coerente (MIG-3).

### 7.1 Scheduling e incrementalità

- Ogni algoritmo gira in chunk con **budget 50ms** schedulato via `requestIdleCallback` (o fallback `setTimeout(0)`)
- Gli algoritmi sono **incrementali** (`04§1.2`): ricevono `(state, newEvents)` invece di `(allEvents)`; `state` è persistito in `insights`
- La pipeline gira **on-trigger** (import completato, on-demand dall'utente) o in **background idle**; max 5 min/giorno di budget
- L'UI resta a 60fps: nessun algoritmo blocca il main thread

### 7.2 Failure isolation

- Ogni modulo è wrappato in un `try/catch` interno: un crash (es. divisione per zero su dataset patologico) **non blocca gli altri moduli**
- L'errore viene loggato in console con stack trace + `module` + `inputSummary` (no PII)
- L'insight parziale viene marcato con `status: 'pending'` e `confidence: 0`; l'utente vede un placeholder "Insight non disponibile"
- Test in `10-TESTING.md` §3 prevedono fixture patologiche (eventi con `valence: NaN`, durate 0, overlap totale)

### 7.3 Versioning esplicito

- `derivedVersion` calcolato come `sha1(JSON.stringify(configObject)).slice(0, 8)` (`04§1.1`)
- Quando `configObject` cambia (parametri, pesi, soglie), `derivedVersion` cambia → insight vecchi marcati `stale`
- Al prossimo avvio (o trigger), `recompute()` ricalcola solo gli insight con `derivedVersion` non corrente
- L'utente vede una progress bar "Aggiornamento insights in corso (X%)" durante il backfill

## 8. Stack tecnologico

| Componente | Scelta | Motivazione | Fase |
|------------|--------|-------------|------|
| Runtime UI | React 19 + TypeScript 5.6+ + Vite 6 | Ecosistema, PWA-first | attivo |
| PWA | vite-plugin-pwa (Workbox) | Offline, installabilità | attivo |
| Stato client | **Zustand** (UI) + **dexie-react-hooks** (DB live queries) | Local-first: stato derivato da Dexie, no store globale | futuro (Fase 3) |
| Data fetching remoto | **React Query 5** solo per enrichment (D.A.5) | Chiamate a MB/Last.fm; niente su dati core | futuro (Fase 2) |
| DB locale | **Dexie 4** (IndexedDB) v2 schema | API matura, migrazioni | attivo |
| Schema validation | **Zod 3** | `RawListenEvent`, payload adapter, form | futuro (Fase 3) |
| Form | **react-hook-form** + `@hookform/resolvers/zod` | Settings/Import | futuro (Fase 3) |
| i18n | **i18next** + react-i18next | `08§7`, Story 0.6 | attivo |
| Date/time | **date-fns** + date-fns-tz | `userTimezone` PatternPayload (`02§4`) | futuro (Fase 2) |
| Worker bridge | **Comlink 4** | Typed RPC main↔worker (`§7`) | futuro (Fase 2) |
| Grafici | **Recharts 2.15+** standard + **D3 7** solo per Timeline (D.A.4, lazy import) | 90% Recharts, Timeline custom | futuro (Fase 3) |
| UI kit | **Tailwind 4** + shadcn/ui | Coerenza col design system | futuro (Fase 3) |
| Parsing | **PapaParse** (CSV), JSON nativo, streaming | File grandi | futuro (Fase 1) |
| Audio features | **Essentia.js (WASM)** (D.A.6) + AcousticBrainz bonus + fallback euristico | Open source, locale, no rete | futuro (Fase 2) — spec: `21-AUDIO-FEATURES.md` v1.0 |
| Logger | **core/logger** wrapper | Schema `{level, module, msg, ctx}` consistente, no PII | attivo |
| Test | **Vitest 2+** + fake-indexeddb + **MSW** + **Playwright 1.5+** | Unit + e2e + API mock | attivo (MSW futuro) |
| Coverage | **@vitest/coverage-v8** per package | Soglie da `10§2` | attivo |
| Build | Vite 6 + **Turborepo** | Monorepo incrementale | attivo |
| Tooling | **ESLint 9** + Prettier 3 + lint-staged + commitlint | Convenzioni `AGENTS.md` | attivo (hook in `.githooks/`: lint-staged nel pre-commit, commitlint nel commit-msg) |
| Bundle analyzer | rollup-plugin-visualizer | NFR budget 300KB (`§10`) | futuro (Fase 6) |
| Desktop (Fase 2) | Tauri 2.0 | 10x più leggero di Electron | futuro (Fase 2) |
| **Sync cloud (Fase 2+, ADR-0005)** | **Placeholder** — non implementato nel MVP (D.A.7). Servizio self-hosted opzionale con E2EE | Previsto ma non vincolante per Fase 0/1 | futuro (Fase 2+) |

> **Nota**: le voci marcate "futuro" non sono installate in `package.json` né in `packages/*/package.json` alla data di questa revisione. Verranno aggiunte nelle rispettive fasi (vedi `11-BACKLOG.md` EPIC 6 per il bump post-implementazione).

### 8.1 Tooling dev

- **Linting**: ESLint 9 (flat config) + plugin React/TS/Vitest, Prettier 3
- **Hook pre-commit**: `.githooks/pre-commit` (pattern del branch + encoding dei file staged) + lint-staged (lint + format solo sui file staged)
- **Commit**: commitlint enforce Conventional Commits (vedi `AGENTS.md` §Git workflow)
- **TypeScript**: 5.6+ con `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **Path aliases**: `@core/*`, `@ui/*`, `@web/*` (vedi `§9` monorepo)
- **`fake-indexeddb`**: polyfill per test Node, configurato in `vitest.setup.ts`
- **Fast-check pre-flight** (smoke test del DB): comando `db.fastCheck()` esposto da `core/db` (vedi `10-TESTING.md §3`)
- **Turborepo**: pipeline `build → test → lint` cacheata per package

## 9. Struttura monorepo (target Fase 0 tecnica)

    life-soundtrack/
    ├── apps/
    │   ├── web/                  # PWA principale
    │   └── desktop/              # Tauri (Fase 2)
    ├── packages/
    │   ├── core/
    │   │   ├── adapters/         # un modulo per piattaforma
    │   │   ├── analysis/         # Web Worker
    │   │   ├── enrichment/       # porte + orchestratore puri (NO React: vedi §9.2)
    │   │   ├── schema/           # tipi TypeScript condivisi (= 02)
    │   │   ├── db/               # Dexie wrapper
    │   │   └── logger/           # wrapper logger strutturato
    │   ├── ui/                   # design system componentizzato
    │   └── config/               # tsconfig, eslint, vitest condivisi
    ├── docs/ · design/ · fixtures/ · scripts/

### 9.1 Convenzioni package

- **Naming**: scope `@ls/*` (es. `@ls/core`, `@ls/ui`, `@ls/web`, `@ls/config`)
- **Versioning**: tutti i package partono da `0.1.0`; bump sincronizzato in fase 1 release (changeset-driven)
- **Entry point**: `src/index.ts` con `export` espliciti; niente barrel file "tutto da index"
- **`package.json` minimi**: solo `name`, `version`, `type: "module"`, `main`, `types`, `exports`, `scripts`, `dependencies`, `devDependencies`, `peerDependencies` (no `private` fittizi)
- **`exports` map**: ogni package dichiara i subpath (`./adapters/spotify`, `./db`, ...) per consentire tree-shaking
- **Lockfile unico**: `pnpm-lock.yaml` alla root, monorepo-aware (`pnpm-workspace.yaml` con `packages/*`)

### 9.2 Dipendenze tra package (regola aciclica)

Le frecce rappresentano `import from`. Le dipendenze inverse sono **vietate**:

    @ls/web  ──┬──> @ls/ui
               ├──> @ls/core
               └──> @ls/config (devDep)
    
    @ls/ui    ────> @ls/core (solo tipi, non runtime)
    @ls/core  ────> (niente, è foglia)
    @ls/config───> (niente, è foglia)

Regole pratiche:
- `@ls/core` non importa MAI da `@ls/ui` né `@ls/web` (è runtime-agnostic, gira anche nel Worker)
- `@ls/core/analysis` non importa da React (è puro TS, gira in Web Worker)
- `@ls/ui` può importare **solo tipi** da `@ls/core` (no runtime coupling); i consumer passano i dati via props
- `@ls/web` è l'unico che importa da tutto: orchestra UI + chiama core + usa config

## 10. Requisiti non funzionali

| Requisito | Target |
|-----------|--------|
| Import 50k eventi | < 30 s (revisione M13: 50k è il target realistico Fase 0) |
| Import 100k eventi | < 90 s (best effort) |
| First contentful paint | < 1.5 s |
| Bundle iniziale | < 300 KB gzip (worker, D3, WASM lazy) |
| Offline | 100% funzionale dopo primo load |
| Privacy | Zero PII in uscita senza toggle esplicito (D.A.1) |
| Accessibilità | WCAG 2.1 AA |
| Browser | Chrome/Edge 90+, Firefox 90+, Safari 15+ |

### 10.1 Budget di performance (per route/feature)

I target sono **P95** (95° percentile) misurati su device baseline (`§10.2`):

| Route / Feature | Metrica | Target P95 |
|-----------------|---------|------------|
| First load (cold cache) | FCP | < 1.5 s |
| Home (schermata ⑥) | Render after DB query | < 200 ms |
| Timeline (schermata ⑦) | Initial paint + zoom 1y | < 400 ms |
| Timeline zoom 1d | Re-render con filtri | < 250 ms |
| Esplora search (schermata ⑨) | Autocomplete response | < 150 ms |
| Import 50k eventi | E2E (drag → "Import completato") | < 30 s |
| Import 100k eventi | E2E | < 90 s |
| Settings toggle | Save + re-render | < 100 ms |
| PWA install prompt | First paint | < 1 s |
| Memory footprint (idle) | Heap dopo 10 min su Home | < 250 MB |

I budget sono enforced da:
- **Bundle**: `rollup-plugin-visualizer` in CI; fallisce la build se main chunk > 300KB gzip
- **Runtime**: Web Vitals reporting via `core/logger` (no telemetry esterna, vedi D.A.1)
- **E2E**: Playwright in CI con tracing; soglie via `playwright.config.ts` `expect.toHavePerformanceTiming`

### 10.2 Dispositivi target

L'ottimizzazione è **mobile-first** (la maggioranza degli ascolti musicali avviene da mobile).

**Baseline** (target minimo garantito):
- iPhone 12 (A14, 4GB RAM, Safari iOS 15)
- Google Pixel 6 (Tensor, 8GB RAM, Chrome Android)
- Mid-range Android (Snapdragon 7-series, 6GB RAM, Chrome)

**Desktop**:
- 1080p+ (target primario)
- 1440p+ (layout esteso, contenuto centrato max 1400px vedi `15§10`)

**Limiti hardware**:
- IndexedDB quota: assume `navigator.storage.estimate()` > 1GB disponibile; degradare a read-only sotto soglia (`§5`)
- WebAssembly SIMD: opzionale, fallback scalare se non disponibile (Essentia.js)
- Touch target ≥ 44px (vedi `15§9` a11y)
- Connessione di rete: assume offline dopo primo load; enrichment richiede rete esplicita

## 11. App update management (PWA)

Le PWA richiedono un ciclo di aggiornamento **esplicito e controllato** perché l'utente non scarica attivamente: il Service Worker aggiorna la cache in background. Senza gestione, l'utente può restare bloccato su una versione vecchia (anche con cache buggate).

### 11.1 Version manifest

- L'app pubblica un `version.json` su `/version.json` con `{version, buildHash, releasedAt, minSchemaVersion}`
- Il client confronta a ogni boot; se `version` corrente > versione cached → update disponibile
- `minSchemaVersion` indica la **versione minima di `02-DATA-SCHEMA.md`** che il client sa gestire; se il DB locale ha `schemaVersion < minSchemaVersion`, l'utente **deve** aggiornare prima di continuare

### 11.2 Service Worker update lifecycle

Gestito da **Workbox** (`vite-plugin-pwa`):

1. **Install**: SW nuovo scarica i precached assets in `tempCache`
2. **Waiting**: SW nuovo aspetta che tutte le tab del SW vecchio siano chiuse
3. **Activate**: SW nuovo prende il controllo, pulisce `oldCaches`
4. **Clients claim**: il SW nuovo si annuncia via `clients.claim()` solo se la versione è **soft-compatible** (minor/patch); per major → attende chiusura tab

### 11.3 Prompt policy

| Tipo cambio | Comportamento |
|-------------|---------------|
| **Patch** (es. 1.0.0 → 1.0.1) | Auto-apply al prossimo boot, nessun prompt |
| **Minor** (es. 1.0.0 → 1.1.0) | Banner soft: "Nuova versione disponibile" con CTA "Aggiorna ora" / "Più tardi" |
| **Major** (es. 1.x → 2.x) | **Modal bloccante** se c'è una migrazione DB; altrimenti banner come minor |

Il prompt è gestito dall'hook `useAppUpdate()` in `@ls/web/hooks`, che ascolta `serviceWorker.controllerchange` e il custom event `ls:update-available`.

### 11.4 Migrazione DB tra versioni

Quando una nuova versione di `02-DATA-SCHEMA.md` viene rilasciata, il client:

1. Confronta `currentDbVersion` (letto da `db.verno`) con `expectedDbVersion` (build-time constant)
2. Se `currentDbVersion < expectedDbVersion`: esegue le funzioni di upgrade di Dexie (`02§7` MIG-1..4) in sequenza
3. Se l'upgrade fallisce: rollback all'ultima versione funzionante via SW + banner "Ripristino versione precedente" (solo per failure di migrazione, NON per failure di feature)

### 11.5 Cosa NON è qui

- Dettaglio implementativo di Workbox (vedi Story 0.5 + `12-DEVOPS.md`)
- Changelog UI / "What's new" (vedi Story dedicata, `11-BACKLOG.md` Story 6.2)
- Operazioni di manutenzione DB (vedi `§12`)

## 12. Database maintenance

Operazioni di manutenzione che il client deve supportare per garantire salute del DB locale nel tempo. Sono **non-bloccanti** per l'utente: girano in background, con throttling, e notifichino l'utente solo se rilevano problemi.

### 12.1 Operazioni standard

| Operazione | Quando | Cosa fa | Costo | Fase |
|------------|--------|---------|-------|------|
| `recount()` | Dopo ogni import + settimanale | Ricalcola `listenCount` denormalizzati su tracks/artists | O(n listens) | attivo (Story 0.2) |
| `rekey()` | Dopo enrichment con ISRC/MBID | Promuove `canonicalKey` da `fuzzy:` a `isrc:`/`mbid:`, unisce duplicati (transactional, sopravvivenza deterministica) | O(n tracks) | attivo (Story 1.4) |
| `orphanCleanup()` | Mensile | Rimuove `tracks`/`artists` non referenziati da `listens` né da `library` | O(n tracks) | futuro (Story 0.7) |
| `indexRebuild()` | Manuale + dopo migrazione | Ricostruisce indici Dexie se corrotti | Lock lungo | futuro (Story 0.7) |
| `fastCheck()` | Ad ogni boot (in dev/prod) | Smoke test: DB apribile, schema version corretto, indici funzionanti | < 100ms | futuro (Story 0.7) |
| `quotaCheck()` | Settimanale | `navigator.storage.estimate()` → warning se > 80% | < 50ms | futuro (Story 0.7) |
| `compact()` | Manuale (utente) | `IDBObjectStore` compaction se supportato | Variabile | futuro (Story 0.7) |

### 12.2 Scheduling

- **On-trigger**: `recount` e `rekey` dopo ogni import (transazione `02§7`) — `recount` attivo (Story 0.2), `rekey` attivo (Story 1.4)
- **Scheduled**: `orphanCleanup`, `quotaCheck` via Web Worker in `requestIdleCallback`, max 5 min/giorno (cumulativo con `§7.1`) — futuro (Story 0.7)
- **Manuale**: `indexRebuild`, `compact` da pulsante in Settings → "Manutenzione DB" (raro) — futuro (Story 0.7)
- **Boot**: `fastCheck` sempre; se fallisce, l'app entra in read-only mode (`§5`) — futuro (Story 0.7)

### 12.3 Health monitoring (no telemetry, D.A.1)

- I risultati di `fastCheck` / `quotaCheck` sono loggati in `core/logger` localmente
- L'utente vede un badge "Tutto ok" o un banner "Spazio in esaurimento" in Settings → Manutenzione
- Un contatore anonimo `lastMaintenance: { recount, rekey, orphan, fastCheck }` è mostrato all'utente per trasparenza
- **Nessun dato** viene inviato a server (coerente con ADR-0002)

### 12.4 Migrazioni schema (MIG-1..4)

Le migrazioni sono definite in `02-DATA-SCHEMA.md §7`. Regole di processo:

1. **Mai drop di tabelle utente** (MIG-1)
2. Ogni cambio schema = `db.version(n+1).stores({...}).upgrade(tx => ...)` con **funzione di upgrade testata** (vedi `10-TESTING.md §4`)
3. Le tabelle derivate (`sessions`, `insights`) sono **ricostruibili** con `recompute()` (MIG-2)
4. I parametri di analisi cambiano `derivedVersion` (MIG-3)
5. I contatori denormalizzati sono ricalcolabili con `recount()` (MIG-4)

Una migration che fallisce **non corrompe il DB**: la transazione Dexie fa rollback automatico. L'utente vede un banner "Aggiornamento DB non riuscito, ripristino versione precedente" (`11.4`).

### 12.5 Cosa NON è qui

- Backup cloud (non c'è cloud in MVP, vedi D.A.7)
- Sync DB (vedi ADR-0005, Fase 2)
- Operazioni di rete di qualsiasi tipo
- Implementazione dettagliata di `recount`/`rekey`/etc (vedi Story 0.2 + `10-TESTING.md`)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |
| 0.2 | Sessione 9 (2026-10-15) | Audit: §3 formato unificato riallineato a 02 (piatto, eventKey, day); §3.1 pipeline 6 step RawListenEvent→ListenEvent; §3.2 formula `eventKey`; §4 contratto esteso con `name`/`version`, `AbortSignal`, `AdapterError` con `recoverable` e `partialEvents`; §4 `detect(): boolean \| Promise<boolean>` (D.A.8); §5 allineato a Dexie v2 (12 tabelle); §5 + transazioni e read-only mode; §6 pipeline Essentia→AB→euristica (D.A.6); §6.1 trigger conditions (on-import/on-demand/scheduled); §6.2 caching policy (TTL, LRU, invalidazione); §7.1 scheduling 50ms chunk + incrementalità; §7.2 failure isolation; §7.3 versioning esplicito; §8 stack esteso: TS 5.6, Vite 6, Dexie 4, React Query 5, Tailwind 4, Recharts 2.15, D3 7, Tauri 2, Zod 3, react-hook-form, i18next, date-fns(-tz), Comlink 4, MSW, Playwright 1.5+, @vitest/coverage-v8, rollup-plugin-visualizer, core/logger; §8.1 tooling dev (ESLint 9 flat, Prettier 3, Husky, lint-staged, commitlint, TS strict); §9 + logger/ in core; §9.1 convenzioni package (`@ls/*`, exports map, lockfile unico); §9.2 regole acicliche (core/runtime-agnostic, ui solo tipi, web orchestra); §10 NFR rivisti (M13); §10.1 budget performance P95 per route; §10.2 dispositivi target (mobile-first, baseline iPhone 12/Pixel 6); §11 App update management (PWA) — version manifest, SW lifecycle Workbox, prompt policy patch/minor/major, migrazione DB tra versioni; §12 Database maintenance — recount/rekey/orphanCleanup/indexRebuild/fastCheck/quotaCheck/compact, scheduling, health monitoring locale, MIG-1..4; aggiunti fast-check, fake-indexeddb, Turborepo |
| 1.0 | Sessione 9 (2026-10-15) | 🟢 APPROVED · Promozione a versione vincolante dopo review completa di tutte le 12 sezioni con Boss. Sblocca story 0.1 `agent-ready` |
| 1.1 | Sessione 48 (2026-10-26) | **§4.1 Sorgenti remote (ADR-0010)**: il contratto `PlatformAdapter` era nato file-only — i tre adapter del perimetro e ListenBrainz consumano tutti un export scaricato dall'utente — ma Last.fm è la prima piattaforma senza export utilizzabile dall'app (l'unico canale è l'API `user.getRecentTracks`, paginata e autenticata). Aggiunto il metodo **opzionale** `parseRemote?(source: RemoteSource, options?): AsyncIterable<RawListenEvent>` e la struttura `RemoteSource` (endpoint, credenziali per-utente, paginazione, header extra, `AbortSignal`); `ParseOptions` estratto come tipo nominato. Vincoli: il percorso remoto produce gli stessi `RawListenEvent` del percorso file (pipeline di §3.1 riusata invariata), il rate limiting è responsabilità dell'adapter (ogni piattaforma ha limiti e semantica degli header diversi), il payload raw non è persistito, nessun segreto è embedded nel bundle, "sorgente irraggiungibile" è un errore recuperabile. Aggiunto il codice errore `SOURCE_UNREACHABLE` alla tabella degli `AdapterError` (gli altri quattro sono orientati al file e avrebbero mentito: `INVALID_FORMAT` non è un problema di formato). Nessuna modifica agli adapter esistenti: il metodo è opzionale e il loro comportamento non cambia |
| 1.2 | Sessione 53 (2026-10-26, issue #160) | **§12.1/§12.2**: `rekey()` da "futuro (Story 0.7)" a **attivo (Story 1.4)** — la funzione esisteva dalla Story 0.7 ma non soddisfava gli acceptance criteria della story (nessuna transazione, sopravvivenza non deterministica, riferimenti `library`/`playlistItems`/`features` non riorientati, ISRC non normalizzato, contatori sommati a mano invece che delegati a `recount()`). La Sessione 53 ne ha chiusi i buhi. Nessuna modifica al resto della sezione. *(Riga riportata nella tabella: nella Sessione 53 era stata appesa per errore in cima al file, fuori dalla tabella del changelog — riposizionata nella Sessione 56, issue #168)* |
| 1.3 | Sessione 56 (2026-10-27, issue #168) | **§4.2 Contratto di scrittura (`ScrobbleSink`, ADR-0011)**: il contratto di `§4` descrive la sola **lettura** (import da file o da sorgente remota). La Story 1.5 chiede l'operazione opposta — **inviare** i propri ascolti ai hub — e i due insiemi non coincidono (non ogni piattaforma scrobbla; `maloja`/`subsonic`/`roon` sono client, non fonti). Aggiunta la sottosezione "Contratto di scrittura (`ScrobbleSink`)": l'interfaccia `ScrobbleSink` (con `hub`, `name`, `version`, `isConfigured()`, `submit()`), il tipo dedicato `ScrobbleHubId`, i tipi `ScrobblePayload` e `ScrobbleResult`, e la classe `ScrobbleError` con i sei codici (`HUB_UNCONFIGURED`, `AUTH_INVALID`, `RATE_LIMITED`, `SOURCE_UNREACHABLE`, `PAYLOAD_REJECTED`, `HUB_ERROR`). Vincoli: il contratto è **separato** da quello di lettura ma ne riusa la forma (`PlatformAdapter` non cambia, nessun adapter esistente è toccato); il rate limiting è responsabilità del **sink** (Last.fm ~5 req/s, ListenBrainz 1 req/s con `X-RateLimit-*`); nessun segreto nel bundle e nessun server di backend (il proxy è dell'utente); `AbortSignal` per la cancellazione; `ScrobbleError` dedicato perché `recoverable` ha qui una semantica diversa ("si può ritentare lo stesso invio" e non "gli eventi validi sono persistiti"); `ScrobbleHubId` dedicato perché `scrobbleHubs` non è `PlatformId[]`; il payload è **chiuso per costruzione** (nessun campo per contesto, device o IP); l'idempotenza è locale e verificabile (chiave unica `hub|eventKey` sulla coda `scrobbleOutbox`, write-ahead). Il percorso incrementale ListenBrainz resta sul contratto di **lettura** (`parseRemote?()`) |
| 1.4 | Sessione 62 (2026-10-28, issue #187) | **§6 Pipeline di arricchimento** allineata alla spec `21-AUDIO-FEATURES.md` (v1.0 🟢 APPROVED): la fonte del preview audio per Essentia.js è dichiarata (**iTunes Search API**, D-AF.1: i preview di Spotify non esistono più per le app nuove e quelli di Apple Music costano 99 $/anno); i classification head sono **DEAM** con normalizzazione [1,9] → [0,1] (D-AF.3); AcousticBrainz fornisce classi `mood_*` e **non** `valence`/`energy`, che sono quindi **derivati** (D-AF.8); il fallback euristico **non alimenta il mood tracker** (D-AF.4): il layer di analisi legge solo `source ∈ {essentia, acousticbrainz, manual}`. **§9**: il modulo `enrichment/` è annotato come porte + orchestratore puri (**no React**: `§9.2` vieta React nel core, e React Query resta nel web — D-AF.5). **§8**: la riga delle audio features rimanda alla spec |
| 1.5 | Sessione 65 (2026-10-30, issue #193) | **§6 Pipeline di arricchimento** allineata all'emendamento della **D-A.6** ratificato dal project owner: il fallback **mood-by-genre non esiste**. Il punto 5 della cascata non dice più che "le analisi degradano a mood-by-genre" ma che le analisi basate su valence/energy **non producono insight** e che il mood tracker segnala la copertura mancante con un **warning aggregato per periodo** (`04§1.4`); la motivazione (la mappa genre→valence/energy non è ratificata in nessun documento: inventarla sarebbe il "segnale inventato" che la D-A.1 esclude) è dichiarata inline con il rimando a `04§11.1`. **§6.2**: la riga «Disattivazione» (toggle `enrichMetadata` spento) dice la stessa cosa — niente feature, niente insight — invece di citare il fallback inesistente. Il riferimento alla spec passa a `21-AUDIO-FEATURES.md` **v1.1**. Nessuna modifica alla pipeline del codice: il comportamento era già quello (D.63.4); la modifica è il **warning aggregato** |