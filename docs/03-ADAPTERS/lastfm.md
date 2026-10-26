# Adapter Last.fm

> Status: 🟢 APPROVED · Versione 1.0 · Ultima modifica: Sessione 51 (2026-10-26)
> Piattaforma: Last.fm (Audioscrobbler / FM3)
> Sede legale: UK (Bournemouth)
> Tier: **S** (hub di scrobbling) · Priorità MVP: **sì**
> Spec collegata a: Story 1.3 (`11-BACKLOG.md`), `01-PLATFORMS.md` §3.7, `13-ADR/0010-remote-source-adapter.md`

---

## 1. Metodi di accesso

Last.fm è la prima piattaforma del perimetro **senza un export utilizzabile dall'app**:

- **Non esiste un export button** per gli scrobble. La pagina di supporto ufficiale rimanda a *strumenti di terze parti* che leggono la stessa API.
- L'**export GDPR** esiste ma è una procedura **manuale e asincrona**: richiesta via form o email a `dp3@last.fm`, attesa di giorni, e la community segnala export **incompleti** (*"the dump didn't include my list of events"*).
- Il GDPR export richiede inoltre di disattivare *"Hide recent listening information"* — cioè **degradare la privacy dell'utente** per ottenere il file.

L'unico canale dell'app è quindi l'API, e l'API **non emette header CORS**: da una PWA browser la `fetch` cross-origin verrebbe bloccata.

| Canale | Disponibile | Formato output | Frequenza | Note |
|---------|:-----------:|----------------|-----------|------|
| **API `user.getRecentTracks`** (via proxy CORS) | ✅ | JSON | Continua | Unica via per import in-app. **Richiede CORS** → proxy configurato dall'utente (D-LF.0) |
| **File export CSV/JSON** (strumenti di terze parti) | ✅ | CSV / JSON | Manuale | Percorso **senza proxy**, per utenti che non vogliono o non possono esporre un proxy. Generato da `lastfm.ghan.nl/export` o `benjaminbenben.com/lastfm-to-csv` |
| **Web API sessione (`sk`)** | ✅ | JSON | Continua | Necessaria **solo** per gli utenti con *"Hide recent listening information"* attivo (D-LF.2) |
| **Export nativo Last.fm** | ❌ | — | — | Non esiste. L'export GDPR è manuale, asincrono e incompleto |

### Il percorso API in dettaglio

`GET https://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=<username>&api_key=<key>&format=json&limit=200&page=<n>&extended=1`

| Parametro | Tipo | Default | Note |
|-----------|------|---------|------|
| `user` | string | — | **obbligatorio**: il nome utente Last.fm |
| `api_key` | string | — | **obbligatorio**: chiave per-app, **per-utente** (D-LF.1) |
| `limit` | number | 50 | **max 200** secondo la doc ufficiale; la doc non ufficiale indica 1000 ma il limite **documentato e oneroso** è 200 — la spec usa 200 |
| `page` | number | 1 | 1-based |
| `from` / `to` | number | — | Finestra temporale in **UNIX secondi UTC** (intero). `from` = "dopo questo istante", `to` = "prima di questo istante" |
| `extended` | 0\|1 | 0 | `1` aggiunge `mbid` su artista/album/brano e il flag `loved` |
| `format` | string | xml | `json` |
| `sk` | string | — | Solo con D-LF.2 (sessione web) |
| `api_sig` | string | — | Solo con D-LF.2 (richiede il **shared secret** — vedi §2.2) |

**Risposta** (struttura reale, `extended=1`):

```json
{
  "recenttracks": {
    "@attr": { "user": "…", "page": "1", "perPage": "200", "total": "94618", "totalPages": "474" },
    "track": [
      {
        "@attr": { "nowplaying": "true" },
        "artist": { "mbid": "63aa26c3-…", "#text": "Tame Impala", "name": "Tame Impala", "url": "…" },
        "album":  { "mbid": "0d2cb66c-…", "#text": "Lonerism" },
        "name": "Apocalypse Dreams",
        "mbid": "08b8e930-…",
        "loved": "0",
        "date": { "uts": "1603186824", "#text": "20 Oct 2020, 09:40" },
        "url": "…", "streamable": "0", "image": [ { "size": "large", "#text": "…" } ]
      }
    ]
  }
}
```

Caratteristiche decisive della risposta:

