---
number: 92
title: "Node 24 per le action dei workflow: l'inventario incompleto e il gate che lo rende verificabile"
date: 2026-11-03
state: 🟡
merged: false
branch: feat/283-node24-actions
pr: 0
claim: kilo-hp-elitebook-7c3f
tags: [devops, ci, workflow, node24, protocollo]
---

# Sessione 92 — Node 24 per le action dei workflow (issue #283)

> **Oggetto**: l'issue #283 chiedeva di migrare le action dei workflow da Node 20 a
> Node 24. La verifica sulla codebase attuale ha confermato la premessa, ma ha
> trovato **due difetti nell'inventario** dell'issue stessa: due action su node20
> non erano elencate, e la major "neutra" proposta per `setup-node` non era
> semanticamente neutra. In più la issue è rimasta **senza implementazione** per
> 16 ore: la claim dell'agente precedente era scaduta (TTL 12 ore di ADR-0006).

## Sintesi

La premessa dell'issue è **valida e più forte di quanto dichiarato**: Node 20 non è
solo "deprecato", è stato **rimosso dai runner GitHub il 2026-09-23** (changelog
GitHub del 2025-09-19, aggiornato il 2026-08-25). Le action che dichiarano
`using: 'node20'` non girano più su un runtime supportato: il runner le forza su
Node 24, ma il runtime dichiarato resta fuori supporto.

L'inventario dell'issue, però, copriva **4 delle 6 action** usate dal repository.
Le altre due — `actions/upload-artifact@v4` e `actions/download-artifact@v4` —
dichiarano anch'esse `node20`, e senza il loro bump il criterio di accettazione
«nessun workflow referenzia una action che dichiara `using: 'node20'`» restava
**insoddisfacibile**: la issue elencava i mezzi, non il fine, e i mezzi erano
incompleti.

| Action | Prima major node20 | Prima major node24 | Note |
|--------|--------------------|-------------------|------|
| `actions/checkout` | v4 | **v5** | v6 persiste le credenziali su file separato, v7 blocca il checkout dei fork |
| `actions/setup-node` | v4 | **v5** | v5 introduce il caching automatico da `packageManager` (vedi sotto), v6 lo limita a npm, v7 migra a ESM |
| `actions/github-script` | v7 | **v8** | v9 inietta `getOctokit` come parametro ESM |
| `pnpm/action-setup` | v4 | **v5** | v6 aggiunge il supporto di pnpm v11 |
| `actions/upload-artifact` | v4, **v5** | **v6** | v5 è già "preliminary node24" ma **gira ancora su node20** |
| `actions/download-artifact` | v4, v5, **v6** | **v7** | v8 migra a ESM e rende `digest-mismatch` un errore |

La scelta della major è sempre la **prima che dichiara node24** e che non
introduce un cambio di comportamento non correlato al runtime: le major
successive (ESM, persistenza delle credenziali su file separato, blocco dei fork
in `pull_request_target`/`workflow_run`, `digest-mismatch` come errore) restano
fuori perimetro, come dice l'issue stessa.

