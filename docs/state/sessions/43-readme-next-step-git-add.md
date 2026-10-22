---
number: 43
title: "auto-state-aggregate committa il blocco NEXT-STEP del README (issue #136)"
date: 2026-10-22
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: fix/136-readme-next-step-git-add
pr: 137
claim: kilo-HP-ELITEBOOK-0a1b
cross_refs: [127, 135, 73]
tags: [devops, ci, adr-0008, bug]
---

# Sessione 43 — `auto-state-aggregate` non committa il blocco NEXT-STEP del README (issue #136)

## Sintesi

ADR-0008 V3 (issue #127, Sessione 42) ha aggiunto `README.md` come **quinto** file
gestito da `scripts/aggregate-state.ps1`, con il blocco
`<!-- AGGREGATE-NEXT-STEP-{START,END} -->` che dichiara la prossima story da
implementare. Il generatore lo scriveva regolarmente; il workflow che doveva
**committarlo** no.

`.github/workflows/auto-state-aggregate.yml` elenca a mano i path da mettere in
staging, e quell'elenco era rimasto quello di V2: senza `README.md`. Lo step
"Apply aggregator" scriveva il blocco, `git diff --name-only` lo vedeva, il
commit riusciva — ma con 4 file invece di 5, e il `README.md` modificato moriva
nel working tree del runner. Nessun errore, nessun warning: un commit che
riporta successo scarta silenziosamente il lavoro che aveva appena fatto.

Il drift è rimasto invisibile per una ragione che vale la pena registrare: era
**coerente per caso**. Finché esisteva una sola story `done`, il fallback
generato (`_Nessuna story non-done migrata..._`) coincideva byte per byte con il
testo già presente in `README.md`, quindi `aggregate-state.ps1 -Check` usciva 0 e
non c'era alcun sintomo osservabile. Il bug si è manifestato alla prima story
`todo` — la 1.2, creata in Sessione 42 — ed è lì che `-Check` è passato da 0 a 1
(`README.md`: `Atteso: 542 chars, Trovato: 393 chars`).

## Trigger

Lettura di `README.md` durante la sessione di approvazione della spec Apple
Music: la sezione "Prossima story" dichiarava l'assenza di story non-done mentre
`docs/state/stories/1.2-adapter-apple-music.md` esisteva con `status: todo` e il
blocco `AGGREGATE-STORIES-*` del backlog lo elencava correttamente. L'issue #136
era gia' aperta con la diagnosi completa.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.43.1 | Fix di **una parola** nella riga `git add` (non riscrittura del workflow) | Il difetto era nella lista, non nel meccanismo: lo step di commit funziona, elencava un target in meno |
| D.43.2 | Gate di copertura in `scripts/validate-workflows.mjs`, non in uno script nuovo | Il file è gia' un gate bloccante in CI (issue #73) e gia' legge i workflow: nessuna nuova dipendenza, nessun nuovo step che un agente possa dimenticare di eseguire |
| D.43.3 | Copertura accettata per **prefisso** (path letterale, directory con `/`, radice `.`) | Un gate che pretende i path letterali spingerebbe verso `git add -A`, che l'issue scarta esplicitamente (commit del bot non prevedibile, aggreggerebbe file non correlati) |
| D.43.4 | Test di regressione **separato** con scenario negativo | Il gate di per se' può passare sempre e sembrare verde. T2 reintroduce il bug in una fixture e verifica che il gate esca 1: è l'unico modo per dimostrare che il gate è un gate |

## Difetti trovati lungo il percorso

**Il drift era mascherato anche da `ci.yml` rotto** (issue #135): dal
2026-10-21T16:21Z nessun job gira, quindi il gate di copertura — come gli altri
— non sarebbe scattato in CI nemmeno col workflow integro. La verifica di
questa sessione è locale (`pwsh` 7.6.7 + `node`), non CI.

**Il messaggio di commit del bot elencava 5 target su 6**: la lista dei blocchi
nel corpo del commit si era fermata a V2. Stesso drift, testo invece di path —
corretto insieme.

**`README.md` era già in `docs/BUNDLE.md` ma non nello staging del workflow**:
i due elenchi che il repo mantiene per lo stesso file (il `$files` del bundle e
la riga `git add`) erano già divergenti prima di questo fix, senza che nessun gate
lo notasse. È la stessa classe di drift di #86/#88, applicata agli strumenti.

## Verifica

- `node scripts/validate-workflows.mjs .github/workflows` → exit 0, `[OK] auto-state-aggregate.yml: la riga git add copre tutti i 5 $targets`
- `bash scripts/test-workflow-git-add-coverage.sh` → 8/8 (T1 reale, T2 reintroduzione del bug → exit 1, T3 nessuna riga `git add` → exit 1, T4 copertura per radice → exit 0)
- `pwsh scripts/aggregate-state.ps1` → `README.md` riscritto con la 1.2; **seconda run identica** (nessun diff): il blocco non oscilla (AC "idempotenza")
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0 su tutti e 6 i blocchi (era exit 1 su `README.md`)
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `bash scripts/test-aggregate-determinism.sh` → invariato (nessuna modifica a `aggregate-state.ps1`)

## Lesson learned

| # | Osservazione |
|---|--------------|
| 43-1 | **Un gate che passa sempre non è un gate**: l'assert di copertura, da solo, avrebbe potuto essere scritto in modo da non coprire nulla e restare verde. Il test che reintroduce il bug è ciò che distingue un gate da un controllo cosmetico |
| 43-2 | **Il fall-open più insidioso è quello senza sintomo**: finché l'output generato coincideva con il testo in file, `-Check` dava 0 e la lista rotta era indistinguibile da quella corretta. Un gate che verifica la *coerenza* non può vedere un target che non viene nemmeno committato: serve un gate che confronti gli elenchi |
| 43-3 | **Un nuovo target di un generatore ha effetti a valle**: aggiungerlo richiede aggiornare, nello stesso commit, ogni lista che lo consuma a mano — staging del workflow, `$files` del bundle, tabelle documentali — e aggiungere un check che confronti le liste. È l'estensione della regola D.38.1 dagli aggregati agli strumenti |
| 43-4 | Un diff di 4 righe che *non compare* nel commit è più difficile da notare di un diff di 400 righe: l'assenza di lavoro nel commit non è un sintomo che l'occhio o `git log --stat` segnalano |

## Documenti aggiornati

- `.github/workflows/auto-state-aggregate.yml` — `README.md` nella riga `git add`, blocco NEXT-STEP nel messaggio di commit, nota di-header
- `.github/workflows/ci.yml` — step bloccante `Copertura git add vs $targets (issue #136)`
- `.github/CODEOWNERS` — entry esplicita per `auto-state-aggregate.yml` (era coperto solo dalla regola di directory)
- `scripts/validate-workflows.mjs` — assert di copertura `$targets` ↔ `git add`
- `scripts/test-workflow-git-add-coverage.sh` (**nuovo**) — T1..T4 con scenario negativo
- `scripts/generate-bundle.ps1` — `$files` += il nuovo test
- `docs/12-DEVOPS.md` — §9.8c (nuova) + changelog 0.4
- `AGENTS.md` — v1.21 → v1.22: tabella target allineata al V3, riga `auto-state-aggregate` del Livello 1, footer
- `README.md` — blocco `AGGREGATE-NEXT-STEP-*` risincronizzato (non modificato a mano: rigenerato dall'aggregator)
- `docs/BUNDLE.md` — rigenerato
- `docs/state/sessions/43-readme-next-step-git-add.md` (**nuovo**) — questa entry

## Note operative

- Nessun blocco `<!-- AGGREGATE-* -->` modificato a mano: il README è stato
  risincronizzato eseguendo `pwsh scripts/aggregate-state.ps1`, che è
  esattamente ciò che il workflow avrebbe dovuto fare da #127. È la ripetizione
  del pattern "doc-sync di emergenza" di AGENTS.md §"Livello 3", resa necessaria
  dal fatto che il generatore non è mai arrivato a committarlo.
- I diff di `docs/SESSIONS.md`, `docs/INDEX.md` e `docs/BUNDLE.md` in questa PR
  sono **output dell'aggregator e del generatore di bundle**, non scritture
  manuali: sono la conseguenza della nuova sessione 43 e della sincronizzazione
  del README. Non potevano essere lasciati fuori: senza il README risincronizzato
  `aggregate-state.ps1 -Check` resterebbe su exit 1, che è esattamente l'AC di
  #136. L'aggregator è idempotente, quindi la run post-merge di
  `auto-state-aggregate` produrrà zero diff.
- **Gate assente**: i check di questa sessione sono stati eseguiti in locale.
  Ripristinare `ci.yml` (#135) è prerequisito perché il nuovo gate sia effettivo.
- `pnpm run lint` / `typecheck` / `test` / `build` non sono stati eseguiti: la
  worktree non ha `node_modules` (le dipendenze vivono nella working copy
  principale) e **nessun file applicativo è stato toccato** — la PR non contiene
  codice in `apps/` o `packages/`.

## Cross-refs

- **#136** — il bug; chiuso da PR #137
- **#127** — ADR-0008 V3, che ha creato il blocco NEXT-STEP senza aggiornare lo staging
- **#135** — `ci.yml` non esegue più alcun job: il gate di copertura non gira finché non è ripristinato
- **#73** — `validate-workflows.mjs`, il file in cui è stato cablato il gate di copertura
- **#86 / #88** — stessa famiglia di elenchi tenuti in due posti diversi