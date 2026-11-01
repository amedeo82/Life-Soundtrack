---
number: 79
title: "Protocollo agenti come contratto verificato (ADR-0012)"
date: 2026-11-01
state: 🟢
merged: true
merged_commit: "2478a9a5cf122c350bf26034f502dbab6e8f134f"
merged_date: "2026-11-01T14:55:25Z"
branch: feat/248-protocollo-contratto-verificato
pr: 249
claim: kilo-hp-elitebook-ef4d
tags: [devops, governance, tooling]
---

# Sessione 79 — Protocollo agenti come contratto verificato (ADR-0012)

> **Issue di tracking**: #248 (epic). **Branch**: `feat/248-protocollo-contratto-verificato`.
> **PR**: **#249** (aperta il 2026-11-01).
>
> La sessione è il primo lotto dell'epic #248: **ADR-0012** (la decisione) + **I2-a** (chiusura
> dei drift misurati). I lotti successivi (gate di coerenza, claim atomico, rifinitura di
> `AGENTS.md`) sono descritti in ADR-0012 §"Stato dell'implementazione" e restano da fare.

## Sintesi

`AGENTS.md` era l'unico artefatto di governance del repository **senza generatore e senza gate**.
Tutti gli altri ne hanno uno: `check-readme-facts.mjs` per il README, `check-merge-state.mjs` per
le sessioni, `validate-workflows.mjs` per i workflow, `validate-labels.mjs` per le label,
`aggregate-state.ps1` per i blocchi aggregati, `generate-bundle.ps1` per il bundle. Il drift che ne
consegue è stato **misurato** prima di fare qualsiasi modifica: otto drift concreti (D1-D8) e tre
difetti strutturali del flusso automatico, nessuno ipotetico.

Il project owner ha deciso (2026-11-01) cinque punti: il contratto resta in **due file**
(`AGENTS.md` + ADR-0012) e non in una directory di moduli; la **storia** va in `docs/18-DEV-LOG.md`;
la **checklist PR** ha un solo artifact (il PR template); il gate di integrità degli `AGGREGATE-*`
diventa **bloccante**; il **claim** diventa un comando atomico che esegue claim e riverifica in
sequenza.

