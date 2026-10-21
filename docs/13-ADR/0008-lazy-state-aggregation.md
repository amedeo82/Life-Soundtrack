# ADR-0008 — Lazy-state aggregation: doc-sync fuori PR, stato atomico in docs/state/

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 25 (2026-10-18), issue #24
> Decisione emersa dall'analisi del workflow multi-agente (PR #19, S22): il doc-sync IN PR (D.21.1) genera conflitti di merge garantiti.

## Contesto

### Il problema strutturale

A partire da S21 (D.21.1, doc-sync IN PR), ogni agente che implementa una story modifica i file di stato globali — `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/BUNDLE.md` — direttamente nella propria PR. Quando più agenti lavorano in parallelo (claim ADR-0006), le loro PR divergono sugli stessi file di stato e **ogni merge in successione genera conflitti a mano**.

**Caso emblematico (S22)**: PR #19 (PWA, S22) aperta il 2026-10-18T08:56:37Z. PR #21 (fix hook, S23) mergiata `8a48e24` alle 09:54 → primi conflitti. PR #22 (i18n, S24) mergiata `5235c88` alle 17:02 → conflitti ricorrenti. La "risoluzione" S22 (commit `d0f7131`) ha lasciato conflict markers `<<<<<<< HEAD / >>>>>>> origin/main` non editati in `docs/INDEX.md`, `docs/SESSIONS.md`, `docs/BUNDLE.md` (rilevato 2026-10-18T15:13Z). Artefatto dovuto a merge naive.

### Perché D.21.1 era già un fix (di qualcos'altro)

D.21.1 (introdotto in S21) era nato per risolvere il **doc-sync post-merge su `main`** (race quando 2 PR mergiate in successione facevano entrambe il doc-sync in follow-up). L'eliminazione del follow-up ha eliminato quella race, ma ne ha creata una nuova **dentro le PR** (file globali toccati da più PR in parallelo). Il problema si è semplicemente spostato di un livello.

### Limiti delle difese esistenti

Verificato in `.githooks/pre-push:60-71` (S21, D5):
- **D5 base-stale warning** (soglia 5 commit dietro): su S22-S24 il delta era ~4 commit → mai scattato, nessun blocco
- **Nessuna rilevazione di file doc condivisi tra PR aperte** (manca check `gh pr list --state open + grep "^docs/INDEX\.md$"`)
- **Nessuna serializzazione claim su path di file** (ADR-0006 copre claim per issue, non per path)

## Decisione

Introduciamo un layer di **stato atomico non in conflitto** (`docs/state/`) e un **aggregator** che lo proietta nei file globali. Le PR di implementazione non toccano più direttamente `INDEX/SESSIONS/BACKLOG`: scrivono solo nella propria `state/<story>/...` o `state/sessions/<N>-<slug>.md`. L'aggregator + GH Action ricostruiscono i file globali dopo il merge su `main`.

### Layout

```
docs/state/
├── _index.md                              ← README della gerarchia
├── sessions/<N>-<slug>.md                 ← una entry per sessione (22-pwa.md, 23-fix-hook.md, ...)
└── stories/<id>-<slug>.md                 ← uno per story (0.5-pwa.md, 0.6-i18n.md, ...)
```

Ogni file ha frontmatter YAML con i campi minimi per la generazione del blocco aggregato.

### Blocchi marcati (regex-based)

I file globali espongono **blocchi marcati** che l'aggregator sostituisce atomicamente:

```markdown
<!-- AGGREGATE-SESSIONS-START -->
... righe rigenerate dallo script leggendo state/sessions/*.md ...
<!-- AGGREGATE-SESSIONS-END -->
```

```markdown
<!-- AGGREGATE-STORIES-START -->
... tabella rigenerata da state/stories/*.md (frontmatter) ...
<!-- AGGREGATE-STORIES-END -->
```

