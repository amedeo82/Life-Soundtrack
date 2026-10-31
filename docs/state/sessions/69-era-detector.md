---
number: 69
title: "Story 2.2 — Era Detector (issue #211)"
date: 2026-10-31
state: 🟡
merged: false
branch: feat/211-era-detector
pr: 212
claim: kilo-HP-ELITEBOOK-4f2k
cross_refs: [211, 205, 180, 178, 193]
tags: [analysis, phase-2]
---

# Sessione 69 — Story 2.2: Era Detector (issue #211)

## Sintesi

La Story 2.2 implementa il **rilevatore di ere**: la segmentazione della
storia di ascolto in periodi coerenti, secondo l'algoritmo di
`docs/04-ANALYSIS-ALGORITHMS.md` **v1.0 🟢 APPROVED** (§5, ratificata nella
Sessione 59, issue #178).

L'algoritmo è **change point detection** su firme settimanali, non clustering
non supervisionato (esclusione dichiarata in `04§5`): si comparano le firme
di finestre **adiacenti** e, dove la similarità crolla sotto la soglia, nasce
un confine. Il risultato è deterministico per costruzione — nessun centroide,
nessuna gerarchia, nessuna inizializzazione casuale.

Il pacchettoconsegnato:

- **il motore** (`packages/core/src/analysis/era/`): `signature.ts`,
  `similarity.ts`, `detect.ts`, `engine.ts`, `derivedVersion.ts`, `i18n.ts`,
  `types.ts`;
- **la persistenza**: gli insight di tipo `era` con `derivedVersion` e il
  ricalcolo che sostituisce **l'insieme** delle ere
  (`replaceAllInsightsOfType`);
- **il plug-in** `createEraGenerator` dell'orchestratore (`04§8.1`, D-A.5:
  il contratto non cambia);
- **il fixture di scenario** `fixtures/scenarios/era-shift.json`;
- **37 test** nuovi in `@ls/core`.

## Trigger

Il blocco NEXT-STEP del README indicava la **2.2** come prima story
lavorabile (è la prima non-done fra quelle migrate in `docs/state/stories/`),
ma **non esisteva alcuna issue `agent-ready`**: il repository non aveva
nessuna issue aperta, e la story non era claimabile. L'agent ha quindi
aperto la **issue #211** (`size:L`, `agent-ready`, `area:analysis`,
`phase-2`) con gli AC ricavati dalla spec ratificata, poi ha eseguito la
procedura di claim (ADR-0006): label `in-progress` + commento `claim:
kilo-HP-ELITEBOOK-4f2k`, riverificato come **unico** claim attivo.

