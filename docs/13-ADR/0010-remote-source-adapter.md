# ADR-0010 — Sorgenti remote nel contratto degli adapter

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 49 (2026-10-26)
> Issue: #148 · Story: 1.3 (Adapter Last.fm + ListenBrainz)

## Contesto

`05-ARCHITECTURE.md` §4 definisce il contratto `PlatformAdapter`. Ogni adapter espone:

```typescript
interface PlatformAdapter {
  readonly platform: PlatformId;
  readonly name: string;
  readonly version: string;
  detect(input: File | Blob): boolean | Promise<boolean>;
  parse(input: File | Blob, options?: { signal?: AbortSignal }): AsyncIterable<RawListenEvent>;
  parseLibrary?(input: File | Blob): Promise<LibrarySnapshot>;
}
```

Il contratto è **file-only**: l'unico input è un `File` o un `Blob`. I quattro adapter esistenti (`spotify`, `youtube-music`, `apple-music`, e in arrivo `listenbrainz`) sono tutti conformi a questa forma, perché le tre piattaforme del perimetro e ListenBrainz offrono un **file** all'utente (export Takeout, export CSV, export JSON, archivio ZIP).

**Last.fm è la prima piattaforma che non ha un file.** La verifica fatta per la Story 1.3 (Sessione 47) ha stabilito che:

- Last.fm **non ha un export button** per gli scrobble. L'export GDPR esiste ma è una procedura **manuale e asincrona** (richiesta via form o email a `dp3@last.fm`, attesa di giorni) e la community segnala export **incompleti** (*"the dump didn't include my list of events"*).
- L'unico canale utilizzabile dall'app è l'API `user.getRecentTracks`, che è **paginata** (`page` + `limit` ≤ 200, con `@attr.total` / `@attr.totalPages`), **autenticata** (richiede una `api_key` per-app e, per gli utenti con *"Hide recent listening"* attivo, una `sk` di sessione) e **rate-limited** (limite non pubblicato, Client-side ~5 req/s).

Ne segue che l'adapter Last.fm non ha un `File | Blob` da passare a `parse()`: il suo input è una **sorgente remota** — endpoint, credenziali, parametri di paginazione, e un segnale di cancellazione.

Il problema è che **`05§4` è 🟢 APPROVED**: modificarlo richiede un ADR. È esattamente il caso che questo documento risolve.

### Perché il caso non è isolato

La Story 1.5 (scrobbling hub) prevede la **sync continua** verso ListenBrainz via `/1/user/{username}/listens` con cursore `max_ts`: anche quella è una sorgente remota, non un file. Senza un contratto che la copra, la 1.5 dovrebbe reimplementare da capo il canale di rete, o peggio introdurre un secondo contratto parallelo.

La forma del problema è quindi generale: **il progetto è passato da "import da file" a "import da sorgente"**, e il contratto degli adapter è rimasto fermo al primo caso.

## Decisione

**Estendere `PlatformAdapter` con un metodo opzionale `parseRemote?()`, che consuma una nuova struttura `RemoteSource`.** I quattro adapter esistenti restano intatti: il metodo è opzionale e semplicemente non esiste per loro.

```typescript
/**
 * Sorgente dati remota per gli adapter che non consumano un file.
 * L'adapter conosce il protocollo della piattaforma: il core fornisce
 * solo *dove* andare e *con cosa* autenticarsi.
 */
interface RemoteSource {
  /** URL base dell'API, o del proxy configurato dall'utente. */
  endpoint: string;
  /** Credenziali per-utente. Nessun segreto è mai embedded nel bundle. */
  credentials?: {
    /** Chiave API per-app (es. Last.fm `api_key`). */
    apiKey?: string;
    /** Chiave di sessione (es. Last.fm `sk` dal web auth). */
    sessionKey?: string;
  };
  /** Parametri di paginazione, se la piattaforma li supporta. */
  pagination?: {
    /** Massimo elementi per richiesta. */
    limit?: number;
    /** Finestra temporale iniziale (unix secondi UTC). */
    from?: number;
    /** Finestra temporale finale (unix secondi UTC). */
    to?: number;
  };
  /** Header HTTP aggiuntivi (es. User-Agent obbligatorio su ListenBrainz). */
  headers?: Record<string, string>;
  /** Cancellazione cooperativa dell'import. */
  signal?: AbortSignal;
}

interface PlatformAdapter {
  readonly platform: PlatformId;
  readonly name: string;
  readonly version: string;
  detect(input: File | Blob): boolean | Promise<boolean>;
  parse(input: File | Blob, options?: ParseOptions): AsyncIterable<RawListenEvent>;
  parseLibrary?(input: File | Blob): Promise<LibrarySnapshot>;
  /**
   * Presente SOLO negli adapter con sorgente remota.
   * Produce gli stessi RawListenEvent del percorso file: la pipeline
   * di normalizzazione è riusata invariata.
   */
  parseRemote?(source: RemoteSource, options?: ParseOptions): AsyncIterable<RawListenEvent>;
}

/** Opzioni condivise dai due percorsi di parsing. */
interface ParseOptions {
  /** Cancellazione cooperativa. */
  signal?: AbortSignal;
}
```

