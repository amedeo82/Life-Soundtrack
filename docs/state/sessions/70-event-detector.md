---
number: 70
title: "Story 2.3 — Event Detector (issue #214)"
date: 2026-10-31
state: 🟢
merged: true
branch: feat/214-event-detector
pr: 215
merged_commit: 5149b2c
merged_date: 2026-10-31
claim: kilo-HP-ELITEBOOK-7d3f
cross_refs: [214, 211, 180, 188, 178]
tags: [analysis, phase-2]
---

# Sessione 70 — Story 2.3: Event Detector (issue #214)

## Sintesi

La Story 2.3 implementa il **rilevatore di eventi**: le anomalie
significative della storia di ascolto — un picco di volume, un crollo
emotivo, un'esplosione di novità, un silenzio — diventano **insight**
narrativi con la loro confidenza, secondo l'algoritmo di
`docs/04-ANALYSIS-ALGORITHMS.md` **v1.3 🟢 APPROVED** (§6, ratificata nella
Sessione 59, issue #178).

L'implementazione copre **tutti gli otto tipi** di `02§4`, ciascuno con un
produttore dichiarato: il detector a **z-score** (§6.3) produce
`volume_spike`, `volume_drop`, `valence_rise`, `valence_drop` ed
`exploration`; il detector a **quota** (§6.2) produce `spike_artist` e
`spike_genre`; i detector **specialistici** (§6.4) producono `silence` ed
`exploration`.

Il pacchetto consegnato:

- **il motore** (`packages/core/src/analysis/event/`): `metrics.ts`,
  `detect.ts`, `engine.ts`, `derivedVersion.ts`, `i18n.ts`, `types.ts`;
- **la persistenza**: gli insight di tipo `event` con `derivedVersion` e il
  ricalcolo che sostituisce **l'insieme** degli eventi
  (`replaceAllInsightsOfType`);
- **il plug-in** `createEventGenerator` dell'orchestratore (`04§8.1`, D-A.5:
  il contratto non cambia);
- **il fixture di scenario** `fixtures/scenarios/listening-spike.json`;
- **43 test** nuovi in `@ls/core`.

## Trigger

Il blocco NEXT-STEP del README indicava la **2.3** come prima story
lavorabile (è la prima non-done fra quelle migrate in `docs/state/stories/`),
ma **non esisteva alcuna issue `agent-ready`**: il repository non aveva
nessuna issue aperta, e la story non era claimabile. L'agente ha quindi
aperto la **issue #214** (`size:L`, `agent-ready`, `area:analysis`,
`phase-2`) con gli AC ricavati dalla spec ratificata, poi ha eseguito la
procedura di claim (ADR-0006): label `in-progress` + commento `claim:
kilo-HP-ELITEBOOK-7d3f`, riverificato come **unico** claim attivo.

