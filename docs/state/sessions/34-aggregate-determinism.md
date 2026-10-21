---
number: 34
title: "Determinismo e idempotenza dell'aggregator (issue #70): 5 cause + gate bloccante"
date: 2026-10-20
state: 🟢
merged: true
merged_commit: dbd8a1b
merged_date: 2026-10-20T12:14:25+02:00
branch: fix/69-aggregate-determinism
pr: 72
claim: kilo-HP-ELITEBOOK-post-merge-review
cross_refs: [63, 66, 68, 69, 70]
tags: [docs, devops, determinism, bugfix, ci]
---

# Sessione 34 — Determinismo e idempotenza dell'aggregator

## Sintesi

Durante la verifica post-merge della PR #69 (Sessione 33) è emerso che `aggregate-state.ps1 --check` **falliva su `main`**, nonostante CI fosse verde. L'indagine ha trovato **cinque cause** in una sola PR, delle quali due bloccavano il workflow parallelo e una rendeva impossibile notare il drift.

Il risultato è un aggregator con tre garanzie esplicite (ordinamento per valore, idempotenza byte-identica, degradazione invece di crash), ciascuna coperta da un test, e un **gate bloccante in CI** che prima non esisteva.

## Trigger

Il project owner, dopo il merge della PR #69: *"risolvi il bug in modo da evitare questi problemi e rendere il flusso di lavoro degli agenti di coding eseguibile in parallelo senza errori e problemi di merge, senza dimenticare di eseguire azioni. controlla anche le azioni automatiche che avvengono dopo il mio merge della pr, controlla se è possibile automatizzare altro per evitare errori, controlla gli step post merge della pr e gli step di risoluzione della issue"*.

## Le 5 cause

| # | Causa | Impatto |
|---|-------|---------|
| 1 | `Sort-Object { [version]$Id }` invece di `$_.Id` (riga 142). PowerShell è case-insensitive: `$Id` risolveva la variabile `$id` della `ForEach-Object` precedente, non la proprietà. Chiavi di sort tutte uguali → ordine dipendente dal filesystem | `0.3,0.5,0.6` su Linux vs `0.6,0.5,0.3` su Windows: **due agenti su piattaforme diverse producono drift opposti → conflitti sui file globali** |
| 2 | `- Ultima aggregazione: <ora>` riscritto a ogni run | `Apply-Blocks` produceva sempre un diff → `auto-state-aggregate` committava a vuoto (`8c63ed9`) |
| 3 | Fallback del campo `state` = byte corrotti `C3 A2 C2 AC C5 A1` (doppia codifica di 🟡) | scriveva caratteri sporchi in `SESSIONS.md` per ogni state file senza `state:` |
| 4 | `Test-Blocks` lenient match ≥90% dichiarava `[OK]` | il drift di riordino (12/13 = 92.31%) passava come verde: **era il motivo per cui la causa #1 non era mai stata notata** |
| 5 | `Parse-Frontmatter` → `$null` su file malformati, dereferenziato senza guard in tutti i `Build-Block-*` | **un singolo file `state/` corrotto crashava l'intera aggregazione**, bloccando anche il workflow post-merge |

## Decisioni (D.34.x)

