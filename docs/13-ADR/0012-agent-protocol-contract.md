# ADR-0012 — Protocollo agenti come contratto verificato

> Status: 🟢 APPROVED · Versione 1.0 · Sessione 79 (2026-11-01)
> Decisioni prese dal project owner in sessione interattiva (D1-D5), il 2026-11-01.

## Contesto

Il protocollo agenti vive in un unico file, `AGENTS.md` (1328 righe, 21 sezioni `##` + 56 `###`,
77 anchor, 643 citazioni in 49 file + 304 nel bundle). È l'**unico** artefatto di governance del
repository che **non ha né un generatore né un gate**: non contiene marker `AGGREGATE-*`, e nessuno
dei 26 gate di `ci.yml` lo confronta con la realtà. Tutti gli altri lo hanno —
`check-readme-facts.mjs` per il README (issue #161), `check-merge-state.mjs` per le sessioni
(issue #239), `validate-workflows.mjs` per i workflow (7 controlli), `validate-labels.mjs` per le
label, `aggregate-state.ps1` per i blocchi aggregati (ADR-0008), `generate-bundle.ps1` per il
bundle.

Il drift che ne consegue non è ipotetico: è **misurato e attuale**.

| # | Drift | Prova |
|---|-------|-------|
| D1 | Versione dichiarata false | `docs/INDEX.md` dichiara «v1.27», `AGENTS.md` dichiara «v1.33» |
| D2 | Tabella label vs gate | `scripts/validate-labels.mjs` include `phase-post`; la tabella di `AGENTS.md` no |
| D3 | Exit code | `scripts/post-merge.ps1` documenta «Exit 1»; il codice esce **14** |
| D4 | Flag non canonici | `scripts/post-merge.ps1` stampa `--check` (doppio trattino ⇒ fail-open su PS 5.1, issue #104) |
| D5 | Contraddizione interna | «il claim è il primo gesto operativo, prima … di creare il branch» vs «worktree prima del claim» |
| D6 | Cifre incoerenti | «53 assert» in tre punti vs «37 assert» in uno; il numero vero è dinamico (lo stampa la suite) |
| D7 | Comando non eseguibile | la query dei candidati usa `\| jq` — **`jq` non è installato** sull'ambiente di riferimento |
| D8 | Checklist sdoppiata | `AGENTS.md` 22 voci vs `.github/pull_request_template.md` 22 voci → **solo 2 identiche al testo** |

Tre difetti strutturali del flusso automatico:

1. **Il protocollo di claim (ADR-0006, 8 regole vincolanti) non ha enforcement.** `in-progress`,
   `claim` e `status:in-review` non compaiono mai in `ci.yml` né in alcun gate: due agenti possono
   implementare la stessa story senza che nulla se ne accorga — esattamente la race che ADR-0006
   dichiara di aver chiuso.
2. **Le invarianti ADR-0008 sono warning-only.** `ci.yml` esegue `aggregate-state.ps1 -Check` in
   modalità warning perché il drift è auto-fixato post-merge: la regola «mai modificare i blocchi
   `AGGREGATE-*` a mano» è quindi violabile e la violazione **merge-e in silenzio**, invisibile al
   reviewer.
3. **Il `pre-push` può corrompere il bundle.** `.githooks/pre-push` usa `powershell` (5.1) come
   fallback se `pwsh` manca; sotto 5.1 il *parsing* dei `.ps1` sovradecodifica (F9-bis,
   `docs/12-DEVOPS.md §9.12`) e il mojibake viene **scritto in `docs/BUNDLE.md`** e committato
   dall'hook che esiste per prevenire il drift.

A questo si aggiunge un difetto di ergonomia: il `pre-commit` blocca anche i **commit parziali**
(untracked/unstaged), e l'escape hatch `--no-verify` disabilita **anche** il check del branch
(F1/F7). Un agente chevuole committare un sottoinsieme di file è quindi incentivato a usare
`--no-verify` e a perdere la protezione che conta.

## Decisione

Adottiamo il principio seguente, che governa ogni decisione successiva sul protocollo:

> **Ogni regola normativa scende da L2 (protocollo) a L3 (applicazione).**
> Regola in `AGENTS.md` ⟺ gate in `scripts/` ⟺ hook o workflow che la applica.
> Una regola senza gate è un consiglio. Un gate senza regola è un segreto.

Le regole vincolanti sono:

1. **Il protocollo resta in due file, non in una directory.** `AGENTS.md` è il *contratto* (le
   regole, i comandi, i gate); questa ADR è la *decisione* (contesto, alternative, conseguenze).
   Non si introducono `modules/`, `checklists/` o `references/`: ogni file aggiunto è un elenco
   da mantenere a mano in `scripts/generate-bundle.ps1` e in `docs/INDEX.md` — la classe di drift
   che ADR-0008 ha già imparato a riconoscere (issue #136).
2. **Gli anchor di `AGENTS.md` sono un'API pubblica.** I 77 heading (`##`/`###`) sono referenziati
   da 29 citazioni esterne nella forma `§"Titolo"` e da 8 script. **Nessun heading viene rinominato
   o spostato** senza aggiornare i referenti nello stesso PR; un gate di integrità degli anchor
   (`scripts/check-protocol-consistency.mjs`) verifica che ogni `§"…"` citato in `.github/`,
   `docs/` e `scripts/` risolva a un heading esistente. È il presupposto che rende sicuro
   qualunque refactor futuro del file.
3. **Una checklist, un artifact.** La checklist operativa della PR vive **solo** in
   `.github/pull_request_template.md` (che GitHub rende interattiva e che la branch protection
   tratta come blocker). `AGENTS.md` non ne contiene una copia: ne rimanda. Il gate di coerenza
   vieta il duplicato.
4. **Le invarianti ADR-0008 diventano bloccanti, e il controllo è testuale.** Un controllo
   testuale (Node puro, nessuna dipendenza da PowerShell) non soffre dell'incompatibilità
   PS 5.1/PS 7 che giustifica il warning-only di `aggregate-state -Check`: la verifica «questa PR
   ha modificato un blocco `<!-- AGGREGATE-*-START/END -->`?» è cross-platform per costruzione e
   può quindi essere bloccante. `scripts/check-aggregate-blocks.mjs`.
5. **Il claim diventa un comando atomico con riverifica deterministica.** `scripts/agent-claim.ps1`
   esegue in sequenza: validazione dell'issue, creazione della worktree, label `in-progress`,
   commento `claim:`, **riverifica** (vince l'ID commento GitHub più basso, letto dall'API REST) e
   scrittura del file di stato. La riverifica non è più un passo interpretato a mano: è codice con
   exit code. **Nessuna dipendenza da `jq` esterno**: il filtro usa il `--jq` integrato di `gh` o
   `ConvertFrom-Json`.
6. **Il `pre-commit` separa le invarianti dall'igiene.** Il **pattern del branch** resta bloccante
   (F1, F7). Il controllo «working tree pulito» diventa **advisory** (warning, exit 0): la sua
   funzione (F5, stash collision) è mitigata strutturalmente dalla worktree (issue #53), e il suo
   costo (blocca i commit parziali e spinge verso `--no-verify`) è superiore al beneficio. Il
   comportamento bloccante resta disponibile via `LIFE_SOUNDTRACK_STRICT_CLEAN=1`.
7. **Nessun `.ps1` senza `pwsh` 7.** Il fallback a Windows PowerShell 5.1 è **vietato** in tutti
   gli script e hook: `powershell` (5.1) non è un fallback, è un rischio di corruzione (F9-bis).
   Se `pwsh` non è disponibile, lo script **non scrive**: avvisa e esce.
8. **Le cifre non si duplicano.** Un numero che cambia a ogni esecuzione di una suite (assert,
   durate, conteggi di test) non viene scritto in `AGENTS.md`: ci si mette un **puntatore**
   («vedi l'output della suite»), come prescrive già D.38.1 per i dati aggregati.

## Alternative considerate

- **Split del protocollo in `modules/` + `checklists/` + `references/`** (12 file, entry point
  snello): scartata. Il vantaggio percepito (leggibilità) è pagato con 12 elenchi manuali da
  mantenere — la classe di drift di issue #136 — e con la rottura di 29 riferimenti `§"…"` e di 8
  citazioni dagli script. Nessuno dei 6 drift misurati verrebbe chiuso. Scartata anche l'opzione
  YAML/JSON: i dati strutturati diventano una seconda fonte di verità rispetto ai gate, che il
  repository non sa ancora manutenere.
- **Changelog del protocollo in un file separato** (`CHANGELOG-AGENTS.md`): scartata. Il
  repository ha già tre sedi di storia (`docs/SESSIONS.md`, `docs/18-DEV-LOG.md`,
  `docs/BUNDLE.md`); una quarta sarebbe un nuovo drift. La storia va in `docs/18-DEV-LOG.md`, che
  è già il diario di problemi/fix/lesson.
- **Lasciare il claim manuale e limitarsi a documentarlo meglio**: scartata. Il rischio residuo
  (due agenti sulla stessa story) è il più grave in assoluto e l'automazione è deterministica,
  quindi il costo è basso rispetto al beneficio.
- **Estendere il gate di coerenza a tutti i documenti** (`12-DEVOPS.md`, `11-BACKLOG.md`,
  `18-DEV-LOG.md`): **differita**. È la generalizzazione corretta (gli stessi documenti dichiarano
  cifre non verificabili), ma richiede che il gate legga tabelle eterogenee in tre formati diversi:
  decisione separata, da prendere dopo che il gate su `AGENTS.md` è consolidato.
- **Rendere bloccante anche `aggregate-state.ps1 -Check` in CI**: scartata per ora. L'incompatibilità
  residua di piattaforma (issue #63) è ancora aperta; il controllo testuale della regola 4 copre
  invece il caso che conta (la violazione manuale), senza toccare la semantica dei gate esistenti.

## Conseguenze attese

- **Positive**: i 6+2 drift misurati vengono chiusi e il meccanismo che li chiude è permanente
  (gate, non prosa); la riverifica del claim diventa deterministica e non più interpretazione
  manuale; le invarianti ADR-0008 smettono di essere violabili in silenzio; l'hook `pre-push` non
  può più corrompere il bundle; il `pre-commit` smette di spingere verso `--no-verify`.
- **Negative**: due script in più e due gate in più da mantenere (costo proporzionato, non
  moltiplicato come nello split a 12 file); il claim diventa un comando che va ricordato di usare
  (`agent-claim.ps1` al posto di `setup-worktree.ps1` + 2 comandi `gh` copiati a mano); il
  comportamento del `pre-commit` sulla working tree sporca cambia (warning invece di abort) e va
  comunicato agli agenti.
- **Mitigazioni**: il file di stato dell'agente (`.git/worktrees/<nome>/agent-state.json`) consente
  a hook e script di sapere issue/agent/worktree senza chiedere, riducendo la necessità di
  procedura manuale; ogni gate ha il suo test di scenario negativo (un gate che passa sempre non è
  un gate, lesson 43-1).

## Stato dell'implementazione

| Lotto | Contenuto | Stato |
|-------|-----------|-------|
| I1 | Questa ADR + `docs/state/sessions/79-protocollo-contratto-verificato.md` | in corso |
| I2-a | Chiusura dei drift D1-D8 + fallback PS 5.1 vietato + commit parziale ammesso | in corso |
| I2-b | `check-protocol-consistency.mjs` + `check-aggregate-blocks.mjs` + test negativi | da fare |
| I2-c | `agent-claim.ps1` + `agent-pr.ps1` + `check-claim-state.mjs` | da fare |
| I3 | Rifinitura di `AGENTS.md` (77 anchor invariati) | da fare |

## Riferimenti

- `AGENTS.md` §"📝 Checklist di auto-revisione PR" (ora un puntatore al PR template)
- `docs/13-ADR/0006-multi-agent-task-claiming.md` (regole di claim: rese verificabili, non ridisegnate)
- `docs/13-ADR/0007-issue-state-machine.md` (macchina a stati `status:*`: resa verificabile)
- `docs/13-ADR/0008-lazy-state-aggregation.md` (invariant dei blocchi aggregati: resa bloccante)
- `docs/12-DEVOPS.md §9.10` (catalogo autorevole dei gate) · `§9.12` (confine di encoding PS 5.1)
- `docs/18-DEV-LOG.md` (sede della storia del protocollo, decisione D2)
- Issue #248 (epic), Sessione 79 in `docs/state/sessions/`

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1.0 | Sessione 79 (2026-11-01) | Primo rilascio: 8 regole vincolanti (2 file e non una directory, anchor come API, una checklist un artifact, invarianti ADR-0008 bloccanti e testuali, claim atomico con riverifica deterministica e senza `jq`, separazione invariante/igiene nel `pre-commit`, `pwsh` 7 obbligatorio, cifre come puntatori) |
