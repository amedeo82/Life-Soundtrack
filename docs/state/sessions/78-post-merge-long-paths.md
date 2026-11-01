---
number: 78
title: "Rimozione worktree long-path-safe (procedura post-merge)"
date: 2026-10-31
state: 🟡
merged: true
merged_commit: "08a0b4da74ee3639d061ac714d07267e75d2eac8"
merged_date: "2026-11-01T09:58:20Z"
branch: fix/235-post-merge-long-paths
pr: 236
claim: kilo-HP-ELITEBOOK-longpath
cross_refs: [216]
tags: [devops, tooling]
---

# Sessione 78 — Rimozione worktree long-path-safe (procedura post-merge)

> Sessione senza issue dedicata: il project owner ha segnalato il difetto
> direttamente («post-merge.ps1 fallisce su Windows con “Result too large” …
> ho applicato il workaround `rd /s /q "\\?\"` documentato nel DEV-LOG, ma è un
> difetto ricorrente della procedura»). Lavoro di manutenzione della procedura
> canonica, non di una story: nessun claim su issue, nessun backlog.
>
> **Branch**: `fix/235-post-merge-long-paths` — **PR**: **#236** (aperta il
> 2026-11-01) — **merged** il 2026-11-01T09:58:20Z (merge commit `08a0b4d`)
> — issue di tracking: **#235** (`status:done`)

## Sintesi

