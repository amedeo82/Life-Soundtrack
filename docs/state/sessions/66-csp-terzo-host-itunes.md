---
number: 66
title: "Ratifica del terzo host della CSP (issue #196): D-AF.1 e D-AF.9 erano incompatibili"
date: 2026-10-30
state: 🟡
merged: false
branch: feat/196-csp-itunes-search-host
pr: 0
claim: kilo-hp-elitebook-jrka
cross_refs: [196, 188, 187]
tags: [privacy, devops, phase-2]
---

# Sessione 66 — Ratifica del terzo host della CSP (issue #196)

## Sintesi

La spec `21-AUDIO-FEATURES.md` (v1.0 🟢 APPROVED) conteneva **due decisioni
incompatibili**: D-AF.1 prescrive la ricerca
`GET https://itunes.apple.com/search` come fonte dell'audio, mentre D-AF.9
metteva in `connect-src` due host — l'API di AcousticBrainz e il **CDN** dei
file audio — **senza** l'host che risponde alla ricerca. Due acceptance
criteria della stessa spec non potevano essere vere insieme.

Il project owner ha **ratificato l'opzione A** (confermare il terzo host):
`https://itunes.apple.com` entra in `connect-src` e **D-AF.9 è emendata**
nella **v1.1** della spec. La CSP applicata al bundle **non cambia** — quel
host era già in `connect-src` dal merge della Story 4.1 (Sessione 64): questa
sessione allinea la **dichiarazione** al codice e chiude il buco che aveva
prodotto l'incoerenza.

## Trigger

Issue **#196** (`needs-spec`, `size:S`, `area:privacy`, `phase-2`), aperta
dalla Sessione 64 (issue #188, Story 4.1) con l'etichettatura della
contraddizione. Claim `kilo-hp-elitebook-jrka` (unico claim, riverificato:
ID GitHub 6526547721). Worktree `ls-196-csp-itunes-search-host`.

La ratifica è un atto del project owner: D-AF.9 era 🟢 APPROVED e quindi
vincolante. Le tre opzioni dell'issue (A: ratificare il terzo host · B:
rivedere D-AF.1 · C: accettare la degradazione) sono state messe davanti al
Boss, che ha scelto **A**: l'opzione B avrebbe lasciato la pipeline senza
provider acustico (nessuna fonte libera e senza autenticazione è nota) e
l'opzione C avrebbe lasciato il mood tracker senza dati misurati (D.A.1 vieta
il fallback su segnali inventati).

## Cosa è stato consegnato

| Consegnato | Dove |
|------------|------|
| **D-AF.9 emendata**: `connect-src` ammette anche `https://itunes.apple.com` | `docs/21-AUDIO-FEATURES.md` §3 (v1.1) |
| §2.1 riscritta: la fonte dell'audio richiede **due** host iTunes (ricerca e CDN) | `docs/21-AUDIO-FEATURES.md` §2.1 |
| La CSP dichiarata con i **tre** host e la nota della ratifica | `docs/21-AUDIO-FEATURES.md` §10.2 · `docs/12-DEVOPS.md` §2.1 (v1.1) |
| L'AC «il consumo di rete è limitato ai **tre** host dichiarati» | `docs/21-AUDIO-FEATURES.md` §16 · `docs/11-BACKLOG.md` (v1.6.27) · `docs/state/stories/4.1-audio-features.md` |
| I commenti del codice applicato, che dichiaravano la contraddizione | `apps/web/src/security/{hosts,csp}.ts` |
| **Un gate nuovo**: la `connect-src` applicata è confrontata con quella **dichiarata** in `docs/12-DEVOPS.md` | `apps/web/src/security/__tests__/csp.test.ts` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.196.1 | La ratifica è **A**: il terzo host entra in `connect-src` | L'opzione B (rivedere D-AF.1) non ha alternative: Spotify `audio_features` è morto per le nuove app e MusicKit costa 99 $/anno. L'opzione C (accettare la degradazione) lascia il mood tracker senza `valence`/`energy` misurate, che D.A.1 vieta di sostituire con segnali inventati. Una pipeline che non può mai misurare niente è un falso verde peggiore di un host in più |
| D.196.2 | La ratifica allinea la **dichiarazione** al codice, non il codice alla dichiarazione | Il codice applicato include l'host della ricerca dal merge della PR #197 (Sessione 64): la scelta dell'implementazione era *funzionare* invece di *degradare sempre*, dichiarata nei commenti. La ratifica rende quella scelta **vincolante** e le dà una base normativa |
| D.196.3 | Il confronto **dichiarazione ↔ codice** diventa un test | Il commento del file di test prometteva già «il test la confronta con quella dichiarata in `docs/12-DEVOPS.md`», ma il confronto non esisteva: il test confrontava solo la costante con il tag `<meta>`. Il drift che ha prodotto l'issue #196 era quindi invisibile. Il test legge ora il blocco `connect-src` del documento e lo confronta con la costante |

## Difetti trovati lungo il percorso

**La dichiarazione e il codice non erano confrontati da nessun gate**: il
confronto esisteva solo fra la costante e il tag `<meta>` di `index.html` — due
artefatti generati dalla stessa costante, quindi mai in disaccordo. La
dichiarazione in `docs/12-DEVOPS.md` era confrontata con **nessuno**. Il
risultato è la classe di difetto già vista in `05§6` e `09§4` dopo la ratifica
della Sessione 62 (tre documenti che dichiaravano fatti falsi): una sezione
che dichiara un fatto va confrontata con il codice che lo realizza.