Worktree `ls-211-era-detector`, branch `feat/211-era-detector` (creata con
`scripts/setup-worktree.ps1 211`, push early D.20.2).

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| Il **motore** dell'era detector | `packages/core/src/analysis/era/` |
| Il plug-in dell'orchestratore | `createEraGenerator` in `analysis/pipeline.ts` |
| Il ricalcolo dell'**insieme** delle ere | `replaceAllInsightsOfType` in `db/insights.ts` |
| Il **contratto i18n** condiviso | `analysis/i18n.ts` (prima viveva nel memory engine) |
| I **template** dell'etichetta | `insight.era.*` in `apps/web/src/i18n/locales/{it,en}.json` |
| Il **fixture di scenario** | `fixtures/scenarios/era-shift.json` (`scripts/generate-fixtures.mjs era`) |
| I **37 test** | `analysis/__tests__/era-{engine,persistence,scenarios}.test.ts` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| **D.69.1** | L'algoritmo è **change point detection** su firme adiacenti: il numero di ere è quello dei confini rilevati | È l'algoritmo di `04§5.2` e l'AC «l'algoritmo **non** usa clustering non supervisionato». Il confronto è **locale** (finestra i e i+1), non globale: il rilevamento è incrementabile e il risultato non dipende dall'ordine di elaborazione |
| **D.69.2** | Il mood dominante dell'era è classificato dal **classificatore del mood tracker** (`04§3.2`), con le **stesse soglie** | L'AC chiede che l'era porti «il mood dominante e le medie di valence/energy **lette dal mood tracker**». Classificare con lo stesso classificatore e le stesse soglie è ciò che rende le due letture coerenti: un'era «felice» non può coesistere con un mood `sad` dello stesso periodo. Le quattro soglie sono **parametri versionati** (`EraConfig.mood`): senza, un cambio delle soglie non renderebbe `stale` le ere (MIG-3) |
| **D.69.3** | La **distribuzione dei generi** è una quota di **ascolti**: ogni genere del brano pesa `1/n`, e la somma è normalizzata a 1 | La spec non dice se la quota è per ascolti o per minuti, e `04§5.5` impone `sum ≈ 1.0`. La quota per ascolti è l'unica che non dipende dalla durata dichiarata dagli adapter (spesso assente): una durata mancante non deve spostare la distribuzione |
| **D.69.4** | La **quota notturna** è calcolata in **UTC** (ore 0-5) | `EraPayload` (02§4) **non** trasporta un `userTimezone`, a differenza di `PatternPayload` (02§4): è il segnale che l'era non è legata al fuso. Il layer di analisi lavora su confini UTC (`analysis/datetime.ts`), e il mood tracker usa gli stessi confini |
| **D.69.5** | Una metrica **senza dato** (valence o energy assenti) è **esclusa** dalla distanza normalizzata, e i pesi sono rinormalizzati sulle dimensioni disponibili | Trattare una valence assente come 0 falserebbe la similarità: una finestra senza feature sembrerebbe «triste». Con i default (0.5 + 0.3 + 0.2 = 1) la rinormalizzazione è un'identità, quindi la formula coincide con quella di `04§5.2` |
| **D.69.6** | Il filtro `minEraDays` **lascia dei buchi**: un segmento scartato non viene fuso con il vicino | È il passo 4 dello pseudocodice (`eras.filter(...)`). Fondere i segmenti corti produrrebbe un'era che non corrisponde a nessun confine rilevato. L'invariante «∪ere = periodo totale» vale quindi **prima** del filtro: è la conseguenza dichiarata, non un difetto |
| **D.69.7** | La `confidence` dell'era è la **copertura delle feature** del periodo | `04§5` non definisce `computeEraConfidence`. La copertura è l'unico dato disponibile, ed è la stessa semantica della `confidence` del mood tracker (D.63.8): dice quanto del periodo l'era copre. Il payload `02§4` è chiuso e non ha un campo score |
| **D.69.8** | Il ricalcolo sostituisce **l'insieme** delle ere (`replaceAllInsightsOfType`), non solo quelle del periodo ricalcolato | La segmentazione dipende **dall'intera storia**: un ricalcolo può spostare i confini, e le ere vecchie avrebbero un `periodStart` diverso da quello delle nuove. Il ricalcolo per periodo (`replaceInsightsOfType`) le lascerebbe sopravvivere: due insiemi di ere incompatibili nello stesso DB |

## Discrepanza rilevata

