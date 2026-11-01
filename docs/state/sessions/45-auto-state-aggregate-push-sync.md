---
number: 45
title: "auto-state-aggregate fallisce con `non-fast-forward`: il doc-sync della Story 1.2 resta fuori da `main` (issue #140)"
date: 2026-10-22
state: 🟢
merged: true
merged_commit: "62a30712d1a4752fbaa4405189bf62ba3da73113"
merged_date: "2026-10-22T16:57:29Z"
branch: fix/140-auto-state-aggregate-race
pr: 141
claim: kilo-hp-elitebook-gq0i
cross_refs: [140, 132, 139, 136, 135, 115, 105]
tags: [devops, ci, bug, block, lazy-state]
---

# Sessione 45 — `auto-state-aggregate` non riusciva più a pushare su `main`

## Sintesi

`auto-state-aggregate.yml` — il workflow che rigenera i blocchi
`<!-- AGGREGATE-* -->` dopo ogni merge su `main`, cioè il meccanismo di
auto-guarimento di ADR-0008 — **falliva su ogni merge** con il push rifiutato:

```
[main 5995c6e] chore(state): auto-aggregate from docs/state/ (ADR-0008 V2)
 1 file changed, 1 insertion(+), 1 deletion(-)
 ! [rejected]        main -> main (non-fast-forward)
```

Due run consecutivi (`39802198985` e `39803721229`, 15:09:48Z e 15:19:20Z del
2026-10-22) sono finiti `failure`. Il merge della Story 1.2 (PR #139, merge
commit `2e1a4cc`) ha lasciato su `main` uno stato **falso**: `docs/state/stories/1.2-adapter-apple-music.md`
era ancora `status: todo`, i blocchi aggregati lo dichiaravano non fatto e il
`README.md` annunciava la 1.2 come «prossima story» — mesi o settimane dopo che
era stata mergata, il progetto si autodichiara indietro.

## Causa radice

`auto-bundle.yml` e `auto-state-aggregate.yml` condividono il concurrency group
`post-merge-main` con `cancel-in-progress: false`, introdotto dalla issue #115 per
serializzare i due writer di `main`. Ma **il group serializza i *run*, non i
*checkout***.

`actions/checkout` senza `with: ref:` mette il workspace sul `github.sha` del
merge commit, non sulla testa corrente di `main`. Sul push di un merge entrambe
le workflow scattano:

| t | `auto-bundle` | `auto-state-aggregate` |
|---|---------------|------------------------|
| t0 | parte, checkout di `5e2d602` | in coda (concurrency group) |
| t1 | sync col tip, rigenera, **pusha** → `6287490` | — |
| t2 | — | parte, checkout di **`5e2d602`** (stesso `github.sha`) |
| t3 | — | rigenera, committa, `git push origin main` |
| t4 | — | **`! [rejected] non-fast-forward`** |

`auto-bundle.yml` sopravvive perché ha uno step «Sync con origin/main»
(`git fetch origin main` + `git rebase origin/main`, con fallback
`git reset --hard`, righe 83-93): si riallinea al tip prima di generare.
`auto-state-aggregate.yml` **non lo aveva** — ed è l'unico writer di `main` che
poteva fallire così.

## Perché è una classe di fallimento silenzioso

Il merge era riuscito, `ci.yml` era verde, e il blocco aggregato era semplicemente
**indietro**. Nessun gate di `ci.yml` confronta i blocchi aggregati con lo stato
reale dei merge: il gate `-Check` di `aggregate-state.ps1` gira sul checkout del
branch della PR, non sul `main` post-merge, e il workflow che dovrebbe
riallineare `main` è quello che falliva. La divergenza è quindi invisibile finché
qualcuno legge il README.

L'effetto osservabile più grave: il doc-sync della Story 1.2 (frontmatter
`status/pr/merged_commit`, 7 checkbox di task, 3 acceptance criteria) era rimasto
**uncommitted sulla working copy di `main`** — vietato dal protocollo, e non
riportabile in `main` da nessuna PR senza toccare i file globali aggregati.

## Cosa è stato fatto

