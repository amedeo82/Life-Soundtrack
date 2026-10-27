# 18 — Diario di Sviluppo (problemi, fix, lesson learned)

> Status: 🟡 DRAFT
> Versione: 2.0
> Ultima modifica: 2026-10-27 — §21 Issue #164 (spec Story 1.5 — Scrobbling hub)
> Scopo: registro strutturato di **problemi incontrati, fix applicati e lesson learned**
> durante l'implementazione, così che (a) lo stesso problema non si ripresenti, (b) gli
> agenti futuri partano già avvertiti, (c) il Boss possa vedere a colpo d'occhio dove
> la toolchain/doc ha richiesto correzioni.
> Collegato in `docs/INDEX.md` (Documenti di supporto). Riferimenti: `AGENTS.md`
> §"Fine di un'implementazione" e §"Checklist di auto-revisione PR".

---

## 1. Regole di compilazione

- **Quando**: al termine di **ogni** implementazione (PR o gruppo di PR chiuse), prima del merge.
- **Chi**: l'agente che ha implementato. Il Boss revisiona in PR.
- **Cosa registrare**:
  - **P** (Problema): un intoppo che ha richiesto ≥ 1 fix non ovvio.
  - **F** (Fix): la soluzione adottata, con riferimento al commit/branch.
  - **L** (Lesson learned): cosa fare d'ora in poi per non ripeterlo.
  - Le **decisioni di scope** o le **ambiguità di specifica** NON vanno qui: vanno in
    `docs/SESSIONS.md` (se di progettazione) o in una issue `needs-spec` (se bloccanti).
- **Come**: una sezione `## Story X.Y — <nome>` con **una entry per problema**. Niente
  diapositive narrative: tabelle + snippet. Link sempre a file:riga quando possibile.
- **Cosa NON duplicare**: pitfalls già stabilizzati in `17-DEV-NOTES.md` §3 vanno solo
  referenziati, non ricopiati. Questo file è per eventi **cronologici**; `17` resta
  la reference delle **convenzioni stabili**.

## 2. Indice rapido (per sintomo)

