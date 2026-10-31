---
number: 74
title: "La CI girava 4 volte per ogni merge: trigger su main filtrato per path e gate sul codice condizionati"
date: 2026-10-31
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: docs/224-ci-merge-once
pr: 0
claim: kilo-HP-ELITEBOOK-perf74
cross_refs: [224, 135, 140, 149, 43]
tags: [devops, ci, performance, coverage]
---

# Sessione 74 — La CI girava 4 volte per ogni merge

## Sintesi

Domanda del project owner: «la CI viene eseguita durante la PR e poi nuovamente durante il merge,
poi dopo il merge viene prodotto il doc sync ed una nuova PR, viene eseguita nuovamente la CI sulla
PR, poi viene fatto il merge della PR del doc sync e viene eseguita nuovamente la CI. Come mai tutte
queste volte gli stessi step? Non basta eseguirli durante la PR soltanto?»

La risposta misurata: **4 run di CI e 3 run `auto-*` per ogni cambiamento logico**, di cui **3 dei 4
run di CI erano ripetizioni** di una validazione già fatta. Questa sessione chiude la ripetizione.

## L'anatomia del ciclo (misurata sull'API GitHub)

PR #222 → #223, 2026-10-31:

| # | Quando | Workflow | Evento | Necessario? |
|---|---|---|---|---|
| 1 | apertura PR #222 | `CI` | `pull_request` | **sì** |
| 2 | merge di #222 | `CI` | `push` su `main` | **no** — stesso albero del run #1 |
| 3 | merge di #222 | `auto-state-aggregate` | `push` su `main` | sì (è il lavoro) |
| 4 | merge di #222 | `auto-bundle` | `push` su `main` | sì (è il lavoro) |
| 5 | dopo l'aggregate | `auto-bundle` | `workflow_run` | **no** se l'aggregate non ha committato |
| 6 | committa dell'aggregate | `CI` | `push` su `main` | **no** — ma è l'unico check sui commit dei writer |
| 7 | apertura PR #223 (doc-sync) | `CI` | `pull_request` | sì, ma su una PR di **sola documentazione** |
| 8 | merge di #223 | `CI` | `push` su `main` | **no** — stesso albero del run #7 |

**Costo**: 4 × 73 s = **292 s** di CI per ogni cambiamento logico, di cui ~219 s di ripetizioni.

## Le due cause, e cosa è stato fatto

### Causa 1 — il trigger `push: branches: [main]` senza filtro

Il workflow scattava su **ogni** push a `main`, rieseguendo l'intera pipeline. Ma l'albero che
arriva su `main` con un merge umano è **lo stesso** che la PR ha già validato (per squash è lo
stesso identico; per merge commit è l'unione di alberi già validati dalle rispettive PR).

**Correzione**: il trigger `push` è ora **filtrato per path** sui 5 file che i **writer automatici**
modificano — `docs/BUNDLE.md`, `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`,
`README.md`. Sono gli **unici** commit che arrivano su `main` senza essere mai passati da una PR, e
quindi gli unici che non sono già validati. Su un merge umano la pipeline non gira più.

Su `push` girano **solo i job leggeri** (`gates-docs` + `gates-workflows`, ~21 s, senza
`pnpm install`): i 3 job `node-*` sono condizionati a `github.event_name == 'pull_request'`.

### Causa 2 — il doc-sync PR girava l'intera pipeline su file solo `.md`

Il doc-sync PR esiste perché il frontmatter della sessione porta `pr:` e `merged_commit:`, noti
**solo dopo** il merge. Tocca **solo file `.md`**: farci girare lint, typecheck, test e build è
lavoro sprecato (~68 s di job + 3 installazioni di dipendenze).

**Correzione**: il job `detect-code` calcola se **almeno un** file cambiato non è un `.md`. Se sono
tutti `.md`, i 3 job `node-*` non installano le dipendenze e non eseguono i task — e **riuscono**
(non sono saltati), così `quality` resta fail-closed senza casi speciali.

Due scelte di progetto importanti:

- **Conservativa**: la regola è «almeno un file **non** `.md` ⇒ i gate girano». Qualsiasi `.ts`,
  `.json`, `.sh`, `.ps1`, `.yml` fa scattare i gate. Il doc-sync, che tocca solo `.md`, li salta.
- **Fail-safe**: se il detector **fallisce**, `has_code` resta vuoto e la condizione dei job è
  `!= 'false'` ⇒ i gate **girano comunque**. Un detector rotto non può mai far saltare la
  validazione.

## Il secondo finding: il validatore dei workflow non validava il YAML

Scritto il gate che intercetta lo scalare semplice invalido, è emerso che
`scripts/validate-workflows.mjs` **non faceva parsing YAML**: lavorava sul testo con regex.

Un file workflow sintatticamente rotto passava il gate, e GitHub lo **rifiutava in fase di
validazione**: run con `jobs: 0`, `conclusion: failure` a 0 secondi, nessun log, nessuna
annotazione via API — **la firma identica** al failure mode dell'issue #135 (22 ore di gate spenti
senza che nessuno se ne accorgesse), indistinguibile da «Actions rotta per billing».

