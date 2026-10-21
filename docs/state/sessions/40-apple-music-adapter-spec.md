---
number: 40
title: "Specifica adapter Apple Music (Story 1.2)"
date: 2026-10-21
state: 🟢
merged: true
merged_commit: 372e0a2
merged_date: 2026-10-21T14:52:48+02:00
branch: feat/98-apple-music-adapter-spec
pr: 100
claim: kilo-HP-ELITEBOOK-osfm
cross_refs: [98]
tags: [docs, adapter, apple-music, spec, phase-1]
---

# Sessione 40 — Specifica adapter Apple Music

## Sintesi

Seconda specifica dell'EPIC 1: `docs/03-ADAPTERS/apple-music.md` per la Story 1.2, compilata su `SPEC-TEMPLATE.md` v1.1. La ricerca 2026 ha rivelato che il Play Activity CSV (schema `2026.2`, ~143 colonne) è **molto più ricco** di quanto censito in `01-PLATFORMS.md` §3.3 (durata ascoltata e catalogo, End Reason Type, shuffle/offline, device, ISO Country) e allo stesso tempo ha un limite nuovo: la colonna `Artist Name` è stata **rimossa** dagli export 2026 (artista solo via `Container Artist Name` sparse o enrichment).

Nella stessa PR: rettifica factuale della riga Apple in `02-DATA-SCHEMA.md` §2 (`Play Date UTC` appartiene al legacy; lo schema 2026.2 espone `Event Start/End Timestamp` — la regola "timestamp = fine ascolto" non cambia, solo il campo origine), allineamento `01-PLATFORMS.md` (§3.3, tabella §4, E9), e **promozione della spec YouTube Music a 🟢 APPROVED v1.0** (approvazione avvenuta col merge di PR #97, chiusa in S39).

## Trigger

Merge di PR #97 (spec YT Music APPROVED) → proseguimento del ciclo concordato: Apple Music (PR #2), poi Last.fm/ListenBrainz (PR #3), poi fixture + issue `agent-ready` per 1.1/1.2/1.3.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.40.1 | Fonti: Play Activity **+** Daily Tracks, ma il secondo SOLO come mappa candidati-artisti (regola unicità) e riconciliazione conteggi; MAI come ListenEvent | Scelta del Boss ("anche Daily Tracks"): non è joinabile per-riga con il Play Activity (nessuna chiave condivisa) → importarlo come eventi doppio-conterebbe; il suo valore è la copertura artisti ("Artista - Brano") e il segnale onesto di completezza |
| D.40.2 | 1 riga `PLAY_END` con `Play Duration ≥ 30s` = 1 ListenEvent; `eventKey = 'apple_music:' + Event ID` (fallback sha1 per legacy); scrub `SCRUB_BEGIN` esclusi; stitching differito a job futuro | L'export è un event stream, non una lista di ascolti; l'Event ID dà idempotenza perfetta anche multi-part/multi-export; il stitching renderebbe l'idempotenza fragile tra export con bordi diversi (stesso tradeoff di YT D2) |
| D.40.3 | Catena artista: `Artist Name` (legacy) → `Container Artist Name` (2026) → mappa Daily Tracks (brano con artista univoco) → `"Unknown"`; risoluzione completa via enrichment (Story 4.2) | `Artist Name` assente dal 2026.2; il Container Artist è l'artista del contenitore (approssimazione dichiarata); la mappa Daily Tracks entra solo con regola di unicità (mai match fuzzy) |
| D.40.4 | Privacy: IP → regola `retainIp` (come Spotify); IP city/region/lat/long → scartati SEMPRE; country da `ISO Country`/`Store Country Name` senza passare dall'IP | L'export Apple include geolocalizzazione derivata dall'IP: più sensibile dell'IP stesso; nessun campo/toggle nello schema → scarto incondizionato (stesso approccio di YT per `locationInfos`) |
| D.40.5 | Rettifica factuale `02§2` riga Apple + rettifica E9/tabella §4 in `01-PLATFORMS` | Il documento dichiarava campi che l'export attuale ha (e viceversa): doc-sync D.38.1 (sezioni legacy/fatti falsi); segnalato esplicitamente in review per l' APPROVED 02 |

## Edge case nuovi catalogati

E.AP.1 (event stream ≠ ascolti → 1 riga ≥30s = 1 evento + riconciliazione), E.AP.2 (`Artist Name` rimosso dal 2026.2 → catena fallback), E.AP.3 (legacy vs 2026.2 → tabella alias), E.AP.4 (ZIP annidato ≤5 livelli + multi-part), E.AP.5 (scrub: Play Duration = distanza jump → esclusi), E.AP.6 (album "Titolo - Single" → chiave normalizzata), E.AP.7 (radio: brani sì, idents no), E.AP.8 (snapshot → idempotenza via Event ID), E.AP.9 (~143 colonne → whitelist mapping).

## Verifica

- `scripts/generate-bundle.ps1 --check` → exit 0 (dopo rigenerazione con `$files` esteso)
- `scripts/aggregate-state.ps1 --check` → exit 0 (dopo rigenerazione blocchi con la sessione 40)
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati

## Lesson learned

| # | Osservazione |
|---|--------------|
| 40-1 | Su questa macchina (PS 5.1) gli script `--check` (`aggregate-state.ps1`, `generate-bundle.ps1`) riscrivono i file invece di solo-verificare: su `main` rigenerano l'header timestamp del BUNDLE e creano drift spurio — eseguire i writer SOLO dentro la worktree e ripristinare con `git checkout -- docs/BUNDLE.md` se capitato su main (incompatibilità PS 5.1 vs 7, issue #63) |
| 40-2 | L'export Apple 2026 ha rimosso `Artist Name` dalle righe di play: chi pianifica import Apple deve contare su enrichment per gli artisti — bene verificare i formati REALI correnti prima di scrivere specifiche (stessa lezione di S39 con Takeout) |

## Documenti aggiornati

- `docs/03-ADAPTERS/apple-music.md` (**nuovo**) — la specifica
- `docs/03-ADAPTERS/youtube-music.md` — promozione 🟢 APPROVED v1.0 (merge PR #97)
- `docs/02-DATA-SCHEMA.md` — §2 riga Apple (factual fix) + changelog v1.3
- `docs/01-PLATFORMS.md` — §3.3 riscritto, tabella §4 Apple, E9 rettificata, changelog 0.4
- `docs/INDEX.md` — riga 03-ADAPTERS + "Prossimo step tecnico" (S40)
- `docs/11-BACKLOG.md` — note righe 1.1/1.2 + changelog v1.6.2
- `scripts/generate-bundle.ps1` — `$files` + `docs/BUNDLE.md` rigenerato
- `docs/state/sessions/40-apple-music-adapter-spec.md` (**nuovo**) + blocchi aggregati rigenerati

## Cross-refs

- **#98** — issue di questo lavoro (spec Apple Music, Story 1.2)
- **#96 / PR #97** — spec YT Music (🟢 APPROVED in questa PR)
- Prossima: spec Last.fm + ListenBrainz (Story 1.3, due file separati)
