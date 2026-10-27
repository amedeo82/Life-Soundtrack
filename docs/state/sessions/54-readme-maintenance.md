---
number: 54
title: "Gate \"fatti del README\" — la prosa confrontata con il codice (issue #161)"
date: 2026-10-27
state: 🟢
merged: false
merged_commit: ""
merged_date: ""
branch: feat/161-readme-maintenance
pr: 164
claim: kilo-HP-ELITEBOOK-8enl
cross_refs: [161, 127, 149]
tags: [devops, docs, feat]
---

# Sessione 54 — Gate "fatti del README" (issue #161)

## Sintesi

Il `README.md` dichiarava **8 piattaforme importabili** (Spotify, YouTube Music,
Apple Music, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz) mentre nel codice
esistono **5** adapter: Deezer, Tidal e SoundCloud non hanno né factory in
`ADAPTER_FACTORIES` né classe in `packages/core/src/adapters/`. Dichiarava inoltre
come **presenti** audio features (valence, energy, danceability, BPM) e
analisi/mood/ricordi, che sono capability degli EPIC 4 e 2, non ancora implementate;
e duplicava in prosa un conteggio di stato (`EPIC 0 — Fundamentals: 7/7`) che i
blocchi aggregati forniscono già.

La prosa era rimasta quella del bootstrap (`ebdab9d`, 2026-10-14): i merge delle
Story 1.2 (`2e1a4cc`) e 1.3 (`7afbf03`) non avevano toccato il README, e nessuno dei
16 gate di `ci.yml` confrontava la prosa con il codice. **Pipeline verde, README
falso**: il fallimento silenzioso.

La Sessione 54 chiude il drift su tre livelli: **ownership** (la regola che dice
chi scrive cosa nel README), **gate** (il confronto automatico prosa ↔ codice) e
**prosa** (la riscrittura del README).

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.54.1 | Il gate è **read-only**: verifica, non genera | `README.md` è già un target di `scripts/aggregate-state.ps1` (blocco `AGGREGATE-NEXT-STEP-*`). Un secondo writer sullo stesso file riprodurrebbe la race fra i writer di `main` risolta dall'issue #149. Il gate dice se l'agente ha sbagliato; l'unico scrittore resta l'agente |
| D.54.2 | Le capability non implementate sono ammesse **solo** nella sezione roadmap | La roadmap è il posto legittimo per i claim futuri: vietarla interamente renderebbe il gate insostenibile (verrebbe disattivato al primo falso positivo — lesson 44-4). Il controllo è sulla **posizione** del claim, non sulla sua presenza |
| D.54.3 | Il gate **esclude** i blocchi aggregati dal controllo delle capability | Il titolo della story "Dedup promozione post-enrichment" contiene "enrichment": un controllo che non esclude i blocchi generati produrrebbe un falso positivo su un titolo che l'agente non ha scritto |
| D.54.4 | La sezione "Stato del progetto" del README contiene **puntatori**, non conteggi | L'anti-pattern "metti un puntatore, non una copia" (D.38.1) valeva per i file globali ma non per il README, che ne era un caso limite: ibrido, senza tabella di ownership |
| D.54.5 | Il gate è **bloccante** in CI, con un test di scenario negativo separato | Un gate che passa sempre non è un gate (lesson 43-1). Il test `scripts/test-readme-facts-gate.sh` reintroduce il drift in una fixture e verifica che il gate esca 1 |
| D.54.6 | Exit code 2 per errore di ambiente, non per drift | Fail-closed esplicito: un file sorgente mancante o non parsabile blocca la pipeline invece di lasciarla passare in silenzio — la classe di fallimento "assenza di sintomo" già vista con `metadata: read` (§9.9) |

## Difetti trovati lungo il percorso

**Il gate, alla prima esecuzione, passava sempre.** Due difetti indipendenti: il
parsing di `ADAPTER_FACTORIES` si fermava al primo `=` (l'annotazione di tipo
`() => PlatformAdapter` ne contiene uno, e il pattern `[^=]*` sbagliava la fine del
match), e la regex della sezione "oggi" non riconosceva `Cosa c'è oggi` per via
dell'apostrofo curly (`’`). Un gate che non intercetta niente è peggio di
nessun gate: dà la falsa sensazione che il drift sia sorvegliato.

**Il test di scenario negativo T2 non falliva.** La fixture **appendeva** la riga
`deezer` in fondo al file, quindi finiva nella sezione "Licenza", fuori dal
perimetro che il gate legge: la prova passava per il motivo sbagliato. Una prova
che non prova niente maschera il gate invece di proteggerlo — ed è il motivo per
cui la correzione del test precede l'ingresso in CI.

