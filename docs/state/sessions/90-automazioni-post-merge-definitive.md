---
number: 90
title: "Automazioni post-merge definitive: writer unico, CI post-writer, generatori OS-indipendenti"
date: 2026-11-02
state: 🟡
merged: false
branch: feat/284-automazioni-post-merge-definitive-writer
pr: 285
claim: kilo-HP-ELITEBOOK-c90auto
tags: [devops, ci, workflow, determinism]
---

# Sessione 90 — Le automazioni post-merge, risolte alla radice

> **Oggetto**: dopo il merge della PR #282 (Sessione 89, issue #281) `main` era
> **rimasto rosso**, e il fix merged non poteva funzionare: la PR aggiungeva un
> `path` al trigger `push` della CI, ma il commit del writer **non genera
> l'evento `push`** (è pushato con `GITHUB_TOKEN`, che sopprime i workflow
> innescati dal token stesso). Misurato: per `831b9e7` non esiste **nessuna**
> run `CI` — solo un `auto-bundle` su `workflow_run`.

## Sintesi

Tre difetti indipendenti, un solo sintomo.

1. **Il writer non triggava la CI** → nessuna run verde sullo stato finale.
2. **Tre writer concorrevano sullo stesso `main`** → push rifiutato, rebase
   dei file generati, conflitto, run fallito.
3. **Il gate merge-state girava sull'albero sbagliato** → fail-closed su un
   albero in cui lo stato non era ancora applicato (per costruzione).

E una quarta, trasversale: i generatori producevano output diversi su Windows
e Linux (fuso orario, locale, ordinamento, versione di PowerShell).

## Cosa è emerso

- Il fix della issue #281 era basato su una premessa **falsa**: `docs/12-DEVOPS.md`
  §9.14 documentava già, misurato, che «i commit dei writer non hanno mai
  attivato una run `CI` — né prima né dopo questa sessione, nemmeno quando il
  trigger `push` era privo di filtro». Un `path` in più non può attivare un
  evento che non viene generato.
- Il rebase dei file generati non è una race: è un conflitto strutturale. I
  blocchi aggregati sono il *prodotto* di un input (lo stato), non la fusione
  di due storie: si rigenerano, non si ribasano.
- Il gate merge-state **non** andava reso tollerante (D-89.2): andava
  spostato sull'albero giusto. La distinzione «albero = merge commit della
  PR» è oggettiva (uguaglianza di SHA), non temporale.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-90.1 | **Un solo writer** (`post-merge.yml`) che applica lo stato, rigenera blocchi e bundle, e committa una volta | Elimina per costruzione la race fra writer (misurata il 2026-11-02) |
| D-90.2 | Il writer **non ribasa mai**: reset a `origin/main` + rigenerazione | Il rebase dei file generati è un conflitto strutturale; la rigenerazione è funzione dello stato |
| D-90.3 | Il passaggio **autoritativo** della CI è `workflow_run` sul writer, con `checkout ref: main` | `workflow_run` sopravvive alla soppressione del `GITHUB_TOKEN`; `head_sha` è il commit di *partenza* del writer, non la testa di `main` |
| D-90.4 | Il gate merge-state ha due modalità: autoritativa (fail-closed) e `--defer-unapplied` (differisce **solo** l'albero = merge commit della PR) | Il gate non è indebolito: cambia il soggetto del confronto, non la sua severità |
| D-90.5 | I generatori diventano portabili **per costruzione** (UTC, `InvariantCulture`, ordinamento ordinale, guardia `pwsh >= 7`, LF) e **per prova** (gate di portabilità su `ubuntu-latest` + `windows-latest`) | L'indipendenza dal SO non si dichiara: si misura, su due sistemi operativi reali |
| D-90.6 | Il writer non è più "non bloccante": se fallisce, `main` resta rosso | Il fallback silenzioso è ciò che ha prodotto il drift invisibile degli ultimi mesi |

La specifica completa è in `docs/13-ADR/0013-post-merge-automation.md`.

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **70%** (21 story su 30, effort 72%),
restano **9 step**. Il lavoro è di **devops**: l'architettura delle automazioni,
non il codice applicativo.

**Cosa è pronto.**
- `.github/workflows/post-merge.yml`: il writer unico (stato di merge →
  aggregatore → bundle → verifica → un commit → un push).
- `.github/workflows/ci.yml`: trigger `workflow_run` sul writer, checkout della
  testa di `main` in quel passaggio, gate merge-state nelle due modalità, job
  `gates-portability` su due sistemi operativi.
- `scripts/check-merge-state.mjs`: modalità `--defer-unapplied` con
  distinzione oggettiva (SHA del merge commit vs albero sotto esame).
- `scripts/aggregate-state.ps1` e `scripts/generate-bundle.ps1`: guardia
  `pwsh >= 7`, timestamp UTC con locale invariante, numeri con locale
  invariante, ordinamenti con chiave secondaria ordinale, CRLF normalizzati
  nel bundle.
- `scripts/check-generators-portable.mjs`: il gate che confronta i **byte**
  prodotti dai generatori con lo stato committato.
- `scripts/validate-workflows.mjs`: quattro gate nuovi (writer unico, trigger
  del writer, checkout del passaggio `workflow_run`, sync con `origin/main`
  che non possa essere faked da un commento).

**Cosa manca.** La verifica finale è **empirica e la dà il merge**: la
sequenza merge → writer → CI post-writer deve produrre zero run rossi, e il
gate di portabilità deve essere verde su entrambi i sistemi operativi. Il
primo merge con questa architettura è la prova; le sessioni successive
verificheranno la stabilità (l'obiettivo è che *nessun* merge futuro lasci
`main` rosso).

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a
mano. Suite: 16 assert sul gate merge-state (T10..T12 nuovi), 13 sul cablaggio
del writer (T6..T8 nuovi), 9 sul sync, 8 sulla copertura `git add`, 8 sui
scalari YAML, 15 sulle scope `permissions`.

**Gate di testabilità.** `node scripts/validate-workflows.mjs .github/workflows`
→ 0 falliti · `node scripts/check-workflow-syntax.mjs` → 0 non validi ·
`node scripts/check-encoding.mjs` → 0 errori · `node scripts/check-merge-state.mjs`
→ 0 falliti · `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0 ·
`node scripts/check-generators-portable.mjs` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un fix che aggiunge un `path` a un trigger non verifica **che l'evento venga generato** | Le premesse dei fix vanno misurate: qui il fatto era già documentato in §9.14 e la PR lo contraddiceva |
| Il gate giusto non è sempre quello che va reso più tollerante: a volte è quello che va eseguito **sull'oggetto giusto** | D-89.2 diceva «non indebolire il gate»: la soluzione era spostarlo, non ammorbidirlo |
| Tre writer sullo stesso `main` non sono tre feature: sono una struttura di file in conflitto | Un solo writer, un solo commit: la semplificazione è la difesa |
| L'indipendenza dal sistema operativo è una **proprietà verificabile**, non un'intenzione | Il gate confronta i byte su due OS reali: se un generatore torna a dipendere dalla locale, la pipeline si rossa |

## Documenti aggiornati

- `.github/workflows/post-merge.yml` (nuovo), `ci.yml` (trigger `workflow_run`, gate di portabilità)
- `scripts/check-merge-state.mjs`, `scripts/check-generators-portable.mjs` (nuovo)
- `scripts/aggregate-state.ps1`, `scripts/generate-bundle.ps1`, `scripts/validate-workflows.mjs`
- `docs/13-ADR/0013-post-merge-automation.md` (nuovo), `docs/12-DEVOPS.md`, `AGENTS.md`
