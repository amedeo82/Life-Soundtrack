---
number: 85
title: "Posizionamento competitivo verificato sul codice e priorità ricalcolate"
date: 2026-11-02
state: 🟡
merged: false
branch: feat/265-docs-competitive-specs
pr: 273
claim: kilo-HP-ELITEBOOK-c85pos
tags: [docs, strategy, backlog]
---

# Sessione 85 — Posizionamento competitivo e priorità ricalcolate

> **Oggetto**: un'analisi competitiva (del 2026-11-02) sul posizionamento di Life Soundtrack
> rispetto a Last.fm/VinVibe, Remi/Music Memory e Spotify Wrapped, con una gerarchia di priorità
> e cinque suggerimenti strategici. L'analisi è stata **verificata riga per riga contro il codice**
> del repository e i risultati sono stati riflessi nella documentazione.

## Sintesi

L'analisi individua **quattro differenziatori strutturali** (privacy-first locale, multi-piattaforma
unificata, retrospettiva storica, analisi acustica locale) e propone un ordine di priorità:
artwork prima di MusicBrainz, Ricordi+Share ed Esplora+Analisi al primo posto, export e purge a
priorità media, MusicBrainz e nuove piattaforme a bassa priorità.

La verifica sul codice **conferma due differenziatori, ne smentisce due nella forma dichiarata e
ne scopre un terzo, più grave**:

| Differenziatore | Verdetto |
|-----------------|----------|
| Privacy-first locale | 🟢 reale, con la precisazione che l'unica uscita di rete è l'invio ai hub di scrobbling, **solo** se l'utente lo attiva hub per hub |
| Multi-piattaforma unificata | 🟢 reale: 5 fonti importabili (Spotify, YouTube Music, Apple Music, ListenBrainz, Last.fm), tutte con adapter e factory |
| Retrospettiva storica | 🟡 **non ancora un prodotto**: i quattro motori di analisi sono scritti e testati in `packages/core/src/analysis/`, ma **nessun codice in `apps/web` li esegue** — la Home legge gli insight che nessuno scrive |
| Analisi acustica locale | 🟡 **non ancora un prodotto**: la porta Essentia e la cascata esistono in `packages/core/src/enrichment/`, ma `essentia` **non è una dipendenza** (assente da ogni `package.json` e dal lockfile), il modulo WASM non viene mai caricato e il pacchetto non è importato dall'app |

L'osservazione su export, purge e pagina privacy è confermata: esistono stringhe i18n e funzioni di
base (`purgeIp()`, `purgeScrobbleQueue()`), ma nessun flusso completo (il pannello `MaintenancePanel.tsx`
non è montato e i pulsanti sono placeholder).

