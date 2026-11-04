# 🎵 Life Soundtrack

> *La colonna sonora della tua vita, finalmente leggibile.*

Life Soundtrack è un'applicazione web (PWA) che trasforma i metadati grezzi delle piattaforme di streaming musicale in un **diario di vita personale**: una timeline emotiva, contestuale e narrativa che racconta la storia dell'utente attraverso la musica che ha ascoltato.

## ✨ Cosa c'è oggi

- Importa la cronologia di ascolto dai servizi supportati e la normalizza in un database locale (Dexie/IndexedDB)
- **Invia i tuoi ascolti ai hub di scrobbling** (Last.fm, ListenBrainz): coda in locale, retry con backoff, consenso per-hub esplicito
- **Tutto resta sul tuo dispositivo**: elaborazione locale, nessun backend. L'unica uscita di rete è l'invio ai hub di scrobbling, e solo se lo attivi tu (default: nessuno)
- PWA installabile, onboarding guidato in 5 passaggi (benvenuto → privacy → import → elaborazione → riepilogo)
- Interfaccia in italiano e inglese, funzioni di manutenzione del database nel core (rekey, pulizia degli orfani, recount)

### Piattaforme importabili

- `spotify` — Spotify (export ZIP/JSON)
- `youtube_music` — YouTube Music (export HTML)
- `apple_music` — Apple Music (CSV)
- `listenbrainz` — ListenBrainz (export API: ZIP/JSONL)
- `lastfm` — Last.fm (file CSV/JSON, oppure API via proxy CORS con credenziali locali)

## 🚫 Cosa non siamo

Life Soundtrack non è un altro scrobbler. Le distinzioni che contano:

- **Non è Last.fm**: Last.fm è un tracker di statistiche — conta e socializza i tuoi ascolti. Qui i tuoi ascolti restano sul dispositivo e diventano un diario
- **Non è Spotify Wrapped**: non un annuale effimero e chiuso, ma una timeline continua che cresce con gli anni
- **Non è un servizio cloud**: nessun account obbligatorio, nessun backend, nessun lock-in — i dati sono tuoi e puoi portarli via
- **Non è un diario manuale**: non devi annotare nulla mentre ascolti, la narrazione nasce da anni di dati già esistenti
- **Non è un social network**, né una piattaforma di streaming, né uno strumento per artisti e label

Il posizionamento completo — confronto con i competitor e **verifica dello stato reale** di ogni differenziatore — è in [`docs/22-COMPETITIVE-POSITIONING.md`](docs/22-COMPETITIVE-POSITIONING.md).

## 🗺️ Roadmap

Non ancora nell'app — la roadmap completa, con lo stato di ogni story, è in [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md):

