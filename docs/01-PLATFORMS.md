# 01 — Matrice Piattaforme e Dati Ottenibili

> Status: 🟡 DRAFT
> Versione: 0.8
> Ultima modifica: Sessione 67 (2026-10-30) — edge case geo E19..E24 e matrice di disponibilita del contesto (Story 1.6, ratificata)
> Scope: MVP europeo

---

## 1. Scopo

Definire, per ogni piattaforma di streaming nel perimetro MVP, **quali dati sono ottenibili, con quale metodo, in quale formato e con quali limiti**. Questo documento è la base delle specifiche adapter (`03-ADAPTERS/`).

## 2. I tre canali di accesso ai dati

| Canale | Descrizione | Pro | Contro |
|--------|-------------|-----|--------|
| **Export GDPR** | Download dei dati personali obbligatorio per legge (UE) | Storico completo, campi contestuali ricchi | Manuale, non automatizzabile, tempi variabili |
| **API pubblica** | Endpoint ufficiali per sviluppatori | Real-time, automatizzabile | Limiti severi, deprecazioni, nessun storico completo |
| **Scrobbling** | Registrazione continua degli ascolti su hub esterni (Last.fm, ListenBrainz, Maloja) | Continuo, multi-piattaforma, storico illimitato | Copre solo dal momento dell'attivazione |

**Strategia MVP**: export GDPR per lo *storico*, scrobbling per il *continuo*, API solo dove aggiungono valore reale.

## 3. Schede piattaforma

### 3.1 Spotify 🇸 — Tier S (priorità massima)

- **Accesso storico**: GDPR "Extended Streaming History" (JSON, ~15k eventi/anno)
- **Accesso real-time**: Web API (limitata: recently played max 50; top items 3 finestre)
- **Scrobbling**: sì (Last.fm, ListenBrainz, multi-scrobbler)

**Campi per evento di ascolto (export GDPR)**:

| Campo | Tipo | Note |
|-------|------|------|
| `ts` | ISO 8601 UTC | Timestamp fine ascolto |
| `platform` | string | Dispositivo/OS (dettagliato pre ott-2023, generico dopo) |
| `ms_played` | int | Millisecondi ascoltati |
| `conn_country` | ISO 3166-1 | Paese di connessione |
| `ip_addr` | string | Indirizzo IP |
| `master_metadata_track_name` | string | Nome brano |
| `master_metadata_album_artist_name` | string | Artista |
| `master_metadata_album_album_name` | string | Album |
| `spotify_track_uri` | string | `spotify:track:<id>` |
| `episode_name` / `episode_show_name` | string/null | Podcast |
| `reason_start` | enum | `playbtn`, `clickrow`, `trackdone`, `appload`, `fwdbtn`, `backbtn`, `remote`, `uriopen`, `unknown`... |
| `reason_end` | enum | `endplay`, `fwdbtn`, `backbtn`, `trackdone`, `logout`, `unexpected-exit`... |
| `shuffle` | bool | |
| `skipped` | bool | ⚠️ inaffidabile in alcuni periodi (vedi §5) |
| `offline` | bool | |
| `offline_timestamp` | int/null | ⚠️ unità cambiate nel tempo (vedi §5) |
| `incognito_mode` | bool | |

**File aggiuntivi nell'export**: `SearchQueries.json` (ricerche con timestamp), `Playlist*.json` (playlist con date di aggiunta), `YourLibrary.json` (brani salvati), `Follow.json`, `Wrapped*.json`, `Userdata.json`. Nei technical log: `CarDetectionEvent.json` (rilevamento auto), `AdRequestEvent.json` (ads, account free).

**Limiti API (2026)**: audio-features deprecate (nov 2024); Dev Mode richiede Premium e max 5 utenti (feb 2026). → Le audio features vanno ricavate da fonti esterne (vedi `05-ARCHITECTURE.md` §6).

### 3.2 YouTube Music 🇺🇸 (dominante in EU) — Tier S

- **Spec adapter**: `03-ADAPTERS/youtube-music.md` (Sessione 39)
- **Accesso storico**: Google Takeout ("YouTube and YouTube Music") → JSON (l'HTML non è supportato dall'adapter)
- **Campi**: `header` ("YouTube Music"/"YouTube"), `time`, `title`, `titleUrl`, `subtitles[]` (canale/artista), `products`, `details[]`, `locationInfos` (opzionale)
- **Limiti**: cronologia unificata video+musica (serve filtro, E6); nessun campo durata/skip/shuffle/dispositivo; nomi file/cartelle Takeout localizzati
- **Scrobbling**: sì (scrobbler dedicati)

