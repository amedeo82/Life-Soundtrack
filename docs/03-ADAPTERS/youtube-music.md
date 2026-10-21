# Adapter YouTube Music

> Status: 🟡 DRAFT · Versione 0.1 · Ultima modifica: Sessione 39 (2026-10-21)
> Piattaforma: YouTube Music (Google LLC)
> Sede legale: USA
> Tier: **S** · Priorità MVP: **sì**
> Spec collegata a: Story 1.1 (`11-BACKLOG.md`), `01-PLATFORMS.md` §3.2

---

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | ✅ | JSON in ZIP (Google Takeout) | Manuale | "YouTube and YouTube Music" → history (formato JSON da selezionare esplicitamente) |
| API pubblica | ⚠️ | REST | Real-time | YouTube Data API v3: nessun accesso alla cronologia di ascolto; utile solo per metadati catalogo (fuori scope adapter) |
| Scrobbling LB/L.fm | ✅ | — | Continuo | via scrobbler dedicati; gestito da Story 1.5 |

**Canale principale MVP**: Google Takeout JSON. Non esiste alcun canale API per la cronologia di ascolto YouTube Music.

**Cosa NON offre il Takeout** (verificato su fonti 2026): durata ascoltata, skip, shuffle, offline, dispositivo, IP. Il campo `time` indica l'**inizio** dell'azione di visione/ascolto. Queste assenze sono già censite in `01-PLATFORMS.md` §3.2 e §4.

## 2. Flusso di import

[Stato iniziale] → [Rilevamento formato strutturale] → [Parsing streaming JSON] → [Filtro musica (E6)] → [Normalizzazione] → [Upsert DB]

### 2.1 Come l'utente procura il file

