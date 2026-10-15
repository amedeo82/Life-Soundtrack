# 14 — Glossario di Dominio

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 1
> Definizioni univoche. In caso di conflitto tra un documento e questo glossario, vale questo glossario (finché non viene aggiornato).

## Termini di dominio

| Termine | Definizione |
|---------|-------------|
| **Listen Event** | Un singolo evento di ascolto: brano, istante, durata, contesto. Atomo del sistema (`ListenEvent`) |
| **Scrobble** | La registrazione automatica di un ascolto verso un hub esterno (Last.fm, ListenBrainz, Maloja) |
| **Sessione di ascolto** | Sequenza continua di listen event separati da pause inferiori al gap threshold (default 30 min) |
| **Era musicale** | Periodo prolungato (settimane/mesi) con caratteristiche musicali ed emotive coerenti, rilevato per clustering |
| **Mood** | Stato emotivo prevalente di un periodo, derivato da valence/energy. Valori: sad, angry, neutral, calm, happy, excited |
| **Ricordo (Memory)** | Insight di tipo memoriale: on_this_day, first_time, milestone, return, seasonal |
| **Evento (Event)** | Anomalia rilevata nei pattern di ascolto che suggerisce un cambiamento significativo (picco, crollo, esplorazione, silenzio) |
| **Insight** | Risultato derivato dell'analysis engine, persistito con verdetto utente (pending/confirmed/corrected/dismissed) |
| **Valence** | Punteggio 0..1 di positività emotiva percepita del brano |
| **Energy** | Punteggio 0..1 di intensità/attivazione del brano |
| **Danceability** | Punteggio 0..1 di attitudine al ballo del brano |

## Identificatori

| Termine | Definizione |
|---------|-------------|
| **ISRC** | International Standard Recording Code: identificativo univoco di una *registrazione* (12 caratteri) |
| **MBID** | MusicBrainz Identifier: UUID di un'entità MusicBrainz (recording, artist, release) |
| **UPC** | Codice univoco di un *prodotto* (album/release) |
| **canonicalKey** | Chiave di deduplicazione traccia: ISRC → MBID → fuzzy hash (regole DEDUP) |
| **eventKey** | Chiave di idempotenza di un listen event (platform + sourceEventId o hash) |
| **platformIds** | Mappa degli identificatori originali dello stesso brano sulle varie piattaforme |

## Architettura

| Termine | Definizione |
|---------|-------------|
| **Adapter** | Modulo che converte il formato di una piattaforma nel formato unificato |
| **Formato unificato** | Schema di `ListenEvent` e entità collegate (02-DATA-SCHEMA) |
| **Local-first** | I dati vivono sul dispositivo; il cloud è opzionale e aggiuntivo |
| **Privacy-first** | Nessuna PII esce dal dispositivo senza toggle esplicito dell'utente |
| **derivedVersion** | Hash del set di parametri che ha generato sessioni/insight; abilita ricalcolo coerente |
| **Fixture** | Dataset sintetico di test in `fixtures/synthetic-history/` |
| **ADR** | Architecture Decision Record: decisione architetturale registrata in `docs/13-ADR/` |

## Processo

| Termine | Definizione |
|---------|-------------|
| **agent-ready** | Label di issue la cui specifica è APPROVED: un agente può lavorarci |
| **needs-spec** | Label di issue bloccata in attesa di specifica |
| **APPROVED / DRAFT** | Stato di un documento: vincolante per gli agenti / in discussione |
| **Boss** | Project owner (@amedeo82), unica autorità di approvazione |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 1 | Prima versione |
| 1.0 | Sessione 1 | 🟢 APPROVED · Versione 1.0 · Sessione 1 |