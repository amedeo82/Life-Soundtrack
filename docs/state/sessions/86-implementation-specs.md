---
number: 86
title: "Il pacchetto di specifiche implementabili delle 7 story rimanenti"
date: 2026-11-02
state: ðŸŸ¡
merged: false
branch: docs/implementation-specs
pr: 273
claim: kilo-HP-ELITEBOOK-c86sp
tags: [docs, strategy, specs]
---

# Sessione 86 â€” Le specifiche delle 7 story rimanenti

> **Oggetto**: la Sessione 85 ha prodotto il posizionamento competitivo e una prioritÃ  ricalcolata, ma le story
> rimanenti **non erano lavorabili**: il protocollo richiede una specifica ðŸŸ¢ APPROVED, e per 5 delle 7 story
> non esisteva. Questa sessione scrive **quel pacchetto di specifiche**, una per story, contro il codice reale.

## Sintesi

Sono state scritte **cinque specifiche** che coprono le sette story rimanenti:

| Spec | Story coperte | PrioritÃ  |
|------|---------------|----------|
| `docs/23-ANALYSIS-PIPELINE.md` | **2.5** â€” collegamento del pipeline di analisi all'app | ðŸ”´ P0 |
| `docs/24-ARTWORK-ENRICHMENT.md` | **4.3** â€” artwork enrichment | ðŸ”´ P0 |
| `docs/25-MEMORIES-SHARE-EXPLORE.md` | **3.2** â€” Ricordi + Share Â· **3.3** â€” Esplora + Analisi | ðŸ”´ P0 |
| `docs/26-ONBOARDING-DEMO.md` | **3.5** â€” anteprima/demo in onboarding | ðŸ”´ P0 (piccola) |
| `docs/27-PRIVACY-DATA-SETTINGS.md` | **5.1** â€” privacy spec + pagina in-app Â· **5.2** â€” export e purge | ðŸŸ¡ P1 |

Ogni specifica contiene: lo **stato reale** (verificato sul codice, con i path), i **contratti** da costruire
(firme TypeScript reali, nomi di file, indici Dexie, chiavi i18n), i **punti di innesto**, i **vincoli di
privacy**, il **piano di test** con i file, gli **acceptance criteria** verificabili, i **task** numerati e le
**decisioni proposte** (D-23.x â€¦ D-27.x) da ratificare.

## Cosa Ã¨ emerso scrivendo le specifiche (e non era emerso prima)

1. **Il `userNote` degli insight verrebbe perso al primo ricalcolo.** `replaceAllInsightsOfType` (la via
   obbligatoria per le ere, `db/insights.ts:146`) **cancella e reinserisce** le righe: un'era rinominata
   dall'utente perderebbe il nome. Il vincolo Ã¨ ora scritto in `23` Â§"Test" e `25` Â§"Test": la persistenza
   deve **leggere il `userNote` esistente** prima di sostituire.
2. **La card condivisa avrebbe un canvas taintato.** Le copertine remote non inviano CORS: senza
   `crossOrigin='anonymous'` + fallback al placeholder, `toBlob()` fallisce e la condivisione Ã¨ impossibile.
   Vincolo scritto in `25` Â§"renderer della card".
