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

**Implementazione: 75%** - 21 story completate su 28 - effort pesato 77% - **mancano 7 step**

`██████████████████████░░░░░░░░` 75%

| EPIC | Completate | Totale | % | Stato |
|------|-----------|--------|---|-------|
| EPIC 0 - Fondamenta | 7 | 7 | 100% | completo |
| EPIC 1 - Import core | 6 | 6 | 100% | completo |
| EPIC 2 - Analisi | 4 | 4 | 100% | completo |
| EPIC 3 - UI/UX | 2 | 4 | 50% | in corso |
| EPIC 4 - Arricchimento | 2 | 4 | 50% | in corso |
| EPIC 5 - Privacy e legale | 0 | 2 | 0% | da fare |
| EPIC 6 - Manutenzione stack | 0 | 1 | 0% | da fare |

**Distribuzione**: 21 done - 0 in corso - 7 da fare - 0 bloccate - 0 annullate

**Step ancora da implementare** (7):
- 3.2 Ricordi + Share - da fare (size L)
- 3.3 Esplora + Analisi - da fare (size L)
- 4.2 MusicBrainz lookup - da fare (size M)
- 4.3 Artwork enrichment - da fare (size M)
- 5.1 Privacy spec finale - da fare (size M)
- 5.2 Export e purge - da fare (size M)
- 6.1 Upgrade toolchain e dipendenze a ultime major - da fare (size M)

**Gate di testabilità**

| Gate | Requisito | Stato |
|------|-----------|-------|
| Test end-to-end dell'app | EPIC 3 (4 story) | 2/4 - in corso |
| Motore di analisi completo | EPIC 2 (4 story) | 4/4 - soddisfatto |
| Test con dati personali reali | 5.2 | 0/1 - non ancora |

**Analisi della sessione corrente** (S82)

**Numeri.** L'implementazione non cambia: **75%** (21 story completate su 28, effort 77%), restano
**7 step**. Lavoro di **governance** su un'issue dedicata, non story di backlog.

**Cosa è pronto.** Tre concurrency group separati; `apply-merge-state.mjs` advisory quando non c'è
sessione; step di verifica e auto-riparazione in `auto-bundle.yml`; `post-merge.ps1` che stampa il
numero della PR; i commenti dei tre workflow e di `ci.yml` allineati alla semantica reale.

**Cosa manca.** Il lotto **I3** dell'epic #248 (rifinitura di `AGENTS.md` a ~400 righe con 77
anchor invariati). Nessun altro difetto noto della catena post-merge.

**Salute tecnica.** Worktree attiva su `feat/251-catena-post-merge`. Claim riverificato sull'issue
#251 (commento `6560302917`, unico claim). Nessun blocco `AGGREGATE-*` modificato a mano.

**Gate di testabilità.** `node scripts/validate-workflows.mjs .github/workflows` → 0 fallimenti ·
`bash scripts/test-post-merge.sh` → 47 assert, 0 falliti ·
`bash scripts/test-workflow-writer-ordering.sh` → 6/0 ·
`bash scripts/test-workflow-git-add-coverage.sh` → 8/0 ·
`bash scripts/test-workflow-push-sync.sh` → 15/0 ·
`node scripts/apply-merge-state.mjs --pr 9999` → exit 0 con warning ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 · `pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

<!-- AGGREGATE-PROGRESS-END -->

### Prossima story

<!-- AGGREGATE-NEXT-STEP-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V3, ADR-0008, issue #127).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

_Nessuna story non-done e non bloccata migrata in `docs/state/stories/`._

Vedi `docs/11-BACKLOG.md` per la roadmap completa e `docs/state/_index.md` per la procedura di migration.

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

Requisiti: Node ≥ 20, pnpm 9 (pinnato in `packageManager`), **PowerShell 7 (`pwsh`)** per gli script di maintenance del repo (`scripts/*.ps1`).

```bash
pnpm install          # installa il workspace e attiva i git hook
pnpm run lint         # ESLint 9 flat config
pnpm run typecheck    # tsc --noEmit
pnpm run test         # Vitest
pnpm run build        # tsc + vite build
pnpm run e2e          # Playwright (prima volta: pnpm exec playwright install chromium)
```

Non esiste ancora uno script `dev`: per un preview locale esegui `pnpm run build` e poi `pnpm --filter @ls/web exec vite preview`.

> **PowerShell 7 (`pwsh`)**: gli script di maintenance del repo (`scripts/*.ps1`) vanno invocati con `pwsh`, non con `powershell` (Windows PowerShell 5.1). In `pwsh` il doppio trattino viene normalizzato sul singolo, ma la forma **canonica** resta quella a singolo trattino (`-Check`): è l'unica che non cambia comportamento se il gate viene invocato da una shell 5.1. Vedi `docs/12-DEVOPS.md §9.1`.
>
> ```powershell
> pwsh scripts/generate-bundle.ps1 -Check   # docs/BUNDLE.md in sync? exit 0 = in sync
> pwsh scripts/aggregate-state.ps1 -Check   # blocchi aggregati in sync? exit 0 = in sync
> ```

## 🤝 Come contribuire

Questo progetto è attualmente gestito da un team umano + AI. Per iniziare a lavorare sul codice, leggi **`AGENTS.md`** come primo file, poi segui l'ordine di lettura lì indicato. Per dettagli sull'implementazione corrente, leggi `docs/17-DEV-NOTES.md` (pitfalls consolidati) e `docs/18-DEV-LOG.md` (registro cronologico per story).

> La prosa di questo README è verificata dal gate CI `scripts/check-readme-facts.mjs` (issue #161): l'elenco delle piattaforme deve corrispondere al codice (`ACTIVE_PLATFORMS` + adapter), le funzionalità non ancora implementate devono stare nella sezione roadmap, e la sezione stato non duplica conteggi già presenti nei blocchi aggregati.

## 📜 Licenza

[AGPL-3.0](LICENSE) — il progetto passa ad AGPL-3.0 perché `essentia.js` è AGPL-3.0 e la PWA distribuisce il modulo acustico agli utenti (D-AF.2, `docs/21-AUDIO-FEATURES.md` §2.4; ratificata dal project owner il 2026-10-30, issue #201). Open-source puro, nessuna monetizzazione (D.A.9).

> **AGPL §13 — offerta del sorgente**: implementata (issue #202). La PWA interagisce con gli utenti in rete, quindi l'app offre il sorgente corrispondente a chi la usa: schermata **Informazioni / About** con licenza, testo dell'offerta (§13) e link al repository pubblico; file **NOTICE** con le attribuzioni di terze parti (Essentia.js AGPL-3.0; DB-IP Lite CC BY 4.0 in attesa della Story 4.4).

---

*Questo README è mantenuto aggiornato dal log delle sessioni in [`docs/SESSIONS.md`](docs/SESSIONS.md).*
