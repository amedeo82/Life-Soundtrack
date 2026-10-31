# 17 — Note di sviluppo (toolchain & workflow)

> Status: 🟡 DRAFT
> Versione: 0.6
> Ultima modifica: 2026-10-31 — baseline PowerShell 7 (`pwsh`), provenienza dell'installazione e confine di encoding dei `.ps1` (Sessione 72)
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
| `pwsh scripts/generate-bundle.ps1 -Check` | Verifica sync bundle (exit 0 = in sync, 1 = drift, 2 = parametro/errore) |
| `pwsh scripts/aggregate-state.ps1 -Check` | Verifica sync dei blocchi aggregati `AGGREGATE-*` (exit 0 = in sync) |

Requisiti: Node ≥ 20 (testato su 20 LTS e 24), pnpm 9 (pinnato in `packageManager`), **PowerShell 7 (`pwsh`)** per gli script in `scripts/*.ps1`.

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

### P3 — Line endings + timestamp: `-Check` non deterministico su Windows

- **Sintomo**: `generate-bundle.ps1 -Check` fallisce su Windows con "Lista file identica, ma
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

### P10 — La licenza è AGPL-3.0: le dipendenze distribuite contano

- **Sintomo**: `essentia.js` è AGPL-3.0 e la PWA lo distribuisce agli utenti: il
  repository è passato ad **AGPL-3.0** il 2026-10-30 (D-AF.2, `21` §2.4, issue
  #201). Da quel momento ogni dipendenza che **finisce nel bundle** è soggetta
  all'obbligo di offerta del sorgente (§13) e la sua licenza deve essere
  compatibile con l'opera distribuita.
- **Causa**: il codice permissivo può entrare in un'opera AGPL, il contrario non
  vale. Il bundle è una distribuzione (la PWA è servita ai browser), quindi una
  dipendenza AGPL nel bundle obbliga l'opera a essere AGPL.
- **Soluzione**: prima di aggiungere una dipendenza che finisce nel bundle,
  controllare la sua licenza (il campo `license` nel `package.json` del
  pacchetto npm) e **non introdurre codice AGPL senza la decisione del Boss**;
  le dipendenze solo-Dev restano fuori dal bundle e non hanno impatto. Il
  carico delle licenze del bundle va verificato con il listino del package
  manager (`pnpm licenses list --prod`) nella story che introduce la
  dipendenza. L'obbligo del §13 — offrire il sorgente corrispondente agli
  utenti che interagiscono con l'app in rete — è il requirement dell'issue **#202**.

### P11 — PowerShell 7 (`pwsh`) è il baseline: il singolo trattino è la forma canonica

- **Sintomo**: `generate-bundle.ps1 --check` **riscrive** `docs/BUNDLE.md` invece di verificarlo e
  l'agente crede di star controllando la sincronizzazione (lesson 40-1, 41-1). Oppure: un gate
  invocato con il doppio trattino esce **2** e l'agente lo legge come "drift" invece che come
  "parametro sconosciuto".
- **Causa**: in **Windows PowerShell 5.1** il call operator `&` interpreta `--check` come
  fine-dei-parametri + token posizionale `check`: `[switch]$Check` non si lega e lo script ricade
  in modalità WRITING (fail-open, uscita 0). In **PowerShell 7** il doppio trattino viene
  normalizzato sul singolo **prima** del binding: `--check` e `-Check` sono quindi equivalenti e
  il guard fail-closed dell'issue #104 non scatta.
- **Soluzione**: il baseline del repo è **PowerShell 7 (`pwsh`)** — va installato, non è un
  fallback opzionale. Usare la forma a **singolo trattino** (`-Check`, `-List`, `-DryRun`,
  `-Help`): è l'unica che si comporta allo stesso modo su 5.1 e 7, ed è quella che il guard
  fail-closed degli script indica come corretta. Se il gate riceve un flag che non riconosce,
  esce **2** (errore di parametro) e **non** 1 (drift): verificare sempre l'`exit code` **e** la
  riga `[OK] … in sync` nell'output. Vedi `docs/12-DEVOPS.md §9.1` e `§9.7b`.

### P12 — Provenienza di `pwsh` e confine di encoding dei `.ps1`

- **Sintomo**: due failure diverse con la stessa radice.
  1. `powershell scripts/aggregate-state.ps1 -Check` (Windows PowerShell 5.1) esce **1** con
     `[FAIL] README.md - blocco drift | Atteso: 620 chars, Trovato: 616 chars`, mentre
     `pwsh scripts/aggregate-state.ps1 -Check` esce **0**. Il drift è **spurio**: nessun file
     è cambiato.
  2. In modalità scrittura (default), lo stesso comando sotto 5.1 **scrive** i letterali
     corrotti nei file globali (`README.md`, `SESSIONS.md`, `INDEX.md`, `11-BACKLOG.md`):
     mojibake (`â€”` al posto di `—`) + BOM, la stessa classe di danno di lesson 36-6 e 69-5.
- **Causa**: `scripts/aggregate-state.ps1` è **UTF-8 senza BOM** e contiene 9 righe con
  caratteri non-ASCII (`—`, `§`, `→`, `✅`, `❌`). Il **parsing** del file sorgente dipende
  dalla versione: 7 legge UTF-8, 5.1 legge ANSI (Windows-1252) e trasforma `—` (3 byte UTF-8)
  in 3 caratteri `â€”`. La differenza di 4 caratteri fra "atteso" e "trovato" è esattamente
  la somma delle sovradecodifiche (`—` +2, `§` +1, `à` +1). Nota: il vincolo «ASCII-only nel
  codice PowerShell» già esiste in `docs/13-ADR/0008-lazy-state-aggregation.md`, ma riguardava
  solo la **scrittura**; la **lettura del sorgente** dipende dal BOM ed è version-dipendente.
- **Soluzione**:
  - **Operativa**: `pwsh` va invocato **esplicitamente**. La shell di default di Windows
    (`powershell`, 5.1) e la shell di default di molti tool sono 5.1: `pwsh` è un comando
    diverso e va scritto per esteso. Il check F9 della session start checklist
    (`pwsh -NoProfile -c '$PSVersionTable.PSVersion.Major'`) va eseguito **prima** di
    invocare qualsiasi `.ps1` del repo.
  - **Sul codice**: i `.ps1` del repo restano **ASCII-only** (o con BOM UTF-8 esplicito).
    `aggregate-state.ps1` oggi non lo rispetta: il fix (rimuovere i 9 letterali non-ASCII,
    oppure aggiungere il BOM) è manutenzione dello script e va deciso dal project owner.
  - **Provenienza dell'installazione** (verificata il 2026-10-31): `pwsh` **7.6.9** è
    installato come **pacchetto MSIX / Microsoft Store** (`Microsoft.PowerShell_7.6.9.0_x64__8wekyb3d8bbwe`,
    `SignatureKind: Store`), esposto tramite **alias per utente** in
    `%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe` (reparse point da 0 byte). Non è un MSI:
    `C:\Program Files\PowerShell\7` **non esiste** e non c'è alcuna voce di disinstallazione
    del prodotto nel registro. Il pacchetto è stato creato/aggiornato il **2026-10-26 09:38**.
    Verifiche:
    ```powershell
    pwsh -NoProfile -c '$PSVersionTable.PSVersion'   # 7.6.9
    winget list --id Microsoft.PowerShell             # PowerShell 7.6.9.0
    Get-AppxPackage Microsoft.PowerShell | Select-Object Version, SignatureKind, InstallLocation
    ```
    L'alias è visibile anche da Git Bash (`command -v pwsh` → `/c/Users/<user>/AppData/Local/Microsoft/WindowsApps/pwsh`),
    quindi il `.githooks/pre-push` — che preferisce `pwsh` e usa `powershell` solo come
    fallback — rigenera il bundle con l'engine corretto.
- **Regola generale**: il baseline di un runtime non si dichiara solo nei documenti, si
  **verifica**: prima di ogni sessione, il check F9 (`$PSVersionTable.PSVersion.Major` = 7).
  E quando l'engine è scelto, la sua *provenienza* va documentata: «installato» senza dire
  *come* (MSI, Store, scoop, chocolatey) lascia la macchina non riproducibile su un'altra
  postazione (lesson 71-1: un toolchain installato non è un toolchain documentato).

### P13 — Il costo delle procedure automatiche è quasi sempre nei **processi figli**, non nella logica

- **Sintomo**: «le procedure automatiche ci mettono tanto tempo». Misurato, il job `quality`
  (unico, 18 step in sequenza) durava **172 s** di tempo pareggio. Il profilo non indicava
  un algoritmo lento: indicava **troppi processi**.
- **Causa** (misurata il 2026-10-31 con Git Bash su Windows):
  - `seed_repo_files` in `test-bundle-check-idempotent.sh` chiamava `dirname` + `mkdir -p` +
    `touch` **una volta per file**: 128 file ⇒ **256 processi per repo**, **9,5 s per repo**,
    ~38 s dei 53 s della suite. `mkdir` su una directory che esiste già non è free: ogni
    spawn è ~35 ms.
  - `git config user.email` / `user.name` / `commit.gpgsign` = **3-4 processi per repo
    temporaneo** (~130 ms ciascuno), ripetuti in ogni scenario.
  - `generate-bundle.ps1` costruiva ~2,4 MB con `$bundle += $content`: la concatenazione
    con `+=` **ricopia l'intera stringa a ogni iterazione** ⇒ O(n²) su 126 file.
- **Soluzione**:
  - **In bash**: usare le **builtin** del shell, non i comandi. `dirname` → espansione
    `${f%/*}`; `touch` → redirezione `: > "$f"`; `mkdir -p` → **una volta per directory
    distinta**, non per file. Per la config git: variabili d'ambiente
    (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_*`) e, per le impostazioni,
    `GIT_CONFIG_COUNT` + `GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n` (git ≥ 2.31) invece di
    `git config`. Risultato: 9,5 s → **~50 ms** per repo.
  - **In PowerShell**: `StringBuilder` invece di `+=` (O(n) invece di O(n²));
    `[System.IO.File]::ReadAllText` invece di `Get-Content -Raw` (stessa decodifica UTF-8,
    senza l'overhead del cmdlet); `.Replace("`r`n","`n")` invece di
    `-replace "`r`n", "`n"` (il pattern è un **letterale**: il risultato è identico, ma è un
    confronto ordinale e non una scansione regex su megabyte).
- **Regola generale**: prima di ottimizzare la **logica** di uno script, contare i
  **processi figli** che genera. Un loop che chiama un comando esterno per ogni elemento
  costa ~35 ms **per elemento**; la stessa operazione con una builtin costa ~0. E in
  PowerShell la concatenazione di stringhe con `+=` è il riflesso O(n²) da cui partire
  sempre.

## 4. Cosa NON è ancora implementato

Zod (validazione runtime: fuori perimetro Story 0.2, valutare con Story 0.3 adapter), Zustand,
i18next (Story 0.6), Tailwind 4 (Story 0.4), MSW (prime API), PWA/service worker (Story 0.5),
migrazione Dexie v2→v3 per `artworkUrl` (02 §10: nullable, nessun indice — richiesta solo se
si apre lo schema; alternativa in Story 0.7). Il layer `@ls/core/db` è operativo da Story 0.2
(classe Dexie v1+v2, repository, `recount()`). Gli upgrade major della toolchain (pnpm 12,
ESLint 10+, bump a cascata) sono differiti a Story 6.1 (D.10.2).

L'obbligo del **§13** della licenza AGPL-3.0 (offerta del sorgente corrispondente
agli utenti che interagiscono con l'app in rete) **non è ancora implementato**
(issue #202): nessuna schermata offre il sorgente e non esiste un NOTICE con le
attribuzioni delle terze parti distribuite (Essentia.js AGPL-3.0; DB-IP Lite
CC BY 4.0 quando la Story 4.4 lo introduce). L'inventario geo (`city`,
`ContextPeriod`, il database MMDB locale) è specificato in
`19-GEO-CONTEXT.md` v1.0 🟢 APPROVED ma non implementato (Story 1.6 / 4.4).