L'AC del backlog dichiedeva «1 anno con **2 ere evidenti**
(`fixtures/scenarios/lockdown-2020.json`)». Il fixture `lockdown-2020` è una
cronologia **casuale**: generi e ritmi sorteggiati su 9 mesi, senza alcun
cambio netto. Il rilevamento produce quindi **una sola era** — che è il
comportamento giusto (il change point detection cerca un crollo della
similarità, e in una cronologia priva di salti non ce n'è).

La verifica dell'AC è stata quindi **spostata sul fixture giusto**: è stato
scritto `fixtures/scenarios/era-shift.json`, una cronologia **composta**
(8 settimane di *pop* diurno e 8 di *indie folk* notturno, con il cambio al
giorno 56), e l'AC è stata allineata. Il fixture `lockdown-2020` resta
verificato per le **invarianti** (`04§5.5`), che valgono su una cronologia
non composta.

La lezione è quella della Sessione 68: **un fixture generato casualmente
non può verificare un algoritmo che cerca un salto** — il salto deve essere
**dichiarato**.

## Fuori perimetro e dichiarato

- **Il pattern analyzer** (`04§4`): è un generatore a sé, non fa parte
  della 2.2. La `nightShare` è la sua metrica (`04§4.3`) e l'era detector la
  riusa con la propria definizione (UTC)
- **L'event detector** (`04§6`): Story 2.3
- **La session segmentation** (`04§2`): differita
- **La UI dell'era** (schermata ⑧): Story 3.x. La label dell'era è una
  stringa **resa** (D-A.4), con i template dichiarati in
  `08-COPY-I18N.md` §2.15

## Verifica

- `pnpm run lint` · `pnpm run typecheck` · `pnpm run test` (568 test in
  `@ls/core`, 112 in `@ls/web`) · `pnpm run build` → verdi
- `node scripts/check-readme-facts.mjs` → 15 check, 0 falliti
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0

## Lesson learned

| # | Osservazione |
|---|---|
| 69-1 | **Il blocco NEXT-STEP non è un claim**: senza un'issue `agent-ready` la story indicata non è lavorabile. Il puntatore del README e la lista di priorità del backlog indicano la 2.2 da due sessioni, e in due sessioni nessun agente ha potuto lavorarla perché **l'issue non esisteva**. L'apertura dell'issue è il primo atto dell'agente, non un adempimento |
| 69-2 | **Un fixture casuale non verifica un algoritmo che cerca un salto**: il `lockdown-2020` non ha un cambio di gusto, e il suo atteso («1-2 ere») era una congettura del 2026-10-16, scritta prima che l'algoritmo esistesse. La verifica è diventata possibile solo con un fixture **composto** (96 eventi, confine dichiarato) |
| 69-3 | **Il payload dichiara il fuso, o non lo dichiara**: `PatternPayload` ha `userTimezone`, `EraPayload` no. Due payload che condividono una metrica (`nightShare`) dicono cose diverse su come sia calcolata: la differenza è nel **contratto**, non nel testo |
| 69-4 | **Un ricalcolo che non copre l'insieme lascia dati orfani**: `replaceInsightsOfType` sostituisce i periodi ricalcolati, ma le ere dipendono dalla storia intera. Serve un'operazione dedicata (`replaceAllInsightsOfType`), e il nome dice già il perché |
| 69-5 | **La documentazione va scritta con l'encoding giusto**: una riga di changelog aggiunta con `Get-Content -Raw` + `Set-Content -Encoding UTF8` in PowerShell 5.1 ha **raddoppiato** la codifica del file (mojibake) e aggiunto un BOM. Il file è stato ripristinato con `git checkout --` e riscritto con l'editor: in un repository con documentazione UTF-8 e accenti, le scritture vanno fatte con gli strumenti che rispettano l'encoding |

## Documenti aggiornati

- `packages/core/src/analysis/era/` — **nuovo** (7 file)
- `packages/core/src/analysis/i18n.ts` — **nuovo** (contratto i18n condiviso)
- `packages/core/src/analysis/memory/{i18n,types}.ts` — il contratto i18n
  è riusato da `analysis/i18n.ts` (l'API pubblica del memory engine non
  cambia)
- `packages/core/src/analysis/pipeline.ts` — `createEraGenerator`
- `packages/core/src/analysis/index.ts` · `packages/core/src/index.ts` —
  gli export
- `packages/core/src/db/{insights,index}.ts` — `replaceAllInsightsOfType`
- `packages/core/src/analysis/__tests__/` — `era-engine`, `era-persistence`,
  `era-scenarios` + `helpers.ts` (`eraPayloadOf`, il fixture `era-shift`)
- `apps/web/src/i18n/locales/{it,en}.json` — le 8 chiavi `insight.era.*` e
  l'allineamento di `era.title`
- `fixtures/scenarios/era-shift.json` — **nuovo**
- `scripts/generate-fixtures.mjs` — il builder `buildEraShiftScenario()`
- `docs/04-ANALYSIS-ALGORITHMS.md` — v1.2 (`§8.1`)
- `docs/08-COPY-I18N.md` — v0.10 (`§2.4`, `§2.15`)
- `docs/10-TESTING.md` — §3.3 (i due fixture composti)
- `docs/11-BACKLOG.md` — Story 2.2, la roadmap, la priorità, il changelog
- `docs/state/stories/2.2-era-detector.md` — lo stato della story
- `docs/state/sessions/69-era-detector.md` — **nuovo** (questo file)
- `docs/state/_index.md` — la tabella di migration

## Cross-refs

- **#211** — l'issue di implementazione (claim `kilo-HP-ELITEBOOK-4f2k`)
- **#178** — la ratifica di `04-ANALYSIS-ALGORITHMS.md` (D-A.1…D-A.5)
- **#193** — l'emendamento D-A.6 (il mood-by-genre non esiste)
- **#180** — la Story 2.1 (mood tracker), da cui dipende la 2.2
- **#205** — la Story 1.6 (geo), l'ultima story completata prima di questa