- **Ricordi + Share** (EPIC 3, Story 3.2): feed dei ricordi, card 1080×1350, export statico di un capitolo, tagging manuale di ere e canzoni
- **Esplora + Analisi** (EPIC 3, Story 3.3): ricerca sui propri dati, quadrante valence/energy, insight in prosa
- **Anteprima in onboarding** (EPIC 3, Story 3.5): diario di esempio prima dell'import, prime righe della timeline dopo
- **Artwork** (EPIC 4, Story 4.3): copertine degli album — il campo esiste già nello schema, la pipeline non le popola ancora
- **Audio features** (EPIC 4, Story 4.1): la pipeline è implementata in `@ls/core` (cascata cache → Essentia.js → AcousticBrainz → euristico), ma il modulo Essentia non è ancora integrato nell'app
- **Lookup MusicBrainz** (EPIC 4, Story 4.2): MBID e generi (priorità bassa: non serve all'artwork)
- **Privacy spec finale** (EPIC 5, Story 5.1): pagina in-app «Come trattiamo i tuoi dati»
- **Export e purge** (EPIC 5, Story 5.2): export JSON/CSV del diario, cancellazione totale con doppia conferma
- **Altre piattaforme**: Deezer, Tidal, SoundCloud ([`docs/01-PLATFORMS.md`](docs/01-PLATFORMS.md) §3.4-3.6)
- **Scrobbling continuo**: hub Maloja (Fase 2) — Last.fm e ListenBrainz sono già implementati (Story 1.5)

## 🏗️ Stato del progetto

Lo **stato globale** (fase corrente, story completate, roadmap, prossimo passo) è gestito dai blocchi aggregati di [`docs/INDEX.md`](docs/INDEX.md) (`<!-- AGGREGATE-INDEX-STATUS-* -->`) e di [`docs/11-BACKLOG.md`](docs/11-BACKLOG.md) (`<!-- AGGREGATE-STORIES-* -->`) — quelli, e non questo README, sono la **fonte di verità** per `status`, conteggi e roadmap. La sezione `11-BACKLOG.md` §"Stato di avanzamento — roadmap delle story non ancora completate" elenca cosa manca.

> Le sezioni legacy dei documenti globali (stato, conteggi, versioni, riferimenti) vanno allineate nella **stessa PR** che cambia i fatti che dichiarano: vedi [`AGENTS.md`](AGENTS.md) §"Chi può scrivere cosa nei file globali".

### Indicatore di avanzamento

<!-- AGGREGATE-PROGRESS-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V4, ADR-0008, issue #216).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

**Implementazione: 77%** - 23 story completate su 30 - effort pesato 80% - **mancano 7 step**

`███████████████████████░░░░░░░` 77%

| EPIC | Completate | Totale | % | Stato |
|------|-----------|--------|---|-------|
| EPIC 0 - Fondamenta | 7 | 7 | 100% | completo |
| EPIC 1 - Import core | 6 | 6 | 100% | completo |
| EPIC 2 - Analisi | 5 | 5 | 100% | completo |
| EPIC 3 - UI/UX | 3 | 5 | 60% | in corso |
| EPIC 4 - Arricchimento | 2 | 4 | 50% | in corso |
| EPIC 5 - Privacy e legale | 0 | 2 | 0% | da fare |
| EPIC 6 - Manutenzione stack | 0 | 1 | 0% | da fare |

**Distribuzione**: 23 done - 0 in corso - 7 da fare - 0 bloccate - 0 annullate

**Step ancora da implementare** (7):
- 3.3 Esplora + Analisi - da fare (size L)
- 3.5 Anteprima del risultato in onboarding (modalità demo) - da fare (size M)
- 4.2 MusicBrainz lookup - da fare (size M)
- 4.3 Artwork enrichment - da fare (size M)
- 5.1 Privacy spec finale - da fare (size M)
- 5.2 Export e purge - da fare (size M)
- 6.1 Upgrade toolchain e dipendenze a ultime major - da fare (size M)

**Gate di testabilità**

| Gate | Requisito | Stato |
|------|-----------|-------|
| Test end-to-end dell'app | EPIC 3 (5 story) | 3/5 - in corso |
| Motore di analisi completo | EPIC 2 (5 story) | 5/5 - soddisfatto |
| Test con dati personali reali | 5.2 | 0/1 - non ancora |

**Analisi della sessione corrente** (S99)

**Numeri.** Nessuna story implementata: è lavoro di **protocollo e test**. La
percentuale di avanzamento resta **77%** (23 story completate su 30, effort
pesato 80%, 7 step rimanenti): nessuna state file di story è stata creata o
modificata in questa sessione.

**Cosa è pronto.** La specifica della copertura mancante è scritta e verificabile:
il mock (cosa intercetta, come muta lo stato, come fallisce su una chiamata
non prevista), i casi per entrambi gli script (con l'expected e l'exit code),
il wiring in CI e il mapping con gli AC dell'issue. La issue #304 è passata da
`needs-spec` a `agent-ready` (la strategia è stata ratificata dal project
owner) ed è claimata.

**Cosa manca.** La ratifica dell'ADR-0014 (🟡 → 🟢) e quindi l'implementazione:
`scripts/mock/gh.ps1`, `scripts/test-agent-claim.sh`, l'estensione di
`scripts/test-agent-pr.sh`, i due step in `gates-procedure`, la riga nella
tabella regola ⟺ gate di `AGENTS.md` (che richiede il bump di versione in
`AGENTS.md` e `docs/INDEX.md`, gate C1) e l'aggiornamento di §9.10 e §9.13 di
`docs/12-DEVOPS.md`.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano: le fonti sono
il file di sessione e la prosa legacy (`docs/INDEX.md`, `docs/12-DEVOPS.md`).
Il bundle è stato rigenerato dopo l'aggregator (ordine aggregator → bundle).

**Gate di testabilità (comandi).** `node scripts/check-protocol-consistency.mjs`
→ 6 check, 0 falliti · `node scripts/check-encoding.mjs` → 0 errori ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (192 file) ·
`node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD` → 0
violazioni (i blocchi `AGGREGATE-*` **non** sono stati toccati a mano: li
riscrive il writer post-merge, ADR-0008 V1) · `pwsh scripts/aggregate-state.ps1
-Check` → **exit 1 atteso**: il nuovo file di sessione cambia i blocchi
aggregati, che per contratto vengono applicati dal writer post-merge (gate
warning-only in CI, come per la Sessione 98).

<!-- AGGREGATE-PROGRESS-END -->

### Prossima story

<!-- AGGREGATE-NEXT-STEP-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V3, ADR-0008, issue #127).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

**Prossima story da implementare**: **3.3** — Esplora + Analisi (priority `I`, vedi `docs/11-BACKLOG.md`).

Sorgente: `docs/state/stories/3.3-esplora-analisi.md`. Issue candidabile: filtra con `gh issue list --label agent-ready --state open` (vedi `docs/11-BACKLOG.md` §"Priorità di lavorazione per agenti").

Altre non-done e non bloccate in ordine di priorita backlog (id): 3.5, 4.3, 5.1, 5.2.

<!-- AGGREGATE-NEXT-STEP-END -->

Il blocco sopra elenca la prima story non completata fra quelle **già migrate** in `docs/state/stories/`; le story ancora da implementare sono elencate nella tabella §"Stato di avanzamento" di `docs/11-BACKLOG.md`.

Il blocco **non conosce né le dipendenze né i claim**: la story indicata può dipenderne da un'altra non ancora fatta, o essere già presa in carico da un altro agente. Prima di claimarla, guarda `depends_on` nel suo file in `docs/state/stories/` e verifica le label sulle issue con `gh issue list --label agent-ready --state open` (senza `in-progress` né `status:*`, ADR-0006): **la selezione del lavoro non avviene mai da questo blocco** — è la query live sulle issue, non il README, a dire cosa è libero. Esempio passato: la 3.4 dichiarava `[DEP:4.4]` — tranche geo chiusa in Sessione 76 (issue #231).

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
