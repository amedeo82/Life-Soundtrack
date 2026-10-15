# 03-ADAPTERS/SPEC-TEMPLATE — Template Specifica Adapter

> Status: 🟢 APPROVED · Versione 1.1 · Sessione 9 (audit 2026-10-15)
> Scopo: formato riutilizzabile per ogni adapter. Copia questo template in `03-ADAPTERS/<platform>.md` e compilalo.

---

# Adapter <PLATFORM_NAME>

> Status: 🟡 DRAFT · Versione 0.1 · Ultima modifica: <data>
> Piattaforma: <nome commerciale>
> Sede legale: <paese>
> Tier: <S / A / B> · Priorità MVP: <sì / no>

## 1. Metodi di accesso

| Canale | Disponibile | Formato output | Frequenza | Note |
|--------|:-----------:|----------------|-----------|------|
| Export GDPR | sì/no | <JSON/CSV/ZIP> | Manuale | |
| API pubblica | sì/no | <REST/GraphQL> | Real-time | |
| Scrobbling (Last.fm/LB) | sì/no | — | Continuo | |
| File utente diretto | sì/no | <descrivi> | — | |

## 2. Flusso di import

[Stato iniziale] → [Rilevamento formato] → [Parsing streaming] → [Normalizzazione] → [Upsert DB]


Descrivi:
- Come l'utente procura il file (URL, passaggi)
- Come l'adapter lo riconosce (`detect(input)`)
- Come gestisce file multipli

## 3. Mapping campi sorgente → unificato

> **Importante (Sessione 9)**: lo schema `02-DATA-SCHEMA.md` v1.1 ha reso `ListenEvent` **piatto**: tutti i campi al top level, con `trackId` come FK all'entità `Track` (vedi `02§3.2` e `02§3.3`). I metadati di brano (`name`, `artistId`, `albumId`, `isrc`, `mbid`, `genres`) vivono sull'entità `Track` separata, non sul ListenEvent.

### 3.1 ListenEvent (top-level, piatto — vedi `02§3.2`)

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `eventKey` | — | — | `platform + ':' + (sourceEventId ?? sha1(trackKey + ts + durationMs))` | vedi `05§3.2` |
| `platform` | (fisso) | `PlatformId` | — | — |
| `importId` | (interno) | uuid | generato al parse | FK a `imports` |
| `timestamp` | — | unix ms | vedi §5 (semantica temporale) | fine ascolto, UTC |
| `startedAt` | — | unix ms \| null | `timestamp - durationMs` se ricavabile | inizio ascolto, UTC |
| `durationMs` | — | int | diretto | — |
| `trackId` | (interno) | uuid | **risolto dal core via DEDUP** (`02§5`) — adapter non lo calcola | FK a `tracks` |
| `completed` | — | bool | `durationMs >= durataCatalogo - 5000` | derivata |
| `skipped` | — | bool \| null | regola derivata se inaffidabile | vedi §3.3 |
| `shuffle` | — | bool \| null | diretto | — |
| `offline` | — | bool \| null | diretto | — |
| `incognito` | — | bool \| null | diretto | — |
| `reasonStart` | — | string \| null | raw | enum della piattaforma |
| `reasonEnd` | — | string \| null | raw | enum della piattaforma |
| `deviceType` | — | `DeviceType` | mapping pattern → enum | vedi §3.2 mapping |
| `deviceDetail` | — | string \| null | raw | stringa piattaforma |
| `ip` | — | string \| null | **SOLO se `PrivacySettings.retainIp` true** | mai inviato in rete |
| `country` | — | string \| null | ISO 3166-1 alpha-2 | derivato anche se `ip` scartato |
| `day` | (derivato) | `YYYY-MM-DD` | da `timestamp` UTC | indice critico |

**Non mappare** qui: `track.name`, `track.artistId`, `track.albumId`, `track.isrc`, `track.mbid` — vanno nell'entità `Track` (vedi §3.1.1).

### 3.1.1 Track (entità separata — vedi `02§3.3`)

L'adapter emette metadati del brano, il core li normalizza e li upserta in `tracks` deduplicando per `canonicalKey` (DEDUP-1/2/3).

| Campo Track | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-------------|----------------|---------------|----------------|------|
| `name` | — | string | `normalize(rawName)` | vedi `02§5 normalize()` |
| `artistId` | — | uuid | risolto da `tracks.artists` (dedup per nome normalizzato) | FK a `artists` |
| `albumId` | — | uuid \| null | risolto da `tracks.albums` (dedup per nome+artistId) | FK a `albums` |
| `durationMs` | — | int \| null | diretto | usato in DEDUP-3 |
| `isrc` | — | string \| null | upper-case | se presente → DEDUP-1 |
| `mbid` | — | string \| null | MusicBrainz Recording ID | se presente → DEDUP-2 |
| `genres` | — | string[] | popolato se la piattaforma li fornisce (es. Last.fm tags) | enrichment successivo |
| `platformIds` | — | `Partial<Record<PlatformId, string>>` | accumulato cross-import | ID nativo della piattaforma |

### 3.1.2 Artist / Album (entità separate — vedi `02§3.3`)

Stessa logica di Track. L'adapter emette `{name, mbid?, platformIds?}` per Artist e `{name, artistId, mbid?, upc?, releaseDate?, platformIds?}` per Album. Il core fa upsert con dedup per nome normalizzato (Artist) o nome+artistId (Album).

### 3.2 Library / Playlist (vedi `02§3.7`)

| Entità | Campo | Sorgente | Note |
|--------|-------|----------|------|
| LibraryItem | `kind`, `trackId`/`albumId`/`artistId`, `addedAt` | `YourLibrary.json` (Spotify) o equivalente | vedi `02§3.7` |
| Playlist | `name`, `createdAt`, `lastModifiedAt` | `Playlist*.json` o equivalente | — |
| PlaylistItem | `playlistId`, `trackId`, `position`, `addedAt` | items dentro playlist | PK composita `[playlistId+trackId]` |

## 4. Edge case noti (catalogo E)

Copia da `01-PLATFORMS.md` §5 filtrando per piattaforma.

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E.N.1 | — | — | — |

## 5. Semantica temporale

Specifica se il timestamp sorgente è inizio o fine ascolto. Come si derivano `timestamp` (fine) e `startedAt` (inizio)?

## 6. Regole di dedup tracce

Riferimento a `02-DATA-SCHEMA.md` §5 (DEDUP-1..3).

## 7. Comportamento privacy

| Dato sensibile | Default | Se `retainIp` true |
|----------------|---------|---------------------|
| IP address | scartato dopo `country` | conservato |
| Coordinate GPS | mai raccolte | mai raccolte |

## 8. Test — fixture atteso

Riferimento a `fixtures/synthetic-history/<platform>-sample.json`.

Casi di test minimi:
1. Import pulito (happy path)
2. Idempotenza (re-import → 0 duplicati)
3. Ogni edge case E.N.x → risultato atteso
4. DEDUP: due record stesso ISRC → una sola track
5. DEDUP: due record omonimi, durata diversa → due track

## 9. Segnalazione all'utente

Elenco codici i18n (`08-COPY-I18N.md`) usati dall'adapter.

## 10. Note di implementazione

Dettagli specifici (rate limit API, chunking, formati compressione).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 2 | Template approvato |
| 1.1 | Sessione 9 (2026-10-15) | Audit: §3.1 riscritto per schema flat (`02§3.2`); aggiunto `trackId` come FK risolta dal core; nuove §3.1.1 (Track) e §3.1.2 (Artist/Album) come entità separate; §3.2 rinominata Library/Playlist |