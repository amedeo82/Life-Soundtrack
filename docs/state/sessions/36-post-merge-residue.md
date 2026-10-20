---
number: 36
title: "Residui post-merge: rilevare i branch locali orfani + fetch prima di creare la worktree (issue #76)"
date: 2026-10-20
state: 🟡
branch: fix/76-post-merge-residue
pr: 0
claim: kilo-HP-ELITEBOOK-post-merge-review
cross_refs: [69, 73, 75, 76]
tags: [docs, devops, post-merge, worktree, housekeeping]
---

# Sessione 36 — Residui post-merge e base stale

## Sintesi

Due buchi di housekeeping trovati durante la pulizia post-sessione. Il primo è un buco **nel mio stesso script**: `post-merge.ps1 -Check` non guardava i branch locali, quindi due orfani sopravvissuti non erano mai stati segnalati. Il secondo è più sottile e più pericoloso: **`setup-worktree.ps1` non faceva mai fetch**, quindi un agente poteva costruire una worktree su una base stale senza accorgersene.

## Trigger

Il project owner, dopo la chiusura di #66: *"apri la issue e correggi, poi controlla anche che post merge della PR l'agente che esegue le verifiche esegua anche il download del main aggiornato in locale in modo da tenere aggiornato il branch locale ed allineato al branch remoto main se necessario, tu che dici? potrebbe essere utile oppure gli agenti prelevano da remoto per creare il worktree?"*

## La domanda del project owner: risposta

La proposta ("il post-merge allinei `main` con `origin/main`") **è già implementata**: `post-merge.ps1` esegue al passo 2 `git fetch origin --prune` e al passo 3 `git checkout main` + `git merge --ff-only origin/main`. L'audit finale di ogni sessione lo conferma con `main locale allineato a origin/main`.

Il limite è che lo script **rifiuta di eseguire da dentro una worktree** (exit 15): se la working copy principale è occupata da un altro agente su un branch di feature, l'allineamento non avviene ed è corretto che non avvenga — forzarlo produrrebbe conflitti con l'altro agente.

Quindi **no**: gli agenti non prelevano da remoto quando creano la worktree. `setup-worktree.ps1` usa `-BaseBranch origin/main`, cioè un **remote-tracking ref locale**, e lo valida con `git rev-parse --verify` senza mai fare fetch:

- ref **esistente ma stale** → worktree su base vecchia, **nessun avviso** (caso pericoloso, silenzioso)
- ref **inesistente** → errore con istruzione manuale "Fetch + retry"

Il `AGENTS.md` §"Session start checklist" ha `git fetch origin` come check #3, ma è un controllo umano: se l'agente lo salta, niente lo ferma. Il buco quindi va chiuso **dove la base stale può entrare**, cioè nella creazione della worktree — non forzando l'allineamento di `main` in un caso in cui è legittimamente impossibile.

## I 2 fix

### 1. `post-merge.ps1 -Check`: branch locali orfani

Un branch locale è orfano se soddisfa **tutti** questi criteri:

| # | Criterio | Perché |
|---|----------|--------|
| 1 | pattern `feat/*`, `fix/*`, `docs/*` | il workflow agenti |
| 2 | non è il branch base | `main` non è un orfano |
| 3 | **non** è checked-out in nessuna worktree | altrimenti è lavoro attivo di un agente |
| 4 | **0 commit unici** rispetto a `origin/main` | garanzia assoluta: tutto il contenuto è già merged |

Il criterio 4 è la garanzia di sicurezza: un branch con anche **un solo** commit non presente in `main` non viene mai segnalato. Il `-Check` resta read-only e stampa il comando `git branch -d <branch>` senza eseguirlo.

### 2. `setup-worktree.ps1`: fetch prima di validare la base

- `git fetch $Remote --prune` prima di validare `-BaseBranch`
- `-SkipFetch` per i test e gli ambienti offline
- fetch fallito → **avviso, non errore**: è più grave di oggi, non meno
- se il fetch è saltato o fallito e la base punta al remote → avviso esplicito "la base PUO' essere stale"
- aggiunta la funzione `Write-Warn`, che **mancava** dallo script