**Correzione**: `checkYamlScalars()` intercetta la forma invalida più comune — uno **scalare
semplice** (non quotato, non block scalar) che contiene `: `, che in contesto block è
l'indicatore di chiave. Il controllo **salta** i block scalar (dove `: ` è testo letterale), i
valori quotati, le raccolte flow e i commenti (`#` preceduto da spazio apre un commento e non fa
parte del valore). Coperto da `scripts/test-workflow-yaml-scalars.sh` (8 assert).

### Bug collaterale: i controlli fallivano in silenzio sui file CRLF

Il validatore divideva il file con `text.split('\n')` **senza normalizzare il fine-riga**. Un file
salvato con **CRLF** (un contributore su Windows) lasciava un `\r` finale su ogni riga, e i pattern
ancorati con `$` — incluso quello del gate sui push su `main` (#140) — **non matchiavano più**: i
controlli fallivano **in silenzio**. In YAML `.` non matcha `\r`, che non è un terminatore di riga
per il regex JavaScript. Ora le righe sono normalizzate una volta sola.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.74.1 | Il trigger `push` su `main` è **filtrato per path** sui 5 file dei writer automatici | Sono gli unici commit che arrivano su `main` senza passare da una PR. Su un merge umano l'albero è già validato |
| D.74.2 | Su `push` girano **solo i job leggeri** | I 3 job `node-*` servono a validare il codice, che su `main` non è cambiato. Costa ~21 s invece di ~73 s |
| D.74.3 | Il doc-sync PR viene riconosciuto da `detect-code` (solo `.md`) ⇒ i gate sul codice non girano | La regola è conservativa (qualunque file non-`.md` fa scattare i gate) e **fail-safe** (detector rotto ⇒ i gate girano) |
| D.74.4 | I 3 job `node-*` **riuscono** (non vengono saltati) quando i gate non sono applicabili | `quality` resta fail-closed senza dover distinguere «saltato per design» da «saltato per errore» |
| D.74.5 | `validate-workflows.mjs` acquisisce un controllo di validità YAML + normalizzazione del fine-riga | Un file rotto che GitHub rifiuta produce una run con `jobs: 0` e `failure` a 0 s: la firma dell'issue #135. E i controlli con regex ancorate fallivano in silenzio sui file CRLF |
| D.74.6 | Il **doc-sync PR non viene eliminato** | `pr:` e `merged_commit:` sono noti solo dopo il merge. Eliminarlo richiederebbe un cambio allo **schema** del frontmatter: decisione del project owner, non un'ottimizzazione della CI |

## Lesson learned

| # | Osservazione | Azione |
|---|--------------|--------|
| 74-1 | **Un trigger senza filtro è una validazione ripetuta**: `push: branches: [main]` rieseguiva l'intera pipeline su alberi già validati | Filtro per path sui file che i writer automatici modificano |
| 74-2 | **La pipeline non deve girare su ciò che non è cambiato**: i gate sul codice su un merge sono lavoro sprecato | `detect-code`: i gate sul codice girano solo se la PR tocca almeno un file non-`.md` |
| 74-3 | **Fail-safe significa fallire verso il lato costoso**: se il detector non sa, i gate girano | Condizione `!= 'false'`, mai `== 'true'`, per i passi che decidono |
| 74-4 | **Un gate che non fa il parsing non valida la sintassi**: `validate-workflows.mjs` lavorava sul testo con regex e non avrebbe intercettato un YAML rotto | Controllo di validità YAML + normalizzazione CRLF, con test di regressione |
| 74-5 | **Il `\r` finale non è un terminatore di riga per il regex JavaScript**: `.` non lo matcha, e i pattern con `$` smettono di matchiare | Normalizzare il fine-riga una volta sola, prima di qualsiasi controllo |

## Documenti aggiornati

- `docs/12-DEVOPS.md` §9.10 (27 gate su 12 job), **§9.14.10** (nuova: l'anatomia del ciclo e le
  correzioni), **§9.14.11** (nuova: il validatore non validava il YAML)
- `AGENTS.md` §"🏎️ La CI: 12 job, e non gira 4 volte per ogni merge"
- `docs/18-DEV-LOG.md`: **§41**
- `docs/state/_index.md`, `docs/INDEX.md`: allineati
- `scripts/validate-workflows.mjs`: `checkYamlScalars()` + normalizzazione del fine-riga
- `scripts/test-workflow-yaml-scalars.sh`: nuovo (8 assert)
- `scripts/generate-bundle.ps1`: `$files` += `scripts/test-workflow-yaml-scalars.sh`

## Verifica

- `node scripts/validate-workflows.mjs .github/workflows` → exit 0 (0 falsi positivi sui 6 workflow
  reali) e exit 1 sulle fixture invalide
- `bash scripts/test-workflow-yaml-scalars.sh` → exit 0 (8 assert)
- 13 suite di test locali → tutte exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `node scripts/check-readme-facts.mjs` → exit 0
- Encoding: tutti i file toccati UTF-8 **senza BOM**, fine-riga LF, nessun U+FFFD
