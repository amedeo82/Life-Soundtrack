# 01 — Matrice Piattaforme e Dati Ottenibili

> Status: 🟡 DRAFT
> Versione: 0.2
> Ultima modifica: Sessione 9 (audit 2026-10-15)
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

- **API pubblica gratuita**: `user.getRecentTracks` paginabile sull'intero storico, top artists/tracks/albums per periodo, weekly charts
- **Campi**: name, artist, album, `date`, `loved`
- **Limiti**: nessun contesto (device/luogo); solo dati scrobblati; rate limit ~5 req/s

### 3.8 ListenBrainz 🌐 (no-profit) — Tier S (come hub)

- **API pubblica senza limiti restrittivi**: `/1/user/{username}/listens` paginabile
- **Campi**: `listened_at`, `track_metadata.track_name/artist_name/release_name`, `additional_info`: **`recording_mbid`, `artist_mbids`, `release_mbid`, `isrc`, `spotify_id`, `youtube_id`, `origin_url`**
- **Valore unico**: identificativi MusicBrainz/ISRC nativi → normalizzazione perfetta tra piattaforme

### 3.9 Self-hosted (Plex, Navidrome, Subsonic, Roon) — Tier S+ per nicchia

- Nessuna piattaforma commerciale: librerie personali (CD digitalizzati, acquisti, file rari)
- Integrazione via scrobbling (Maloja, multi-scrobbler, webhook Plex→ListenBrainz)
- **Valore unico**: copre la parte più intima della storia musicale, invisibile alle piattaforme
- **Nota su `PlatformId`**: in `02-DATA-SCHEMA.md` le piattaforme commerciali sono in `PlatformId`; Subsonic/Roon/Maloja **non** sono piattaforme sorgente del modello, ma **hub di scrobbling** — vivono in `PrivacySettings.scrobbleHubs` (e nell'eventuale adapter Subsonic dedicato in `03-ADAPTERS/`, fuori perimetro MVP). `navidrome` è in `PlatformId` come caso particolare di Subsonic API.

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
| Brani salvati | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| ISRC / MBID | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
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