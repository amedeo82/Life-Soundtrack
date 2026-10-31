---
number: 76
title: "Nastro contesto (Story 3.4, issue #231)"
date: 2026-10-31
state: 🟡
merged: false
branch: feat/231-context-ribbon
pr: 0
claim: kilo-HP-ELITEBOOK-progress
cross_refs: [231, 201, 221, 216]
tags: [ui, geo, context]
---

# Sessione 76 — Nastro contesto (Story 3.4, issue #231)

## Sintesi

Il **nastro contesto** è la striscia che rende leggibile il contesto sotto le
`EraBand` della Timeline: un segmento per `ContextPeriod`, il colore del
`kind`, l'etichetta del paese, la città e i pips dei dispositivi. Il click su un
segmento apre il **dettaglio del periodo**, dove l'utente conferma, corregge o
ignora la classificazione: è il punto in cui il diario diventa personale
(`19§4.3` — l'algoritmo propone, l'utente batte le spalle).

La story era **lavorabile**: le due dipendenze sono soddisfatte (la **1.6**
fondazione geo, Sessione 68; la **4.4** DB IP→città, issue #221) e il core
espone gia' `ContextPeriod`, il classificatore L1 e `setContextPeriodVerdict`.
La story e' dunque **interamente UI**: nessuna nuova logica di dominio.

Due scelte della spec sono state prese sul serio, al punto da renderle
**strutturali** invece che convenzionali:

- **la regola di linguaggio** («la citta' e' sempre introdotta da un indicatore
  di incertezza, il paese mai») vive in **un solo punto** del codice
  (`describePeriodCity`): non in un template, non in tre componenti. Un test la
  verifica in italiano e in inglese;
- **nessuna mappa, nessuna rete**: il nastro riceve i periodi per props e non
  conosce `fetch`. Il test lo dimostra con uno spy e con l'assenza di `img`,
  `iframe` e `svg` nel DOM.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.76.1 | Il nastro e' un componente **presentazionale**: dati per props, azioni per callback | Lo rende testabile senza database (15 test, nessun mock di IndexedDB) e gli lascia la liberta' di essere montato dalla Timeline (Story 3.1) quando esistera: il nastro non conosce lo zoom, lo riceve (`visibleRange`) |
| D.76.2 | La logica pura sta in un file separato (`contextRibbonModel.ts`), non nel file del componente | La regola `react-refresh/only-export-components` chiede che un file di componente esporti solo componenti; e, soprattutto, tiene la **regola di linguaggio** in un unico posto leggibile, non dispersa fra i JSX |
| D.76.3 | Il view model espone `citySource` esplicito, con default «una citta' presente e non corretta e' una stima» | `ContextPeriod` (core) non porta la provenienza della citta': questa vive sull'evento (`ListenEvent.citySource`, `02§4.1`). Il nastro deve saperlo, perche' «circa *X*» e *X* sono due affermazioni diverse: il default dichiara la realta' (stimata finche' l'utente non corregge) senza mentire |
| D.76.4 | Un segmento per `ContextPeriod`, **mai aggregati** | `19§5.3`: il periodo senza contesto determinato resta `unknown` e non viene aggregato. Il nastro non raggruppa nulla: due `unknown` sono due segmenti |
| D.76.5 | Le azioni utente escono per callback (`onVerdict`), la persistenza resta del chiamante | Il modello del verdetto e' gia' quello di `Insight.status` (`pending`/`confirmed`/`corrected`/`dismissed`): il core espone `setContextPeriodVerdict`, la UI non conosce il DB |
| D.76.6 | Un'etichetta vuota e' `null`, non `''` | «nessuna etichetta» e «etichetta vuota» sono la stessa cosa: il chiamante non deve distinguere i due casi |
| D.76.7 | Il namespace `timeline.context.*` e' stato **materializzato** in `08§2.12h`, che il changelog 0.9 (Sessione 67) dichiarava ma non scriveva | La sezione mancante era un drift documentale: il namespace era promesso da tre sessioni e non esisteva. Le 36 chiavi sono ora nella spec e nei due locale |
| D.76.8 | La città di un periodo **non** viene dedotta dal nome del paese, e il paese non viene dedotto dalla città | Il nastro mostra cio' che il core ha derivato: nessuna geografia inventata dalla UI |

## Analisi di avanzamento

### Numeri

- **Implementazione: 71%** — 20 story completate su 28 · effort pesato 71% · **mancano 8 step**
- EPIC 0 (Fondamenta) 7/7 · EPIC 1 (Import core) 6/6 · EPIC 2 (Analisi) 4/4 · EPIC 3 (UI/UX) 1/4 · EPIC 4 (Arricchimento) 2/4 · EPIC 5 (Privacy e legale) 0/2 · EPIC 6 (Stack) 0/1

### Cosa e' pronto e cosa manca

- **Il motore e' completo**: ingest da 5 piattaforme, dedup post-enrichment, scrobbling hub con coda e retry, pipeline audio features, mood tracker, era detector, memory engine, event detector, fondazione geo e il DB IP→citta' (4.4). Tutto coperto da test e verde.
- **L'EPIC 3 e' partita (1/4)**: con il nastro contesto esiste il primo pezzo di UI oltre l'onboarding. Restano **3.1** (Home + Timeline, XL), **3.2** (Ricordi + Share) e **3.3** (Esplora + Analisi): il nastro e' pronto per essere montato sotto le `EraBand`, ma **le `EraBand` non esistono ancora** — Timeline arriva con la 3.1.
- **Il gate che blocca il test end-to-end e' ancora la Timeline**: l'app resta onboarding + import; senza 3.1 non si puo' verificare l'esperienza "colonna sonora della mia vita" end-to-end. Il nastro e' il primo pezzo pronto di quel percorso.
- **Mancano 4.2/4.3** (lookup MusicBrainz, artwork) e **5.1/5.2** (privacy spec finale, export & purge): senza export/purge non e' prudente testare con dati personali reali.
- **6.1** (upgrade a ultime major) e' schedulata a fine implementazione per policy (D.10.2).

> I numeri sopra sono quelli **calcolati** dal blocco al momento della stesura: se il blocco e
> l'analisi divergono, il primo e' la fonte di verita' — la percentuale e' un dato calcolato,
> la prosa e' un commento.

### Salute tecnica (verificata in questa worktree)

`typecheck` ✅ · `lint` ✅ (0 warning: la separazione del modello e' quello che li ha azzerati) · `test` ✅ **127 test in `@ls/web`** (112 precedenti + 15 nuovi) · `build` ✅ · `pnpm run verify` (lint + typecheck + test + build in una invocazione).

### Procedura introdotta con questa sessione

1. `apps/web/src/components/ContextRibbon.tsx` — il nastro (segmenti, colori, filtri, zoom).
2. `apps/web/src/components/ContextPeriodDetail.tsx` — il dettaglio del periodo e le tre azioni.
3. `apps/web/src/components/contextRibbonModel.ts` — il modello puro e la regola di localita'.
4. `apps/web/src/__tests__/context-ribbon.test.tsx` — 15 test: regola di linguaggio (IT/EN), nessuna rete e nessuna mappa, `unknown` non aggregato, filtri, zoom, click, verdetti.

## Lesson learned

- **Una sezione di spec promessa e non scritta e' un drift documentale**: `08§2.12h` era dichiarata dal changelog della Sessione 67 ma non esisteva. Le chiavi sono state materializzate solo quando qualcuno doveva **usarle**: la specifica segue l'implementazione, non la precede.
- **La regola `react-refresh/only-export-components` non e' un capriccio**: separare il modello dal componente ha reso la regola di linguaggio leggibile in un file solo, e ha azzerato i warning del lint. Il vincolo di tooling, quando è ben posto, coincide con la chiarezza del dominio.
- **Il default del view model deve essere dichiarato**: `citySource` non esiste su `ContextPeriod`, ma il nastro deve poter dire «circa *X*». Dichiarare il default in un unico punto (una citta' presente e non corretta e' una stima) evita che ogni call site decida per conto proprio.

## Documenti aggiornati

- `apps/web/src/components/ContextRibbon.tsx` (nuovo) — il nastro
- `apps/web/src/components/ContextPeriodDetail.tsx` (nuovo) — il dettaglio del periodo
- `apps/web/src/components/contextRibbonModel.ts` (nuovo) — modello puro e regola di localita'
- `apps/web/src/__tests__/context-ribbon.test.tsx` (nuovo) — 15 test
- `apps/web/src/i18n/locales/it.json`, `en.json` — 36 chiavi `timeline.context.*`
- `apps/web/src/i18n/useT.ts`, `i18n/index.ts` — hook `useLanguage()` (le date del periodo si formattano nella lingua della UI)
- `apps/web/src/onboarding/onboarding.css` — stili del nastro e del dettaglio
- `docs/08-COPY-I18N.md` — §2.12h (nuova) + changelog 0.12
- `docs/state/stories/3.4-context-ribbon.md` — `status: done`, task e acceptance criteria spuntati
- `scripts/generate-bundle.ps1` — `$files` += il file di sessione
- `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/18-DEV-LOG.md` — sezioni legacy allineate
