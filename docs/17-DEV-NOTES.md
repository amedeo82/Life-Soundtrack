# 17 — Note di sviluppo (toolchain & workflow)

> Status: 🟡 DRAFT
> Versione: 0.2
> Ultima modifica: 2026-10-16 — implementazione Story 0.2 (Sessione 14)
> Scopo: raccogliere i problemi già incontrati e risolti durante il setup, così che
> nessuna sessione futura li ripeta. Collegato in `docs/INDEX.md` (Documenti di supporto).

---

## 1. Comandi di sviluppo

| Comando | Cosa fa |
|---------|---------|
| `pnpm install` | Installa tutto il workspace (attiva anche gli hook Husky via script `prepare`) |
| `pnpm run lint` | ESLint 9 flat config su tutti i package (via Turborepo, cacheato) |
| `pnpm run typecheck` | `tsc --noEmit` per package |
| `pnpm run test` | Vitest in tutti i package con test |
| `pnpm run test:coverage` | Coverage (provider v8); in `@ls/core` esclude i test di performance (`perf.test.ts`, vedi P9) |
| `pnpm run build` | `tsc` → `dist/` per `@ls/core` e `@ls/ui`, `vite build` per `@ls/web` |
| `pnpm run e2e` | Playwright su `apps/web` (al primo avvio serve `pnpm exec playwright install chromium`) |
| `pnpm run format` / `format:check` | Prettier (i doc in `docs/`, `fixtures/`, `design/` sono esclusi via `.prettierignore`) |
| `pwsh scripts/generate-bundle.ps1 --check` (CI) / `powershell scripts/generate-bundle.ps1 -Check` (locale Win PS 5.1) | Verifica sync bundle. ⚠ In PowerShell 5.1 il flag è `-Check`, non `--check` |

Requisiti: Node ≥ 20 (testato su 20 LTS e 24), pnpm 9 (pinnato in `packageManager`).

## 2. Struttura monorepo

Target definitivo in `05-ARCHITECTURE.md` §9. Riepilogo vivo:

    apps/web        @ls/web   PWA React 19 + Vite 6 (orchestra tutto)
    packages/core   @ls/core  foglia runtime-agnostic (schema, db, logger, adapters, analysis, enrichment)
    packages/ui     @ls/ui    design system (importa SOLO tipi da core)
    packages/config @ls/config  preset condivisi: tsconfig, eslint, vitest

- Alias TS: `@core/*`, `@ui/*`, `@web/*` → sorgenti dei package (usati negli import interni).
- I package espongono anche exports map `@ls/core`/`./schema`, `./db`, `./logger` su `dist/` (§9.1).
- Regola aciclica (§9.2): `core` non importa nulla di interno; `ui` solo tipi da `core`; `web` orchestra.

## 3. Pitfalls toolchain (risolti — non ripetere)

### P0 — Policy versioni (D.10.1/D.10.2): gli avvisi di update sono attesi

- Durante `pnpm install` compaiono avvisi tipo "Update available! 9.15.9 → 12.11.2" (pnpm) e
  `WARN deprecated eslint@9.39.5`: sono **noti e voluti**. La policy (D.10.1) prevede ultime
  major come target, ma l'upgrade corrente è **differito a fine implementazione** (D.10.2,
  Story 6.1 `[PHASE-POST]` in `11-BACKLOG.md` v1.2). Fino ad allora: **non bumpare major**
  di toolchain (pnpm, ESLint, Vite, Vitest, React) nelle story correnti.

### P1 — Vitest e Vite: usa Vitest ≥ 3 con Vite 6

- **Sintomo**: `typecheck` fallisce in `apps/web/vite.config.ts` con `TS2345`/`TS2769`
  (`PluginOption` non assegnabile) e negli errori compaiono **due percorsi** `vite@5.x` e
  `vite@6.x` dentro `node_modules/.pnpm`.