### I vincoli che l'ADR fissa

| # | Vincolo | Perché |
|---|---------|--------|
| **V1** | `parseRemote?` è **opzionale**: gli adapter file-only non lo implementano | I quattro adapter esistenti restano intatti, senza modifiche |
| **V2** | Il percorso remoto produce **gli stessi `RawListenEvent`** del percorso file | La pipeline, la dedup e il DB non distinguono le origini: un import da API e uno da file producono lo stesso `ListenEvent` |
| **V3** | Il payload raw **non** è persistito | Vale per le sorgenti remote come per i file (ADR-0003): il DB locale non immagazzina 200k payload |
| **V4** | Nessun segreto embedded nel bundle | `api_key` e `sk` sono **per-utente** (ToS Last.fm §4.4: i limiti possono includere *"the number of users you may serve"*; §2.6: *"the most recent user authentication key provided to You by Last.fm"*) |
| **V5** | Nessun server di backend | ADR-0002 (local-first): il proxy è **di fiducia dell'utente**, configurato da lui; il progetto non ne gestisce uno |
| **V6** | `AbortSignal` per la cancellazione cooperativa | Un import Last.fm è un **job lungo** (1-15 minuti su uno storico medio): deve poter essere interrotto. Coerente con `05§4` |
| **V7** | Il **rate limiting è responsabilità dell'adapter**, non del core | Le piattaforme hanno limiti diversi (Last.fm ~5 req/s non pubblicato, ListenBrainz 1 req/s) e semantica degli header diversa (`X-RateLimit-*`): la conoscenza del protocollo resta nell'adapter |
| **V8** | "Sorgente non disponibile" è un errore **recuperabile** | Proxy assente o non raggiungibile → `recoverable: true` con `partialEvents`, non un errore fatale che fa perdere il lavoro già fatto |

### Decisioni accessorie già prese (Boss, Sessione 47)

| # | Decisione | Contenuto |
|---|-----------|-----------|
| **D-LF.0** | Proxy CORS | Base URL del proxy in Settings, default stringa vuota. Senza proxy la card Last.fm è `disabled` e **zero richieste** vengono fatte. Nessun proxy fornito dal progetto |
| **D-LF.1** | `api_key` per-utente | L'utente registra la propria key Last.fm; non è mai embedded nel bundle (V4) |
| **D-LF.2** | `sk` via web auth | Flusso `last.fm/api/auth?cb=<route-app>` → `auth.getSession`. La callback è una route della PWA: nessun backend |
| **D-LF.8** | Metodo opzionale, non interfaccia separata | Decisione che questo ADR formalizza |

## Motivazioni

- **Un solo contratto, non due.** Il factory degli adapter (`adapters/index.ts`) resta a un tipo solo, la catena di registrazione non si sdoppia, la UI di onboarding non distingue "adapter file" da "adapter remoto". Un'interfaccia `RemotePlatformAdapter` separata costerebbe due contratti da mantenere per un solo caso d'uso reale.
- **Il percorso file resta il caso primario.** `parse()` resta il metodo che il 95% degli import usa; il metodo opzionale è un'aggiunta, non una riscrittura. I quattro adapter esistenti non vengono toccati: **nessuna regressione possibile** sul perimetro già consegnato.
- **La pipeline non si duplica.** V2 è la conseguenza più importante: un import da Last.fm e un import da Spotify passano attraverso **lo stesso** codice di normalizzazione, dedup e persistenza. Il rischio di due implementazioni divergenti della normalizzazione (timestamp, `eventKey`, DEDUP) è la classe di bug più costosa del progetto.
- **Il protocollo resta nell'adapter.** V7: l'adapter conosce il rate limit della sua piattaforma, il formato del suo errore, il suo schema di paginazione. Il core conosce solo `RawListenEvent`. È la stessa separazione che `ADR-0003` (adapter pattern) ha fissato per i file.
- **La privacy non si sposta.** V4 e V5 mantengono le due promesse già scritte in `09-PRIVACY-SECURITY.md` §3.2 e in ADR-0002: nessun segreto nel bundle, nessun backend gestito dal progetto. Il proxy è del utente, con i suoi log.