| # | Decisione | Motivazione |
|---|---|---|
| D.34.1 | Ordinamento per valore con tie-break esplicito su `Base` | Il filesystem non garantisce ordine; il tie-break rende il sort totale anche a parità di numero/versione |
| D.34.2 | `Sync-AggregationTimestamp`: riusa il timestamp esistente se il resto del blocco è identico | Rende la scrittura un vero no-op. Alternativa scartata: timestamp derivato dal commit, perché in locale con modifiche non committate sarebbe ambiguo |
| D.34.3 | `Get-Frontmatter`: degrada a default con `[WARN]` invece di crashare | Un file malformato non deve fermare l'aggregazione di tutti gli altri; l'errore resta visibile |
| D.34.4 | Lenient match da `[OK]` → `[WARN]`, con `--strict` opt-in | Rende il drift visibile senza cambiare il comportamento di CI (che dipende ancora da #63/#66). `--strict` dà il gate severo a chi lo vuole |
| D.34.5 | Gate bloccante in CI = test di determinismo, **non** `--check` | Il test confronta l'output *dentro la stessa piattaforma*, quindi è deterministico e può fallire in modo utile; `--check` confronta output prodotto su piattaforme diverse e resta warning finché #63 non è risolto |
| D.34.6 | Non toccato `auto-state-aggregate.yml` oltre al commento sul commit vuoto | Il push su `main` del bot è un'azione separata, trattata in Sessione 35 (automazioni post-merge) |

## Modifiche

1. **`scripts/aggregate-state.ps1`**
   - `Sort-Object { [version]$_.Id }, Base` e `Sort-Object Number, Base`
   - `Get-Frontmatter` (null-safe) usato da tutti i `Build-Block-*`
   - `Sync-AggregationTimestamp` + chiamata in `Apply-Blocks`
   - fallback `"?"` al posto dei byte mojibake
   - lenient match → `[WARN]`, più flag `--strict`
   - help aggiornato (`.NOTES` su idempotenza e determinismo)
2. **`scripts/test-aggregate-determinism.sh`** (nuovo, 9 assert su repo temporanei): T1/T2 ordinamento per valore e indipendenza dall'ordine di creazione, T3 idempotenza byte-identica, T4 round-trip `--check`, T5 fallback ASCII, T6 ordinamento sessioni. Fail-fast sul setup per evitare falsi positivi su fixture vuote
3. **`.github/workflows/ci.yml`**: step bloccante "Aggregator deterministico (issue #70)"; commenti dei gate warning aggiornati con la root cause e i riferimenti a #63/#66
4. **`AGENTS.md`** v1.10 → v1.11: sottosezione "Determinismo e idempotenza" con tabella garanzie→test, item bloccante nelle 2 checklist PR, `--strict` documentato, header e footer
5. **`scripts/generate-bundle.ps1`**: `$files` += `scripts/test-aggregate-determinism.sh` (52 file)
6. **`docs/BUNDLE.md`**, `docs/SESSIONS.md`, `docs/INDEX.md`: rigenerati

## Verifica

```bash
bash scripts/test-aggregate-determinism.sh   → 9/9 PASS
bash scripts/test-post-merge.sh             → 29/29 PASS (nessuna regressione)
pwsh scripts/aggregate-state.ps1 --check    → exit 0 (prima: exit 1 su main)
pwsh scripts/generate-bundle.ps1 --check    → exit 0 (52 file)
```

Idempotenza verificata sul repo reale: due run consecutivi producono `git diff` vuoto.

## Lesson learned

| # | Sintomo | Stato |
|---|---------|-------|
| 34-1 | `Sort-Object { [version]$Id }`: in PowerShell `$Id` dentro uno scriptblock non è la proprietà dell'oggetto | ✅ corretto in `$_.Id`. **Regola**: in `Sort-Object`/`Where-Object` usare sempre `$_.Prop` |
| 34-2 | Un check "lenient" che dichiara `[OK]` è peggio di nessun check: nasconde il drift | ✅ ora `[WARN]` + `--strict`. **Regola**: la tolleranza deve essere visibile |
| 34-3 | Il CI verde non dimostra l'assenza di drift: i gate erano `\|\| echo "::warning::"` | ✅ aggiunto un gate bloccante che *può* fallire (determinismo intra-piattaforma) |
| 34-4 | Un valore "di default" con caratteri non-ASCII è una bomba a orologeria | ✅ fallback ASCII; da preferire `"?"` a un emoji per i default |
| 34-5 | Dereferenziare il risultato di un parser senza guard trasforma 1 file rotto in un outage di pipeline | ✅ `Get-Frontmatter` con degradazione + `[WARN]` |
| 34-6 | Un test con fixture che falliscono silenziosamente dà falsi positivi | ✅ fail-fast nel setup della suite (conta i file creati) |
| 34-7 | `scripts/aggregate-state.ps1` è in `$files` di `generate-bundle`: ogni modifica al suo contenuto cambia `Dimensione totale` e quindi il blocco BUNDLE | ✅ comportamento corretto (il guard timestamp lo distingue dal rumore puro) |

## Note reviewer

- La modifica a `scripts/aggregate-state.ps1` èchirurgica e **sovrappone parzialmente al rewrite Node.js previsto da #66**: il merge deve preservare le tre garanzie in tabella, pena perdita del gate di CI.
- Test eseguibili anche senza `pwsh` (fallback a Windows PowerShell); in CI su ubuntu gira con `pwsh`.
- Nessun file JS/TS toccato → `lint`/`typecheck`/`test`/`build` invariati.
- Worktree isolata: la working copy principale era occupata su `feat/66-aggregate-state-nodejs`.

## Cross-refs

- **#70** — issue di questo lavoro (chiusa dalla PR)
- **#63** — allineamento byte-per-byte PS 5.1 vs 7: resta aperto: motivo dei gate `--check` warning-only
- **#66** — rewrite Node.js dell'agregator: deve preservare il determinismo
- **#69 / #68** — PR e issue della Sessione 33 (procedura post-merge), dove il bug è stato scoperto