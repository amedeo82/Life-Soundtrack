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

**Implementazione: 73%** - 22 story completate su 30 - effort pesato 76% - **mancano 8 step**

`██████████████████████░░░░░░░░` 73%

| EPIC | Completate | Totale | % | Stato |
|------|-----------|--------|---|-------|
| EPIC 0 - Fondamenta | 7 | 7 | 100% | completo |
| EPIC 1 - Import core | 6 | 6 | 100% | completo |
| EPIC 2 - Analisi | 5 | 5 | 100% | completo |
| EPIC 3 - UI/UX | 2 | 5 | 40% | in corso |
| EPIC 4 - Arricchimento | 2 | 4 | 50% | in corso |
| EPIC 5 - Privacy e legale | 0 | 2 | 0% | da fare |
| EPIC 6 - Manutenzione stack | 0 | 1 | 0% | da fare |

**Distribuzione**: 22 done - 0 in corso - 8 da fare - 0 bloccate - 0 annullate

**Step ancora da implementare** (8):
- 3.2 Ricordi + Share - da fare (size L)
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
| Test end-to-end dell'app | EPIC 3 (5 story) | 2/5 - in corso |
| Motore di analisi completo | EPIC 2 (5 story) | 5/5 - soddisfatto |
| Test con dati personali reali | 5.2 | 0/1 - non ancora |

**Analisi della sessione corrente** (S95)

**Numeri.** Nessun codice applicativo toccato: il lavoro è di **stato e documentazione**. La
percentuale di implementazione delle story passa da **70%** (21 su 30, effort 72%, 9 step) a
**73%** (22 su 30, effort 76%, **8 step** rimanenti): l'**EPIC 2** (Analisi) diventa **completo
(5/5)** e il gate di testabilità «Motore di analisi completo» passa da «4/5 - in corso» a
**«5/5 - soddisfatto»**.

**Cosa è pronto.**

- Lo stato di merge della Story 2.5 è allineato in tutti e quattro i documenti che lo dichiarano:
  `docs/state/stories/2.5-*.md` (fonte), `docs/11-BACKLOG.md` (sezione legacy + blocco
  aggregato), `docs/INDEX.md` (blocchi aggregati) e `README.md` (prosa + blocco aggregato).
- Il blocco `AGGREGATE-NEXT-STEP-*` del README **non indica più** la 2.5: con tutte le 22 story
  migrate in `done` il blocco mostra correttamente il fallback «Nessuna story non-done e non
  bloccata migrata in `docs/state/stories/`» — le 8 story rimanenti (3.2, 3.3, 3.5, 4.2, 4.3,
  5.1, 5.2, 6.1) non hanno ancora un state file e lo riceveranno al claim.
- I **7 acceptance criteria** della Story 2.5 sono spuntati nella sezione legacy del backlog, e
  la riga `**Stato**:` dichiara PR, merge commit e data: la sezione legacy non è più una copia
  stantia dello stato reale.
- Il **gap strutturale** è documentato (§51 del DEV-LOG): `docs/state/stories/*.md` non ha un
  writer di stato di merge e non è coperto dal gate `check-merge-state.mjs`.

**Cosa manca.** Il gap strutturale è **aperto**: le story continuano a non avere un writer di
stato di merge. La correzione naturale è estendere `apply-merge-state.mjs` al formato delle story
(`status: done` invece di `state: <chiuso>`) e estendere `check-merge-state.mjs` al perimetro
`docs/state/stories/`: le due modifiche sono nella stessa direzione e chiudono la **classe** di
drift, non il caso. Non sono state applicate qui perché toccano il **writer unico di `main`**
(ADR-0013) e il gate bloccante che ne verifica il perimetro: è lavoro da issue dedicata, non da
doc-sync.

Nota: i file `docs/SESSIONS.md`, `docs/INDEX.md`, `docs/11-BACKLOG.md` e `docs/BUNDLE.md` hanno
**blocchi aggregati** e **prosa legacy**: in questa PR ho toccato la prosa (che è di mia
competenza); i blocchi si aggiornano da soli dopo il merge.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano (il gate
`check-aggregate-blocks.mjs` → 0 violazioni). Il bundle è stato rigenerato dopo le modifiche
documentali (`generate-bundle.ps1` dopo `aggregate-state.ps1`, l'ordine vincolante della
Sessione 73).

**Gate di testabilità.** `node scripts/check-merge-state.mjs` → 70 confronti, 0 falliti ·
`node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD` → 0 violazioni ·
`node scripts/check-readme-facts.mjs` → 15 check, 0 falliti · `node scripts/check-encoding.mjs` →
544 file, 0 errori · `node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`pwsh scripts/aggregate-state.ps1 -Progress` → 73%, 22 story su 30, 8 step rimanenti ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

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
