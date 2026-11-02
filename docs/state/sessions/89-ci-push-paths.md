---
number: 89
title: "CI su main: i commit del writer dello stato di merge triggano la pipeline"
date: 2026-11-02
state: 🟡
merged: false
branch: feat/281-ci-su-main-i-commit-del-writer-auto-sess
pr: 0
claim: kilo-HP-ELITEBOOK-c89ci
tags: [devops, ci, workflow]
---

# Sessione 89 — La race fra merge e stato di merge

> **Oggetto**: dopo il merge della PR #280 (Sessione 88, issue #279) `main` e' rimasto **rosso**,
> non per un difetto del codice ma per una **race strutturale** fra la CI e il writer che applica
> lo stato di merge alle sessioni.

## Sintesi

La sequenza sul merge di una PR che tocca `docs/BUNDLE.md` (quindi quasi tutte):

1. il **merge** arriva su `main` → il trigger `push` della CI scatta (`docs/BUNDLE.md` e' nei `paths:`) e la pipeline parte **subito**;
2. in parallelo `auto-session-merge-state` applica lo stato di merge alla sessione (`merged: true`, `merged_commit`, `merged_date`);
3. la CI, nel frattempo, trova la sessione ancora con `merged: false` → il gate `check-merge-state.mjs` (**fail-closed**) chiude `gates-docs`;
4. il **commit del writer** (`docs/state/sessions/<N>-<slug>.md`) **non triggava la CI**: `docs/state/**` non era nei `paths:` del trigger `push` → la pipeline non ripartiva → `main` restava rosso.

Il commento del trigger enunciava il principio giusto («il push su `main` scatta solo per i file che i
**writer automatici** modificano: sono gli unici commit che arrivano su `main` senza essere mai passati
da una PR»), ma la lista dei path non includeva `docs/state/**` — cioè proprio i file del writer che
scrive lo stato di merge.

## Cosa è emerso

- Il difetto era **preesistente**: la lista dei `paths:` era stata scritta quando i writer erano solo
  `auto-state-aggregate` (blocchi aggregati) e `auto-bundle` (bundle). Il terzo writer —
  `auto-session-merge-state` — è stato aggiunto dopo, e nessuno ha aggiornato la lista.
- La race è **inevitabile** nella forma attuale: la CI non può attendere il writer, e il writer non
  può precedere la CI. La soluzione non è eliminare la race, ma **renderla non terminale**: l'ultimo
  run su `main` deve essere quello del writer, e deve essere verde.
- Nota: fino alla PR #280 il writer **non funzionava affatto** (403 sull'API): la race era mascherata
  dal fatto che nessuno stato veniva applicato. Riparato il writer, la race è diventata visibile —
  un sintomo che emerge quando si sistema una causa a valle.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-89.1 | Aggiungere `docs/state/**` ai `paths:` del trigger `push` della CI | Il principio del trigger e' gia' scritto nel file: vale per **tutti** i writer. Il writer dello stato di merge era l'unico escluso |
| D-89.2 | **Non** si indebolisce il gate `check-merge-state.mjs` | La race si risolve facendo girare la pipeline sul commit che la chiude, non rendendo il gate tollerante: un gate che accetta «forse mergiato» non e' un gate |
| D-89.3 | La race resta, ma non e' terminale | La sequenza finale e': merge -> CI (rossa per ~30 s) -> commit del writer -> CI verde. Il branch protection guarda l'ultimo run |
| D-89.4 | Il principio e' scritto nel commento del trigger, non solo nel diff | Il commento del trigger e' il posto dove si cerca quando un writer nuovo viene aggiunto: deve dire quali file scrive **quel** writer |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **70%** (21 story su 30, effort 72%), restano **9 step**.
Lavoro di **devops**: una riga di trigger, ma la riga che chiude l'ultima classe di "main rosso"
senza spiegazione.

**Cosa e' pronto.**
- `.github/workflows/ci.yml`: `docs/state/**` aggiunto ai `paths:` del trigger `push`, con il commento
  che spiega la race e perche' il gate non viene indebolito.
- `scripts/validate-workflows.mjs`: 0 falliti (i `paths:` coprono gli input dei blocchi aggregati —
  il controllo esistente dell'issue #216 resta verde).

**Cosa manca.** Nulla: la riga è l'intero fix. La verifica che **chiude** la race è empirica e la dà
il merge stesso: dopo il merge, il commit del writer deve triggare la CI e l'ultimo run su `main`
deve essere verde.

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano.

**Gate di testabilità.** `node scripts/validate-workflows.mjs .github/workflows` → 0 falliti ·
`node scripts/check-workflow-syntax.mjs` → 0 non validi ·
`node scripts/check-encoding.mjs` → 0 errori ·
`node scripts/check-merge-state.mjs` → 64 confronti, 0 falliti ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un trigger con `paths:` e' una **denuncia di authorship**: elenca i file che **solo** i writer toccano | Ogni writer nuovo va aggiunto a quella lista, con il suo contratto. Il commento del trigger (che cosa arriva su `main` senza passare da una PR) e' il posto dove la regola va scritta |
| Riparare una causa a valle fa emergere il sintomo che essa mascherava | Il writer rotto (403) impediva l'applicazione dello stato: la race esisteva gia', ma non si vedeva. Il 403 e' stato riparato per primi, e solo dopo la race e' diventata visibile — un altro caso di «il bug che appare e' spesso il bug che hai appena sistemato» |
| La race fra due writer non si risolve rendendo tollerante il gate | Si risolve facendo girare la pipeline **sul commit che chiude la race**. Il gate resta fail-closed, e l'ultimo run e' quello che conta per il branch protection |

## Documenti aggiornati

- `.github/workflows/ci.yml` (`paths:` del trigger `push`)
- `docs/BUNDLE.md` (rigenerato)
