---
number: 108
title: "Protocollo post-merge: rifiuto dei target non-issue"
date: 2026-11-13
state: 🟡
merged: false
branch: fix/332-fix-protocol-rifiutare-self-reference-cl
pr: 333
claim: kilo-HP-EliteBook-a7c9
tags: [devops, protocol, ci, testing]
---

# Sessione 108 — Protocollo post-merge: rifiuto dei target non-issue

> **Issue di tracking**: #332
> **Branch**: `fix/332-fix-protocol-rifiutare-self-reference-cl`

## Sintesi

Il workflow `auto-status-done` validava il numero estratto dalla keyword di chiusura solo come issue GitHub, senza distinguerlo dalla pull request corrente e senza verificare che il target fosse realmente un'issue. Una keyword come `Closes #330` nella PR #330 produceva quindi una transizione locale sul numero della PR stessa, mentre il fallimento remoto restava nascosto.

La correzione rende il contratto esplicito e fail-closed: il gate pre-PR rifiuta il self-reference e un target che è una pull request; il workflow post-merge ripete la validazione prima di ogni mutazione, fallisce in modo osservabile e non applica `status:done` a target non validi.

## Deliverable

- `scripts/check-claim-state.mjs`: rifiuto del self-reference e dei target pull request.
- `scripts/test-claim-state.sh`: scenari T15 e T16.
- `.github/workflows/auto-status-done.yml`: preflight atomico dei target, mutazioni solo dopo validazione completa, errori fail-closed.
- `scripts/test-auto-status-done.mjs`: test funzionale del workflow con self-reference, target pull request, issue reale ed errore di mutazione.
- `.github/workflows/ci.yml`: test del workflow aggiunto al gate di protocollo.
- `AGENTS.md` v1.51: regola, gate e comportamento post-merge espliciti.

## Analisi di avanzamento

Il protocollo ora distingue formalmente tre casi: issue reale, pull request e self-reference. Il comportamento è verificato sia prima dell'apertura della PR sia dopo il merge, coprendo il caso scoperto sulla PR #330 e impedendo transizioni parziali su target non-issue.

**Claim**: `kilo-HP-EliteBook-a7c9` (UTC 2026-11-13T10:19:44Z)
