# 18 — Diario di Sviluppo (problemi, fix, lesson learned)

> Status: 🟡 DRAFT
> Versione: 0.2
> Ultima modifica: 2026-10-16 — Sessione 11, entry Story 0.1
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
**Branch**: `feat/0.1-monorepo-setup` (in progress, non merged)
**PR**: non ancora aperta
**Data**: 2026-10-16
**Stato**: 🟡 IN PROGRESS — scaffold monorepo + toolchain funzionanti; feature work delegato a Story 0.2+

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
- Branch: `feat/0.1-monorepo-setup`
- Spec toccata: `05-ARCHITECTURE.md §8 §9` (confermata in pratica)
- Pitfalls consolidati: `17-DEV-NOTES.md §3`

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | 2026-10-16 | Template iniziale + regole di compilazione (Sessione 10/11) |
| 0.2 | 2026-10-16 | Sessione 11 — entry Story 0.1 con 8 problemi/fix/lesson (P0 toolchain) e stato accettazione; indice rapido per sintomo |

---

*Questo file viene aggiornato ad ogni implementazione chiusa. È letto durante l'handoff
tra conversazioni AI e durante l'audit di Sessione (vedi `AGENTS.md` §"Fine di un'implementazione").*
