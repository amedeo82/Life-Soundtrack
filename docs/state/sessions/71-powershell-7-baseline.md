---
number: 71
title: "Baseline PowerShell 7 (pwsh) per gli script del repo"
date: 2026-10-31
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: docs/218-powershell-7-baseline
pr: 0
claim: kilo-hp-elitebook-lrm6
cross_refs: [104, 63, 42]
tags: [devops, docs]
---

# Sessione 71 — Baseline PowerShell 7 (`pwsh`) per gli script del repo

## Sintesi

Il project owner ha installato **PowerShell 7** sulla propria macchina e ha chiesto di
allineare la documentazione del progetto a quel toolchain. La richiesta ha portato a una
constatazione più ampia del previsto: **la documentazione era rimasta ancorata al world di
Windows PowerShell 5.1 anche quando `pwsh` era già disponibile**, e la CI usava `shell: pwsh`
da sempre.

La linea temporale del drift:

- **Sessione 42** (issue #132): `pwsh` 7.6.7 viene installato sulla dev machine (lesson 42-1).
  Da quel momento i gate si invocano con `pwsh` + `-Check`.
- **Sessione 41** e precedenti: le lesson 39-1 / 40-1 / 41-1 documentano il fall-open di
  `--check` sotto 5.1 — il workaround era scrivere il body su file temporaneo e usare
  `--body-file`, per via della stessa radice.
- **Ma la documentazione non è stata aggiornata**: il README avvertiva ancora che «senza
  `pwsh`» i gate richiedevano il singolo trattino, `12-DEVOPS.md §9.1` prescriveva «MAI
  `--check` / `--list`», `§9.7b` descriveva il bug dell'issue #104 come se fosse il caso
  normale, e `AGENTS.md` usava `--check` in una dozzina di punti mentre il suo footer v1.20
  dichiarava già che la conversione a `-Check` era stata fatta.

È la classe di drift che questo repo conosce bene: **nessun gate confronta la documentazione
con l'ambiente reale**. Un gate verde non implica uno stato corretto (lesson 37-1): qui il
gate verde era `aggregate-state.ps1 -Check` / `generate-bundle.ps1 -Check`, che verificano la
coerenza fra i documenti e i loro sorgenti — non la correttezza dei documenti rispetto alla
macchina che li esegue.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.71.1 | **PowerShell 7 (`pwsh`) è il baseline del repo** per gli script in `scripts/*.ps1` | È l'engine su cui gira la CI (`shell: pwsh` in tutti i workflow) e quello installato sulla dev machine dal 2026-10-21 (lesson 42-1). Un baseline dichiarato vale più di un fallback tolerato: il fallback è il modo in cui il drift di cui sopra è sopravvissuto 29 sessioni |
| D.71.2 | La forma **canonica** dei flag resta a **singolo trattino** (`-Check`, `-List`, `-DryRun`, `-Help`) | In `pwsh` il doppio trattino viene normalizzato sul singolo **prima** del binding, quindi `--check` e `-Check` sono equivalenti (verificato su pwsh 7.6.9). Ma il singolo trattino è l'unica forma con comportamento identico su 5.1 e 7, ed è quella che il guard fail-closed dell'issue #104 indica come corretta: la forma canonica non cambia con il baseline |
| D.71.3 | Il guard fail-closed degli script **resta in piedi**, ma non viene considerato il meccanismo primario | Nello scenario che l'ha motivato (doppio trattino sotto 5.1) non scatta più: `pwsh` lega il flag e il guard non vede nulla in `$args` né in `$MyInvocation.UnboundArguments`. Protegge ancora i flag davvero inesistenti e le invocazioni da shell 5.1 |
| D.71.4 | **Nessuna modifica al codice degli script né alla semantica dei gate in CI** | Cambiare la semantica di un gate (da warning-only a bloccante) è una decisione sul test strategy, che il protocollo riserva al project owner. Qui si rimuove solo il drift documentale |
| D.71.5 | La motivazione dei due step **warning-only** è riformulata: l'asse versione di PowerShell è chiuso, resta quello di **piattaforma** | La differenza residua è fra dev Windows e CI Linux (CRLF/autocrlf, path separator), non fra versioni di PowerShell. Il wording precedente attribuiva la causa alla differenza PS 5.1 vs 7, che non esiste più |

## Cosa è stato corretto

| File | Correzione |
|------|------------|
| `README.md` | Requisiti: aggiunto **PowerShell 7 (`pwsh`)**. Sostituita la callout «⚠️ PowerShell 5.1 (Windows senza `pwsh`)» con la forma canonica `-Check` e i due comandi di verifica |
| `AGENTS.md` | v1.28 → **v1.29**. Tutti i `--check` del corpo convertiti in `-Check` (residuo non applicato dal footer v1.20). Rimossa la riga `--check --strict`: il flag **`-Strict` non esiste** in `scripts/aggregate-state.ps1` e il guard lo rifiuta con exit 2 — la riga indicava un comando che non può funzionare. §"Session start checklist" estesa a **6 check** con il controllo della versione di PowerShell (F9). Motivazione del warning-only riformulata (D.71.5) |
| `docs/12-DEVOPS.md` | v1.2 → **1.3**. §9.1 riscritta (baseline pwsh, equivalenza `--check`/`-Check`, forma canonica). §9.7b: stato aggiornato — il guard non scatta più nello scenario che l'ha motivato. §9.8: la garanzia «fail-fast» e l'esempio CI usano `-Check`. Changelog 1.3 |
| `docs/17-DEV-NOTES.md` | v0.3 → **0.4**. Tabella dei comandi unificata su `pwsh` + `-Check` (la voce distingueva CI e "locale Win PS 5.1"). Requisiti aggiornati. **Nuovo P11** — il pitfall del baseline PowerShell 7 |
| `docs/13-ADR/0008-lazy-state-aggregation.md` | Flag canonici (`-List`, `-Check`, `-DryRun`), vincolo «baseline PowerShell 7», e riformulazione del vincolo sull'encoding: l'ASCII-only nel sorgente è giustificato dalla scrittura esplicita via `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)`, che è **indipendente dalla versione** di PowerShell (in 5.1 `Set-Content -Encoding UTF8` aggiungeva il BOM — lesson 37-5, 69-5) |
| `docs/13-ADR/0006-multi-agent-task-claiming.md` | Riferimento al check del bundle normalizzato a `-Check` |
| `docs/state/_index.md` | Comandi dell'aggregator normalizzati a `-Check` / `-List` |
| `docs/11-BACKLOG.md` | Acceptance criterion della Story 6.1 normalizzato a `-Check` |

## Lesson learned

| # | Osservazione | Azione |
|---|--------------|--------|
| 71-1 | **Un toolchain installato non è un toolchain documentato**: `pwsh` era disponibile dal 2026-10-21 (lesson 42-1) e la CI girava su `shell: pwsh` da sempre, ma 29 sessioni di documentazione hanno continuato a descrivere il world di 5.1 | D.71.1: il baseline è dichiarato in `README.md`, `17-DEV-NOTES.md` §1 e `12-DEVOPS.md` §9.1. **Regola generale**: quando si installa un runtime, il passo successivo non è «funziona» ma «la documentazione lo nomina» |
| 71-2 | **Il footer che dichiara una normalizzazione non la applica**: il footer v1.20 di `AGENTS.md` diceva «tutti i `pwsh scripts/* --check` convertiti a `-Check` (issue #104, PR #111 gia' aperta)», ma il corpo del file conteneva ancora una dozzina di `--check`. La dichiarazione era l'unica parte aggiornata | Verificato con `rg` su tutto il file, non con la lettura: la normalizzazione è un problema di **copertura**, non di spot-check |
| 71-3 | **Un flag documentato che non esiste è peggio di un flag assente**: `aggregate-state.ps1 --strict` era indicato come comando da eseguire, ma il parametro non è dichiarato — il guard fail-closed lo rifiuta con exit 2. Nessun gate lo segnalava, perché il gate verifica la *coerenza* dei documenti, non la loro *eseguibilità* | Il comando è stato rimosso e sostituito da una nota esplicita. **Regola generale**: un comando in un protocollo va eseguito almeno una volta prima di essere pubblicato |
| 71-4 | **I gate `-Check` verificano la coerenza fra documenti e sorgenti, non la correttezza dei documenti rispetto all'ambiente**: qui erano verdi (exit 0) mentre il README prescriveva un mondo che non esisteva più | Il divario è coperto da un **check esplicito dell'ambiente** (F9 nella session start checklist) invece che da un altro gate sui documenti — un gate che verifica il requisito è il tipo di gate che serve (lesson 43-1: un gate che passa sempre non è un gate) |

## Documenti aggiornati

- `README.md` (Sviluppo locale: requisiti + callout PowerShell)
- `AGENTS.md` (v1.29, forma canonica dei flag, session start checklist a 6 check, F9, footer)
- `docs/12-DEVOPS.md` (v1.3, §9.1, §9.7b, §9.8, changelog 1.3)
- `docs/17-DEV-NOTES.md` (v0.4, §1, nuovo P11)
- `docs/13-ADR/0008-lazy-state-aggregation.md` (flag + vincoli implementativi)
- `docs/13-ADR/0006-multi-agent-task-claiming.md`
- `docs/state/_index.md`
- `docs/11-BACKLOG.md`
- `docs/state/sessions/71-powershell-7-baseline.md` (questo file)

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (bundle rigenerato nella stessa modifica)
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0
- `node scripts/check-readme-facts.mjs` → exit 0
- `pwsh -NoProfile -c '$PSVersionTable.PSVersion'` → 7.6.9 (Core)

## Link utili

- `docs/12-DEVOPS.md` §9.1 e §9.7b — il riferimento canonico sulla forma dei flag
- `docs/17-DEV-NOTES.md` P11 — il pitfall del baseline PowerShell 7
- `docs/13-ADR/0008-lazy-state-aggregation.md` §"Script aggregator" — i vincoli implementativi
- Issue #104 — fail-closed sui flag sconosciuti (originated dal bug di 5.1)
- Issue #63 — allineamento byte-per-byte: l'asse versione di PowerShell è chiuso, resta quello di piattaforma
- Lesson 42-1 (`docs/state/sessions/42-approve-apple-music-spec.md`) — l'installazione di `pwsh` sulla dev machine
