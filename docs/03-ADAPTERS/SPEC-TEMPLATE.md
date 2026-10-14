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

## 2. Flusso di import (solo export GDPR se applicabile)

[Stato iniziale] → [Rilevamento formato] → [Parsing streaming] → [Normalizzazione] → [Upsert DB]


Descrivi:
- Come l'utente procura il file (URL, passaggi)
- Come l'adapter lo riconosce (`detect(input)` — firma magica, header, nome file)
- Come gestisce file multipli (Spotify: ZIP con JSON partizionati)

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

Copia il catalogo da `01-PLATFORMS.md` §5 filtrando per questa piattaforma, poi aggiungi eventuali nuovi:

| # | Descrizione | Impatto | Azione adapter |
|---|-------------|---------|----------------|
| E.N.1 | — | — | — |

## 5. Semantica temporale

Specifica chiaramente: il timestamp sorgente rappresenta **l'inizio** o la **fine** dell'ascolto? Come si derivano `timestamp` (fine) e `startedAt` (inizio)?

## 6. Regole di dedup tracce

Riferimento a `02-DATA-SCHEMA.md` §5 (DEDUP-1..3). Se la piattaforma fornisce ISRC/MBID, specificarlo. Altrimenti conferma DEDUP-3.

## 7. Comportamento privacy

| Dato sensibile | Default | Se `retainIp` true |
|----------------|---------|---------------------|
| IP address | scartato dopo `country` | conservato |
| Coordinate GPS | mai raccolte | mai raccolte |
| ... | — | — |

## 8. Test — fixture atteso

Riferimento a `fixtures/synthetic-history/<platform>-sample.json`. Il fixture deve contenere almeno un esempio di ogni edge case E.N.x.

Casi di test minimi:
1. Import pulito (happy path)
2. Idempotenza (re-import stesso file → 0 duplicati)
3. Ogni edge case E.N.x → risultato atteso documentato
4. DEDUP: due record con stesso ISRC → una sola track
5. DEDUP: due record omonimi senza ISRC, durata diversa → due track separate

## 9. Segnalazione all'utente

Elenco messaggi UI che l'adapter può emettere:
- Warning: "X eventi con timestamp invalidi scartati"
- Error: "Formato file non riconosciuto"
- Info: "Import completato: X eventi, Y brani unici"

Codici di warning/errori definiti in `08-COPY-I18N.md`.

## 10. Note di implementazione

Dettagli specifici per questa piattaforma che non rientrano nelle sezioni precedenti. Esempio: limiti di rate API, chunking consigliato, formati di compressione.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 2 | Template approvato |
| 0.1 | Sessione 2 | Prima bozza |