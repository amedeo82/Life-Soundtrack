# 03-ADAPTERS/SPEC-TEMPLATE — Template Specifica Adapter

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 2
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

### 3.1 ListenEvent

| Campo unificato | Campo sorgente | Tipo sorgente | Trasformazione | Note |
|-----------------|----------------|---------------|----------------|------|
| `timestamp` | — | — | — | vedi §5 (semantica temporale) |
| `startedAt` | — | — | — | derivato se mancante |
| `durationMs` | — | — | — | — |
| `eventKey` | — | — | — | regola di calcolo |
| `platform` | (fisso) | string | — | — |
| `track.name` | — | string | — | — |
| `track.artist` | — | string | — | — |
| `track.album` | — | string | — | nullable |
| `track.isrc` | — | string | — | nullable |
| `track.mbid` | — | string | — | nullable; lookup se possibile |
| `deviceType` | — | string | — | mapping a enum |
| `deviceDetail` | — | string | — | stringa raw |
| `country` | — | string | — | ISO 3166-1 |
| `ip` | — | string | — | SOLO se `retainIp` true |
| `shuffle` | — | bool | — | nullable |
| `skipped` | — | bool | — | regola derivata se inaffidabile |
| `offline` | — | bool | — | nullable |
| `incognito` | — | bool | — | nullable |
| `reasonStart` | — | string | — | raw string |
| `reasonEnd` | — | string | — | raw string |
| `completed` | — | bool | — | derivata da duration/total |

### 3.2 Library / Playlist / Artist / Album

| Entità | Campo | Sorgente | Note |
|--------|-------|----------|------|
| Artist | — | — | — |
| Album | — | — | — |
| Playlist | — | — | — |
| PlaylistItem | — | — | — |

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