- **Causa**: Vitest 2.1.x dipende da Vite 5; con Vite 6 nell'app, `vitest/config` e `vite`
  espongono tipi da due istanze diverse di Vite.
- **Soluzione**: Vitest `^3.0.5` + `@vitest/coverage-v8` `^3.0.5` in tutti i package che
  testano (pnpm deduplica → una sola istanza di Vite 6). Lo stack richiesto è "Vitest 2+":
  Vitest 3 lo soddisfa ed è la major corrente (D.10.1). **Quando si aggiorna Vite, allineare
  Vitest nella stessa PR; upgrade major differiti a Story 6.1 (D.10.2).**

### P2 — I `paths` TS vanno dichiarati nel tsconfig del package che li usa

- **Sintomo**: `TS2307: Cannot find module '@core/schema'` anche con `paths` nel preset
  condiviso; oppure `TS5090: Non-relative paths are not allowed when 'baseUrl' is not set`.
- **Causa**: i `paths` ereditati via `extends` da un tsconfig condiviso non si risolvono in
  modo affidabile rispetto al file dichiarante; inoltre i valori non-relativi richiedono
  `baseUrl`.
- **Soluzione**: dichiarare `paths` in `apps/web/tsconfig.json` con percorsi relativi al file
  (`"../../packages/core/src/*"`) e prefisso `./` per i path interni (`"./src/*"`). Non
  rimettere `paths` in `packages/config/tsconfig/base.json`.

### P3 — Line endings + timestamp: `--check` non deterministico su Windows

- **Sintomo**: `generate-bundle.ps1 --check` fallisce su Windows con "Lista file identica, ma
  contenuto cambiato" anche senza modifiche ai documenti. Fallisce ad ogni run se l'orologio
  di sistema cambia tra due esecuzioni.
- **Causa**: (1) il bundle include una riga `> Data: <timestamp>` che cambia ad ogni run;
  (2) il bundle rigenerato in memoria su Windows usa CRLF, mentre il file committato ha LF
  (estratti da `.gitattributes` o da CI/Linux). Nessuna delle due differenze viene normalizzata
  prima del confronto.
- **Soluzione**: in `scripts/generate-bundle.ps1` (§9.7), sia `$existing` che `$newBundle`
  vengono normalizzati prima del confronto: la riga `> Data: .+` viene sostituita con
  `> Data: 0000-00-00 00:00` e i `CRLF` vengono collassati a `LF`. Il check è ora
  deterministico e continua a rilevare drift reali (file aggiunti/rimossi, contenuto modificato).
  Mantieni `.gitattributes` con `* text=auto eol=lf` per coerenza tra piattaforme.

### P4 — exports map di `@ls/config`: serve la condizione `types` per i preset JS

- **Sintomo**: `TS7016: Could not find a declaration file for module '@ls/config/vitest/base'`.
- **Causa**: un subpath wildcard come `"./vitest/*": "./vitest/*"` (senza estensione) non fa
  risolvere a TypeScript il `.d.ts` sibling del `.js`.
- **Soluzione**: subpath esplicito con condizioni —
  `"./vitest/base": { "types": "./vitest/base.d.ts", "default": "./vitest/base.js" }`.
  Stesso pattern per eventuali nuovi preset JS consumati da file TS.

### P5 — Convenzioni che evitano ritordi

- ESLint preset: non chiamare `react` l'import di `eslint-plugin-react` se il modulo esporta
  a sua volta un binding `react` (collisione `Identifier 'react' has already been declared`).
- Nuovo file in `docs/` ⇒ aggiornare `$files` in `scripts/generate-bundle.ps1` e rigenerare
  `docs/BUNDLE.md` nella stessa PR (vedi `AGENTS.md` §Manutenzione del bundle).
- Commit: Conventional Commits (hook `commit-msg` con commitlint); pre-commit: lint-staged.
- I test leggono i fixture da `fixtures/synthetic-history/` (spec `10-TESTING.md` §3).