La procedura canonica post-merge (`scripts/post-merge.ps1`) deve **smontare la
worktree** prima di eliminare il branch locale. Su Windows quel passo falliva
in modo prevedibile: `git worktree remove --force` cancella l'albero chiamando
le API Win32 **senza il prefisso `\\?\`**, quindi con `node_modules` e path più
lunghi di MAX_PATH (260 caratteri) la cancellazione si interrompe con
«Filename too long» / «Result too large».

Lo stato lasciato indietro è scomodo: git **ha già deregistrato** la worktree
(l'errore arriva dopo la cancellazione fallita), la directory è rimasta, e il
branch risulta ancora «checked-out» per `git branch -d`. La procedura si
ferma, e l'agente deve finire il lavoro a mano.

Il rimedio manuale (`rd /s /q "\\?\<path>"` + `git worktree prune`) era finito
nel DEV-LOG di **sette** sessioni consecutive (56, 57, 58, 61, 63, 64, 68),
ognuna con la stessa formula. Un workaround che ricorre sette volte non è un
workaround: è una **procedura mancante**.

## Causa radice

Tre fatti, non uno:

1. **`git worktree remove` non è long-path-aware.** Su Windows Git for Windows
   chiama le API Win32 senza il prefisso `\\?\`, salvo che sia attivo
   `core.longpaths=true`. La procedura non lo attivava: con il default, la
   cancellazione si spezza sul primo path oltre 260 caratteri.
2. **PowerShell 7 è long-path-aware.** `pwsh.exe` dichiara `longPathAware` nel
   proprio manifest e usa .NET Core: `Remove-Item -Recurse -Force` cancella
   alberi oltre MAX_PATH **senza prefisso e senza processi esterni**. Misurato
   su questa macchina: albero di 417 caratteri rimosso senza errori.
3. **`Remove-Item` non segue le junction.** Verificato: un junction verso una
   directory esterna viene **rimosso come link**, e il contenuto collegato
   resta intatto — il comportamento giusto per `node_modules` con pnpm (i
   package sono junction verso `.pnpm`). `Directory.Delete(path, true)` invece
   **fallisce** sulle junction («Access to the path 'link' is denied»): la
   ricorsione .NET non è il primitive giusto.

## Soluzione

Tre livelli dentro `scripts/post-merge.ps1`, dal più economico al più
robusto:

| Livello | Meccanismo | Ruolo |
|---------|-----------|-------|
| L1 | `git -c core.longpaths=true worktree remove --force` | **causa radice**: abilita in git il prefisso `\\?\` |
| L2 | `Remove-Item -LiteralPath <path> -Recurse -Force` | **nativo** del runtime baseline (pwsh 7), non segue le junction |
| L3 | `cmd /c rd /s /q "\\?\<path>"` + `git worktree prune` | **rete** per Windows PowerShell 5.1, che non è long-path-aware |

Dopo una rimozione manuale, `git worktree prune` deregistra la worktree: senza,
`git branch -d` continuerebbe a vederla come checked-out.

## Guardie

Il fallback manuale è una cancellazione ricorsiva: le guardie non sono
decorative.

- **Il target deve essere una worktree di questo repo**: registrata da
  `git worktree list`, oppure con il marker `.git` che punta a
  `.git/worktrees/` del repo. La working copy principale e i suoi antenati
  sono esclusi per costruzione → `-WorktreePath` sulla working copy =
  **exit 16**, zero cancellazioni.
- **`git status` fallito = WIP sconosciuto**: il codice di uscita è ora
  raccolto; se `git status` non può girare (path lunghi), la procedura si
  ferma (exit 10) invece di interpretare l'output vuoto come «worktree
  pulita». Il comando usa `git -c core.longpaths=true`.
- **Nessun livello riesce = exit 16**: nessuna azione distruttiva, e lo script
  stampa il comando manuale.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.78.1 | `core.longpaths=true` **per invocazione** (`git -c ...`), non nella config del repo | Risolve la causa radice senza mutare la configurazione locale dell'utente: l'opzione vale solo per il comando che ne ha bisogno |
| D.78.2 | L2 usa `Remove-Item`, non `Directory.Delete` | `Remove-Item` non segue le junction (il contenuto collegato resta intatto); `Directory.Delete` fallisce sulle junction |
| D.78.3 | L3 esiste solo per Windows PowerShell 5.1 | Il baseline del repo è `pwsh` (D.71.1); `cmd.exe` è una dipendenza da evitare nel percorso normale |
| D.78.4 | Il fallback manuale è **consentito solo** su directory che sono worktree di questo repo | Una cancellazione ricorsiva senza guardie è il difetto più grave possibile in una procedura distruttiva |
| D.78.5 | `git status` fallito = stop (exit 10), non "worktree pulita" | Uno stato WIP **sconosciuto** non è uno stato pulito: la differenza è la difesa fra E3/E4/E5 e una data loss |
| D.78.6 | Hook di test `LIFE_SOUNDTRACK_WT_REMOVAL=rd` | Una rete di sicurezza non esercitata è una rete **non verificata**: T14 la forza, altrimenti il suo codice resterebbe mai eseguito |

## Difetto trovato mentre si scriveva la rete

`Invoke-CmdVerbatim` costruiva la riga di comando **senza il prefisso `/c`**:
`cmd.exe` apriva una shell interattiva (banner + prompt), non eseguiva nulla e
restituiva **0**. Un codice di uscita che dice «tutto bene» senza che sia
successo nulla è il peggior tipo di successo: la rete L3 sembrava funzionante.
Prefisso `/c` aggiunto, e il livello è coperto da un test che lo **forza**.

## Analisi di avanzamento

### Numeri

- **Implementazione: 75%** — 21 story completate su 28 · effort pesato 77% · **mancano 7 step**
- EPIC 0 (Fondamenta) 7/7 · EPIC 1 (Import core) 6/6 · EPIC 2 (Analisi) 4/4 · EPIC 3 (UI/UX) 2/4 · EPIC 4 (Arricchimento) 2/4 · EPIC 5 (Privacy e legale) 0/2 · EPIC 6 (Manutenzione stack) 0/1

### Cosa e' pronto e cosa manca

- **La procedura post-merge non si blocca più su Windows**: la rimozione della
  worktree è coperta da tre livelli, ciascuno testato, e il caso del fallback
  ha un exit code e un messaggio espliciti.
- Le **story** del backlog non cambiano: questa sessione è manutenzione della
  procedura, non una story. Restano **7 step**: 3.2 Ricordi + Share,
  3.3 Esplora + Analisi, 4.2 MusicBrainz lookup, 4.3 Artwork enrichment,
  5.1 Privacy spec finale, 5.2 Export e purge, 6.1 Upgrade toolchain e
  dipendenze a ultime major.
- Il **gate end-to-end** resta l'obiettivo aperto: import → timeline → esplora →
  condividi ha ancora schermate vuote.

> I numeri sopra sono quelli **calcolati** dal blocco aggregato al momento della
> stesura: se il blocco e l'analisi divergono, il primo e' la fonte di verita'.

### Salute tecnica (verificata in questa sessione)

`bash scripts/test-post-merge.sh` → **47 assert, 0 falliti** (T10..T14 nuovi) ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 ·
`pwsh scripts/generate-bundle.ps1 -Check` → exit 0 ·
nessuna modifica al codice applicativo (`apps/*`, `packages/*`): la change è
solo in `scripts/`, `AGENTS.md` e `docs/`.

## Lesson learned

- **Il pattern è il segnale, non l'errore**: sette sessioni consecutive con la
  stessa frase nel DEV-LOG non sono sette incidenti. Il sintomo da guardare è
  «l'errore è **scomparso**»: un workaround che compare in sette sessioni di
  fila dimostra che la procedura canonica non copre il caso.
- **La domanda giusta è «perché fallisce», non «come faccio a mano»**: la
  risposta (`core.longpaths=true` abilita in git il prefisso `\\?\`) è una riga
  di opzioni e cancella il problema alla fonte. Il fallback manuale scende a
  rete, non a meccanismo.
- **Il runtime giusto vale più del trucco giusto**: la domanda «ma non si
  potrebbe usare pwsh 7, che dovrebbe supportare i percorsi lunghi?» è
  quella giusta. `cmd.exe` serve solo per 5.1, che non è il baseline: una
  procedura che usa `cmd` per il caso normale ha una dipendenza che non serve.
- **Una rete non esercitata è una rete non verificata**: il livello L3 era
  morto (restituiva 0 senza fare nulla) e nessuno se n'era accorto, perché
  nel caso normale L1 basta. Il forcing del primitive (`LIFE_SOUNDTRACK_WT_REMOVAL=rd`)
  è ciò che trasforma una rete da «presente» a «provata».

## Documenti aggiornati

- `scripts/post-merge.ps1` — rimozione long-path-safe su tre livelli, guardie,
  exit 16, stato WIP sconosciuto
- `scripts/test-post-merge.sh` — T10..T14 (shim di `git`, guardia sulla working
  copy, path lunghi reali, catena L1→L2→L3, L3 forzata)
- `AGENTS.md` — v1.33: nuova sezione §"Difetto ricorrente: la rimozione della
  worktree su Windows", passo 1 della tabella e dell'equivalente manuale, exit
  code 16, copertura dei test
- `docs/12-DEVOPS.md` — §9.8i (nuova) + changelog 1.7 + conteggio assert del
  gate `gates-scripts`
- `docs/18-DEV-LOG.md` — §44 + changelog 2.32
- `docs/state/sessions/78-post-merge-long-paths.md` — questo file