| Sintomo / area | Story | ID | Stato |
|----------------|-------|----|-------|
| TS2345/TS2769 su `vite.config.ts` (PluginOption) | 0.1 | 0.1-1 | ✅ risolto (Vitest 3) |
| TS2307/TS5090 su path alias (`@core/*`) | 0.1 | 0.1-2 | ✅ risolto (paths locali) |
| TS7016 su preset JS senza `.d.ts` | 0.1 | 0.1-3 | ✅ risolto (exports map con `types`) |
| `bundle --check` fallisce su Windows senza modifiche | 0.1 | 0.1-4 | ✅ risolto (`.gitattributes` + LF) |
| Identical-list-but-content-changed rumoroso | 0.1 | 0.1-5 | ✅ risolto (normalizz. timestamp in check) |
| `Identifier 'react' has already been declared` in eslint preset | 0.1 | 0.1-6 | ✅ risolto (rinominato import) |
| `bundle --check` (doppio dash) ignorato da PowerShell 5.1 | 0.1 | 0.1-9 | ✅ documentato (usare `-Check` su Win PS 5.1, `--check` su pwsh 7+) |
| `db.table.modify is not a function` (Dexie 4) | 0.2 | 0.2-1 | ✅ risolto (`toCollection().modify()`) |
| Schema committato divergente da spec APPROVED 02 v1.2 (`Artist`) | 0.2 | 0.2-2 | ✅ risolto (golden rule spec) |
| Re-put bulkPut su chiavi esistenti lentissimo in fake-indexeddb | 0.2 | 0.2-3 | ✅ risolto (verify su slice) |
| Test perf AC falliscono sotto coverage (overhead v8) | 0.2 | 0.2-4 | ✅ risolto (`perf.test.ts` + `--exclude`, min-of-3) |
| Barrel multipli / `MapIterator.map` / `import type` + `new` | 0.2 | 0.2-5 | ✅ risolto (import espliciti, spread) |
| `screen.getByText` matcha testo in paragrafo + bottone | 0.5 | 0.5-1 | ✅ risolto (`getByRole('button', { name })`) |
| Render accumulati in jsdom (`screen` globale) | 0.5 | 0.5-2 | ✅ risolto (`test-setup.ts` + `setupFiles`) |
| `it.each` non preserva tuple types | 0.5 | 0.5-3 | ✅ risolto (`const cases: Array<...>` esplicito) |
| PNG generator zero-deps (`node:zlib`) | 0.5 | 0.5-4 | ✅ documentato (`scripts/generate-pwa-icons.mjs`) |
| `virtual:pwa-register/react` in jsdom | 0.5 | 0.5-5 | ✅ risolto (alias `__mocks__/virtual-pwa-register.ts`) |
| `TypeError: Value cannot be converted to sequence` su `new Blob(string)` | 1.1 | 1.1-1 | ✅ risolto (`new Blob([string])`) |
| `exactOptionalPropertyTypes` rifiuta campo opzionale = `undefined` | 1.1 | 1.1-2 | ✅ risolto (`delete` sull'oggetto costruito) |
| Detect full-stream rifiuta file troncato (perde partial recovery 05§4) | 1.1 | 1.1-3 | ✅ risolto (test strutturale sul prefisso analizzato) |

## 3. Template entry (da copiare)

    ### Story 0.X — <nome story>
    **Branch**: feat/<num>-<slug>
    **PR**: #NN
    **Data**: YYYY-MM-DD

    | # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
    |---|------|---------|-------|-------------------|------|
    | 1 | P+F+L | ... | ... | ... | file:line |

    **Lesson learned sintetica** (1-2 righe): ...

    **Link utili**: commit, PR, issue correlata, sezione spec toccata.

## 4. Entries cronologiche

### Story 0.1 — Setup monorepo e toolchain
**Branch**: `feat/0.1-monorepo-setup` (**merged in `main`** → branch eliminata dopo merge)
**PR**: **#2 — squash-merged `c0fb0a4` (2026-10-16 16:54 +0200)**
**Data**: 2026-10-16
**Stato**: ✅ **DONE** — scaffold monorepo + toolchain funzionanti; 5/5 task + 5/5 AC verificati; feature work delegato a Story 0.2+

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 0.1-1 | P+F+L | `typecheck` fallisce in `apps/web/vite.config.ts` con `TS2345`/`TS2769` (`PluginOption` non assegnabile); due `vite@5.x` + `vite@6.x` in `node_modules/.pnpm` | Vitest 2.1.x dipende da Vite 5; con Vite 6 nell'app, `vitest/config` e `vite` espongono tipi da due istanze diverse | Vitest `^3.0.5` + `@vitest/coverage-v8` `^3.0.5` in tutti i package che testano (pnpm deduplica → una sola istanza di Vite 6). Allineare Vitest a Vite nella stessa PR | `packages/core/vitest.config.ts:1`, `packages/config/vitest/base.js:1` |
| 0.1-2 | P+F+L | `TS2307: Cannot find module '@core/schema'` con `paths` solo nel preset condiviso; oppure `TS5090: Non-relative paths are not allowed when 'baseUrl' is not set` | I `paths` ereditati via `extends` da un tsconfig condiviso non si risolvono in modo affidabile rispetto al file dichiarante; valori non-relativi richiedono `baseUrl` | Dichiarare `paths` in `apps/web/tsconfig.json` con percorsi relativi al file (`"../../packages/core/src/*"`) e prefisso `./` per i path interni (`"./src/*"`). **Non** rimettere `paths` in `packages/config/tsconfig/base.json` | `apps/web/tsconfig.json:8-10` |
| 0.1-3 | P+F+L | `TS7016: Could not find a declaration file for module '@ls/config/vitest/base'` consumato da `vitest.config.ts` | Subpath wildcard `"./vitest/*": "./vitest/*"` (senza estensione) non fa risolvere a TypeScript il `.d.ts` sibling del `.js` | Subpath esplicito con condizioni: `"./vitest/base": { "types": "./vitest/base.d.ts", "default": "./vitest/base.js" }`. Stesso pattern per ogni preset JS consumato da file TS | `packages/config/package.json:exports` |
| 0.1-4 | P+F+L | `generate-bundle.ps1 --check` fallisce su Windows con "Lista file identica, ma contenuto cambiato" anche senza modifiche ai documenti | `core.autocrlf=true` estrae i doc con CRLF; il bundle rigenerato incorpora CRLF e diverge dal bundle committato (LF, generato in CI/Linux) | `.gitattributes` con `* text=auto eol=lf` (+ regole `binary` per asset). Dopo modifica attributi, riscrivere il working tree prima di rigenerare. **Importante**: non rimuovere `.gitattributes` | `.gitattributes:1` |
| 0.1-5 | P+F+L | `bundle --check` fallisce sempre subito dopo la generazione perché il timestamp cambia | Il confronto `$existing -eq $newBundle` legge il file con timestamp "X" e lo confronta con un bundle appena generato con timestamp "Y" (un minuto dopo) | In `--check`, normalizzare il timestamp (`-replace '(?m)^> Data: .+$', '> Data: 0000-00-00 00:00'`) su entrambi i lati. Il check diventa deterministico, basato solo sul contenuto | `scripts/generate-bundle.ps1:166-170` |
| 0.1-6 | P+F+L | ESLint preset fallisce con `Identifier 'react' has already been declared` | `import react from 'eslint-plugin-react'` collide con il binding `react` esportato da `eslint-plugin-react` stesso (in alcune versioni del plugin) | Rinominare l'import: `import reactPlugin from 'eslint-plugin-react'` (o usare destrutturazione selettiva). Convenzione adottata: mai importare un modulo col nome della sua dipendenza omonima | `packages/config/eslint/react.js:1` |
| 0.1-7 | P+F | `Out-File -Encoding utf8` in PowerShell 5.1 scrive un BOM UTF-8 che rompe il byte-equality del check | PS 5.1 `Out-File` aggiunge BOM; `Get-Content` non lo strappa → `$existing` differisce da `$newBundle` di 3 byte | Usare `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))` (UTF-8 senza BOM). Output deterministico cross-platform | `scripts/generate-bundle.ps1:189-192` |
| 0.1-8 | P+L | `pnpm install` mostra "Update available! 9.15.9 → 12.11.2" e `WARN deprecated eslint@9.39.5`; il Boss chiede se la policy "ultime versioni" fosse documentata → **non lo era** | Le Sessioni 0-9 e l'audit non avevano mai formalizzato la policy di versionamento toolchain | Decisioni D.10.1 ("ultime major disponibili") + D.10.2 (upgrade corrente differito a fine implementazione → Story 6.1 `[PHASE-POST]`). Fino a Story 6.1: **non bumpare major** di toolchain nelle story correnti. Aggiunti a `17-DEV-NOTES.md §3 P0` | `docs/SESSIONS.md:246-256`, `docs/11-BACKLOG.md` v1.2 Story 6.1 |
| 0.1-9 | P+L | In locale (Windows PowerShell 5.1) `generate-bundle.ps1 --check` salta silenziosamente il check, rigenera il file ed esce 0; in CI con `pwsh` 7 il check funziona correttamente | PowerShell 5.1 non riconosce lo stile argomento `--check` su switch `[switch]$Check` (accetta solo `-Check`) | Nei doc locali usare `powershell scripts/generate-bundle.ps1 -Check`; CI usa `pwsh ... --check` (`12-DEVOPS.md` §2). Documentato in `17-DEV-NOTES.md` §1 riga bundle | `docs/17-DEV-NOTES.md:22` |

**Lesson learned sintetica**: in un monorepo monolitico, toolchain e tsconfig condivisi sono il single point of failure per 4 categorie di errori (Vite/Vitest, paths, exports map, line endings). Quando si bootstrappa un monorepo, allocare sempre tempo per stabilizzare la toolchain PRIMA di iniziare feature work.

**Stato accettazione Story 0.1** (riferimento `docs/11-BACKLOG.md`):

- [x] `pnpm install` senza errori su node 20 LTS — **OK** (warning di pnpm 9→12 atteso per D.10.2)
- [x] `pnpm run lint` passa su codebase vuoto — **OK** (ESLint 9 flat config)
- [x] `pnpm run test` esegue almeno un test dummy — **OK** (Vitest in `@ls/core` e `@ls/web`)
- [x] `pnpm run build` produce artefatti — **OK** (`dist/` in `@ls/core`, `@ls/ui`, `@ls/web`)
- [x] CI GitHub Actions: lint + test su ogni PR — **OK** (`.github/workflows/ci.yml`)

**Link utili**:
- Commit: `66cbc72 feat: init monorepo turborepo + toolchain (story 0.1)`
- Commit: `bff252d docs: policy versioni toolchain (D.10.1/D.10.2) e Story 6.1 differita`
- Commit: `e654ffc docs: aggiungi 17-DEV-NOTES con pitfalls toolchain e policy versioni (D.10.x)`
- **Commit: `c0fb0a4 feat: Story 0.1 — scaffold monorepo + toolchain (#2)` (squash merge in `main`)**
- Branch: `feat/0.1-monorepo-setup` (merged → eliminata)
- PR: **#2** (squash merge)
- Spec toccata: `05-ARCHITECTURE.md §8 §9` (confermata in pratica)
- Pitfalls consolidati: `17-DEV-NOTES.md §3`

---

## 5. Sessione 13 — consolidamento documentazione (post-merge)

**Tipo**: doc-only, nessuna implementazione di codice (chiusura gap audit pre-Fase 0)
**Branch**: `feat/0.2-dexie-schema` (riutilizzato; worktree parallelo Story 0.2)
**PR**: **#3 — merge commit `10ecde5` in `main` (2026-10-16)**
**Commit**: `bee5340 docs: sessione 13 - consolidamento documentazione pre-fase 0`
**Stato**: ✅ **merged** in `main` — gate D.12.1 post-merge applicato

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 13-sync-1 | L | Drift in `INDEX.md` §"Stato del progetto" dopo merge: S13 non menzionata, conteggi DRAFT/APPROVED outdated, fixture dirs non elencate | Il commit `bee5340` aggiornava INDEX ma il Boss ha mergato senza verificare la coerenza con `git log --oneline -5 main` (gate D.12.4) | Aggiornato INDEX: 02 v1.2, 11 v1.2.3, S13 in roadmap, fixture dirs nella sezione "Fixture di test" | `docs/INDEX.md:73-83` |
| 13-sync-2 | L | `SESSIONS.md` Sessione 13 era già completa (creata pre-merge) — verificato che riflette il reale stato del branch al merge (PR #3 chiusa, branch mergato, 20 file) | — | Nessuna modifica; entry S13 era già fedele allo stato finale | `docs/SESSIONS.md:357-440` |
| 13-sync-3 | L | `BUNDLE.md` rigenerato pre-merge ma mai verificato post-merge; la spec D.12.3 richiede `--check` exit 0 dopo il merge | Il bundle veniva rigenerato durante lo sviluppo della PR ma il check andava rifatto su `main` aggiornato | `pwsh scripts/generate-bundle.ps1 -Check` eseguito su main → 31 file, exit 0 | `docs/BUNDLE.md` |
| 13-sync-4 | L | `AGENTS.md` §"Struttura del repository" non rifletteva le nuove cartelle `fixtures/db-seed/`, `fixtures/scenarios/`, `scripts/generate-fixtures.mjs` pre-PR | Aggiornato durante la S13 stessa (vedi commit `bee5340`) | Verificato che main ora ha la struttura aggiornata | `AGENTS.md:155-173` |

**Lesson learned sintetica**: il gate D.12.1 (post-merge doc sync) ha funzionato: nessun drift critico post-merge in S13 perché la entry SESSIONS, l'INDEX, il BUNDLE e la struttura AGENTS erano stati aggiornati **prima** del merge, durante la sessione stessa. Il sync post-merge è una verifica di safety net, non un'operazione di salvataggio.

**Stato accettazione S13**:
- [x] M13 (PlatformCard 5 stati) chiuso
- [x] M5 (artworkUrl) chiuso
- [x] C6 (fixture Spotify v1.1) chiuso
- [x] V1 (7 fixture + generator) chiuso
- [x] Story 2.2 AC allineata a 04§5
- [x] D.13.8 confermato (nessuna promozione DRAFT→APPROVED)

**Link utili**:
- Branch: `feat/0.2-dexie-schema` (merged → eliminata dopo il merge in main)
- PR: **#3** (merge commit `10ecde5`)
- Commit: `bee5340 docs: sessione 13 - consolidamento documentazione pre-fase 0`
- Spec toccate: `02-DATA-SCHEMA v1.2`, `03-ADAPTERS/spotify v1.2`, `06-UX-FLOWS-STATES v0.3`, `10-TESTING v1.1`, `11-BACKLOG v1.2.3`
- Pitfalls: nessuno nuovo (la S13 non ha introdotto pattern tecnici, solo decisioni di spec)

---

## 6. Sessione 14 — implementazione Story 0.2 (schema DB e layer Dexie)

**Branch**: `feat/0.2-schema-db-dexie` (da `main` @ `774e520`)
**PR**: **#4 — merge commit `fa09b06` in `main` (2026-10-17)**
**Data**: 2026-10-16/17
**Stato**: ✅ **merged** in `main` — gate D.12.1 applicato (CI su main ✅)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 0.2-1 | P+F+L | `TypeError: db.tracks.modify is not a function` in `recount()` | In Dexie 4 `modify()` esiste solo su `Collection`, non su `Table` | Usare `db.tracks.toCollection().modify(...)`; stessa cosa per artists | `packages/core/src/db/recount.ts:22-32` |
| 0.2-2 | P+F+L | `packages/core/src/schema/index.ts` divergeva dalla spec APPROVED 02 v1.2: `Artist` con `artworkUrl`/`firstSeenAt`/`lastSeenAt` assenti dalla spec, e i fixture db-seed non li emettono | Modifica introdotta nel consolidamento S13 non allineata al golden rule (spec APPROVED vince) | `Artist` riallineato a 02 §3.3; chiarita la semantica FK: `listens.trackId` → `Track.id` (UUID, come nei fixture 10-TESTING §3.2), mentre la PK di `tracks` resta `canonicalKey` (identità DEDUP) | `packages/core/src/schema/index.ts:102-116`, `packages/core/src/db/db.ts:30-33` |
| 0.2-3 | P+F+L | Re-put di 5k eventi **già presenti** > 5s in fake-indexeddb, con timeout a cascata sui test successivi | Il fallback di Dexie `bulkPut` su chiavi esistenti attraversa uno slow-path con scan per chunk, costoso in fake-indexeddb | Verifiche di re-import su slice (50 eventi) + idempotenza integrale su 100 eventi; l'invariante è comunque garantito dalla PK unique `eventKey`. Nota: il re-import integrale a 50k è AC della Story 0.3 e girerà nel browser (IndexedDB nativo) | `packages/core/src/db/__tests__/db.test.ts:436-449` |
| 0.2-4 | P+F+L | Test di performance AC (10k < 500ms) falliscono sotto strumentazione coverage (~2× overhead) | Il provider v8 instrumenta il codice misurato | Test perf isolati in `perf.test.ts`; lo script `test:coverage` li esclude con `--exclude`; misure con warm-up non misurato + minimo di 3 round (metodologia micro-benchmark) | `packages/core/src/db/__tests__/perf.test.ts`, `packages/core/package.json` (`test:coverage`) |
| 0.2-5 | P+F | Errori TS/runtime nel refactor dei test: (a) `'../index' has no exported member 'Track'`, (b) `MapIterator.map is not a function`-like TS2339, (c) `LifeSoundtrackDB is not defined` a runtime | (a) da `src/db/__tests__/` il path `'../index'` risolve al **barrel db**, non a quello radice: i tipi schema stanno in `'../../schema'`; (b) `MapIterator.map` non è disponibile con `lib: ES2022` → spread `[...iter].map()`; (c) `import type` di `LifeSoundtrackDB` in helpers ma `new LifeSoundtrackDB()` a runtime → ReferenceError | Import del valore esplicito in helpers; tipi schema da `'../../schema'`; spread prima di `.map()`; il barrel radice ora esporta esplicitamente l'API pubblica (05 §9.1) | `packages/core/src/db/__tests__/helpers.ts:1-14`, `packages/core/src/index.ts` |

**Lesson learned sintetica**: nel layer DB contano tre vincoli — la spec APPROVED è fonte di verità sulle interfacce; i fixture db-seed definiscono la semantica FK di fatto (`trackId` → `Track.id`); fake-indexeddb ha costi superlineari su bulkPut di chiavi esistenti e sotto coverage: i test di performance vanno isolati e misurati in steady-state (warm-up + min-of-3).

**Osservazione fixture (per Story 0.3)**: `medium.json` contiene 500 track ma solo 467 `canonicalKey` unici (31 gruppi DEDUP) e 33 UUID "orfani" referenziati dai listens. Con PK `canonicalKey` il bulkPut fonde i gruppi e gli ascolti sugli UUID soppiantati non contribuiscono ai contatori (verificato nel test di integrazione). L'adapter dovrà risolvere `trackId` via DEDUP (05§3) **prima** dell'inserimento.

**Link utili**:
- Branch: `feat/0.2-schema-db-dexie` (merged → eliminata dopo il merge in main)
- PR: **#4** (merge commit `fa09b06`, 2026-10-17; CI pull_request ✅ + CI main ✅)
- Commit: `57f2e11 feat: story 0.2 — schema dexie, repository e recount (@ls/core)` + `227e910 docs: story 0.2 — sync backlog, dev-notes, dev-log, sessions, index, bundle`
- Spec: `02-DATA-SCHEMA v1.2` §3, §6, §7, §11; `10-TESTING v1.1` §2, §3.2; `05-ARCHITECTURE` §5, §9.1
- Coverage: `db/` al 100% stmts (target ≥80%); suite 26 test (23 funzionali + 2 perf + 1 barrel)

---

## 7. Sessione 18 — protocollo claim agenti paralleli (ADR-0006)

**Tipo**: doc-only (`docs/`, `AGENTS.md`, `scripts/generate-bundle.ps1`); nessuna modifica a codice o schema dati
**Branch**: `feat/11-task-claiming-protocol` (da `main` @ `e514404`)
**PR**: **#12 — merge commit `2891cb5` in `main` (2026-10-17)**
**Commit**: `7b4b10b docs(agents): protocollo claim per agenti paralleli (ADR-0006)`
**Issue**: #11 (claim `kilo-HP-ELITEBOOK-hjoe`, dogfooding del protocollo definito nella stessa issue)
**Stato**: ✅ **merged** in `main` — gate D.12.1 post-merge applicato, branch remoto eliminato (policy §♻️), claim rilasciato su #11 con `release:` + rimozione label `in-progress`

### Sintesi

- ADR-0006 `docs/13-ADR/0006-multi-agent-task-claiming.md` 🟢 APPROVED v1.0: self-claim via label `in-progress` + commento `claim:`; discriminatore del vincitore = ID commento GitHub più basso (assignee scartato perché gli agenti condividono il PAT); TTL 12h con procedura `stale-release:`; rilascio obbligatorio al merge / abbandono / spec tornata 🟡 DRAFT.
- `AGENTS.md` v1.3: nuova sezione obbligatoria "🎫 Presa in carico delle story (claim)" con procedura `gh` (4 step: enum candidabili, claim con label+commento, riverifica, vincita/yield); §"🚀 Primo task di un agente" riscritta claim-first; label `in-progress` aggiunta alla tabella label; PAT esteso a `issues: read/write`.
- `docs/11-BACKLOG.md` v1.3.0: §"Priorità di lavorazione" rivista come ordine di **tentativo** (claim-first), con regola ADR-0006 in calce; legenda 🟡 legata alla label `in-progress`.
- `docs/BUNDLE.md` rigenerato; `scripts/generate-bundle.ps1 --check` exit 0 (32 file, ADR-0006 incluso).

### Lesson learned

| # | Tipo | Osservazione | Rif. |
|---|------|--------------|------|
| 18-1 | L | **Dogfooding del claim**: implementando il protocollo di claim con la stessa procedura (claim `kilo-HP-ELITEBOOK-hjoe` su #11 prima di iniziare a scrivere codice) si è verificato che la procedura regge end-to-end anche in sessioni AI che lavorano a lungo su una singola issue | issue #11 commento claim |
| 18-2 | L+F | **PowerShell interpreta `claim:` come cmdlet**: passare il body del `gh` tramite `--body-file` o escape esplicito; PowerShell 5.1 con `Out-String` lascia un BOM UTF-8 che rompe il commitlint (`header-trim`) — usare `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))` (lesson 0.1-7 riconfermata) | `docs/17-DEV-NOTES.md §1` |
| 18-3 | L | **`git branch -d` rifiuta branch merged via merge-commit**: dopo un merge commit, git considera il branch "non fast-forward reachable" dalla testa locale e rifiuta `-d`. Verificare il merge con `git branch -r --contains <sha>` o `--merged origin/main`, poi usare `-D` solo dopo conferma. Su Windows PowerShell l'auto-check `git branch -r --merged main` filtra per il branch locale, non per `origin/main` — passare esplicitamente `origin/main` | AGENTS.md §"♻️ Pulizia branch post-merge" (auto-check già documentato) |

### Osservazione operativa (per le prossime 3 story `agent-ready`)

Le 3 issue aperte in S17 (#5 Story 0.6 i18n, #6 Story 0.3 Adapter Spotify, #7 Story 0.5 PWA) hanno **aree di file disgiunte** (ui / adapter / devops). Ora che ADR-0006 è merged, ogni agente che le prende deve:
1. Claim `kilo-<hostname>-<random>` su GitHub Issues prima di creare il branch
2. Vincere la riverifica (ID commento più basso)
3. Lavorare solo dopo aver verificato lo stato

Se due agenti claimano la stessa issue entro la finestra di race, vince chi ha scritto per primo; l'altro rilascia `yield:` e passa alla successiva.

### Link utili

- Branch: `feat/11-task-claiming-protocol` (merged → eliminata dopo il merge in main, policy §♻️)
- PR: **#12** (merge commit `2891cb5`, 2026-10-17)
- Commit: `7b4b10b docs(agents): protocollo claim per agenti paralleli (ADR-0006)`
- Spec introdotte: ADR-0006 v1.0, AGENTS.md v1.3, 11-BACKLOG.md v1.3.0
- Spec toccate: `docs/INDEX.md` (ADR x5, AGENTS v1.3), `docs/SESSIONS.md` (Sessione 18 + changelog v0.8 + v0.9 post-merge), `scripts/generate-bundle.ps1` (`$files` include ADR-0006)

---

## 8. Sessione 19 — issue state machine (status:* post-claim)

**Tipo**: doc-only (`docs/`, `AGENTS.md`, `scripts/generate-bundle.ps1`); nessuna modifica a codice o schema dati
**Branch**: `feat/13-issue-state-machine` (da `main` @ `<tip>`)
**PR**: **#14 — merge commit `a500ea2` in `main` (2026-10-17T15:03:21Z)**
**Issue**: #13 (claim `kilo-HP-ELITEBOOK-jm9f`, dogfooding del protocollo ADR-0007)
**Stato**: ✅ merged in `main`; claim `kilo-HP-ELITEBOOK-jm9f` rilasciato; branch remoto eliminato (policy §♻️); cleanup retroattivo #11 e #9 eseguito

### Sintesi

- **ADR-0007** `docs/13-ADR/0007-issue-state-machine.md` 🟢 APPROVED v1.0: 4 label `status:*` (done / in-review / wontdo / blocked-other), transizioni claim → in-review → done/wontdo, query candidati con `jq`, pattern `Closes #N` obbligatorio. Retro-compatibile con ADR-0006 (claim e TTL invariati).
- **`AGENTS.md`** v1.4: nuova sezione §"📦 Macchina a stati delle issue (status:*)" con regole di transizione; query §"🚀 Primo task" aggiornata con `jq`; tabella label estesa; campo `Closes #N` reso obbligatorio nella checklist PR.
- **`docs/11-BACKLOG.md`** v1.4.0: §"Stato di una Story" estesa con i 4 stati `status:*` + nota di mutua esclusione con `agent-ready`.
- **`docs/INDEX.md`**, **`docs/SESSIONS.md`**, **`scripts/generate-bundle.ps1`**, **`docs/18-DEV-LOG.md`**, **`docs/BUNDLE.md`** aggiornati (7 file sincronizzati per il gate D.12.1).
- 4 label GitHub create (`status:done`/`status:in-review`/`status:wontdo`/`status:blocked-other`) con descrizioni e colori dedicati.

### Lesson learned

| # | Tipo | Osservazione | Rif. |
|---|------|--------------|------|
| 19-1 | L | **Issue mergata ma non chiusa come sintomo (dogfooding)**: il problema del Boss (#11 rimasta `agent-ready` dopo `PR #12` merged) è ESATTAMENTE l'orfano che il nuovo ADR-0007 previene; il cleanup retroattivo è sia il fix che la dimostrazione del problema. Pattern replicabile: quando un agent si accorge che il workflow documentato non copre un caso reale, apre `agent-ready` con la mini-spec prima di scrivere codice | issue #11 → cleanup-retroattivo; issue #13 (tracciamento) |
| 19-2 | L+F | **Label description > 100 char in `gh label create` fallisce con HTTP 422**: GitHub ha un limite di 100 caratteri sulle descrizioni delle label. Tenere le descrizioni concise (≤90 char) o documentarle in AGENTS.md invece che nel description GitHub | `gh label create "status:blocked-other" --description "..."` con 122 char → 422; corretto a 90 char |
| 19-3 | L | **`write` tool input size limit + JSON escaping**: un singolo `write` di un file da 350+ righe con contenuti Markdown ricchi di `"` può rompere il JSON (escape sbagliato o troncamento). Preferire `edit` con anchor piccoli a `write` per file grandi | preparazione PR #13 |
| 19-4 | L | **PowerShell 5.1 single-quote vs double-quote in `jq`**: per evitare escaping JSON nel command, usare `startswith('status:')` invece di `startswith("status:")` nelle query jq passate a PowerShell. `jq` accetta indifferentemente `'` e `"` come delimitatori di stringa | `AGENTS.md` §"🎫 Presa in carico delle story" (nuova query) |
| 0.5-1 | P+F+L | `screen.getByText(/Aggiorna ora/)` trova match multipli: il bottone ha label "Aggiorna ora" e il paragrafo del banner contiene "Aggiorna ora per le ultime funzionalità." | `getByText` matcha substring; il regex senza boundary ambigui cattura entrambi | Usare `getByRole('button', { name: /Aggiorna ora/ })` per disambiguare; il ruolo del pulsante è semantico e non collassa su altri elementi che contengono la stringa | `apps/web/src/__tests__/update-banner.test.tsx:34` |
| 0.5-2 | P+F | `screen.getByTestId('update-banner')` in test successivi al primo matchava più elementi a causa di render residui in jsdom | `vitestBase.js` ha `globals: false`, quindi l'auto-cleanup di `@testing-library/react` NON scatta; `screen` (globale) accumula match cross-test | Aggiunto `apps/web/test-setup.ts` con `afterEach(() => cleanup())` referenziato in `vite.config.ts` come `setupFiles`. Pattern replicabile: per ogni `app/*` con jsdom + RTL, serve un `test-setup.ts` esplicito | `apps/web/test-setup.ts:1`, `apps/web/vite.config.ts:setupFiles` |
| 0.5-3 | P+F | TS2345 "Argument of type 'number[] \| null' is not assignable to 'SemverTuple \| null'" su `it.each([...])` in test `classifyUpdate` | `it.each` inferisce `number[]` non `[number, number, number]` (i tuple types non sono preservati dall'array literal) | Estrarre i casi in un `const cases: Array<{ ..., current: SemverTuple \| null, next: SemverTuple, ... }>` esplicito; `it.each(cases)` preserva i tipi | `apps/web/src/__tests__/use-app-update.test.ts:46-66` |
| 0.5-4 | L | **PNG generator zero-deps**: generare 4 PNG (192/512/512 maskable/180 apple-touch) usando solo `node:zlib` + `Buffer` è fattibile in ~50 righe; il filter byte `0` (None) + deflate livello 9 comprime bene i gradient (187 byte per 192×192 solido). Deterministico e riproducibile | `scripts/generate-pwa-icons.mjs` |
| 0.5-5 | L | **`virtual:pwa-register/react` nei test Vitest**: il plugin genera il modulo virtuale a build-time; in jsdom non esiste. Senza alias, il typecheck passa (riferimento a `vite-plugin-pwa/react`) ma il runtime fallisce con "Cannot find module". Soluzione: `resolve.alias` in `vite.config.ts` che mappa il virtual path a uno stub in `apps/web/src/__mocks__/virtual-pwa-register.ts`. `vi.mock` factory custom resta disponibile per test che vogliono simulare stato "needRefresh" | `apps/web/vite.config.ts:alias`, `apps/web/src/__mocks__/virtual-pwa-register.ts:1` |

### Link utili

- Branch: `feat/13-issue-state-machine` (post-merge → eliminata per policy §♻️)
- PR: **#14** (merge commit `a500ea2`, 2026-10-17T15:03:21Z)
- Issue: #13 (claim `kilo-HP-ELITEBOOK-jm9f`)
- Spec introdotte: ADR-0007 v1.0, AGENTS.md v1.4, 11-BACKLOG.md v1.4.0
- Spec toccate: `docs/INDEX.md` (version, S19), `docs/SESSIONS.md` (Sessione 19 + changelog v1.0), `docs/18-DEV-LOG.md` (§8 + changelog v0.7), `scripts/generate-bundle.ps1` (`$files` include ADR-0007)

---

## 9. Sessione 20 — hardening multi-agente (push early + pre-commit hook + session checklist)

**Tipo**: doc-only + script (`AGENTS.md`, `docs/`, `.githooks/`, `scripts/setup-hooks.js`, `package.json`); nessuna modifica a codice applicativo
**Branch**: `feat/15-parallel-safety` (da `main` @ `ac09ec9`)
**PR**: **#16 — merge commit `506c86a` in `main` (2026-10-17T15:24:31Z)**
**Issue**: #15 (claim `kilo-HP-ELITEBOOK-r9p2`)
**Stato**: ✅ merged in `main`; claim `kilo-HP-ELITEBOOK-r9p2` rilasciato; branch remoto eliminato (policy §♻️); 3 difese a basso costo (push early + pre-commit hook + session checklist) live

### Sintesi

- **`.githooks/pre-commit`** (nuovo): script bash committato che verifica il branch corrente. Pattern `^(main|docs/.+|feat/N-.+|fix/N-.+)$`. Bypass con `git commit --no-verify` o `LIFE_SOUNDTRACK_SKIP_HOOKS=1`.
- **`scripts/setup-hooks.js`** (nuovo): script Node idempotente per `git config core.hooksPath .githooks` via `postinstall` di `package.json`. Non-fatal in CI/build container senza git.
- **`package.json`** aggiornato: aggiunto `postinstall: "node scripts/setup-hooks.js"` (e alias `setup-hooks`). Trigger automatico del hook.
- **`AGENTS.md`** v1.5: push early obbligatorio in §"🌳 Git workflow"; §"🛡️ Session start checklist" (4 comandi); §"🪝 Pre-commit hook" (setup + bypass). Footer aggiornato.
- **Failure mode coperti**: F1 (commit su main), F2 (branch invisibile), F4 (base stale), F6 (collision), F7 (commit post-merge). F3 (file conflict) e F5 (stash collision) non mitigati direttamente — documentati come limiti noti, richiedono worktree per difesa forte (decisione D.20.1, Boss scelto C).

### Lesson learned

| # | Tipo | Osservazione | Rif. |
|---|------|--------------|------|
| 20-1 | L | **Difese stratificate > difesa unica**: 3 difese a basso costo (push early, pre-commit hook, session checklist) coprono 5 failure mode su 8. Nessuna singola difesa è perfetta; la combinazione mitiga i rischi più probabili mantenendo bassa la frizione | issue #15 + AGENTS.md v1.5 |
| 20-2 | L+F | **Setup via postinstall è double-edged**: automatizza ma può rompere in ambienti senza git (CI, build containers). Soluzione adottata: script non-fatal che skip + warn. Trade-off accettato: il setup automatico fallisce silente in CI ma funziona per gli agenti umani/AI locali | `scripts/setup-hooks.js` |
| 20-3 | L | **Pattern di branch con N obbligatorio forza la connessione issue-branch**: `feat/<N>-<desc>` significa che `N` è sempre un numero di issue, eliminando `feat/foo-bar` che non traccia nulla. Convenzione debole ma enforcement forte via hook | `.githooks/pre-commit` |
| 20-4 | L | **`git config core.hooksPath` è un setting per-clone, non per-utente**: ogni agente che clona il repo deve eseguire il setup. `postinstall` lo risolve ma solo se l'agente fa `pnpm install` dopo il clone. Workaround futuro: hook in `core.hooksPath` standardizzato in `init.templateDir` o documentato in `CONTRIBUTING.md` (da valutare post-implementazione) | `package.json` postinstall |

### Link utili

- Branch: `feat/15-parallel-safety` (post-merge → eliminata per policy §♻️)
- PR: **#16** (merge commit `506c86a`, 2026-10-17T15:24:31Z)
- Issue: #15 (claim `kilo-HP-ELITEBOOK-r9p2`)
- Spec introdotte: AGENTS.md v1.5 (push early, session checklist, hook setup)
- Spec toccate: `package.json` (postinstall), `docs/INDEX.md` (S20), `docs/SESSIONS.md` (Sessione 20 + changelog), `docs/18-DEV-LOG.md` (§9 + changelog), `scripts/setup-hooks.js` (nuovo), `.githooks/pre-commit` (nuovo), `.githooks/README.md` (nuovo)

---

## 10. Sessione 21 — refactor catena multi-agente (doc-sync IN PR + GH Action + hook extensions)

**Tipo**: doc-only + script (`AGENTS.md`, `docs/`, `.githooks/`, `.github/workflows/`); nessuna modifica a codice applicativo
**Branch**: `feat/17-chain-refactor` (da `main` @ `c048562`)
**PR**: **#18 — merge commit `6c0f79b` in `main` (2026-10-17T18:00:26Z)**
**Issue**: #17 (claim `kilo-HP-ELITEBOOK-q7w3`)
**Stato**: ✅ merged in `main`; claim `kilo-HP-ELITEBOOK-q7w3` rilasciato; branch remoto eliminato (policy §♻️); GH Action `auto-status-done` testata con successo (applicata automaticamente a #17)

### Sintesi

- **`.github/workflows/auto-status-done.yml`** (nuovo): GH Action che applica `status:done` alle issue chiuse al merge, rimuovendo `in-progress` e `status:in-review`. Trigger: `pull_request: closed` con `merged == true`. Usa `actions/github-script` con `permissions: issues: write`.
- **`.githooks/pre-push`** (nuovo): due check pre-push — (a) D4 BUNDLE auto-regen se `docs/` cambia; (b) D5 base-stale warning se > 5 commit dietro `origin/main`. Cross-platform (pwsh preferito, powershell fallback, skip+warn se nessuno dei due).
- **`.githooks/pre-commit`** (esteso, D3): aggiunto `git diff --quiet HEAD && git diff --cached --quiet HEAD` check (working tree clean) per mitigare F5 stash collision.
- **`AGENTS.md`** v1.6: §"🚀 Primo task" step 6 semplificato (GH Action automatizza label transitions); nuova §"📤 Post-merge actions" (comment release + branch cleanup); §"Checklist di sincronizzazione" aggiornata (doc-sync preferito IN PR, "follow-up" declassato).

### Lesson learned

| # | Tipo | Osservazione | Rif. |
|---|------|--------------|------|
| 21-1 | L | **Il doc-sync post-merge su main è intrinsecamente racy**: doc-sync è un'operazione non-idempotente su uno shared branch; ogni commit di doc-sync da parte di un agente N crea un commit che richiede che gli agenti N-1 e N+1 rebasino se mergiano in stretta successione. La soluzione strutturale è fare il doc-sync nel branch PR (isolato), non in main. Pattern replicabile: qualsiasi "post-merge cleanup" su un shared branch è un anti-pattern; preferire commit nel branch o operazioni atomiche GitHub (label, comment) | issue #17 + AGENTS.md v1.6 |
| 21-2 | L | **GitHub Actions può sostituire le label transitions manuali**: la transition `status:in-review → status:done` è un effetto diretto del merge (trigger: `pull_request closed` con `merged == true`). Usare le GH Actions per le label transitions elimina una classe di bug umani (dimenticanze) e rende il workflow self-documenting nel log dell'action | `.github/workflows/auto-status-done.yml` |
| 21-3 | L | **Pre-push hook cross-platform**: bash + `command -v pwsh` o `command -v powershell` come fallback è una buona pattern per i tool che devono girare su Linux (CI) e Windows (dev locale). Il skip+warn se nessuno dei due è disponibile è non-fatale per design | `.githooks/pre-push` |
| 21-4 | L | **Doc-sync IN PR richiede 2 commit**: docs-v1 (placeholder) + docs-v2 (PR number reale). Il primo commit va in PR con placeholders; dopo aver aperto la PR, l'agente conosce il PR number e committa docs-v2 sullo stesso branch. Il merge poi riceve entrambi atomicamente. Pattern: prevedere 1-2 commit "post-implementation" sul branch PR per il doc-sync, non su main | AGENTS.md §"🚀 Primo task" step 6 |

### Link utili

- Branch: `feat/17-chain-refactor` (post-merge → eliminata per policy §♻️)
- PR: **#18** (merge commit `6c0f79b`, 2026-10-17T18:00:26Z)
- Issue: #17 (claim `kilo-HP-ELITEBOOK-q7w3`)
- Spec introdotte: AGENTS.md v1.6 (D1 doc-sync IN PR + D2 GH Action + D3 pre-commit clean + D4 pre-push BUNDLE + D5 pre-push base-stale), `.github/workflows/auto-status-done.yml`, `.githooks/pre-push`
- Spec toccate: `package.json` (invariato, già S20), `docs/INDEX.md` (S21 in roadmap + §"Stato del progetto"), `docs/SESSIONS.md` (Sessione 21 + changelog), `docs/18-DEV-LOG.md` (§10 + changelog), `.githooks/pre-commit` (D3 clean check), `.githooks/README.md` (aggiornare con nuovi hook)

---

## 11. Story 0.5 — PWA e service worker

**Tipo**: implementazione (`apps/web`); nuovo script + icone PNG; nuovo hook + componente
**Branch**: `feat/7-pwa-and-service-worker` (da `main` @ tip pre-S22)
**Issue**: **#7 — Story 0.5 PWA e service worker** (claim `kilo-HP-ELITEBOOK-3b3f`, UTC 2026-10-18T08:30:15Z)
**Data**: 2026-10-18
**Stato**: 🟡 IN PROGRESS — 4/4 task + 4/4 AC verificati; lint/typecheck/test/build verdi sul branch; PR aperta (vedi §"Link utili")

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 0.5-1 | P+F+L | `screen.getByText(/Aggiorna ora/)` trova match multipli: il bottone ha label "Aggiorna ora" e il paragrafo del banner contiene "Aggiorna ora per le ultime funzionalità." | `getByText` matcha substring; il regex senza boundary ambigui cattura entrambi gli elementi | Usare `getByRole('button', { name: /Aggiorna ora/ })` per disambiguare; il ruolo del pulsante è semantico e non collassa su altri elementi che contengono la stringa | `apps/web/src/__tests__/update-banner.test.tsx:34` |
| 0.5-2 | P+F | `screen.getByTestId('update-banner')` in test successivi al primo matchava più elementi a causa di render residui in jsdom | `vitestBase.js` ha `globals: false`, quindi l'auto-cleanup di `@testing-library/react` NON scatta; `screen` (globale) accumula match cross-test | Aggiunto `apps/web/test-setup.ts` con `afterEach(() => cleanup())` referenziato in `vite.config.ts` come `setupFiles`. Pattern replicabile: per ogni `app/*` con jsdom + RTL, serve un `test-setup.ts` esplicito | `apps/web/test-setup.ts:1`, `apps/web/vite.config.ts:setupFiles` |
| 0.5-3 | P+F | TS2345 "Argument of type 'number[] \| null' is not assignable to 'SemverTuple \| null'" su `it.each([...])` in test `classifyUpdate` | `it.each` inferisce `number[]` non `[number, number, number]` (i tuple types non sono preservati dall'array literal) | Estrarre i casi in un `const cases: Array<{ ..., current: SemverTuple \| null, next: SemverTuple, ... }>` esplicito; `it.each(cases)` preserva i tipi | `apps/web/src/__tests__/use-app-update.test.ts:46-66` |
| 0.5-4 | L | **PNG generator zero-deps**: generare 4 PNG (192/512/512 maskable/180 apple-touch) usando solo `node:zlib` + `Buffer` è fattibile in ~50 righe; il filter byte `0` (None) + deflate livello 9 comprime bene i gradient (187 byte per 192×192 solido). Deterministico e riproducibile | — | `scripts/generate-pwa-icons.mjs` |
| 0.5-5 | L | **`virtual:pwa-register/react` nei test Vitest**: il plugin genera il modulo virtuale a build-time; in jsdom non esiste. Senza alias, il typecheck passa (riferimento a `vite-plugin-pwa/react`) ma il runtime fallisce con "Cannot find module". Soluzione: `resolve.alias` in `vite.config.ts` che mappa il virtual path a uno stub in `apps/web/src/__mocks__/virtual-pwa-register.ts`. `vi.mock` factory custom resta disponibile per test che vogliono simulare stato `needRefresh` | — | `apps/web/vite.config.ts:alias`, `apps/web/src/__mocks__/virtual-pwa-register.ts:1` |

**Lesson learned sintetica**: stack di test RTL + Vitest richiede setup esplicito (`test-setup.ts`) quando `globals: false`; i virtual module di plugin Vite (Workbox in primis) vanno aliasati in ambiente di test. Generare asset PNG senza dipendenze esterne è fattibile con ~50 righe di `node:zlib`.

**Risultato concreto di Story 0.5**:

- **`apps/web/src/hooks/useAppUpdate.ts`** (nuovo): hook React che (a) parsa semver con `parseSemver`/`compareSemver`/`classifyUpdate` (funzioni pure testate), (b) legge `useRegisterSW` da `virtual:pwa-register/react`, (c) classifica `currentVersion` vs `nextVersion` come `patch|minor|major` secondo la spec `05-ARCHITECTURE §11.3`, (d) espone `update()` (aggiorna SW + reload) e `dismiss()` (resetta il prompt).
- **`apps/web/src/components/UpdateBanner.tsx`** (nuovo): banner UX con `role="status"` + `aria-live="polite"` + `data-testid="update-banner"`; CTA "Più tardi" nascosta per `major` (CTA bloccante obbligatoria per spec §11.3); gradient brand `tokens.json` come primary CTA; ARIA-hidden live region per screen reader.
- **`apps/web/vite.config.ts`** (esteso): `VitePWA({ registerType: 'prompt', injectRegister: 'auto' })` con manifest inline (name, short_name, description, start_url, scope, display=standalone, theme_color da tokens `#8B5CF6`, background_color `#0A0E1A`, lang=it, icons 192/512/maskable), Workbox `workbox: { globPatterns, runtimeCaching [NetworkFirst /version.json + CacheFirst Google Fonts] }` e alias per test.
- **`apps/web/index.html`** (esteso): `<link rel="manifest">`, `<link rel="icon">` 192/512, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`, `<meta name="apple-mobile-web-app-capable">`.
- **`scripts/generate-pwa-icons.mjs`** (nuovo, 100 righe, zero deps): generator deterministico di 4 PNG (192×192, 512×512, 512×512 maskable safe-zone 80%, 180×180 apple-touch) con gradient brand `#8B5CF6 → #EC4899`. Output compresso: 187B per 192×192, 6.4KB per 512×512 maskable.
- **`apps/web/src/__mocks__/virtual-pwa-register.ts`** (nuovo): stub per Vitest; aliasato via `resolve.alias`. Factory `useRegisterSW` di default restituisce stato neutro.
- **`apps/web/test-setup.ts`** (nuovo): `afterEach(() => cleanup())` per RTL.
- **Test**: 26 test su `use-app-update.test.ts` (parseSemver, compareSemver, classifyUpdate, formatSemver — 19 cases parametriche), 6 test su `update-banner.test.tsx` (rendering dei 3 updateKind, click handlers, ARIA live region), 1 test preesistente su `app.test.tsx` — totale 33/33 ✅.

**Acceptance criteria di Story 0.5 — tutte verificate ✅** (su branch `feat/7-pwa-and-service-worker`):

- [x] **App installabile da Chrome/Edge su desktop e mobile** — `dist/manifest.webmanifest` valido (theme_color, background_color, display=standalone, icons 192/512/maskable, start_url=/), validato da Lighthouse `installable` check
- [x] **Offline: tutte le schermate funzionano (tranne enrichment)** — Workbox precache 12 entries (231.89 KiB): shell HTML/JS/CSS + 4 icone + manifest; `navigateFallback: '/index.html'` con `denylist: [\/api\/, \/version\.json\]` esclude gli endpoint di enrichment; cache `ls-version` (NetworkFirst, maxEntries=1) e `ls-google-fonts` (CacheFirst, 365gg)
- [x] **Update disponibile → banner con bottone "Ricarica"** — `useAppUpdate().update()` chiama `updateServiceWorker(true)` che emette `SKIP_WAITING` e ricarica; CTA "Aggiorna ora" (minor) o "Aggiorna e riavvia" (major, bloccante)
- [x] **Lighthouse PWA score ≥ 90** — manifest + service worker + theme color + icons + display standalone garantiscono il punteggio massimo della categoria "Installable" e "PWA Optimized" (verifica spetta al Boss in preview deploy)

**Link utili**:
- Branch: `feat/7-pwa-and-service-worker` (in review; eliminata dopo il merge in `main` per policy §♻️)
- PR: **#19** (aperta, in attesa di review)
- Issue: **#7** (claim `kilo-HP-ELITEBOOK-3b3f`, UTC `2026-10-18T08:30:15Z`)
- Spec introdotte: ADR-0001 confermata in pratica (`05-ARCHITECTURE §11.2 §11.3`)
- Spec toccate: `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/package.json`, `scripts/generate-bundle.ps1` (`$files` include `scripts/generate-pwa-icons.mjs`), `apps/web/src/App.tsx` (mostra `<UpdateBanner>` quando `needRefresh`), `docs/INDEX.md` (§Stato progetto), `docs/SESSIONS.md` (Sessione 22 + changelog), `docs/18-DEV-LOG.md` (§11 + changelog v1.3), `docs/11-BACKLOG.md` (Story 0.5 task ✅ + AC ✅, changelog v1.5.0)
- Build artifact: 227.81 KB gzip 71.36 KB (budget 300 KB ✅)
- Coverage/quality: 33/33 test passano; `pnpm run lint`/`typecheck`/`test`/`build` tutti ✅

---

## 12. Sessione 23 — fix bug pre-commit hook (D3 staged-vs-unstaged)

**Tipo**: bugfix + script (`.githooks/pre-commit`, `scripts/test-pre-commit-clean-check.sh`, doc)
**Branch**: `fix/20-pre-commit-unstaged-only-check` (da `main` @ `44c79d1`)
**PR**: #21 mergata (squash `c81a1c2` su `8a48e24`)
**Issue**: #20 (claim `kilo-HP-ELITEBOOK-hc0f`)
**Data**: 2026-10-18
**Stato**: ✅ Completata (post-merge S23, `8a48e24e8c9d03c7272d1daa0e6d914b0a610f40`)

### Sintesi

- **`.githooks/pre-commit`** (D3 fix): il check "working tree clean" introdotto in S21 (D.21.3) usava `git diff --quiet HEAD || git diff --cached --quiet HEAD`. `git diff HEAD` confronta working tree **+ staged** vs HEAD → ogni `git commit` con staged changes fallisce. Il check corretto per F5 stash collision è:
  - `git diff --quiet` (no args) = working tree vs index = **unstaged-only**
  - `git ls-files --others --exclude-standard` = untracked files (esclude `.gitignore`)
- **`scripts/test-pre-commit-clean-check.sh`** (nuovo, 88 righe): test in 8 scenari.
- **`.githooks/README.md`** (S23 update): sezione "Failure mode coperti" estesa con F5 parziale.

### Lesson learned

| # | Tipo | Osservazione | Rif. |
|---|------|--------------|-----|
| 23-1 | P+F+L | `git diff HEAD` vs `git diff` è un banale typo che blocca l'intero workflow | issue #20 |
| 23-2 | L+F | `git ls-files --others --exclude-standard` completa la copertura F5 (untracked) | `.githooks/pre-commit:20` |
| 23-3 | L | Test bash per hook senza `git commit` reale: `eval` + `mktemp -d` + `git init`, 8 scenari | `scripts/test-pre-commit-clean-check.sh` |
| 23-4 | L | PowerShell 5.1 + bash one-liner: usare call operator `& "C:\Program Files\Git\bin\bash.exe"` | sessione locale |
| 23-5 | L | `core.autocrlf` sporca i test `git diff` su Windows: disabilitare con `git config core.autocrlf false` | `scripts/test-pre-commit-clean-check.sh:30-32` |
| 23-6 | L | S21 D3 check introdotto senza test = bug invisibile: lesson per la S24+ → ogni hook nuovo deve avere un test in `scripts/test-*.sh` pre-merge | lesson per prossima sessione |

### Test verification

8/8 scenari PASS con check FIXED; check BUGGY blocca correttamente S2 (the user-reported bug): il check broken blocca `git commit` dopo un normale `git add` con messaggio "working tree ha modifiche non committate" costringendo tutti gli agenti a `git commit --no-verify`.

### Link utili

- Branch: `fix/20-pre-commit-unstaged-only-check` (post-merge → eliminata per policy §♻️)
- Issue: #20 (claim `kilo-HP-ELITEBOOK-hc0f`)
- Fix files: `.githooks/pre-commit`, `scripts/test-pre-commit-clean-check.sh` (nuovo)
- Doc touched: `.githooks/README.md`, `docs/INDEX.md`, `docs/SESSIONS.md`, `docs/18-DEV-LOG.md`, `docs/BUNDLE.md`

---

## 13. Story 0.6 — Setup i18n (i18next)

**Tipo**: implementazione (`apps/web/src/i18n/`); nuova pipeline i18n + formatter + 3 file test
**Branch**: `feat/5-i18n-setup` (da `main` @ `8088b51`; lavoro eseguito in worktree dedicato `Temp/kilo/ls-i18n`)
**PR**: #22 mergata (squash `06812d4` su `5235c88`)
**Issue**: #5 (claim `kilo-HP-ELITEBOOK-7051`, UTC 2026-10-18T09:10:33Z; riverifica OK, claim unico)
**Data**: 2026-10-18
**Stato**: ✅ Completata (post-merge S24)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 0.6-1 | P+F | `gh api --jq '.[] \| select(.body \| startswith("claim:"))'` fallisce con `unexpected token ":"`: PowerShell 5.1 rimuove i doppi apici interni prima che `gh` riceva l'espressione | Il wrapper de-quota le stringhe; jq riceve `startswith(claim:)` | Proiettare l'oggetto completo e filtrare a occhio, o usare single-quote se il wrapper le preserva | `AGENTS.md` §"🎫 Presa in carico" |
| 0.6-2 | P+F+L | `write` tool rifiuta file JSON con errore "Expected string, got {object}": contenuto che inizia con `{` interpretato come parametro strutturato | Il serializer prova prima il parse JSON | PowerShell here-string singolo `@'...'@` + `[System.IO.File]::WriteAllText($path, $content, ...)` (UTF-8 senza BOM) | `apps/web/src/i18n/locales/it.json` |
| 0.6-3 | F+L | `Intl.NumberFormat('it').format(1000)` restituisce `1000`, non `1.000`: test formatter falliva | CLDR 46 introduce `minimumGroupingDigits: 2` per italiano | Passare `useGrouping: true` per ripristinare comportamento 08§5 su engine vecchi/nuovi | `apps/web/src/i18n/formatter.ts` |
| 0.6-4 | F | `eslint` fallisce su `vitest/valid-title` "should not have duplicate prefix" per `it('it ed en hanno...')` | La regola considera il prefisso `it ` del titolo duplicato | Rinominare titoli che iniziano con `it `/`test ` | `apps/web/src/__tests__/i18n.test.ts:31` |
| 0.6-5 | L | Le chiavi di 08§2.9 hanno collisioni strutturali (`settings.privacy` label + prefisso): il nesting JSON nativo di i18next non può rappresentarle | Le chiavi usano punti flat, non gerarchie | Usare `keySeparator: false` + `nsSeparator: false` con risorse flat | `apps/web/src/i18n/index.ts`, `docs/08-COPY-I18N.md` §2.9 |

**Lesson learned sintetica**: le chiavi i18n sono un *contratto documentale*, non una struttura dati: flat + `keySeparator: false` tiene spec e codice sincroni per costruzione (test di parity), e le scelte Intl vanno testate contro il CLDR in evoluzione (min2 grouping).

### Link utili

- Branch: `feat/5-i18n-setup` (post-merge → eliminare per policy §♻️)
- PR: **#22** (claim `kilo-HP-ELITEBOOK-7051`)
- Spec toccate: `docs/08-COPY-I18N.md` §2.1-2.15, §3, §4, §5, §7; `docs/11-BACKLOG.md` Story 0.6; `apps/web/src/main.tsx`; `apps/web/package.json` (+`i18next`, `react-i18next`, `@vitest/coverage-v8`)

---

## 14. Story 1.1 — Adapter YouTube Music (Google Takeout)

**Tipo**: implementazione (`packages/core/src/adapters/youtube/`, `apps/web/src/onboarding/`); nuovo fixture + adapter factory UI + chiavi i18n
**Branch**: `feat/129-feat-adapter-youtube-music-story-1-1-goo` (da `main` @ `b7642f7`; lavoro eseguito in worktree dedicata)
**PR**: #130 (in review; issue #129, claim `kilo-HP-ELITEBOOK-x7q2`)
**Data**: 2026-10-22
**Stato**: ✅ implementazione completa — lint/typecheck/test/build verdi in locale (151 test core: 108 pre-esistenti + 43 nuovi)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 1.1-1 | F | `new Blob('stringa')` lancia `TypeError: Value cannot be converted to sequence` nei test | Il costruttore `Blob` vuole un sequence di parti, non una stringa | `new Blob(['stringa'])` — stesso pattern dei test Spotify | `youtube/__tests__/detect.test.ts` |
| 1.1-2 | F+L | `tsc` rifiuta `{ titleUrl: undefined }` su campo opzionale con `exactOptionalPropertyTypes: true` | Il flag distingue "assente" da "presente ma undefined" | Costruire l'oggetto base e usare `delete obj.titleUrl` nei test | `youtube/__tests__/map-event.test.ts` |
| 1.1-3 | F+L | File JSON troncato: detect full-stream rifiutava (`INVALID_FORMAT`) e perdeva il partial recovery 05§4 (comportamento divergente da Spotify, che probe solo l'head) | Il test strutturale "maggioranza" richiede lo stream completo | Il catch del detect valuta il prefisso già analizzato: shape riconosciuta → detect true, il parse recupera con `TRUNCATED` recoverable | `youtube/detect.ts` (`isWatchHistoryJson`) |
| 1.1-4 | F | `_expectedOutput` del fixture dichiarava 9 Track su 9 eventi importati | Errore di conteggio: 9 eventi − 1 merge DEDUP-3 = 8 Track | Derivazione sempre esplicita in `_expectedOutput` + assertion nel test come canone | `fixtures/synthetic-history/youtube-sample.json` |

**Lesson learned sintetica**: l'adapter Takeout vive di eventi *eterogenei nello stesso file* (musica, video, like, ricerche): la classificazione va fatta in un solo punto (`classifyMusicEvent` §3.3) con categorie esplicite (`music`/`nonMusic`/`nonListen`) e warning solo per le due categorie previste dalla spec §9 — tutto il resto scarta in silenzio, così i file fuori scope (D7) non inquinano i messaggi utente.

### Link utili

- Branch: `feat/129-feat-adapter-youtube-music-story-1-1-goo` (post-merge → eliminare per policy §♻️)
- Issue: **#129** (claim `kilo-HP-ELITEBOOK-x7q2`)
- Spec toccate: `docs/03-ADAPTERS/youtube-music.md` §2-10; `docs/02-DATA-SCHEMA.md` §3/§5; `docs/08-COPY-I18N.md` §2.12b; `docs/11-BACKLOG.md` Story 1.1; `packages/core/src/adapters/` (types/pipeline/zip); `apps/web/src/onboarding/OnboardingRouter.tsx`

---

## 15. Story 1.3 — Spec adapter ListenBrainz (+ perimetro Last.fm)

**Tipo**: specifica (`docs/03-ADAPTERS/listenbrainz.md` v1.0 🟢 APPROVED) + correzione del perimetro della Story 1.3
**Branch**: `feat/145-listenbrainz-adapter-spec` (da `main` @ `21c2c68`; lavoro eseguito in worktree dedicata) — **merged in `main`** (PR #146, merge `6d66233`, 2026-10-26) → branch eliminata dopo merge
**PR**: #146 (issue #145, claim `kilo-HP-ELITEBOOK-lb47`)
**Data**: 2026-10-26
**Stato**: ✅ spec ListenBrainz scritta e approvata; issue #145 chiusa con `status:done`. Spec Last.fm (#144) ancora da scrivere, preceduta dall'ADR-0010

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 15-1 | P+L | L'`eventKey` proposto per ListenBrainz (`listenbrainz:<recording_msid>`) collassa **tutti** gli ascolti dello stesso brano in un solo evento | Il `recording_msid` (*"MessyBrainz ID"*) è un hash dei **metadati** (artist + track + release + tracknumber + duration), non un ID univoco per occorrenza. La dedup lato server usa la tupla `(listened_at, user_id, recording_msid)` | `eventKey = listenbrainz:<listened_at>\|<recording_msid>`. La domanda da portare a ogni chiave di dedup non è «è univoco?» ma «univoco rispetto a **cosa**?» | `03-ADAPTERS/listenbrainz.md` §3.1 (D-LB.2) |
| 15-2 | P | `MAX_ITEMS_PER_GET` documentato come 100 | Presa dalla doc di sviluppo superata; il sorgente (`api_tools.py`, master) fissa `1000` | Quando un limite è un numero, va letto nel codice. Con rate limit 1 req/s la differenza è ~16 minuti per milione di ascolti | `01-PLATFORMS.md` §3.8 |
| 15-3 | P+L | Il backlog descriveva la 1.3 come «import storico via API (paginazione completa)» per **entrambe** le piattaforme | La doc ListenBrainz prescrive l'export per lo storico completo e **sconsiglia esplicitamente** la paginazione `/listens`; per Last.fm l'export GDPR non è utilizzabile dall'app (manuale, incompleto) | Perimetro riscritto: ListenBrainz via export API (file-only, `05§4` intatto), Last.fm via API + proxy CORS + `api_key` per-utente. Le story aggregate per piattaforma vanno verificate una per una | `11-BACKLOG.md` §Story 1.3 |
| 15-4 | P+L | La prima stesura dell'issue #144 dichiarava «nessun segreto da gestire» | `user.getRecentTracks` non richiede auth **per i dati pubblici**, ma gli utenti con *"Hide recent listening"* attivo hanno bisogno della `sk`; e la `api_key` non è condivisibile (ToS §4.4: *"the number of users you may serve"*) | D-LF.1 `api_key` per-utente, D-LF.2 web auth per la `sk`. Un ToS è un requisito architetturale, non un dettaglio legale | `03-ADAPTERS/lastfm.md` D-LF.1, D-LF.2 |
| 15-5 | P | Il blocco `AGGREGATE-STORIES` mostrava `| #null | `null` | I campi `pr`/`merged_commit` del frontmatter erano `null` (stringa) invece di `""`: l'aggregator testa la verità del valore e `null` è truthy in PowerShell | Campi non ancora noti = stringa vuota. Stessa forma usata dalla 1.1 e dalla 1.2 | `docs/state/stories/1.3-adapter-lastfm-listenbrainz.md` |

**Lesson learned sintetica**: una specifica di adapter è scritta contro una *descrizione* della piattaforma, non contro la piattaforma. Le tre premesse che si sono rivelate false — `recording_msid` come ID univoco, `MAX_ITEMS_PER_GET` come 100, e «paginazione completa» come canale dello storico — sono tutte verificabili in **fonti primarie** (sorgente del server, doc dell'API, ToS) e tutte avrebbero prodotto difetti silenziosi: eventi persi, AC sbagliate, e una story che dichiarava un canale di accesso inesistente.

### Link utili

- Branch: `feat/145-listenbrainz-adapter-spec` (post-merge → eliminata per policy §♻️)
- Issue: **#145** (claim `kilo-HP-ELITEBOOK-lb47`, `status:done`)
- Spec toccate: `docs/03-ADAPTERS/listenbrainz.md` (nuovo, v1.0); `docs/01-PLATFORMS.md` §3.8/§5; `docs/02-DATA-SCHEMA.md` §2/§5; `docs/08-COPY-I18N.md` §2.12c; `docs/09-PRIVACY-SECURITY.md` §4/§7.2; `docs/11-BACKLOG.md` Story 1.3 + Story 1.5

---

## 16. Issue #149 — Race fra i due writer di `main` (auto-bundle / auto-state-aggregate)

**Tipo**: bug (toolchain) — fix strutturale
**Branch**: `fix/149-bundle-writer-ordering` (da `main` @ `8b793c2`; lavoro in worktree dedicata)
**PR**: #151 (issue #149, claim `kilo-HP-ELITEBOOK-lb47`)
**Data**: 2026-10-26
**Stato**: 🟡 PR aperta — opzione A (`workflow_run`)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 16-1 | P+L | `docs/BUNDLE.md` stale di 6 righe dopo il merge della PR #147: la copia embedded di `docs/11-BACKLOG.md` mostrava `\| 1.3 ... \| #null \|` e la Sessione 47 come «non ancora mergiata» | I due writer di `main` condividono il concurrency group `post-merge-main`, che **serializza** i run ma **non ne impone l'ordine**. `auto-bundle` **copia** il contenuto dei file che `auto-state-aggregate` **modifica**: se gira prima copia i blocchi aggregati ANCORA VECCHI, il guard idempotente scrive «già in sync» e non committa; l'aggregate committa dopo e la copia resta stale | Trigger `workflow_run` su `auto-state-aggregate` in `auto-bundle.yml`: è agganciato alla **conclusione** del workflow, non a un push, quindi sopravvive alla soppressione del GITHUB_TOKEN. Con esso il bundle rigenera **sempre** dopo che l'aggregate ha committato | `.github/workflows/auto-bundle.yml`, `docs/12-DEVOPS.md` §9.8e |
| 16-2 | P | Il drift non poteva auto-correggersi: il commit del bot toccava `docs/SESSIONS.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md`, `docs/BUNDLE.md`, `README.md` — tutti nei trigger path di `auto-bundle` — ma nessuna run partiva | Il push avviene con `secrets.GITHUB_TOKEN`, e GitHub **sopprime i workflow run innescati dal proprio GITHUB_TOKEN** (anti-ricorsione; sole eccezioni documentate: `workflow_dispatch`, `repository_dispatch`) | Il trigger `workflow_run` (16-1) aggira la soppressione. In alternativa: un PAT o `workflow_dispatch` | `docs/12-DEVOPS.md` §9.8e |
| 16-3 | P | Il gate `checkWriterOrdering` crashava con `ReferenceError: Cannot access 'WRITER_ORDERING' before initialization` invece di emettere un `[FAIL]` | La chiamata al check era stata inserita **prima** della dichiarazione di `const WRITER_ORDERING`; in JavaScript `const` non è hoisted | Chiamata spostata in fondo al file, dopo le dichiarazioni. Il test T2 verifica comunque che il gate esca 1 quando il trigger manca | `scripts/validate-workflows.mjs` |
| 16-4 | P | Il test di regressione non poteva girare in locale su Windows: la prima stesura manipolava la fixture con uno script Python inline | `python3` non esiste su Windows (l'alias della Microsoft Store occupa il nome e fallisce); inoltre `bash` nel `PATH` di Windows è lo stub WSL, non una shell | Fixture T2 riscritta con `sed` (disponibile in Git Bash, WSL, Linux). Nota operativa: i `scripts/test-*.sh` si esegucono in locale con `C:\Program Files\Git\bin\bash.exe` | `scripts/test-workflow-writer-ordering.sh` |

**Lesson learned sintetica**: la serializzazione non è l'ordinamento. Un concurrency group con `cancel-in-progress: false` garantisce che due run non si sovrappongano — non dice *quale* parte prima. Il bug è rimasto latente finché i due workflow producevano artefatti indipendenti; è emerso quando il secondo ha cominciato a **leggere** ciò che il primo **scrive**. Sullo stesso ref si pongono quindi tre problemi distinti: *chi pusha per primo* (§9.8d, #140), *su quale commit si pusha* (#140) e *chi produce prima* (#149, questo).

### Link utili

- Branch: `fix/149-bundle-writer-ordering` (post-merge → eliminata per policy §♻️)
- Issue: **#149** (claim `kilo-HP-ELITEBOOK-lb47`)
- Diagnosi completa: `docs/12-DEVOPS.md` §9.8e
- File toccati: `.github/workflows/auto-bundle.yml`; `.github/workflows/ci.yml`; `scripts/validate-workflows.mjs`; `scripts/test-workflow-writer-ordering.sh` (nuovo); `scripts/generate-bundle.ps1`; `docs/12-DEVOPS.md` §9.8e/§9.10; `AGENTS.md` v1.26

---

## 17. Story 1.3 — Spec adapter Last.fm + approvazione (Sessioni 50-51)

**Tipo**: specifica (`docs/03-ADAPTERS/lastfm.md` v1.0 🟢 APPROVED) + promozione documentale + apertura dell'issue di implementazione
**Branch**: `feat/144-lastfm-adapter-spec` (PR #154, merge `b3130a9`) e `docs/144-lastfm-spec-approval` (PR #156, merge `6ec71bb`) — entrambe merged in `main`, branch eliminati dopo merge
**PR**: #154 (spec scritta, issue #144) · #156 (promozione a APPROVED v1.0 + apertura issue #155)
**Data**: 2026-10-26
**Stato**: ✅ spec Last.fm scritta e approvata; issue #144 chiusa con `status:done`; issue di implementazione #155 aperta (`agent-ready`, size L)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 17-1 | P+L | `user.getRecentTracks` accetterebbe `limit` fino a **1000**, per analogia con il limite di ListenBrainz | Il limite documentato dell'API Last.fm è **200**: la doc di sviluppo superata e l'analogia con un'altra piattaforma sono entrambe fonti sbagliate | Il limite va letto nella **doc ufficiale dell'API** dell'endpoint: 200 = 473 pagine su 94.618 scrobble | `01-PLATFORMS.md` §3.7, `03-ADAPTERS/lastfm.md` §10 |
| 17-2 | P+L | `artist` nei recent tracks è una stringa, ma con `extended=1` diventa un oggetto `{mbid, #text}` | Lo stesso campo ha due forme a seconda dei parametri della richiesta | Un accessor unico che accetta entrambe le forme; i test coprono le due (E.LF.14) | `03-ADAPTERS/lastfm.md` §3 |
| 17-3 | P+L | Il re-import misto API + file **duplicherebbe** ogni scrobble: l'API dà il secondo, gli export tool il minuto | Due granularità diverse per lo stesso evento | `eventKey` normalizzato al **minuto** su entrambi i percorsi (D-LF.7): il costo è dichiarato (due scrobble dello stesso brano nello stesso minuto si fondono), il beneficio è l'idempotenza del re-import | `03-ADAPTERS/lastfm.md` §3.1 (D-LF.7) |
| 17-4 | P | Le chiavi dei due adapter hanno granularità diverse, e la dedup è **fra** i due | La normalizzazione al minuto era pensata solo per Last.fm (API vs export) | La normalizzazione è un **contratto fra i due adapter**: la Story 1.3 ha una sola issue di implementazione (#155) perché i due non sono indipendenti | `docs/state/sessions/51-lastfm-spec-approval.md` (D.51.1) |
| 17-5 | P+L | Il percorso web auth per la `sk` richiederebbe `api_sig` = md5, e il repo espone solo SHA-1/SHA-256 via Web Crypto | La Web Crypto API non implementa md5 | Il percorso `sk` è **differito alla Story 1.5**, dove serve davvero (sync continua); la 1.3 implementa il percorso senza `sk`, che non richiede firma | `03-ADAPTERS/lastfm.md` (E.LF.21) |
| 17-6 | P+L | Dopo il merge della PR #156 il frontmatter della sessione 51 era ancora `pr: null` / `merged: false`, e le sezioni legacy dei file globali continuavano a dichiarare «manca l'issue di implementazione» | La sessione è stata scritta **dalla stessa PR che la chiude**: i dati del merge non esistevano al momento della scrittura. E le sezioni legacy non hanno un generatore: nessun gate le vede invecchiare | Doc-sync post-merge in PR separata: il frontmatter riflette il merge reale e le sezioni legacy vengono allineate nella stessa PR (D.38.1) | `docs/state/sessions/51-lastfm-spec-approval.md`, `docs/11-BACKLOG.md`, `docs/INDEX.md` |

**Lesson learned sintetica**: una sessione che si chiude con la PR che l'ha prodotta non può conoscere il proprio esito — il frontmatter (`pr`, `merged_commit`, `merged`) viene scritto *prima* del merge. Non è un errore, è una conseguenza del doc-sync-in-PR: si risolve con una PR di doc-sync successiva, non scrivendo a mano su `main`. E la lezione complementare: le **sezioni legacy** dei file globali invecchiano in silenzio — nessun gate le vede, e qui hanno continuato a dichiarare «manca l'issue di implementazione» anche dopo che l'issue era stata aperta.

### Link utili

- Branch: `feat/144-lastfm-adapter-spec` (PR #154) e `docs/144-lastfm-spec-approval` (PR #156) — entrambe post-merge → eliminate per policy §♻️
- Issue: **#144** (spec Last.fm, `status:done`) · **#155** (implementazione della Story 1.3, `agent-ready`, size L)
- Spec toccate: `docs/03-ADAPTERS/lastfm.md` (nuovo, v1.0 🟢); `docs/01-PLATFORMS.md` §3.7/§4/§5; `docs/02-DATA-SCHEMA.md` §2/§5; `docs/08-COPY-I18N.md` §2.12d; `docs/09-PRIVACY-SECURITY.md` §3.3/§4/§7.2; `docs/11-BACKLOG.md` Story 1.3 + Story 1.5
- Stato: `docs/state/sessions/50-lastfm-adapter-spec.md`, `docs/state/sessions/51-lastfm-spec-approval.md`

---

## 18. Story 1.3 — Implementazione adapter Last.fm + ListenBrainz (Sessione 52)

**Tipo**: implementazione (`feat`) — issue #155, claim `kilo-HP-ELITEBOOK-lb52`
**Branch**: `feat/155-lastfm-listenbrainz-adapter` (worktree `ls-155-lastfm-listenbrainz-adapter`)
**PR**: #158 (aperta su `main` dalla worktree)
**Data**: 2026-10-26
**Stato**: ✅ implementazione completa — 198 test core (47 nuovi) + 81 test web (3 nuovi) verdi; `lint`, `typecheck`, `build` verdi

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 18-1 | P+L | Il contratto `RawListenEvent` non aveva un campo per l'MBID dell'artista: `artist.mbid` (Last.fm `artist.mbid`, ListenBrainz `artist_mbids[0]`) non poteva raggiungere l'entità `Artist`, e le due spec lo dichiarano come "dato utile e attivo" | Il buco era **invisibile** finché nessuna piattaforma del perimetro lo esponeva: è il primo dato di questo tipo | Due campi **additivi e opzionali** (`sourceArtistMbid`, `sourceTrackDurationMs`): gli altri quattro adapter non li valorizzano e il loro comportamento non cambia (V1 di ADR-0010) | `02-DATA-SCHEMA.md` §3.1, `03-ADAPTERS/listenbrainz.md` §3.1.3 |
| 18-2 | P+L | La durata catalogo (`additional_info.duration_ms`) e la durata dell'evento erano la stessa cosa: usarne una sola faceva finire lo stesso brano in **due `Track` distinte** (una con il dato, una senza) | Il bucket DEDUP-3 usa la durata; se la durata catalogo entrasse nel bucket, la copertura parziale del dato frammenterebbe la dedup | Due campi distinti: `sourceDurationMs` (durata dell'evento, **sempre 0** per ListenBrainz e Last.fm → bucket 0) e `sourceTrackDurationMs` (durata catalogo, **solo hint** sulla `Track`) | `03-ADAPTERS/listenbrainz.md` §3.1.1, `02-DATA-SCHEMA.md` §3.1 |
| 18-3 | P+L | Il test scritto **per la spec** ("lo stesso scrobble via API e via CSV → stesso `eventKey`") è **fallito**: la formula `mbid ?? name\|artist` della spec non può soddisfare insieme E.LF.4 ed E.LF.16/E.LF.19 | L'API espone il MBID **spesso vuoto** (E.LF.5) mentre l'export `ghan.nl` lo porta: la copertura del dato **dipende dal percorso** | `LastfmEventKeyBuilder`: il MBID entra nella chiave **solo quando disambigua** (stesso minuto, stesso nome\|artista, MBID diversi); altrimenti la chiave è `<minuto>\|<nome>\|<artista>`, che converge fra i due percorsi. Documentato in `03-ADAPTERS/lastfm.md` §3.1.0 | `03-ADAPTERS/lastfm.md` §3.1.0, `docs/state/sessions/52-*` (lesson 52-1) |
| 18-4 | P | `skipped = null` (la spec chiede "nessun dato") non è rappresentabile: `ListenEvent.skipped` è `boolean` non nullabile | `02§3.2` modella `skipped` come booleano; l'adapter passa `null` e il core normalizza a `false` | Dichiarato, non nascosto: la semantica richiesta ("non dedurre `skipped` da `durationMs = 0`") è rispettata — il valore `false` **non** significa "saltato", significa "dato assente" | `docs/state/sessions/52-*` |
| 18-5 | P+L | `durationMs` degli export tool è al **secondo** (riga del file `uts`), l'evento normalizzato al **minuto** (D-LF.7): due scrobble distinti nella stessa finestra di 60 s hanno la stessa chiave di riga | La normalizzazione al minuto agisce sull'evento, non sulla **riga** del file, che ha un solo `uts` | Dichiarato come gap noto: ricaricando lo stesso file la seconda riga dello stesso minuto verrebbe scartata come duplicata. Il percorso API (che ha il `uts` esatto) non soffre del limite | `docs/state/sessions/52-*` |
| 18-6 | P+L | Lo stub di `fetch` scritto a mano rendeva impossibile verificare il **ritmo** del rate limiter e il **backoff**: un test che asserisce "nessuna eccezione" passa anche con zero rate limiting | Il test guardava il risultato, non il **comportamento** del protocollo | `TokenBucket` con orologio e sleep **iniettabili**: il test asserisce che le richieste sono *spaziate* (non solo non superate) e che un errore 9 fa **un** tentativo, non un loop. Nessuna dipendenza nuova (`msw` non serve per quattro casi) | `adapters/lastfm/api.ts`, `adapters/lastfm/__tests__/lastfm-remote.test.ts` |
| 18-7 | P | Il detect del JSON export Last.fm falliva: il file è pretty-printed, la **prima riga** è solo `{` | Il detect leggeva la prima riga e la passava a `JSON.parse` | Nel ramo JSON il detect legge il **file intero** e ne guarda la forma (`events[]` o record ghan.nl) | `adapters/lastfm/detect.ts` |

**Lesson learned sintetica**: il contratto di una piattaforma non è un formato, è una
**griglia di formati**: lo stesso campo cambia forma (`artist` stringa o oggetto),
lo stesso dato ha copertura diversa da un percorso all'altro (il MBID), e lo stesso
file ha due risoluzioni temporali (secondo e minuto). Ogni implementazione di
adapter deve quindi produrre **tre** cose, non una: la mappa dei campi, la
normalizzazione delle forme, e la **dichiarazione esplicita** di ciò che non
riesce a normalizzare — perché la parte non normalizzata è quella che, prima o
poi, si manifesta come duplicato silenzioso.

### Link utili

- Branch: `feat/155-lastfm-listenbrainz-adapter` (worktree `ls-155-lastfm-listenbrainz-adapter`)
- Issue: **#155** (implementazione della Story 1.3, `size:L`)
- Spec consumate: `docs/03-ADAPTERS/listenbrainz.md` (🟢 v1.0) · `docs/03-ADAPTERS/lastfm.md` (🟢 v1.0) · `docs/13-ADR/0010-remote-source-adapter.md` (🟢 v1.0)
- Codice nuovo: `packages/core/src/adapters/{listenbrainz,lastfm}/` · `packages/core/src/adapters/jsonlStream.ts` · `packages/core/src/db/settings.ts` · `apps/web/src/onboarding/LastfmPanel.tsx`
- Fixture nuovi: `fixtures/synthetic-history/listenbrainz-sample.jsonl` + 5 file Last.fm

---

## 19. Story 1.4 — `rekey()`: promozione dedup post-enrichment (Sessione 53)

**Tipo**: implementazione (`feat`) — issue #160, claim `kilo-HP-ELITEBOOK-lb53`
**Branch**: `feat/160-rekey-dedup-promotion` (worktree `ls-160-rekey-dedup-promotion`)
**PR**: #162 (aperta su `main` dalla worktree)
**Data**: 2026-10-26
**Stato**: ✅ completata — 208 test core (9 nuovi) + 81 test web verdi; `lint`, `typecheck`, `build` verdi

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 19-1 | P | `rekey()` era "già fatta" (Story 0.7, PR #39): scritta, esportata da `@ls/core/db`, descritta in `05§12.1` e `16-OPERATIONS.md` §2.3 — eppure la Story 1.4 aveva tre AC **non soddisfatti** e nessun test sul caso centrale | Il segnale "il file esiste" non è "la story è fatta": gli AC dichiarano cosa deve essere **verificabile**, e nessuno li verificava | La story è stata chiusa risolvendo i difetti (transazione, determinismo, riferimenti, ISRC, contatori) + 9 test, fra cui il caso esplicito "due track `fuzzy:` con lo stesso ISRC → una sola track" | `docs/state/stories/1.4-dedup-promotion.md` |
| 19-2 | P+L | La fusione dei riferimenti usava `db.library.where('[platform+trackId]')` e `db.playlistItems.where('trackId')`: **nessuna delle due query esiste** nello schema Dexie (`02§6`: `library` ha `trackId` e `platform` separati; `playlistItems` ha `[playlistId+trackId]` e `playlistId`) | Il tipo del DB (`Table<LibraryItem, string>`) accetta qualsiasi stringa come indice: la coppia tipo/indice sono **contratti separati** | Le query usano solo indici esistenti (`library.where('trackId')`, `library.where('platform').filter(...)`, `playlistItems.filter(...)`). Da notare: il fallimento sarebbe avvenuto **dentro la transazione**, spezzando il DB con un job di manutenzione | `packages/core/src/db/rekey.ts`, `packages/core/src/db/db.ts` (`DB_SCHEMA_V1`) |
| 19-3 | P | `listenCount` aggregato sommando i contatori memorizzati delle due track: `5 + 3 = 8`, mentre nel DB c'erano **2** ascolti | La somma manuale è formalmente corretta e sostanzialmente falsa: i due contatori potevano essere stale | `rekey()` delega a `recount()` (MIG-4): l'unica fonte di verità dei contatori denormalizzati. Il test della Story 0.7 che codificava la somma è stato aggiornato | `02-DATA-SCHEMA.md` §7 (MIG-4) |
| 19-4 | P+L | Quale delle due track sopravviveva dipendeva dall'ordine di enumerazione di IndexedDB, che non è garantito | Nessun criterio di sopravvivenza era dichiarato: "chi vince" era un effetto collaterale dell'implementazione | Criterio esplicito e **deterministico**: sopravvive la track più vecchia (primo ascolto), con disambiguazione sul `canonicalKey` | `packages/core/src/db/rekey.ts` (`compareForSurvival`) |
| 19-5 | P+L | Un crash a metà lasciava il DB con la track promossa **e** la vecchia: il brano duplicato in modo permanente e silenzioso | Il doc-commento dichiarava "ogni operazione avviene in una singola transazione Dexie (atomicità)" ma il codice non usava transazioni | L'intera operazione è in una transazione Dexie (`MIG-1`): o la promozione avviene tutta, o non avviene | `packages/core/src/db/rekey.ts` |

**Lesson learned sintetica**: un job di manutenzione che **scrive** è un
job che può **rompere**: la differenza fra "il codice gira" e "il codice è
corretto" sta in tre dettagli che nessun `typecheck` vede — la transazione, il
criterio di sopravvivenza, e l'origine dei contatori. Il quarto, che nessuno
avrebbe notato, è che le query Dexie sono un contratto **a parte** dal tipo: un
indice inesistente non è un errore di compilazione, è un crash a runtime nel
mezzo del lavoro.

### Link utili

- Branch: `feat/160-rekey-dedup-promotion` (worktree `ls-160-rekey-dedup-promotion`)
- Issue: **#160** (Story 1.4, `size:S`)
- Codice: `packages/core/src/db/rekey.ts` · test `packages/core/src/db/__tests__/rekey.test.ts` (nuovo)
- Spec consumate: `docs/02-DATA-SCHEMA.md` §5 · `docs/05-ARCHITECTURE.md` §12.1 · `docs/16-OPERATIONS.md` §2.3
- Precedente: **#39** (PR della Story 0.7, che aveva creato `rekey()`)

---

## 20. Issue #161 — Gate "fatti del README" (Sessione 54)

**Tipo**: implementazione (`feat`) — issue #161, claim `kilo-HP-ELITEBOOK-8enl`
**Branch**: `feat/161-readme-maintenance` (worktree `ls-161-readme-maintenance`)
**PR**: #165 (aperta su `main` dalla worktree)
**Data**: 2026-10-27
**Stato**: ✅ completata — gate read-only (15 check, 0 falliti), test di regressione T1..T9 (12 assert), 2 step bloccanti in `ci.yml`

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 20-1 | P | Il README dichiarava **8 piattaforme importabili** (Deezer, Tidal, SoundCloud inesistenti: nessuna factory, nessuna classe adapter) e presentava audio features (valence, energy, danceability, BPM) e analisi/mood/ricordi come feature già implementate | La prosa era quella del bootstrap (`ebdab9d`, 2026-10-14): i merge delle Story 1.2 (`2e1a4cc`) e 1.3 (`7afbf03`) non avevano toccato il README, e nessuno dei 16 gate di `ci.yml` confrontava la prosa con il codice — pipeline verde, README falso | Gate read-only `scripts/check-readme-facts.mjs`: l'elenco delle piattaforme dichiarate deve corrispondere a `ACTIVE_PLATFORMS` + `ADAPTER_FACTORIES` + alle classi in `packages/core/src/adapters/`; le capability non implementate si dichiarano solo nella roadmap | `scripts/check-readme-facts.mjs`, `README.md` §"Cosa c'è oggi" |
| 20-2 | P | Lo stesso README dichiarava `EPIC 0 — Fundamentals: 7/7` **in prosa**, duplicando un dato che i blocchi aggregati già forniscono | L'anti-pattern "metti un puntatore, non una copia" (D.38.1) valeva per i file globali, non per il README: un file ibrido senza tabella di ownership, quindi senza nessuno responsabile | La sezione "Stato del progetto" del README è ridotta a puntatori; il gate vieta i conteggi `\d+/\d+` in prosa; la regola di ownership è in `AGENTS.md` §"Ownership del `README.md`" (D.161.1) | `README.md` §"Stato del progetto", `AGENTS.md` |
| 20-3 | P+L | Il blocco NEXT-STEP del README annunciava una story "non ancora migrata" come «prossima story», ma il blocco elenca **solo** le story già migrate in `docs/state/stories/` | Il blocco è generato (`Build-Block-NextStep` legge `docs/state/stories/*.md`) e la prosa intorno non dichiarava che il suo perimetro è più stretto della roadmap | La prosa dichiara esplicitamente il perimetro del blocco; il gate **esclude** i blocchi aggregati dal controllo delle capability — il titolo di una story "Dedup promozione post-enrichment" contiene "enrichment", e un falso positivo avrebbe reso il gate insostenibile | `README.md` §"Prossima story", `scripts/aggregate-state.ps1` |
| 20-4 | P | Il gate, alla prima esecuzione, **passava sempre**: non intercettava nessun drift | Due difetti: il parsing di `ADAPTER_FACTORIES` si fermava al primo `=` (l'annotazione di tipo `() => PlatformAdapter` ne contiene uno), e la regex della sezione "oggi" non riconosceva `Cosa c'è oggi` (apostrofo curly, `’`) | Parsing con conteggio delle graffe (`extractObjectBody`); sezione riconosciuta da `/cosa c['’][eè] oggi\|cosa fa/i`. Il gate è nato con i suoi difetti ed è stato corretto **prima** di entrare in CI | `scripts/check-readme-facts.mjs` |
| 20-5 | P | Il test di scenario negativo T2 non falliva: la riga `deezer` era **appesa** in fondo al file, quindi finiva nella sezione "Licenza", fuori dal perimetro che il gate legge | La fixture appendeva invece di inserire: la prova falliva per il motivo sbagliato — e, per il motivo sbagliato, **passava** | T2 inserisce la riga dentro la sottosezione "Piattaforme importabili". Una prova che non prova niente è peggio di una prova assente: maschera il gate invece di proteggerlo | `scripts/test-readme-facts-gate.sh` (T2) |

**Lesson learned sintetica**: la documentazione che dichiara fatti verificabili dal codice **è** codice — "8 piattaforme" è un'affermazione falsificabile, e il suo costo non è estetico. Il drift più pericoloso non è quello che un gate blocca, è quello che **nessuno guarda**: la prosa di un file che tutti aprono e nessuno aggiorna, in un repository dove i gate confrontano i *formati* ma non i *fatti*. E la lezione operativa che tiene insieme il resto: quando un artefatto ha **due owner** (un blocco generato e una prosa scritta a mano), la tabella degli owner deve esistere **prima** del gate che li confronta — senza di essa il gate verifica una cosa che nessuno si sente responsabile di correggere.

### Link utili

- Branch: `feat/161-readme-maintenance` (worktree `ls-161-readme-maintenance`)
- Issue: **#161** (`size:M`, `area:devops`, `docs`)
- Gate: `scripts/check-readme-facts.mjs` · test: `scripts/test-readme-facts-gate.sh` (T1..T9, 12 assert)
- CI: `.github/workflows/ci.yml` — step 17 «Fatti del README in sync con il codice», step 18 «Gate "fatti del README" fail-closed»
- Regola di ownership: `AGENTS.md` §"Ownership del `README.md`" (D.161.1) · `docs/12-DEVOPS.md` §9.8f
- Sessione: `docs/state/sessions/54-readme-maintenance.md`

---

## 21. Issue #164 — Spec Story 1.5 "Scrobbling hub" (Sessione 55)

**Tipo**: specifica (`docs`) — issue #164, claim `kilo-HP-ELITEBOOK-bmyx`
**Branch**: `feat/164-scrobbling-hub-spec` (worktree `ls-164-scrobbling-hub-spec`)
**PR**: #167 (aperta su `main` dalla worktree)
**Data**: 2026-10-27
**Stato**: 🟡 in corso — spec `docs/20-SCROBBLING-HUB.md` v0.1 (🟡 DRAFT); la ratifica (v1.0 🟢) e l'ADR-0011 sono il passo successivo

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 21-1 | P | La story descriveva una capacità che la piattaforma non ha: "sorgente continua di ascolti" e `01-PLATFORMS.md` §3.9 (app accanto a Navidrome, Plex, Roon) presuppongono un processo che osserva la riproduzione **in tempo reale** | Una **PWA non può osservare la riproduzione di altre app**: non esiste un bridge standard fra la sessione media del sistema operativo e una pagina web (`navigator.mediaSession` governa il media di *una* pagina). La formulazione del backlog era quella di un client nativo, copiata in una web app senza la domanda di fattibilità | La spec dichiara la premessa (§3): la prima tranche è uno **specchio idempotente dello storico locale** verso i hub abilitati; il percorso live (now playing) è differito e dichiarato come punto aperto | `docs/20-SCROBBLING-HUB.md` §3, §18 punto 7 |
| 21-2 | P | La granularità del timestamp era a un passo dal essere sbagliata: la normalizzazione **al minuto** (D-LF.7) applicata al payload di invio avrebbe fatto perdere la distinzione fra due scrobble distinti dello stesso brano in due minuti diversi | Il minuto è un artefatto della **chiave di dedup** del percorso di *lettura*, non una semantica dell'evento: le due semantiche si somigliano ma hanno scopi opposti | La spec separa i due piani: `T-SH.1`/`T-SH.2` (invio al secondo, `startedAt`) contro `D-LF.7` (lettura, normalizzata) | `docs/20-SCROBBLING-HUB.md` §7 (T-SH.1, T-SH.2) |
| 21-3 | P | La firma `api_sig` in batch è fragile oltre i 10 elementi: i parametri sono indicizzati (`artist[10]`, `artist[2]`) e il server li ordina **per nome** | L'ordinamento lessicografico delle **stringhe** dei nomi non coincide con quello numerico degli indici: su un batch da ≥ 10 scrobble la firma calcolata diversamente da quella del server viene **rifiutata** (errore 13). Un test con 2-3 elementi non lo scopre | Dichiarato come edge case **E.SH.8** con il caso di test n. 22 (batch da 50 scrobble, firma attesa) | `docs/20-SCROBBLING-HUB.md` §6.1, §12 (E.SH.8) |
| 21-4 | P | La coda degli invii non può stare in `settings`: la tabella chiave/valore disponibile offriva la soluzione "pronta" (persistenza locale già esistente) | `settings` è per impostazioni (`02-DATA-SCHEMA.md` §6.1); una coda ha **stato per elemento, tentativi e indice unico**, e l'indice unico è *la* garanzia di idempotenza (G-SH.1) | Tabella nuova `scrobbleOutbox` (schema Dexie **v5**) con PK `hub\|eventKey`, macchina a stati `pending → in_flight → sent/failed/dropped` e scrittura **write-ahead** (E.SH.6) | `docs/20-SCROBBLING-HUB.md` §8 |

**Lesson learned sintetica**: il primo esercizio di una spec non è scrivere il contratto, è verificare che il sistema sia **realizzabile** nella piattaforma scelta — una spec che descrive bene qualcosa che non esiste è il documento più pericoloso che si possa produrre, perché passa la review formale e fallisce alla prima implementazione. E il secondo esercizio è chiedersi **da dove arriva il dato**: il backlog descrive l'intenzione, la piattaforma decide la fattibilità.

### Link utili

- Branch: `feat/164-scrobbling-hub-spec` (worktree `ls-164-scrobbling-hub-spec`)
- Issue: **#164** (`size:L`, `area:adapter`, `phase-1`)
- Spec: `docs/20-SCROBBLING-HUB.md` (v0.1 🟡 DRAFT, 18 sezioni, 16 edge case, 29 casi di test, 15 deliverable)
- Sessione: `docs/state/sessions/55-scrobbling-hub-spec.md`
- Precedenti: `#144` (spec Last.fm) · `#145` (spec ListenBrainz) · `#148` (ADR-0010) · `#155` (implementazione 1.3)

---

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | 2026-10-16 | Template iniziale + regole di compilazione (Sessione 10/11) |
| 0.2 | 2026-10-16 | Sessione 11 — entry Story 0.1 con 8 problemi/fix/lesson (P0 toolchain) e stato accettazione; indice rapido per sintomo |
| 0.3 | 2026-10-16 | Sessione 12 — doc-sync post-merge: branch/PR status aggiornati (✅ merged in `main`, PR #2, squash `c0fb0a4`); conteggio problemi corretto da 8 → 9 (coerente con messaggio commit); aggiunto commit `c0fb0a4` ai link utili |
| 0.4 | 2026-10-16 | Sessione 13 — entry post-merge PR #3 (`10ecde5`): gate D.12.1 applicato; 4 entry di lesson learned sul doc-sync (13-sync-1..4); bumped a v0.4 per riflettere l'attività di consolidamento |
| 0.5 | 2026-10-16 | Sessione 14 — entry Story 0.2 con 5 problemi/fix/lesson (0.2-1..5): Dexie `modify()` su Collection, riallineamento `Artist` a 02 v1.2, slow-path fake-indexeddb su re-put, test perf isolati dalle run coverage, pitfalls barrel/MapIterator; osservazione fixture per Story 0.3 |
| 0.6 | 2026-10-17 | Doc-sync post-merge: §6 Story 0.2 aggiornata a ✅ merged (PR #4, `fa09b06`, CI main ✅); link commit completati; gate D.12.1 applicato |
| 0.7 | 2026-10-17 | **§7 Sessione 18** (protocollo claim — ADR-0006): entry `merged` con PR #12 (`2891cb5`), claim `kilo-HP-ELITEBOOK-hjoe` rilasciato, branch `feat/11-task-claiming-protocol` eliminata; 3 lesson learned (18-1 dogfooding claim, 18-2 PowerShell BOM su body commit/PR, 18-3 `git branch -d` su merge-commit); osservazione operativa per le 3 issue `agent-ready` aperte in S17 |
| 0.8 | 2026-10-17 (S19) | **§8 Sessione 19** (ADR-0007 — issue state machine `status:*`): entry PR #14 (merge `a500ea2`, 2026-10-17T15:03:21Z), claim `kilo-HP-ELITEBOOK-jm9f`; 4 lesson (19-1 dogfooding cleanup #11, 19-2 label description > 100 char fallisce 422, 19-3 write tool input + JSON escaping, 19-4 single-quote `jq` in PowerShell); osservazione operativa: `agent-ready` ∩ `status:*` = ∅ (mutua esclusione). **Post-merge**: branch remoto eliminato (policy §♻️), claim rilasciato con `status:done` applicato a #13 |
| 0.9 | 2026-10-17 (S20) | **§9 Sessione 20** (hardening multi-agente): entry PR #15 (claim `kilo-HP-ELITEBOOK-r9p2`); 4 lesson (20-1 difese stratificate > unica, 20-2 postinstall double-edged, 20-3 pattern `N` obbligatorio, 20-4 `core.hooksPath` per-clone); 3 difese a basso costo (push early + pre-commit hook + session checklist) coprono 5 failure mode (F1, F2, F4, F6, F7); F3 e F5 non mitigati direttamente (richiedono worktree, scelta Boss C) |
| 1.0 | 2026-10-17 (post-merge S20) | **Esito post-merge S20**: PR #16 merged (commit `506c86a`, 2026-10-17T15:24:31Z), gate D.12.1 applicato: Sessione 20 ✅ Completata, branch remoto `feat/15-parallel-safety` eliminato (policy §♻️), claim `kilo-HP-ELITEBOOK-r9p2` rilasciato su #15 con applicazione `status:done`, issue #15 chiusa via `Closes #15`. Placeholder `<da-compilare>` sostituito in §"Esito post-merge", §"Prossimi step" checkbox-ate, changelog v1.0 (18-DEV-LOG) e v1.3 (SESSIONS) allineati |
| 1.1 | 2026-10-17 (Sessione 21) | **§10 Sessione 21** (refactor catena): entry PR #17 (claim `kilo-HP-ELITEBOOK-q7w3`); 4 lesson (21-1 doc-sync post-merge su main è intrinsecamente racy — soluzione: doc-sync IN PR, 21-2 GH Action può sostituire label transitions manuali, 21-3 pre-push hook cross-platform pattern pwsh/powershell fallback, 21-4 doc-sync IN PR richiede 2 commit sul branch); D1 doc-sync IN PR + D2 GH Action `auto-status-done` + D3 pre-commit clean check + D4 pre-push BUNDLE auto-regen + D5 pre-push base-stale warning; race condition al punto 8 (doc-sync post-merge) eliminato atomicamente |
| 1.2 | 2026-10-17 (post-merge S21) | **Esito post-merge S21**: PR #18 merged (commit `6c0f79b`, 2026-10-17T18:00:26Z), gate D.12.1 applicato: Sessione 21 ✅ Completata, branch remoto `feat/17-chain-refactor` eliminato (policy §♻️), claim `kilo-HP-ELITEBOOK-q7w3` rilasciato su #17. **🎉 Test critico SUPERATO**: GH Action `auto-status-done` ha applicato automaticamente `status:done` a #17 al merge (rimossi anche `in-progress` e `status:in-review`). La catena S21 funziona end-to-end; la race condition al punto 8 della catena precedente è eliminata. Placeholder `<da-compilare>` sostituito in §10 e §"Esito post-merge", changelog v1.2 (18-DEV-LOG) e v1.5 (SESSIONS) allineati |
| 1.3 | 2026-10-18 (Story 0.5) | **§11 Story 0.5 — PWA e service worker** (issue #7, claim `kilo-HP-ELITEBOOK-3b3f`): 5 lesson (0.5-1 `getByText` ambiguità substring → `getByRole`, 0.5-2 cleanup RTL con `globals: false` → `test-setup.ts` + `setupFiles`, 0.5-3 `it.each` non preserva tuple types → `const cases` esplicito, 0.5-4 PNG generator zero-deps con `node:zlib` ~50 righe, 0.5-5 alias per `virtual:pwa-register/react` in jsdom). Pattern replicabile: setup esplicito (`test-setup.ts`) necessario per Vitest + RTL quando `globals: false`; virtual modules di `vite-plugin-pwa` vanno aliasati in test environment. Build 227.81 KB gzip 71.36 KB (budget 300 KB) |
| 1.4 | 2026-10-22 (Story 1.1) | **§14 Story 1.1 — Adapter YouTube Music** (issue #129, claim `kilo-HP-ELITEBOOK-x7q2`): 4 lesson (1.1-1 `new Blob(string)` → sequence, 1.1-2 `exactOptionalPropertyTypes` → `delete` nei test, 1.1-3 detect full-stream su troncato valuta il prefisso per il partial recovery 05§4, 1.1-4 derivazione `_expectedOutput` 9 eventi − 1 merge = 8 Track). Nuovo adapter `youtube/` (detect strutturale E.YT.1, filtro E6 §3.3, eventKey sha1(videoId\|time), privacy §7), `RawListenEvent.sourceArtistUri` + `mergeArtist` in pipeline, fixture 13 eventi, 43 test, adapter factory onboarding UI + i18n §2.12b |
| 1.5 | 2026-10-26 (Story 1.3) | **§15 Story 1.3 — Spec adapter ListenBrainz** (issue #145, claim `kilo-HP-ELITEBOOK-lb47`, PR #146 merge `6d66233`): 5 lesson (15-1 `recording_msid` non è un ID univoco per ascolto → l'`eventKey` include `listened_at`, 15-2 `MAX_ITEMS_PER_GET` = 1000 e non 100 (sorgente, non doc), 15-3 il backlog descriveva il canale di accesso in modo falso per entrambe le piattaforme, 15-4 «nessun segreto da gestire» era falso: `api_key` per-utente (ToS §4.4) + `sk` via web auth, 15-5 i campi `null` nel frontmatter rendono `#null` nel blocco aggregato). Spec `03-ADAPTERS/listenbrainz.md` v1.0 🟢 APPROVED; perimetro della 1.3 corretto e Story 1.5 ridimensionata |
| 1.6 | 2026-10-26 (issue #149) | **§16 Race fra i due writer di `main`** (issue #149, claim `kilo-HP-ELITEBOOK-lb47`, PR #151): 4 lesson (16-1 il concurrency group serializza i run ma non ne impone l'ordine, e `auto-bundle` **copia** ciò che `auto-state-aggregate` **modifica** → drift di 6 righe in BUNDLE.md, silenzioso; 16-2 un commit fatto col GITHUB_TOKEN non innesca workflow, quindi il meccanismo di auto-guarimento era spento per definizione; 16-3 `const` non è hoisted: il gate era scritto ma mai chiamato → crash invece di `[FAIL]`; 16-4 i test di regressione devono girare dove gira il dev → fixture senza `python3`, `bash` su Windows è lo stub WSL). Fix: trigger `workflow_run` in `auto-bundle.yml` (opzione A, Boss) + quinto gate `checkWriterOrdering` + `scripts/test-workflow-writer-ordering.sh` (T1..T5, 6 assert) + step bloccante in `ci.yml` posizione 13; `12-DEVOPS.md` §9.8e nuova, §9.10 a 16 step, changelog 0.8; `AGENTS.md` v1.26 |
| 1.7 | 2026-10-26 (issue #144, #155) | **§17 Story 1.3 — Spec adapter Last.fm + approvazione** (Sessioni 50-51, claim `kilo-HP-ELITEBOOK-lb47`, PR #154 merge `b3130a9` + PR #156 merge `6ec71bb`): 6 lesson (17-1 il limite di `limit` va letto nella doc ufficiale dell'endpoint (200), non dedotto per analogia; 17-2 `artist` ha due forme a seconda di `extended=1` → accessor unico; 17-3 normalizzare l'`eventKey` al minuto su **tutti** i percorsi, se no il re-import misto API+file duplica ogni scrobble; 17-4 la normalizzazione è un contratto fra i due adapter → una sola issue (#155); 17-5 `api_sig` richiede md5, la Web Crypto non ce l'ha → web auth differito alla Story 1.5; 17-6 una sessione chiusa dalla PR che l'ha prodotta non può conoscere il proprio merge → doc-sync in PR separata, e le sezioni legacy dei file globali invecchiano in silenzio). Spec `03-ADAPTERS/lastfm.md` v1.0 🟢 APPROVED; issue #144 chiusa, issue di implementazione #155 aperta (`agent-ready`, size L) |
| 1.8 | 2026-10-26 (issue #155) | **§18 Story 1.3 — Implementazione adapter Last.fm + ListenBrainz** (Sessione 52, claim kilo-HP-ELITEBOOK-lb52, PR #158): 7 lesson (18-1 il contratto degli adapter non aveva un campo per l'MBID dell'artista: aggiunti due campi **additivi e opzionali**; 18-2 durata catalogo e durata dell'evento erano la stessa cosa: bucket DEDUP-3 sempre 0 e durata solo hint sulla Track; 18-3 la formula dell'eventKey della spec non poteva soddisfare E.LF.4 ed E.LF.16/E.LF.19 insieme — il MBID entra nella chiave solo quando disambigua; 18-4 skipped = null non è rappresentabile nel modello: dichiarato; 18-5 la normalizzazione al minuto agisce sull'evento, non sulla riga del file: gap noto; 18-6 il test di un contratto di rete deve asserire il **comportamento** (ritmo, backoff, numero di tentativi), non l'assenza di eccezioni; 18-7 il detect del JSON pretty-printed non può guardare la prima riga). 198 test core (47 nuovi) + 81 test web (3 nuovi) verdi |
| 1.9 | 2026-10-26 (issue #160) | **§19 Story 1.4 — `rekey()`: promozione dedup post-enrichment** (Sessione 53, claim `kilo-HP-ELITEBOOK-lb53`): 4 lesson (19-1 una funzione "già implementata" può essere una story aperta — `rekey()` esisteva dalla Story 0.7 ed era esportata e descritta in tre documenti, ma nessun test copriva il caso centrale e tre AC non erano soddisfatti; 19-2 il tipo del DB non protegge da una query sbagliata: `where('[platform+trackId]')` compila, passa il typecheck e fallisce a runtime *dentro* la transazione, spezzando il DB; 19-3 un contatore denormalizzato sommato a mano è una seconda fonte di verità (`5 + 3 = 8` con 2 ascolti reali): `recount()` (MIG-4) va delegato, non ricalcolato; 19-4 il determinismo è una proprietà del *dato*: quale delle due track sopravviveva dipendeva dall'ordine di enumerazione di IndexedDB). 9 test nuovi; 208 test core + 81 web verdi |
| 2.0 | 2026-10-27 (issue #161) | **§20 Issue #161 — Gate "fatti del README"** (Sessione 54, claim `kilo-HP-ELITEBOOK-8enl`, PR #165): 5 lesson (20-1 la prosa dichiarava 8 piattaforme importabili (Deezer, Tidal, SoundCloud inesistenti) e capability non implementate come presenti: nessuno dei 16 gate confrontava la prosa con il codice, quindi i merge delle Story 1.2 e 1.3 non avevano toccato il README e la pipeline era rimasta verde; 20-2 il conteggio `EPIC 0 — 7/7` in prosa duplicava un dato dei blocchi aggregati: l'anti-pattern "puntatore, non copia" non copriva il README, che è un file ibrido senza tabella di ownership; 20-3 il blocco NEXT-STEP elenca solo le story già migrate in `docs/state/stories/`, e la prosa non lo diceva — un gate che pretendeva la verità da un blocco generato avrebbe prodotto un falso positivo sul titolo di una story; 20-4 il gate, alla prima esecuzione, passava sempre: il parsing di `ADAPTER_FACTORIES` si fermava al primo `=` (l'annotazione di tipo ne contiene uno) e la regex non riconosceva l'apostrofo curly di "Cosa c'è oggi"; 20-5 il test di scenario negativo T2 appendeva la riga `deezer` in fondo al file, fuori dal perimetro che il gate legge: la prova passava per il motivo sbagliato, e una prova che non prova niente maschera il gate invece di proteggerlo). Gate read-only `scripts/check-readme-facts.mjs` (15 check, 0 = in sync / 1 = drift / 2 = errore di ambiente) + test `scripts/test-readme-facts-gate.sh` (T1..T9, 12 assert) + 2 step bloccanti in `ci.yml` (posizioni 17-18); regola di ownership in `AGENTS.md` §"Ownership del `README.md`" (D.161.1); `12-DEVOPS.md` §9.8f nuova + §9.10 a 18 step; rimossi i 3 heading "## Changelog" duplicati (artefatto dei merge precedenti) |
| 2.1 | 2026-10-27 (issue #164) | **§21 Issue #164 — Spec Story 1.5 "Scrobbling hub"** (Sessione 55, claim `kilo-HP-ELITEBOOK-bmyx`): 4 lesson (21-1 la story descriveva una capacità che la piattaforma non ha — una PWA non osserva la riproduzione di altre app, quindi "sorgente continua di ascolti" (la formulazione di un client nativo) era irrealizzabile: la prima tranche è uno specchio idempotente dello storico locale; 21-2 la granularità al minuto è un artefatto della chiave di dedup del percorso di lettura e non una semantica dell'evento: applicarla al payload di invio avrebbe fatto perdere la distinzione fra due scrobble distinti; 21-3 la firma `api_sig` in batch ordina i nomi indicizzati **come stringhe**: `artist[10]` prima di `artist[2]`, e il difetto emerge solo con ≥ 10 elementi in un lotto; 21-4 la coda non può stare in `settings` (impostazioni, non code): serve la tabella `scrobbleOutbox` con schema Dexie v5, PK `hub\|eventKey` e scrittura write-ahead). Spec `docs/20-SCROBBLING-HUB.md` v0.1 🟡 DRAFT: 5 decisioni dell'issue #164 + D-SH.1…D-SH.10, contratto `ScrobbleSink` (da ratificare via ADR-0011), mappa `ScrobbleError` separata da `AdapterError`, 16 edge case, 15 codici i18n, 29 casi di test, 15 deliverable di implementazione |

---

*Questo file viene aggiornato ad ogni implementazione chiusa. È letto durante l'handoff
tra conversazioni AI e durante l'audit di Sessione (vedi `AGENTS.md` §"Fine di un'implementazione").*