## Verifica

- `node scripts/check-readme-facts.mjs` → **15 check, 0 falliti**, exit 0
- `bash scripts/test-readme-facts-gate.sh` → **12 assert, 0 falliti** (T1..T9)
- `node scripts/validate-workflows.mjs .github/workflows` → exit 0
- `pnpm run lint` / `typecheck` / `test` / `build` → verdi
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (dopo rigenerazione)
- `pwsh scripts/aggregate-state.ps1 -Check` → drift atteso sui blocchi aggregati
  (li rigenera `auto-state-aggregate` post-merge)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 54-1 | **La documentazione che dichiara fatti verificabili dal codice è codice.** "8 piattaforme" è un'affermazione falsificabile, non un'opinione: il suo costo non è estetico, è la promessa falsa a chi arriva nel repository per la prima volta. Un gate che confronta i *formati* non confronta i *fatti*, e il drift più pericoloso è proprio quello che nessuno guarda |
| 54-2 | **Quando un artefatto ha due owner, la tabella degli owner deve esistere prima del gate.** Il README era ibrido (un blocco generato + prosa scritta a mano) e non compariva in nessuna tabella di ownership: nessuno si sentiva responsabile di aggiornarlo. Il gate verifica una cosa che nessuno corregge, se prima non si sa chi la corregge |
| 54-3 | **Un gate che passa sempre è peggio di nessun gate.** Il primo gate ha passato tutti i test perché non aveva mai intercettato un drift reale: due bug di parsing. Il test di scenario negativo (che reintroduce il drift in una fixture) è l'unico che può accorgersene — e va scritto *prima* di attivare il gate in CI, non dopo |
| 54-4 | **Una prova che non prova niente è peggio di una prova assente.** T2 appendeva la riga fuori dal perimetro del gate: passava per il motivo sbagliato. Il falso verde di una prova è più insidioso del suo falso rosso, perché convince chi legge il report |
| 54-5 | **Un blocco generato e una prosa hanno regole diverse, e il gate deve saperlo.** Il titolo di una story contiene parole che una capability vieta: senza l'esclusione dei blocchi aggregati il gate avrebbe prodotto un falso positivo su contenuto che l'agente non ha scritto — e un gate che blocca i casi legittimi viene disattivato al primo falso positivo |

## Documenti aggiornati

- `scripts/check-readme-facts.mjs` — **nuovo**: gate read-only (15 check)
- `scripts/test-readme-facts-gate.sh` — **nuovo**: test di regressione T1..T9
- `.github/workflows/ci.yml` — 2 step bloccanti (posizioni 17 e 18)
- `README.md` — prosa riscritta: "Cosa c'è oggi" con le 5 piattaforme reali,
  "Roadmap" separata, "Stato del progetto" ridotta a puntatori, "Sviluppo locale"
  e "Come contribuire"
- `AGENTS.md` — v1.27: §"Ownership del `README.md`" (D.161.1), checklist di
  auto-revisione PR, tabella di sincronizzazione al merge, struttura del repository
- `docs/12-DEVOPS.md` — §9.8f (nuova) + §9.10 a 18 step + changelog 0.9
- `docs/11-BACKLOG.md` — conteggio EPIC 1 allineato (`2/5` → `4/5`) + changelog 1.6.12
- `docs/18-DEV-LOG.md` — §20 (nuova) + changelog 2.0 + rimossi i 3 heading
  "## Changelog" duplicati
- `docs/INDEX.md` — righe `11`, `12`, `18-DEV-LOG`, `AGENTS.md` e il blocco
  "Documenti APPROVED / DRAFT" della sezione legacy
- `docs/state/sessions/54-readme-maintenance.md` — **nuovo**
- `docs/state/_index.md` — riga della Sessione 54 nella tabella della migration
- `scripts/generate-bundle.ps1` — `$files`: i due script nuovi + la sessione 54
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#161** — issue di questa sessione (claim `kilo-HP-ELITEBOOK-8enl`)
- **#127** — ADR-0008 V3: il blocco `AGGREGATE-NEXT-STEP-*` del README, che ha
  reso il file ibrido
- **#149** — la race fra i due writer di `main`: il motivo per cui il gate è
  read-only (D.54.1)
- `AGENTS.md` §"Ownership del `README.md`" (D.161.1) — la regola di ownership
- `docs/12-DEVOPS.md` §9.8f — la descrizione tecnica del gate
