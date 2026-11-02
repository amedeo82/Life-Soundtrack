---
number: 86
title: "Il pacchetto di specifiche implementabili delle 7 story rimanenti"
date: 2026-11-02
state: 🟡
merged: false
branch: docs/implementation-specs
pr: 0
claim: kilo-HP-ELITEBOOK-c86sp
tags: [docs, strategy, specs]
---

# Sessione 86 — Le specifiche delle 7 story rimanenti

> **Oggetto**: la Sessione 85 ha prodotto il posizionamento competitivo e una priorità ricalcolata, ma le story
> rimanenti **non erano lavorabili**: il protocollo richiede una specifica 🟢 APPROVED, e per 5 delle 7 story
> non esisteva. Questa sessione scrive **quel pacchetto di specifiche**, una per story, contro il codice reale.

## Sintesi

Sono state scritte **cinque specifiche** che coprono le sette story rimanenti:

| Spec | Story coperte | Priorità |
|------|---------------|----------|
| `docs/23-ANALYSIS-PIPELINE.md` | **2.5** — collegamento del pipeline di analisi all'app | 🔴 P0 |
| `docs/24-ARTWORK-ENRICHMENT.md` | **4.3** — artwork enrichment | 🔴 P0 |
| `docs/25-MEMORIES-SHARE-EXPLORE.md` | **3.2** — Ricordi + Share · **3.3** — Esplora + Analisi | 🔴 P0 |
| `docs/26-ONBOARDING-DEMO.md` | **3.5** — anteprima/demo in onboarding | 🔴 P0 (piccola) |
| `docs/27-PRIVACY-DATA-SETTINGS.md` | **5.1** — privacy spec + pagina in-app · **5.2** — export e purge | 🟡 P1 |

Ogni specifica contiene: lo **stato reale** (verificato sul codice, con i path), i **contratti** da costruire
(firme TypeScript reali, nomi di file, indici Dexie, chiavi i18n), i **punti di innesto**, i **vincoli di
privacy**, il **piano di test** con i file, gli **acceptance criteria** verificabili, i **task** numerati e le
**decisioni proposte** (D-23.x … D-27.x) da ratificare.

## Cosa è emerso scrivendo le specifiche (e non era emerso prima)

1. **Il `userNote` degli insight verrebbe perso al primo ricalcolo.** `replaceAllInsightsOfType` (la via
   obbligatoria per le ere, `db/insights.ts:146`) **cancella e reinserisce** le righe: un'era rinominata
   dall'utente perderebbe il nome. Il vincolo è ora scritto in `23` §"Test" e `25` §"Test": la persistenza
   deve **leggere il `userNote` esistente** prima di sostituire.
2. **La card condivisa avrebbe un canvas taintato.** Le copertine remote non inviano CORS: senza
   `crossOrigin='anonymous'` + fallback al placeholder, `toBlob()` fallisce e la condivisione è impossibile.
   Vincolo scritto in `25` §"renderer della card".