Worktree `ls-214-event-detector`, branch `feat/214-event-detector` (creata
con `scripts/setup-worktree.ps1 214`, push early D.20.2).

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| Il **motore** dell'event detector | `packages/core/src/analysis/event/` |
| Il plug-in dell'orchestratore | `createEventGenerator` in `analysis/pipeline.ts` |
| Il ricalcolo dell'**insieme** degli eventi | `replaceAllInsightsOfType` in `db/insights.ts` |
| I **template** della descrizione | `insight.event.*` in `apps/web/src/i18n/locales/{it,en}.json` |
| Il **fixture di scenario** | `fixtures/scenarios/listening-spike.json` (`scripts/generate-fixtures.mjs spike`) |
| I **43 test** | `analysis/__tests__/event-{engine,persistence,scenarios}.test.ts` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| **D.70.1** | La **baseline** e la **finestra** non si sovrappongono: la finestra è `[cursor, cursor + windowDays)` e la baseline i `baselineDays` giorni immediatamente precedenti. Una baseline con meno di `minBaselineDays` giorni **con dati** non è utilizzabile | Il pseudocodice di `04§6.3` scrive `dailyMetrics[cursor - baselineDays .. cursor]` e `dailyMetrics[cursor .. cursor + windowDays]`: le due finestre si sovrappongono al giorno `cursor`, e la baseline avrebbe 61 giorni invece di 60. Con una baseline di **due** giorni la deviazione standard è rumore, e lo z-score diventa arbitrario: `minBaselineDays` (14, metà della baseline) è la condizione che rende lo z-score calcolabile. Il parametro è **versionato** (`EventConfig.minBaselineDays`): senza, un suo cambio non renderebbe `stale` gli eventi (MIG-3) |
| **D.70.2** | Il detector a **quota** ha due condizioni: la **dominanza** (la quota del soggetto nella finestra supera `minDominantShare`) e il **picco** (la quota supera `EVENT_QUOTA_RATIO` volte la quota in baseline) | `04§6.2` dichiara il trigger («quota artista > 2× baseline») ma non dice cosa distingue un picco da una variazione ordinaria: la sola colonna «Trigger» rende *qualsiasi* variazione un picco. La **descrizione** della stessa tabella («ha dominato il tuo ascolto») porta la condizione mancante: il soggetto deve **dominare** la finestra. Il soggetto è **il primo per quota** della finestra (un solo artista o genere per finestra), con il pareggio risolto in modo deterministico (id dell'artista, ordine alfabetico del genere) |
| **D.70.3** | La finestra deve essere **completa**: l'ultima finestra utile è quella che finisce entro l'ultimo giorno osservato (`cursor + windowDays <= lastDay + 1`) | Il pseudocodice dice `while cursor <= latestDay`: l'ultima finestra sarebbe **troncata**, con meno giorni della baseline. La sua media sarebbe più bassa per costruzione, e il detector produrrebbe un `volume_drop` **sistematico** su ogni storia — un falso positivo garantito, non un evento |
| **D.70.4** | La deviazione standard è **popolazionale** (÷N) | `04§6.3` scrive `stats(baseline[metric])` senza dire quale. La baseline è l'intera **popolazione** dei giorni osservati, non un campione: con N ≥ 14 la differenza è marginale, ma la formula deve essere una sola e dichiarata |
| **D.70.5** | Un giorno **senza ascolti** non è un giorno a volume zero: è un giorno **assente** dalla mappa delle metriche. Vale per il volume **e** per la valence: un giorno senza feature è assente, non a valence 0 | Il volume misura «quanto hai ascolto **nei giorni in cui hai ascoltato**». Conteggiare i buchi come zero farebbe crollare la media della baseline di un ascoltatore abituale ma saltellante, e il detector lo dichiarerebbe un `volume_drop` senza che nulla sia cambiato. Per la valence la regola è la stessa di D.69.5: trattare un dato assente come zero falserebbe lo z-score verso il basso — un periodo senza feature sembrerebbe «triste» |
| **D.70.6** | Il rapporto del detector a quota è definito rispetto alla **soglia di dominanza** quando il soggetto è assente in baseline (`windowShare / minDominantShare`), altrimenti rispetto alla quota in baseline (`windowShare / baselineShare`) | Un artista nuovo ha quota baseline **0**: il rapporto sarebbe infinito, e `Infinity` non è un numero serializzabile in JSON (`JSON.stringify(Infinity)` → `null`) né un valore finito nel payload persistito. La formula scelta mantiene il rapporto finito **e** confrontabile: il trigger resta il rapporto 2× (D.70.2) |
| **D.70.7** | La finestra dell'**esplorazione** è lunga `strideDays` giorni (7 per default, come i «7gg» di `04§6.2`) ed è allineata alla **stessa griglia** degli altri detector; il detector parte dalla stessa soglia (`earliestDay + baselineDays`) | `04§6.4` dice «7-day windows» ma `04§6.5` non ha un parametro per la lunghezza della finestra dell'esplorazione, e `04§9` non lo elenca nel config object. Usare `strideDays` — che è già un parametro versionato e vale 7 per default — evita di aggiungere un nono parametro e tiene i due detector sulla stessa griglia settimanale. La soglia di partenza è la stessa degli altri detector perché i **primi giorni** della storia hanno per definizione tutti gli artisti «nuovi»: contarli produrrebbe un evento di esplorazione all'inizio di **ogni** storia |
| **D.70.8** | Il **dedupe** è per **tipo e per soggetto**: due eventi dello stesso tipo (e dello stesso artista o genere) che si sovrappongono sono lo stesso evento visto da due finestre diverse; si tiene quello con la confidenza più alta. Due eventi di **tipi diversi** sulla stessa finestra coesistono | La griglia avanza di `strideDays` (7) giorni e la finestra è lunga `windowDays` (14): le finestre consecutive **si sovrappongono**, e un picco persistente viene visto da più finestre. Il deduve di `04§6.3` esiste per questo. Se il dedupe fosse globale per sovrapposizione, un `volume_spike` e un `valence_drop` sulla stessa finestra — due letture diverse della stessa settimana — non potrebbero coesistere, e il loop sui tre metriche di `04§6.3` avrebbe un solo esito per finestra |

## Discrepanza rilevata

L'AC del backlog chiedeva «**Falsi positivi < 10%** su fixture di test». Un
criterio così richiede una **misura**, non un'asserzione: il fixture
`listening-spike` dichiara **quattro** tipi di evento attesi nella baseline
(`volume_spike` e `valence_drop` per il picco, `silence` per i 3 giorni
senza ascolti, `exploration` per gli artisti nuovi) e **nessuno** nella
baseline. La verifica è quindi esatta e verificabile: **zero** eventi
indebiti sulle finestre della baseline, e i tipi attesi tutti presenti.

Il secondo AC («Z-score o IQR con finestra documentata») è soddisfatto dal
**z-score**: la finestra è di 14 giorni, la baseline di 60, e il passo di 7
(`04§6.5`).

Il terzo AC («Rileva spike/crolli volume, valence drop/rise, exploration,
silence») è coperto dai **otto** tipi dell'enum di `02§4`: i sei citati
esplicitamente più `spike_artist` e `spike_genre`, che `04§6.2` dichiara e
che sono coperti dal detector a quota.

## Fuori perimetro e dichiarato

- **La session segmentation** (`04§2`): differita — serve a
  `ListeningSession`
- **Il pattern analyzer** (`04§4`): differita — è un generatore a sé
- **La UI degli eventi** (schermata ⑧): Story 3.x. La descrizione è una
  stringa **resa** (D-A.4), con i template dichiarati in
  `08-COPY-I18N.md` §2.15
- **Il collegamento evento → contesto** (geolocalizzazione, `19-GEO-CONTEXT.md`):
  Story 3.4 / 4.4

## Verifica

- `pnpm run lint` · `pnpm run typecheck` · `pnpm run test` (611 test in
  `@ls/core`, 112 in `@ls/web`) · `pnpm run build` → verdi
- `node scripts/check-readme-facts.mjs` → 15 check, 0 falliti
- `pwsh scripts/generate-bundle.ps1 --check` · `pwsh scripts/aggregate-state.ps1 --check` → exit 0

## Esito post-merge

La PR **#215** è **merged** in `main` il 2026-10-31T11:18:48Z (merge commit
`5149b2c`), CI verde (job `quality`: lint, typecheck, test, build e i gate su
bundle, aggregator, workflow e README; GitGuardian). L'issue **#214** è chiusa
con `status:done` (applicato da `auto-status-done`, che ha pubblicato anche il
commento `release: kilo-HP-ELITEBOOK-7d3f - PR #215 merged (5149b2c…)`).

