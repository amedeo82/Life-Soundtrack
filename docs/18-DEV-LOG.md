# 18 — Diario di Sviluppo (problemi, fix, lesson learned)

> Status: 🟡 DRAFT
> Versione: 2.16
> Ultima modifica: 2026-10-29 — §29 Issue #180 (Story 2.1 — Mood Tracker: il mood di giorno, settimana e mese)
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
**PR**: #167 (aperta su `main` dalla worktree, **merged** `eb718d5` — 2026-10-27T16:02:57Z)
**Data**: 2026-10-27
**Stato**: ✅ completata — spec `docs/20-SCROBBLING-HUB.md` v0.1 (🟡 DRAFT); la ratifica (v1.0 🟢) e l'ADR-0011 (issue #168) sono il passo successivo

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

## 22. Issue #168 — ADR-0011 "contratto di scrittura negli hub" (Sessione 56)

**Tipo**: decisione architetturale (`docs`) — issue #168, claim `kilo-hp-elitebook-41xb`
**Branch**: `feat/168-adr-0011-scrobble-sink` (worktree `ls-168-adr-0011-scrobble-sink`, rimossa post-merge)
**PR**: #170 (aperta su `main` dalla worktree, **merged** `8900c3b` — 2026-10-27T16:31:39Z)
**Data**: 2026-10-27
**Stato**: ✅ completata e **ratificata** — ADR `docs/13-ADR/0011-scrobble-sink.md` **v1.0 🟢 APPROVED** (ratifica del Boss al merge della PR #170, nessuna modifica di contenuto); `05§4.2` è la sede del contratto

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 22-1 | P | `05-ARCHITECTURE.md` aveva una **riga di changelog in cima al file**, prima del titolo: la v1.2 (Sessione 53, `rekey()`) era stata appesa al file invece che inserita nella tabella, e l'header dichiarava ancora `Versione: 1.1` | La riga è stata appesa con un editor che non verifica la posizione: nessun gate controlla che il changelog stia nella tabella, e `INDEX.md` dichiarava "v1.2" mentre il file diceva 1.1 — due versioni diverse per lo stesso documento | La riga è stata **riposizionata** nella tabella del changelog (ora la versione del file, `INDEX.md` e la tabella concordano: 1.3) e l'header aggiornato | `docs/05-ARCHITECTURE.md` §"Changelog" |
| 22-2 | P | L'header di `18-DEV-LOG.md` dichiarava `Versione: 2.0` mentre il changelog era già alla riga **2.1** (Sessione 55) | Stessa classe di difetto della riga 22-1: l'header è un dato **copiato a mano** in un file il cui changelog è tenuto in un altro punto | Header allineato a 2.2 con la Sessione 56 | `docs/18-DEV-LOG.md` header |
| 22-3 | P | L'issue #168 era `needs-spec` **senza** `agent-ready`: la macchina a stati (ADR-0007) la rendeva non candidabile, anche se la specifica era già stata scritta e mergiata (PR #167) | La label `needs-spec` era stata messa quando la decisione non esisteva; la sua rimozione (il passaggio a `agent-ready`) non è avvenuta quando la spec è stata mergiata. Nessun gate collega "spec mergiata" a "issue sbloccata" | La label è stata transitata (`needs-spec` → `agent-ready`) **prima** del claim, con il claim commentato e la riverifica fatta: l'assegnazione esplicita del project owner rende visibile la presa in carico anche quando la label non era pronta | issue #168 · `AGENTS.md` §"Presa in carico delle story" |
| 22-4 | P | La **specifica e l'ADR** si somigliano ma non sono lo stesso atto: la spec descrive il protocollo (🟡 DRAFT → ratifica del Boss), l'ADR descrive **dove vive il contratto** (🟢 APPROVED in `05§4` → serve un ADR) | La spec stessa (D-SH.7, §18 punto 1) rimandava all'ADR-0011 per la ratifica in `05§4`, ma i due documenti hanno **stati diversi** e portano a **mutazioni diverse** | L'ADR dichiara **quali** documenti vanno aggiornati e **quando**: `05§4.2` in questa PR (il contratto), `02§3.8`/`§6`, `09§3.3`/`§4` e `08-COPY-I18N.md` **alla ratifica della spec** (i documenti APPROVED non si modificano sulla base di una spec DRAFT) | `docs/13-ADR/0011-scrobble-sink.md` §"Documenti da aggiornare" |
| 22-5 | P | La tentazione di riusare `AdapterError` per gli errori di invio: `recoverable` è già un campo, `code` è già un campo, il tipo è già dichiarato | L'analogia è superficiale: `AdapterError.recoverable` significa "gli eventi validi **sono stati persistiti**", mentre per un invio significherebbe "lo stesso invio **può essere ritentato**". Un token scaduto ha `recoverable: true` nel primo schema e `false` nel secondo | `ScrobbleError` dedicato, con i sei codici `HUB_UNCONFIGURED`, `AUTH_INVALID`, `RATE_LIMITED`, `SOURCE_UNREACHABLE`, `PAYLOAD_REJECTED`, `HUB_ERROR` e la semantica dichiarata per `recoverable` | `docs/13-ADR/0011-scrobble-sink.md` V6 · `docs/05-ARCHITECTURE.md` §4.2 |

**Lesson learned sintetica**: un contratto che governa una **direzione** (leggere) e uno che governa l'altra (scrivere) non possono condividere lo stesso tipo quando i loro insiemi non coincidono — e i due insiemi, qui, non coincidono per costruzione (`maloja`/`subsonic`/`roon` sono client, non fonti). La regola che tiene insieme la decisione è la **simmetria con il precedente**: `parseRemote?()` ha risolto "l'adapter non ha un file" con un metodo opzionale; "l'hub non è un adapter" si risolve con un'interfaccia dedicata — stessa forma, opposta direzione. E la lezione operativa: quando un documento 🟢 APPROVED viene esteso da un atto architetturale, l'atto **dichiara** anche l'elenco dei documenti da aggiornare e il momento giusto per farlo: modificarli prima della ratifica della spec significa scrivere il vincolo di un documento che non è ancora vincolante.

### Link utili

- Branch: `feat/168-adr-0011-scrobble-sink` (worktree `ls-168-adr-0011-scrobble-sink`)
- Issue: **#168** (`size:M`, `area:adapter`, `docs`, `phase-1`)
- ADR: `docs/13-ADR/0011-scrobble-sink.md` (v0.1 🟡 DRAFT, decisione A1, vincoli V1-V10, alternative A2-A5, 4 punti aperti)
- Contratto ratificato: `docs/05-ARCHITECTURE.md` §4.2 (v1.3)
- Sessione: `docs/state/sessions/56-adr-0011-scrobble-sink.md`
- Precedenti: `#148` (ADR-0010 — il percorso di **lettura**) · `#164` (spec della Story 1.5)

---

## 23. Issue #172 — ratifica della spec Scrobbling hub (Sessione 57)

**Tipo**: decisione architetturale (`docs`) — issue #172, claim `kilo-hp-elitebook-41xb`
**Branch**: `feat/172-scrobbling-hub-spec-approval` (worktree `ls-172-scrobbling-hub-spec-approval`)
**PR**: #174 (aperta su `main` dalla worktree, **merged** `4abb73e` — 2026-10-27T16:59:24Z)
**Data**: 2026-10-27
**Stato**: ✅ completata e **ratificata** — `docs/20-SCROBBLING-HUB.md` **v1.0 🟢 APPROVED** (le quattro decisioni aperte chiuse come **D-SH.11…D-SH.14**); issue di implementazione **#173** aperta (`agent-ready`, `size:L`)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 23-1 | P | `02-DATA-SCHEMA.md` aveva la riga di changelog **v1.5 in cima al file**, prima del titolo, e l'header fermo a `Versione: 1.3` (mentre il changelog era alla 1.4) | Stesso difetto di `05-ARCHITECTURE.md` (22-1, Sessione 56): una riga di changelog appesa fuori dalla tabella. Nessun gate confronta l'header con il changelog, e i gate che contano le versioni non guardano la prima riga del file | Riga **riposizionata** nella tabella, header alla v1.6; **scansione di tutti i `.md` di `docs/`** (prima riga che comincia con `| <version> |`): è l'**unico** altro file con il difetto | `docs/02-DATA-SCHEMA.md` §"Changelog" |
| 23-2 | P | Cinque documenti dichiaravano nell'header una versione **più vecchia** del proprio changelog: `09` (v0.2, Sessione 6 → changelog 0.4), `08` (v0.2 → 0.4), `01` (v0.2 → 0.6), `lastfm.md` (v1.0 → 1.1), `listenbrainz.md` (v1.0 → 1.1) | L'header è un dato **copiato a mano** in un punto diverso dal changelog: due fonti di verità, e nessun gate le confronta | Header allineati in questa PR (ogni documento toccato dalla ratifica) | `docs/09`, `docs/08`, `docs/01`, `docs/03-ADAPTERS/*` |
| 23-3 | P | La ratifica di una spec è stata trattata — per abitudine — come una promozione **senza contenuto**, ma chiudere i punti aperti **modifica regole normative** (T-SH.3, T-SH.4, E.SH.10, E.SH.11, finestra di candidatura, modalità del proxy) | La promozione precedente (ADR-0011, PR #171) **era** senza contenuto, e il pattern è stato generalizzato | Le modifiche sono **dichiarate**: §2.1 della spec elenca le quattro decisioni con motivazione ed effetti, il changelog 1.0 dice quali regole cambiano, e il §2.1 "Effetti sulle regole già scritte" le elenca una per una | `docs/20-SCROBBLING-HUB.md` §2.1 |
| 23-4 | P | La regola di maturità **precedente** escludeva la maggior parte degli ascolti degli utenti Last.fm/ListenBrainz (durata `0`): la Story 1.5 non avrebbe avuto nulla da inviare | La regola era difendibile a tavolino ("senza durata non si può stabilire la maturità") e **inutile nel mondo**: il filtro escludeva proprio il population target della story | **D-SH.13**: soglia dei 4 minuti sul tempo trascorso + **fiducia nella fonte** per gli eventi importati da un hub (la fonte ha già applicato la propria regola). Il bias residuo è dichiarato | `docs/20-SCROBBLING-HUB.md` §7, §12 |
| 23-5 | P | Le issue #172 e #173 sono **nate in sequenza dentro la stessa sessione**: #172 raccoglieva le decisioni, #173 è l'implementazione | La regola d'oro impone di non lavorare una issue senza `agent-ready`; le decisioni non esistevano, quindi #172 nasceva `needs-spec` e la transizione è avvenuta **solo** con l'assegnazione esplicita del project owner | #172 transitata `needs-spec` → `agent-ready` **prima** del claim (con claim commentato e riverificato), poi chiusa con `status:done` al merge; #173 aperta `agent-ready` con i 15 deliverable e i vincoli | issue #172, #173 · `AGENTS.md` §"Presa in carico" |

**Lesson learned sintetica**: **ratificare una spec non è promuoverla**. La promozione dell'ADR-0011 è stata una promozione *senza contenuto*; chiudere i punti aperti di una spec *modifica regole normative*, e la differenza va detta, perché la regola che i documenti APPROVED non si modificano sulla base di una spec DRAFT ha un senso solo se le modifiche sono **dichiarate come effetto della ratifica**. E la lezione operativa: una regola di default va giudicata su **quanti utenti reali la superano**, non su quanto è conservativa — "durata ignota → non maturo" era la regola più prudente e la meno utile.

### Link utili

- Branch: `feat/172-scrobbling-hub-spec-approval` (worktree `ls-172-scrobbling-hub-spec-approval`)
- Issue: **#172** (`size:M`, `area:adapter`, `phase-1`), claim `kilo-hp-elitebook-41xb` · chiusa con `status:done` al merge della PR
- Spec: `docs/20-SCROBBLING-HUB.md` (v1.0 🟢 APPROVED, D-SH.11…D-SH.14, 31 casi di test)
- Contratto: `docs/13-ADR/0011-scrobble-sink.md` (v1.0 🟢 APPROVED, Sessione 56) → `05§4.2`
- Issue di implementazione: **#173** (`agent-ready`, `size:L`)
- Sessione: `docs/state/sessions/57-scrobbling-hub-spec-approval.md`
- Precedenti: `#164` (spec della Story 1.5) · `#168` (ADR-0011)

---

## 24. Issue #173 — Story 1.5: scrobbling hub (Sessione 58)

**Tipo**: implementazione (code) — issue #173, claim `kilo-hp-elitebook-41xb`
**Branch**: `feat/173-story-1-5-scrobbling-hub` (worktree `ls-173-story-1-5-scrobbling-hub`)
**PR**: #176 (aperta su `main` dalla worktree, **merged** `bfb5946` — 2026-10-28T13:56:09Z)
**Data**: 2026-10-28
**Stato**: ✅ completata — il percorso di **scrittura** degli scrobble è implementato sulla spec `20-SCROBBLING-HUB.md` v1.0 🟢 e sul contratto `ADR-0011` v1.0 🟢

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 24-1 | P | Il **test di performance** del layer DB è diventato rosso (600-670 ms contro la soglia locale di 500 ms) **senza che il layer DB fosse cambiato** | Con tre file di test in più, la suite parallela faceva da rumore: la misura del test finiva dentro il carico delle altre suite. Verifica decisiva: togliendo i tre file nuovi la suite tornava verde **con** la tabella `scrobbleOutbox` già presente | Il test di performance gira in una **run separata** (`vitest run --exclude '**/perf.test.ts' && vitest run …`): la misura è del layer, non del runner. La **soglia dell'AC resta invariata** (500 ms locale, 1500 ms in CI) — alzarla avrebbe spento l'AC invece di isolare la misura | `packages/core/package.json` |
| 24-2 | P | `db/health.ts` segnalava un falso "schema sotto l'attesa" | Il check di salute dichiarava la versione **4** come attesa: con la tabella `scrobbleOutbox` lo schema corrente è **5** | `expectedSchemaVersion` portato a 5, con il commento aggiornato | `packages/core/src/db/health.ts` |
| 24-3 | P | `db.test.ts` falliva su elenco tabelle e versione | La tabella `scrobbleOutbox` è la **14ª**: l'elenco e gli indici dichiaravano 13 tabelle e la versione 4 | Elenco, indici e versione aggiornati (la 14ª tabella con PK `idempotencyKey` e indici `hub`, `status`, `createdAt`, `nextAttemptAt`) | `packages/core/src/db/__tests__/db.test.ts` |
| 24-4 | P | La coda referenzia il tipo del **dominio** `ScrobbleHubId`, che stava solo negli adapter | Se il tipo fosse definito solo in `adapters/scrobble`, il **db** avrebbe dipeso dagli adapter: un ciclo fra moduli che nessun gate misura (`05§9.2` parla di package) | `ScrobbleHubId` vive in `schema/index.ts` (il dominio) e gli adapter lo importano: il db non conosce gli adapter | `packages/core/src/schema/index.ts` |
| 24-5 | P | I brani non si trovavano per `listen.trackId` | La PK di `tracks` è `canonicalKey` e `id` **non** è indicizzato: non esiste una query per id | Risoluzione con una **scansione** di `tracks` (lo stesso approccio di `db/orphan-cleanup.ts`), costruendo la mappa id → brano una volta per ciclo | `packages/core/src/adapters/scrobble/eligibility.ts` |
| 24-6 | P | Il **delay di retry** del protocollo (`X-RateLimit-Reset-In`) non aveva una casa nel contratto | R-SH.4 impone di rispettarlo, ma il contratto approvato `05§4.2` non ha quel campo e il protocollo deve restare nel sink (V9) | Il sink espone il delay come **capacità opzionale** (`retryDelayMs()`), che il sender cerca strutturalmente: il contratto approvato resta intatto | `packages/core/src/adapters/listenbrainz/scrobble.ts` |

**Lesson learned sintetica**: un **AC che mescola due story** non si può spuntare. "MBID da ListenBrainz alimenta DEDUP-2 **e** genera `track.genres` via lookup MusicBrainz" unisce una capability dell'EPIC 1 (il MBID, già nel pipeline) a una dell'EPIC 4 (l'enrichment, non implementato): dichiararlo parzialmente e aprire la issue dedicata quando l'EPIC 4 parte è più onesto di uno spunta verde che copre metà del lavoro. E la lezione operativa: un **test di performance è una misura di un ambiente**, non solo del codice — quando i test crescono, la misura cresce con loro, e la risposta è isolare la misura, non alzare la soglia.

### Link utili

- Branch: `feat/173-story-1-5-scrobbling-hub` (worktree `ls-173-story-1-5-scrobbling-hub`)
- Issue: **#173** (`size:L`, `area:adapter`, `phase-1`), claim `kilo-hp-elitebook-41xb`
- Spec: `docs/20-SCROBBLING-HUB.md` (v1.0 🟢 APPROVED) · Contratto: `docs/13-ADR/0011-scrobble-sink.md` (v1.0 🟢 APPROVED)
- Sessione: `docs/state/sessions/58-scrobbling-hub-implementation.md`
- Precedenti: `#164` (spec) · `#168` (ADR-0011) · `#172` (ratifica della spec)

## 25. Issue #178 — ratifica della spec dell'analisi (Sessione 59)

**Tipo**: decisione architetturale (`docs`) — issue #178, claim `kilo-hp-elitebook-41xb`
**Branch**: `feat/178-epic2-analysis-ratification` (worktree `ls-178-epic2-analysis-ratification`)
**PR**: #181 (aperta su `main` dalla worktree, **merged** `5f725e3` — 2026-10-28T14:28:05Z)
**Data**: 2026-10-28
**Stato**: ✅ completata — `docs/04-ANALYSIS-ALGORITHMS.md` **v1.0 🟢 APPROVED** (le cinque decisioni chiuse come **D-A.1…D-A.5**); aperte le issue **#179** (Story 2.4, `agent-ready`) e **#180** (Story 2.1, bloccata)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 25-1 | P | I **template i18n dei ricordi** esistevano già (`08§2.15`: `memory.on_this_day`, `memory.first_time`, `memory.milestone.*`, `memory.return`, `memory.seasonal`) e la prima stesura della ratifica li **rinominava** in `insight.memory.*` con parametri diversi (`gapDays` invece di `months`, `artist` invece di `genre`) | La spec del §7.2 scriveva le frasi **inline** e non guardava il namespace i18n già dichiarato: due famiglie di chiavi incompatibili, nessun gate che lo vedesse | Le formule sono state **riallineate alle chiavi esistenti** (`04§7.2`, `§7.3.1`) e `08§2.15` dichiara i template come **vincolanti**; manca solo `memory.milestone.artists` (le soglie "artisti unici" erano nella spec senza template) | `docs/04-ANALYSIS-ALGORITHMS.md` §7.2 · `docs/08-COPY-I18N.md` §2.15 |
| 25-2 | P | Il ricordo **stagionale** era per **artista** nella spec e per **genere** nel template i18n (`memory.seasonal` = "Come ogni {month}, è tornato il periodo {genre}") | La spec §7.2 diceva "artista/genere" e il pseudocodice aveva scelto l'artista; il template diceva il genere | Decisione **D-A.7**: il ricordo stagionale è **per genere**, e l'informazione vive nel `text` reso (`MemoryPayload` non ha un campo `genre`, coerente con D-A.4) | `docs/04-ANALYSIS-ALGORITHMS.md` §7.2 |
| 25-3 | P | La sezione dei template dei ricordi è stata prima inserita come **§2.13** in `08-COPY-I18N.md`, **in collisione** con `error.*` (§2.13) e con `insight.*` (§2.15) | Il contatore delle sezioni è stato incrementato senza verificare che esistesse già un §2.13 (le §2.12b…§2.12g mostravano già che le sotto-sezioni non sono in ordine stretto) | La sezione duplicata è stata rimossa e la nota di vincolanza è stata messa **dentro** §2.15, dove le chiavi stanno già | `docs/08-COPY-I18N.md` §2.15 |
| 25-4 | P | La **Story 2.1** dipendeva dalle **audio features** (EPIC 4.1, non implementate) senza che nessun documento lo dicesse: il backlog dichiarava solo `DEP:0.2` | La dipendenza è **implicita** nel codice (`getAudioFeatures()` in `04§3.3`) e nessun gate confronta il backlog con gli algoritmi | La dipendenza è ora scritta in **tre** posti: `04§12`, la sezione Story 2.1 del backlog e l'issue #180 (`needs-spec`). Consegnare la 2.1 senza feature sarebbe stato un falso verde (lesson 58-4) | `docs/04-ANALYSIS-ALGORITHMS.md` §12 · `docs/11-BACKLOG.md` §Story 2.1 · issue #180 |

**Lesson learned sintetica**: **una spec che ratifica non può rinominare un contratto già dichiarato** — i template i18n dei ricordi esistevano dal bootstrap, e la ratifica li avrebbe spostati su nomi nuovi: chi implementa avrebbe trovato due famiglie di chiavi incompatibili. La regola operativa è semplice e va applicata **prima** di scrivere: quando una spec ratifica, si cerca se il contratto che sta per dichiarare esiste già in un altro documento, e se esiste la spec si **allinea** a lui. E la lezione operativa sull'EPIC 2: **una story bloccata va bloccata per iscritto**: la dipendenza dalle audio features era implicita nel codice e invisibile nel backlog, e un agente che avesse preso la 2.1 avrebbe scritto un mood tracker che non produce mai nulla.

### Link utili

- Branch: `feat/178-epic2-analysis-ratification` (worktree `ls-178-epic2-analysis-ratification`)
- Issue: **#178** (`size:M`, `area:analysis`, `phase-2`), claim `kilo-hp-elitebook-41xb`
- Spec: `docs/04-ANALYSIS-ALGORITHMS.md` (v1.0 🟢 APPROVED, D-A.1…D-A.5) · Issue **#179** (Story 2.4) e **#180** (Story 2.1)
- Sessione: `docs/state/sessions/59-epic2-analysis-ratification.md`
- Precedenti: `#164` (spec della Story 1.5) · `#168` (ADR-0011) · `#172` (decisioni aperte)

## 26. Issue #182 — il blocco NEXT-STEP indica solo story lavorabili (Sessione 60)

**Tipo**: tooling (`scripts/`) + documentazione — issue #182, claim `kilo-hp-elitebook-41xb`
**Branch**: `feat/182-next-step-skip-blocked` (worktree `ls-182-next-step-skip-blocked`)
**PR**: #183 (aperta su `main` dalla worktree, **merged** `a350386` — 2026-10-28T15:26:17Z)
**Data**: 2026-10-28
**Stato**: ✅ completata — il blocco NEXT-STEP del README indica la **2.4** (Memory Engine) invece della **2.1**, bloccata dalle audio features dell'EPIC 4.1

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 26-1 | P | Il blocco NEXT-STEP indicava la **Story 2.1**, che è **bloccata** dalle audio features dell'EPIC 4.1 (decisione D-A.1): il lettore del repository trovava un puntatore a una story non lavorabile, mentre la implementabile era la 2.4 | Il filtro di `Build-Block-NextStep` escludeva solo `done`. Il valore `blocked` esisteva nella macchina a stati (`11-BACKLOG.md`, ADR-0007) e nei label GitHub, ma **non** era mai comparso in un `docs/state/stories/*.md`: il primo file che lo usa (la 2.1, Sessione 59) ha reso visibile il disallineamento | Il filtro esclude ora `done`, `blocked` e `wontdo`; restano `todo`, `in_progress` e `in_review` (in lavorazione, non bloccate). Il messaggio di fallback e la riga delle altre candidate dicono "non-done **e non bloccate**" | `scripts/aggregate-state.ps1` |
| 26-2 | P | I **valori** di `status` non erano documentati nello schema dello state: `docs/state/_index.md` elencava gli **emoji** (🟡/⬚/👀/✅/❌/🛑) senza i valori che l'agregator confronta | Lo schema riportava `status: done` come esempio con l'elenco degli emoji; i valori ascii vivevano solo in `11-BACKLOG.md` §"Stato di una Story" | Lo schema elenca ora i sei valori: `todo` / `in_progress` / `in_review` / `done` / `blocked` / `wontdo` | `docs/state/_index.md` §"Schema frontmatter" |
| 26-3 | P | Il blocco poteva **contraddirsi**: la prosa diceva "non-done" mentre la lista escludeva anche le bloccate | La frase del blocco generato è **prosa**, e sottoposta al gate del README solo per i fatti dichiarati nella prosa del file | La frase ora nomina il filtro ("non-done e non bloccate"): se il conteggio cambia, la frase che lo descrive cambia con lui | `scripts/aggregate-state.ps1` · `AGENTS.md` §"Ownership del `README.md`" |

**Lesson learned sintetica**: un blocco generato che indica **"cosa fare dopo"** è un gate di lavoro, non un riepilogo: bastava una story `blocked` in cima alla lista per trasformarlo in un vicolo cieco, e nessun gate lo segnalava — il gate confrontava il blocco con il **calcolo**, non il calcolo con la **realtà**. E la lezione sulle macchine a stati: `blocked` e `wontdo` esistevano da prima (nei label GitHub, in ADR-0007, nello stato delle issue) ma **mai** in un file di stato: le nuove regole si scoprono dai dati, non dai documenti.

### Link utili

- Branch: `feat/182-next-step-skip-blocked` (worktree `ls-182-next-step-skip-blocked`)
- Issue: **#182** (`size:S`, `area:devops`), claim `kilo-hp-elitebook-41xb`
- Sessione: `docs/state/sessions/60-next-step-skip-blocked.md`
- Precedenti: **#178** (la ratifica che ha creato la prima story `blocked`) · **#179** (la 2.4, ora indicata dal blocco) · **#180** (la 2.1, bloccata)

## 27. Issue #179 — Story 2.4: il Memory Engine (Sessione 61)

**Tipo**: feature (`packages/core/src/analysis/`) + persistenza (`db/`) + i18n (`apps/web/`) — issue #179, claim `kilo-hp-elitebook-hj59`
**Branch**: `feat/179-memory-engine` (worktree `ls-179-memory-engine`)
**PR**: #185 (aperta su `main` dalla worktree)
**Data**: 2026-10-28
**Stato**: 🟡 in review — i 5 tipi di ricordo, il feed per rilevanza, la persistenza con `derivedVersion` e l'orchestratore minimale della tranche

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 27-1 | P+F+L | Il **ranking** del ricordo (§7.4) non aveva dove scrivere il suo score: `MemoryPayload` (`02§4`) è chiuso e non ha un campo `score` | Il primo tentativo ha portato ad **aggiungere** `score` al payload, che avrebbe violato una spec APPROVED | La rilevanza ordinata vive in `Insight.confidence` (0..1): il payload resta chiuso e il feed resta ordinabile. Un vincolo di schema che sembra un blocco spesso indica **dove** mettere la cosa | `packages/core/src/analysis/memory/engine.ts` |
| 27-2 | P+L | `Insight.payload` è l'**unione discriminata** di `02§4`: `payload.text` non compila in TypeScript | Il test accedeva ai campi del payload senza restringere il tipo | `memoryPayloadOf(insight)` verifica il `kind` e restituisce il `MemoryPayload`: un narrowing che fallisce sul posto giusto | `packages/core/src/analysis/__tests__/helpers.ts` |
| 27-3 | P+F+L | I test del resolver i18n potevano passare con l'app **rotta** | Copiare i template `memory.*` in una fixture del test avrebbe duplicato il contratto: la chiave spostata nell'app sarebbe rimasta verde | I test del core leggono i **locale reali dell'app** (`apps/web/src/i18n/locales/*.json`), come `db/__tests__/helpers.ts` fa con `fixtures/db-seed/`: una chiave spostata o cancellata nell'app **fallisce** il test del core | `packages/core/src/analysis/__tests__/helpers.ts` |
| 27-4 | P+L | Il **config object** del memory engine non copriva i parametri delle tre famiglie di `milestone` | Il trigger di `04§7.2` elenca eventi, ore e artisti; il registro `04§9` ne elenca sei, e i template `.hours`/`.artists` esistono già in `08§2.15` | Le due soglie in più (`milestoneHours`, `milestoneArtists`) sono **nel config object**, quindi versionate come tutte le altre (`04§1.1`): un parametro che cambia il risultato ma non il `derivedVersion` romperebbe MIG-3. Allargamento **dichiarato** (D.61.1), non silenzioso | `packages/core/src/analysis/memory/types.ts` |
| 27-5 | P+L | `on_this_day` poteva matchare eventi di **anni diversi** | Il pseudocodice della spec usa `isSameDayMonth`, che confronta solo mese e giorno: con `yearsAgo` diventerebbe falso | Il confronto è su **anno, mese e giorno**: la prosa del trigger dice "nella stessa data (mese+giorno) di N anni fa" | `packages/core/src/analysis/memory/onThisDay.ts` |
| 27-6 | P+F+L | Ricalcolare gli insight dello stesso giorno poteva **duplicarli** | Un id casuale (UUID) a ogni run: ogni ricalcolo aggiungeva righe | L'id è **deterministico** (`mem-<giorno>-<kind>-<soggetto>`): il ricalcolo è idempotente per costruzione, e `replaceInsights` sostituisce il periodo in transazione | `packages/core/src/analysis/memory/engine.ts` · `packages/core/src/db/insights.ts` |
| 27-7 | P+L | I **fixture di scenario** non producevano ricordi al giorno dell'ultimo ascolto | I tre fixture coprono **mesi** (lockdown, litigio, viaggio estivo), mentre i trigger dei ricordi coprono **anni** (anniversari) o **soglie** | Il caso noto si osserva spostando "oggi" di un anno avanti (`on_this_day`) o fermandosi sul giorno in cui la soglia è stata raggiunta (`milestone` dei 5000 ascolti del `summer-roadtrip`). Un fixture che "non produce nulla" può essere un fixture che non è mai stato guardato | `packages/core/src/analysis/__tests__/memory-scenarios.test.ts` |

**Lesson learned sintetica**: una spec APPROVED che elenca un trigger in prosa e un parametro in tabella non è una contraddizione: è un invites a **dichiarare** (27-4). E il vincolo più forte del progetto — il payload chiuso di `02§4` — non era un blocco ma una **pista** su dove mettere il ranking (27-1). Il test che legge il contratto vero (i locale reali dell'app) vale più del test che lo ricopia (27-3).

**Esito post-merge**: la PR #185 è **merged** in `main` il 2026-10-28T16:15:43Z (merge commit `40ad0b7`) → l'issue #179 è chiusa con `status:done`. Automazioni: `auto-status-done` (status:done + commento `release:`), `auto-branch-cleanup`, `auto-state-aggregate` (`be98fe7`), `auto-bundle` (`de15099`). Worktree e branch locale eliminati con `scripts/post-merge.ps1` (di nuovo `rd /s /q` con prefisso `\\?\`).

**Il blocco NEXT-STEP è ricaduto sul fallback, ed è la risposta corretta**: con la 2.4 `done` non resta nessuna story non-done e non bloccata fra quelle migrate — la 2.1 è bloccata dalle audio features (D-A.1) e 2.2/2.3 dipendono dalla 2.1 (`[DEP:2.1]`). Non si è creato uno state file per la 2.2 **per non far indicare al blocco una story bloccata a monte**: è esattamente il difetto che la issue #182 ha chiuso. La catena è 4.1 → 2.1 → 2.2/2.3, e il prossimo lavoro è la **spec dell'EPIC 4.1** (issue #180), che non è un'implementazione.

### Link utili

- Branch: `feat/179-memory-engine` (worktree `ls-179-memory-engine`)
- Issue: **#179** (`size:M`, `area:analysis`), claim `kilo-hp-elitebook-hj59`
- Sessione: `docs/state/sessions/61-story-2-4-memory-engine.md`
- Precedenti: **#178** (la ratifica della spec) · **#180** (la 2.1, bloccata dalle audio features) · #161 (il gate sui fatti del README, che la prosa di questa PR rispetta)

## 28. Issue #187 — ratifica della spec dell'EPIC 4.1 (Sessione 62)

**Tipo**: decisione architetturale (`docs`) — issue #187, claim `kilo-hp-elitebook-hj59`
**Branch**: `docs/187-session-62-ratifica` (worktree `ls-187-doc-sync`)
**PR**: **#190** (doc-sync di ratifica, branch `docs/187-session-62-ratifica`, dalla worktree `ls-187-doc-sync`) — merged il 2026-10-29T16:09:16Z, merge commit `b1dd83e` (la **v0.1 🟡 DRAFT** era stata merged dalla PR #189, `87d4d7d` — 2026-10-28T17:02:41Z)
**Data**: 2026-10-28
**Stato**: ✅ completata e **merged** — la PR #190 è stata merged in `main` il 2026-10-29T16:09:16Z (merge commit `b1dd83e`): `docs/21-AUDIO-FEATURES.md` è **v1.0 🟢 APPROVED** (le nove decisioni chiuse come **D-AF.1…D-AF.9**); aperta l'issue **#188** (Story 4.1, `agent-ready`)

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 28-1 | P | La spec dichiarava che il namespace `enrichment.*` andava aggiunto a **`08§2.16`**, ma §2.16 è il namespace **`scrobble.*`** della Story 1.5 | Il riferimento è stato scritto **a memoria** — la sezione esisteva già e l'ha occupata un'altra story | Il namespace è **§2.17** (nuova sezione, con le 8 chiavi e i testi IT/EN); il riferimento è corretto in `21` §14, §18, header e changelog. Un riferimento a una sezione va verificato **contro il file**, non ricordato | `docs/08-COPY-I18N.md` §2.17 · `docs/21-AUDIO-FEATURES.md` §14 |
| 28-2 | P | `08-COPY-I18N.md` era **disallineato con se stesso**: header a v0.6 (Sessione 58), changelog fermo alla 0.6, e `docs/INDEX.md` che dichiarava **v0.7** dal Sessione 59 | I template `memory.*` erano stati aggiunti nella Sessione 59 (ratifica di `04`) **senza una riga di changelog** e senza bump dell'header: nessun gate confronta l'header con la tabella | Riga **0.7** di changelog recuperata (Sessione 59) e nuova riga **0.8** (Sessione 62, namespace `enrichment.*`); header allineato a v0.8. Seconda fonte di verità: l'header va aggiornato **nello stesso atto** che cambia il contenuto | `docs/08-COPY-I18N.md` header · `docs/INDEX.md` riga `08` |
| 28-3 | P | La riga di changelog **1.4** di `05-ARCHITECTURE.md` era stata inserita **prima** della 1.3, con una riga vuota in mezzo | La tabella dei changelog è in ordine di versione crescente: l'inserimento "dopo l'ultima riga nota" ha messo la 1.4 dove stava la 1.3 | La 1.4 è stata spostata **dopo** la 1.3. Stessa classe della lezione 56-5 (una riga di changelog fuori dalla tabella è un documento con l'header rotto): l'ordine della tabella è parte del formato | `docs/05-ARCHITECTURE.md` §Changelog |
| 28-4 | P | Dopo la ratifica, tre documenti **dichiaravano fatti falsi**: l'inventario privacy (`09§4`) nominava solo MusicBrainz, la CSP (`12§2.1`) ammetteva solo MusicBrainz e la riga dei mock (`10§8`) nominava **FreqBlog / Musicae**, due provider mai esistiti | La v0.1 della spec rimandava l'allineamento di `09`, `12`, `10` e `08` all'implementazione: era una scelta ragionevole **prima** della ratifica, ma dopo il merge le decisioni D-AF.1 e D-AF.9 sono **vincolanti** e i documenti che le negano sono falsi | L'allineamento è avvenuto **alla ratifica**, per la regola di `AGENTS.md` §"Chi può scrivere cosa nei file globali" (una sezione che dichiara un fatto cambiato va allineata nella stessa PR); la colonna «Quando» di `21§18` è stata allineata alla realtà e i deliverable `T4.1.11`/`T4.1.12` dichiarano il confine fra i documenti (fatto) e il codice (fixture, CSP applicata al bundle, locale) | `docs/21-AUDIO-FEATURES.md` §18 · `AGENTS.md` §"Chi può scrivere cosa nei file globali" |
| 28-5 | P | La riga legacy "**Documenti APPROVED: 8**" di `docs/INDEX.md` era sbagliata dal Sessione 57: mancava `20`, già APPROVED v1.0 | La riga è una **copia di conteggio** legacy: nessun generatore la aggiorna e nessun gate la confronta con lo stato reale | La riga dichiara ora i **10** documenti APPROVED (`02`, `03-ADAPTERS/`, `04`, `05`, `10`, `11`, `14`, `16-OPERATIONS`, `20`, `21`) con le versioni correnti. Il conteggio delle story resta nei blocchi aggregati: lì si mette un puntatore, non una copia | `docs/INDEX.md` §"Dettaglio (legacy)" |

**Esito post-merge**: la PR #190 è **merged** (`b1dd83e`, 2026-10-29T16:09:16Z). Automazioni: `auto-state-aggregate` (`124a39b`), `auto-bundle` (`9838237`), `auto-status-done`, `auto-branch-cleanup`. L'issue #187 resta chiusa con `status:done` e l'issue **#188** è `agent-ready` con il body riallineato alla spec (gli 11 AC di `21§16`). Il blocco NEXT-STEP del README punta alla **4.1**: è il primo anello della catena 4.1 → 2.1 → 2.2/2.3.

**Lesson learned sintetica**: **ratificare una spec non è promuoverla: è un atto che rende falsi i documenti che la contraddicono** (28-4). La v0.1 rimandava l'allineamento dei documenti all'implementazione, e la decisione era sensata finché le decisioni non erano vincolanti; dopo il merge, l'inventario privacy e la CSP che escludevano i due host nuovi non erano "in attesa di aggiornamento", erano **falsi**, e nessun gate lo segnalava. La lezione operativa è che la ratifica va trattata come una **PR di allineamento**, non come un cambio di un header: l'elenco dei documenti toccati è la metà del lavoro. E la lezione piccola ma ripetuta: un riferimento a una sezione (`08§2.16`) va verificato **contro il file** (28-1) — era un numero di sessione, non di sezione, scambiato per abitudine.

### Link utili

- Branch: `docs/187-session-62-ratifica` (worktree `ls-187-doc-sync`)
- Issue: **#187** (`size:M`, `area:enrichment`, `phase-2`), claim `kilo-hp-elitebook-hj59` · issue di implementazione **#188** (`size:L`, `agent-ready`)
- Spec: `docs/21-AUDIO-FEATURES.md` (v1.0 🟢 APPROVED, D-AF.1…D-AF.9)
- Sessione: `docs/state/sessions/62-epic-4-1-audio-features-spec.md`
- Precedenti: **#178** (ratifica della spec dell'analisi) · **#180** (la 2.1, bloccata dalle audio features) · **#182** (il blocco NEXT-STEP indica solo story lavorabili)

---

## 29. Issue #180 — Story 2.1: il Mood Tracker (Sessione 63)

**Tipo**: feature (`packages/core/src/analysis/mood/`) + persistenza (`db/`) — issue #180, claim `kilo-hp-elitebook-cbd0dc`
**Branch**: `feat/180-mood-tracker` (worktree `ls-180-mood-tracker`)
**PR**: #192 (aperta su `main` dalla worktree)
**Data**: 2026-10-29
**Stato**: 🟡 in review — il motore del mood (giorno, settimana, mese), il filtro per sorgente delle feature, la persistenza con `derivedVersion` e il plug-in dell'orchestratore

| # | Tipo | Sintomo | Causa | Fix / Prevenzione | Rif. |
|---|------|---------|-------|-------------------|------|
| 29-1 | P+L | La story era **bloccata** dalle audio features (D-A.1, `04§11`), ma il **codice** del mood tracker era già interamente specificato (`04§3`) | La D-A.1 leggeva la dipendenza come *sequenza*: senza feature la 2.1 non produce insight. Ma ciò che mancava era il **riempimento** della tabella `features`, non la lettura | Ordine invertito dal project owner il 2026-10-29 (D.63.1): le due story sono **parallele**, **4.1 (dati) → 2.1 (letture)**. Il rischio del "falso verde" si neutralizza da solo: senza feature il motore **non produce niente**, ed è un comportamento testato | `docs/state/stories/2.1-mood-tracker.md` |
| 29-2 | P+F | Il codice avrebbe potuto leggere le feature **euristiche** (stime) e costruire un umore su una stima | `02§3.4` chiude `source` a quattro valori e non dice chi può leggerli; il filtro è definito in `21§12` (D-AF.4), **nella spec dell'EPIC 4.1**, non in `04` | Il filtro per sorgente vive nel **layer di analisi** (`analysis/mood/features.ts`), non dentro il motore: è un contratto fra due moduli e vale per qualunque generatore futuro (D.63.2). Test dedicato: le feature euristiche sono invisibili | `packages/core/src/analysis/mood/features.ts` |
| 29-3 | P+F | Il pseudocodice di `04§3.3` controlla solo `af.valence != null` e pusherebbe `af.energy` **anche quando è `null`** | `02§3.4` dichiara i due campi nullable indipendentemente: il pseudocodice assume che `energy` ci sia quando `valence` c'è | Un ascolto è utilizzabile solo se ha **valence ed energy** (D.63.5): altrimenti la media ponderata produrrebbe `NaN` e l'invariante `avgEnergy ∈ [0, 1]` (`04§3.6`) sarebbe violato | `packages/core/src/analysis/mood/engine.ts` |
| 29-4 | P | L'esempio numerico di **`04§3.5`** non torna: con i suoi stessi input dà **0.570** di valence media e **0.667** di energy media, non 0.585 e 0.675 | Errore aritmetico nella spec (i pesi sono arrotondati, la somma dei prodotti non è quella scritta) | Il codice implementa la **formula** e la **conclusione** dell'esempio (`happy`), che è corretta; la difformità è **segnalata** in un'issue `docs`: `04` è APPROVED e non si modifica da un agente | `docs/04-ANALYSIS-ALGORITHMS.md` §3.5 |
| 29-5 | P+L | `04§3.2` (tabella) e `04§3.3` (pseudocodice) danno risultati diversi per `0.49 / 0.50` | La tabella mette `angry` (valence < 0.5, energy ≥ 0.5), la nota dice che `neutral` sovrascrive le quattro classi "se entrambe le coordinate sono nella fascia [0.4, 0.6]" — e 0.49 è nella fascia | Il codice segue il **pseudocodice**, che controlla la fascia neutra per prima: è l'unico dei due criteri che non richiede di scegliere. Test dedicato alla precedenza | `packages/core/src/analysis/mood/classify.ts` |
| 29-6 | P+F | Il ricalcolo degli insight di **tutti** i periodi (giorni, settimane, mesi) avrebbe aperto una transazione per ogni giorno | `replaceInsights` (Story 2.4) sostituisce gli insight di **un** `periodStart` | `replaceInsightsOfType` (D.63.11): una transazione che rimuove gli insight `stale` (MIG-3) e quelli dei periodi ricalcolati, e **lascia intatti** gli altri periodi dello stesso tipo (ricalcolo incrementale, `04§1.2`) | `packages/core/src/db/insights.ts` |
| 29-7 | P+L | Il **vocabolario temporale** (confine UTC, `eventTime`) viveva dentro `analysis/memory/`, e il mood tracker avrebbe dovuto importarlo da lì | Il memory engine era il primo modulo dell'EPIC 2 e ha creato gli helper; il secondo modulo li trovava "già scritti" nel posto sbagliato | Gli helper generici sono saliti a `analysis/datetime.ts` e `analysis/memory/datetime.ts` li riusa: due moduli, un vocabolario, nessuna dipendenza fra sibling | `packages/core/src/analysis/datetime.ts` |

**Lesson learned sintetica**: un blocco dichiarato dalla spec può essere una **scelta di sequencing**, non un blocco di codice (29-1): la D-A.1 proibiva di consegnare una story che non produce nulla, ma il codice era già interamente specificato — mancava il **riempimento** della tabella, non la lettura. Separare le due cose rende le story parallele. E il contratto fra due moduli (il filtro per sorgente delle feature) va codificato dove vale per entrambi, non dentro il generatore che lo usa per primo (29-2).

### Link utili

- Branch: `feat/180-mood-tracker` (worktree `ls-180-mood-tracker`)
- Issue: **#180** (`size:M`, `area:analysis`), claim `kilo-hp-elitebook-cbd0dc`
- Sessione: `docs/state/sessions/63-story-2-1-mood-tracker.md`
- Precedenti: **#178** (la ratifica della spec dell'analisi) · **#187** (la spec dell'EPIC 4.1, da cui il contratto `getAudioFeatures` filtrato per sorgente) · **#188** (la Story 4.1: il percorso dati, ancora da fare)

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
| 2.2 | 2026-10-27 (issue #168) | **§22 Issue #168 — ADR-0011 "contratto di scrittura negli hub"** (Sessione 56, claim `kilo-hp-elitebook-41xb`, PR #170): 5 lesson (56-1 un ADR che dichiara **dove vive** un contratto e una spec che dichiara **cosa contiene** un protocollo non sono lo stesso atto: il primo è architetturale (`05§4` è APPROVED → serve ADR), il secondo è di protocollo (🟡 DRAFT → serve ratifica); confonderli crea un blocco — finché la spec è DRAFT, i documenti APPROVED che essa tocca (`02`, `09`, `08`) non si possono modificare, e l'ADR deve **dichiarare** l'elenco dei documenti da aggiornare senza toccarli; 56-2 la simmetria con il precedente ADR è la leva della decisione: `parseRemote?()` ha risolto "l'adapter non ha un file" con un metodo opzionale, "l'hub non è un adapter" si risolve con un'interfaccia dedicata — stessa forma, opposta direzione; 56-3 `recoverable` non è un nome neutro: la stessa bandiera booleana con due semantiche (`AdapterError` = "persistito", `ScrobbleError` = "ritentabile") è un errore di remediation, quindi la classe di errore va nominata e tipizzata per il dominio che descrive; 56-4 il payload chiuso per costruzione (dal tipo, non dalla policy) è la forma forte di una promessa di privacy: "non inviare l'IP" è una promessa che un refactor dimentica, un campo inesistente non può essere inviato; 56-5 una riga di changelog appesa fuori dalla tabella non è un difetto di formattazione: è un documento con l'header rotto — la riga della v1.2 di `05-ARCHITECTURE.md` stava **prima del titolo**, e i gate che contano le versioni non lo vedono). ADR `docs/13-ADR/0011-scrobble-sink.md` v0.1 🟡 DRAFT: decisione A1 (`ScrobbleSink` separato da `PlatformAdapter`), vincoli V1-V10, alternative A2-A5 scartate, garanzie G-SH.1…G-SH.6 recepite dalla spec; `05§4.2` aggiunta (v1.3) |
| 2.3 | 2026-10-27 (issue #168) | **§22 — ratifica dell'ADR-0011**: il merge della PR #170 (`8900c3b`, 2026-10-27T16:31:39Z) è la ratifica del Boss → `docs/13-ADR/0011-scrobble-sink.md` passa da 🟡 DRAFT v0.1 a **🟢 APPROVED v1.0**, **nessuna modifica di contenuto** (stesso pattern di ADR-0010, PR #152 → commit di promozione `90aded0`). Il punto aperto 1 della spec (`20§18`) è chiuso: restano i punti 2-5, che sono decisioni di **protocollo** e non del contratto. Doc-sync: `05-ARCHITECTURE.md` (riga degli ADR collegati: 0011 🟢 APPROVED v1.0), `docs/INDEX.md` (riga `13-ADR/`, ADR APPROVED 8 → **9**, riga `11`, "Prossimo step tecnico"), `docs/11-BACKLOG.md` (Story 1.5: dipendenza **soddisfatta**, AC `[x]`, riga roadmap, v1.6.15), `docs/state/sessions/56-*.md` (`state: 🟢`, `merged: true`, merge commit `8900c3b`), `docs/state/_index.md`, `docs/20-SCROBBLING-HUB.md` §18 punto 1. Esito post-merge: `auto-status-done` ha applicato `status:done` a #168 e chiuso l'issue, `auto-branch-cleanup` ha eliminato il branch remoto, `auto-state-aggregate` + `auto-bundle` hanno rigenerato i blocchi; worktree e branch locale eliminati con `scripts/post-merge.ps1` (la rimozione della worktree ha richiesto `rd /s /q` con prefisso `\\?\`: `git worktree remove` fallisce con "Result too large" su path Windows lunghi con `node_modules`) |
| 2.4 | 2026-10-27 (issue #172) | **§23 Issue #172 — ratifica della spec Scrobbling hub** (Sessione 57, claim `kilo-hp-elitebook-41xb`, PR #174): 5 lesson (23-1 la stessa classe di difetto della Sessione 56 — la riga di changelog appesa **prima del titolo** — si era riprodotta in `02-DATA-SCHEMA.md`: la scansione di tutti i `.md` di `docs/` (prima riga che comincia con `| <version> |`) è il rilevatore economico della classe; 23-2 l'header di un documento è una **seconda fonte di verità**: cinque documenti dichiaravano una versione più vecchia del proprio changelog, e nessun gate li confronta; 23-3 **ratificare una spec non è promuoverla**: chiudere i punti aperti modifica regole normative (T-SH.3, T-SH.4, E.SH.10, E.SH.11, finestra, modalità proxy) e le modifiche vanno **dichiarate**, perché la regola "i documenti APPROVED non si modificano su una spec DRAFT" ha senso solo se l'effetto è esplicito; 23-4 una regola di default va giudicata su **quanti utenti reali la superano**: "durata ignota → non maturo" era la più prudente e la meno utile (escludeva la maggior parte degli ascolti degli utenti Last.fm/ListenBrainz) → D-SH.13 soglia dei 4 minuti + fiducia nella fonte; 23-5 issue di decisioni e issue di implementazione nate nella stessa sessione: la transizione `needs-spec` → `agent-ready` è avvenuta solo con l'assegnazione esplicita del project owner, e le due issue hanno esiti opposti — #172 chiusa con `status:done`, #173 aperta `agent-ready`). `docs/20-SCROBBLING-HUB.md` v0.2 🟡 DRAFT → **v1.0 🟢 APPROVED** con le quattro decisioni chiuse come **D-SH.11…D-SH.14** (§2.1): md5 in JS puro, finestra a 7 giorni + azione esplicita, soglia dei 4 minuti con fiducia nella fonte, modalità del proxy dichiarata. Allineati i documenti che la spec tocca (`02§3.8`+`§6.2`, `09§3.3`+`§4`, `08§1`+`§2.16`, `03-ADAPTERS/lastfm.md` §4+§10, `03-ADAPTERS/listenbrainz.md` §3.4+D-LB.5, `01§3.7-3.9`), i casi di test da 29 a **31**. Aperti `docs/state/stories/1.5-scrobbling-hub.md` e l'**issue di implementazione #173** (`agent-ready`, `size:L`) |
| 2.5 | 2026-10-27 (issue #172) | **§23 — esito post-merge della ratifica**: la PR #174 è **merged** (`4abb73e`, 2026-10-27T16:59:24Z) → `docs/20-SCROBBLING-HUB.md` è **v1.0 🟢 APPROVED** e l'issue #172 è chiusa con `status:done`. Doc-sync di chiusura in una PR `docs:` separata (frontmatter della Sessione 57 con `pr: 174`, `merged: true` e merge commit, più la sezione "Esito post-merge"): il numero della PR non era noto quando il file è stato scritto, e D.21.1 vuole il doc-sync **nel branch della PR** — impossibile per il PR number, che si conosce solo dopo l'apertura. L'alternativa (scrivere `pr: 192` e correggere dopo) è quella scelta, ed è la ragione per cui il blocco aggregato mostrava "PR #0" per la Sessione 57. Automazioni: `auto-status-done` (status:done su #172), `auto-branch-cleanup`, `auto-state-aggregate` (`c27fc1f`), `auto-bundle` (`4002520`); worktree e branch locale eliminati con `scripts/post-merge.ps1` (di nuovo `rd /s /q` con prefisso `\\?\`: `git worktree remove` fallisce con "Result too large" su path Windows lunghi con `node_modules`) |
| 2.6 | 2026-10-28 (issue #173) | **§24 Issue #173 — Story 1.5 implementata** (Sessione 58, claim `kilo-hp-elitebook-41xb`, PR #176): 6 entry (24-1 il **test di performance** misurava il **carico del runner**, non il layer DB: con tre file di test in più la suite parallela faceva superare la soglia locale di 500 ms, e la verifica decisiva fu togliere i file nuovi con la tabella già presente → il test gira ora in una **run separata**, con la soglia dell'AC invariata; 24-2 `db/health.ts` dichiarava la versione attesa 4 mentre lo schema corrente è **5** (falso "schema sotto l'attesa"); 24-3 `db.test.ts` contava 13 tabelle: `scrobbleOutbox` è la 14ª; 24-4 il tipo di dominio `ScrobbleHubId` sta in `schema/index.ts` perché il **db non deve dipendere dagli adapter** (`05§9.2` parla di package, non di moduli: il ciclo fra moduli nessun gate lo misura); 24-5 i brani si risolvono con una **scansione** (`tracks` ha PK `canonicalKey`, `id` non è indicizzato), come in `db/orphan-cleanup.ts`; 24-6 il delay di retry del protocollo è una **capacità opzionale** del sink (`retryDelayMs()`), così il contratto approvato `05§4.2` resta intatto e il protocollo resta nel sink (V9)). Consegnati i 15 deliverable di `20§16`: contratto `ScrobbleSink`, registry, sink Last.fm (md5 JS puro, batch 50, POST via proxy) e ListenBrainz (`submit-listens`), coda `scrobbleOutbox` (schema Dexie v5, write-ahead, backoff con jitter), filtro di eleggibilità `20§5` con D-SH.13, `parseRemote?()` incrementale con cursore persistito, web auth Last.fm, pannello UI, namespace i18n `scrobble`; **31 casi di test** coperti (267 in `@ls/core`, 91 in `@ls/web`). **AC-SH.11 parzialmente soddisfatto** (MBID → DEDUP-2 ✓; `track.genres` via MusicBrainz ✗ → EPIC 4) |
| 2.7 | 2026-10-28 (issue #178) | **§25 Issue #178 — ratifica della spec dell'analisi** (Sessione 59, claim `kilo-hp-elitebook-41xb`, PR #181): 4 entry (25-1 i **template i18n dei ricordi esistevano già** (`08§2.15`) e la prima stesura della ratifica li **rinominava** con parametri diversi: una spec che ratifica non può rinominare un contratto già dichiarato — le formule sono state riallinate alle chiavi esistenti e `08§2.15` le dichiara vincolanti; 25-2 il ricordo **stagionale** era per artista nella spec e per genere nel template: decisione D-A.7 (per genere, con l'informazione nel `text` reso); 25-3 la sezione dei template era stata inserita come **§2.13** in collisione con `error.*`: rimossa e la nota di vincolanza messa dentro §2.15; 25-4 la **Story 2.1** dipendeva dalle **audio features** (EPIC 4.1) senza che nessun documento lo dicesse: la dipendenza è ora in `04§12`, nel backlog e nell'issue #180 — consegnare la 2.1 senza feature sarebbe stato un falso verde). `docs/04-ANALYSIS-ALGORITHMS.md` v0.2 🟡 DRAFT → **v1.0 🟢 APPROVED** con le cinque decisioni chiuse come proposte (**D-A.1…D-A.5**, §11): la **Story 2.4** (Memory Engine) è implementabile (issue **#179**, `agent-ready`), la **Story 2.1** (Mood Tracker) aspetta le audio features dell'EPIC 4.1 (issue **#180**, `needs-spec`). Allineati `08-COPY-I18N.md` §2.15 (v0.7), `11-BACKLOG.md` (Story 2.1/2.4, priorità agenti, v1.6.18), `docs/INDEX.md` (riga 04, conteggi legacy), `docs/state/` (sessione 59 + le story 2.1 e 2.4) |
| 2.8 | 2026-10-28 (issue #173) | **§24 — esito post-merge della Story 1.5**: la PR #176 è **merged** (`bfb5946`, 2026-10-28T13:56:09Z) → l'issue #173 è chiusa con `status:done` e la story 1.5 è `done`: il percorso di scrittura verso Last.fm e ListenBrainz è consegnato. Doc-sync di chiusura (frontmatter della Sessione 58 con `merged: true` e merge commit, `merged_commit`/`merged_date` della story 1.5, §24 aggiornato). Automazioni: `auto-status-done`, `auto-branch-cleanup`, `auto-state-aggregate` (`669cc82`), `auto-bundle` (`6388d12`); worktree e branch locale eliminati con `scripts/post-merge.ps1` (di nuovo `rd /s /q` con prefisso `\\?\`: `git worktree remove` fallisce con "Result too large" su path Windows lunghi con `node_modules`). **AC-SH.11 resta parzialmente soddisfatto**: `track.genres` via lookup MusicBrainz dipende dall'enrichment (EPIC 4) |
| 2.9 | 2026-10-28 (issue #178) | **§25 — esito post-merge della ratifica della spec dell'analisi**: la PR #181 è **merged** (`5f725e3`, 2026-10-28T14:28:05Z) → l'issue #178 è chiusa con `status:done` e `04-ANALYSIS-ALGORITHMS.md` è **v1.0 🟢 APPROVED**. Doc-sync di chiusura (frontmatter della Sessione 59 con `merged: true`, merge commit e `pr: 181`, sezione "Esito post-merge"). Le issue **#179** (Story 2.4, `agent-ready`) e **#180** (Story 2.1, `needs-spec`: bloccata dalle audio features dell'EPIC 4.1) restano aperte e non transizionate: sono il lavoro di altri |
| 2.10 | 2026-10-28 (issue #182) | **§26 — il blocco NEXT-STEP indica solo story lavorabili** (Sessione 60, claim `kilo-hp-elitebook-41xb`, PR #183): il filtro di `Build-Block-NextStep` esclude ora `done`, **`blocked`** e **`wontdo`** — il puntatore passava dalla **2.1** (bloccata dalle audio features dell'EPIC 4.1, decisione D-A.1) alla **2.4** (Memory Engine, issue #179), la story implementabile. Il messaggio di fallback e la riga delle altre candidate dicono "non-done **e non bloccate**": se il conteggio cambia, la frase che lo descrive cambia con lui. Il valore `blocked` esisteva nella macchina a stati (ADR-0007, `11-BACKLOG.md`) ma **mai** in un `docs/state/stories/*.md`: il primo file che lo usa (la 2.1, Sessione 59) ha reso visibile il disallineamento. Allineati `AGENTS.md` (v1.28), `docs/state/_index.md` (i **valori** di `status` nello schema), `docs/12-DEVOPS.md` (§9.8g nuova). Test: `scripts/test-aggregate-determinism.sh` **37 assert** (T10e e T10f nuovi, verificati in entrambe le direzioni: senza il fix 4 assert falliscono) |
| 2.11 | 2026-10-28 (issue #182) | **§26 — esito post-merge**: la PR #183 è **merged** (`a350386`, 2026-10-28T15:26:17Z) → l'issue #182 è chiusa con `status:done` e `auto-state-aggregate` (`ab83763`) ha rigenerato il blocco NEXT-STEP del README, che ora indica la **2.4** (Memory Engine) invece della 2.1 bloccata. Doc-sync di chiusura in una PR `docs:` separata (frontmatter della Sessione 60 con `pr: 183`, `merged: true` e merge commit) |
| 2.12 | 2026-10-28 (issue #179) | **§27 Issue #179 — Story 2.4 implementata** (Sessione 61, claim `kilo-hp-elitebook-hj59`, PR #185): 7 entry (27-1 il **ranking** non aveva dove scrivere il suo score — `MemoryPayload` (`02§4`) è chiuso: la rilevanza ordinata vive in `Insight.confidence`, il payload resta intatto; 27-2 `Insight.payload` è l'unione discriminata: `payload.text` non compila senza restringere il tipo (`memoryPayloadOf`); 27-3 i test del resolver i18n leggono i **locale reali dell'app**: una chiave spostata nell'app fallisce il test del core, non viceversa; 27-4 il **config object** versiona anche `milestoneHours` e `milestoneArtists`: le tre famiglie del trigger `04§7.2` sono implementate e i due parametri in più sono dichiarati (D.61.1); 27-5 `on_this_day` confronta anno+mese+giorno: `isSameDayMonth` (solo mese+giorno) avrebbe matchato eventi di anni diversi; 27-6 l'id dell'insight è **deterministico**: il ricalcolo è idempotente e non duplica le righe; 27-7 i **fixture di scenario** coprono mesi e i trigger dei ricordi coprono anni: il caso noto si osserva spostando "oggi" di un anno avanti). Consegnati: i 5 generatori, il ranking `baseScore × relevance × recency`, la persistenza degli insight `memory` con `derivedVersion` e rilevamento degli insight `stale` (MIG-3), l'orchestratore minimale (`04§8.1`, D-A.5) e il testo reso dal resolver i18n (D-A.4). **27 test** nuovi in `@ls/core` + **5** in `@ls/web` |
| 2.13 | 2026-10-28 (issue #179) | **§27 — esito post-merge della Story 2.4**: la PR #185 è **merged** (`40ad0b7`, 2026-10-28T16:15:43Z) → l'issue #179 è chiusa con `status:done` e la story 2.4 è `done` con il merge commit nel frontmatter. Automazioni: `auto-status-done`, `auto-branch-cleanup`, `auto-state-aggregate` (`be98fe7`), `auto-bundle` (`de15099`); worktree e branch locale eliminati con `scripts/post-merge.ps1` (di nuovo `rd /s /q` con prefisso `\\?\`). Il blocco NEXT-STEP ricade sul fallback "nessuna story non-done e non bloccata migrata": è la risposta **corretta** (la 2.1 è bloccata dalle audio features dell'EPIC 4.1 e 2.2/2.3 dipendono da lei) e per questo **non** si è creato uno state file per la 2.2 — un blocco che punta a una story bloccata a monte è il difetto chiuso dalla issue #182. La catena è 4.1 → 2.1 → 2.2/2.3: il prossimo lavoro è la **spec dell'EPIC 4.1** (issue #180), non un'implementazione |
| 2.14 | 2026-10-28 (issue #187) | **§28 Issue #187 — ratifica della spec dell'EPIC 4.1** (Sessione 62, claim `kilo-hp-elitebook-hj59`; la v0.1 🟡 era stata merged dalla PR #189, `87d4d7d`: la **ratifica a v1.0 🟢** è l'atto di questa PR): 5 entry (28-1 la spec dichiarava che il namespace `enrichment.*` andasse in `08§2.16`, ma §2.16 è `scrobble.*` della Story 1.5: il namespace è **§2.17** e i riferimenti sono stati corretti in `21` §14, §18, header e changelog; 28-2 `08-COPY-I18N.md` era disallineato con se stesso (header v0.6, changelog 0.6, `INDEX` che dichiarava v0.7 dal Sessione 59): riga 0.7 recuperata, nuova riga 0.8, header a v0.8; 28-3 la riga 1.4 di `05-ARCHITECTURE.md` era stata inserita **prima** della 1.3: spostata dopo; 28-4 dopo la ratifica tre documenti dichiaravano **fatti falsi** (l'inventario `09§4`, la CSP `12§2.1`, la riga dei mock `10§8`): l'allineamento è avvenuto **alla ratifica**, come prescrive `AGENTS.md` §"Chi può scrivere cosa nei file globali", e i deliverable `T4.1.11`/`T4.1.12` dichiarano il confine fra i documenti (fatto) e il codice (fixture, CSP applicata al bundle, locale); 28-5 la riga legacy "Documenti APPROVED: 8" di `docs/INDEX.md` era sbagliata dal Sessione 57 (mancava `20`): ora 10, con `21`). `docs/21-AUDIO-FEATURES.md` v0.1 🟡 DRAFT → **v1.0 🟢 APPROVED** con le nove decisioni chiuse come proposte (**D-AF.1…D-AF.9**): la fonte dell'audio è il preview di 30 s dell'**iTunes Search API**, il modello valence/energy è **DEAM**, l'euristico **non** alimenta il mood tracker, il codice sta in `core` **senza React**, il rate limit di AcousticBrainz si legge dagli header, la CSP ha due host in più. Allineati `05` (v1.4), `08` (v0.8, `08§2.17`), `09` (v0.6), `10` (v1.1), `11` (v1.6.22, Story 4.1 implementabile), `12` (v1.0), `14` (v1.1), `docs/INDEX.md` (riga `21`, conteggi legacy, "Prossimo step tecnico") e `docs/state/` (sessione 62 + la story 4.1). Issue di implementazione **#188** aperta `agent-ready` |
| 2.15 | 2026-10-29 (issue #187) | **§28 — esito post-merge della ratifica**: la PR #190 è **merged** (`b1dd83e`, 2026-10-29T16:09:16Z) → l'issue #187 resta chiusa con `status:done` e l'issue di implementazione **#188** è `agent-ready` con il body riallineato alla spec (gli 11 AC di `21§16`). Automazioni: `auto-state-aggregate` (`124a39b`), `auto-bundle` (`9838237`), `auto-status-done`, `auto-branch-cleanup` (branch remoto eliminato). Il blocco NEXT-STEP del README ricade sulla **Story 4.1**: è la risposta **corretta** (la 2.1 resta bloccata dalle audio features, D-A.1) e la catena 4.1 → 2.1 → 2.2/2.3 riparte. Il doc-sync di chiusura (frontmatter con `pr: 190` e merge commit) è in una PR `docs:` separata: il merge commit si conosce solo dopo il merge |

| 2.16 | 2026-10-29 (issue #180) | **§29 Issue #180 — Story 2.1 implementata** (Mood Tracker, Sessione 63, claim `kilo-hp-elitebook-cbd0dc`, PR #192): 7 entry (29-1 la story era **bloccata** dalle audio features (D-A.1), ma il **codice** era già interamente specificato (`04§3`): a mancare era il **riempimento** della tabella `features`, non la lettura — l'ordine è stato invertito dal project owner (D.63.1) e le due story sono ora parallele, **4.1 (dati) → 2.1 (letture)**; 29-2 il filtro per sorgente delle feature vive nel **layer di analisi** e non dentro il motore: è un contratto fra due moduli (`21§12`, D-AF.4) e vale per qualunque generatore futuro (D.63.2); 29-3 il pseudocodice di `04§3.3` controlla solo `valence` e pusherebbe `energy` **null** → `NaN`: un ascolto è utilizzabile solo se ha entrambi (D.63.5); 29-4 l'esempio di `04§3.5` **non torna** (0.570/0.667 calcolati, non 0.585/0.675): il codice implementa la formula e la conclusione (`happy`), la difformità è segnalata in un'issue `docs` perché `04` è APPROVED; 29-5 `04§3.2` e `04§3.3` danno risultati diversi per `0.49/0.50` (`angry` vs `neutral`): il codice segue il **pseudocodice**, che controlla la fascia neutra per prima; 29-6 il ricalcolo di **tutti** i periodi avrebbe aperto una transazione per ogni giorno: `replaceInsightsOfType` (D.63.11) ne fa una sola e lascia intatti gli altri periodi dello stesso tipo (ricalcolo incrementale); 29-7 il vocabolario temporale è salito da `analysis/memory/datetime.ts` a `analysis/datetime.ts`: due moduli, un vocabolario, nessuna dipendenza fra sibling). Consegnati: il motore in `packages/core/src/analysis/mood/` (periodi UTC di giorno, settimana e mese, media ponderata per durata, mappa dei sei quadranti, invarianti `04§3.6`), la persistenza degli insight `mood_day`/`mood_week`/`mood_month` con `derivedVersion` (`04§9`) e rilevamento degli insight `stale` (MIG-3), il plug-in `createMoodGenerator` dell'orchestratore (`04§8.1`, D-A.5). **51 test** nuovi in `@ls/core` (classificazione, periodi, persistenza, fixture di scenario) |

---

*Questo file viene aggiornato ad ogni implementazione chiusa. È letto durante l'handoff
tra conversazioni AI e durante l'audit di Sessione (vedi `AGENTS.md` §"Fine di un'implementazione").*
