# 🎵 Life Soundtrack

> *La colonna sonora della tua vita, finalmente leggibile.*

Life Soundtrack è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming musicale in un **diario di vita personale**: una timeline emotiva, contestuale e narrativa che racconta la storia dell'utente attraverso la musica che ha ascoltato.

## ✨ Cosa c'è oggi

- Importa la cronologia di ascolto dai servizi supportati e la normalizza in un database locale (Dexie/IndexedDB)
- **Invia i tuoi ascolti ai hub di scrobbling** (Last.fm, ListenBrainz): coda in locale, retry con backoff, consenso per-hub esplicito
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
- **Scrobbling continuo**: hub Maloja (Fase 2) — Last.fm e ListenBrainz sono già implementati (Story 1.5)

## 🏗️ Stato del progetto

Lo **stato globale** (fase corrente, story completate, roadmap, prossimo passo) è gestito dai blocchi aggregati di [`docs/INDEX.md`](docs/INDEX.md) (`<!-- AGGREGATE-INDEX-STATUS-* -->`) e di [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md) (`<!-- AGGREGATE-STORIES-* -->`) — quelli, e non questo README, sono la **fonte di verità** per `status`, conteggi e roadmap. La sezione `11-BACKLOG.md` §"Stato di avanzamento — roadmap delle story non ancora completate" elenca cosa manca.

> Le sezioni legacy dei documenti globali (stato, conteggi, versioni, riferimenti) vanno allineate nella **stessa PR** che cambia i fatti che dichiarano: vedi [`AGENTS.md`](AGENTS.md) §"Chi può scrivere cosa nei file globali".

### Indicatore di avanzamento

<!-- AGGREGATE-PROGRESS-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V4, ADR-0008, issue #216).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

**Implementazione: 64%** - 18 story completate su 28 - effort pesato 64% - **mancano 10 step**

`███████████████████░░░░░░░░░░░` 64%

| EPIC | Completate | Totale | % | Stato |
|------|-----------|--------|---|-------|
| EPIC 0 - Fondamenta | 7 | 7 | 100% | completo |
| EPIC 1 - Import core | 6 | 6 | 100% | completo |
| EPIC 2 - Analisi | 4 | 4 | 100% | completo |
| EPIC 3 - UI/UX | 0 | 4 | 0% | da fare |
| EPIC 4 - Arricchimento | 1 | 4 | 25% | in corso |
| EPIC 5 - Privacy e legale | 0 | 2 | 0% | da fare |
| EPIC 6 - Manutenzione stack | 0 | 1 | 0% | da fare |

**Distribuzione**: 18 done - 0 in corso - 10 da fare - 0 bloccate - 0 annullate

**Step ancora da implementare** (10):
- 3.1 Home + Timeline - da fare (size XL)
- 3.2 Ricordi + Share - da fare (size L)
- 3.3 Esplora + Analisi - da fare (size L)
- 3.4 Nastro contesto (Timeline) - da fare (size M)
- 4.2 MusicBrainz lookup - da fare (size M)
- 4.3 Artwork enrichment - da fare (size M)
- 4.4 DB IP→città (geolocalizzazione locale) - da fare (size L)
- 5.1 Privacy spec finale - da fare (size M)
- 5.2 Export e purge - da fare (size M)
- 6.1 Upgrade toolchain e dipendenze a ultime major - da fare (size M)

**Gate di testabilità**

| Gate | Requisito | Stato |
|------|-----------|-------|
| Test end-to-end dell'app | EPIC 3 (4 story) | 0/4 - non ancora |
| Motore di analisi completo | EPIC 2 (4 story) | 4/4 - soddisfatto |
| Test con dati personali reali | 5.2 | 0/1 - non ancora |

**Analisi della sessione corrente** (S71)

### Numeri

- **Implementazione: 64%** — 18 story completate su 28 · effort pesato 64% · **mancano 10 step**
- EPIC 0 (Fondamenta) 7/7 · EPIC 1 (Import core) 6/6 · EPIC 2 (Analisi) 4/4 · EPIC 3 (UI/UX) 0/4 · EPIC 4 (Arricchimento) 1/4 · EPIC 5 (Privacy e legale) 0/2 · EPIC 6 (Stack) 0/1

### Cosa e' pronto e cosa manca