3. **La demo, senza feature, avrebbe mostrato il prodotto piÃ¹ povero.** Il fixture non ha `features`: i motori
   di analisi non produrrebbero nÃ© ere nÃ© mood. La spec `26` (D-26.2) estende il generatore con `albums` e
   `features` deterministiche (`source: 'manual'`, che l'analisi accetta).
4. **La licenza AGPL Â§13 non Ã¨ oggi soddisfatta nell'app reale.** La schermata About esiste ma Ã¨ **dead code**
   (importata solo dai test): l'obbligo di offerta del sorgente agli utenti che interagiscono via rete non Ã¨
   raggiungibile. Ãˆ parte della Story 5.1 (`27` Â§D).
5. **Tre delle quattro funzioni obbligatorie di `09Â§6.1` non esistono**: `exportAll`, `deleteAll`,
   `purgeInsights` (esiste solo `purgeIp`). E la schermata **Impostazioni non esiste**: `settings.data.export`,
   `settings.delete.*` sono copy mai renderizzato.
6. **Sette chiavi i18n dichiarate in `08-COPY-I18N.md` non sono nei locale** (`settings.privacy.retainCountry`,
   `.retainCountryDesc`, `.retainCity`, `.retainCityDesc`, `.retainDeviceType`, `.retainDeviceDetail`,
   `.deriveContext`): la pagina privacy non puÃ² essere completa senza di esse.
7. **Il ramo Spotify della cascata artwork Ã¨ codice morto**: il progetto non ha OAuth per Spotify e gli export
   non contengono copertine (D-24.2).
8. **Il branch Spotify era nell'originale della 4.3**: la cascata reale diventa iTunes â†’ Cover Art Archive â†’
   placeholder, con l'obbligo CSP di `coverartarchive.org` (che oggi non Ã¨ in `connect-src`).
9. **Un drift preesistente**: `apps/web/src/hooks/useDbHealth.ts:15` fissa `EXPECTED_SCHEMA_VERSION = 4`,
   mentre `db/health.ts:45` attende **6**.
10. **Il reveal dichiara un anno falso**: passa `{ years: 1 }` anche su uno storico di sei anni (`26` Â§3).

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-86.1 | Una **specifica per story-cluster** (5 documenti per 7 story), non una per story | Le story 3.2 e 3.3, 5.1 e 5.2 condividono schermate, contratti e vincoli: due documenti avrebbero duplicato il contratto di navigazione e di i18n |
| D-86.2 | Ogni specifica Ã¨ scritta **contro il codice reale**, con firme e path | Una specifica riportata dal backlog fa perdere alla sessione di coding il lavoro di re-interpretare: qui si dichiara **cosa esiste** e **cosa manca** |
| D-86.3 | Le decisioni delle specifiche sono **proposte numerate** (D-23.xâ€¦D-27.x), non assunte | Il protocollo: una decisione ðŸŸ¢ APPROVED Ã¨ vincolante, una DRAFT Ã¨ una proposta. Il project owner ratifica al merge |
| D-86.4 | Il backlog ora punta a una **spec** per ogni story rimanente (`**Spec**:` aggiornato) | Il protocollo richiede il link a una specifica approvata: senza, l'agente non puÃ² claimare |
| D-86.5 | Nessuna modifica al codice in questa sessione | L'obiettivo Ã¨ rendere le story **lavorabili**, non implementarle: implementare senza ratifica delle specifiche significa implementare contro un'interpretazione |
| D-86.6 | La spec `25` include il vincolo di **preservazione del `userNote`** al ricalcolo | Ãˆ un bug che sarebbe nato dalla 2.5 e scoperto solo dalla 3.2: scritto adesso, Ã¨ un test, non un difetto |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **70%** (21 story su 30, effort 72%), restano **9 step**.
Lavoro di **documentazione**: il catalogo non cresce, ma le 9 story rimanenti passano da Â«non lavorabiliÂ» a
Â«lavorabili dopo ratificaÂ».

**Cosa Ã¨ pronto.** Un pacchetto di 5 specifiche che copre tutte le story rimanenti, con: stato reale
verificato, contratti, task numerati, AC verificabili, piano di test e 30 decisioni proposte
(D-23.1â€¦D-27.6). Il backlog punta a ciascuna; `INDEX.md` e il bundle li includono.

**Cosa manca.** La **ratifica** delle specifiche e delle decisioni (D-23.xâ€¦D-27.x): Ã¨ l'atto del project
owner, e senza di esso le story restano `â¬š TODO` e le issue non possono avere la label `agent-ready`. Poi
l'apertura delle issue di implementazione, una per story, con il link alla spec ratificata.

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano; aggregatore e bundle
rigenerati in quest'ordine (aggregator â†’ generator).

**Gate di testabilitÃ .** `node scripts/check-readme-facts.mjs` â†’ 0 falliti Â·
`node scripts/check-protocol-consistency.mjs` â†’ 6 check, 0 falliti Â·
`node scripts/check-aggregate-blocks.mjs` â†’ 0 violazioni Â·
`pwsh scripts/aggregate-state.ps1 -Check` â†’ exit 0 Â· `pwsh scripts/generate-bundle.ps1 -Check` â†’ exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Una specifica Ã¨ Â«scrivere il futuroÂ», ma il futuro si scrive **contro il codice che c'Ã¨** | Ogni firma, ogni path e ogni chiave i18n delle 5 specifiche Ã¨ stato verificato sul repository: Ã¨ cosÃ¬ che sono emersi il `userNote` che il ricalcolo avrebbe perso, il canvas taintato, l'About irraggiungibile e le 7 chiavi mancanti |
| La specifica Ã¨ il vero deliverable del lavoro di analisi | Senza di essa, Â«l'ordine di prioritÃ Â» Ã¨ un'opinione; con essa, ogni sessione di coding ha un contratto da rispettare e un confine da non superare |
| I vincoli **piÃ¹ difficili** stanno nelle interfacce, non negli algoritmi | `replaceAllInsightsOfType` che cancella le righe, il canvas che si tainta, il CSP che blocca un host, `i18next` che ritorna `''` e fa lanciare i renderer: sono questi i punti in cui una story Â«facileÂ» si rompe |

## Documenti aggiornati

- `docs/23-ANALYSIS-PIPELINE.md`, `docs/24-ARTWORK-ENRICHMENT.md`, `docs/25-MEMORIES-SHARE-EXPLORE.md`,
  `docs/26-ONBOARDING-DEMO.md`, `docs/27-PRIVACY-DATA-SETTINGS.md` (nuovi, ðŸŸ¡ DRAFT v0.1)
- `docs/11-BACKLOG.md`: `**Spec**:` delle story 2.5, 3.2, 3.3, 3.5, 4.3, 5.1, 5.2; `**Stato**:` di 2.5 e 3.5
  (la spec esiste, in attesa di ratifica); changelog 1.6.34
- `docs/22-COMPETITIVE-POSITIONING.md`: D-22.8 (il pacchetto di specifiche), mappa aggiornata, v0.2
- `docs/INDEX.md`: righe `23`â€“`27`, conteggio dei documenti DRAFT
- `scripts/generate-bundle.ps1`: `$files` += i 5 documenti
- `docs/BUNDLE.md`: rigenerato

