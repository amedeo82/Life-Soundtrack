---
number: 107
title: "Artwork enrichment: la cascata iTunes → Cover Art Archive → placeholder"
date: 2026-11-09
state: 🟢
merged: true
merged_commit: "c277aba8bf4ce046e59ae318a4fdc280a01a4aac"
merged_date: "2026-11-09T17:53:23Z"
branch: feat/242-story-4-3---artwork-enrichment
pr: 326
claim: kilo-HP-EliteBook-475468101
---

# Sessione 107 — Artwork enrichment (Story 4.3)

**Issue di tracking**: **#242** (`status:done`, `area:enrichment`, `size:M`)
**Branch**: `feat/242-story-4-3---artwork-enrichment`
**PR**: **#326** — merged il 2026-11-09T17:53:23Z (merge commit `c277aba8bf4ce046e59ae318a4fdc280a01a4aac`)
**Data**: 2026-11-09

## Sintesi

Implementazione della **Story 4.3** sulla spec `docs/24-ARTWORK-ENRICHMENT.md` (v1.0 🟢 APPROVED, Sessione 87).

Consegnato:

- `packages/core/src/enrichment/artwork.ts`: il resolver `fetchArtworkUrl` con la cascata **iTunes → Cover Art Archive → placeholder** (D-24.2: il ramo Spotify Web API **non esiste**), il placeholder deterministico (gradient SVG in data URI, mai rete) e il rispetto del toggle `enrichMetadata` (zero uscite, zero scritture, zero letture cache quando spento).
- Persistenza: scrittura su `Track.artworkUrl` / `Album.artworkUrl` (deduplicazione per album) e **cursore in `settings`** (`artwork.cursor`) invece di una migrazione dello schema (D-24.3).
- Rate limiting: iTunes 20/min (intervallo 3 s), Cover Art Archive 1 req/s.
- Trigger: job di arricchimento in coda dopo l'import, con la stessa disciplina di budget e interruzione della coda audio.
- CSP: costante `COVER_ART_HOST` in `apps/web/src/security/hosts.ts` + `connect-src` in `csp.ts` + test CSP (il quarto host dichiarato, `12§2.1`).
- UI: `MemoryCard` con `alt` e `loading="lazy"`, placeholder quando `artworkUrl` è `null`.
- Fixture: `fixtures/api-mocks/itunes/search-artwork.json` e `fixtures/api-mocks/coverartarchive/*`.
- **142 test** nuovi in `@ls/core` (unit, integrazione, property-based con PRNG seeded, scenari) + **15** in `@ls/web` (CSP, i18n, MemoryCard).

Fuori perimetro e dichiarato: cache binaria delle immagini (D-24.6), colore dominante dell'era (story separata), lookup MusicBrainz (Story 4.2, P2 — il ramo Cover Art Archive è progettato per funzionare anche senza), OAuth Spotify (D-24.2).

## Analisi di avanzamento

Il percorso dell'app è completo end-to-end (EPIC 3: 5/5) e l'**EPIC 2** ha consegnato mood, ere, eventi e ricordi, collegati all'app dalla 2.5. Con questa sessione anche l'**EPIC 4** ha il suo pezzo visivo: le copertine sono popolate e il mood dell'era può guardarle. Restano **4.2** (lookup MusicBrainz, P2 — miglioramento incrementale, non prerequisito), **5.2/5.1** (export e purge: il gate per testare con dati personali reali) e **6.1** (upgrade stack, post-implementazione). Salute tecnica: gate locali verdi (lint, typecheck, test, build), nessun drift fra i blocchi aggregati e le sezioni legacy dei documenti toccati.

## Documenti aggiornati

- `docs/state/stories/4.3-artwork-enrichment.md` — frontmatter completo (`pr: 326`, `merged_commit`, `merged_date`) e stato ✅ DONE
- `docs/state/sessions/107-artwork-enrichment.md` — questo file
- `docs/02-DATA-SCHEMA.md` §11 — cascata allineata (iTunes → Cover Art Archive → placeholder), versione 1.8
- `docs/05-ARCHITECTURE.md` §6 — sottosezione sull'arricchimento artwork, versione 1.6
- `docs/11-BACKLOG.md` — sezione legacy Story 4.3 allineata a ✅ DONE, versione 1.6.38
- `docs/18-DEV-LOG.md` — entry §58 + changelog 2.41
- `docs/INDEX.md` — righe `02`, `05`, `11` e "Prossimo passo tecnico"
- `docs/12-DEVOPS.md` §2.1 — host `coverartarchive.org` già dichiarato (PR #326)

---

**Claim**: `kilo-HP-EliteBook-475468101` (UTC 2026-11-09T16:18:38Z)
