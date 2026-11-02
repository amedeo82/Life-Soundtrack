---
number: 88
title: "Recovery post-merge: stato di merge della sessione 87 e fix dei due workflow post-merge"
date: 2026-11-02
state: 🟢
merged: true
merged_commit: "591dceba97b464095d74df0b22759d47c6840e22"
merged_date: "2026-11-02T13:34:27Z"
branch: fix/279-recovery-post-merge-stato-di-merge-della
pr: 280
claim: kilo-HP-ELITEBOOK-c88rec
tags: [devops, recovery, workflow, protocollo]
---

# Sessione 88 — Recovery post-merge: la catena dei writer era rotta

> **Oggetto**: il merge della PR #278 (Sessione 87, issue #277) ha lasciato `main`
> **rosso**. La causa non era la PR: erano **due difetti preesistenti** della catena
> post-merge, che nessun gate copriva e che nessuno aveva notato.

## Sintesi

| # | Difetto | Sintomo | Causa | Remediation |
|---|---------|----------|-------|-------------|
| 1 | `auto-session-merge-state` senza `pull-requests: read` | **HTTP 403** dall'API REST sui pull request: il workflow usciva 2 **prima** di applicare lo stato di merge | le `permissions:` del workflow coprivano `contents: write` e `issues: read`, ma la chiamata `GET /repos/{owner}/{repo}/pulls/{N}` richiede `pull-requests: read` | scope aggiunto |
| 2 | `auto-state-aggregate` e `auto-bundle` con **sintassi bash** in step `shell: pwsh` | **ParserError** a runtime: i blocchi aggregati e il bundle non venivano piu' committati dal writer | il ciclo di retry (`for attempt in 1 2 3; do ... done`) era bash, dentro uno step PowerShell | riscritto in sintassi PowerShell + **gate** che syntax-checka ogni blocco `run:` |
| 3 | Lo stato di merge della sessione 87 mai applicato | `main` rosso: «la PR #278 e' MERGED, ma il frontmatter dichiara `merged: false`» | conseguenza di (1) | recovery: stato applicato con `apply-merge-state.mjs` |

## Cosa è emerso (e perché non era emerso prima)

1. **Un gate sulla sintassi dei workflow non esisteva**: `validate-workflows.mjs` controlla YAML,
   scope dei permessi, `paths:` e copertura del `git add` — **non** che lo script di uno step sia
   sintatticamente valido nello shell che lo esegue. Il ParserError arrive a runtime, dopo il
   checkout: il fallimento e' visibile solo su `main`, quando ormai il danno e' fatto.
2. **La stessa classe di bug era in due workflow**: `auto-state-aggregate.yml` (i blocchi
   aggregati) e `auto-bundle.yml` (il bundle). Entrambi hanno fallito lo stesso giorno: nessuno
   dei due writer ha piu' committato nulla.
3. **Il 403 e' la stessa classe di difetto delle sessioni 81-83**: il commento del workflow
   `auto-session-merge-state.yml` lo segnalava gia' («vanno recuperate a mano») senza che nessuno
   avesse aggiunto lo scope mancante.
