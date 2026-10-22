---
number: 42
title: "Approvazione spec Apple Music (Story 1.2)"
date: 2026-10-22
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: docs/132-approve-apple-music-spec
pr: 134
claim: ""
cross_refs: [132, 133, 135]
tags: [docs, spec, adapter, phase-1]
---

# Sessione 42 — Approvazione spec Apple Music (Story 1.2)

## Sintesi

A chiusura della Story 1.1 la backlog puntava alla 1.2 come story successiva, ma
la spec `03-ADAPTERS/apple-music.md` era 🟡 **DRAFT** e la story non aveva né
state file né issue. Questa sessione ha creato l'issue #132, discusso con il Boss
quattro punti di calibrazione e promosso la spec a 🟢 APPROVED v1.0.

Il riscontro più importante è arrivato dalla discussione: **la spec prescriveva
`papaparse` dandola per una dipendenza già presente**, mentre
`packages/core/package.json` e `pnpm-lock.yaml` non la contenevano. La v0.1
descriva quindi uno stato del repo che non esisteva — lo stesso tipo di drift che
`11-BACKLOG.md` §3.3 dichiarava del formato Apple, e che la sessione 38 aveva
impegnato a eliminare dalle sezioni legacy.

## Trigger

Richiesta del Boss di preparare l'issue per la Story 1.2 dopo il merge della
1.1, seguita dalla revisione congiunta dell'issue stessa.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.42.1 | Promuovere subito la spec a 🟢 APPROVED (PR dedicata) invece di lasciare #132 in `needs-spec` | `AGENTS.md` richiede una spec APPROVED per `agent-ready`: senza il merge, la story non è lavorabile da nessun agente. Il percorso è lo stesso della 1.1 (PR di approvazione → swap di label) |
| D.42.2 | **`papaparse` come dipendenza estesa di `@ls/core`** (D5 nella spec §10) | Alternativa scartata: parser CSV scritto in casa sul modello di `jsonStream.ts`. Il CSV non è il JSON — quoting, `""`, newline in campo, BOM, CRLF e delimitatore variabile sono la superficie in cui un parser fatto a mano **perde righe in silenzio**. Su un export da 100k+ righe la perdita silenziosa costa più di ~45 kB gzip |
| D.42.3 | Story 1.2 da `[SIZE:M]` a `[SIZE:L]` | Lo scope supera la 1.1: 2 fonti dati, 2 schemi di export con tabella alias, ZIP ricorsivo multi-part, catena artista a 4 livelli, 16 casi fixture contro 12. Con `M` la story sfora a metà e finisce `status:blocked-other` |
| D.42.4 | Bias E.AP.1 **sempre** dichiarato all'utente, non solo sopra la soglia del 10% | Lo stesso ascolto può contare più volte (pause/riprese): è l'unico difetto percepibile dall'utente finale. La soglia del 10% resta come filtro del *warning numerico*, non come condizione di trasparenza — il rischio non dipende dallo scarto aggregato. Nuova chiave `info.pauseBias` a fine import |

## Difetti trovati lungo il percorso