È emerso inoltre che l'**onboarding non mostra il risultato**: la schermata di reveal mostra un
contatore di eventi, mentre il README dichiarava un'«anteprima del risultato»; il dataset demo
(`fixtures/demo-user.json`) e la CTA «Scopri come funziona» esistono ma **non sono usati da nessun
file di codice**.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-85.1 | Nasce `docs/22-COMPETITIVE-POSITIONING.md` (🟡 DRAFT v0.1) come sede unica di posizionamento, "cosa non siamo" e priorità | Non esisteva un documento che rispondesse a «perché non Last.fm» e «quale vantaggio è vero»: il posizionamento era sparso tra VISION e backlog, e la priorità era implicita |
| D-85.2 | Il backlog cresce di **due story**: **2.5** (collegamento del pipeline di analisi all'app) e **3.5** (anteprima/demo in onboarding) | Sono i due lavori che rendono visibili i differenziatori 3 e 4 e l'onboarding che deve mostrare la magia. Il catalogo passa da 28 a 30 story |
| D-85.3 | L'ordine di lavorazione diventa **2.5 → 4.3 → 3.2 → 3.3 → 3.5 → 5.2 → 5.1 → 4.2 → 6.1** | L'ordine dell'analisi esterna è corretto sul **valore**, non sull'ordine delle issue. Due correzioni: l'artwork non dipende dal lookup MusicBrainz e l'anteprima è un lavoro piccolo ad alto rendimento |
| D-85.4 | La **Story 4.3** perde il vincolo `[DEP:4.2]` e sale a **P0** | La cascata dell'artwork funziona senza MBID (Spotify Web API → iTunes Search → placeholder gradient); il lookup MusicBrainz migliora il catalogo ma non l'esperienza |
| D-85.5 | La **Story 3.2** incorpora l'export **statico** del capitolo e il **tagging manuale**; la **3.3** richiede **insight in prosa**; la **5.1** richiede la **pagina in-app «Come trattiamo i tuoi dati»** | La condivisione non può esporre il database: si esporta un capitolo. Il tagging manuale è il ponte fra analisi automatica e autobiografia. L'«aha moment» è la frase, non il grafico. La privacy va tradotta in linguaggio utente |
| D-85.6 | Il **README** viene riallineato al codice: tolte le due dichiarazioni non supportate («anteprima del risultato», «strumenti di purga»), precisata la portata della privacy locale, aggiunta la sezione **«Cosa non siamo»** e riscritta la roadmap | Il gate `check-readme-facts.mjs` confronta la prosa con il codice: è drift esattamente il genere di drift che il gate è nato per chiudere (issue #161) |
| D-85.7 | `00-VISION.md` passa a v0.3: **licenza allineata ad AGPL-3.0** (la riga dichiarava ancora Apache-2.0, D.A.10 superata da D-AF.2 il 2026-10-30), "cosa NON è" esteso, stato reale dei cinque punti di differenziazione | Drift dichiarativo sul file che dichiara la **decisione strategica** più vincolante del progetto |
| D-85.8 | L'AGPL-3.0 **non viene modificato** | La domanda «va bene AGPL?» è già chiusa: D-AF.2 (ratifica 2026-10-30, issue #201), modello open-source puro senza monetizzazione (D.A.9), obbligo §13 implementato (issue #202). Il limite sui fork commerciali è accettato di proposito |

## Analisi di avanzamento

**Numeri.** L'implementazione **scende al 70%**: **21 story su 30**, effort pesato **72%**, restano
**9 step**. La percentuale scende perché il catalogo è cresciuto di **due story oneste** (2.5 e 3.5)
che il backlog precedente non sapeva di avere: il denominator non era falsato, era **incompleto**.
Lavoro di **documentazione e strategia**.

**Cosa è pronto.** La verifica competitiva è completa e riproducibile: i quattro differenziatori
hanno ciascuno un esito documentato con l'evidenza nel codice (`packages/core/src/analysis/`,
`packages/core/src/enrichment/`, `packages/core/src/adapters/pipeline.ts`,
`apps/web/src/onboarding/OnboardingRouter.tsx`). Il posizionamento è in un documento solo
(`22-COMPETITIVE-POSITIONING.md`), il backlog ne riflette le conseguenze (2.5, 3.5, 4.3 P0,
ordine di lavorazione), il README dice «cosa non siamo» e non promette più ciò che il codice non fa.

**Cosa manca.** Due cose, in ordine: (a) la **ratifica** delle sette decisioni proposte
(D-22.1…D-22.7) — il documento è DRAFT e le story nuove non sono `agent-ready` senza spec
approvata; (b) l'apertura delle **issue** di implementazione per 2.5 e 3.5, che senza la
specifica di collegamento del pipeline di analisi non possono essere lavorate.

**Gate di testabilità.** Il gate «motore di analisi completo» passa da **4/4 a 4/5**: l'EPIC 2 ha
i suoi quattro motori, ma non il **collegamento all'app** (2.5) — è la prima volta che il gate
dice la verità su quel «completo». Il gate «test end-to-end» resta 2/5 (EPIC 3: mancano 3.2, 3.3,
3.5).

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano; aggregatore e
bundle rigenerati in quest'ordine (aggregator → generator), come impone la procedura
`AGENTS.md` §"L'ordine dei due generatori è vincolante".

**Gate di testabilità (comandi).** `node scripts/check-readme-facts.mjs` → 0 falliti ·
`node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`node scripts/check-aggregate-blocks.mjs` → 0 violazioni ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un'analisi competitiva esterna è un'ipotesi, non uno stato: verificarla **riga per riga contro il codice** ne ha spostato due sui quattro differenziatori | Il rischio non era la qualità dell'analisi, era la sua **granularità**: «analisi acustica locale» è vero a livello di port (`enrichment/essentia.ts`) e falso a livello di prodotto (nessuna dipendenza, nessun caricamento). La verifica ha separato i due piani |
| Il drift più grave era **fra i moduli e l'app**, non fra i documenti | Quattro motori di analisi, una pipeline audio, 15 tabelle Dexie e una pipeline di import: tutto scritto e testato, e l'utente non vede niente. Il backlog dichiarava «EPIC 2 completo» perché misura le **story**, non i **percorsi dati**: un EPIC può essere 4/4 e non produrre un solo insight |
| Un gate sulla prosa del README non copre i gate sulla **prosa degli altri documenti** | Il README dichiarava un'anteprima e una purga inesistenti: il gate `check-readme-facts.mjs` li ha lasciati passare perché la sua lista di capability copre i nomi delle feature (valence, BPM, mood), non le frasi descrittive. Il gate è una rete, non un muro: i documenti nuovi devono portare con sé la verifica |
| Il «non ancora» è una promessa di **roadmap**, non una feature assente | L'analisi esterna trattava «analisi acustica locale» e «ricordi + share» come la stessa cosa: la prima è una capability pronta in core e non collegata, la seconda non esiste. Il backlog le distingueva già; il rischio era scrivere nel README una versione che le confonde |

## Documenti aggiornati

- `docs/22-COMPETITIVE-POSITIONING.md` (nuovo, 🟡 DRAFT v0.1): posizionamento, matrice dei competitor
  con stato verificato, "cosa non siamo", priorità ricalcolate, D-22.1…D-22.7
- `docs/00-VISION.md`: v0.3 — licenza AGPL-3.0, "cosa NON è" esteso, stato reale dei differenziatori
- `docs/11-BACKLOG.md`: v1.6.34 — Story **2.5** e **3.5** nuove, **4.3** P0 e senza `[DEP:4.2]`,
  AC di 3.2/3.3/5.1, ordine di lavorazione, tabella roadmap, changelog
- `README.md`: sezione **«Cosa non siamo»**, dichiarazioni non supportate corrette, roadmap riscritta
- `docs/INDEX.md`: riga `22` + conteggio dei documenti DRAFT
- `scripts/generate-bundle.ps1`: `$files` += `docs/22-COMPETITIVE-POSITIONING.md` e la sessione 85
- `docs/BUNDLE.md`: rigenerato