| # | Azione | Perché |
|---|--------|--------|
| 1 | Step «Sync con origin/main» in `auto-state-aggregate.yml`, identico a quello di `auto-bundle.yml` | allinea il workspace al tip prima di generare; il push diventa fast-forward |
| 2 | Gate in `scripts/validate-workflows.mjs`: ogni workflow con `git push origin main` deve avere un sync **prima** del push | il validatore è già bloccante in CI dal #73: nessuno script nuovo che un agente possa dimenticare |
| 3 | `scripts/test-workflow-push-sync.sh` (T1..T5, 15 assert) | un gate che passa sempre non è un gate (lesson 43-1) |
| 4 | Step bloccante in `ci.yml` | il gate entra nella pipeline, non solo in locale |
| 5 | Doc-sync della Story 1.2 in `docs/state/stories/1.2-adapter-apple-music.md` | la **fonte** di ADR-0008: senza, l'aggregator continua a dichiararla `todo` |
| 6 | Allineamento delle sezioni legacy che il merge di PR #139 rendeva false | D.38.1: `11-BACKLOG.md` §roadmap e `INDEX.md` §"Prossimo step tecnico" |
| 7 | Pulizia della cartella `ls-132-…` (worktree deregistrata di PR #139) | residuo locale: 0 path esclusivi e contenuto identico a uno snapshot già mergato, verificato per hash prima di eliminare |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.45.1 | **Sync esplicito** invece di `with: ref: main` sul checkout | `ref: main` da solo basta finché un solo writer fa push per primo: con due writer, il secondo checkout avviene comunque *prima* del push del primo in alcuni ordini di scheduling. Il sync è idempotente e copre entrambi i casi; `ref: main` resterebbe comunque corretto ma è un'assunzione sull'ordine di esecuzione |
| D.45.2 | Gate nello **stesso validatore** di #135 e #136, non uno script nuovo | stessa lezione di D.43.2 e D.44.2: `validate-workflows.mjs` è già cablato come step bloccante in `ci.yml` |
| D.45.3 | Il gate verifica anche **l'ordine** (sync prima del push) | un sync dichiarato dopo il push è sintatticamente presente e praticamente useless: è la variante «sembra a posto» della stessa classe di bug |
| D.45.4 | Il gate tassa **solo** `git push origin main`, non i push su branch | `auto-branch-cleanup` e i branch di PR non sono writer di `main`; tassarli produrrebbe falsi positivi su workflow legittimi |
| D.45.5 | Il doc-sync della 1.2 viaggia in **questa** PR, non in una separata | la finestra di worktree + claim è aperta: due PR per la stessa sessione aggiungerebbero una race di stato per nessun vantaggio |

## Difetti trovati lungo il percorso

**La issue #140 è stata scritta come se il difetto fosse di `main`.** La prima
formulazione era «`main` non aggiorna i blocchi aggregati». Il difetto è dei
workflow: `main` è solo il posto dove la divergenza si manifesta.

**La PR #139 aveva scritto il doc-sync solo nella working copy locale.** Il
branch mergato non conteneva `docs/state/stories/1.2-*.md` aggiornato, quindi
l'aggregator — anche se funzionante — non avrebbe avuto nulla da aggregare: la
sorgente era rimasta `todo`. Il PR è stato chiuso come `status:done` senza che il
file sorgente lo dicesse. È la stessa lezione di #90 (D.38.1) vista dal lato
opposto: **lo stato vive nella sorgente, e la sorgente va nella PR**.

**Un test che verifica la mutazione con un `grep` troppo largo fallisce da solo.**
T2 verificava l'avvenuta rimozione dello step cercando la stringa
`Sync con origin/main`, che compare anche nei commenti dell'header del workflow:
la mutazione era applicata, l'asserzione no. Il gate aveva comunque exit 1 (il
comportamento cercato), quindi il bug era dell'asserzione e non del gate —
l'ordine dei due comandi nel test (prima la mutazione, poi il gate) ha reso la
distinzione evidente.

## Verifica

- `node scripts/validate-workflows.mjs .github/workflows` → exit 0, **2 writer di main verificati**
- `bash scripts/test-workflow-push-sync.sh` → **15/15** (T1 reale, T2 rimozione dello step → exit 1 con file:riga, T3 forma `git pull --rebase` → exit 0, T4 push su branch → non tassato, T5 sync dopo il push → exit 1)
- `bash scripts/test-aggregate-determinism.sh` → invariato (`aggregate-state.ps1` non toccato)
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 su tutti i blocchi
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0

**Test non eseguiti, e perché**: `pnpm run lint` / `typecheck` / `test` / `build`
non sono stati eseguiti in worktree perché **nessun file applicativo è stato
toccato** (nessuna modifica in `apps/` o `packages/`); i gate li eseguirà `ci.yml`.