- **Il motore e' completo**: ingest da 5 piattaforme, dedup post-enrichment, scrobbling hub con coda e retry, pipeline audio features, mood tracker, era detector, memory engine, event detector, fondazione geo. Tutto coperto da test e verde.
- **Manca la UI (EPIC 3, 0/4)**: Home + Timeline, Ricordi + Share, Esplora + Analisi, nastro contesto. Finche' EPIC 3 e' vuota l'app e' solo onboarding/import: si puo' testare il motore, non l'esperienza "colonna sonora della tua vita". **Questo e' il gate che blocca il test end-to-end.**
- **Mancano 4.2/4.3/4.4** (lookup MusicBrainz, artwork, IP→citta') e **5.1/5.2** (privacy spec finale, export & purge): senza export/purge non e' prudente testare con dati personali reali.
- **6.1** (upgrade a ultime major) e' schedulata a fine implementazione per policy (D.10.2).

### Salute tecnica (verificata su `main`)

`typecheck` ✅ · `lint` ✅ · `build` ✅ (PWA generata, 13 asset in precache) · `test` ✅ **686 test** (574 `@ls/core` + 112 `@ls/web`) + 2 test di performance (10k eventi < 500 ms) · **e2e: un solo smoke test** (`apps/web/e2e/smoke.spec.ts`).

### Procedura introdotta con questa sessione

1. `scripts/aggregate-state.ps1` calcola l'indicatore (catalogo del backlog + stato dei state file) e lo scrive in `README.md` e `docs/INDEX.md`.
2. Il workflow `auto-state-aggregate` lo rigenera a **ogni merge** su `main` (i trigger `paths:` ora includono anche `docs/11-BACKLOG.md`: il catalogo delle story e' un input del blocco).
3. Il gate CI `aggregate-state.ps1 -Check` verifica l'allineamento e **fallisce** se il blocco e' stale.
4. `scripts/validate-workflows.mjs` (nuovo sesto controllo) verifica che i `paths:` del workflow coprano **tutti** gli input del blocco: senza, una story nuova nel backlog lascerebbe l'indicatore fermo senza che nessuno se ne accorga.
5. `pnpm run progress` stampa l'indicatore a richiesta, senza scrivere nulla.

<!-- AGGREGATE-PROGRESS-END -->

### Prossima story

<!-- AGGREGATE-NEXT-STEP-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V3, ADR-0008, issue #127).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

**Prossima story da implementare**: **3.4** — Nastro contesto (Timeline) (priority `I`, vedi `docs/11-BACKLOG.md`).

Sorgente: `docs/state/stories/3.4-context-ribbon.md`. Issue candidabile: filtra con `gh issue list --label agent-ready --state open` (vedi `docs/11-BACKLOG.md` §"Priorità di lavorazione per agenti").

Altre non-done e non bloccate in ordine di priorita backlog (id): 4.4.

<!-- AGGREGATE-NEXT-STEP-END -->

Il blocco sopra elenca la prima story non completata fra quelle **già migrate** in `docs/state/stories/`; le story ancora da implementare sono elencate nella tabella §"Stato di avanzamento" di `docs/11-BACKLOG.md".

Il blocco **non conosce le dipendenze** fra story: la story indicata può dipenderne da un'altra non ancora fatta. Prima di claimarla, guarda `depends_on` nel suo file in `docs/state/stories/`. Oggi la **3.4** (nastro contesto) dichiara `[DEP:4.4]`: la tranche geo si fa nella **4.4** (il DB IP→città, la specifica già ratificata) e **poi** nella 3.4, che la consuma.

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

[AGPL-3.0](LICENSE) — il progetto passa ad AGPL-3.0 perché `essentia.js` è AGPL-3.0 e la PWA distribuisce il modulo acustico agli utenti (D-AF.2, `docs/21-AUDIO-FEATURES.md` §2.4; ratificata dal project owner il 2026-10-30, issue #201). Open-source puro, nessuna monetizzazione (D.A.9).

> **AGPL §13 — offerta del sorgente**: implementata (issue #202). La PWA interagisce con gli utenti in rete, quindi l'app offre il sorgente corrispondente a chi la usa: schermata **Informazioni / About** con licenza, testo dell'offerta (§13) e link al repository pubblico; file **NOTICE** con le attribuzioni di terze parti (Essentia.js AGPL-3.0; DB-IP Lite CC BY 4.0 in attesa della Story 4.4).

---

*Questo README è mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*
