---
number: 94
title: "Dopo la #290: numeri e diagnostiche riallineati, e un fail-open chiuso nel test"
date: 2026-11-03
state: 🟢
merged: true
merged_commit: "ff72162ec21f8b34b8fc8a2462ba1cfd32654d57"
merged_date: "2026-11-03T10:52:14Z"
branch: feat/292-hook-numbers
pr: 293
claim: kilo-hp-elitebook-7c3f
tags: [devops, protocollo, hook, ci]
---

# Sessione 94 — numeri e diagnostiche dopo la #290 (issue #292)

> **Oggetto**: la #290 (PR #291, merged) ha riattivato gli hook del repository. Il merge ha
> lasciato tracce non allineate e ha reso visibile un difetto **fail-open** nel test di
> regressione della stessa issue: la suite poteva riportare successo con un assert fallito.

## Sintesi

Il difetto più grave era **in un test che avevo scritto io**: `scripts/test-hook-wiring.sh`
esegue lo scenario T14 dentro una **subshell**, e i contatori `PASS`/`FAIL` incrementati li
restano dentro senza arrivare al padre. Il riepilogo riportava **16 assert** invece di 17 e —
il punto vero — **un T14 fallito non faceva fallire la suite** (exit 0 con un assert rosso).

È il difetto che il repository aveva già corretto in `scripts/test-safe-branch-switch.sh` («il
conteggio degli assert vive su un file condiviso: dentro le subshell i contatori in memoria non
arrivano al padre e la suite era fail-open»). La correzione è la stessa: i contatori vivono su
un file, non in variabili di shell.

**Contro-prova** (il test che non può fallire è un test che non è un test): con il
`.githooks/pre-push` reso irraggiungibile, la suite riporta `14 passati, 3 falliti` ed esce
**1**. Prima della correzione sarebbe uscita con 0.

Il resto della issue è allineamento di fatti e di diagnostiche:

- i conteggi degli assert del test erano rimasti a **13** in `AGENTS.md` (tabella «regola ⟺
  gate» e §"Un solo hooks path"), in `docs/12-DEVOPS.md §9.10` e nel file di sessione 93: ora
  sono **17** (12 verifiche statiche + 5 comportamentali);
- `setup-hooks.js` avvertiva che «gli hook di `.githooks/` non verrebbero eseguiti» quando
  trovava la cartella `.husky/`: ora che husky non è più una dipendenza, quella cartella è un
  **residuo locale** e da sola non ruba il path. Il messaggio dice la cosa vera e separa il
  caso innocuo dal caso pericoloso (husky che torna fra le dipendenze → **errore**, non warning);
- `post-merge.ps1` diceva «La worktree e' INTATTA: nessuna azione distruttiva eseguita» dopo
  un `git worktree remove` fallito con «Result too large»: è **falso** — in quel caso git ha
  *già* rimosso la registrazione e buona parte dell'albero, e proprio quella frase impediva di
  capire che la directory residua va rimossa a mano;
- due sezioni legacy dichiaravano ancora un toolchain con husky (`11-BACKLOG.md` T0.1.3,
  `SESSIONS.md` «Toolchain operativa»).

**Un buco emerso lavorando in questa sessione**: la convenzione «Conventional Commits» è
normativa (`AGENTS.md` §"Git workflow") ma **non aveva alcun gate in CI** — era verificata solo
dal `commit-msg` hook locale, che **salta quando `node_modules` non è installato**. L'ho
constatato su me stesso: i miei commit in questa worktree nuova sono passati con il WARN
«commitlint non disponibile (node_modules mancante?)», e nessuno li avrebbe bloccati. Ora il
gate gira nel job `gates-protocol` (che ha già `fetch-depth: 0`) sul range `base.sha..head.sha`
— il range esclude il merge commit di GitHub, il cui messaggio non è conventional.

**E un difetto nel `pre-push` appena riattivato**: il commit con il bundle rigenerato, creato
**durante** il push, non faceva parte di quel push (git calcola i ref da inviare **prima** di
eseguire l'hook). Il branch remoto restava con il bundle stale → CI rossa. Verificato in
laboratorio con un remoto locale: il bundle rigenerato non arrivava al remoto. Pushare da
dentro l'hook non è la soluzione: il push interno sposta il ref e fa fallire quello esterno con
«incorrect old value provided» (lease obsoleto), cioè con exit 1 su un push andato a buon fine.
L'hook ora **rigenera, committa e blocca** con l'azione esatta da fare — il comportamento che
`AGENTS.md` descriveva già («blocca il push se drift») — e `agent-pr.ps1` rigenera il bundle
prima di committare `pr: N`, così l'automazione non incappa mai nel blocco.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-94.1 | I contatori del test vivono su un **file condiviso**, non in variabili di shell | Uno scenario in subshell perdeva il conteggio: la suite era fail-open. È il pattern già in uso nel repository (`test-safe-branch-switch.sh`) |
| D-94.2 | Il gate sul wiring viene **verificato per la sua capacità di fallire** (contro-prova sullo hook reso irraggiungibile) | Un gate che non può fallire non è un gate (lesson 43-1): la prova che il fallimento propaga vale più del conteggio verde |
| D-94.3 | `setup-hooks.js` distingue il **residuo innocuo** (cartella `.husky/`) dal **pericolo** (husky che torna fra le dipendenze → errore) | Un warning che dichiara uno stato falso fa perdere fiducia nei warning: dopo la #290 la cartella non ruba più il path |
| D-94.4 | `post-merge.ps1` descrive lo stato **reale** del fallimento | «INTATTA» era falso: git rimuove la registrazione e parte dell'albero prima di arrendersi. La frase falsa nascondeva la necessità della rimozione manuale |
| D-94.5 | La convenzione Conventional Commits ha un **gate in CI** (job `gates-protocol`), non solo l'hook locale | L'hook `commit-msg` salta senza `node_modules`: la regola era verificata solo dove la dipendenza era installata. Una regola che si verifica solo da qualche parte non è una regola |
| D-94.6 | Il `pre-push` **rigenera, committa e blocca** con l'azione esatta; `agent-pr.ps1` rigenera prima di committare | Il commit del bundle non entra nel push in corso (git calcola i ref prima dell'hook): il remoto restava stale. Pushare dall'hook rompe il lease del push esterno. Il blocco esplicito è il comportamento documentato in `AGENTS.md` |