**Il caso subdolo è `upload-artifact`**: la v5 dichiara node20 nella sua
`action.yml` ("v5 had preliminary support for Node.js 24, however this action
was by default still running on Node.js 20"): un bump "a vista" alla major
più recente compatibile (`v5`) avrebbe lasciato il repository su node20 senza
che nulla lo segnalasse. Il gate introdotto in questa sessione copre anche
questa classe.

## La claim scaduta

L'issue #283 era `in-progress` con la claim di `kilo-hp-elitebook-457a`
(2026-11-02T16:21:00Z) e la worktree `ls-283-node24-actions` già creata, ma il
branch non aveva **zero commit unici** rispetto a `origin/main`: il lavoro non
era mai iniziato. Dopo 16 ore di inattività la claim era **scantita** (TTL 12 ore
di ADR-0006).

La presa in carico ha rivelato un **difetto dello strumento**: `agent-claim.ps1`
confrontava l'id numerico più basso fra **tutti** i commenti `claim:`, mentre il
protocollo (AGENTS.md §"Procedura di claim", punto 4) confronta l'id più basso
fra i claim **non ancora rilasciati**. Un claim rilasciato ha sempre l'id più
basso, quindi l'agente che subentra a una claim scantita avrebbe fatto `yield:`
pur avendo legittimamente preso l'issue: il percorso documentato era **ineseguibile
dallo strumento canonico**. Corretto nel ramo della PR: la riverifica esclude
i claim rilasciati da un commento `release:`/`stale-release:` successivo che ne
cita l'agente.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-92.1 | L'inventario dell'issue è corretto **esteso** alle 6 action reali, non alle 4 dichiarate | Il criterio di accettazione è sullo **stato** del repository, non sui mezzi: con 4 action il gate sarebbe rimasto rosso |
| D-92.2 | Ogni action va sulla **prima major node24**, non sulla più recente | Le major successive portano cambi di comportamento non correlati al runtime (ESM, credenziali, fork, digest): restano fuori perimetro |
| D-92.3 | `setup-node@v5` va bene **perché** i workflow dichiarano già `cache: pnpm` | La v5 introduce il caching automatico da `packageManager` (che il repo ha: `pnpm@9.15.9`), ma nel suo codice l'input esplicito `cache` ha la precedenza: il comportamento resta identico |
| D-92.4 | L'invariante diventa un **gate fail-closed** in `validate-workflows.mjs` | ADR-0012: una regola senza gate è un consiglio. La mappa `NODE24_ACTIONS` elenca la prima major node24 di ogni action: un'azione assente dalla mappa non è verificabile e non è accettata |
| D-92.5 | Il gate copre **anche i documenti**, non solo i workflow | Il bundle rigenerato contiene i workflow e gli esempi YAML di `12-DEVOPS.md`: senza allinearli, il repository si autotrasmette la deprecazione |
| D-92.6 | La riverifica di `agent-claim.ps1` diventa **release-aware** | Il protocollo confronta i claim «non ancora rilasciati»: senza il filtro, la presa in carico di una claim scantita era impossibile |

## Analisi di avanzamento

**Numeri.** Nessun codice applicativo toccato: la percentuale di
implementazione delle story resta **70%** (21 su 30, effort 72%), **9 step**
rimanenti. Il lavoro è di **devops**.

**Cosa è pronto.**
- I 5 workflow del repository non referenziano più nessuna action node20: **26
  reference**, tutte su major node24 (`checkout@v5`, `setup-node@v5`,
  `github-script@v8`, `pnpm/action-setup@v5`, `upload-artifact@v6`,
  `download-artifact@v7`).
- `scripts/validate-workflows.mjs`: il gate **fail-closed** con la mappa
  `NODE24_ACTIONS` (l'azione assente dalla mappa non è verificabile → non è
  accettata; un riferimento pinnato a SHA non è verificabile → non è accettato;
  le azioni locali e `docker://` sono escluse perché non dichiarano un runtime).
- `scripts/test-workflow-node24-actions.sh` (nuovo): **19 assert** in 6
  scenari, incluso il caso `upload-artifact@v5` (node20 nonostante il nome) e
  il caso dell'azione locale (nessun falso positivo).
- `scripts/agent-claim.ps1`: riverifica release-aware (prerequisito per la presa
  in carico di una claim scantita).
- `docs/12-DEVOPS.md`: esempi YAML allineati (§2 e §9.4) e §9.10 con il gate
  nuovo; `AGENTS.md` v1.41 con la regola nella tabella «regola ⟺ gate».

**Cosa manca.** Nulla sul piano funzionale. Resta un **drift preesistente**,
non introdotto da questa sessione: la tabella §9.10 dichiara «13 job» ma
`ci.yml` ne ha **15** (i due job `gates-portability*` sono entrati con
l'issue #284 e non hanno una riga nella tabella). Il conteggio degli step è
stato allineato (33 → 34) perché è la cifra che questa sessione cambia; il
 conteggio dei job è rimasto com'era e va riallineato con i due gate di
portabilità in una sessione dedicata.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano. Il gate gira
sui workflow reali e su fixture temporanee: non scrive nulla nel repository.

**Gate di testabilità.** `bash scripts/test-workflow-node24-actions.sh` → 19/19 ·
`node scripts/validate-workflows.mjs .github/workflows` → 0 fallimenti ·
`node scripts/check-workflow-syntax.mjs` → 0 non validi ·
`node scripts/check-encoding.mjs` → 0 errori ·
`node scripts/check-protocol-consistency.mjs` → 0 falliti ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un issue che elenca i **mezzi** (quali action bumpare) e non il **fine** (quale stato raggiungere) può essere soddisfatto a metà | L'inventario delle action reali si verifica con un grep, non con la memoria: 4 su 6, e le 2 mancanti erano entrambe node20 |
| Una major può essere "preliminary node24" e **continuare a girare su node20** | `upload-artifact@v5` è il caso: il nome della major non dice il runtime, lo dice `action.yml` |
| Una regola dichiarata solo in prosa torna, perché nessuno la verifica | L'invariante è diventato un gate fail-closed con mappa esplicita: un'azione nuova deve dichiarare la sua major node24 |
| Il confronto "id più basso" senza lo stato del claim rende il percorso di rientro impossibile | La riverifica confronta i claim **non ancora rilasciati**: il claim rilasciato è escluso, altrimenti chi subentra fa `yield:` per sempre |
| Un tool canonico che non implementa il protocollo che documenta è un difetto del tool, non un motivo per procedere a mano | Corretto lo strumento e riusato il percorso documentato |

## Documenti aggiornati

- `.github/workflows/ci.yml`, `post-merge.yml`, `auto-branch-cleanup.yml`,
  `auto-status-done.yml`, `stale-claim-sweeper.yml` (major node24)
- `scripts/validate-workflows.mjs` (gate node24), `scripts/test-workflow-node24-actions.sh` (nuovo),
  `scripts/agent-claim.ps1` (riverifica release-aware), `scripts/generate-bundle.ps1` (`$files`)
- `docs/12-DEVOPS.md` (esempi YAML, §9.10), `docs/INDEX.md` (v1.41), `AGENTS.md` (v1.41)
- `docs/state/sessions/92-node24-actions.md` (questo file)