## Decisioni (D.36.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.36.1 | Orfano = 0 commit unici **E** non checked-out | il criterio sui commit unici è la garanzia anti-perdita: è preferibile un falso *negativo* (orfano non segnalato) a un falso *positivo* (lavoro perso) |
| D.36.2 | `-Check` resta read-only, stampa il comando senza eseguirlo | l'audit informa, la decisione resta dell'agente |
| D.36.3 | Fetch in `setup-worktree`, non allineamento forzato di `main` | `main` locale non è sempre allineabile (working copy occupata); la base della worktree invece dipende **solo** dal ref remoto |
| D.36.4 | Fetch fallito = warning, non exit | non deve rendere lo script più fragile di prima |
| D.36.5 | Aggiunto `-SkipFetch` | i test non devono dipendere dalla rete |
| D.36.6 | Nessuna modifica a `test-setup-worktree.sh` | provato il fallback a Windows PowerShell: espone bug **preesistenti** dell'harness (mock `gh` + PATH, tmpdir rimosso da S1 e riusato da S2). Portabilità fuori scope: si è preferito non lasciare la suite rotta |

## Modifiche

1. `scripts/post-merge.ps1` — sezione (d) in `-Check`: rilevamento branch locali orfani
2. `scripts/setup-worktree.ps1` — `git fetch` prima della validazione base + `-SkipFetch` + funzione `Write-Warn`
3. `scripts/test-issue-76-residue.sh` (nuovo, 9 assert) — T1 orfano rilevato, **T2 lavoro non pushato MAI segnalato**, T3 branch in uso non è orfano, T4 `-SkipFetch` avvisa, T5 fetch eseguito
4. `.github/workflows/ci.yml` — step bloccante "Residui post-merge (issue #76)"
5. `scripts/generate-bundle.ps1` — `$files` += `scripts/test-issue-76-residue.sh`

## Verifica

```bash
bash scripts/test-issue-76-residue.sh   → 9/9 PASS
```

Casi di sicurezza verificati esplicitamente, perché sono quelli che costano:

| Scenario | Risultato atteso | Ottenuto |
|---|---|---|
| branch con 0 commit unici, non checked-out | segnalato come orfano | ✅ |
| branch con **1 commit non pushato** | **mai** segnalato | ✅ |
| branch vuoto ma checked-out in worktree | non orfano, etichettato "in uso" | ✅ |
| `-Check` | read-only, nessuna modifica | ✅ |

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 36-1 | `post-merge.ps1 -Check` guardava solo i branch **remoti**: due orfani locali sopravvissuti indisturbati | ✅ aggiunto il controllo sui locali |
| 36-2 | `setup-worktree.ps1` usa `origin/main` **senza fetch**: base stale silenziosa | ✅ fetch prima della validazione + avviso se saltato |
| 36-3 | `Write-Warn` non esisteva in `setup-worktree.ps1` (solo `Write-Step`/`Write-Err`) → errore a runtime | ✅ aggiunta; trovata **solo eseguendo** il test |
| 36-4 | `$LASTEXITCODE` usato dopo comandi intermedi non è affidabile | ✅ variabile `$fetchOk` esplicita |
| 36-5 | Un test "negativo" mal costruito dà una falsa accusa | ✅ verificato due volte prima di riportare un bug: il primo test aveva un commit mai creato |
| 36-6 | Un branch di test con lo stesso nome di uno esistente fa fallire `checkout -b` in silenzione, e il commit finisce su HEAD **detached** e viene perso al checkout successivo | ✅ usati nomi univoci e verificato `git rev-list --count` prima di trarre conclusioni |
| 36-7 | Il fallback a Windows PowerShell in `test-setup-worktree.sh` scopre bug preesistenti dell'harness | ✅ revert: preferito non lasciare la suite rotta per uno scope secondario |

## Note reviewer

- Due bug **miai** commessi durante il lavoro e intercettati prima del commit: il commit di test finito su `main` (riparato con `reset --soft`, mai `--hard`, per non distruggere le modifiche non committate — E3/E4/E5), e la funzione `Write-Warn` mancante.
- Nessun file JS/TS applicativo toccato: `lint`/`typecheck`/`test`/`build` invariati.
- `main` locale verificato allineato a `origin/main` prima e dopo i test.

## Cross-refs

- **#76** — issue di questo lavoro (chiusa dalla PR)
- **#69** — procedura canonica post-merge: nasce lì `post-merge.ps1`, di cui questo lavoro chiude il buco sui branch locali
- **#73** — automazioni post-merge: il `-Check` è il completamento di `stale-claim-sweeper` e `auto-branch-cleanup`, che coprono solo i branch **remoti**
- **#75** — test flaky `spotify-adapter`, aperto nella sessione precedente