4. **Il gate `check-merge-state.mjs` ha fatto il suo lavoro**: e' fail-closed, e ha trasformato
   «una sessione dimenticata» in «`main` rosso» — un sintomo che si vede, invece di un sintomo
   che non si vede. Il drift silenzioso era l'altra meta' del problema (il gate di encoding, #277).

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-88.1 | Il fix dei due workflow e' in **una** PR di recovery, non in due | i due difetti sono la stessa classe: sintassi non validata rispetto allo shell dichiarato |
| D-88.2 | Nuovo gate `check-workflow-syntax.mjs`: ogni blocco `run:` e' syntax-checkato con il **parser dello shell dichiarato** | Un ParserError a runtime su `main` e' il tipo di fallimento piu' costoso del repository: blocca la catena di writers e resta rosso |
| D-88.3 | Le espressioni GitHub `${{ ... }}` sono neutralizzate prima del parsing | GitHub le interpola **prima** dell'esecuzione: il parser non deve giudicarne la sintassi (altrimenti ogni workflow che le usa risulterebbe invalido) |
| D-88.4 | Il blocco bash viene **saltato** quando `bash` non e' utilizzabile (stub WSL su Windows) | saltare un controllo e' diverso da farlo fallire: il gate deve distinguere «file rotto» da «interprete assente». Sulla CI (ubuntu) il bash e' quello vero e il controllo e' completo |
| D-88.5 | Lo stato di merge della sessione 87 viene applicato **nella PR di recovery**, non con un commit su `main` | `AGENTS.md`: niente commit su `main` dagli agenti; il recovery passa da una PR `docs:`/`fix:` |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **70%** (21 story su 30, effort 72%), restano **9 step**.
Lavoro di **devops**: nessuna story di prodotto e' toccata, ma la catena post-merge — quella che
scrive i blocchi aggregati, il bundle e lo stato di merge delle sessioni — smette di essere
rottta.

**Cosa e' pronto.**
- `auto-session-merge-state.yml`: `pull-requests: read` aggiunto (era la causa del 403).
- `auto-state-aggregate.yml` e `auto-bundle.yml`: ciclo di retry riscritto in **PowerShell**
  (`for` / `if` / `break`), con `exit 1` se il push fallisce dopo 3 tentativi.
- `scripts/check-workflow-syntax.mjs`: gate nuovo — estrae ogni blocco `run:` con il suo `shell:`
  effettivo e lo syntax-checka (`pwsh` -> parser di PowerShell, `bash` -> `bash -n`); neutralizza
  `${{ ... }}`; salta i blocchi bash quando l'interprete non e' utilizzabile.
- `scripts/test-merge-state.mjs` non serve: il fix di `apply-merge-state.mjs` (issue #275) ha gia'
  il suo test (`scripts/test-apply-merge-state.mjs`, T1..T3).
- Stato di merge della sessione 87 applicato (`merged: true`, commit `63588098...`, data
  `2026-11-02T12:51:43Z`): `check-merge-state.mjs` → 63 confronti, 0 falliti.

**Cosa manca.** Nulla sul piano della remediation: i due difetti sono corretti, il terzo (lo stato
di merge) e' recuperato, e il gate che li intercetta in futuro e' in CI. Il `main` torna verde
quando questa PR viene mergiata e la catena post-merge — **ora funzionante** — ricostruisce i
blocchi.

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano: li rigenera
l'aggregatore post-merge (che, con il ParserError risolto, torna a scrivere).

**Gate di testabilità.** `node scripts/check-workflow-syntax.mjs` → 11 blocchi pwsh verificati,
0 non validi (10 blocchi bash saltati in locale: il bash di Windows e' lo stub WSL, la CI ha il
vero) · `node scripts/validate-workflows.mjs .github/workflows` → 0 falliti ·
`node scripts/check-merge-state.mjs` → 63 confronti, 0 falliti ·
`node scripts/check-encoding.mjs` → 0 errori ·
`node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Il lint dei workflow validava **il file**, non **lo script che il file esegue** | Un workflow puo' essere YAML valido, avere tutti gli scope giusti, passare `validate-workflows`, e fallire a runtime con un ParserError. Il gate mancante era fra «il file e' ben scritto» e «lo script gira» |
| Lo **stesso** difetto in due workflow che falliscono lo stesso giorno | Il primo fallimento (auto-state-aggregate) era gia' un sintomo; il secondo (auto-bundle) e' stato scambiato per rumore. Un sintomo che si ripete non e' rumore: e' una classe di bug |
| Un gate fail-closed trasforma un difetto invisibile in uno **rosso** | `check-merge-state.mjs` non ha reso il merge-state piu' semplice da ottenere: ha reso **impossibile** non accorgersi che manca. Il costo e' un recovery; il beneficio e' che il drift non vive in `main` |
| Il recupero non deve essere un commit su `main` | La via prevista (`AGENTS.md`, regola «NO commit su main») e' una PR di recovery: il risultato resta tracciato, revisabile e reversibile |

## Documenti aggiornati

- `.github/workflows/auto-session-merge-state.yml` (scope `pull-requests: read`)
- `.github/workflows/auto-state-aggregate.yml`, `.github/workflows/auto-bundle.yml` (sintassi PowerShell)
- `.github/workflows/ci.yml` (step «Sintassi dei blocchi `run:` dei workflow»)
- `scripts/check-workflow-syntax.mjs` (nuovo)
- `docs/state/sessions/87-encoding-remediation.md` (stato di merge recuperato)
- `docs/12-DEVOPS.md` §9.10 (catalogo dei gate: nuova riga)
- `docs/BUNDLE.md` (rigenerato)