### P6 — Dexie 4: `modify()` esiste solo su `Collection` (non su `Table`)

- **Sintomo**: `TypeError: db.tracks.modify is not a function`.
- **Causa**: `modify()` è un metodo di `Collection`; su `Table` esiste solo `update(key, changes)`.
- **Soluzione**: per modifiche in blocco usare `db.<table>.toCollection().modify(fn)` o un
  `where(...).modify(fn)` dentro una transazione (`db.transaction('rw', db.<tables>, async () => ...)`).
  Altri punti Dexie: `db.verno` è affidabile anche prima di `open()`; la chiave primaria di una
  tabella dichiarata `'&x, ...'` è `x` (unica); non esiste `Dexie.openOrCreate()` statico — usare
  `new <Db>(name)` + `await db.open()`.

### P7 — fake-indexeddb: bulkPut su chiavi **esistenti** attraversa uno slow-path costoso

- **Sintomo**: re-put di 5k eventi già presenti > 5s (timeout dei test), mentre l'insert fresh
  della stessa mole è ~150ms; i test successivi ereditano timeout a cascata.
- **Causa**: il fallback di `bulkPut` (bulkAdd fallito → risoluzione per chiave) fa scan per
  chunk, superlineare in fake-indexeddb (in IndexedDB nativo è nativo e veloce).
- **Soluzione**: nei test, verificare il re-import su **slice** (decine di eventi) e coprire
  l'idempotenza integrale su tabelle piccole (100 eventi); l'invariante resta garantito dalla
  PK unique. Il re-import integrale a 50k è AC della Story 0.3 e gira nel browser.

### P8 — `@ls/core` ha due barrel: non confondere `../index` (db) con `../../index` (radice)

- **Sintomo**: `TS2305: Module '"../index"' has no exported member 'Track'` da `src/db/__tests__/`;
  oppure `ReferenceError: LifeSoundtrackDB is not defined` a runtime con `import type` + `new`.
- **Causa**: da `src/db/__tests__/` il path `'../index'` risolve al **barrel db** (`src/db/index.ts`),
  non a quello radice; inoltre `import type` viene cancellato da `verbatimModuleSyntax`, quindi
  un valore istanziato a runtime richiede l'import del valore.
- **Soluzione**: tipi schema da `'../../schema'`, classe/repo db dal barrel db o da `'../index'`
  (radice, che ora esporta esplicitamente schema + db — 05 §9.1). Con `lib: ES2022`
  `MapIterator.map` non esiste: usare spread `[...iter].map()`.

### P9 — Test di performance: isolare le asserzioni AC dalla strumentazione coverage

- **Sintomo**: il test AC "10.000 ListenEvent in < 500ms" fallisce sotto `--coverage` (~2× overhead v8).
- **Causa**: la strumentazione raddoppia i tempi misurati; l'asserzione diventa un artefatto.
- **Soluzione**: test perf in file dedicato (`perf.test.ts`), escluso dalle run coverage via
  script `test:coverage` (`vitest run --coverage --exclude src/db/__tests__/perf.test.ts`);
  misurare con warm-up non misurato + **minimo di 3 round** (steady-state, robusto a jitter).

## 4. Cosa NON è ancora implementato

Zod (validazione runtime: fuori perimetro Story 0.2, valutare con Story 0.3 adapter), Zustand,
i18next (Story 0.6), Tailwind 4 (Story 0.4), MSW (prime API), PWA/service worker (Story 0.5),
migrazione Dexie v2→v3 per `artworkUrl` (02 §10: nullable, nessun indice — richiesta solo se
si apre lo schema; alternativa in Story 0.7). Il layer `@ls/core/db` è operativo da Story 0.2
(classe Dexie v1+v2, repository, `recount()`). Gli upgrade major della toolchain (pnpm 12,
ESLint 10+, bump a cascata) sono differiti a Story 6.1 (D.10.2).
