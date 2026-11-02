---
number: 85
title: "Posizionamento competitivo verificato sul codice e prioritÃ  ricalcolate"
date: 2026-11-02
state: ðŸŸ¡
merged: false
branch: docs/competitive-positioning
pr: 273
claim: kilo-HP-ELITEBOOK-c85pos
tags: [docs, strategy, backlog]
---

# Sessione 85 â€” Posizionamento competitivo e prioritÃ  ricalcolate

> **Oggetto**: un'analisi competitiva (del 2026-11-02) sul posizionamento di Life Soundtrack
> rispetto a Last.fm/VinVibe, Remi/Music Memory e Spotify Wrapped, con una gerarchia di prioritÃ 
> e cinque suggerimenti strategici. L'analisi Ã¨ stata **verificata riga per riga contro il codice**
> del repository e i risultati sono stati riflessi nella documentazione.

## Sintesi

L'analisi individua **quattro differenziatori strutturali** (privacy-first locale, multi-piattaforma
unificata, retrospettiva storica, analisi acustica locale) e propone un ordine di prioritÃ :
artwork prima di MusicBrainz, Ricordi+Share ed Esplora+Analisi al primo posto, export e purge a
prioritÃ  media, MusicBrainz e nuove piattaforme a bassa prioritÃ .

La verifica sul codice **conferma due differenziatori, ne smentisce due nella forma dichiarata e
ne scopre un terzo, piÃ¹ grave**:

| Differenziatore | Verdetto |
|-----------------|----------|
| Privacy-first locale | ðŸŸ¢ reale, con la precisazione che l'unica uscita di rete Ã¨ l'invio ai hub di scrobbling, **solo** se l'utente lo attiva hub per hub |
| Multi-piattaforma unificata | ðŸŸ¢ reale: 5 fonti importabili (Spotify, YouTube Music, Apple Music, ListenBrainz, Last.fm), tutte con adapter e factory |
| Retrospettiva storica | ðŸŸ¡ **non ancora un prodotto**: i quattro motori di analisi sono scritti e testati in `packages/core/src/analysis/`, ma **nessun codice in `apps/web` li esegue** â€” la Home legge gli insight che nessuno scrive |
| Analisi acustica locale | ðŸŸ¡ **non ancora un prodotto**: la porta Essentia e la cascata esistono in `packages/core/src/enrichment/`, ma `essentia` **non Ã¨ una dipendenza** (assente da ogni `package.json` e dal lockfile), il modulo WASM non viene mai caricato e il pacchetto non Ã¨ importato dall'app |

L'osservazione sull'export, il purge e la pagina privacy Ã¨ confermata: esistono stringhe i18n e
funzioni di base (`purgeIp()`, `purgeScrobbleQueue()`), ma nessun flusso completo (il pannello
`MaintenancePanel.tsx` non Ã¨ montato e i pulsanti sono placeholder).

