# ADR-0013 — Automazioni post-merge deterministiche: writer unico, CI post-writer, generatori portabili

- **Stato**: 🟢 APPROVED (issue #284, Sessione 90, 2026-11-02)
- **Data**: 2026-11-02
- **Riferimenti**: issue #281 (fix incompleto), issue #239 (gate merge-state), issue #297 (perimetro delle story), issue #140 (sync dei writer), issue #149 (ordinamento fra writer), issue #216 (copertura dei trigger), issue #277 (encoding), ADR-0008 (lazy-state aggregation), ADR-0012 (contratto del protocollo)

## Contesto

Le automazioni post-merge di `main` erano strutturalmente fragili. Tre difetti
indipendenti producevano lo stesso sintomo — `main` rosso dopo ogni merge — e
si nascondevano a vicenda.

**1. Il commit del writer non triggava la CI.** I writer pushavano con
`GITHUB_TOKEN`, e GitHub sopprime i workflow `on: push` generati dal token
stesso. Misurato: per il commit `831b9e7` (writer della PR #282) **non
esiste alcuna run `CI`** — l'unica run sul quel SHA è `auto-bundle`, innescata
da `workflow_run`. La issue #281 e la PR #282 hanno risolto il problema
aggiungendo `docs/state/**` ai `paths:` del trigger `push`: la misura mostra
che quel path **non può** funzionare, perché l'evento `push` non viene
generato. Il fatto era già documentato in `docs/12-DEVOPS.md` §9.14
("i commit dei writer non hanno mai attivato una run CI — né prima né dopo
questa sessione, nemmeno quando il trigger `push` era privo di filtro").

**2. Tre writer concorrevano sullo stesso `main`.** `auto-session-merge-state`,
`auto-state-aggregate` e `auto-bundle` pushavano sugli stessi file generati.
Misurato il 2026-11-02: `auto-state-aggregate` ha pushato un commit rifiutato
(`! [rejected] main -> main`) e il suo retry ha fatto `git rebase origin/main`
**sui file generati** → conflitto in `docs/BUNDLE.md`, `docs/INDEX.md`,
`docs/SESSIONS.md` → run fallito. Il rebase dei file generati non è una race
risolvibile: i blocchi aggregati sono il *prodotto* di un input (lo stato), non
la fusione di due storie.

**3. Il gate fail-closed girava sull'albero sbagliato.** `check-merge-state.mjs`
confronta il frontmatter delle sessioni con lo stato reale delle PR letto
dall'API GitHub. Al merge la CI parte *prima* che il writer applichi lo stato:
il gate vede la PR `MERGED` e il frontmatter `merged: false` → `[FAIL]` →
`main` rosso. Il gate non è da indebolire (D-89.2): è **quale albero** va
sottoposto al gate a essere sbagliato.

A tutto questo si aggiungeva una dipendenza dal sistema operativo: i generatori
(`.ps1`) producevano output diversi su Windows e Linux (fuso orario del
timestamp, separatore decimale della locale corrente, ordinamento
culture-sensitive, versione di PowerShell) — la classe di difetti #63, #104,
#142, #224, #277.

## Decisione

### D-13.1 — Un solo writer su `main`

`.github/workflows/post-merge.yml` sostituisce i tre writer precedenti. Il
suo ciclo è lineare e senza alternative:

```
apply-merge-state → aggregate-state → generate-bundle → verifica (-Check) → 1 commit → 1 push
```

Un solo writer significa una sola sequenza di push: la race fra writer è
eliminata per costruzione, non per locking.

### D-13.2 — Il writer non ribasa mai: reset + rigenerazione

Al tentativo successivo il writer esegue `git reset --hard origin/main` e
**rigenera** da capo. Il rebase dei file generati è un conflitto strutturale;
la rigenerazione è una funzione dello stato, quindi è sempre possibile e
sempre convergente. L'unica condizione di successo è `git diff --quiet`:
se non c'è diff, non c'è commit.

### D-13.3 — Il passaggio autoritativo della CI è `workflow_run`

`ci.yml` dichiara `workflow_run: workflows: ["post-merge"]`. `workflow_run` è
agganciato alla **conclusione** di un workflow, non a un push: sopravvive alla
soppressione del `GITHUB_TOKEN` ed è il workaround già documentato in
`docs/12-DEVOPS.md` §9.8e (usato da `auto-bundle` per l'ordinamento dei
writer).

Consequenze esplicite:

- nel passaggio `workflow_run` la CI fa `checkout` con `ref: main`, perché
  `workflow_run.head_sha` è il commit di **partenza** del writer (il merge
  commit, senza lo stato applicato): validarlo equivarrebbe a far fallire il
  gate merge-state per costruzione;
- il trigger `push` su `main` resta, con il filtro per path, e serve per i
  push diretti (canale di recovery);
- il `concurrency group` distingue l'evento (`ci-${{ github.event_name }}-…`):
  il passaggio post-writer non deve essere annullato da un push concorrente.

### D-13.4 — Il gate merge-state ha due modalità, ed è fail-closed in entrambe

- **autoritativa** (default; usata su `pull_request` e su `workflow_run`):
  ogni drift è un fallimento. Gira sullo stato finale, dopo il writer.
- **`--defer-unapplied`** (usata su `push`): un confronto è differito **solo**
  se la PR ha per merge commit *esattamente* l'albero sotto esame — cioè se
  l'albero è il merge commit e lo stato non è ancora applicabile. Ogni altro
  drift resta un fallimento.

La distinzione è oggettiva (uguaglianza di SHA), non temporale ("il writer
potrebbe non essere passato ancora"): nessuna tolleranza temporale, nessuna
finestra in cui il drift passerebbe inosservato.

### D-13.5 — I generatori sono portabili per costruzione e per prova

- **Per costruzione**: timestamp in UTC con `InvariantCulture`, numeri
  renderizzati con la locale invariante, ordinamenti con chiave secondaria
  *ordinale* (l'ordinamento non dipende più dall'enumerazione del filesystem
  né dalla collazione della locale), guardia fail-closed su PowerShell < 7,
  normalizzazione CRLF→LF del contenuto incorporato nel bundle.
- **Per prova**: il gate `scripts/check-generators-portable.mjs` misura tre
  proprietà: il **determinismo** (due rigenerazioni consecutive producono gli
  stessi byte), le **invarianti del repo** (bundle in sync) e l’**uguaglianza
  cross-OS** (il manifest sha256 dei file generati). La matrix
  `gates-portability` gira su **due sistemi operativi reali**
  (`ubuntu-latest` e `windows-latest`), ognuno pubblica il proprio manifest e
  il job `gates-portability-compare` li confronta byte per byte. Il confronto
  non usa lo stato committato come riferimento: quello cambia a ogni PR (i
  blocchi aggregati li aggiorna il writer post-merge, per contratto ADR-0008),
  quindi non può essere il riferimento di un confronto cross-OS.

Il gate di portabilità confronta i byte, non lo stato logico: le tre
dipendenze storiche si manifestano proprio come byte diversi a parità di
fatti. E il riferimento è un altro sistema operativo reale, non una
convenzione.

### D-13.6 — Un solo gate per l'autorevolezza del bundle e dei blocchi

Il bundle è generato **dopo** l'aggregator e dentro lo stesso writer: la
coppia di file che il bundle copia (i blocchi aggregati) è quindi sempre
già aggiornata quando il bundle viene scritto. L'ordinamento dei due
generatori (aggregator → bundle) resta vincolante e viene verificato dal gate
di portabilità (che rigenera nell'ordine corretto e confronta i byte).

### D-13.7 — Il writer e il gate coprono anche le story *(issue #297)*

Il writer unico scriveva lo stato di merge **solo** sui file di
`docs/state/sessions/`, e il gate confrontava **solo** le sessioni: il
perimetro `docs/state/stories/` non aveva né un writer né un gate. Il caso
reale (Story 2.5, PR #295) mostra la conseguenza: una story mergiata è
restata `status: in-review` con `pr: 267` — una PR inesistente — e l'aggregatore
l'ha contata come non-done, con il blocco `AGGREGATE-NEXT-STEP-*` che la
indicava come «prossima story da implementare». Nessun errore, nessun warning,
CI verde.

La decisione è che **il perimetro del writer e del gate è la classe dei file di
stato**, non un sottoinsieme: i due coprono `docs/state/sessions/` e
`docs/state/stories/`, ciascuno nel **proprio formato**.

- Il writer riconosce il formato dal frontmatter: `state:`/`merged:` ⇒
  sessione; `status:` ⇒ story. Su una story il merge significa `status: done`,
  `merged_commit` e `merged_date` (lo schema delle story non ha il campo
  `merged`: il fatto è dichiarato una volta sola).
- Il gate confronta **entrambi** i perimetri con lo stato reale delle PR, e
  resta fail-closed: una story con la PR mergiata e `status` diverso da `done`
  è drift, come un `merged_commit` o un `merged_date` che non coincidono.
- Gli stati **terminali** dichiarati di una story (`blocked`, `wontdo`) non
  sono drift e il writer non li sovrascrive: il merge di una PR non cancella
  un esito dichiarato.

La regola generale che ne discende è la stessa del resto del protocollo
(`ADR-0012`): **una regola senza gate è un consiglio**. Due gate che coprono la
stessa classe di dati con un perimetro più stretto di quello che la classe
richiede sono un fail-open silenzioso.

## Alternative scartate

| Alternativa | Perché scartata |
|---|---|
| Aggiungere path al trigger `push` (PR #282) | Misurato insufficiente: i push con `GITHUB_TOKEN` non generano l'evento `push`. |
| Push dei writer con un PAT | Richiede un secret; il repository non ne ha (`gh secret list` vuoto) e aggiunge una credice a lungo termine dove il trigger nativo basta. |
| Tre writer con concurrency group | Il group serializza i *run*, non i *checkout* né i *push*: la race resta (misurato il 2026-11-02). |
| Rendere il gate merge-state tollerante | D-89.2: un gate che accetta «forse mergiato» non è un gate. Il gate resta fail-closed; cambia l'albero a cui si applica. |
| Container con immagine PowerShell fissata | `actions/checkout` richiede Node nel container: l'immagine PowerShell non lo ha, e l'installazione di Node nel container aggiunge un failure mode più fragile di quello che risolve. |
| Riscrittura dei generatori in Node (issue #66) | Strada corretta e già indicata dal backlog, ma è una riscrittura di due generatori (~90 KB di sorgente): non è necessaria per l'indipendenza dal SO, che la guardia di runtime + la locale invariante + l'ordinamento ordinale + il gate di portabilità rendono verificabile **oggi**. resta il passo naturale successivo. |

## Conseguenze

- **Un run in meno per merge**: il writer unico sostituisce tre workflow e i
  loro round-trip (prima: merge → 3 writer → bundle 2 volte).
- **`main` ha un solo scrittore**: ogni scrittura su `main` è tracciabile a un
  workflow, e i gate lo impongono.
- **Il gate merge-state ha due soggetti**: l'albero di un PR e lo stato finale
  di `main`. Entrambi sono verificati, in momenti diversi, senza tolleranze.
- **La portabilità è un gate, non un'intenzione**: se un generatore torna a
  dipendere dalla locale o dal fuso, la pipeline si rossa su entrambi i
  sistemi operativi.
- **Il writer non è più "non bloccante"**: se il writer fallisce, `main` resta
  rosso e il motivo è visibile. È il comportamento corretto: il fallback
  silenzioso (loggare un warning e andare avanti) è ciò che ha prodotto il
  drift invisibile degli ultimi mesi.

## Gate che impongono questa ADR

| Regola | Gate | File |
|---|---|---|
| Un solo workflow pusha su `main` | `validate-workflows.mjs` → `checkSingleWriter` | `scripts/test-workflow-writer-ordering.sh` (T6) |
| Il writer non filtra i merge con `paths:` | `validate-workflows.mjs` → `checkWriterTrigger` | `scripts/test-workflow-writer-ordering.sh` (T7) |
| La CI consuma il writer con `workflow_run` | `validate-workflows.mjs` → `checkWriterOrdering` | `scripts/test-workflow-writer-ordering.sh` (T2..T5) |
| Nel passaggio `workflow_run` la CI valida `main` | `validate-workflows.mjs` → `checkWorkflowRunCheckout` | `scripts/test-workflow-writer-ordering.sh` (T8) |
| Il writer sincronizza con `origin/main` prima del push | `validate-workflows.mjs` → `checkPushSync` | `scripts/test-workflow-push-sync.sh` (T2, T3) |
| La riga `git add` copre i `$targets` dell'aggregator | `validate-workflows.mjs` → `checkGitAddCoverage` | `scripts/test-workflow-git-add-coverage.sh` |
| Il gate merge-state differisce **solo** il caso strutturale | `check-merge-state.mjs --defer-unapplied` | `scripts/test-merge-state-gate.sh` (T10..T12) |
| Il gate merge-state confronta **anche** le story, nel loro formato (`status: done`) | `check-merge-state.mjs` (perimetro `docs/state/stories/`) | `scripts/test-merge-state-gate.sh` (T13..T18) · issue #297 |
| Il writer applica lo stato di merge anche alle story | `apply-merge-state.mjs` (perimetro `docs/state/stories/`) | `scripts/test-apply-merge-state.mjs` (T4..T9) |
| I generatori producono gli stessi byte su ogni OS | `check-generators-portable.mjs` (manifest cross-OS) | `scripts/test-generators-portable.sh` (T1, T2, T3) |