## Lesson learned

| # | Osservazione |
|---|--------------|
| 45-1 | **Un concurrency group serializza i run, non i checkout.** Due workflow che scrivono sullo stesso ref hanno bisogno di due cose diverse: il group (chi pusha per primo) e il sync (su quale commit si pusha). La prima senza la seconda produce `non-fast-forward` con la stessa firma di un conflitto di merge reale |
| 45-2 | **`git push` rifiutato ≠ merge fallito.** Il commit del merge è a posto, il log del workflow è rosso, e nulla nei gate di `ci.yml` segnala che i blocchi aggregati sono indietro: la divergenza cresce in silenzio finché non la legge un umano |
| 45-3 | **Lo stato di una story vive nella sorgente, e la sorgente viaggia nella PR.** PR #139 è stata chiusa `status:done` senza che `docs/state/stories/1.2-*.md` lo dicesse: l'aggregator è fedele a ciò che legge, e non può aggregare un fatto che nessun file dichiara |
| 45-4 | **Un gate che verifica la presenza di un pattern deve verificarne anche la posizione.** Lo step di sync presente *dopo* il push è la variante «sembra a posto» del bug: stesso testo, comportamento opposto |
| 45-5 | Nei test di fixture, **l'asserzione sulla mutazione va ancorata alla struttura** (`- name:`), non al testo: un commento che cita il nome dello step rende un `grep` grezzo falso-negativo sul test, non sul gate |

## Documenti aggiornati

- `.github/workflows/auto-state-aggregate.yml` — step «Sync con origin/main» + nota di-header sulla differenza fra run e checkout
- `.github/workflows/ci.yml` — step bloccante `Sync origin/main prima del push su main (issue #140)`
- `scripts/validate-workflows.mjs` — gate `checkPushSync` + riepilogo con i writer di `main`
- `scripts/test-workflow-push-sync.sh` (**nuovo**) — T1..T5, 15 assert
- `scripts/generate-bundle.ps1` — `$files` += il nuovo test
- `docs/state/stories/1.2-adapter-apple-music.md` — doc-sync post-merge della Story 1.2 (PR #139, `2e1a4cc`)
- `docs/state/sessions/45-auto-state-aggregate-push-sync.md` (**nuovo**) — questa entry
- `docs/11-BACKLOG.md` — la 1.2 rimossa dalla tabella roadmap, `**Stato**:` della sezione Story 1.2
- `docs/INDEX.md` — §"Prossimo step tecnico" allineato alla Sessione 45
- `docs/12-DEVOPS.md` — §9.8d (nuova) + changelog 0.6
- `AGENTS.md` — v1.23 → v1.24: il quarto controllo del validatore elencato per nome
- `docs/BUNDLE.md` — rigenerato

## Note operative

- Nessun blocco `<!-- AGGREGATE-* -->` modificato a mano: `docs/SESSIONS.md`,
  `docs/INDEX.md`, `docs/11-BACKLOG.md`, `docs/BUNDLE.md` e `README.md` sono
  **output** di `aggregate-state.ps1` e `generate-bundle.ps1`, eseguiti in locale
  per lasciare i due gate `-Check` verdi nella stessa PR (D.21.1).
- La working copy principale di `main` era **sporca** con il doc-sync della 1.2
  (6 file modificati, mai committati). Il contenuto è stato trasferito nella
  worktree di questa PR **prima** di riportare la working copy a `HEAD`: nessun
  `stash`, nessun reset distruttivo (D.26.4).
- `apps/web/public/version.json` era modificato per un build locale: artefatto,
  escluso dal commit e riportato a `HEAD`.

## Cross-refs

- **#140** — il bug; chiuso da PR #141
- **#139 / #132** — PR e issue della Story 1.2, il doc-sync rimasto fuori da `main`
- **#136** — Sessione 43, il gate di copertura `git add` vs `$targets`: stesso file, stessa lezione sul gate che deve poter fallire
- **#135** — Sessione 44, il gate sulle scope di `permissions:`: precedente immediatamente precedente dello stesso validatore
- **#115** — Sessione 41, `auto-bundle.yml`: il workflow companion che ha il sync e sopravvive
- **#105** — la procedura di allocazione del numero di sessione seguita per scegliere `N = 45`