---
number: 102
title: "Branch protection attiva: il writer post-merge deve spingere con una deploy key (SSH), non con GITHUB_TOKEN"
date: 2026-11-05
state: 🟡
merged: false
pr: 0
branch: feat/311-branch-protection-attiva-il-writer-post
claim: kilo-hp-elitebook-2097
tags: [devops, security, ci, branch-protection]
---

## Sintesi

Con il repository ormai **pubblico** (Sessione 101), la protezione di `main` è
diventata disponibile ed è stata applicata. Il passaggio non è stato una
formalità: la checklist di pubblicazione (`docs/CHECKLIST-PUBBLICAZIONE.md`,
Passo 2) conteneva **tre presupposti che sul repository reale non valevano**,
e applicarli alla lettera avrebbe prodotto una protezione *finta* (o un
repository congelato).

La correzione è una **ruleset** GitHub (`main-protection`), non la classic
branch protection, e l'unico atore che può spingere direttamente su `main`
è il workflow `post-merge` — via una **deploy key SSH**, perché il
`GITHUB_TOKEN` non può bypassare una ruleset.

## I tre presupposti falsi della checklist originale

| # | Presuposto | Realtà misurata | Conseguenza se applicato alla lettera |
|---|-----------|-----------------|----------------------------------------|
| 1 | `POST /branches/main/protection` è il modo per proteggere `main` | il token OAuth della CLI (`gho_`, scope `repo`) riceve **404**: l'endpoint classic chiede il permesso *Administration*, che un token OAuth non ottiene | nessuna protezione, nessun errore visibile (il 404 sembra un path sbagliato) |
| 2 | il check richiesto è `CI / quality` | il **nome del check run** del job aggregatore è `quality` (`GET /commits/<sha>/check-runs`); `CI / quality` è la coppia *workflow / job* mostrata nella UI | regola **soddisfacibile da nessuna run**: ogni merge resterebbe bloccato per sempre, repository congelato |
| 3 | `required_approving_review_count: 1` | l'unico account GitHub (`amedeo82`) è **anche l'autore di ogni PR** (gli agenti usano l'account del project owner) e GitHub vieta l'auto-approvazione | nessuna PR potrebbe mai essere mergiata: repository congelato |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-102.1 | La protezione è una **ruleset** (`main-protection`, id `26614787`), non la classic branch protection | l'endpoint classic non è amministrabile con il token a disposizione; la ruleset è creabile con lo stesso token e applica le stesse garanzie a `refs/heads/main` |
| D-102.2 | Il check richiesto è il contesto **`quality`** (nome del check run), `strict: true`, `integration_id: 15368` | il contesto richiesto è il nome del check run, non la coppia `CI / quality` della UI. `strict` obbliga ad aggiornare il branch con `main` prima del merge |
| D-102.3 | `required_approving_review_count: 0` | con `1` il repository sarebbe congelato (auto-approvazione vietata). Restano enforced: **PR + check `quality` verde + branch aggiornato** |
| D-102.4 | **Nessun bypass per gli admin**: l'owner è vincolato come tutti | un bypass per l'admin renderebbe la protezione una formalità per chiunque abbia il ruolo, cioè per l'unico account del repository |
| D-102.5 | L'unico bypass actor è la **deploy key `post-merge-writer`** (id `168877742`, write) | il `GITHUB_TOKEN` / `github-actions[bot]` non può bypassare una ruleset (422: *"Actor GitHub Actions integration must be part of the ruleset source or owner organization"*). Il writer post-merge è per definizione l'unico scrittore di `main` (ADR-0013): la deploy key è il suo strumento di autenticazione |
| D-102.6 | `required_linear_history` attivo → i merge devono essere **squash** | i merge commit non servono e confondono la ricostruzione della history. È un cambio operativo che va dichiarato nel protocollo |
| D-102.7 | La verifica è stata fatta su un **branch sonda** (`protection-probe`), non sulla documentazione | la prova ha simulato i due attori: push diretto come owner/admin → **respinto** (GH013: *"Changes must be made through a pull request"* + *"Required status check \"quality\" is expected"*); push diretto come deploy key → **accettato** (*"Bypassed rule violations"*). Il branch sonda e la sua ruleset sono stati rimossi |

## Cosa cambia nel protocollo

1. `.github/workflows/post-merge.yml` autentica il **checkout** con
   `secrets.WRITER_SSH_KEY` + `secrets.WRITER_SSH_KNOWN_HOSTS` invece che con
   `secrets.GITHUB_TOKEN`. Le chiamate API continuano a usare il `GITHUB_TOKEN`
   (serve `pull-requests: read`): è solo il **push** che passa dalla chiave.
2. `AGENTS.md` v1.48: la regola «`main` è protetta» scende da L2 (prosa) a
   **L3 (applicata)**, con la ruleset come gate e la deploy key come unico
   bypass. Aggiornati i punti che dichiaravano «PAT autorizzato dal PAT».
3. `docs/CHECKLIST-PUBBLICAZIONE.md`: il Passo 2 dichiara **cosa è stato
   applicato davvero**; il testo originale è conservato ma marcato come
   superato e non eseguibile. La verifica finale e il rollback usano
   l'API delle ruleset, non l'endpoint classic.
4. I merge da ora sono **squash** (linear history).

## Analisi di avanzamento

| # | Metrica | Valore |
|---|---------|--------|
| 1 | Endpoint classic `POST /branches/main/protection` | **404** (token OAuth, permesso *Administration* mancante) |
| 2 | Ruleset applicata | **1** (`main-protection`, id `26614787`, `refs/heads/main`) |
| 3 | Check run aggregatore | `quality` (non `CI / quality`) |
| 4 | Approvazioni richieste | **0** (con 1 il repository sarebbe congelato) |
| 5 | Deploy key di scrittura | **1** (`post-merge-writer`, id `168877742`) |
| 6 | Secret impostati | **2** (`WRITER_SSH_KEY`, `WRITER_SSH_KNOWN_HOSTS`) |
| 7 | Push di prova | 1 **respinto** (GH013, owner/admin), 1 **accettato** (deploy key) |
| 8 | Versione protocollo | v1.47 → **v1.48** |

**Pronto**: la protezione è attiva e verificata, e il writer post-merge ha
l'attestazione necessaria per spingere.

**Dopo il merge**: il workflow `post-merge` deve produrre il commit di doc-sync
su `main` **senza** GH013 — è la prova end-to-end che la deploy key è usata
davvero e che il writer è l'unico scrittore ammesso.

## Lesson learned

- **La documentazione di una procedura operativa va verificata contro
  l'endpoint reale, non copiata.** Tre parametri della checklist (endpoint,
  nome del contesto, numero di approvazioni) erano tutti sbagliati e
  nessuno dei tre avrebbe prodotto un errore evidente: il 404 sembra un
  path sbagliato, un contesto sbagliato blocca silenziosamente ogni merge,
  un'approvazione richiesta in più blocca silenziosamente ogni merge. Due
  dei tre errori hanno la **stessa** classe di difetto: una restrizione che
  non può mai essere soddisfatta.
- **Il nome del check run non è il nome mostrato nella UI.** `CI / quality` è
  la coppia *workflow / job*; il check run si chiama `quality`. La regola
  confronta il **check run**, quindi il contesto richiesto va letto da
  `GET /commits/<sha>/check-runs`, non copiato dalla UI.
- **Un bypass per gli admin annulla la protezione per l'unico account del
  repository.** Se l'unico utente è anche l'amministratore e l'autore delle
  PR, il vincolo deve valere anche per lui: altrimenti "protezione attiva"
  significa "chiunque può schierare l'eccezione".
- **Le regole si verificano con un esperimento, non con un ragionamento.**
  Il branch sonda ha risolto in un'ora ciò che la lettura della documentazione
  non poteva stabilire, e ha prodotto la prova (GH013 + bypass) che oggi
  documenta il Passo 2.