## Analisi di avanzamento

**Numeri.** Nessun codice applicativo toccato: la percentuale di implementazione delle story
resta **70%** (21 su 30, effort 72%), **9 step** rimanenti. Il lavoro è di **devops**.

**Cosa è pronto.**

- `scripts/test-hook-wiring.sh`: contatori su file condiviso, **17 assert**, e un assert fallito
  dentro una subshell non può più essere perso. La contro-prova lo dimostra (exit 1).
- I conteggi degli assert sono coerenti in `AGENTS.md`, `docs/12-DEVOPS.md §9.10` e nel file di
  sessione 93.
- `scripts/setup-hooks.js`: warning accurato sul residuo `.husky/`, **errore** se `husky` torna
  fra le dipendenze.
- `scripts/post-merge.ps1`: la diagnostica del fallimento della rimozione dice cosa è
  successo davvero (git ha rimosso la registrazione e parte dell'albero).
- Le due sezioni legacy che dichiaravano il toolchain sono allineate.
- Il gate **Conventional Commits** gira in CI (job `gates-protocol`): contro-prova locale, un
  messaggio non conventional esce con errore, uno conventional con 0.

**Cosa manca.** Niente sul piano funzionale. Nota: i file `docs/SESSIONS.md`,
`docs/INDEX.md`, `docs/11-BACKLOG.md` e `docs/BUNDLE.md` hanno **blocchi aggregati** e **prosa
legacy**: in questa PR ho toccato solo la prosa (che è di mia competenza); i blocchi si
aggiornano da soli dopo il merge.

**Salute tecnica.** Nessun blocco `AGGREGATE-*` toccato a mano. Il test del wiring scrive solo
in directory temporanee.

**Gate di testabilità.** `bash scripts/test-hook-wiring.sh` → 17/17 (contro-prova: exit 1) ·
`bash scripts/test-post-merge.sh` → 47/47 · `bash scripts/test-pre-commit-clean-check.sh` →
18/18 · `node scripts/check-protocol-consistency.mjs` → 0 falliti ·
`node scripts/check-merge-state.mjs` → 0 falliti · `node scripts/check-encoding.mjs` → 0 errori ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 · `pwsh scripts/generate-bundle.ps1 -Check` →
exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un contatore in una variabile di shell **non attraversa una subshell** | La suite riportava verde con un assert rosso: il gate proteggeva il repository da un difetto che lui stesso aveva. I contatori vivono su un file |
| Un test che non è mai stato visto fallire **non è testato** | La contro-prova (rendere l'hook irraggiungibile) è l'unico modo per sapere che il fallimento propaga |
| Un messaggio di diagnostica che dichiara uno stato **falso** fa perdere fiducia ai warning | «La worktree e' INTATTA» era falso proprio nel caso in cui serviva capire cosa fare: la diagnosi deve essere uno strumento, non una decorazione |
| Un warning che segnala un pericolo **passato** è rumore | La cartella `.husky/` è un residuo innocuo: segnalarla come pericolo insegnava a ignorare i warning |
| Una regola verificata **solo dove la dipendenza è installata** non è verificata | La convenzione Conventional Commits dipendeva dal `commit-msg` hook, che salta senza `node_modules`: in una worktree nuova la regola non esisteva |
| Un hook che modifica il repository **durante** il push produce una scrittura che il push non contiene | Git calcola i ref da inviare prima di eseguire il pre-push: il commit del bundle restava locale e il remoto stale. E pushare dall'hook non è la via: rompe il lease del push esterno |

## Documenti aggiornati

- `scripts/test-hook-wiring.sh` (contatori su file), `scripts/setup-hooks.js` (messaggi),
  `scripts/post-merge.ps1` (diagnostica della rimozione)
- `.github/workflows/ci.yml` (gate Conventional Commits nel job `gates-protocol`)
- `AGENTS.md` (v1.43: conteggio degli assert), `docs/12-DEVOPS.md` (§9.10), `docs/INDEX.md`
  (v1.43), `docs/11-BACKLOG.md` (T0.1.3), `docs/SESSIONS.md` (toolchain legacy),
  `docs/state/sessions/93-hook-wiring.md` (conteggi)
- `docs/state/sessions/94-hook-numbers.md` (questo file)
