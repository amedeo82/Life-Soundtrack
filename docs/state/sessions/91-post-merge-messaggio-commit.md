---
number: 91
title: "Il messaggio di commit del writer post-merge senza escape PowerShell rotti"
date: 2026-11-03
state: 🟡
merged: false
branch: feat/287-post-merge-yml-il-messaggio-di-commit-de
pr: 0
claim: kilo-HP-ELITEBOOK-c90auto
tags: [devops, ci, workflow, qualita]
---

# Sessione 91 — Il messaggio del writer, e il test che lo tiene a posto

> **Oggetto**: dopo il merge della PR #285 (Sessione 90, issue #284) la nuova
> architettura delle automazioni funziona — zero run rossi, writer unico, CI
> post-writer — ma il **messaggio di commit** che il writer scrive su `main` era
> corrotto: al posto dei backtick comparivano backslash letterali
> (`\workflow_run\`).

## Sintesi

Il writer `post-merge.yml` costruiva il messaggio di commit con:

```powershell
-m "II passaggio di CI sullo stato finale e' il trigger \`workflow_run\` di ci.yml."
```

In PowerShell il backtick è il carattere di escape: `\`` produce un backslash
letterale e **consuma** il backtick. Per ottenere un backtick letterale serve
il **doppio** backtick. Il risultato sul `main` era:

```
II passaggio di CI sullo stato finale e' il trigger \workflow_run\ di ci.yml.
```

Il difetto è stato trovato ispezionando il commit del writer dopo il merge
della PR #285 (`5f54296`): la riga di storia era sporca a ogni merge.

## Cosa e' emerso

- Il difetto era **cosmetico ma cumulativo**: il writer scrive un commit per
  merge, quindi ogni merge di `main` accumulava la stessa riga corrotta.
- Nessun gate lo intercettava: i gate sui workflow verificano la **struttura**
  (trigger, permessi, `git add`, un solo writer), non il **testo** del
  messaggio.
- La lezione che ne segue: un gate che verifica la forma del workflow non
  verifica cosa il workflow *scrive*. Serviva un test **funzionale**.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-91.1 | Il messaggio non usa piu' i backtick | In un messaggio di git non aggiungono nulla; la classe di difetto (escape PowerShell) sparisce invece di essere gestita |
| D-91.2 | Ogni riga del messaggio resta sotto i 100 caratteri | Regola `body-max-line-length` di commitlint: se il workflow installasse un giorno le dipendenze, il commit non deve fallire |
| D-91.3 | Il messaggio viene **estratto dal workflow reale** dal test, non ricopiato | Un test che ricopia il messaggio non lo testa: la regressione deve fallire sul testo vero |
| D-91.4 | Il test è **funzionale**: esegue i passi del writer in un clone con un remoto finto | Copre il comportamento (stato applicato, un solo commit, push, idempotenza), non la forma |

## Analisi di avanzamento

**Numeri.** Nessun codice applicativo toccato: la percentuale di
implementazione delle story resta **70%** (21 su 30, effort 72%), **9 step**
rimanenti. Il lavoro è di **devops**.

**Cosa è pronto.**
- `.github/workflows/post-merge.yml`: il messaggio di commit senza backtick e
  senza backslash, con la spiegazione della causa in un commento (così non
  viene reintrodotto).
- `scripts/test-post-merge-writer.sh` (nuovo): **19 assert** che eseguono i
  passi del writer in un clone locale con un remoto finto — stato di merge
  applicato e finito sul remoto, blocchi rigenerati, bundle in sync, **un solo
  commit**, push, idle del remoto allineato, messaggio pulito, **PR senza
  sessione → nessun commit**, **idempotenza**.
- `.github/workflows/ci.yml`: il test gira nel job `gates-workflows` (bloccante
  su ogni PR).
- `scripts/generate-bundle.ps1`: il nuovo script entra nel `$files`.

**Cosa manca.** Nulla sul piano funzionale: la verifica end-to-end del
writer è già stata fatta dal merge della PR #285 (zero run rossi) e il difetto
di #287 è coperto da un test con **controllo negativo eseguito**: reintrodotto
il difetto, il test fallisce con il messaggio esatto (`\workflow_run\`),
ripristinato il fix, il test torna verde (19/19).

**Salute tecnica.** PowerShell 7.6.9. Nessun blocco `AGGREGATE-*` toccato a
mano. Il test non tocca il repository vero: clona in una directory temporanea
e usa un remoto finto (`git remote set-url`), quindi non puo' spingere nulla
sull'origin reale.

**Gate di testabilità.** `bash scripts/test-post-merge-writer.sh` → 19/19 ·
`node scripts/validate-workflows.mjs .github/workflows` → 0 falliti ·
`node scripts/check-workflow-syntax.mjs` → 0 non validi ·
`node scripts/check-encoding.mjs` → 0 errori ·
`node scripts/check-protocol-consistency.mjs` → 0 falliti ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un gate che verifica la **forma** di un workflow non verifica **cosa scrive** | Il test del writer è funzionale: esegue i passi e guarda il risultato |
| Un test che ricopia il testo dal codice che testa non testa nulla | Il messaggio è estratto dal workflow reale nel test |
| Un controllo negativo eseguito vale più di un test che "passa" | Il difetto è stato reintrodotto apposta: il test è fallito con il messaggio esatto |
| In PowerShell il backtick è l'escape: il backslash non lo protegge | I messaggi delle automazioni non usano piu' i backtick; le righe restano sotto i 100 caratteri |

## Documenti aggiornati

- `.github/workflows/post-merge.yml` (messaggio di commit), `.github/workflows/ci.yml` (nuovo step di gate)
- `scripts/test-post-merge-writer.sh` (nuovo), `scripts/generate-bundle.ps1` (`$files`)
- `docs/state/sessions/91-post-merge-messaggio-commit.md` (questo file)