**Pre-check del numero di sessione rotto** (issue **#133**, `bug`/`size:S`). La
procedura vincolante in `AGENTS.md` §"Allocazione numero di sessione" e in
`docs/state/_index.md` usa `git ls-tree --name-only origin/main
docs/state/sessions/` con anchor `^[0-9]+-`: `ls-tree` restituisce i **path
completi**, l'anchor non matcha mai, `Measure-Object -Maximum` su sequenza vuota
restituisce `$null`, e `$null + 1` = **`1`**. La procedura che esiste per impedire
la collisione fra agenti paralleli la **garantisce**: due agenti che la seguono
ottengono entrambi `1`. Il numero corretto era 42 (verificato con
`Split-Path -Leaf`).

**`papaparse` mai installata.** Presente in `apple-music.md` §10 e in
`11-BACKLOG.md` §"Story 1.2" come dipendenza già disponibile; assente da
`packages/core/package.json` e dal lockfile. Risolto come D5 nella spec v1.0.

**`ci.yml` non esegue più nessun job** (issue **#135**, `bug`/`size:M`/`priority:blocker`).
Scoperto aprendo la PR di questa sessione: il workflow fallisce in **0s con 0 job**
(check-suite `github-actions` `completed`/`failure` con **0 check-run**) su **43 run
consecutivi**, dal 2026-10-21T16:21Z. Ultimo run verde: 2026-10-21T15:14:18Z.
L'ultima modifica a `ci.yml` è `43d982d` (issue #120, 2026-10-21 18:21+0200), che
cade esattamente nel buco. Gli altri 5 workflow dello stesso repo, sugli stessi
runner e nello stesso intervallo, sono verdi.

Conseguenza: **`lint`, `typecheck`, `test`, `build`, i due check del bundle, il
determinismo dell'aggregator, la validazione dei workflow, i residui post-merge, la
sincronizzazione delle label e il lazy-state non girano da ~21 ore**. Ogni "CI
verde" dichiarato dopo quel momento è privo di fondamento. Il sospetto primario è
`43d982d`, ma l'annotazione esatta non è esposta via API quando la check-suite non
contiene check-run: serve la UI del run.

Da soltanto: il merge della Story 1.2 può procedere — i gate che la riguardano
(`generate-bundle.ps1 -Check`, `aggregate-state.ps1 -Check`) li ho verificati in
locale con `pwsh` 7.6.7 e sono veri — ma la copertura di CI va ripristinata prima
della prossima story di implementazione.

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (bundle rigenerato con pwsh **7**)
- `pwsh scripts/aggregate-state.ps1 -Check` → attende il merge: i blocchi
  `AGGREGATE-*` includeranno la 1.2 e la Sessione 42 dopo
  `auto-state-aggregate` (nessun blocco modificato a mano in questa PR)
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati

## Lesson learned

| # | Osservazione |
|---|--------------|
| 42-1 | **Risolve lesson 41-1**: `pwsh` 7.6.7 è ora disponibile su questa macchina (pacchetto winget `Microsoft.PowerShell` già presente, raggiungibile via alias MSIX in `%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`). I gate repo si invocano con `pwsh` + `-Check`, non con il doppio trattino in PS 5.1. Nota: il pacchetto era installato ma l'alias non si era registrato nella sessione → `pwsh` risultava "non riconosciuto" senza installazione alcuna |
| 42-2 | **Una spec APPROVED può contenere premesse false sul repo**: `papaparse` era descritta come già presente con la giustificazione "zero deps pesanti", ma non era mai stata aggiunta. Le specifiche di adapter sono scritte contro una *descrizione* dello stack, non contro `package.json`: il controllo minimo è `grep` del nome della dipendenza nei manifest, prima dell'approvazione |
| 42-3 | La procedura di pre-check documentata va eseguita **e il risultato va sanity-checkato**: un valore implausibile (1, quando esistono sessioni fino a 41) è il segnale che la procedura è rotta, non che il numero sia libero. Una difesa che restituisce sempre un numero valido *a posteriori* è indistinguibile da una difesa che funziona |
| 42-4 | Il numero di sessione 42 era **riservato** nei cross-ref della Sessione 41 per "`02` v1.3 + `03-ADAPTERS/youtube-music.md` v2 + `09` + `01`". Essendo un'intenzione in prosa e non un'allocazione (nessun file esistente), 42 è stato preso per l'approvazione Apple e quei lavori slittano a 43+ |
| 42-5 | **Un gate che non crea job è indistinguibile da un gate che passa**: `gh pr checks` mostrava solo GitGuardian (gli altri check del repo sono Netlify/Vercel in `queued` e `kilo-code-bot`), quindi `ci.yml` rotto da 21 ore non era visibile dalla PR. Il controllo che lo rivela è `gh run list --workflow ci.yml` con `conclusion` + **numero di job**: va valutato un gate sul *job count*, non solo sull'esito della run |

## Documenti aggiornati

- `docs/03-ADAPTERS/apple-music.md` — 🟢 APPROVED v1.0: status, §3.4 (bias sempre
  dichiarato), §9 (warning riscritto + nuova `info.pauseBias`), §10 (D5
  `papaparse`), changelog
- `docs/11-BACKLOG.md` — sezione Story 1.2 (`[SIZE:L]`, AC dalla spec, `**Spec**:`
  alla fonte reale), riga roadmap, changelog 1.6.3
- `docs/state/stories/1.2-adapter-apple-music.md` (**nuovo**) — primo state file
  di una story non-done dopo la 1.1: riattiva il blocco `AGGREGATE-NEXT-STEP-*`
  del `README.md`, che era tornato al fallback esplicito
- `docs/state/sessions/42-approve-apple-music-spec.md` (**nuovo**) — questa entry
- `docs/state/_index.md` — tabella "Stato della migration": le 2 nuove entry
- `docs/BUNDLE.md` — rigenerato

`scripts/generate-bundle.ps1` **non** è stato toccato: i nuovi file `state/`
seguono la curation già in essere (solo esempi: 0.4, 0.7, S38, S41), coerente con
la Story 1.1 che non ha aggiunto il proprio state file a `$files`.

## Note operative

- Issue **#132** creata con `needs-spec` e non `agent-ready`: la spec era DRAFT al
  momento della creazione. Lo swap `needs-spec` → `agent-ready` + `size:M` →
  `size:L` avviene al merge di questa PR.
- **Nessuna keyword di chiusura nel body della PR**: chiudere #132 significherebbe
  `status:done` su una story che non è iniziata. Si cita la keyword spezzata
  (`` `Closes` #134 ``) per non attivare `auto-status-done`.
- Worktree: `pwsh scripts/setup-worktree.ps1 132 -SkipGhCheck -BranchName
  docs/132-approve-apple-music-spec`. `-SkipGhCheck` è necessario perché lo
  script rifiuta issue non `agent-ready` (exit 2-7) e qui l'approvazione è
  proprio ciò che abilita `agent-ready`: la validazione rifiuterebbe il proprio
  sblocco.

## Cross-refs

- **#132** — issue della Story 1.2, `agent-ready` dopo il merge di questa PR
- **#133** — bug del pre-check del numero di sessione (procedura rotta in
  `AGENTS.md` + `docs/state/_index.md`)
- **#135** — `ci.yml` non esegue più nessun job dal 2026-10-21T16:21Z: tutti i gate
  bloccanti sono fuori esecuzione da ~21 ore
- **Sessione 41, D.41.7** — revoca di `locateInfos` di YouTube Music da recepire
  in `03-ADAPTERS/youtube-music.md` v2: slitta a 43+ perché il 42 è stato preso
  qui
- Prossima story lavorabile: **1.2** (Adapter Apple Music), poi 1.3 (Last.fm +
  ListenBrainz, spec mancante → `needs-spec`)