Ãˆ emerso inoltre che l'**onboarding non mostra il risultato**: la schermata di reveal mostra un
contatore di eventi, mentre il README dichiarava un'Â«anteprima del risultatoÂ»; il dataset demo
(`fixtures/demo-user.json`) e la CTA Â«Scopri come funzionaÂ» esistono ma **non sono usati da nessun
file di codice**.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-85.1 | Nasce `docs/22-COMPETITIVE-POSITIONING.md` (ðŸŸ¡ DRAFT v0.1) come sede unica di posizionamento, "cosa non siamo" e prioritÃ  | Non esisteva un documento che rispondesse a Â«perchÃ© non Last.fmÂ» e Â«quale vantaggio Ã¨ veroÂ»: il posizionamento era sparso tra VISION e backlog, e la prioritÃ  era implicita |
| D-85.2 | Il backlog cresce di **due story**: **2.5** (collegamento del pipeline di analisi all'app) e **3.5** (anteprima/demo in onboarding) | Sono i due lavori che rendono visibili i differenziatori 3 e 4 e l'onboarding che deve mostrare la magia. Il catalogo passa da 28 a 30 story |
| D-85.3 | L'ordine di lavorazione diventa **2.5 â†’ 4.3 â†’ 3.2 â†’ 3.3 â†’ 3.5 â†’ 5.2 â†’ 5.1 â†’ 4.2 â†’ 6.1** | L'ordine dell'analisi esterna Ã¨ corretto sul **valore**, non sull'ordine delle issue. Due correzioni: l'artwork non dipende dal lookup MusicBrainz e l'anteprima Ã¨ un lavoro piccolo ad alto rendimento |
| D-85.4 | La **Story 4.3** perde il vincolo `[DEP:4.2]` e sale a **P0** | La cascata dell'artwork funziona senza MBID (Spotify Web API â†’ iTunes Search â†’ placeholder gradient); il lookup MusicBrainz migliora il catalogo ma non l'esperienza |
| D-85.5 | La **Story 3.2** incorpora l'export **statico** del capitolo e il **tagging manuale**; la **3.3** richiede **insight in prosa**; la **5.1** richiede la **pagina in-app Â«Come trattiamo i tuoi datiÂ»** | La condivisione non puÃ² esporre il database: si esporta un capitolo. Il tagging manuale Ã¨ il ponte fra analisi automatica e autobiografia. L'Â«aha momentÂ» Ã¨ la frase, non il grafico. La privacy va tradotta in linguaggio utente |
| D-85.6 | Il **README** viene riallineato al codice: tolte le due dichiarazioni non supportate (Â«anteprima del risultatoÂ», Â«strumenti di purgaÂ»), precisata la portata della privacy locale, aggiunta la sezione **Â«Cosa non siamoÂ»** e riscritta la roadmap | Il gate `check-readme-facts.mjs` confronta la prosa con il codice: Ã¨ drift esattamente il genere di drift che il gate Ã¨ nato per chiudere (issue #161) |
| D-85.7 | `00-VISION.md` passa a v0.3: **licenza allineata ad AGPL-3.0** (la riga dichiarava ancora Apache-2.0, D.A.10 superata da D-AF.2 il 2026-10-30), "cosa NON Ã¨" esteso, stato reale dei cinque punti di differenziazione | Drift dichiarativo sul file che dichiara la **decisione strategica** piÃ¹ vincolante del progetto |
| D-85.8 | L'AGPL-3.0 **non viene modificato** | La domanda Â«va bene AGPL?Â» Ã¨ giÃ  chiusa: D-AF.2 (ratifica 2026-10-30, issue #201), modello open-source puro senza monetizzazione (D.A.9), obbligo Â§13 implementato (issue #202). Il limite sui fork commerciali Ã¨ accettato di proposito |

## Analisi di avanzamento

**Numeri.** L'implementazione **scende al 70%**: **21 story su 30**, effort pesato **72%**, restano
**9 step**. La percentuale scende perchÃ© il catalogo Ã¨ cresciuto di **due story oneste** (2.5 e 3.5)
che il backlog precedente non sapeva di avere: il denominator non era falsato, era **incompleto**.
Lavoro di **documentazione e strategia**.

**Cosa Ã¨ pronto.** La verifica competitiva Ã¨ completa e riproducibile: i quattro differenziatori
hanno ciascuno un esito documentato con l'evidenza nel codice (`packages/core/src/analysis/`,
`packages/core/src/enrichment/`, `packages/core/src/adapters/pipeline.ts`,
`apps/web/src/onboarding/OnboardingRouter.tsx`). Il posizionamento Ã¨ in un documento solo
(`22-COMPETITIVE-POSITIONING.md`), il backlog ne riflette le conseguenze (2.5, 3.5, 4.3 P0,
ordine di lavorazione), il README dice Â«cosa non siamoÂ» e non promette piÃ¹ ciÃ² che il codice non fa.

**Cosa manca.** Due cose, in ordine: (a) la **ratifica** delle sette decisioni proposte
(D-22.1â€¦D-22.7) â€” il documento Ã¨ DRAFT e le story nuove non sono `agent-ready` senza spec
approvata; (b) l'apertura delle **issue** di implementazione per 2.5 e 3.5, che senza la
specifica di collegamento del pipeline di analisi non possono essere lavorate.

**Gate di testabilitÃ .** Il gate Â«motore di analisi completoÂ» passa da **4/4 a 4/5**: l'EPIC 2 ha
i suoi quattro motori, ma non il **collegamento all'app** (2.5) â€” Ã¨ la prima volta che il gate
dice la veritÃ  su quel Â«completoÂ». Il gate Â«test end-to-endÂ» resta 2/5 (EPIC 3: mancano 3.2, 3.3,
3.5).

**Salute tecnica.** `pwsh` 7.6.9. Nessun blocco `AGGREGATE-*` modificato a mano; aggregatore e
bundle rigenerati in quest'ordine (aggregator â†’ generator), come impone la procedura
`AGENTS.md` Â§"L'ordine dei due generatori Ã¨ vincolante".

**Gate di testabilitÃ .** `node scripts/check-readme-facts.mjs` â†’ 0 falliti Â·
`node scripts/check-protocol-consistency.mjs` â†’ 6 check, 0 falliti Â·
`node scripts/check-aggregate-blocks.mjs` â†’ 0 violazioni Â·
`pwsh scripts/aggregate-state.ps1 -Check` â†’ exit 0 Â·
`pwsh scripts/generate-bundle.ps1 -Check` â†’ exit 0.

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un'analisi competitiva esterna Ã¨ un'ipotesi, non uno stato: verificarla **riga per riga contro il codice** ne ha spostato due sui quattro differenziatori | Il rischio non era la qualitÃ  dell'analisi, era la sua **granularitÃ **: Â«analisi acustica localeÂ» Ã¨ vero a livello di port (`enrichment/essentia.ts`) e falso a livello di prodotto (nessuna dipendenza, nessun caricamento). La verifica ha separato i due piani |
| Il drift piÃ¹ grave era **fra i moduli e l'app**, non fra i documenti | Quattro motori di analisi, una pipeline audio, 15 tabelle Dexie e una pipeline di import: tutto scritto e testato, e l'utente non vede niente. Il backlog dichiarava Â«EPIC 2 completoÂ» perchÃ© misura le **story**, non i **percorsi dati**: un EPIC puÃ² essere 4/4 e non produrre un solo insight |
| Un gate sulla prosa del README non copre i gate sulla **prosa degli altri documenti** | Il README dichiarava un'anteprima e una purga inesistenti: il gate `check-readme-facts.mjs` li ha lasciati passare perchÃ© la sua lista di capability copre i nomi delle feature (valence, BPM, mood), non le frasi descrittive. Il gate Ã¨ una rete, non un muro: i documenti nuovi devono portare con sÃ© la verifica |
| Il Â«non ancoraÂ» Ã¨ una promessa di **roadmap**, non una feature assente | L'analisi esterna trattava Â«analisi acustica localeÂ» e Â«ricordi + shareÂ» come la stessa cosa: la prima Ã¨ una capability pronta in core e non collegata, la seconda non esiste. Il backlog le distingueva giÃ ; il rischio era scrivere nel README una versione che le confonde |

## Documenti aggiornati

- `docs/22-COMPETITIVE-POSITIONING.md` (nuovo, ðŸŸ¡ DRAFT v0.1): posizionamento, matrice dei competitor
  con stato verificato, "cosa non siamo", prioritÃ  ricalcolate, D-22.1â€¦D-22.7
- `docs/00-VISION.md`: v0.3 â€” licenza AGPL-3.0, "cosa NON Ã¨" esteso, stato reale dei differenziatori
- `docs/11-BACKLOG.md`: v1.6.34 â€” Story **2.5** e **3.5** nuove, **4.3** P0 e senza `[DEP:4.2]`,
  AC di 3.2/3.3/5.1, ordine di lavorazione, tabella roadmap, changelog
- `README.md`: sezione **Â«Cosa non siamoÂ»**, dichiarazioni non supportate corrette, roadmap riscritta
- `docs/INDEX.md`: riga `22` + conteggio dei documenti DRAFT
- `scripts/generate-bundle.ps1`: `$files` += `docs/22-COMPETITIVE-POSITIONING.md` e la sessione 85
- `docs/BUNDLE.md`: rigenerato

