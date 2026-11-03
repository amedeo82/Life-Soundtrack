---
number: 96
title: "Il writer di stato di merge copre anche le story (issue #297)"
date: 2026-11-03
state: 🟢
merged: true
merged_commit: "37975de11931b262379d0dad5caa2186926141aa"
merged_date: "2026-11-03T19:22:23Z"
branch: fix/297-fix-devops-le-story-non-hanno-un-writer
pr: 300
claim: kilo-hp-elitebook-6e15
tags: [devops, stato, story, protocollo, writer]
---

# Sessione 96 — il writer e il gate coprono anche le story (issue #297)

> **Oggetto**: la Sessione 94 (issue #266) ha allineato lo stato di merge della **Story 2.5** con un
> doc-sync manuale e ha tracciato il **gap strutturale** che lo rendeva necessario: nessun writer e
> nessun gate coprivano il perimetro `docs/state/stories/`. Questa sessione chiude **la classe** di
> drift, non il caso.

## Sintesi

L'issue #297 era stata chiusa **prematuramente**: la PR #298 (doc-sync della Story 2.5) portava la
keyword `Closes #297`, quindi GitHub l'ha chiusa al merge — ma il corpo della PR dichiarava
esplicitamente di chiudere **il caso della 2.5**, non il gap. Il gap è stato riaprire l'issue
(2026-11-03), correggere le label (`status:done` e `status:in-review` erano in contraddizione fra
loro) e riprenderlo.

Il gap era misurabile in tre righe di codice: `scripts/apply-merge-state.mjs` e
`scripts/check-merge-state.mjs` avevano **una sola** directory di ricerca (`docs/state/sessions/`) e
**un solo** formato (`state`/`merged` per le sessioni). Le story dichiarano lo stesso fatto — «la PR
è stata mergiata in `main`» — in un formato diverso: `status: done`, e i fatti del merge in
`merged_commit`/`merged_date`.

La correzione è una sola decisione (`ADR-0013` D-13.7): **il perimetro del writer e del gate è la
classe dei file di stato**, non un sottoinsieme. Ogni formato viene riconosciuto dal frontmatter e
trattato con i suoi campi.

## Cosa è stato fatto

- **`scripts/apply-merge-state.mjs`**: il writer cerca ora nei **due** perimetri (`docs/state/sessions/`
  e `docs/state/stories/`). Su una story il merge significa `status: done`, `merged_commit` (SHA
  completo) e `merged_date` (`YYYY-MM-DD`, il formato dello schema delle story): il campo `merged`
  non viene introdotto, perché lo schema delle story non lo dichiara — il fatto è dichiarato una volta
  sola. Gli stati **terminali** dichiarati (`blocked`, `wontdo`) non vengono sovrascritti: il merge di
  una PR non cancella un esito dichiarato.
- **`scripts/check-merge-state.mjs`**: il gate confronta **anch'esso** i due perimetri con lo stato
  reale delle PR ed è fail-closed. Una story con la PR mergiata e `status` diverso da `done` è drift,
  come un `merged_commit` o un `merged_date` che non coincidono; la modalità `--defer-unapplied`
  (D-13.4) differisce anche le story, con lo stesso criterio oggettivo (uguaglianza di SHA).
- **Allineamento dei fatti di merge preesistenti**: il gate esteso ha intercettato **6 drift** già
  presenti in `main` — le Story 0.2, 0.5, 1.2, 3.1, 3.4 e 4.4 dichiaravano un `merged_commit` diverso
  dal merge commit reale (in tre casi assente) e una data di merge sbagliata. Sono stati allineati
  **dal writer stesso**, eseguendo `apply-merge-state.mjs` sulle PR corrispondenti: i fatti sono
  quelli dell'API GitHub, non quelli dichiarati a mano.
- **Documentazione**: `ADR-0013` (D-13.7 e due righe nella tabella dei gate), `docs/state/_index.md`
  (l'invariante delle story, simmetrico a quello delle sessioni), `AGENTS.md` v1.44 (la regola nella
  tabella «regola ⟺ gate» e la nota sul writer), `docs/12-DEVOPS.md` §9.10, `docs/18-DEV-LOG.md` §52.
- **Test**: `scripts/test-apply-merge-state.mjs` da 12 a **33 assert** (T4..T9: la story, la story
  già `done` senza i fatti del merge, lo stato terminale, sessione + story della stessa PR, l'assenza
  di file di stato, l'idempotenza); `scripts/test-merge-state-gate.sh` da 16 a **24 assert**
  (T13..T18: story coerente, `status: in_review` su PR mergiata, `merged_commit` assente,
  `merged_date` errato, story senza PR, il caso strutturale differito).

## Analisi di avanzamento

**Numeri.** Nessun codice applicativo toccato: il lavoro è di **stato, gate e documentazione**. La
percentuale di implementazione delle story resta **73%** (22 su 30, effort 76%, 8 step rimanenti):
questo lavoro non implementa una story, chiude un gap di processo. Il numero che cambia è quello dei
**confronti del gate**: da 70 a **92** (70 sessioni + 22 story), e i confronti coprono ora **tutta**
la classe dei file di stato.

**Cosa è pronto.**

- Il perimetro `docs/state/stories/` ha un **writer** e un **gate**: una story mergiata non può più
  restare `in-review` senza che il gate fallisca e senza che il writer la corregga al merge.
- I **6 drift preesistenti** sulle story sono chiusi: i fatti di merge dichiarati nelle Story 0.2,
  0.5, 1.2, 3.1, 3.4 e 4.4 coincidono ora con lo stato reale delle PR.
- La regola è **scritta e verificata**: una riga nella tabella «regola ⟺ gate» di `AGENTS.md`
  (v1.44), l'invariante in `docs/state/_index.md`, la decisione D-13.7 in `ADR-0013` e i gate che la
  impongono (`check-merge-state.mjs`, `apply-merge-state.mjs`).

**Cosa manca.** La classe di drift è chiusa; restano due punti **fuori perimetro**, dichiarati e non
modificati qui:

- le chiavi i18n `insight.mood.angry` / `insight.mood.neutral` (sessione concorrente, in
  `stash@{0}`): non sono usate da nessun codice e il namespace non è nella spec
  `docs/08-COPY-I18N.md` §2.15 — vanno decise a parte (recupero in PR dedicata o abbandono);
- il **post-merge cleanup** dei branch e delle worktree residue della Sessione 94 (procedura
  canonica `scripts/post-merge.ps1`, eseguita dalla working copy principale).

Nota: `docs/SESSIONS.md`, `docs/INDEX.md`, `docs/11-BACKLOG.md` e `docs/BUNDLE.md` hanno **blocchi
aggregati**: i blocchi si aggiornano da soli dopo il merge (regola V1 di ADR-0008); in questa PR è
stato toccato solo il contenuto dei file già registrati in `$files`, e il bundle rigenerato di
conseguenza.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano. Il writer è idempotente (test T9) e
il gate resta fail-closed su entrambi i perimetri.

**Gate di testabilità.** `node scripts/check-merge-state.mjs` → 92 confronti, 0 falliti ·
`node scripts/test-apply-merge-state.mjs` → 33 assert, 0 falliti ·
`bash scripts/test-merge-state-gate.sh` → 24 assert, 0 falliti ·
`node scripts/check-aggregate-blocks.mjs --base origin/main --head HEAD` → 0 violazioni ·
`node scripts/check-readme-facts.mjs` → 15 check, 0 falliti · `node scripts/check-encoding.mjs` →
0 errori · `node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| # | Osservazione | Conseguenza |
|---|--------------|-------------|
| 96-1 | Una **keyword di chiusura** in una PR che risolve solo un *caso* chiude l'issue che descriveva la *classe* | La PR #298 chiudeva il caso della 2.5 ma portava `Closes #297`: l'issue del gap è stata chiusa con il gap aperto, e nessuno se n'era accorto perché il gate copriva solo le sessioni |
| 96-2 | Un gate che copre una classe di dati con un **perimetro più stretto** è un fail-open silenzoso | Sessioni e story sono la stessa classe («lo stato di merge di un file di stato») con due formati: coprirne uno solo lasciava l'altro fuori, in silenzio, con la CI verde |
| 96-3 | Il **perimetro** di un gate è parte della sua specifica, non un dettaglio implementativo | Il gate esteso ha intercettato 6 drift già in `main`: il perimetro stretto non era solo un futuro rischio, era un drift presente e non visto |
| 96-4 | Il fix giusto è quello che si può **riusare** per chiudere il drift esistente | I 6 file allineati sono stati corretti dal writer introdotto nella stessa PR: nessun dato dichiarato a mano |

## Documenti aggiornati

- `scripts/apply-merge-state.mjs` — writer: perimetro `docs/state/stories/`, formato story, stati terminali rispettati
- `scripts/check-merge-state.mjs` — gate: perimetro `docs/state/stories/`, fail-closed, differimento `--defer-unapplied`
- `scripts/test-apply-merge-state.mjs` — T4..T9 (story, idempotenza, stato terminale)
- `scripts/test-merge-state-gate.sh` — T13..T18 (drift delle story)
- `docs/13-ADR/0013-post-merge-automation.md` — D-13.7 e tabella dei gate
- `docs/state/_index.md` — invariante «una story con PR mergiata è una story `done`»
- `AGENTS.md` — v1.44: regola ⟺ gate e nota sul writer
- `docs/INDEX.md` — versione del protocollo allineata a v1.44
- `docs/12-DEVOPS.md` — catalogo dei gate: il perimetro delle story
- `docs/18-DEV-LOG.md` — §52 e changelog del protocollo
- `docs/state/stories/{0.2,0.5,1.2,3.1,3.4,4.4}-*.md` — fatti di merge allineati al reale
- `scripts/generate-bundle.ps1` — sessione 96 registrata in `$files`
