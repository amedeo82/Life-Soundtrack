# Adapter Spotify

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 2
> Tier: **S** · Priorità MVP: **sì**

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | ✅ | JSON in ZIP | Manuale | "Extended streaming history" |
| API pubblica | ⚠️ | REST | Real-time | Deprecate audio-features (2024-11); Dev Mode limitato |
| Scrobbling LB/L.fm | ✅ | — | Continuo | via client terzi |

**Canale principale MVP**: Export GDPR. L'API pubblica è usata solo per recupero catalog metadata (non per cronologia).

## 2. Flusso di import

### 2.1 Come l'utente procura il file

1. Account Spotify → Privacy → "Download your data"
2. Seleziona **"Extended streaming history"** (non la cronologia breve!)
3. Attesa: da 4 ore a 30 giorni (email con link)
4. Download: archivio ZIP contenente:
   - `Streaming_History_Audio_<periodo>_<n>.json` (uno o più)
   - `Streaming_History_Video_<periodo>.json` (se presente)
   - `Streaming_History_Podcast_<periodo>_<n>.json`
   - `Streaming_History_Audiobook_<periodo>_<n>.json`
   - `SearchQueries.json`
   - `Playlist*.json`
   - `YourLibrary.json`
   - `Follow.json`
   - `Wrapped*.json`, `Userdata.json`
   - Technical log: `CarDetectionEvent.json`, `AdRequestEvent.json`

### 2.2 Rilevamento formato (`detect`)

L'adapter riconosce il file da:
- **ZIP**: contiene almeno un file `Streaming_History_Audio_*.json`
- **JSON singolo**: array di oggetti con campo `spotify_track_uri`
- **Rifiuta** file senza `ts` e `ms_played`

### 2.3 Parsing

- Iterazione streaming sui JSON (AsyncIterable)
- Chunk da ~1000 eventi per batch di upsert
- Gestione file multipli audio/video/podcast/audiobook in parallelo
- File `SearchQueries.json`, `Playlist*.json`, `YourLibrary.json`, `Follow.json` processati separatamente per popolare library/playlists

## 3. Mapping campi sorgente → unificato

