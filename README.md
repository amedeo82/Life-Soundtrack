# 🎵 Life Soundtrack

> *La colonna sonora della tua vita, finalmente leggibile.*

Life Soundtrack è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming musicale in un **diario di vita personale**: una timeline emotiva, contestuale e narrativa che racconta la storia dell'utente attraverso la musica che ha ascoltato.

## ✨ Cosa c'è oggi

- Importa la cronologia di ascolto dai servizi supportati e la normalizza in un database locale (Dexie/IndexedDB)
- **Tutto resta sul tuo dispositivo**: elaborazione locale, privacy-first
- PWA installabile, onboarding guidato con anteprima del risultato
- Interfaccia in italiano e inglese, strumenti di manutenzione e di purga del database

### Piattaforme importabili

- `spotify` — Spotify (export ZIP/JSON)
- `youtube_music` — YouTube Music (export HTML)
- `apple_music` — Apple Music (CSV)
- `listenbrainz` — ListenBrainz (export API: ZIP/JSONL)
- `lastfm` — Last.fm (file CSV/JSON, oppure API via proxy CORS con credenziali locali)

## 🗺️ Roadmap

Non ancora implementato — la roadmap completa, con lo stato di ogni story, è in [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md):

- **Analisi** (EPIC 2): mood giornaliero, ere, eventi e ricordi
- **Enrichment** (EPIC 4): audio features (valence, energy, danceability, BPM), artwork, generi
- **Altre piattaforme**: Deezer, Tidal, SoundCloud ([`docs/01-PLATFORMS.md`](docs/01-PLATFORMS.md) §3.4-3.6)
- **Scrobbling continuo** (Story 1.5): hub Last.fm / ListenBrainz / Maloja

## 🏗️ Stato del progetto

Lo **stato globale** (fase corrente, story completate, roadmap, prossimo passo) è gestito dai blocchi aggregati di [`docs/INDEX.md`](docs/INDEX.md) (`<!-- AGGREGATE-INDEX-STATUS-* -->`) e di [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md) (`<!-- AGGREGATE-STORIES-* -->`) — quelli, e non questo README, sono la **fonte di verità** per `status`, conteggi e roadmap. La sezione `11-BACKLOG.md` §"Stato di avanzamento — roadmap delle story non ancora completate" elenca cosa manca.

> Le sezioni legacy dei documenti globali (stato, conteggi, versioni, riferimenti) vanno allineate nella **stessa PR** che cambia i fatti che dichiarano: vedi [`AGENTS.md`](AGENTS.md) §"Chi può scrivere cosa nei file globali".

### Prossima story

<!-- AGGREGATE-NEXT-STEP-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V3, ADR-0008, issue #127).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

**Prossima story da implementare**: **1.5** — Scrobbling hub (invio scrobble, sync continua, toggle) (priority `I`, vedi `docs/11-BACKLOG.md`).

Sorgente: `docs/state/stories/1.5-scrobbling-hub.md`. Issue candidabile: filtra con `gh issue list --label agent-ready --state open` (vedi `docs/11-BACKLOG.md` §"Priorità di lavorazione per agenti").

<!-- AGGREGATE-NEXT-STEP-END -->

Il blocco sopra elenca la prima story non completata fra quelle **già migrate** in `docs/state/stories/`; le story ancora da implementare sono elencate nella tabella §"Stato di avanzamento" di `docs/11-BACKLOG.md`.

- Documentazione: [`docs/INDEX.md`](docs/INDEX.md)
- Protocollo agenti: [`AGENTS.md`](AGENTS.md)
- Visione: [`docs/00-VISION.md`](docs/00-VISION.md)
- Backlog: [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md)
- Diario implementazione: [`docs/18-DEV-LOG.md`](docs/18-DEV-LOG.md)
- Note sviluppo: [`docs/17-DEV-NOTES.md`](docs/17-DEV-NOTES.md)

## 🛠️ Sviluppo locale

Requisiti: Node ≥ 20, pnpm 9 (pinnato in `packageManager`).

```bash
pnpm install          # installa il workspace e attiva i git hook
pnpm run lint         # ESLint 9 flat config
pnpm run typecheck    # tsc --noEmit
pnpm run test         # Vitest
pnpm run build        # tsc + vite build
pnpm run e2e          # Playwright (prima volta: pnpm exec playwright install chromium)
```

Non esiste ancora uno script `dev`: per un preview locale esegui `pnpm run build` e poi `pnpm --filter @ls/web exec vite preview`.

> ⚠️ **PowerShell 5.1 (Windows senza `pwsh`)**: i gate `scripts/aggregate-state.ps1 -Check` e `scripts/generate-bundle.ps1 -Check` richiedono il **singolo trattino**. Il doppio trattino (`--check`) esce 2 con il call operator `&` a partire da issue #104; vedi `docs/12-DEVOPS.md §9.7b`.

## 🤝 Come contribuire

Questo progetto è attualmente gestito da un team umano + AI. Per iniziare a lavorare sul codice, leggi **`AGENTS.md`** come primo file, poi segui l'ordine di lettura lì indicato. Per dettagli sull'implementazione corrente, leggi `docs/17-DEV-NOTES.md` (pitfalls consolidati) e `docs/18-DEV-LOG.md` (registro cronologico per story).

> La prosa di questo README è verificata dal gate CI `scripts/check-readme-facts.mjs` (issue #161): l'elenco delle piattaforme deve corrispondere al codice (`ACTIVE_PLATFORMS` + adapter), le funzionalità non ancora implementate devono stare nella sezione roadmap, e la sezione stato non duplica conteggi già presenti nei blocchi aggregati.

## 📜 Licenza

[Apache-2.0](LICENSE) — vedi decisione D.A.10 dell'audit del 2026-10-15. Open-source puro, nessuna monetizzazione (D.A.9).

---

*Questo README è mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*
