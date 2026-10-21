---
number: 39
title: "Specifica adapter YouTube Music (Story 1.1)"
date: 2026-10-21
state: 🟡
branch: feat/96-ytmusic-adapter-spec
pr: 0
claim: kilo-HP-ELITEBOOK-guck
cross_refs: [96]
tags: [docs, adapter, youtube-music, spec, phase-1]
---

# Sessione 39 — Specifica adapter YouTube Music

## Sintesi

Prima delle tre specifiche adapter che sbloccano l'EPIC 1 (Fase 1 — Import core): `docs/03-ADAPTERS/youtube-music.md` per la Story 1.1, compilata secondo `SPEC-TEMPLATE.md` v1.1 (schema flat `02§3.2`, stile `spotify.md` v1.2). Il formato Google Takeout è stato verificato su fonti 2026 (struttura `YouTube and YouTube Music/history/watch-history.json`, campi `header`/`time`/`title`/`titleUrl`/`subtitles`/`products`, assenza di durate, CSV playlist senza titoli, nomi di cartelle localizzati) prima di fissare le decisioni con il Boss.

Le sette decisioni di specifica (D1-D7) sono state chiuse **insieme al Boss** prima della stesura; la più delicata è D2 (semantica temporale): `02§2` APPROVED prescrive `timestamp = time + durata stimata (da catalogo)`, ma il Takeout non contiene durate e all'import il catalogo non esiste. Soluzione: importare con `durationMs = 0` e `timestamp = time`, con `eventKey` stabile derivato dai soli dati grezzi (`sha1(videoId + '|' + rawTime)`) che abilita una correzione post-enrichment senza rompere l'idempotenza.

## Trigger

Il project owner ha chiesto di procedere con il prossimo blocco di lavoro: EPIC 1 (Fase 1), le specifiche adapter YouTube Music / Apple Music / Last.fm+ListenBrainz in `docs/03-ADAPTERS/`. Decisioni di layout prese insieme: 2 file separati per 1.3, 3 PR separate, fixture differite all'implementazione, Story 1.4 dopo le specifiche. Ordine di scrittura: YT Music → Apple Music → Last.fm → ListenBrainz.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.39.1 | Solo export JSON; HTML rifiutato con errore guidato (`error.htmlExport`) | Il formato va selezionato esplicitamente in Takeout; parsare HTML regredirebbe l'affidabilità |
| D.39.2 | `timestamp = time`, `durationMs = 0`, `startedAt = time`, `eventKey = sha1(videoId + '\|' + rawTime)` | L'export non ha durate e il catalogo non esiste ancora all'import; l'eventKey su dati grezzi rende la correzione temporale futura (post-enrichment) idempotente. Conformizza `02§2` nel MVP con degradazione dichiarata |
| D.39.3 | Filtro E6 = `header` + euristica canale (`- Topic` / `VEVO`, host `music.youtube.com`, `products` come fallback); non-musica → skip con warning | Il Takeout unifica video e musica; i canali "- Topic" e VEVO sono il segnale più affidabile di brano ufficiale |
| D.39.4 | Video rimossi/privati → skip con warning `unwatchableSkipped` | `title` degenera in "Watched <url>" senza metadati: non upsert-abili su `Track` |
| D.39.5 | Playlist/library Takeout differite post-MVP con warning `info.playlistsDeferred` | I CSV playlist hanno solo `Video ID` + timestamp (nessun titolo → non mappabili su `Track.name` NOT NULL); fuori dagli AC della Story 1.1 |
| D.39.6 | Detection **strutturale** (contenuto), mai su path/filename | I nomi di cartelle e file Takeout sono localizzati per lingua account (E.YT.1) |
| D.39.7 | Solo `watch-history.json`; `search-history.json`/`MyActivity.json`/CSV fuori scope | Ridurre la superficie dell'adapter MVP agli AC della Story 1.1 |
| D.39.8 | `locationInfos` sempre scartati, nessun toggle | Potenziale dato geografico sensibile; nessun toggle dedicato nello schema → scarto incondizionato (più restrittivo di `retainIp`) |

## Edge case nuovi catalogati

E.YT.1 (nomi localizzati → detection strutturale), E.YT.2 (video rimossi → skip+warning), E.YT.3 (prefisso verbo localizzato nel `title` → lista curata EN/IT con fallback), E.YT.4 (cronologia incompleta → dichiarato all'utente), E.YT.5 (durata assente → DEDUP-3 degradato a bucket 0), E.YT.6 (duplicati cross-export → eventKey idempotente).

## Verifica

- `scripts/generate-bundle.ps1 --check` → exit 0 (dopo rigenerazione con `$files` esteso)
- `scripts/aggregate-state.ps1 --check` → exit 0 (dopo rigenerazione blocchi con la nuova sessione 39)
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati

## Lesson learned

| # | Osservazione |
|---|--------------|
| 39-1 | `pwsh` (PowerShell 7) non è installato su questa macchina: gli script repo (`setup-worktree.ps1`, `generate-bundle.ps1`, `aggregate-state.ps1`) vanno invocati con `& .\script.ps1` dentro Windows PowerShell 5.1 — coerente con il limite bash-noted in S37 |
| 39-2 | In PowerShell 5.1, qui-string inline come argomento di `gh issue create --body-file -` non viene parsata come stringa: scrivere il body su file temporaneo e passare il path |

## Documenti aggiornati

- `docs/03-ADAPTERS/youtube-music.md` (**nuovo**) — la specifica
- `docs/01-PLATFORMS.md` — §3.2 allineato (header/subtitles/localizzazione/assenza durata) + cross-ref spec + changelog 0.3
- `docs/INDEX.md` — riga 03-ADAPTERS + "Prossimo step tecnico" (S39)
- `docs/11-BACKLOG.md` — nota riga Story 1.1 nella tabella roadmap + changelog v1.6.1
- `scripts/generate-bundle.ps1` — `$files` con `youtube-music.md` + `docs/BUNDLE.md` rigenerato
- `docs/state/sessions/39-ytmusic-adapter-spec.md` (**nuovo**) — questa entry + blocchi aggregati rigenerati

## Cross-refs

- **#96** — issue di questo lavoro (spec YT Music, Story 1.1)
- **`11-BACKLOG.md`** §"Stato di avanzamento" — riga 1.1 aggiornata
- Prossime: spec Apple Music (Story 1.2), spec Last.fm + ListenBrainz (Story 1.3, due file)