La sessione scrive l'ADR-0012 e chiude i drift D1-D8, più due difetti che erano emersi leggendo
il flusso automatico: il fallback a Windows PowerShell 5.1 nel `pre-push` (che poteva **scrivere
mojibake in `docs/BUNDLE.md`** e committarlo) e il `pre-commit` che, bloccando i commit parziali,
spingeva gli agenti verso `--no-verify` — cioè verso la disattivazione anche del check del branch.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-79.1 | Il protocollo resta in **2 file** (`AGENTS.md` + ADR-0012), non in `modules/`+`checklists/`+`references/` | Ogni file aggiunto è un elenco da mantenere a mano in `generate-bundle.ps1` e `docs/INDEX.md`: la classe di drift di issue #136. Lo split non chiude nessuno degli 8 drift misurati e rompe 29 riferimenti `§"…"` + 8 citazioni dagli script |
| D-79.2 | La **storia** del protocollo va in `docs/18-DEV-LOG.md` | Il repo ha già tre sedi di storia (`SESSIONS.md`, `18-DEV-LOG.md`, `BUNDLE.md`); una quarta (`CHANGELOG-AGENTS.md`) sarebbe un nuovo drift |
| D-79.3 | La **checklist PR** vive solo in `.github/pull_request_template.md` | L'artefatto interattivo che GitHub rende bloccante al merge non conteneva 5 gate dichiarati vincolanti; `AGENTS.md` ne conteneva una copia con 10 voci diverse. Due copie ⇒ due fonti di verità |
| D-79.4 | `check-aggregate-blocks.mjs` sarà **bloccante** | È un controllo **testuale** (Node puro): non soffre dell'incompatibilità PS 5.1/PS 7 che giustifica il warning-only di `aggregate-state -Check`, quindi può bloccare senza rischi di falso positivo cross-platform |
| D-79.5 | `agent-claim.ps1` farà **claim + riverifica in sequenza atomica** | La riverifica era il passo più fragile del protocollo (interpretazione manuale dell'ID commento più basso) ed è deterministica: diventa codice con exit code |
| D-79.6 | Il `pre-commit` **separa le invarianti dall'igiene**: pattern del branch bloccante, working tree pulito advisory (opt-in `LIFE_SOUNDTRACK_STRICT_CLEAN=1`) | Il check "clean tree" bloccava i commit parziali e l'unico escape (`--no-verify`) disabilitava anche F1/F7. La sua funzione (F5) è mitigata strutturalmente dalla worktree (issue #53) |
| D-79.7 | Il fallback a **Windows PowerShell 5.1 è vietato** in script e hook | Sotto 5.1 il parsing sovradecodifica i `.ps1` UTF-8 senza BOM (F9-bis): il mojibake finisce scritto nei file globali. Se `pwsh` non c'è, lo script non scrive: avvisa e esce |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **75%** (21 story completate su 28, effort pesato 77%),
restano **7 step** (3.2 Ricordi + Share · 3.3 Esplora + Analisi · 4.2 MusicBrainz lookup ·
4.3 Artwork enrichment · 5.1 Privacy spec finale · 5.2 Export e purge · 6.1 Upgrade toolchain).
Questa sessione non implementa story di prodotto: chiude lavoro di **governance** su un'epic
(#248) che non è una story del backlog. Il protocollo agenti passa da **0 gate** a **0 gate
nuovi in questa PR** — i gate che lo rendono verificabile (I2-b: coerenza del protocollo e
invarianti ADR-0008) e gli script che lo rendono atomico (I2-c: claim, PR) sono i lotti
successivi dell'epic, descritti in ADR-0012 §"Stato dell'implementazione".

**Cosa è pronto.** ADR-0012 scritta e approvata; **8 drift chiusi** (D1 versione in `docs/INDEX.md`,
D2 `phase-post`, D3 exit 14, D4 `-Check` a tratto singolo, D5 ordine worktree/claim, D6 cifre come
puntatori, D7 query senza `jq` esterno, D8 checklist unica); fallback PS 5.1 rimosso dal
`pre-push`; `pre-commit` separato in invariante bloccante + igiene advisory; PR template
completato con le 10 voci che mancavano.

**Cosa manca.** I2-b (`check-protocol-consistency.mjs`, `check-aggregate-blocks.mjs` + test
negativi), I2-c (`agent-claim.ps1`, `agent-pr.ps1`, `check-claim-state.mjs`), I3 (rifinitura di
`AGENTS.md` a ~400 righe con 77 anchor invariati).

**Salute tecnica.** Worktree attiva su `feat/248-protocollo-contratto-verificato` (push early
eseguito). Claim riverificato: ID commento `6559382507`, unico claim sull'issue #248. Nessun
blocco `AGGREGATE-*` modificato a mano. `pwsh` 7.6.9 (baseline). Gate eseguiti prima del merge:
`generate-bundle.ps1 -Check` (exit 0), `aggregate-state.ps1 -Check` (exit 0),
`check-readme-facts.mjs` (exit 0), `test-pre-commit-clean-check.sh` (14 assert, 0 falliti).

**Gate di testabilità.** La verifica della sessione è automatica: i gate di `ci.yml` (bloccanti)
più `bash scripts/test-post-merge.sh` e `bash scripts/test-setup-worktree.sh` per la parte di
hook. Il criterio di accettazione della I2-a è che **nessuno degli 8 drift sia riproducibile**:
verificato con un'ispezione mirata dei file citati.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Il drift non era «AGENTS.md è troppo lungo»: era «nessuno confronta `AGENTS.md` con la realtà». La lunghezza è il sintomo, l'assenza di gate è la causa | Le decisioni di ristrutturazione (D-79.1) sono state prese **dopo** aver misurato i drift, non prima |
| La query dei candidati (`\| jq`) **non gira sull'ambiente di riferimento**: `jq` non è installato. Il filtro equivalente con il `--jq` integrato di `gh` funziona | Ogni comando del protocollo deve essere eseguibile **senza tool opzionali**; i gate che lo fanno (`check-readme-facts.mjs`, `validate-labels.mjs`) usano solo i moduli built-in di node |
| `gh issue view --json comments` restituisce i **node id** GraphQL (`IC_kwDOV…`), non l'ID numerico che ADR-0006 usa come discriminatore. Il discriminatore si legge solo dall'API REST (`gh api`) | La riverifica automatizzata deve usare `gh api repos/<owner>/<repo>/issues/<N>/comments` e ordinare per `id` numerico — non per `node_id` né per `created_at` |
| Un hook che esiste per prevenire il drift può **causarlo**: il `pre-push` rigenerava il bundle con PS 5.1, che scrive mojibake | Gli hook che scrivono file devono avere la stessa baseline degli script che dichiarano: `pwsh` 7, o niente |
| Due gate identici con wording diverso divergono: **22 voci per parte, 2 identiche** | Il gate di coerenza deve vietare il duplicato (D3 del owner), non solo segnalarlo |

## Documenti aggiornati

- `docs/13-ADR/0012-agent-protocol-contract.md` (nuovo)
- `docs/state/sessions/79-protocollo-contratto-verificato.md` (nuovo)
- `AGENTS.md` (v1.33 → v1.34): tabella label, ordine worktree/claim, query senza `jq`, cifre come
  puntatori, checklist ridotta a puntatore, regole d'oro del pre-commit, footer
- `.github/pull_request_template.md`: checklist completata (unico artifact)
- `.githooks/pre-push`: fallback PS 5.1 rimosso
- `.githooks/pre-commit`: invariante (branch) bloccante, igiene (clean tree) advisory
- `.githooks/README.md`: failure mode coperti e comportamento aggiornati
- `scripts/post-merge.ps1`: exit code documentato (14), flag canonici (`-Check`)
- `scripts/generate-bundle.ps1`: `$files` += ADR-0012 + sessione 79
- `docs/INDEX.md`: versione di `AGENTS.md`, riga ADR-0012, riga `18-DEV-LOG.md`
- `docs/18-DEV-LOG.md`: entry della sessione 79