### 3.3 Apple Music 🇺🇸 (molto diffusa in EU) — Tier A

- **Spec adapter**: `03-ADAPTERS/apple-music.md` (Sessione 40)
- **Accesso storico**: Apple Privacy Portal → "Apple Media Services information" → `Apple Music Play Activity.csv` (CSV, event stream)
- **Campi 2026.2 (~143 colonne)**: Song Name, Album Name, Media/Play Duration (ms), Event Start/End Timestamp, End Reason Type, Shuffle Play, Offline, Device Type/OS, ISO Country, IP (con city/region/lat/long); ⚠️ `Artist Name` assente dal 2026 (solo legacy; fallback `Container Artist Name`)
- **Limiti**: nessun ISRC/MBID/ID traccia stabile; artisti spesso Unknown (richiede enrichment); API MusicKit senza cronologia né audio features
- **Scrobbling**: sì (scrobbler di terze parti)

### 3.4 Deezer 🇫🇷 — Tier A

- **Accesso storico**: export GDPR (⚠️ storicamente lento e a volte incompleto)
- **API pubblica**: buona per catalogo, preferiti, playlist; cronologia utente limitata
- **Scrobbling**: sì
- **Limiti**: meno metadati contestuali di Spotify

### 3.5 Tidal 🇳🇴/🇸 — Tier A

- **API pubblica aperta**: `openapi.tidal.com` v2, OAuth 2.0 + PKCE, JSON:API
- **Campi catalogo**: title, artist, album, duration, **ISRC**, `audioQuality` (LOW/HIGH/LOSSLESS/HI_RES), `audioModes` (STEREO/DOLBY_ATMOS)
- **Limiti**: nessuna cronologia di ascolto storica via API → utile per metadati e libreria, non per lo storico

### 3.6 SoundCloud 🇩🇪 — Tier B

- **Export GDPR**: cronologia limitata a ~1000 brani; like, playlist, follow
- **API pubblica**: preferiti, playlist, follow
- **Valore**: musica indie/elettronica/DJ set assente altrove

### 3.7 Last.fm 🇬🇧 — Tier S (come hub, non sorgente)

- **Nessun export utilizzabile dall'app**: non esiste un export button per gli scrobble; l'export GDPR è una procedura **manuale e asincrona** (email, giorni) e risulta **incompleto** per eventi. Richiede inoltre di disattivare *"Hide recent listening information"*, cioè di degradare la privacy dell'utente
- **API `user.getRecentTracks`** (canale MVP, via proxy CORS): `user` + `api_key` obbligatori, `limit` (default 50, **max 200**), `page`, `from`/`to` (UNIX UTC), `extended` (0\|1). Risposta: `@attr.{total,totalPages,page,perPage}` + `track[]`
- **CORS: l'API non emette `Access-Control-Allow-Origin`** → dalla PWA la fetch cross-origin è bloccata. Serve un **proxy configurato dall'utente** (D-LF.0), che il progetto non gestisce (ADR-0002)
- **Autenticazione**: `user.getRecentTracks` **non richiede auth** per i dati pubblici. Gli utenti con *"Hide recent listening information"* attivo richiedono la `sk` (web auth: `auth.getToken` → `last.fm/api/auth` → `auth.getSession`; `api_sig` = md5 dei parametri + shared secret). Il percorso web auth è rinviato alla Story 1.5 (manca un helper md5 nel repo)
- **Campi**: `name` (titolo), `artist` (stringa con `extended=0`, oggetto `{mbid, #text}` con `extended=1`), `album` (`{mbid, #text}`), `date` (`{uts, #text}`, **inizio** dello scrobble), `loved` (solo `extended=1`), `mbid` del brano (solo `extended=1`, **frequentemente vuoto**), `image[]`, `url`, `streamable`
- **Limiti**: nessun contesto (device/luogo/IP/paese); **nessuna durata** in `getRecentTracks` → `durationBucketMs` sempre 0; rate limit **non pubblicato** (client-side ~5 req/s, nessun header di rate limit); il brano in riproduzione (`@attr.nowplaying`) **non ha `date`**
- **Errori**: 6 parametri · 8 operazione · 9 `sk` · 10 `api_key` · 11 offline · 13 firma · 16 temporaneo · 17 profilo non pubblico · 26 key sospesa · 29 rate limit
- **Spec**: `03-ADAPTERS/lastfm.md` (v1.2, 🟢 APPROVED, Sessione 57)
- **Scrittura (hub)**: `track.scrobble` con `sk` + `api_sig` (md5, D-SH.11) — contratto di scrittura in `13-ADR/0011-scrobble-sink.md` 🟢 v1.0, protocollo in `20-SCROBBLING-HUB.md` v1.0 🟢 §6.1. Il trasporto è il **proxy dell'utente**, che per la scrittura deve inoltrare una **POST con body**; la modalità del proxy (`solo lettura` / `lettura + scrittura`) è **dichiarata dall'utente** (D-SH.14)

