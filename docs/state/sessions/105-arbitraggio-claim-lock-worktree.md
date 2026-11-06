---
number: 105
title: "Arbitraggio atomico della selezione e lock di proprietà della worktree"
date: 2026-11-05
state: 🟡
merged: false
branch: fix/319-arbitraggio-claim-lock-worktree
pr: 321
claim: kilo-hp-elitebook-85df
tags: [devops, protocol, ci, testing]
---

## Sintesi

Due agenti hanno iniziato a lavorare **la stessa issue (#240)** nella **stessa
worktree**. Non è un errore di una persona: è un difetto del protocollo, e la
diagnosi ha mostrato due cause indipendenti.

La prima è la **selezione non è atomica**: l'agente legge i candidati, sceglie,
poi reclama — e in quella finestra un altro agente fa lo stesso. Il blocco
`AGGREGATE-NEXT-STEP` (la procedura di scelta) e il claim (la procedura di
prenotazione) sono due operazioni **non atomiche** tra loro, quindi due agenti
possono arrivare allo stesso candidato. Il claim, per sua natura, risolve il
conflitto *dopo* che è avvenuto (vince l'id più basso), ma a quel punto il
secondo agente ha già la worktree.

La seconda, più grave, è che **il lock di ADR-0006 è sull'issue, non sul
filesystem**: il path della worktree è **deterministico** (`ls-<N>-<slug>`),
quindi due agenti sulla stessa story finiscono nella **stessa directory**. Il
secondo agente scrive sopra il primo, e il codice del primo finisce nel commit
del secondo: **doppio lavoro silenzioso**, nessun errore, nessun gate che lo
noti. `scripts/agent-claim.ps1` proseguiva sulla worktree "già presente"
(`scripts/agent-claim.ps1:205-207` prima della modifica) e nessun gate leggeva
`agent-state.json`.

La correzione è **un secondo lock**: oltre al lock dell'issue (il claim), il
protocolto ha ora il **lock della worktree**, verificato da un gate che confronta
l'owner locale (`agent-state.json`) con l'agente del claim **vincente**.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-103.1 | Il protocollo ha **due lock distinti**: il claim (issue) e la proprietà della worktree | il path della worktree è deterministico: il claim da solo non protegge la directory |
| D-103.2 | Il gate di proprietà è **fail-closed sul mismatch** (exit 1 = blocco) e **aperto sull'errore d'ambiente** (exit 2 = WARN) | un gate che blocca perché `gh` è assente o la rete è down non è un gate, è un ostacolo; un gate che non blocca sul mismatch non è un gate |
| D-103.3 | Il gate gira nel **pre-commit hook** (INVARIANTE 4), nei **gate locali** di `agent-pr.ps1` e nei **test** in CI | il controllo va ripetuto a ogni commit: verificarlo una volta all'avvio non copre il caso in cui due agenti si incontrano a metà sessione |
| D-103.4 | `agent-claim.ps1` acquisisce **`-Auto`**: ricalcola i candidati e verifica il claim winner subito prima di procedere | chiude la finestra TOCTOU della selezione; l'ordine è deterministico (backlog), la **verifica finale** resta atomica |
| D-103.5 | L'exit **3** («issue già in carico») ha una **procedura codificata**: non si scrive niente, si passa alla prossima candidabile (`-Auto`) | prima non esisteva un comportamento definito per il caso più frequente in caso di conflitto |
| D-103.6 | Il corpo della PR **dichiara l'`agent-id`** del claimante; la CI (C6 di `check-claim-state.mjs`) verifica che coincida con il claim vincente (assente → WARN, mismatch → FAIL) | rende il doppio lavoro **rilevabile in CI**, non solo localmente |
| D-103.7 | Il flusso **manuale** (`setup-worktree.ps1` + `gh issue edit`/`comment`) è **deprecato** in `AGENTS.md` | è il primo autore del difetto: non fa riverifica e non verifica la proprietà |
| D-103.8 | `agent-state.json` viene scritto in modo **atomico** (write UTF-8 senza BOM + `Move-Item -Force`) | un file di stato scritto a metà è un lock corrotto: peggio di un lock assente |

## Il difetto, in due righe

| | prima | dopo |
|---|---|---|
| Selezione della story | l'agente sceglie, poi reclama (finestra TOCTOU) | `-Auto`: ricalcolo + verifica atomica |
| Conflitto sulla stessa story | due agenti nella **stessa directory**, nessuno lo nota | `check-worktree-ownership.mjs`: exit 1 → blocco |
| Lavoro duplicato in CI | invisibile | C6: l'`agent-id` della PR deve essere quello del claimante |

## Analisi di avanzamento

| # | Metrica | Valore |
|---|---------|--------|
| 1 | Gate di proprietà della worktree | **1** (`check-worktree-ownership.mjs`, read-only) |
| 2 | Scenari coperti dal gate | **9** (T1..T9, con scenario negativo dimostrato) |
| 3 | Exit code di `agent-claim.ps1` documentati | **6** (0, 2, 3, 4, 5, 6) |
| 4 | Check della session-start checklist | **7** (era 6: aggiunto F10) |
| 5 | Step di CI aggiati | **1** (`test-worktree-ownership.sh` nel job `gates-protocol`) |
| 6 | Righe del catalogo dei gate | **44** (43 gate + aggregatore `quality`) |
| 7 | Versione protocollo | v1.48 → **v1.49** |

**Pronto**: il lock di proprietà è implementato, testato (9/9) e collegato a tre
punti (hook, gate locali, CI). La dichiarazione dell'agent-id nel body della PR
chiude il ciclo in CI.

**Dopo il merge**: i due agenti che erano in collisione sulla #240 restano da
chiudere a mano (la #240 **non** è stata toccata: è di quell'agente). La
Sessione 105 verifica che il protocollo nuovo, applicato da un agente fresco,
chiuda il ciclo claim → worktree → commit senza collisioni.

## Lesson learned

- **Un lock è tale solo se copre il rischio che protegge.** ADR-0006 bloccava
  l'*issue*; il rischio reale (due agenti nella stessa directory) è sul
  *filesystem*. Un lock che non copre il punto in cui i due agenti si incontrano
  non previene nulla: previene solo il caso in cui i due agenti si incontrano
  **fuori** da lì.
- **Il path deterministico è la causa, non il sintomo.** `ls-<N>-<slug>` è
  comodo da leggere ed è *esattamente* ciò che fa collidere le directory: la
  convenientia e la collisione hanno la stessa causa.
- **"La worktree è già presente" non è idempotenza, è una scusa.** Lo script
  proseguiva perché la directory esisteva: l'esistenza della directory non
  dice **di chi** è. La domanda giusta non è "esiste già?" ma "di chi è?".
- **Un gate che passa sempre non è un gate.** Per questo il gate ha uno
  **scenario negativo** in CI (T2: owner diverso dal claim vincente → exit 1):
  se il gate non può fallire, non è un gate.
- **L'errore d'ambiente e il mismatch sono cose diverse.** Un gate fail-closed
  su entrambi blocca per motivi sbagliati (rete, `gh` assente) e i team
  imparano a usare `--no-verify`. Il mismatch blocca; l'errore d'ambiente
  avvisa.

## Documenti aggiornati

- `AGENTS.md` (v1.49): tabella regola ⟺ gate, Fase 0 di arbitraggio, codici di
  uscita di `agent-claim.ps1`, `-Auto`, lock di proprietà della worktree,
  session-start checklist a 7 check, flusso manuale deprecato, conteggio CI.
- `docs/INDEX.md`: versione del protocollo in sync (C1).
- `docs/12-DEVOPS.md §9.10`: tre righe nuove nel catalogo autorevole dei gate.
- `docs/18-DEV-LOG.md §4`: entry della sessione.
- `docs/state/sessions/105-arbitraggio-claim-lock-worktree.md`: questo file.
- `scripts/check-worktree-ownership.mjs`, `scripts/test-worktree-ownership.sh`:
  nuovi.
- `scripts/agent-claim.ps1`: `-Auto`, exit 6, lock di proprietà, scrittura
  atomica dello stato.
- `scripts/agent-pr.ps1`: gate di proprietà + dichiarazione dell'`agent-id`.
- `scripts/check-claim-state.mjs`: regola C6.
- `scripts/test-claim-state.sh`: scenari T12..T14.
- `.githooks/pre-commit`: INVARIANTE 4.
- `.github/workflows/ci.yml`: step del gate di proprietà.