File gestiti (V1):
- `docs/SESSIONS.md` ← `<!-- AGGREGATE-SESSIONS-* -->`
- `docs/11-BACKLOG.md` ← `<!-- AGGREGATE-STORIES-* -->`

Estensioni future previste (V2): `docs/INDEX.md` "Stato del progetto" + "Roadmap sessioni", `docs/18-DEV-LOG.md` "Indice sintomi".

### Script aggregator

`scripts/aggregate-state.ps1`:
- `--list` — elenca i sorgenti e i target gestiti
- `--check` — verifica sincronia, exit 0 se allineato, 1 se drift (CI gate)
- `--dry-run` — calcola ma non scrive
- default — applica i blocchi calcolati (idempotente)

Vincoli implementativi (lesson consolidata in `docs/state/_index.md` §"Aggregazione"):
- Idempotenza (riproducibile)
- UTF-8 senza BOM per compatibilità cross-platform (lesson 0.1-7)
- ASCII-only nel codice PowerShell (PS 5.1 + UTF-8 no BOM = corruption di caratteri non-ASCII)

### GH Action

`.github/workflows/auto-state-aggregate.yml`:
- Trigger: `push: branches: [main]` con `paths: ['docs/state/**/*.md', 'scripts/aggregate-state.ps1']`
- Esegue `pwsh scripts/aggregate-state.ps1` + `git commit && git push` se diff
- Non-bloccante (analogo ad `auto-status-done.yml`)

### Policy di modifica (vincolante da S25)

| Tipo di PR | Cosa può modificare |
|---|---|
| **PR di implementazione** (story, bug fix) | solo i file nelle rispettive aree + `docs/state/<propria-story>/` + `docs/state/sessions/<propria-sessione>/` se rilevante |
| **PR di manutenzione state** | `scripts/aggregate-state.ps1`, `docs/13-ADR/*`, questo README |
| **PR di introduzione policy** (questa S25) | tutto (necessario per la migration iniziale di S22, S23, S24 + stories 0.5, 0.6) |

L'eccezione "PR di introduzione policy" si applica **solo a questa PR** (PR #24 / `feat/24-lazy-state-aggregation`). Dopo S25, vietato modificare `docs/SESSIONS.md` o `docs/11-BACKLOG.md` se non tramite blocchi `<!-- AGGREGATE-* -->`.

## Alternative considerate

- **A — split dei file doc per modulo** (`state/sessions/<N>.md`, `state/stories/<id>.md`, ma con aggregator che tocca anche `INDEX.md` direttamente): scartata — riduce conflitti a 1 file, ma mantiene la logica "edit manuale" di INDEX.
- **B — claim-lock per path** (estensione ADR-0006 con lock su file doc): scartata — richiede disciplina agente per riga, non per file; rischio starvation e false sense of safety.
- **C — doc-sync post-merge su main** (rollback parziale D.21.1 con GH Action `concurrency: state-sync`): scartata — reintroduce parzialmente la race condition, mitigata ma non eliminata.
- **D — questa**: lazy-state in `docs/state/` + aggregator atomico + GH Action. Conflitti **eliminati per costruzione**: ogni PR tocca solo la propria sotto-cartella.

## Conseguenze attese

### Positive

- **Conflitti eliminati per costruzione**: le PR parallele non si contendono più righe di file globali. Il delta per PR diventa limitato a file locali o a una sotto-cartella `state/`.
- **Reviewer state sempre coerente**: la GH Action mantiene `INDEX/SESSIONS/BACKLOG` post-merge. Il reviewer vede lo "stato vero" e non snapshot stantia.
- **Migration incrementale**: ogni sessione / story viene migrata atomicamente in `state/` con una PR dedicata. Niente big-bang.
- **Audit trail granulare**: `git log -- docs/state/<area>/<id>.md` ricostruisce la storia di una story / sessione senza scrollare SESSIONS/BACKLOG.

### Negative