### 3.8 ListenBrainz 🌐 (no-profit) — Tier S (come hub)

- **Export API (canale MVP)**: `POST /1/export/` → poll → download ZIP con `listens/<mese>.jsonl`. **La doc prescrive l'export per lo storico completo** e sconsiglia esplicitamente di paginare `/1/user/{username}/listens` su tutto lo storico. Un export pending per utente, range opzionale `{start_time, end_time}`, snapshot **non atomico** (generato da dati live), valido 30 giorni
- **API pubblica** (canale incrementale, Story 1.5): `/1/user/{username}/listens` con `count` (max 1000) e cursore `max_ts`/`min_ts`; rate limit 1 req/s (più alto con User Token valido), header `X-RateLimit-*`; User-Agent **obbligatorio**; HTTPS only; CORS abilitato
- **Campi**: `listened_at` (**inizio** dell'ascolto), `inserted_at` (inserimento nel DB, non usato), `recording_msid`, `track_metadata.track_name/artist_name/release_name`, `additional_info`: **`recording_mbid`, `artist_mbids`, `release_mbid`, `isrc`, `duration_ms`** (opzionale, durata *catalogo*), `spotify_id`, `youtube_id`, `origin_url`; `mbid_mapping` (risoluzione server-side)
- **Limiti**: nessun contesto (device/luogo/IP/paese); nessuna durata ascoltata; `duration_ms` opzionale → lo stesso brano può avere bucket DEDUP-3 diversi (vedi `02§5` "Sorgenti con durata non affidabile")
- **Attenzione**: `recording_msid` è un hash dei **metadati**, non un ID univoco per singolo ascolto → due ascolti dello stesso brano condividono lo stesso msid. L'identità dell'evento è la tupla `(listened_at, recording_msid)`
- **Valore unico**: identificativi MusicBrainz/ISRC nativi → normalizzazione perfetta tra piattaforme
- **Spec**: `03-ADAPTERS/listenbrainz.md` (v1.2, 🟢 APPROVED, Sessione 57)
- **Scrittura (hub)**: `POST /1/submit-listens` con User Token (`Authorization: Token …`) e `User-Agent` obbligatorio — contratto di scrittura in `13-ADR/0011-scrobble-sink.md` 🟢 v1.0, protocollo in `20-SCROBBLING-HUB.md` v1.0 🟢 §6.2. CORS abilitato: **nessun proxy** per la scrittura

### 3.9 Self-hosted (Plex, Navidrome, Subsonic, Roon) — Tier S+ per nicchia

- Nessuna piattaforma commerciale: librerie personali (CD digitalizzati, acquisti, file rari)
- Integrazione via scrobbling (Maloja, multi-scrobbler, webhook Plex→ListenBrainz)
- **Valore unico**: copre la parte più intima della storia musicale, invisibile alle piattaforme
- **Nota su `PlatformId`**: in `02-DATA-SCHEMA.md` le piattaforme commerciali sono in `PlatformId`; Subsonic/Roon/Maloja **non** sono piattaforme sorgente del modello, ma **hub di scrobbling** — vivono in `PrivacySettings.scrobbleHubs`, che è una lista di **`ScrobbleHubId`**, un **tipo dedicato** distinto da `PlatformId` (`02-DATA-SCHEMA.md` §3.8, ratificato in `20-SCROBBLING-HUB.md` v1.0 🟢, D-SH.2): il toggle per-hub è verificabile a compile time e non può contenere per errore una piattaforma sorgente (e viceversa). Maloja è scope **Fase 2** (`11-BACKLOG.md`, T1.5.3). `navidrome` è in `PlatformId` come caso particolare di Subsonic API.

### 3.10 Fuori perimetro MVP (estensioni future)

Qobuz (export solo playlist), Bandcamp (solo acquisti), IDAGIO (classica), Boomplay (Africa), JioSaavn/Gaana (India), Anghami (MENA), NetEase/Tencent (Cina), MelOn (Corea), LINE Music/AWA (Giappone), iHeartRadio/SiriusXM (radio USA). Vedi `SESSIONS.md` per la strategia di estensione.

## 4. Confronto per categoria di dato

| Categoria | Spotify | YT Music | Apple | Deezer | Tidal | SoundCloud | Last.fm | ListenBrainz |
|---|---|---|---|---|---|---|---|---|
| Timestamp ascolto | ✅ | ✅ | ✅ | ✅ | ❌ | ️ | ✅ | ✅ |
| Durata ascoltata | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dispositivo | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| IP / Paese | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Skip / Shuffle / Offline | ✅ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ricerche | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Playlist con date | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Brani salvati | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| ISRC / MBID | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ⚠️ | ✅ |
| Storico completo | ✅ | ✅ | ✅ | ⚠️ | ❌ | ️ | ✅ | ✅ |

Legenda: ✅ completo · ⚠️ parziale · ❌ assente

## 5. Catalogo edge case noti (vincoli per gli adapter)

| # | Piattaforma | Edge case | Impatto | Azione adapter |
|---|-------------|-----------|---------|----------------|
| E1 | Spotify | `skipped` non affidabile: nessun skip registrato 2015-04→2022-10; valori misti prima/dopo | Statistiche skip errate | Regola derivata: `skipped OR reason_end IN (backbtn, unknown, endplay, fwdbtn)` — **validata in Sessione 2** (`03-ADAPTERS/spotify.md`) |
| E2 | Spotify | Timestamp sovrapposti (~2.6% della durata totale); stream duplicati identici con `ts` diverso | Durata totale sovrastimata | Deduplicazione per (uri, ts±1s, ms_played) |
| E3 | Spotify | `offline_timestamp`: unità passate da secondi a millisecondi | Parsing errato | Normalizzazione unità per epoca |
| E4 | Spotify | Stessa registrazione con URI/ISRC diversi (singolo + album + compilation) | Conteggi frammentati | Dedup via ISRC/MBID + fuzzy title (vedi `02-DATA-SCHEMA.md`) |
| E5 | Spotify | Granularità `platform` cambiata ott-2023 (da modello dettagliato a `android`/`windows`/...) | Classificazione device discontinua | Mapping a `device_type` normalizzato |
| E6 | YouTube | Cronologia unifica video e musica | Falsi positivi musicali | Filtro su `products` + euristiche titolo/URL |
| E7 | Deezer | Export GDPR storicamente lento (casi documentati di mesi) e incompleto | Storico mancante | Fallback: API + scrobbling; avviso utente |
| E8 | SoundCloud | Export limitato a ~1000 brani; brani rimossi nel tempo | Storico troncato | Dichiarare limite all'utente; integrare con scrobbling |
| E9 | Apple | Export legacy senza contesto; il Play Activity 2026.2 ha invece durata/skip/shuffle/device | Due generazioni di schema in circolazione | Adapter con alias 2026.2/legacy (`03-ADAPTERS/apple-music.md` §10); campi contestuali degradati sui legacy |
| E10 | Tutte | Fusi orari: `ts` Spotify è UTC; Apple "Play Date UTC"; Takeout locale+UTC | Timeline sfalsata | Normalizzare tutto a UTC in fase di parse |
| E11 | ListenBrainz | `recording_msid` è un hash dei **metadati**, non un ID univoco per singolo ascolto | Due ascolti dello stesso brano condividono lo stesso msid → un `eventKey` basato solo sul msid perderebbe eventi | `eventKey = listened_at + '\|' + recording_msid` (`03-ADAPTERS/listenbrainz.md` §3.1, D-LB.2) |
| E12 | ListenBrainz | `additional_info.duration_ms` opzionale (durata *catalogo*, non ascoltata) | Lo stesso brano in bucket DEDUP-3 diversi → **due Track** per lo stesso brano | Bucket DEDUP-3 **sempre 0** per questa fonte; la durata va sulla `Track` come hint, fuori dal `canonicalKey` (`02§5`, `03-ADAPTERS/listenbrainz.md` §3.3) |
| E13 | ListenBrainz | L'export è generato **asincronicamente da dati live**, non da uno snapshot atomico | Un re-export successivo può aggiungere eventi ma non rimuovere quelli cancellati lato server | Riconciliazione via `eventKey`; il limite è dichiarato all'utente (`info.exportNotSnapshot`) |
| E14 | Last.fm | Il brano in riproduzione (`@attr.nowplaying`) **non ha `date`** | Uno scrobble inesistente | Scartato; l'import ricomincia al prossimo avvio (`03-ADAPTERS/lastfm.md` E.LF.1) |
| E15 | Last.fm | `artist` è una **stringa** senza `extended=1` e un **oggetto** `{mbid, #text}` con `extended=1` | Crash di parsing su `artist["#text"]` | L'adapter normalizza entrambe le forme in un accessor unico (`lastfm.md` E.LF.14) |
| E16 | Last.fm | **Nessun export utilizzabile dall'app**: l'export GDPR è manuale, asincrono e incompleto, e richiede di disattivare *"Hide recent listening information"* | L'utente deve degradare la propria privacy per ottenere il file | Il canale MVP è l'API via proxy configurato dall'utente; il percorso file usa gli export di terze parti, senza degradare la privacy (`lastfm.md` §1) |
| E17 | Last.fm | `mbid` del brano presente solo con `extended=1` e **frequentemente vuoto** | DEDUP-2 non raggiungibile su molti scrobble | Degrado a DEDUP-3 con warning aggregato; `artist.mbid` resta il contributo utile (`lastfm.md` E.LF.5) |
| E18 | Last.fm | L'API **non emette header CORS** | La fetch cross-origin dalla PWA è bloccata | Proxy CORS configurato dall'utente in Settings, default vuoto → card `disabled` e **zero richieste** (D-LF.0) |
| E19 | Geo (tutte) | IP non risolvibile nel DB locale (MMDB, `13-ADR/0009`) | `city = null`; il paese resta | Warning `cityUnresolved`; la derivazione L2 non avviene, L0/L1 restano (`19§10`) |
| E20 | Geo (tutte) | IP riservato o CGNAT (RFC1918, 100.64/10, link-local) | Nessuna geolocalizzazione possibile | Warning `citySkipped`; caso **più frequente** del progetto: le reti mobili usano CGNAT (`19§10`) |
| E21 | Geo (tutte) | Cambio paese improvviso | `travel`, non errore | Warning `countryShift` (`19§10`) |
| E22 | Geo (tutte) | Nessun cluster dominante | `unknown`, `confidence` bassa, il periodo non è aggregato | Warning `contextAmbiguous` (`19§10`) |
| E23 | Geo (tutte) | Re-import con toggle diversi | I campi già persistiti **non** vengono azzerati | Warning `contextStale`; il contesto si ricalcola solo con `recompute()` esplicito (`19§10`) |
| E24 | Geo (tutte) | Database geo non presente (non scaricato, o download fallito) | `city = null`, `country` resta, il nastro mostra il paese | Warning `cityDbMissing`; L0/L1 reggono da sole (`19§10`, D-B.2) |

### 5.1 Disponibilità dei dati di contesto (matrice geo)

| Livello | Fonte | Spotify | YouTube Music | Apple Music | Last.fm / ListenBrainz | Toggle |
|---|---|:---:|:---:|:---:|:---:|---|
| **L0** paese | `conn_country` | ✅ | ⚠️ (`locationInfos`, dietro il toggle `ytLocationInfos`, default OFF) | ❌ | ❌ | `retainCountry` (default ON) |
| **L2** città | derivato dall'IP via DB-MMDB locale | ✅ (opt-in) | ✅ (opt-in) | ❌ | ❌ | `retainCity` (default OFF) |
| **L1** contesto dedotto | pattern su paese + ora locale + dispositivo | ✅ | ✅ | ⚠️ (solo L1) | ⚠️ (solo L1) | `deriveContext` (default ON) |
| dispositivo | `platform` | ✅ | ❌ | ❌ | ❌ | `retainDeviceType` (default ON) / `retainDeviceDetail` (default OFF) |

Specifica: `19-GEO-CONTEXT.md` v1.0 🟢 APPROVED §2, §7.1 · `13-ADR/0009-local-ip-geolocation.md` v1.0 🟢 APPROVED.

## 6. Strategia di integrazione MVP

1. **Storico**: adapter di import file per Spotify, YouTube Music, Apple Music (+ Deezer quando disponibile)
2. **Continuo**: connessione opzionale a Last.fm / ListenBrainz; supporto Maloja self-hosted
3. **Normalizzazione**: unificazione tramite ISRC/MBID (ListenBrainz e Tidal come fonti di verità per gli identificatori)
4. **Arricchimento**: audio features da fonti esterne (vedi `05-ARCHITECTURE.md` §6)

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |
| 0.2 | Sessione 9 (2026-10-15) | Audit: E1 validata in S2 (riferimento `03-ADAPTERS/spotify.md`); chiarita distinzione `PlatformId` (sorgenti) vs `scrobbleHubs` (Subsonic/Roon/Maloja) (M4) |
| 0.3 | Sessione 39 (2026-10-21) | §3.2 allineato al formato Takeout verificato (header, subtitles, nomi localizzati, assenza durata); cross-ref spec adapter `03-ADAPTERS/youtube-music.md` (issue #96) |
| 0.4 | Sessione 40 (2026-10-21, issue #98) | §3.3 riscritto sul Play Activity 2026.2 (~143 colonne: durate, End Reason Type, shuffle/offline, device, ISO Country; `Artist Name` assente); tabella §4 Apple aggiornata (durata ✅, dispositivo/IP/skip ⚠️); E9 rettificata (due generazioni di schema); cross-ref spec adapter `03-ADAPTERS/apple-music.md` |
| 0.5 | Sessione 47 (2026-10-26, issue #145) | §3.8 riscritto: il canale MVP è l'**export API** (ZIP con JSONL), non la paginazione `/listens` — la doc prescrive l'export per lo storico completo e ne sconsiglia la paginazione; corretti i limiti (`MAX_ITEMS_PER_GET` = 1000, non 100; rate limit 1 req/s, User-Agent obbligatorio, HTTPS only, CORS verificato sul sorgente); `recording_msid` documentato come hash dei metadati (**non** ID univoco per ascolto); `duration_ms` opzionale e di durata catalogo → E12; export non atomico → E13; cross-ref spec adapter `03-ADAPTERS/listenbrainz.md` |
| 0.6 | Sessione 50 (2026-10-26, issue #144) | §3.7 riscritto: Last.fm **non ha un export utilizzabile dall'app** (l'export GDPR è manuale, asincrono, incompleto, e richiede di degradare la privacy dell'utente) → il canale MVP è l'API `user.getRecentTracks` via **proxy CORS configurato dall'utente** (l'API non emette `Access-Control-Allow-Origin`: dalla PWA la fetch sarebbe bloccata). Corretti i limiti (`limit` max **200**, non 1000; `artist` è stringa senza `extended=1` e oggetto con `extended=1`; il brano in riproduzione **non ha `date`**; il rate limit non è pubblicato e non ci sono header di rate limit); `mbid` del brano solo con `extended=1` e frequentemente vuoto → tabella §4 corretta da ❌ a ⚠️ per ISRC/MBID e per "brani salvati"; `loved` disponibile ma senza campo nel modello → ⚠️. Aggiunti E14-E18; cross-ref spec adapter `03-ADAPTERS/lastfm.md` |
| 0.7 | Sessione 57 (2026-10-27, issue #172) | **Story 1.5 ratificata** (`20-SCROBBLING-HUB.md` v1.0 🟢 APPROVED): §3.7 e §3.8 — aggiunto il rimando al **percorso di scrittura** dei due hub (contratto `13-ADR/0011-scrobble-sink.md` 🟢 v1.0): per Last.fm `track.scrobble` con `sk` + `api_sig` (md5 in JS puro, D-SH.11) e trasporto via proxy dell'utente che deve inoltrare una **POST con body**, con **modalità dichiarata** (`solo lettura` / `lettura + scrittura`, D-SH.14); per ListenBrainz `POST /1/submit-listens` con User Token, CORS abilitato e **nessun proxy**. §3.9 — la nota su `PlatformId` ora dice che `scrobbleHubs` è una lista di **`ScrobbleHubId`** (tipo dedicato, `02§3.8`) e non di `PlatformId`. Header allineato (era fermo a v0.2 dal Sessione 9, mentre il changelog era già alla 0.6) |
| 0.8 | Sessione 67 (2026-10-30, issue #201) | **Story 1.6 ratificata** (`19-GEO-CONTEXT.md` v1.0 🟢 APPROVED): §5.1 nuova — **matrice di disponibilità dei dati di contesto** (L0 paese, L1 contesto dedotto, L2 città, dispositivo) con la colonna dei toggle; §5 — aggiunti gli edge case geo **E19..E24** (rinumerati: nella v0.2 di `19` erano E11..E15, ma **E11..E18 erano già presi** in questo catalogo dagli edge case di ListenBrainz e Last.fm — due significati diversi per lo stesso identificatore); E24 è il caso nuovo «database geo non presente» (D-B.2, download on-demand). |