### 3.1 ListenEvent

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `timestamp` | `ts` | ISO 8601 UTC | `Date.parse(ts)` | **FINE ascolto** |
| `startedAt` | — | — | `timestamp - ms_played` | derivato |
| `durationMs` | `ms_played` | int | diretto | |
| `eventKey` | — | — | `'spotify:' + (spotify_track_uri ?? sha1(name+artist+ts))` | se URI mancante (podcast?), hash |
| `platform` | (fisso) | — | `'spotify'` | |
| `track.name` | `master_metadata_track_name` | string/null | diretto; null → skip evento | |
| `track.artist` | `master_metadata_album_artist_name` | string/null | diretto; null → "Unknown" | |
| `track.album` | `master_metadata_album_album_name` | string/null | nullable | |
| `track.isrc` | — | — | null (non nell'export GDPR) | recuperabile via MBID lookup successivo |
| `track.mbid` | — | — | null | lookup enrichment pipeline |
| `deviceType` | `platform` | string | mapping §3.2 | |
| `deviceDetail` | `platform` | string | valore raw | |
| `country` | `conn_country` | string | ISO 3166-1 alpha-2 | |
| `ip` | `ip_addr` | string | conservato SOLO se `PrivacySettings.retainIp` | |
| `shuffle` | `shuffle` | bool | diretto | |
| `skipped` | `skipped` + `reason_end` | bool | regola derivata E1 | |
| `offline` | `offline` | bool | diretto | |
| `incognito` | `incognito_mode` | bool | diretto | |
| `reasonStart` | `reason_start` | string | diretto | |
| `reasonEnd` | `reason_end` | string | diretto | |
| `completed` | — | — | `ms_played >= durataCatalogo - 5000` | 5s tolleranza |

### 3.2 Mapping `platform` → `deviceType`

| Pattern `platform` | `deviceType` |
|---------------------|--------------|
| `/Android/i` | `mobile` |
| `/iOS|iPhone|iPad/i` | `mobile` |
| `/Windows|Linux|OS X|Mac/i` | `desktop` |
| `/web_player|WebPlayer/i` | `web` |
| `/car|CarPlay|Android Auto/i` | `car` |
| `/speaker|Cast|Sonos/i` | `speaker` |
| altro | `unknown` |

Nota: post ott-2023 `platform` è generico (`android`, `windows`, `linux`). In questi casi `deviceDetail` è meno informativo ma `deviceType` resta derivabile.

### 3.3 Regola `skipped` derivata (edge case E1)

Il campo `skipped` Spotify è inaffidabile (tutti false tra 2015-04 e 2022-10). Adottiamo:

    isSkipped = skipped === true
             OR reason_end IN ('backbtn', 'fwdbtn', 'unknown')
             OR (reason_end === 'endplay' AND ms_played < durataCatalogo * 0.80)

`durataCatalogo` è la durata del brano da metadata; se non disponibile, soglia fissa `ms_played < 30000`.

### 3.4 Library / Playlist / Artist / Album

| Entità | File sorgente | Campo chiave |
|--------|---------------|--------------|
| Artist seguito | `Follow.json` | `artist` + `spotify_artist_uri` |
| Album salvato | `YourLibrary.json` (`tracks`) | dedotto da track salvata |
| Track salvata | `YourLibrary.json` (`tracks`) | `trackUri` |
| Playlist | `Playlist*.json` | `name`, `lastModifiedDate` |
| PlaylistItem | `Playlist*.json` → `items` | `track.trackUri`, `addedDate` |

## 4. Edge case noti

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E1 | `skipped` inaffidabile 2015-04 → 2022-10 | Statistiche skip errate | Regola derivata §3.3 |
| E2 | Timestamp sovrapposti ~2.6% durata | Durata totale sovrastimata | Dedup via `eventKey` univoco; `ImportRecord.warnings` conta |
| E3 | `offline_timestamp` unità cambiate (s → ms) | Timestamp errato | Rileva valore < 1e12 → moltiplica 1000 |
| E4 | Stessa registrazione con URI diversi (singolo + album + compilation) | Conteggi frammentati | DEDUP via ISRC/MBID dopo enrichment |
| E5 | Granularità `platform` cambiata ott-2023 | Discontinuità deviceType | Mapping pattern-based §3.2 |
| E6 | Podcast / video / audiobook con `spotify_track_uri` null | Eventi incompleti | Se `episode_name` presente → tipo `podcast` (se supportato); altrimenti skip con warning |

## 5. Semantica temporale

- `ts` = **istante in cui lo stream è terminato** (fine ascolto)
- `timestamp` (unificato) = `ts`
- `startedAt` = `ts - ms_played`

## 6. Dedup tracce

- Export GDPR **non fornisce ISRC né MBID**
- `spotify_track_uri` non è ISRC/MBID (è ID proprietario Spotify)
- **DEDUP-3** si applica di default (fuzzy name+artist+duration bucket 2s)
- Dopo enrichment (MusicBrainz lookup opzionale) il canonicalKey può essere promosso a DEDUP-1/2 se ISRC/MBID trovato
- La promozione è implementata come job `rekey()` nel core

## 7. Privacy

| Dato | Default | Se `retainIp` true |
|------|---------|---------------------|
| `ip_addr` | scartato dopo derivazione `country` | conservato in `ListenEvent.ip` |
| Coordinate GPS | mai presenti nell'export | n/a |
| `SearchQueries.json` | processato, conservato in `searchQueries` (tabella dedicata, opzionale) | idem |
| `CarDetectionEvent.json` | processato SOLO se utente acconsente (opt-in esplicito separato) | idem |

Nota: `CarDetectionEvent` è sensibile (tracciamento movimenti). Trattarlo come **consenso separato** da `retainIp`.

## 8. Test — fixture atteso

File: `fixtures/synthetic-history/spotify-sample.json` (Sessione 2 — vedi sotto).

Casi minimi:
1. **Happy path**: 3 eventi normali → 3 ListenEvent, 3 track uniche
2. **Idempotenza**: re-import stesso file → 0 nuovi eventi (`eventsDuplicated = 3`)
3. **E1 skipped**: evento con `reason_end: 'fwdbtn'`, `skipped: false` → `skipped: true` derivato
4. **E3 offline**: `offline_timestamp: 1625932808` (vecchia unità) → convertito a `1625932808000`
5. **E4 URI duplicati**: due eventi con URI diversi ma stesso nome+artista+durata → una sola Track
6. **E5 platform pre/post ott-2023**: entrambi mappati a `deviceType` corretto
7. **E6 podcast**: evento con `episode_name` non null → evento tipo `podcast` o skip con warning
8. **DEDUP promozione**: dopo enrichment con ISRC trovato, canonicalKey cambia da `fuzzy:...` a `isrc:...`
9. **Privacy retainIp=true**: `ip` conservato
10. **Privacy retainIp=false**: `ip` = null, `country` valorizzato

## 9. Segnalazione all'utente

| Codice i18n | Messaggio | Quando |
|-------------|-----------|--------|
| `adapter.spotify.detect.success` | "File Spotify riconosciuto" | detect ok |
| `adapter.spotify.detect.fail` | "File non riconosciuto come export Spotify" | detect ko |
| `adapter.spotify.warn.podcastSkipped` | "X episodi podcast esclusi (formato non supportato)" | E6 |
| `adapter.spotify.warn.overlaps` | "X eventi sovrapposti temporali rilevati" | E2 |
| `adapter.spotify.warn.offlineConverted` | "X timestamp offline convertiti" | E3 |
| `adapter.spotify.info.complete` | "Import completato: X eventi, Y brani unici" | fine |

## 10. Note implementative

- **Chunking**: batch da 1000 eventi per upsert, per evitare memory spike su file grandi (155MB+ di JSON pretty-printed)
- **Streaming parse**: usare `stream-json` o equivalente per AsyncIterable; non caricare tutto il JSON
- **Retry enrichment**: se MusicBrainz lookup fallisce per un track, riprova dopo 24h (queue)
- **Ordine file**: processare i JSON in ordine cronologico inverso (più recente → più vecchio) per avere `lastSeenAt` corretto al primo passaggio

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 2 | Prima specifica completa |