- **Costo iniziale**: agenti devono imparare la nuova policy + scrivere frontmatter. Mitigazione: template in `docs/state/_index.md` §"Schema frontmatter" + lesson in `17-DEV-NOTES.md` P10 (nuovo).
- **Migration storica**: ~25 sessioni + ~7 story Phase 0 da migrare. V1 include solo S22, S23, S24 + stories 0.5, 0.6 (le più recenti e dimostrative). Le altre restano nel file legacy fino a V2.
- **Dipendenza da GH Action**: se l'azione fallisce, lo stato resta drift. Mitigazione: non-bloccante + log warning + auto-check in CI (`pwsh scripts/aggregate-state.ps1 --check` su ogni PR).
- **PR di introduzione S25**: l'unica che tocca `INDEX/SESSIONS/BACKLOG` direttamente. Dopo S25 vietato.

### Mitigazioni

- Pre-push hook esteso (D3) **NON blocca** le PR che modificano solo `state/`; `--check` aggregator opzionale ma raccomandato (vedi `AGENTS.md` aggiornato).
- ADR-0006 esteso (futuro V2) per check pre-claim: "issue N tocca area X, area X ha file globali? → suggerisci `state/<X>/` invece di edit diretto". Per ora: convention + checklist PR.
- ADR-0007 invariato: `status:*` post-claim funziona indipendentemente.

## Piano di rollout

### V1 — questa PR (#24 / Sessione 25)

1. ✅ `docs/state/_index.md` con README gerarchia e schema frontmatter
2. ✅ `docs/state/sessions/{22-pwa, 23-fix-hook, 24-i18n}.md` (3 file seed)
3. ✅ `docs/state/stories/{0.5-pwa, 0.6-i18n}.md` (2 file seed)
4. ✅ `scripts/aggregate-state.ps1` (`--list`, `--check`, `--dry-run`, default)
5. ✅ `.github/workflows/auto-state-aggregate.yml` (trigger push to main, non-bloccante)
6. ✅ `docs/13-ADR/0008-lazy-state-aggregation.md` (questo ADR)
7. ✅ `AGENTS.md` §"Post-merge actions" → §"Lazy-state aggregation (D.24.x)" aggiornata
8. ✅ `scripts/generate-bundle.ps1` `$files` aggiornato
9. ⬚ Aprire PR con `Closes #24`

### V2 — post-merge (issue future)

1. Migration incrementale sessioni 0..21 (issue separate, una per sessione)
2. Migration incrementale stories 0.1, 0.2, 0.3, 0.4, 0.7 (issue separate)
3. Estensione aggregator: blocco `<!-- AGGREGATE-INDEX-STATUS -->` in `docs/INDEX.md` "Stato del progetto"
4. Estensione aggregator: blocco `<!-- AGGREGATE-DEVLOG-INDEX -->` in `docs/18-DEV-LOG.md` "Indice sintomi per sintomo"
5. Deprecation policy: rimuovere i file legacy una volta completata la migration

### V3 — blocco "Prossima story" sul README.md (issue #127, 2026-10-21)

Caso speciale del pattern ADR-0008: invece di estendere un altro file globale, V3 usa l'aggregator per gestire **una singola stringa narrativa** del `README.md` che era andata in drift silenzioso (la frase "**Prossima sbloccata**: Story 0.2" sopravviveva mesi dopo che Story 0.2 era stata chiudata con PR #4, perché nessun gate CI la rileggesse).

