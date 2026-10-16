# 17 — Note di sviluppo (toolchain & workflow)

> Status: 🟡 DRAFT
> Versione: 0.1
> Ultima modifica: 2026-10-16 — implementazione Story 0.1 (Sessione 10-11)
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
| `pnpm run build` | `tsc` → `dist/` per `@ls/core` e `@ls/ui`, `vite build` per `@ls/web` |
| `pnpm run e2e` | Playwright su `apps/web` (al primo avvio serve `pnpm exec playwright install chromium`) |
| `pnpm run format` / `format:check` | Prettier (i doc in `docs/`, `fixtures/`, `design/` sono esclusi via `.prettierignore`) |
| `powershell scripts/generate-bundle.ps1 --check` | Verifica sync bundle (in CI: `pwsh`; in locale se `pwsh` 7 non è installato funziona PowerShell 5.1) |

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

### P3 — Line endings: `.gitattributes` impone LF (non rimuoverlo)

- **Sintomo**: `generate-bundle.ps1 --check` fallisce su Windows con "Lista file identica, ma
  contenuto cambiato" anche senza modifiche ai documenti.
- **Causa**: con `core.autocrlf=true` i doc vengono estratti con CRLF; il bundle rigenerato
  incorpora CRLF e diverge dal bundle committato (LF, generato in CI/Linux).
- **Soluzione**: `.gitattributes` con `* text=auto eol=lf` (più regole `binary` per asset).
  Dopo una modifica agli attributi, riscrivere il working tree prima di rigenerare il bundle
  (es. `git checkout-index -f -a`, o eliminare i file tracciati e richeckoutarli). In locale
  il check gira anche con PowerShell 5.1 se `pwsh` 7 non è installato.

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

## 4. Cosa NON è ancora implementato

Dexie 4 + Zod (Story 0.2), Zustand, i18next (Story 0.6), Tailwind 4 (Story 0.4), MSW (prime
API), PWA/service worker (Story 0.5). Il placeholder `packages/core/src/db/index.ts` è vuoto
di proposito: il contenuto reale arriva con la Story 0.2. Gli upgrade major della toolchain
(pnpm 12, ESLint 10+, bump a cascata) sono differiti a Story 6.1 (D.10.2).