1. `takeout.google.com` → **Deselect all** → selezionare **"YouTube and YouTube Music"**
2. "All YouTube data included" → selezionare (almeno) **history**
3. **Multiple formats** → History: **JSON** (⚠️ il formato va selezionato esplicitamente: il default può essere HTML, che non è supportato — errore guidato all'utente)
4. Next step → "Send download link via email" → Export once → **.zip**
5. Create export → attesa (da minuti a giorni) → download dal link email (scade dopo ~7 giorni)

Struttura dell'archivio:

```
Takeout/
  YouTube and YouTube Music/
    history/
      watch-history.json      ← cronologia unificata video + musica
      search-history.json     ← ricerche (fuori scope adapter MVP)
    playlists/                ← CSV playlist (fuori scope adapter MVP, vedi §3.2)
    music-library-songs.csv   ← libreria musicale (fuori scope adapter MVP, vedi §3.2)
```

**Nota sui nomi localizzati**: i nomi di cartelle e file del Takeout seguono la lingua dell'account Google (es. "YouTube e YouTube Music" in italiano). L'adapter NON fa affidamento su path o filename — vedi detection strutturale §2.2 (edge case E.YT.1).

### 2.2 Rilevamento formato (`detect`)

**Detection strutturale** (non per nome file):

- **ZIP**: scansione ricorsiva di tutti i `*.json`; un file è `watch-history` se il suo contenuto è un array di oggetti in cui **la maggioranza degli elementi** ha:
  - `header` ∈ {`"YouTube Music"`, `"YouTube"`} (o `products` che include almeno uno dei due), **e**
  - `time` ISO 8601 valido, **e**
  - almeno un elemento con `titleUrl` che matcha `/youtube\.com\/watch/` o `/youtu\.be\//`
- **JSON singolo**: stesso test strutturale applicato direttamente al file droppato
- **Rifiuta**: HTML (contenuto `<html` o estensione `.html`) → errore guidato `error.htmlExport` (l'utente deve riesportare selezionando JSON)
- **Rifiuta**: array vuoto o shape non riconosciuta → `detect.fail`

Non vengono accettati altri file del Takeout (`search-history.json`, `MyActivity.json`, CSV): sono fuori scope (D7). Gli eventi non-ascolto eventualmente presenti (es. "Liked…", "Searched…") vengono scartati dal filtro §3.3.

### 2.3 Parsing

- Iterazione **streaming** sull'array JSON (AsyncIterable, riusando `jsonStream` di `@ls/core` come per Spotify) — il file può raggiungere decine di MB
- Chunk da ~1000 eventi per batch di upsert
- **Multi-export**: l'utente può importare più archivi Takeout (ogni export è uno snapshot); l'idempotenza via `eventKey` (§3.1) rende i re-import sicuri e deduplicati (E.YT.6)
- Nessun processing di library/playlist in MVP (D5)

## 3. Mapping campi sorgente → unificato

> **Schema di riferimento**: `02-DATA-SCHEMA.md` v1.1 — `ListenEvent` **piatto** con `trackId` come FK; i metadati del brano vivono sull'entità `Track` separata.
>
> **Semantica temporale (decisione D2)**: `02§2` prescrive `timestamp = time + durata stimata (durata da catalogo)`, ma il Takeout non contiene durate e all'import il catalogo non esiste ancora. L'adapter MVP importa quindi con `durationMs = 0` e `timestamp = time`; la correzione post-enrichment è specificata in §5 (fuori scope adapter MVP).

### 3.1 ListenEvent (top-level, piatto — vedi `02§3.2`)

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `eventKey` | — | — | `'youtube_music:' + sourceEventId`, dove `sourceEventId = sha1(videoId + '\|' + rawTime)` | **Stabile per sempre**: derivato solo da dati grezzi (videoId + timestamp di export), non da valori corretti — abilita la correzione temporale futura (§5). Fallback (nessun videoId): `sha1(trackKey + '\|' + rawTime + '\|' + durationMs)` |
| `platform` | (fisso) | `PlatformId` | `'youtube_music'` | Anche gli eventi musicali rilevati su YouTube principale via euristica §3.3 vengono normalizzati a `youtube_music` (l'adapter importa *musica*, qualunque sia la superficie Google) |
| `importId` | (interno) | uuid | generato al parse | FK a `imports` |
| `timestamp` | `time` | ISO 8601 (con offset o Z) | `Date.parse(time)` → unix ms UTC | **Inizio ascolto** = fine (durata ignota, D2). Normalizzazione UTC al parse (E10) |
| `startedAt` | `time` | ISO 8601 | = `timestamp` | La distinzione inizio/fine non è ricavabile dall'export |
| `durationMs` | — | — | `0` (costante) | **Non presente nell'export** (E.YT.5); `0` = "durata ignota", non "ascolto nullo" |
| `trackId` | (interno) | uuid | **risolto dal core via DEDUP** (`02§5`) su `trackKey` = name+artist normalizzati | adapter emette solo metadati §3.1.1 |
| `completed` | — | — | `false` (sempre) | Non calcolabile senza durata (E.YT.5) |
| `skipped` | — | — | `null` | Non determinabile: nessun segnale di interruzione nell'export |
| `shuffle` | — | — | `null` | Assente |
| `offline` | — | — | `null` | Assente |
| `incognito` | — | — | `null` | Assente |
| `reasonStart` | — | — | `null` | Assente |
| `reasonEnd` | — | — | `null` | Assente |
| `deviceType` | — | — | `'unknown'` | Nessun campo dispositivo nell'export |
| `deviceDetail` | — | — | `null` | Assente |
| `ip` | — | — | `null` | Mai presente nell'export |
| `country` | — | — | `null` | **Non derivato da `locationInfos`**: scartati sempre (privacy, §7) |
| `day` | (derivato) | `YYYY-MM-DD` | da `timestamp` UTC | indice critico |

**Estrazione `videoId`**: da `titleUrl` via `URLSearchParams(new URL(titleUrl)).get('v')`; gestiti `youtube.com/watch?v=`, `music.youtube.com/watch?v=` e `youtu.be/<id>`.

### 3.1.1 Track (entità separata — vedi `02§3.3`)

| Campo Track | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-------------|----------------|---------------|----------------|------|
| `name` | `title` | string | rimozione prefisso verbo localizzato ("Watched ", "Guardato ", … — lista curata §10), poi `normalize(name)` (`02§5`) | Evento "video rimosso" (`title` = URL, senza `titleUrl`/`subtitles` validi) → **skip evento** con warning (E.YT.2) |
| `artistId` | `subtitles[0].name` | string | risolto da `artists` (dedup per nome normalizzato); assente → "Unknown" | Il canale è l'approssimazione dell'artista (per i brani ufficiali è il canale "- Topic" o VEVO) |
| `albumId` | — | — | `null` | L'export non contiene album |
| `durationMs` | — | — | `null` | Non presente (E.YT.5); DEDUP-3 degradato a bucket 0 (vedi §6) |
| `isrc` | — | — | `null` | Recuperabile via enrichment (MusicBrainz lookup, Story 4.2) |
| `mbid` | — | — | `null` | Enrichment futuro |
| `genres` | — | — | `[]` | Enrichment futuro |
| `artworkUrl` | — | — | `null` | Enrichment futuro (Story 4.3) |
| `platformIds` | `titleUrl` | string | `{youtube_music: videoId}` | ID nativo Google |

### 3.1.2 Artist / Album (entità separate — vedi `02§3.3`)

L'adapter emette `{name, platformIds?}` per Artist: `name` = `subtitles[0].name`, `platformIds.youtube_music` = channelId estratto da `subtitles[0].url` (pattern `/channel/<id>`). Album: mai emesso (nessun dato album nell'export). Il core fa upsert con dedup per nome normalizzato.

### 3.2 Library / Playlist (vedi `02§3.7`)

**Fuori scope adapter MVP (decisione D5)**, differite post-MVP con limitazione dichiarata all'utente (`info.playlistsDeferred`):

| Entità | Sorgente Takeout | Blocco tecnico |
|--------|------------------|----------------|
| Playlist / PlaylistItem | `playlists/<nome>.csv` (colonne: `Video ID`, `Playlist Video Creation Timestamp`) | **Nessun titolo brano** → non mappabile su `Track` (che richiede `name` NOT NULL); solo `platformIds` |
| LibraryItem `saved_track` | `music-library-songs.csv` (colonne: `Video ID`, `Song Title`, `Album Title`, `Artist Name`) | Mappabile tecnicamente; fuori scope MVP per contenere l'adapter a Story 1.1 (AC del backlog) |

### 3.3 Regola filtro musica/video (edge case E6 — decisione D3)

Il Takeout unifica in un solo file la cronologia di YouTube e YouTube Music. Regola di classificazione per evento:

```
isMusicEvent(e):
  1. e.header === 'YouTube Music'                        → MUSICA
  2. e.header === 'YouTube':
     2a. host(titleUrl) === 'music.youtube.com'          → MUSICA
     2b. subtitles[0].name match /-\s*Topic$/i           → MUSICA (canali artista auto-generati)
     2c. subtitles[0].name match /VEVO$/i                → MUSICA (canali ufficiali VEVO)
     2d. e.products include 'YouTube Music'              → MUSICA (fallback se header ambiguo)
     2e. altrimenti                                      → NON-MUSICA (skip + warning nonMusicSkipped)
  3. header assente o altro ('Search', …)                → NON-ASCOLTO (skip silenzioso o con warning)
```

**Nota sui canali "- Topic"**: YouTube genera automaticamente un canale "- Topic" per ogni artista con distribuzione musicale; è il segnale più affidabile che il video è un brano ufficiale. I canali VEVO sono canali musicali ufficiali delle etichette.

**Eventi importati**: solo i MUSICA. Ogni evento NON-MUSICA scartato incrementa il contatore segnalato all'utente a fine import.

## 4. Edge case noti

Copia da `01-PLATFORMS.md` §5 (piattaforma YouTube) + edge case specifici Takeout emersi in Sessione 39.

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E6 | Cronologia unifica video e musica | Falsi positivi musicali | Filtro §3.3 (header + euristica canale) |
| E10 | Fusi orari: `time` è ISO 8601 con offset locale o Z | Timeline sfalsata | Normalizzazione a UTC in fase di parse (`Date.parse`) |
| E.YT.1 | Cartelle/file Takeout **localizzati** ("YouTube e YouTube Music", nomi file tradotti) | `detect` per nome file fallisce | Detection **strutturale** sul contenuto (§2.2), mai su path |
| E.YT.2 | Video rimossi/privati: `title` degenera in "Watched <url>", senza `titleUrl` né `subtitles` | Metadati inutilizzabili | Skip evento + warning `unwatchableSkipped` (conteggio) |
| E.YT.3 | Prefisso del verbo nel `title` localizzato ("Watched" / "Guardato" / …) | `name` sporco (es. "Guardato X") | Lista curata di prefissi noti (§10) con fallback: se nessun prefisso matcha, `name = title` intero |
| E.YT.4 | Cronologia **incompleta**: Google non garantisce l'intera lifetime (retention, activity controls attivi solo da una data, eventi cancellati persi) | Storico mancante rispetto ad altre piattaforme | Dichiarato all'utente (`info.partialHistory`); nessun tentativo di ricostruzione |
| E.YT.5 | `durationMs`, skip, shuffle, dispositivo **assenti** | `completed`/`skipped` non calcolabili; DEDUP-3 senza durata | `durationMs = 0`, `startedAt = timestamp`, `completed = false`, `skipped = null` (§3.1); DEDUP-3 degradato (§6) |
| E.YT.6 | Stesso evento presente in export multipli (ogni Takeout è uno snapshot) | Duplicati | `eventKey` idempotente da dati grezzi (§3.1) |

## 5. Semantica temporale

- `time` (sorgente) = **inizio** dell'azione di ascolto (YouTube registra l'evento all'avvio della visione/ascolto, non alla fine — verificato su fonti 2026)
- `timestamp` (unificato) = `time` (coerente con `02§2`: il Takeout non fornisce la durata e il catalogo non è ancora disponibile all'import — decisione D2)
- `startedAt` = `time` (indistinguibile da `timestamp` nel MVP)
- `durationMs` = `0`

**Bias dichiarato**: l'evento è collocato all'inizio dell'ascolto anziché alla fine; l'errore medio (~3-4 min) è trascurabile per le aggregazioni giorno/mese/era, ma l'evento NON è comparabile con gli eventi `timestamp`-fine di Spotify fino alla correzione.

**Correzione futura (fuori scope adapter MVP, specificata qui come contratto)**: quando l'enrichment (Story 4.2) popola `track.durationMs`, un job di normalizzazione può riallineare `timestamp = rawTime + durationMs` e `startedAt = rawTime`. È possibile **senza rompere l'idempotenza** perché `eventKey` è derivato dai soli dati grezzi `sha1(videoId + '|' + rawTime)` (§3.1). L'analisi usa `startedAt` quando disponibile (`02§2`).

## 6. Dedup tracce

- Il Takeout **non fornisce ISRC né MBID**; `videoId` è un ID proprietario Google, **non** è ISRC/MBID
- **DEDUP-3** si applica di default (fuzzy name+artist), con **degradazione dichiarata**: `Track.durationMs = null` → `durationBucketMs = 0` → il bucket non discrimina tra radio edit / album version / live di omonimi. Rischio accettato (consistente col tradeoff `02§5`); mitigazione via DEDUP-1/2 dopo enrichment
- L'euristica §3.3 può far confluire nella stessa Track lo stesso brano ascoltato da sorgenti diverse (video musicale su YouTube + topic channel) — comportamento **voluto**: è la stessa registrazione
- Promozione post-enrichment: job `rekey()` (Story 1.4) aggiorna il `canonicalKey` quando MusicBrainz trova ISRC/MBID

## 7. Comportamento privacy

| Dato sensibile | Default | Note |
|----------------|---------|------|
| `locationInfos` | **sempre scartati al parse** | Potenziale dato geografico sensibile; nessun toggle dedicato nello schema → scarto incondizionato (più restrittivo di `retainIp`); `country` resta `null` |
| `details[].name` | usato solo per l'euristica di filtro | Mai persistito |
| `activityControls` | ignorato | Metadato di provisioning Google, nessun valore analitico |
| IP address | assente dall'export | n/a |
| Coordinate GPS | mai presenti | n/a |

## 8. Test — fixture attese

File atteso: `fixtures/synthetic-history/youtube-sample.json` (**creato nella Story 1.1**, generato in modo deterministico secondo `10-TESTING.md` §3.5). Questa spec definisce i casi che il fixture deve coprire.

Casi di test minimi:

1. **Happy path**: 3 eventi `header: "YouTube Music"` ben formati → 3 ListenEvent, 3 track uniche, `durationMs = 0`, `startedAt = timestamp`
2. **Idempotenza**: re-import dello stesso file → `eventsDuplicated = 3`, nessun raddoppio
3. **E6 musica via euristica**: evento `header: "YouTube"` con canale suffisso `- Topic` → importato come `youtube_music`
4. **E6 non-musica**: evento `header: "YouTube"` con canale generico (es. canale tech) → scartato, warning `nonMusicSkipped`
5. **E.YT.2 video rimosso**: `title = "Watched https://…"`, senza `titleUrl` né `subtitles` → scartato, warning `unwatchableSkipped`
6. **E.YT.5 durata assente**: nessun campo durata ovunque → `completed = false`, `skipped = null` su tutti gli eventi
7. **E.YT.6 duplicato cross-export**: stesso evento (stesso `videoId` + `time`) in due file → un solo ListenEvent
8. **E10 fuso orario**: `time` con offset `+02:00` → `day` UTC corretto (cambio giorno per eventi vicino a mezzanotte)
9. **Privacy**: evento con `locationInfos` popolato → nessun dato di location persistito, `country = null`
10. **DEDUP**: stesso brano via video musicale (canale VEVO) e topic channel (videoId diversi) → **una sola Track** (fuzzy name+artist, bucket 0)
11. **E.YT.3 prefisso localizzato**: `title = "Guardato X"` → `name = "X"`
12. **HTML rifiutato**: file HTML con cronologia → `detect` fallisce con `error.htmlExport`

## 9. Segnalazione all'utente

Codici i18n (`08-COPY-I18N.md`) usati dall'adapter — namespace `adapter.youtube_music.*` (allineato a `PlatformId`; **nota**: `08§2.12` accenna "analoghi per youtube" — in Story 1.1 le chiavi vanno aggiunte con prefisso `youtube_music`):

| Codice i18n | Messaggio (IT) | Quando |
|-------------|----------------|--------|
| `adapter.youtube_music.detect.success` | "File YouTube Music riconosciuto" | detect ok |
| `adapter.youtube_music.detect.fail` | "File non riconosciuto come export YouTube (Google Takeout)" | detect ko |
| `adapter.youtube_music.error.htmlExport` | "Questo è l'export HTML: riesporta da Google Takeout selezionando il formato JSON per la cronologia" | detect ko, export HTML |
| `adapter.youtube_music.warn.nonMusicSkipped` | "{count} eventi video non musicali esclusi" | E6 |
| `adapter.youtube_music.warn.unwatchableSkipped` | "{count} eventi con metadati incompleti esclusi (video rimossi)" | E.YT.2 |
| `adapter.youtube_music.info.playlistsDeferred` | "Le playlist non sono incluse in questo import (in arrivo)" | D5 |
| `adapter.youtube_music.info.partialHistory` | "La cronologia Google potrebbe non coprire l'intera storia dell'account" | E.YT.4 |
| `adapter.youtube_music.info.complete` | "Import completato: {events} eventi, {tracks} brani unici" | fine |

## 10. Note di implementazione

- **Streaming parse**: `jsonStream` di `@ls/core` (già usato dall'adapter Spotify); il file è un array JSON potenzialmente di decine di MB — mai caricarlo interamente
- **Chunking**: batch da 1000 eventi per upsert (come Spotify)
- **Estrazione `videoId`**: `URLSearchParams(new URL(titleUrl)).get('v')`; host ammessi `youtube.com`, `music.youtube.com`, `youtu.be` (path-short)
- **Prefissi verbo curati (E.YT.3)**: almeno EN `Watched` e IT `Guardato` alla stesura; la lista è estendibile. Fallback conservativo: nessun prefisso matcha → `name = title` intero (mai rimuovere la prima parola a caso)
- **Multi-export**: nessun ordine di import richiesto (nessun processing di library); l'idempotenza copre i duplicati
- **Correzione temporale futura**: implementata come job di normalizzazione post-enrichment, NON nell'adapter — prerequisito: `eventKey` stabile (§3.1) e `track.durationMs` popolata (Story 4.2)
- **Rate limit**: n/a (import locale, nessuna chiamata di rete)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 39 (2026-10-21) | Prima stesura (issue #96). Decisioni D1-D7 chiuse con il Boss; formato Takeout verificato su fonti 2026. Promozione a 🟢 APPROVED al merge della PR di approvazione |
