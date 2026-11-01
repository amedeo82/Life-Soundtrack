---
number: 84
title: "La race sul push risolta: retry con ri-sincronizzazione e contratto del gate aggiornato"
date: 2026-11-01
state: 🟡
merged: false
branch: feat/261-push-race-retry
pr: 0
claim: kilo-hp-elitebook-6d4e
tags: [devops, governance, tooling]
---

# Sessione 84 — La race sul push: retry con ri-sincronizzazione

> **Issue di tracking**: #261 (terzo punto, rimasto aperto dal merge delle PR #258/#260).
> **Branch**: `feat/261-push-race-retry`.

## Sintesi

Con i concurrency group separati (Sessione 82) i tre writer di `main` **non si annullano più**
(era il difetto #251) ma **corrono in parallelo**: due push su `main` possono incrociarsi e
quello che perde la race viene **rifiutato** (non-fast-forward). Misurato il 2026-11-01T16:17:07Z:

```
[main 8aa607e] chore(state): auto-aggregate from docs/state/ (ADR-0008 V2)
 ! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'https://github.com/amedeo82/Life-Soundtrack'
```

Il push dell'aggregator è stato perso → i blocchi aggregati sono rimasti indietro. La catena
riparava comunque (lo step di verifica e auto-riparazione in `auto-bundle.yml`), ma il fallimento
era **rumoroso** e il risultato dipendeva dalla fortuna.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-84.1 | Ogni writer che pusha su `main` ha un **retry con ri-sincronizzazione** (3 tentativi: fetch → rebase → rigenera → riprova) | Il writer che perde la race si riallinea e riprova: il fallimento diventa un ritardo, non una perdita. Il `git add` esplicito della lista dei target viene rifatto dopo il rebase (i file staged dal rebase non sono gli stessi) |
| D-84.2 | Il gate `checkPushSync` accetta **due** strategie: **preventiva** (sync in uno step precedente) **oppure** **retry** (sync dentro il ciclo che contiene la push) | Il contratto è «una strategia di ri-sincronizzazione», non «un sync preventivo»: il retry è più forte (copre anche la corsa persa), il sync preventivo è più economico (evita il tentativo fallito). Sono complementari |
| D-84.3 | Il retry è riconosciuto solo se la ri-sincronizzazione sta **dentro il ciclo** che contiene la push | Una sincronizzazione «tardiva» (dopo la push, fuori da un ciclo) non è una strategia: il push è già fallito. Senza questo criterio il gate accetterebbe la forma che il test scenario «sync dopo il push» considera un bug |
| D-84.4 | La push dentro un **commento** non è una push | Il commento che spiega la race cita il comando senza eseguirlo: il gate deve guardare il codice, non la prosa |
| D-84.5 | Le fixture dei test sono aggiornate al nuovo contratto | T2 (sync preventivo rimosso, retry presente) → il gate **passa** (il retry copre la race); **T2b** (nessuna strategia) → il gate **fallisce**. La copertura `git add` (T2 di `test-workflow-git-add-coverage.sh`) ora rimuove il target da **tutte** le righe `git add`, perché con il retry ce n'è più di una |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **75%** (21 story su 28, effort 77%), restano **7 step**.
Lavoro di **governance**.

**Cosa è pronto.** Il retry nei due writer (`auto-state-aggregate.yml`, `auto-bundle.yml`); il
contratto del gate `checkPushSync` esteso alle due strategie, con il riconoscimento del ciclo; il
gate che distingue i commenti dal codice; tre suite di scenario aggiornate (19 + 8 + 6 assert).

**Cosa manca.** Nulla sul tema: con il retry, la race non può più perdere un writer. L'unica
residua è **cosmetica**: il commit del retry usa la stessa identità bot e lo stesso messaggio dei
commits precedenti, quindi nella history di `main` non si distingue «commit del writer» da
«commit del retry». Separare i due messaggi renderebbe la diagnosi post-mortem più immediata.

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano.

**Gate di testabilità.** `node scripts/validate-workflows.mjs .github/workflows` → 2 writer verificati,
0 fallimenti · `bash scripts/test-workflow-push-sync.sh` → **19 assert, 0 falliti** ·
`bash scripts/test-workflow-git-add-coverage.sh` → **8 assert, 0 falliti** ·
`bash scripts/test-workflow-writer-ordering.sh` → 6 assert, 0 falliti ·
`node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`node scripts/check-readme-facts.mjs` → 0 falliti.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Sostituire l'esclusione reciproca con la **convergenza** non basta: i writer devono poter **recuperare** dalla race | La lezione è la stessa di ADR-0008 in un altro contesto: l'invariante è sullo **stato finale**, non sul numero di run. Un protocollo che prevede il fallimento e non prevede il recupero è un protocollo che produce stati casuali |
| Il contratto di un gate deve dire **cosa** deve essere vero, non **come** | «Ogni writer deve avere una strategia di ri-sincronizzazione» accetta due forme; «deve esserci un sync preventivo» ne accetta una sola e rifiuta la più robusta. Il criterio del ciclo (D-84.3) serve a non allargare il contratto fino a includere forme che non proteggono |
| Le fixture dei test sono un **contratto esecutivo**: quando il contratto cambia, la fixture deve cambiare con lui | T2 è passata da «il gate deve fallire» a «il gate deve passare»: senza quel cambiamento il test avrebbe bloccato la soluzione corretta. Un test che fissa una forma invece di un comportamento diventa un ostacolo |

## Documenti aggiornati

- `.github/workflows/auto-state-aggregate.yml`, `auto-bundle.yml`: retry con ri-sincronizzazione
- `scripts/validate-workflows.mjs`: contratto del gate `checkPushSync` (preventiva **oppure** retry),
  push nei commenti ignorata
- `scripts/test-workflow-push-sync.sh`: T2 (retry) e **T2b** (nessuna strategia) · 19 assert
- `scripts/test-workflow-git-add-coverage.sh`: la mutazione rimuove il target da tutte le righe `git add`
- `docs/12-DEVOPS.md §9.10`: il contratto del gate · `docs/18-DEV-LOG.md` §50
- `scripts/generate-bundle.ps1`: `$files` += la sessione 84 · `docs/INDEX.md`
