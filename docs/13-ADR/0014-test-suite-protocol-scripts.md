# ADR-0014 — Copertura di test offline degli script di protocollo (`agent-claim.ps1`, `agent-pr.ps1`)

- **Stato**: 🟡 DRAFT (issue #304, Sessione 99, 2026-11-04) — in attesa di ratifica del project owner
- **Data**: 2026-11-04
- **Riferimenti**: issue #304 (suite di test mancanti), issue #302 (regressione dello yield), issue #256 (claim atomico, ADR-0006), issue #286 (test di regressione di `agent-pr.ps1`), issue #53 (worktree), ADR-0006, ADR-0012, `docs/12-DEVOPS.md` §9.13

## Contesto

`scripts/agent-claim.ps1` e `scripts/agent-pr.ps1` sono gli unici strumenti del
protocollo che **parlano con GitHub** (label, commenti `claim:`/`release:`,
creazione PR, push) e **non hanno alcuna suite di test**. Ogni regressione è
quindi intercettabile solo dal vivo, e la verifica «manuale» non è un gate.

Il caso reale è la regressione **#302**: nel ramo di riverifica persa,
`agent-claim.ps1` rimuoveva la label `in-progress`, in contraddizione con
ADR-0006 regola 4 («non rimuovere la label: serve al vincitore»). La regola
era scritta due volte (ADR-0006 e `AGENTS.md`) e **nessuna delle due copie
veniva eseguita**: il protocollo diceva una cosa, lo script ne faceva un'altra,
e la pipeline restava verde. La lezione è la stessa che chiude ADR-0012: *uno
script che implementa una regola può contraddirla se nessun test lo esercita*.

L'unica copertura esistente è `scripts/test-agent-pr.sh` (issue #286): **due**
scenari, sul solo step 6 (scrivere `pr: N` nel file di sessione). La claim
atomica, la riverifica, il `-Stale` con TTL di 12 ore, la transizione delle
label e il controllo della keyword di chiusura non sono coperti da nulla.

La issue **#304** chiede tre cose verificabili: una suite per `agent-claim.ps1`
che eserciti i rami `claim concesso`, `claim perso`, `-Stale` con TTL scaduto e
`-Stale` con TTL **non** scaduto; una suite autonoma per `agent-pr.ps1` che
verifichi transizione delle label, keyword di chiusura e scrittura di `pr: N`;
l'esecuzione in CI **senza accesso alla rete e senza dipendenze native di `gh`**,
con exit code non zero al fallimento.

I due punti che bloccavano la issue (label `needs-spec`) erano la scelta della
strategia di mock e l'inventario delle funzioni da coprire. La strategia è
ratificata dal project owner in questa sessione (**mock di `gh` a livello di
PATH, offline**); l'inventario è la sezione «Decisione» di questo ADR.

## Decisione

### D-14.1 — Il mock di `gh` è un eseguibile sul PATH, offline e *stateful*

La rete e il `gh` nativo sono esclusi per contratto (AC della issue #304): il
mock è uno script PowerShell (`scripts/mock/gh.ps1`) con due launcher —
`gh` (POSIX, con shebang) e `gh.cmd` (Windows) — che il driver mette **in
testa** al `PATH` della suite. Nessun token, nessuna env var di
autenticazione, nessuna chiamata che esca dalla macchina.

Il mock è **stateful**: lo stato (issue, label, commenti, PR, elenco delle
chiamate) vive in un JSON nella directory temporanea della suite, indicata
dalla env var `LS_GH_MOCK_STATE`. La statefulness non è un dettaglio: la
riverifica di `agent-claim.ps1` deve vedere **il commento di claim che lo
script ha appena postato**, e il `-Stale` deve poter dichiarare scaduto un
claim che il mock ha creato 20 ore fa.

Il mock registra inoltre **ogni invocazione** ricevuta (argomenti grezzi) in
`calls[]`. Le asserzioni verificano quindi *quali comandi sono stati eseguiti*
— per esempio «nessuna `--remove-label` dopo una riverifica persa» — e non
solo lo stato finale: è l'unico modo di distinguere «label conservata» da
«label rimossa e riapplicata».

Il tempo è **iniettato**: lo stato contiene un orologio base (`now`) e il mock
deriva `created_at` da quel valore. I casi di TTL sono così deterministici e
non dipendono dall'orologio della macchina (la classe di difetto che ha reso
flaky il test `T3` dell'aggregator, issue #142).

### D-14.2 — Il contratto del mock: le invocazioni intercettate

| # | Invocazione | Risposta del mock | Usata da |
|---|-------------|-------------------|----------|
| 1 | `gh repo view --json nameWithOwner --jq .nameWithOwner` | `test/test` | `agent-claim.ps1:85`, `agent-pr.ps1:58` |
| 2 | `gh issue view <N> --json number,title,state,labels` | JSON dell'issue con `labels[]` | `agent-claim.ps1:172` |
| 3 | `gh issue view <N> --json title --jq .title` | titolo dell'issue | `agent-pr.ps1:127` |
| 4 | `gh issue edit <N> --add-label <L>` / `--remove-label <L>` | exit 0, muta le label | `agent-claim.ps1:226`, `agent-pr.ps1:147` |
| 5 | `gh issue comment <N> --body <B>` | exit 0, appende `{id, body, created_at}` | `agent-claim.ps1:238`, `:243`, `:267` |
| 6 | `gh api repos/<slug>/issues/<N>/comments` | array JSON dei commenti | `agent-claim.ps1:128`, `:248` |
| 7 | `gh pr list --state open --limit 100 --json number,headRefName,updatedAt` | array JSON delle PR aperte | `agent-claim.ps1:147` (TTL) |
| 8 | `gh pr create --base <B> --head <H> --title <T> --body-file <F>` | `https://github.com/test/test/pull/<N>` | `agent-pr.ps1:139` |
| 9 | qualunque altra invocazione | exit 1 con messaggio esplicito | — |

La riga 9 è una **scelta deliberata**: un mock che risponde `exit 0` a tutto
è un mock che può mascare una chiamata non prevista (lo stesso principio del
gate «un gate che passa sempre non è un gate», lesson 43-1). Se gli script
cresceranno e useranno una nuova invocazione, la suite fallisce e dice
quale.

### D-14.3 — Inventario dei casi di `agent-claim.ps1`

| ID | Scenario | Atteso | Exit |
|----|----------|--------|------|
| T1 | claim concesso (issue `agent-ready`, nessun claim attivo) | label `in-progress` aggiunta; commento `claim:` postato; `agent-state.json` scritto con `issue`, `agent_id`, `branch`, `claim_id` = id del commento | 0 |
| T2 | **claim perso** (un altro claim attivo con id più basso) | commento `yield:` postato; **label `in-progress` conservata** (nessuna `--remove-label` in `calls[]`); nessun `agent-state.json` | 4 |
| T3 | `-Stale` con **TTL scaduto** (claim attivo di 20 ore) | commento `stale-release:` che **cita l'agente stantio**; poi `claim:` nuovo; riverifica vinta; label `in-progress` presente | 0 |
| T4 | `-Stale` con **TTL non scaduto** (claim attivo di 2 ore) | **zero modifiche**: nessun commento postato, nessuna label cambiata, nessun file di stato | 5 |
| T5 | issue senza label `agent-ready` | zero modifiche | 3 |
| T6 | issue già `in-progress`, senza `-Stale` | zero modifiche | 3 |
| T7 | `-DryRun` | zero modifiche su GitHub (nessuna label, nessun commento) | 0 |

T2 è la regressione **#302** (la regola che nessun test esercitava). T3 e T4
coprono il takeover TTL introdotto da `agent-claim.ps1 -Stale` (D-98.2) nelle
**due** direzioni: il takeover ammesso e il takeover rifiutato.

T5 e T6 non sono richiesti dagli AC, ma sono la validazione minima della
precondizione: senza di essi, un mock che restituisce sempre `agent-ready`
passerebbe T1..T4 senza mai verificare la validazione dell'issue.

### D-14.4 — Inventario dei casi di `agent-pr.ps1`

| ID | Scenario | Atteso | Exit |
|----|----------|--------|------|
| T1 | sessione singola con `branch:` corrispondente | `pr: 77` scritto nel file di sessione | 0 |
| T2 | nessuna sessione corrispondente | warning `NESSUN file di sessione`, nessuna scrittura | 0 |
| T3 | transizione delle label | in `calls[]`: `gh issue edit <N> --remove-label agent-ready --add-label status:in-review` | 0 |
| T4 | keyword di chiusura **assente** | **nessuna PR creata** (nessuna `gh pr create` in `calls[]`) | 1 |
| T5 | keyword di chiusura **dentro backtick** | nessuna PR creata | 1 |
| T6 | keyword di chiusura su **un'altra issue** | nessuna PR creata | 1 |
| T7 | file di stato dell'agente assente | nessuna PR creata | 3 |

T1 e T2 sono i due scenari esistenti (`test-agent-pr.sh`, issue #286): la
suite li conserva e li estende, così l'AC «suite autonoma, non solo il test di
regressione puntuale» è soddisfatto senza perdere la copertura già acquisita.

### D-14.5 — Le suite girano in CI, bloccanti, senza rete

Le due suite entrano in `.github/workflows/ci.yml` nel job **`gates-procedure`**
(già nell'elenco `needs:` del job aggregatore `quality`): un passo per
`bash scripts/test-agent-claim.sh` e uno per `bash scripts/test-agent-pr.sh`.
Il job `quality` è l'aggregatore **fail-closed**: se uno dei due fallisce, la
PR è rossa.

Vincoli di CI: il `PATH` della suite contiene il mock e **non** il `gh` vero;
nessuna env var di autenticazione è necessaria; le suite girano su repository
git temporanei (con un remoto finto) e non toccano il repository reale.

### D-14.6 — Una regola, un gate (ADR-0012)

Quando le suite esistono, `AGENTS.md` §"Il contratto del protocollo: regola ⟺
gate" guadagna la riga che dichiara la regola «gli script di protocollo hanno
una suite offline che ne verifica il comportamento». La riga è verificata da
due gate: `check-protocol-consistency.mjs` (C5: gli script citati esistono
davvero) e l'esecuzione della suite in CI (la regola è **enforzata**, non
dichiarata). Nessuna regola senza gate: la riga di `AGENTS.md` e la suite
nascono **nello stesso commit**.

## Alternative scartate

| Alternativa | Perché scartata |
|---|---|
| Repository GitHub di test + token reale | viola l'AC «senza accesso alla rete e senza dipendenze native di `gh`»; non riproducibile in CI; i test scrivono su GitHub durante l'esecuzione |
| Pester (framework di test PowerShell) | il repository non ha Pester e non vuole aggiungere un toolchain; le suite esistenti sono bash + `pwsh`, ed è il pattern che il repo ha già scelto e collaudato |
| Suite in Node.js | gli script sotto test sono PowerShell: il test deve comunque invocare `pwsh`; il driver bash + mock PowerShell è il pattern già in uso (`test-setup-worktree.sh`, `test-agent-pr.sh`) |
| Estrarre la logica degli script in un modulo testabile | refactor di due strumenti di protocollo già in uso: il rischio è maggiore del difetto che si vuole coprire |
| Un mock duplicato in ciascuna suite | due copie divergono (la classe di drift che il repo ha già imparato a costo); il mock è **un file solo**, con i launcher generati dal driver |
| Test E2E «live» manuali contro il repository vero | non riproducibili, non bloccanti, e l'errore umano nel claim è proprio il difetto da coprire |
| Copertura per riga (strumenti di coverage) | la copertura per riga non dice nulla del **comportamento osservabile** (exit code, chiamate a `gh`, file prodotti) e rende i test fragili rispetto a ogni refactor interno degli script |

## Conseguenze

- **La regressione #302 diventa intercettabile in CI**: il ramo di riverifica
  persa ha un test che verifica che la label `in-progress` resta al vincitore.
- **Il takeover TTL è verificato nelle due direzioni**: `-Stale` ammesso (T3) e
  `-Stale` rifiutato senza toccare nulla (T4). Il secondo è il caso più
  pericoloso: uno script che «prende» un claim ancora valido.
- **Le suite sono deterministiche**: l'orologio è iniettato dal mock, i
  repository sono temporanei, nessuna dipendenza dalla rete o da `gh`.
- **Il costo è basso e bounded**: tre file (`scripts/mock/gh.ps1` e le due
  suite), nessuna dipendenza nuova, ~3-8 s di esecuzione per suite.
- **La copertura è per comportamento osservabile**: un refactor interno degli
  script non rompe la suite; un cambio di comportamento sì.
- **La copertura è per casi, non esaustiva**: i casi elencati coprono i rami
  dichiarati dagli AC e le precondizioni minime; non è una copertura
  esaustiva delle righe.

## Criteri di accettazione (mapping con l'issue #304)

| AC dell'issue #304 | Casi che lo soddisfano |
|---|---|
| Suite per `agent-claim.ps1` con `gh` mock offline: claim concesso, claim perso (yield, label `in-progress` conservata), `-Stale` con TTL scaduto, `-Stale` con TTL non scaduto (exit 5, nessuna modifica) | `test-agent-claim.sh` T1, T2, T3, T4 |
| Suite autonoma per `agent-pr.ps1`: transizione label, keyword di chiusura, scrittura `pr: N` | `test-agent-pr.sh` T1, T3, T4, T5, T6 |
| I test girano in CI, senza rete e senza dipendenze native di `gh`; exit code non zero al fallimento | job `gates-procedure` in `ci.yml` (D-14.5) |

## Piano di implementazione

1. `scripts/mock/gh.ps1` — il mock stateful (D-14.1, D-14.2).
2. `scripts/test-agent-claim.sh` — driver + casi T1..T7 (D-14.3).
3. `scripts/test-agent-pr.sh` — suite estesa con T3..T7 (D-14.4); i casi T1 e
   T2 esistenti vengono conservati.
4. `.github/workflows/ci.yml` — due step nel job `gates-procedure` (D-14.5).
5. `AGENTS.md` — riga nella tabella regola ⟺ gate + versione; `docs/INDEX.md` —
   versione di `AGENTS.md` (gate C1) e riga `13-ADR/`.
6. `docs/12-DEVOPS.md` — §9.10 (catalogo dei gate) e §9.13 (audit della
   copertura CI: i due script non sono più privi di suite).
7. `scripts/generate-bundle.ps1` — i nuovi file in `$files`; rigenerazione di
   `docs/BUNDLE.md` (aggregator **prima**, bundle **poi**).
8. `docs/state/sessions/99-*.md` — il file di sessione.

## Gate che impongono questa ADR

| Regola | Gate | File |
|---|---|---|
| `agent-claim.ps1`: claim concesso, claim perso, `-Stale` scaduto, `-Stale` non scaduto | suite offline (mock `gh` su PATH) | `scripts/test-agent-claim.sh` (T1..T4) |
| `agent-claim.ps1`: la validazione dell'issue precede il claim | suite offline | `scripts/test-agent-claim.sh` (T5, T6) |
| `agent-pr.ps1`: transizione label, keyword di chiusura, `pr: N` nella sessione | suite offline | `scripts/test-agent-pr.sh` (T1, T3, T4, T5, T6) |
| Le suite girano in CI, offline, e falliscono la PR | job `gates-procedure` → `quality` (fail-closed) | `.github/workflows/ci.yml` |
| Il mock è offline e non usa il `gh` nativo | il `PATH` della suite è costruito dal driver (mock in testa, `gh` nativo escluso) | `scripts/test-agent-claim.sh`, `scripts/test-agent-pr.sh` |
| La regola «gli script di protocollo hanno una suite» è dichiarata | `check-protocol-consistency.mjs` (C5: gli script citati esistono) | `AGENTS.md` §"Il contratto del protocollo" |
