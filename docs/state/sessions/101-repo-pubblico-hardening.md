---
number: 101
title: "Rendere il repository pubblico: hardening sicurezza e privacy"
date: 2026-11-05
state: 🟢
merged: true
merged_commit: "d07a26482dbeda9039e7b1b7f419ffefa2a0885d"
merged_date: "2026-11-05T11:55:31Z"
pr: 310
branch: feat/309-rendere-il-repository-pubblico-hardening
claim: kilo-amedeovecchiemilcoms-309
tags: [devops, privacy, security, ci, repository]
---

## Sintesi

Il project owner ha deciso di rendere **pubblico** il repository. La ragione
non è solo economica: su un repository **privato** con piano Free la branch
protection e i rulesets **non sono disponibili** (`branches/main/protection`
risponde 403: *"Upgrade to GitHub Pro or make this repository public to enable
this feature"*). Quindi i 16 job della CI, per quanto ben costruiti, **non
bloccavano alcuna merge**: erano un report, non un gate. Su un repository
pubblico con piano Free la branch protection è inclusa e il protocollo
dichiarato in `AGENTS.md` diventa finalmente **enforceable**.

Prima del flip questa sessione ha eseguito un audit **read-only** dell'intero
repository (689 commit, tutti i file tracciati, tutti i file mai cancellati
nella history) e chiuso i buchi che il flip avrebbe esposto.

### Audit: esito

| Classe | Esito |
|--------|-------|
| Segreti / credential | **nessuno** — in 689 commit, in tutti i file tracciati, in tutti i file cancellati (`IDEA.md`, `.husky/commit-msg`, `.husky/pre-commit` ispezionati) |
| PII reale | **nessuna** — solo `test@example.com`, `dp3@last.fm` (email di supporto **pubblica** di Last.fm), ID di run, nomi di pacchetti npm |
| Fixture | 100% sintetici, generati da `scripts/generate-fixtures.mjs` |
| Encoding | 0 errori al gate `check-encoding.mjs` (11 file in allowlist, esempi documentati) |
| Licenze | nessuna incompatibilità con AGPL-3.0 |
| Link AGPL §13 | l'app dichiara già `github.com/amedeo82/Life-Soundtrack` (`apps/web/src/components/About.tsx:74`) — da privato il link non era fruibile: **il flip chiude un gap di conformità**, non lo crea |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-101.1 | L'email personale (`AMEDEO.VECCHI82@GMAIL.COM`, in 252 commit) **si accetta**, con `.mailmap` | decisione del project owner (2026-11-05). Il rewrite della history cambierebbe **tutti** gli SHA: i 38 riferimenti `merged_commit` in `docs/state/` punterebbero a commit inesistenti e il gate fail-closed `check-merge-state.mjs` (che li confronta con lo stato reale delle PR letto dall'API) renderebbe `main` rosso. Richiederebbe inoltre un force-push su `main`, vietato dal protocollo. L'identità è già pubblica nel profilo e nel contenuto del repo: non è un segreto, è il contatto del progetto open-source |
| D-101.2 | La regola «mai committare dati reali di ascolto» scende a L3 con un gate | `09-PRIVACY-SECURITY.md` §10.1 era **solo prosa**: nessun gate la verificava. Con il repo pubblico ogni file tracciato è scaricabile da chiunque, quindi la finestra per committare per errore un export reale non è più chiusa dal perimetro del repo privato. Contra il principio ADR-0012: *una regola senza gate è un consiglio* |
| D-101.3 | Il gate dei fixture è **bloccante** e **fail-closed** | un gate che dichiarasse «pulito» senza aver guardato sarebbe peggio di nessun gate: exit 2 su errore di ambiente, mai 0. E ha il suo scenario negativo (`test-fixtures-privacy-gate.mjs`, 6 scenari): *un gate che passa sempre non è un gate* (lesson 43-1) |
| D-101.4 | Gli IP routable reali nei fixture sono sostituiti con range RFC 5737 | `92.40.100.50`, `85.20.40.10`, `78.195.10.20` sono IP **assegnati a ISP reali**: potrebbero identificare una persona. I range documentazione (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) sono gli unici ammessi. La semantica dei test è invariata: l'IP resta pubblico e non-documentato |
| D-101.5 | I workflow che scrivono su `main` o sulle issue **saltano le PR da fork** | con il repo pubblico chiunque può aprire una PR da un fork. `post-merge.yml` (`contents: write`) scriverebbe su `main` usando l'`head.ref` di un branch esterno; `auto-status-done.yml` (`issues: write`) transizionerebbe issue **arbitrarie** perché il body di una PR è input non fidabile quando la PR viene da fuori. Stesso guard di `auto-branch-cleanup.yml`: `head.repo.full_name == base.repo.full_name` |
| D-101.6 | `pull_request`, **non** `pull_request_target` | `pull_request_target` gira con i permessi del branch BASE ma con il codice del fork: è la classica *pwn request*. `pull_request` gira con i permessi del fork, read-only: nessuna escalation. La scelta è deliberata, non un caso |
| D-101.7 | Il NOTICE dichiara la **realtà** su essentia.js | dichiarava un bundle che nel repository non è presente (non è in `package.json`, nel lockfile né in `node_modules`). In un repository pubblico un NOTICE falso è un problema di conformità, non un dettaglio di stile. Ora lo stato è `NOT yet distributed`, come l'entry DB-IP che era già onesta |
| D-101.8 | `.gitignore` chiude `.env*`, chiavi e certificati | con il repo pubblico un `.env` committato per errore è un segreto pubblico. Il perimetro non deve dipendere dalla memoria di chi committa |
| D-101.9 | Il ridisegno della CI a 3 corsie **non** è in scope | con il repo pubblico i minuti Actions sono **illimitati e gratuiti**: il vincolo economico che lo rendeva urgente è scomparso. Resta un'ottimizzazione di wall-clock, non un blocco. La struttura a 16 job resta **invariata**: nessun workflow è stato rimosso, nessun gate è stato perso |

## Cosa cambia per il protocollo

Nessuna regola è stata rimossa e nessun gate è stato perso. Sono state **aggiunte**
tre cose:

1. `check-fixtures-privacy.mjs` + il suo scenario negativo — nuovi, bloccanti
2. i guard di fork in `post-merge.yml` e `auto-status-done.yml`
3. `.mailmap`, `.gitignore` e la correzione del NOTICE

La parità locale ↔ CI (issue #306) è mantenuta: i due nuovi gate girano sia nel
job `gates-docs` della CI sia nella batteria locale di `scripts/agent-pr.ps1`.

## Analisi di avanzamento

| # | Metrica | Valore |
|---|---------|--------|
| 1 | Segreti trovati in 689 commit | **0** |
| 2 | File con PII reale | **0** |
| 3 | IP routable reali nei fixture | **11 occorrenze** → **0** (range RFC 5737) |
| 4 | Gate nuovi | **2** (bloccanti, fail-closed, con scenario negativo) |
| 5 | Workflow protetti da guard di fork | **2** su 3 (il terzo, `auto-branch-cleanup.yml`, era già protetto) |
| 6 | Job CI | **15** (invariati — i 2 step nuovi sono dentro `gates-docs`) |
| 7 | Step CI | 38 → **40** |
| 8 | Righe del catalogo §9.10 | 39 → **41** |

**Pronto per il merge**: i gate locali sono verdi e il bundle è rigenerato nella
stessa PR.

**Dopo il merge, e solo dopo**, il project owner può rendere pubblico il
repository. L'ordine è vincolante: la branch protection si abilita **dopo** il
flip (su privato Free non è disponibile), e il `README`/`About` dell'app deve
gia' puntare al repository pubblico — cosa che già fa.