## Alternative considerate

| # | Alternativa | Esito | Motivo |
|---|-------------|-------|--------|
| **A1** | Interfaccia `RemotePlatformAdapter` separata | ❌ scartata | Due contratti da mantenere in coesistenza nel core per un solo caso d'uso reale. Il factory si sdoppia, la UI di onboarding deve trattare due tipi di adapter, e il rischio di divergenza fra le due pipeline di normalizzazione è reale |
| **A2** | Estendere `parse()` con input union (`Blob \| RemoteSource`) | ❌ scartata | `parse()` ha oggi una semantica chiara: "leggi un file". Un input union rende il contratto ambiguo, e `detect()` non ha un equivalente naturale per una sorgente remota (non si "rileva" un'API: la si *configura*) |
| **A3** | Adapter "HTTP generico" con mapper JSON→schema per piattaforma | ❌ scartata | Sposta la logica di piattaforma fuori dall'adapter, contro `ADR-0003` (*"ogni piattaforma è un adapter indipendente"*). Un mapper generico richiederebbe un vocabolario di campi cross-piattaforma che il progetto non ha né vuole |
| **A4** | Materializzare le risposte API in un `Blob` e passarlo a `parse()` | ❌ scartata | Perde cancellazione, streaming e rate limiting; per 100k scrobble significa un buffer intermedio enorme in memoria — esattamente ciò che `05§4` vieta (*"mai caricare 200k eventi in memoria in un colpo"*) |
| **A5** | Server di backend che faccia da proxy per tutti gli utenti | ❌ scartata | Contraddice ADR-0002 (local-first) e i ToS Last.fm §4.4 (una key che serve N utenti è il caso sanzionato). Introduce un costo operativo e un punto di single-point-of-failure per un progetto open source senza ricavi |
| **A6** | Estendere la `PlatformAdapter` con **tutti** i casi (libreria, playlist, sync) in un colpo | ⚠️ **scartata per ora** | Sarebbe la risposta "completa", ma `parseLibrary?` da sorgente remota e la sync incrementale hanno semantica propria. L'ADR fissa **il minimo necessario** per sbloccare la 1.3; l'estensione a libreria e playlist resta un punto aperto (vedi sotto) |
| **A7** | Nessuna estensione: la 1.3 importa Last.fm **solo via file** (export GDPR caricato a mano) | ⚠️ **fallback operativo** | Tecnicamente possibile e già previsto come percorso file della spec Last.fm, ma abbandona l'import in-app e rende l'API inutilizzabile. È il fallback se il Boss rifiuta l'estensione del contratto |

## Conseguenze

- **Positive**:
  - La Story 1.3 diventa implementabile: l'adapter Last.fm ha un contratto su cui scrivere
  - La Story 1.5 (sync continua ListenBrainz) eredita lo stesso contratto, senza un secondo canale di rete
  - Nessuna modifica ai quattro adapter esistenti (V1) e alla pipeline (V2): **rischio di regressione sulle story già consegnate = zero**
  - Il percorso file resta il default: il comportamento dell'app per le piattaforme già supportate non cambia
- **Negative**:
  - `05§4` cresce di un metodo, di un tipo (`RemoteSource`) e di una sottosezione: il contratto degli adapter non è più "solo file", e la semantica di `parse()` va riletta da chi lo legge
  - `ParseOptions` viene estratto come tipo nominato: refactor puramente cosmetico, ma tocca la firma di `parse()` in tutti i punti di chiamata (la compatibilità strutturale di TypeScript li mantiene compatibili)
  - Nasce una classe di errori specifica: "sorgente remota non raggiungibile" è diversa da "file malformato". Va deciso se `AdapterError` basta o se serve un codice dedicato (punto aperto 2)
  - Il percorso API è un **operatore di rete**: l'app ha bisogno di gestire timeout, DNS fallito, proxy che risponde ma con HTML invece di JSON, rate limit non dichiarato. È un surface di test e di gestione errori che i quattro adapter file-only non hanno avuto
- **Mitigazioni**:
  - V8 (errore recuperabile) evita che un proxy rotto faccia perdere un import parziale
  - La spec `03-ADAPTERS/lastfm.md` (§10) fissa il rate limiter, il backoff e la gestione degli errori
  - Il percorso file della spec Last.fm resta disponibile: se il percorso API non funziona per l'utente, l'import **file** copre lo stesso storico

## Punti aperti

1. ~~**Codice errore dedicato per "sorgente non raggiungibile"**~~ — **risolto dalla ratifica (Sessione 49)**: `SOURCE_UNREACHABLE` con `recoverable: true` entra nel contratto ed è a `05§4` nella tabella degli `AdapterError`. La motivazione resta quella dichiarata: gli altri quattro codici sono orientati al file, e riusare `INVALID_FORMAT` per un proxy irraggiungibile avrebbe dato all'utente una remediation sbagliata (correggere il file invece di configurare il proxy).
2. **`parseLibrary?` da sorgente remota.** Lo stesso percorso che ha prodotto `parseRemote?` potrebbe servire per la libreria salvata di una piattaforma remota. L'ADR **non** lo estende: l'unico caso reale noto (Last.fm) non ha una libreria nell'API, e la 1.5 non la richiede. Si estende quando emerge un caso reale, non prima (A6).
3. **Refresh del token OAuth.** ListenBrainz User Token e Last.fm `sk` hanno durate diverse; il `sk` dura finché l'utente non revoca, il token LB è revocabile in qualsiasi momento. Il refresh automatico richiederebbe di conservare un **refresh token** — che è un segreto di lunga durata. L'ADR presuppone che il rinnovo sia **manuale** (l'utente riapre le Impostazioni), coerente con `09-PRIVACY-SECURITY.md` §3.2. Va confermato quando la 1.5 specificherà il percorso incrementale.
4. **Verifica end-to-end del percorso API.** L'ADR definisce il contratto, non il trasporto. Quale client HTTP usare (`fetch` nativo?), come gestire i redirect, come impostare i timeout, e se il bundle PWA può fare richieste con header custom attraverso un proxy CORS (CORS *preflight* con `Authorization` richiede che il proxy risponda correttamente a `OPTIONS`) sono dettagli della spec `03-ADAPTERS/lastfm.md` e della Story 1.3.

## Collegamenti

- `ADR-0002` local-first (nessun backend, nessuna egress dei dati dell'utente)
- `ADR-0003` adapter pattern (un adapter per piattaforma, normalizzazione nel core)
- `05-ARCHITECTURE.md` §3.1 (trasformazione adapter → core), §4 (contratto, da estendere con la sottosezione "Sorgenti remote")
- `02-DATA-SCHEMA.md` §3.2 (`ListenEvent`), §5 (DEDUP)
- `09-PRIVACY-SECURITY.md` §3.2 (cosa non esce dal dispositivo), §4 (inventario dati personali)
- `01-PLATFORMS.md` §3.7 (Last.fm), §4 (tabella limiti piattaforme)
- `03-ADAPTERS/lastfm.md` — la spec che consuma questo contratto (issue #144)
- `11-BACKLOG.md` §Story 1.3, §Story 1.5
- Issue #148 (questo ADR), issue #144 (spec Last.fm)

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 48 (2026-10-26) | Prima stesura (issue #148). Formalizza la decisione D-LF.8 del Boss (Sessione 47): metodo opzionale `parseRemote?()` su `PlatformAdapter` con la struttura `RemoteSource`. Fissa i vincoli V1-V8, le alternative A1-A7 e quattro punti aperti |
| 1.0 | Sessione 49 (2026-10-26) | 🟢 APPROVED · ratifica del Boss al merge della PR #152 (`1b2d280`) — nessuna modifica di contenuto. **Ratificato anche il punto aperto 1**: il codice errore `SOURCE_UNREACHABLE` con `recoverable: true` entra nel contratto (`05§4`), insieme alla sua riga nella tabella degli `AdapterError` |