1. `scripts/aggregate-state.ps1`: nuova funzione `Build-Block-NextStep` che legge `docs/state/stories/*.md` (frontmatter `status`), ordina per `[version]$Id` (tie-break su `Base`, determinismo via issue #70) e restituisce la prima story non-done come "prossima". Marker nuovi: `<!-- AGGREGATE-NEXT-STEP-{START,END} -->` in `README.md`.
2. Pattern di idempotenza rinforzato: i placeholder "Nessuna ... migrata" di `Build-Block-Sessions`/`Build-Block-Stories`/`Build-Block-IndexRoadmap` ora includono i marker (V1 li ometteva — fix scoperto via T10, bug latente che faceva fallire il check dopo la prima esecuzione).
3. `scripts/test-aggregate-determinism.sh` T10 (6 nuovi assert): pick deterministico, indipendenza dall'ordine di creazione filesystem, fallback graceful, idempotenza byte-identica.
4. Migration: `state/stories/0.1-monorepo-setup.md`, `0.2-schema-db-dexie.md` (entrambe `done`) + `1.1-adapter-youtube-music.md` (prima non-done, alimenta il blocco).
5. Regola di ownership ADR-0008 estesa: il blocco NEXT-STEP del `README.md` segue la stessa policy "mai a mano, solo aggregator" dei blocchi V1+V2.

Perché è V3 e non un'eccezione one-shot: il pattern è identico ("marker + Build function + target"), la copertura di test è garantita dal `aggregate-state.ps1 --check` (gate CI esistente), e zero overhead per il workflow agenti.

## Riferimenti

- **Issue #24** — contenitore del lavoro, claim `kilo-HP-ELITEBOOK-hjoe`
- **Issue #127** — V3 (issue specifica, claim `kilo-HP-ELITEBOOK-rnd7k3`)
- **AGENTS.md** §"📤 Post-merge actions" → §"🔄 Lazy-state aggregation (D.24.x)" (aggiornato)
- **AGENTS.md** §"📝 Checklist di auto-revisione PR" — campo "Se ho aggiunto file in docs/state/, NON modifico direttamente docs/SESSIONS.md o BACKLOG.md"
- **AGENTS.md** §"🔖 Sistema di issue e label" — nessuna label nuova richiesta
- **ADR-0006** (`docs/13-ADR/0006-multi-agent-task-claiming.md`) — claim protocol (resta valido; lock per path non implementato in V1)
- **ADR-0007** (`docs/13-ADR/0007-issue-state-machine.md`) — `status:*` post-claim (resta valido)
- **PR #19** (`feat/7-pwa-and-service-worker`) — caso sintomatico, ora facoltativo per migration
- **PR #21** (`fix/20-pre-commit-unstaged-only-check`) — bug fix che ha dimostrato il problema
- **PR #22** (`feat/5-i18n-setup`) — chiusura del ciclo PWA+i18n che ha generato 5 conflitti
- **17-DEV-NOTES.md** P10 (nuovo) — lessons stabilizzate per migration future

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 25 (2026-10-18) | Primo rilascio: directory `docs/state/` con 3 sessioni + 2 story migrate, aggregator PowerShell deterministico, GH Action `auto-state-aggregate.yml`, policy in `AGENTS.md`. Approvazione Boss ricevuta via issue #24 + comando "procediamo con D" |
| 1.1 | Sessione 41 (2026-10-21) | **V3 — blocco `AGGREGATE-NEXT-STEP-*` sul `README.md`** (issue #127). L'aggregator gestisce ora anche la stringa "Prossima sbloccata" per prevenire il drift silenzioso (Story 0.2 era done da PR #4 ma il README continuava a dichiararla come prossima). Aggiunti: `Build-Block-NextStep`, marker `AGGREGATE-NEXT-STEP-{START,END}`, target `README.md`, determinismo via `[version]$Id` con fallback graceful, 6 nuovi assert in `test-aggregate-determinism.sh` (T10). Bug latente V1 chiuso: i placeholder "Nessuna ... migrata" ora includono i marker di inizio/fine (riscontrato in T10 quando `docs/state/sessions/` era vuoto). Migration: `state/stories/0.1-*`, `0.2-*`, `1.1-*`. Policy ADR-0008 estesa: `README.md` segue la regola "mai a mano" come gli altri 4 file globali. |