Il blocco NEXT-STEP del README ricade ora sulla **3.4** (nastro contesto) —
che dichiara `[DEP:4.4]`: la tranche geo si fa prima nella **4.4** (il DB
IP→città), e la 3.4 la consuma. Il blocco aggregato **non conosce le
dipendenze** fra story (lesson 70-6), e la prosa del README lo dichiara
esplicitamente.

## Lesson learned

| # | Osservazione |
|---|---|
| 70-1 | **Il blocco NEXT-STEP non è un claim**: senza un'issue `agent-ready` la story indicata non è lavorabile. Come nella Sessione 69, l'apertura dell'issue è il primo atto dell'agente, non un adempimento |
| 70-2 | **Una colonna di trigger senza la descrizione è una specifica a metà**: `04§6.2` dichiara «quota artista > 2× baseline» e, nella colonna accanto, «ha dominato il tuo ascolto». La prima riga, da sola, rende ogni variazione un picco: è la seconda a dire cosa distingue un picco. Quando due colonne della stessa tabella si contraddicono, la **descrizione** (il cosa) prevale sul **trigger** (il come) — ed è la differenza a dichiarare, non da nascondere |
| 70-3 | **Una finestra troncata è un falso positivo garantito**: l'ultima finestra di una griglia ha meno giorni della baseline, e la sua media è più bassa per costruzione. Il detector l'avrebbe letta come un `volume_drop` su **ogni** storia. La completezza della finestra è una condizione di esistenza, non un dettaglio |
| 70-4 | **Un assente non è uno zero**: la regola che rende il volume confrontabile è che un giorno senza ascolti non esista nella mappa delle metriche. La stessa regola, applicata alla valence, evita che un periodo senza feature sembri «triste» (D.69.5): due detector, la stessa lezione |
| 70-5 | **L'infinito non è un numero**: il rapporto di un artista nuovo (quota baseline 0) è infinito, e `Infinity` non sopravvive alla serializzazione JSON. Il payload persistito deve avere solo numeri finiti: il rapporto è stato definito rispetto alla soglia di dominanza |
| 70-6 | **Il blocco NEXT-STEP non conosce le dipendenze**: dopo la 2.3 l'aggregatore indica la **3.4** (nastro contesto), che dichiara `[DEP:4.4]` — e la 4.4 non è fatta. L'aggregatore filtra `done`/`blocked`/`wontdo`, non `depends_on` | Il contratto dell'agregatore (ADR-0008 V3) è «la prima story **non-done e non bloccata**»: la dipendenza fra story è un fatto che vive solo nel `depends_on` del suo file di stato | La dipendenza è stata resa **esplicita nella prosa del README** (che è dell'agente, non dell'agregatore): prima di claimare la story indicata, leggere il suo `depends_on`. Il caso è dichiarato qui perché **cambiare l'aggregatore** è una modifica di policy (ADR-0008) e va trattata come issue a sé, non dentro una story di analisi |