- `@attr.total` = numero **totale** di scrobble; `@attr.totalPages` = pagine a `perPage` corrente. Con `total: 94618` e `perPage: 200` → `totalPages: 474`. **La paginazione non va oltre `totalPages`**: oltre, la risposta è un array vuoto
- I campi **`#text`** sono la forma JSON del testo semplice del formato XML: `artist["#text"]`, `album["#text"]`, `date["#text"]`
- **`mbid`** compare solo con `extended=1`, ed è **frequentemente vuoto** (stringa `""`): la copertura MBID su Last.fm è parziale
- **`loved`** (`"0"`/`"1"`) compare solo con `extended=1`
- **`image[]`** contiene URL delle copertine: **non persistiti** (l'artwork si risolve via MusicBrainz in Story 4.3)
- Il campo `date` **manca** per il brano in riproduzione (`nowplaying`), che è per l'app un evento non ancora scrobbblato

### CORS: il vincolo che definisce l'architettura

L'API Last.fm **non emette `Access-Control-Allow-Origin`**. Da una PWA browser la `fetch` cross-origin verso `ws.audioscrobbler.com` viene bloccata dal browser, e nessun HEADER custom può aggirarlo (i semplici header non scatenano preflight, ma la risposta deve comunque avere `ACAO`).

Da qui **D-LF.0**: il proxy è un **base URL configurato dall'utente** in Settings, e l'app non ne gestisce nessuno (ADR-0002, local-first).

## 2. Flusso di import

### 2.1 Percorso API (via proxy)

```
[1] Settings: l'utente inserisce proxy URL, api_key, username
[2] detect(): nessuna chiamata — la Last.fm card è enabled se proxy+key+username sono valorizzati
[3] parseRemote(): GET <proxy>/2.0/?method=user.getRecentTracks&...&limit=200&page=1
[4] legge @attr.total / @attr.totalPages
[5] per page = 2..totalPages: GET ...&page=<n>   (token bucket 5 req/s, backoff su 11/16/29/429/5xx)
[6] ogni risposta: filtra nowplaying, mappa a RawListenEvent, yields
[7] scrive in chunk (partial recovery 05§4)
```

**Il proxy non è un componente dell'app**: è un servizio (self-hosted o di terze parti) che l'utente configura. L'app non ne fa il deployment, non lo monitora, non lo conosce. Il proxy **è di fiducia dell'utente** (D-LF.0): vede le richieste che l'utente stesso sta facendo verso Last.fm.

**Il proxy riceve l'`api_key` dell'utente** nelle query string: è l'utente che decide a chi affidare la propria key. Il progetto non la vede e non la intermediarizza.

### 2.2 Percorso web auth (D-LF.2) — solo per "Hide recent listening"

Il flusso documentato da Last.fm (Desktop Auth), adattato a PWA:

```
[1] l'utente ha la propria API key E il proprio shared secret
[2] GET auth.getToken?api_key=…&api_sig=md5(…)          -> token (monouso, 60 min)
[3] redirect browser a last.fm/api/auth/?api_key=…&token=…
[4] l'utente autorizza -> redirect a <callback-url>?token=…
[5] la route callback della PWA intercetta il token
[6] GET auth.getSession?api_key=…&token=…&api_sig=…      -> sk (durata illimitata, revocabile dall'utente)
[7] sk in storage locale; da qui le chiamate user.getRecentTracks portano sk + api_key + api_sig
```

**Vincoli verificati**:

- Il token di autorizzazione è **monouso**: *"You can only use an authentication token once. It will be consumed when creating your web service session."*
- La `sk` ha **durata illimitata** ma l'utente può revocarla dalle impostazioni Last.fm → l'adapter deve degradare con errore 9/4 e guida, **mai** loop di retry
- `api_sig` = `md5(parametri ordinati alfabeticamente + shared secret)` — **richiede il shared secret**, non basta la `api_key`
- Il callback URL va registrato **nell'account API dell'utente** al momento della registrazione della key

**Conseguenza di progetto**: il percorso web auth richiede che l'utente inserisca **sia** `api_key` **che** shared secret. Sono due segreti, non uno. Entrambi restano in storage locale e **mai** nel bundle (V4 di ADR-0010).

### 2.3 Percorso file (senza proxy)

L'utente genera l'export con uno strumento esterno e lo carica nell'app. Due formati osservati sul campo:

| Formato | Origine | Colonne |
|---------|---------|---------|
| **CSV ghan.nl** | `lastfm.ghan.nl/export` (Type: Scrobbles, Format: CSV) | header + 8 colonne: `uts`, `utc_time`, `artist`, `album`, `track`, `artist_mbid`, `album_mbid`, `track_mbid` |
| **CSV lastfm-to-csv** | `benjaminbenben.com/lastfm-to-csv` | **senza header**, 4 colonne: `artist`, `album`, `track`, `date` (data al **minuto**, UTC) |
| **JSON** | export JSON dei tool ghan.nl | wrapper con gli stessi campi del CSV ghan.nl |

Differenze che contano:

- I tool ghan.nl **ommettono** il brano in riproduzione (che non ha ancora un timestamp); `lastfm-to-csv` invece lo include **senza data** → va trattato come E.LF.9
- `lastfm-to-csv` ha risoluzione **al minuto**: gli scrobble dello stesso minuto sono indistinguibili
- I file sono **UTF-8**, con quoting CSV standard
- L'ordine è **dal più recente al più vecchio** (tool ghan.nl)

**Rilevamento** (statico, nessuna rete): il file è CSV se la prima riga è un header riconoscibile (`uts`/`utc_time`/`artist`/`track`) oppure se ha 4 colonne con l'ultima che **matcha** il formato data `DD MMM YYYY HH:mm`. JSON se la prima riga è un oggetto JSON.

## 3. Mapping campi sorgente → unificato

> **Schema di riferimento**: `02-DATA-SCHEMA.md` v1.1 — `ListenEvent` **piatto** con `trackId` come FK; i metadati del brano vivono sull'entità `Track` separata.
>
> **Semantica temporale**: `date.uts` è l'**inizio** dello scrobble (confermato da `track.scrobble`: `timestamp` = *"The time the track started playing"*), coerente con `02§2`. La durata **non è disponibile** in `getRecentTracks` (il campo `duration` esiste solo in `track.getInfo`, una chiamata per brano — incompatibile con 50k+ scrobble). D-LF.4 impone la semantica uniforme `timestamp = startedAt`.

### 3.1 ListenEvent (top-level, piatto — vedi `02§3.2`)

| Campo unificato | Sorgente API | Sorgente file (ghan.nl) | Sorgente file (lastfm-to-csv) | Note |
|-----------------|--------------|-------------------------|------------------------------|------|
| `eventKey` | `lastfm:<minute>\|<mbid ?? name\|artist>` | idem | idem | **D-LF.7**: normalizzato al **minuto** su tutti i percorsi |
| `platform` | (fisso) | (fisso) | (fisso) | `'lastfm'` |
| `importId` | (interno) | (interno) | (interno) | FK a `imports` |
| `timestamp` | `date.uts * 1000` | `uts * 1000` | `date` → epoch minute | **D-LF.4**: inizio ascolto |
| `startedAt` | `date.uts * 1000` | `uts * 1000` | `date` → epoch minute | Non distinguibile da `timestamp` (stesso predecessente di E.YT.5) |
| `durationMs` | `0` | `0` | `0` | Costante: durata non disponibile |
| `trackId` | (interno) | (interno) | (interno) | Risolto dal core via DEDUP |
| `completed` | `false` | `false` | `false` | Costante: nessun dato di durata da cui derivarlo |
| `skipped` | `null` | `null` | `null` | Nessun dato. **Non dedurre `skipped` da `durationMs = 0`** |
| `shuffle` | `null` | `null` | `null` | Assente |
| `offline` | `null` | `null` | `null` | Assente |
| `incognito` | `null` | `null` | `null` | Assente |
| `reasonStart` | `null` | `null` | `null` | Assente |
| `reasonEnd` | `null` | `null` | `null` | Assente |
| `deviceType` | `'unknown'` | `'unknown'` | `'unknown'` | Last.fm non espone il client che ha scrobbato |
| `deviceDetail` | `null` | `null` | `null` | — |
| `ip` | `null` | `null` | `null` | L'API non restituisce l'IP. Il toggle `retainIp` **non è applicabile** (niente da conservare) |
| `country` | `null` | `null` | `null` | Nessun campo paese e nessun IP → nessuna derivazione possibile |
| `day` | (derivato) | (derivato) | (derivato) | `YYYY-MM-DD` UTC, da `timestamp` |

**Campi del payload mai persistiti**: `image[]` (URL copertine → artwork via MusicBrainz in Story 4.3), `url` (pagina del brano su Last.fm → `sourceTrackUri`), `streamable`, `loved` (nessun campo "loved" nel modello `02§3.3`), `artist.url`, `artist.image[]`, `album.mbid` (l'MBID dell'album non ha un campo dedicato: `Album.mbid` non esiste in `02§3.3`), `date["#text"]` (redundante con `uts`), `@attr.user` (identifica l'account, non l'ascolto).

### 3.1.1 Track (entità separata — vedi `02§3.3`)

| Campo Track | Sorgente API | Sorgente file | Note |
|-------------|--------------|--------------|------|
| `name` | `name` | `track` | `normalize()` (`02§5`); vuota → **skip evento** con warning (E.LF.9) |
| `artistId` | `artist["#text"]` | `artist` | Risolto da `artists` (dedup per nome normalizzato) |
| `albumId` | `album["#text"]` | `album` | Risolto da `albums`; null se assente o vuota |
| `durationMs` | `null` | `null` | Non disponibile su Last.fm |
| `isrc` | `null` | `null` | Last.fm non espone ISRC |
| `mbid` | `mbid` del brano (con `extended=1`) | `track_mbid` (ghan.nl) | **DEDUP-2** quando presente. Last.fm lo espone **frequentemente vuoto**: copertura parziale |
| `genres` | `[]` | `[]` | Nessun genere nativo |
| `artworkUrl` | `null` | `null` | `image[]` scartata → artwork via MusicBrainz (Story 4.3) |
| `platformIds` | `{ lastfm: <url pagina brano> }` | `{}` | `sourceTrackUri` = `url` della risposta API; la convenzione "ultimo segmento" di `05§3.1.2` non si applica (è un URL, non un id) |

### 3.1.2 Artist / Album (entità separate — vedi `02§3.3`)

L'adapter emette `{name, mbid?}` per Artist e `{name, artistId, mbid: null, platformIds: {}}` per Album. Il core fa upsert con dedup per nome normalizzato (Artist) o nome+artistId (Album).

- `artist.mbid` (con `extended=1`) → `Artist.mbid`: **attivo e utile**, più affidabile del mbid del brano
- `album.mbid` → scartato: `02§3.3` non ha un campo MBID per l'album. Dichiarato qui perché è una perdita di informazione deliberata, non un oversight
- **Artista multi-artista**: Last.fm espone `artist` come **stringa singola** già joinata dal client di scrobbling ("A & B", "A feat. B", "A, B"). Stessa regola di ListenBrainz (`03-ADAPTERS/listenbrainz.md` §3.1.2): **nessuna divisione** — dividere per `&` produrrebbe artisti fantasma e frammenterebbe la dedup. Il `normalize()` di `02§5` rimuove `feat./ft./with`, quindi "A feat. B" e "A" collassano sulla stessa chiave: comportamento **desiderato** (è lo stesso brano)

### 3.2 Library / Playlist (vedi `02§3.7`)

**Fuori scope adapter MVP**:

| Entità | Sorgente | Blocco |
|--------|----------|--------|
| LibraryItem `saved_track` | `loved` (con `extended=1`) | L'API espone il flag `loved`, ma `02§3.3` non ha un campo "loved" e non c'è un endpoint `user.getLovedTracks` per la 1.3. Dichiarato come gap (§4 E.LF.17) |
| Playlist / PlaylistItem | — | Nessun endpoint per playlist nello scope |

Segnalazione: `info.libraryDeferred`.

### 3.3 Filtro eventi

```
isCandidateRow(r):
  1. r["@attr"].nowplaying === "true"        -> scartato (nessun date, E.LF.1)
  2. r.date assente (o date.uts assente)     -> scartato + warning noDateSkipped (E.LF.9)
  3. r.name assente o vuota                  -> scartato + warning noTitleSkipped
  4. r["artist"]["#text"] assente o vuota    -> scartato + warning noArtistSkipped
  5. altrimenti                              -> ListenEvent
```

Il punto 4 è specifico di Last.fm: l'API espone l'artista come oggetto `{mbid, #text}` e con `extended=0` il campo è una **stringa semplice**, non un oggetto. L'adapter deve gestire **entrambe le forme** (E.LF.14).

## 4. Edge case noti

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E.LF.1 | `@attr.nowplaying === "true"` — il brano in riproduzione, **senza `date`** | Uno scrobble inesistente | Scartato. L'import ricomincia al prossimo avvio |
| E.LF.2 | `@attr.total` > `totalPages` effettivamente disponibili | Loop infinito su pagine vuote | Stop pulito a `totalPages`; warning se `totalPages` non torna |
| E.LF.3 | Lo stesso scrobble a cavallo di due pagine | Evento duplicato | Dedup per `eventKey` (il core) |
| E.LF.4 | `date.uts` identico per scrobble diversi (possibile: stessa seconda) | Collisione | `eventKey` con `mbid ?? name\|artist` disambigua |
| E.LF.5 | `mbid` del brano vuoto (frequente su Last.fm) | DEDUP-2 non raggiungibile | Degrado a DEDUP-3, warning aggregato (non per-riga) |
| E.LF.6 | Errore 6 (parametri invalidi) / 8 (operazione fallita) | Import non possibile | `AdapterError` non recuperabile + guida all'utente |
| E.LF.7 | Proxy assente o URL non valido | Il percorso API non è utilizzabile | Card Last.fm `disabled` in Settings; **zero richieste**; il percorso **file** resta disponibile |
| E.LF.8 | Proxy che restituisce HTML invece di JSON (è una pagina d'errore, non un proxy) | Crash del parser JSON | `AdapterError` `SOURCE_UNREACHABLE` + messaggio che distingue "proxy rotto" da "API non raggiungibile" |
| E.LF.9 | Scrobble con `name` / `artist["#text"]` vuoti | Evento senza identità | Scartato con warning per-categoria (`noTitleSkipped` / `noArtistSkipped` / `noDateSkipped`) |
| E.LF.10 | Cambio di schema fra pagine (`extended=1` che espone `artist` come oggetto, `extended=0` come stringa) | Crash di parsing | L'adapter gestisce **entrambe** le forme di `artist` e `album` (E.LF.14) |
| E.LF.11 | **"Hide recent listening information"** attivo sulla privacy Last.fm | 0 scrobble pubblici | Messaggio esplicito che inviti al web auth (D-LF.2), non un errore generico. Con `sk` (D-LF.2) l'utente vede i propri scrobble |
| E.LF.12 | `sk` revocata dall'utente nelle impostazioni Last.fm (errore 9) | Le chiamate autenticate falliscono | `AdapterError` non recuperabile + guida a revocare e riautenticare. **Mai** loop di retry su `401`/errore 9 |
| E.LF.13 | `api_key` non valida (errore 10) o sospesa (errore 26) | Tutte le chiamate falliscono | Guida a registrarne una propria (D-LF.1). Errore 26 = key sospesa da Last.fm, non colpa dell'utente |
| E.LF.14 | `artist` come **stringa** (senza `extended=1`) vs **oggetto** (con `extended=1`) | Crash di parsing su `artist["#text"]` | L'adapter normalizza entrambe le forme in un accessor unico |
| E.LF.15 | Import interrotto a metà (chiusura tab, rete caduta) | Perdita del lavoro in corso | `partialEvents` persistiti (partial recovery `05§4`); re-import con `from`/`to` completa senza duplicati |
| E.LF.16 | **Percorso file**: `lastfm-to-csv` (4 colonne, data al minuto) vs ghan.nl (8 colonne, `uts` al secondo) | Lo stesso scrobble ha timestamp diversi | `eventKey` normalizzato al **minuto** su tutti i percorsi (D-LF.7) → re-import misto non duplica. Perdita: due scrobble dello stesso brano nello stesso minuto si fondono |
| E.LF.17 | `loved` disponibile con `extended=1` ma nessun campo "loved" nel modello | Informazione persa | Scartato, warning `info.libraryDeferred`. Gap dichiarato, non silenzioso |
| E.LF.18 | **Percorso file**: `lastfm-to-csv` include il brano in riproduzione **senza data** (le ultime 4 colonne non hanno data) | Ultima riga senza timestamp | Rilevata come "prima riga senza data finale" → scartata con `noDateSkipped`, non letta come record malformato |
| E.LF.19 | Lo stesso scrobble importato via API e via file in momenti diversi | Due eventi per uno stesso scrobble | Stessa `eventKey` (D-LF.7) → il core deduplica. La **prima** importazione vince: i dati dell'API sono più ricchi (mbid, artist.mbid) |
| E.LF.20 | **Percorso file**: CSV con BOM UTF-8 iniziale | Il primo header non è riconoscibile → `detect` ko | L'adapter **rimuove il BOM** prima del rilevamento (stesso trattamento del parser CSV di Apple Music) |
| E.LF.21 | **Percorso web auth**: `api_sig` richiede `md5(parametri + shared secret)` | Il repo espone solo SHA-1/SHA-256 via Web Crypto, che non supportano md5 | Il percorso API **senza** `sk` (D-LF.1) non richiede firma e funziona subito. Il percorso web auth (D-LF.2) è implementato nella **Story 1.5**, dove serve davvero: lì si aggiunge l'helper md5. Fino ad allora, gli utenti con "Hide recent listening" usano il **percorso file** |
| E20 | Fusi orari | Timeline sfalsata | `date.uts` è UNIX UTC; il CSV `utc_time` è UTC esplicito. Il CSV `lastfm-to-csv` è UTC. Nessun fuso da gestire |

## 5. Semantica temporale

- `date.uts` = **inizio** dello scrobble (confermato da `track.scrobble`: `timestamp` = *"The time the track started playing"*), in UNIX secondi UTC
- `date["#text"]` = lo stesso istante formattato ("20 Oct 2020, 09:40") — **redundante**, mai usato come sorgente
- `timestamp = startedAt = date.uts * 1000` (D-LF.4)
- `durationMs = 0` (costante): la durata **non è disponibile** in `getRecentTracks`
- `completed = false` (costante), `skipped = null`

**Il conflitto con `02§2` e la sua risoluzione.** `02§2` prescrive per Last.fm `timestamp = date + durationMs` — cioè la **fine** dell'ascolto. Ma `durationMs` è 0 (costante), quindi la formula dà `timestamp = date` = **inizio**. La formula non è violata: è la sua istanziazione con `durationMs = 0`. La riga `02§2` resta **invariata**; va solo esplicitato che per Last.fm la durata non è disponibile (come già fatto per YouTube Music in `02§2`).

**Bias dichiarato**: l'evento è collocato all'**inizio** dell'ascolto anziché alla fine; errore medio ~3-4 min, trascurabile per aggregazioni giorno/mese/era, non trascurabile per l'analisi di singolo evento. Precedente identico: YouTube Music §5 (E.YT.5).

**Correzione futura** (fuori adapter MVP, contratto): quando l'enrichment (Story 4.2) popola `Track.durationMs`, un job di normalizzazione può riallineare `timestamp = startedAt + durationMs`. È possibile **senza rompere l'idempotenza** perché l'`eventKey` è derivato dai soli dati grezzi `minute` + identificatori (§3.1).

## 6. Dedup tracce

- **DEDUP-1** (`isrc` presente) → non raggiungibile: Last.fm **non espone ISRC**
- **DEDUP-2** (`mbid` del brano presente) → `mbid:<mbid>`. **Copertura parziale**: il campo esiste solo con `extended=1` ed è frequentemente vuoto (E.LF.5). Quando presente è il percorso migliore
- **DEDUP-3** (nessuno dei due) → `fuzzy:<sha1(normalize(name) + '|' + normalize(artistPrincipal) + '|' + durationBucketMs)>` con **`durationBucketMs = 0`**

**Il bucket sempre 0 è una scelta, non un degrado.** Last.fm non espone la durata: usarla nel bucket non sarebbe possibile. E il bucket a 0 è la scelta corretta per un'altra ragione — vedi `02§5` "Sorgenti con durata non affidabile": se la durata fosse disponibile solo su una parte degli scrobble, lo stesso brano finirebbe in **due `Track` distinte**, che è l'esatto opposto di ciò che la dedup persegue. Precedente: `03-ADAPTERS/listenbrainz.md` §6 (D-LB.7).

- `artist.mbid` → `Artist.mbid`: **dato utile e attivo**, più affidabile del mbid del brano. È il contributo specifico di Last.fm alla normalizzazione
- `album.mbid` → scartato: `02§3.3` non ha un campo MBID per l'album
- Promozione post-enrichment: job `rekey()` (Story 1.4) quando MusicBrainz trova ISRC/MBID su un brano importato da Last.fm

## 7. Comportamento privacy

| Dato sensibile | Default | Note |
|-----------------|---------|------|
| IP address | **non presente** nell'API | Il toggle `retainIp` **non è applicabile**: non c'è nulla da conservare. `ip` = `null` sempre |
| `country` | `null` | Nessun campo paese e nessun IP → nessuna derivazione possibile |
| Coordinate GPS | mai raccolte | — |
| `api_key` | **per-utente**, storage locale (Dexie) | **Mai** embedded nel bundle. I ToS §4.4 vietano una key che serva N utenti; §2.6 richiede la chiave fornita all'utente |
| shared secret | per-utente, storage locale | Serve solo per `api_sig` nel percorso web auth (D-LF.2). **Mai** nel bundle, mai nei log |
| `sk` (session key) | per-utente, storage locale | Durata illimitata ma **revocabile** dall'utente. `api_sig` richiede il shared secret, non basta la `api_key` |
| `user` (username Last.fm) | per-utente, storage locale | Dato personale: identifica l'account. Escluderlo dal bundle |
| URL del proxy | per-utente, storage locale | **Di fiducia dell'utente**: vede le richieste che l'utente stesso sta facendo. Dichiarato a chiarezza |
| `@attr.user` (dalla risposta) | **mai persistito** | Identifica l'account, non l'ascolto |
| `image[]` (URL copertine) | **mai persistiti** | Risolti via MusicBrainz in Story 4.3 |
| `loved` | **mai persistito** | Nessun campo nel modello (E.LF.17) |

**Il proxy riceve credenziali dell'utente**: l'`api_key` (e la `sk`, se presente) viaggiano nelle query string verso il proxy configurato dall'utente. È una scelta dell'utente, dichiarata in `09-PRIVACY-SECURITY.md` §3.3 e §4. Il progetto non gestisce né intermedia proxy.

**Nessuna uscita di dati dell'utente dal dispositivo**: l'API riceve **richieste** per dati pubblici dell'utente; l'app non invia lo storico, gli ascolti o le preferenze da nessuna parte (ADR-0002, `09§3.2`).

## 8. Test — fixture attese

File attesi (creati nella Story 1.3, generati in modo deterministico secondo `10-TESTING.md` §3.5):

| Fixture | Contenuto |
|---------|----------|
| `fixtures/synthetic-history/lastfm-scrobbles-sample.json` | Risposta API sintetica: 1 pagina con 5 track (di cui 1 `nowplaying`, 1 con `mbid` vuoto, 1 con artista stringa e 1 con artista oggetto, 1 con `loved=1`), `@attr` con `total`/`totalPages` |
| `fixtures/synthetic-history/lastfm-page2-sample.json` | Seconda pagina (2 track) per il test di paginazione e di confine |
| `fixtures/synthetic-history/lastfm-export-ghanl-sample.csv` | CSV 8 colonne (header + 3 righe) |
| `fixtures/synthetic-history/lastfm-export-4col-sample.csv` | CSV 4 colonne senza header (3 righe, l'ultima senza data → E.LF.18) |
| `fixtures/synthetic-history/lastfm-export-sample.json` | Export JSON (wrapper dei tool ghan.nl) |

Convenzione `10-TESTING.md` §3.1: ogni record porta `_case` (descrizione dello scenario) e `_expectedOutput` (valori attesi), ignorati dall'adapter.

**Il mock API**: il percorso API non ha un file su disco. I test **mockano `fetch`** — non c'è `msw` nel repo e non si aggiunge una dipendenza per questo: lo stub di `fetch` in Vitest è sufficiente e testabile senza rete. Il mock deve poter **simulare** (a) risposte multi-pagina, (b) rate limiting (429), (c) errori 6/8/9/10/11/16/26/29, (d) proxy che restituisce HTML.

Casi di test minimi:

1. **Happy path API**: 2 pagine, 7 track totali → 6 eventi (1 `nowplaying` scartato), `timestamp` = `uts * 1000`
2. **Paginazione**: `totalPages` = 2 → 2 richieste; alla terza pagina nessuna richiesta (stop a `totalPages`)
3. **E.LF.2**: `total` = 94618, `totalPages` = 474 → il test verifica lo stop a `totalPages` con un mock che risponde array vuoto oltre
4. **E.LF.1**: `@attr.nowplaying = "true"` senza `date` → scartato, nessun warning
5. **E.LF.14**: lo stesso fixture con `artist` stringa e con `artist` oggetto → **stessi** eventi
6. **E.LF.5**: `mbid` vuoto → DEDUP-3, un solo warning aggregato (non uno per riga)
7. **E.LF.7**: proxy assente → zero richieste emulate
8. **E.LF.8**: proxy che risponde HTML → `AdapterError` `SOURCE_UNREACHABLE`, `recoverable: true`
9. **E.LF.8b**: errore 10 → `AdapterError` non recuperabile con guida sulla key
10. **E.LF.12**: errore 9 (`sk` revocata) → non recuperabile, **un solo** tentativo (nessun loop)
11. **E.LF.15**: errore 429 alla terza pagina → backoff, `partialEvents` persistiti
12. **Rate limit**: 3 richieste in sequenza rapida → il token bucket **spazia** le richieste (test con clock iniettato)
13. **AbortSignal**: `signal.aborted` a metà → `DOMException('AbortError')`, `partialEvents` persistiti
14. **File CSV 8 colonne** (ghan.nl) → 3 eventi, `timestamp` da `uts`
15. **File CSV 4 colonne** (lastfm-to-csv) → 3 eventi, `timestamp` dalla data al minuto
16. **E.LF.18**: ultima riga del CSV 4 colonne senza data → scartata con `noDateSkipped`
17. **E.LF.16**: lo stesso scrobble via API (uts al secondo) e via CSV 4 colonne (minuto) → **stesso `eventKey`**, un solo evento
18. **D-LF.7**: due scrobble dello stesso brano nello stesso minuto → **un** evento (documentazione della perdita)
19. **E.LF.20**: CSV con BOM UTF-8 → letto correttamente
20. **E.LF.21**: percorso API **senza** `sk` → la query **non** include `api_sig` e non richiede il shared secret; il percorso web auth è differito alla Story 1.5
21. **Privacy**: `api_key` e `user` assenti dal DB; `ip`/`country` null; `image[]`/`loved`/`@attr.user` non persistiti
22. **Detection**: JSON non-CSV → `detect` ko; CSV senza header a 4 colonne → `detect` ok
23. **E20**: scrobble a cavallo di mezzanotte UTC → `day` UTC corretto

## 9. Segnalazione all'utente

Codici i18n (`08-COPY-I18N.md`) usati dall'adapter — namespace `adapter.lastfm.*` (allineato a `PlatformId`; le chiavi vanno aggiunte in `08§2.12d`):

| Codice i18n | Messaggio (IT) | Quando |
|-------------|----------------|--------|
| `adapter.lastfm.detect.success` | "Account Last.fm riconosciuto" | detect ok (proxy + key + username valorizzati) |
| `adapter.lastfm.detect.fail` | "Configurazione Last.fm incompleta: manca il proxy, la chiave API o il nome utente" | detect ko |
| `adapter.lastfm.warn.noTitleSkipped` | "{count} ascolti senza titolo esclusi" | E.LF.9 |
| `adapter.lastfm.warn.noArtistSkipped` | "{count} ascolti senza artista esclusi" | E.LF.9 |
| `adapter.lastfm.warn.noDateSkipped` | "{count} ascolti senza data esclusi" | E.LF.9, E.LF.18 |
| `adapter.lastfm.warn.mbidMissing` | "{count} ascolti senza MusicBrainz ID: alcuni brani potrebbero non essere riconosciuti come univoci" | E.LF.5, aggregato |
| `adapter.lastfm.info.privateProfile` | "Il tuo profilo Last.fm non mostra gli ascolti recenti: accedi con la sessione web per importarli" | E.LF.11 |
| `adapter.lastfm.info.libraryDeferred` | "I tuoi brani preferiti non sono inclusi in questo import (in arrivo)" | E.LF.17 |
| `adapter.lastfm.info.proxyTrust` | "Le richieste passano dal proxy che hai configurato: lui vede la tua chiave API" | E.LF.7, al primo import via proxy |
| `adapter.lastfm.info.complete` | "Import completato: {events} eventi, {tracks} brani unici" | fine import |

## 10. Note di implementazione

- **Percorso API = `parseRemote?()`** (ADR-0010, §4.1): l'adapter implementa il metodo opzionale su `PlatformAdapter`, consumando un `RemoteSource`:

  ```typescript
  const source: RemoteSource = {
    endpoint: proxyUrl,                    // base URL del proxy
    credentials: { apiKey, sessionKey },   // per-utente, mai embedded
    pagination: { limit: 200, from, to },  // finestre temporali UNIX UTC
    signal,                               // AbortSignal per l'annullamento
  };
  ```

  Il `RemoteSource` **non** ha un campo per il rate limit (ADR-0010 V7): è responsabilità dell'adapter, che conosce il protocollo.

- **L'adapter non conosce il proxy**: riceve un base URL e ci costruisce la query. Non deve fare supposizioni sulla sua forma: il contratto minimo è *URL che restituisce il JSON di Last.fm*. Se il proxy è trasparente, l'app manda già `api_key`; se il proxy è "intelligente" (inietta la key), l'app non la manda. **L'adapter supporta entrambe le forme**: `api_key` presente → la include; assente → la omette e lascia fare al proxy.

- **Costruzione dell'URL**: `new URL('/2.0/', proxyUrl)` + `searchParams` per `method`, `user`, `api_key`, `format`, `limit`, `page`, `from`, `to`, `extended`. **`api_sig`**: richiede md5 dei parametri ordinati + shared secret. Il repo non ha un helper md5 (`crypto.ts` espone solo SHA-1/SHA-256 via Web Crypto, che **non** supporta md5). La firma è un requisito del solo percorso web auth (D-LF.2): l'implementazione md5 è **rinviata** a Story 1.5 (sync continua, che richiede la `sk`), e dichiarata come gap in §4 (E.LF.21).

- **Rate limiter**: token bucket a ~5 req/s (limite non pubblicato da Last.fm: i ToS impongono un limite equo, la community misura ~5 req/s sostenibili). Backoff esponenziale su errori `11`, `16`, `29` e HTTP `429`/`5xx`. **Gli header di rate limit non esistono su Last.fm** (a differenza di ListenBrainz): il ritmo è stimato, non guidato. Dichiarato come asimmetria rispetto a `03-ADAPTERS/listenbrainz.md` §10.

- **Gestione errori**: mappa dei codici Last.fm → `AdapterError`:

  | Codice | Significato | `recoverable` | Messaggio |
  |--------|-------------|---------------|-----------|
  | 6 | Parametri invalidi | `false` | Controlla proxy, chiave e username |
  | 8 | Operazione fallita | `false` | Errore del server Last.fm |
  | 9 | `sk` non valida | `false` | Sessione scaduta: riautentica (D-LF.2) |
  | 10 | `api_key` non valida | `false` | La chiave non è valida (D-LF.1) |
  | 11 | Servizio offline | `true` | Ritenta più tardi |
  | 13 | Firma del metodo non valida | `false` | Errore di firma (percorso web auth) |
  | 16 | Errore temporaneo | `true` | Ritenta con backoff |
  | 17 | Profilo non pubblico | `true` | "Hide recent listening" attivo (E.LF.11) |
  | 26 | `api_key` sospesa | `false` | Last.fm ha sospeso la chiave: contatta il supporto |
  | 29 | Rate limit superato | `true` | Attesa con backoff |

  **Il codice `SOURCE_UNREACHABLE`** (ratificato in ADR-0010 §4.1) copre i casi di rete/proxy: connessione fallita, timeout, proxy che non risponde, HTML invece di JSON. È **recuperabile** (`recoverable: true`): gli eventi già raccolti restano persistiti.

- **`SOURCE_UNREACHABLE` richiede una modifica a `packages/core/src/adapters/errors.ts`**: il tipo `AdapterErrorCode` ha oggi 4 valori (`INVALID_FORMAT`, `TRUNCATED`, `UNSUPPORTED_VERSION`, `INTERNAL`) e va esteso. È un deliverable della Story 1.3, non della spec: la spec **dichiara** il codice, l'implementazione lo aggiunge.

- **Nessuna dipendenza nuova**: il percorso file usa `papaparse` (già in `@ls/core` per l'adapter Apple Music) per il CSV. Il percorso API usa `fetch` nativo.

- **Streaming**: `parseRemote?` restituisce `AsyncIterable<RawListenEvent>` e `yield`a **ogni** evento, senza accumulare: 50k scrobble non entrano in memoria (V2 di ADR-0010, stessa regola di `05§4`).

- **`@attr.total` può essere enorme**: un utente con 94618 scrobble produce 474 richieste a `limit=200`. L'import è un **job lungo** (1-15 minuti): deve mostrare progresso, essere annullabile (`AbortSignal`) e scrivere in chunk (partial recovery `05§4`).

- **Enrichment**: fuori adapter. La 1.3 produce `Track.mbid` e `Artist.mbid` nativi → l'enrichment (Story 4.2) potrà arricchire i brani che ne sono privi.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 50 (2026-10-26) | Prima stesura (issue #144). Decisioni D-LF.0…D-LF.8 (Boss, Sessione 47) e vincoli di ADR-0010. API, limiti, error codes, flusso web auth e formati CSV verificati su fonte (doc ufficiale Last.fm, doc non ufficiale, depth.fm, multi-scrobbler). Correzione di una premessa errata della issue: `limit` **max 200** (doc ufficiale), non 1000; e il campo `date` **manca** per il brano in riproduzione. Aggiunto il percorso **ibrido** (API + file) con `eventKey` normalizzato al minuto su tutti i percorsi, per evitare duplicati al re-import misto. Dichiarati i gap: md5 per `api_sig` (rinviato a 1.5), `loved` senza campo nel modello, `album.mbid` scartato |
| 1.0 | Sessione 51 (2026-10-26) | 🟢 APPROVED · ratifica del Boss al merge della PR #154 (`b3130a9`) — nessuna modifica di contenuto. Le decisioni D-LF.0…D-LF.8 sono ratificate come formulate; il percorso web auth per la `sk` resta **differito alla Story 1.5** (E.LF.21) |