**La CSP è in `12§5.1`, ma tutto il progetto la cita come `12§2.1`**: il
riferimento è ereditato dalla v0.1 della spec, quando la sezione era la 2.1.
Non è corretto in questa sessione — la correzione toccherebbe una ventina di
citazioni in sei documenti e nel codice applicato, e non è ciò che l'issue
chiede — ma è il genere di riferimento che invecchia in silenzio: nessun gate
lo confronta con il file (lesson 28-1).

## Verifica

- `pnpm run lint` → verde (core, web)
- `pnpm run typecheck` → verde (4 package)
- `pnpm run test` → verde: **490** test in `@ls/core` + **110** in `@ls/web`
  (il nuovo gate sulla `connect-src` dichiarata è il test 110)
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → drift **atteso** nei blocchi
  aggregati (SESSIONS/BACKLOG/INDEX/BUNDLE): li rigenera
  `auto-state-aggregate` post-merge (ADR-0008)
- `node scripts/check-readme-facts.mjs` → 15 check, 0 falliti
- `node scripts/validate-workflows.mjs .github/workflows` → 0 fallimenti

## Lesson learned

| # | Osservazione |
|---|----------------|
| 66-1 | **Un gate che confronta due artefatti della stessa costante non confronta nulla.** Il test della CSP verificava la costante contro il tag `<meta>`: i due non possono divergere, perché il tag è generato dalla costante. La dichiarazione in `12§2.1` era il terzo oggetto, ed era quello che poteva divergere — ed è divergito. Un gate deve confrontare la dichiarazione con l'implementazione, non due copie dello stesso sorgente |
| 66-2 | **Le decisioni ratificate vanno confrontate fra loro, non solo con il codice.** D-AF.1 e D-AF.9 sono state ratificate nella stessa PR (Sessione 62) senza che nessuno le confrontasse con l'endpoint che la prima richiede. La contraddizione è emersa **due sessioni dopo**, quando qualcuno ha dovuto implementare la ricerca |
| 66-3 | **Un host di ricerca e un host di contenuto sono due host.** `itunes.apple.com` (la ricerca) e `audio-ssl.itunes.apple.com` (i file) sono la stessa organizzazione, non lo stesso host: la CSP ragiona per origine, non per brand. L'errore è naturale in una lista scritta a mano, e invisibile finché la pipeline non chiama entrambi |
| 66-4 | **Il codice che degrada in silenzio è più difficile da notare del codice che fallisce.** La pipeline applicata includeva l'host non dichiarato e funzionava: nessun errore, nessun test rosso, solo un documento che mentiva. Dichiarare la contraddizione in un'issue `needs-spec` invece di adeguare il codice alla dichiarazione è ciò che ha reso la decisione visibile (lesson 64-2) |

## Documenti aggiornati

- `docs/21-AUDIO-FEATURES.md` — **v1.1 🟢 APPROVED**: header, §2.1, §3 (la nota
  della ratifica e la riga D-AF.9 emendata), §10.2, §16, §18 (la riga di
  `12-DEVOPS.md` e il changelog 1.1)
- `docs/12-DEVOPS.md` — **v1.1**: header, §2.1 (la CSP con i tre host e la nota
  della ratifica), changelog 1.1
- `docs/11-BACKLOG.md` — l'AC della Story 4.1 (i tre host) e il changelog v1.6.27
- `docs/INDEX.md` — le righe `11`, `12` e `21` e il "Prossimo passo tecnico"
  (l'issue #196 non è più un atto pendente del project owner)
- `docs/state/stories/4.1-audio-features.md` — stato, task T4.1.11, AC, la
  scelta D.188.11 e i limiti dichiarati (il punto 5 non è più un limite)
- `docs/state/sessions/66-csp-terzo-host-itunes.md` — **nuovo**
- `docs/18-DEV-LOG.md` — §31 (entry dell'issue #196) e changelog 2.20
- `apps/web/src/security/hosts.ts` — il commento che dichiarava la
  contraddizione è sostituito dalla ratifica
- `apps/web/src/security/csp.ts` — idem, più la versione della spec citata
- `apps/web/src/security/__tests__/csp.test.ts` — i nomi dei test e il **gate
  nuovo** sulla `connect-src` dichiarata
- `apps/web/vite.config.ts` — la versione della spec nel commento della CSP
- `scripts/generate-bundle.ps1` — `$files`: la sessione 66
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#196** — la ratifica (claim `kilo-hp-elitebook-jrka`)
- **#188** — la Story 4.1 (Sessione 64): l'implementazione che ha dichiarato
  la contraddizione
- **#187** — la ratifica della spec `21` v1.0 (Sessione 62), da cui la v1.1
  discende

## Note per la sessione successiva

- L'issue **#196** si chiude al merge (`Closes #196`): `auto-status-done`
  applicherà `status:done` e rimuoverà `in-progress`.
- Restano gli atti del project owner: la ratifica di `19-GEO-CONTEXT.md` +
  `13-ADR/0009` (🟡 DRAFT, Sessione 41) e il **cambio di licenza AGPL-3.0**
  (D-AF.2, atto sul file `LICENSE`).
- Non esiste più una story lavorabile migrata in `docs/state/stories/`: le
  2.2/2.3 dipendono dalla 2.1 (`[DEP:2.1]`) e non hanno uno state file. Le
  tranche rimaste sono la **UI** (Story 3.x) e il **lookup MusicBrainz**
  (Story 4.2).