3. **La demo, senza feature, avrebbe mostrato il prodotto più povero.** Il fixture non ha `features`: i motori
   di analisi non produrrebbero né ere né mood. La spec `26` (D-26.2) estende il generatore con `albums` e
   `features` deterministiche (`source: 'manual'`, che l'analisi accetta).
4. **La licenza AGPL §13 non è oggi soddisfatta nell'app reale.** La schermata About esiste ma è **dead code**
   (importata solo dai test): l'obbligo di offerta del sorgente agli utenti che interagiscono via rete non è
   raggiungibile. È parte della Story 5.1 (`27` §D).
5. **Tre delle quattro funzioni obbligatorie di `09§6.1` non esistono**: `exportAll`, `deleteAll`,
   `purgeInsights` (esiste solo `purgeIp`). E la schermata **Impostazioni non esiste**: `settings.data.export`,
   `settings.delete.*` sono copy mai renderizzato.
6. **Sette chiavi i18n dichiarate in `08-COPY-I18N.md` non sono nei locale** (`settings.privacy.retainCountry`,
   `.retainCountryDesc`, `.retainCity`, `.retainCityDesc`, `.retainDeviceType`, `.retainDeviceDetail`,
   `.deriveContext`): la pagina privacy non può essere completa senza di esse.
7. **Il ramo Spotify della cascata artwork è codice morto**: il progetto non ha OAuth per Spotify e gli export
   non contengono copertine (D-24.2).
8. **Il branch Spotify era nell'originale della 4.3**: la cascata reale diventa iTunes → Cover Art Archive →
   placeholder, con l'obbligo CSP di `coverartarchive.org` (che oggi non è in `connect-src`).
9. **Un drift preesistente**: `apps/web/src/hooks/useDbHealth.ts:15` fissa `EXPECTED_SCHEMA_VERSION = 4`,
   mentre `db/health.ts:45` attende **6**.
10. **Il reveal dichiara un anno falso**: passa `{ years: 1 }` anche su uno storico di sei anni (`26` §3).

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-86.1 | Una **specifica per story-cluster** (5 documenti per 7 story), non una per story | Le story 3.2 e 3.3, 5.1 e 5.2 condividono schermate, contratti e vincoli: due documenti avrebbero duplicato il contratto di navigazione e di i18n |
| D-86.2 | Ogni specifica è scritta **contro il codice reale**, con firme e path | Una specifica riportata dal backlog fa perdere alla sessione di coding il lavoro di re-interpretare: qui si dichiara **cosa esiste** e **cosa manca** |
| D-86.3 | Le decisioni delle specifiche sono **proposte numerate** (D-23.x…D-27.x), non assunte | Il protocollo: una decisione 🟢 APPROVED è vincolante, una DRAFT è una proposta. Il project owner ratifica al merge |
| D-86.4 | Il backlog ora punta a una **spec** per ogni story rimanente (`**Spec**:` aggiornato) | Il protocollo richiede il link a una specifica approvata: senza, l'agente non può claimare |
| D-86.5 | Nessuna modifica al codice in questa sessione | L'obiettivo è rendere le story **lavorabili**, non implementarle: implementare senza ratifica delle specifiche significa implementare contro un'interpretazione |
| D-86.6 | La spec `25` include il vincolo di **preservazione del `userNote`** al ricalcolo | È un bug che sarebbe nato dalla 2.5 e scoperto solo dalla 3.2: scritto adesso, è un test, non un difetto |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **70%** (21 story su 30, effort 72%), restano **9 step**.
Lavoro di **documentazione**: il catalogo non cresce, ma le 9 story rimanenti passano da «non lavorabili» a
«lavorabili dopo ratifica».

**Cosa è pronto.** Un pacchetto di 5 specifiche che copre tutte le story rimanenti, con: stato reale
verificato, contratti, task numerati, AC verificabili, piano di test e 30 decisioni proposte
(D-23.1…D-27.6). Il backlog punta a ciascuna; `INDEX.md` e il bundle li includono.

**Cosa manca.** La **ratifica** delle specifiche e delle decisioni (D-23.x…D-27.x): è l'atto del project
owner, e senza di esso le story restano `⬚ TODO` e le issue non possono avere la label `agent-ready`. Poi
l'apertura delle issue di implementazione, una per story, con il link alla spec ratificata.

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano; aggregatore e bundle
rigenerati in quest'ordine (aggregator → generator).

**Gate di testabilità.** `node scripts/check-readme-facts.mjs` → 0 falliti ·
`node scripts/check-protocol-consistency.mjs` → 6 check, 0 falliti ·
`node scripts/check-aggregate-blocks.mjs` → 0 violazioni ·
`pwsh scripts/aggregate-state.ps1 -Check` → exit 0 · `pwsh scripts/generate-bundle.ps1 -Check` → exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Una specifica è «scrivere il futuro», ma il futuro si scrive **contro il codice che c'è** | Ogni firma, ogni path e ogni chiave i18n delle 5 specifiche è stato verificato sul repository: è così che sono emersi il `userNote` che il ricalcolo avrebbe perso, il canvas taintato, l'About irraggiungibile e le 7 chiavi mancanti |
| La specifica è il vero deliverable del lavoro di analisi | Senza di essa, «l'ordine di priorità» è un'opinione; con essa, ogni sessione di coding ha un contratto da rispettare e un confine da non superare |
| I vincoli **più difficili** stanno nelle interfacce, non negli algoritmi | `replaceAllInsightsOfType` che cancella le righe, il canvas che si tainta, il CSP che blocca un host, `i18next` che ritorna `''` e fa lanciare i renderer: sono questi i punti in cui una story «facile» si rompe |

## Documenti aggiornati

- `docs/23-ANALYSIS-PIPELINE.md`, `docs/24-ARTWORK-ENRICHMENT.md`, `docs/25-MEMORIES-SHARE-EXPLORE.md`,
  `docs/26-ONBOARDING-DEMO.md`, `docs/27-PRIVACY-DATA-SETTINGS.md` (nuovi, 🟡 DRAFT v0.1)
- `docs/11-BACKLOG.md`: `**Spec**:` delle story 2.5, 3.2, 3.3, 3.5, 4.3, 5.1, 5.2; `**Stato**:` di 2.5 e 3.5
  (la spec esiste, in attesa di ratifica); changelog 1.6.34
- `docs/22-COMPETITIVE-POSITIONING.md`: D-22.8 (il pacchetto di specifiche), mappa aggiornata, v0.2
- `docs/INDEX.md`: righe `23`–`27`, conteggio dei documenti DRAFT
- `scripts/generate-bundle.ps1`: `$files` += i 5 documenti
- `docs/BUNDLE.md`: rigenerato