## Documenti aggiornati

- `packages/core/src/analysis/event/` — **nuovo** (6 file)
- `packages/core/src/analysis/pipeline.ts` — `createEventGenerator`
- `packages/core/src/analysis/index.ts` — gli export
- `packages/core/src/analysis/__tests__/` — `event-engine`, `event-persistence`,
  `event-scenarios` + `helpers.ts` (`eventPayloadOf`,
  `syntheticFeaturesByArtist`, il fixture `listening-spike`)
- `apps/web/src/i18n/locales/{it,en}.json` — la chiave
  `insight.event.spike_genre`
- `fixtures/scenarios/listening-spike.json` — **nuovo**
- `scripts/generate-fixtures.mjs` — il builder
  `buildListeningSpikeScenario()`
- `docs/04-ANALYSIS-ALGORITHMS.md` — v1.3 (`§6.8` nuova, `§8.1`, `§9`)
- `docs/08-COPY-I18N.md` — v0.11 (`§2.15`)
- `docs/10-TESTING.md` — v1.2 (§3.3)
- `docs/11-BACKLOG.md` — Story 2.3, la roadmap, la priorità, il changelog
- `docs/state/stories/2.3-event-detector.md` — lo stato della story
- `docs/state/sessions/70-event-detector.md` — **nuovo** (questo file)
- `docs/state/_index.md` — la tabella di migration

## Cross-refs

- **#214** — l'issue di implementazione (claim `kilo-HP-ELITEBOOK-7d3f`)
- **#178** — la ratifica di `04-ANALYSIS-ALGORITHMS.md` (D-A.1…D-A.5)
- **#193** — l'emendamento D-A.6 (il mood-by-genre non esiste)
- **#180** — la Story 2.1 (mood tracker), da cui dipende la 2.3
- **#188** — la Story 4.1 (audio features): le valence/energy misurate che il
  detector della valence consuma
- **#211** — la Story 2.2 (era detector), l'ultima story completata prima di
  questa
