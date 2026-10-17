# 18 — Diario di Sviluppo (problemi, fix, lesson learned)

> Status: 🟡 DRAFT
> Versione: 0.6
> Ultima modifica: 2026-10-17 — doc-sync post-merge PR #4 (Story 0.2 merged)
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
**PR**: **#15 — merge `<da-compilare>` in `main` (2026-10-17)**
**Issue**: #15 (claim `kilo-HP-ELITEBOOK-r9p2`)
**Stato**: 🟡 in corso (post-merge compile)

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
- PR: **#15** (merge commit `<da-compilare>`, 2026-10-17)
- Issue: #15 (claim `kilo-HP-ELITEBOOK-r9p2`)
- Spec introdotte: AGENTS.md v1.5 (push early, session checklist, hook setup)
- Spec toccate: `package.json` (postinstall), `docs/INDEX.md` (S20), `docs/SESSIONS.md` (Sessione 20 + changelog), `docs/18-DEV-LOG.md` (§9 + changelog), `scripts/setup-hooks.js` (nuovo), `.githooks/pre-commit` (nuovo), `.githooks/README.md` (nuovo)

---

## Changelog

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

---

*Questo file viene aggiornato ad ogni implementazione chiusa. È letto durante l'handoff
tra conversazioni AI e durante l'audit di Sessione (vedi `AGENTS.md` §"Fine di un'implementazione").*
