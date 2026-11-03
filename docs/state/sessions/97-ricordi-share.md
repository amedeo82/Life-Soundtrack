---
number: 97
title: "Ricordi + Share: il feed, la card e il tagging manuale (issue #241)"
date: 2026-11-03
state: 🟢
merged: true
merged_commit: "22cf5916140c5869ea296bc778e6cb094ed71037"
merged_date: "2026-11-03T22:32:23Z"
branch: feat/241-story-3-2---ricordi-share
pr: 301
claim: kilo-hp-elitebook-bfed
tags: [ui, ricordi, share, tagging, canvas, i18n]
---

# Sessione 97 — Ricordi + Share: il feed, la card e il tagging manuale (issue #241)

> **Oggetto**: la **Story 3.2** — il feed dei ricordi (schermata ⑪), il foglio di
> condivisione (⑫) e il **tagging manuale**. È la story che rende leggibile la
> storia dell'utente: l'analisi automatica dice *cosa* suonava, l'utente
> scrive *perché*.

## Sintesi

L'issue #241 è stata implementata sulla specifica `docs/25-MEMORIES-SHARE-EXPLORE.md`
(v1.0 🟢 APPROVED, ratificata dal project owner il 2026-11-02), con le sette
decisioni D-25.1…D-25.7.

Il lavoro è in tre pezzi, e il terzo è quello che la specifica dichiarava
**rischioso**: il ricalcolo dell'analisi **cancella e reinserisce** gli insight
(`replaceAllInsightsOfType`, Story 2.5), quindi un nome dato a un'era sarebbe
sparito al primo ricalcolo. La correzione non sta nei generatori ma nel
**writer**: `preserveUserFields` riporta `userNote` e `status` dagli insight
esistenti a quelli nuovi, e il test di integrazione verifica la sopravvivenza
al ricalcolo reale (`replaceAllInsightsOfType` sul database, non una simulazione).

Il resto è stato scelto per restare **locale e senza librerie**:

- la card 1080×1350 è disegnata a mano su `canvas` (nessuna libreria di
  grafica), con i font caricati **prima** del disegno e un placeholder
  deterministico quando la copertina non c'è;
- il capitolo HTML è **autonomo**: nessuno script, nessun foglio di stile
  esterno, nessuna richiesta di rete — l'export statico alternativo per chi non
  usa i social;
- ogni azione di condivisione ha un **fallback**: senza Web Share API si
  scarica il file, senza clipboard si scarica il file.

## Cosa è stato fatto

### Core (`packages/core`)

- `setInsightUserNote` e `setInsightStatus`: i writer dei campi **dell'utente**,
  transazionali, che restituiscono `null` se l'insight non esiste (l'utente può
  aver rinominato un'era che il ricalcolo ha appena rimosso: non è un errore);
- `preserveUserFields` applicato a `replaceAllInsightsOfType`,
  `replaceInsightsOfType` e `replaceInsights`: la nota e la conferma
  sopravvivono al ricalcolo.

### App (`apps/web`)

- `hooks/useMemories.ts`: il feed — pagine di 10, `dismissed` escluso ma **non
  cancellato**, ordinamento per `Insight.confidence` decrescente (la rilevanza
  è il campo che il motore dei ricordi normalizza), e le tre azioni (nascondi,
  salva, nota);
- `hooks/useEraNotes.ts` + `eraNote.ts`: le ere rilevate e il loro nome libero
  (nome + parole chiave separate da virgola);
- `share/renderMemoryCard.ts`: la card 1080×1350 su canvas;
- `share/renderMemoryChapter.ts`: il capitolo HTML autonomo;
- `share/shareActions.ts`: Web Share API, clipboard, download (con fallback);
- `components/ShareSheet.tsx`: il dialog accessibile (focus trap, `Esc`,
  backdrop) con gli stati `generating` / `ready` / `error`;
- `components/NoteField.tsx` + `EraNoteField.tsx`: il campo di nota libera,
  riusato per l'era e per il ricordo;
- `screens/Memories.tsx`: la schermata ⑪, con infinite scroll e fallback
  manuale, il tagging delle ere e il flusso di condivisione;
- `i18n`: le nuove chiavi `nav.memories`, `memories.*` e `share.*` in IT ed EN.

### Test

37 test nuovi (8 nel core, 29 nell'app web): i writer e la preservazione al
ricalcolo, il feed, il canvas, il capitolo HTML, il dialog accessibile, le
azioni della card e la rinomina dell'era.

## Decisioni

- **Il tag del brano sta sulla nota dell'insight del ricordo**, non su un
  campo nuovo di `Track`: la decisione D-25.4 della spec 🟢 (nessuna
  migrazione dello schema, il DB v7 imporrebbe il bump di `fastCheck`) è
  vincolante, e il tag del ricordo copre il caso d'uso dell'AC «tagging
  manuale di un'era e di una canzone».
- **Il capitolo HTML è l'export statico alternativo**, non un PDF: il PDF
  richiederebbe una dipendenza (o un writer minimale) e l'AC dice «HTML autonomo
  **e/o** PDF».
- **Il componente non conosce l'i18n**: ShareSheet, NoteField ed EraNoteField
  ricevono le etichette già rese.

## Analisi di avanzamento

- **Numeri**: 37 test nuovi; suite `@ls/core` 643 test verdi (57 file),
  `@ls/web` 186 test di cui 178 verdi e 8 falliti **per l'ambiente locale**
  (i test del «language detector» usano `localStorage`, che il jsdom non espone
  sotto Node 26: gli stessi file falliscono identici su `main`, il CI gira su
  Node 24).
- **Cosa è pronto**: feed ⑪, ShareSheet ⑫, card PNG, capitolo HTML, tagging
  dell'era e nota sul ricordo, i18n IT/EN.
- **Cosa manca**: l'export del database e la cancellazione definitiva (Story
  5.2), il nastro contesto nella Timeline è un'altra story (3.4, già merged),
  la schermata ⑨/⑩ di Esplora è la Story 3.3.
- **Salute tecnica**: lint e typecheck verdi su `@ls/core` e `@ls/web`.
- **Gate per il test**: `pnpm --filter @ls/web exec vitest run` deve essere
  verde **in CI** (Node 24); in locale i 8 fallimenti i18n sono attesi e
  documentati.

## Lesson learned

- **Un test che usa `localStorage` globale è un test di ambiente.** Sotto
  Node 26 il jsdom non espone `localStorage` e il `beforeEach` muore prima
  della prima asserzione: un fallimento che sembra una regressione di i18n e
  invece è il runtime. Il confronto con `main` è la mossa che lo distingue.
- **Il test di performance del core è un indicatore di carico**: 10.000 insert
  in < 500 ms falliscono se un'altra suite gira in parallelo sulla stessa
  macchina, e passano da soli.
- **Le entità HTML vanno costruite, non scritte letterali**: `&` in un
  sorgente TypeScript finisce per essere riscritto come `&` in alcuni passaggi
  di tooling; `String.fromCodePoint(38)` rende l'escape esplicito e immune.

## Documenti aggiornati

- `docs/state/stories/3.2-ricordi-share.md` (nuova) e
  `docs/state/sessions/97-ricordi-share.md` (questa)
- `docs/11-BACKLOG.md` — sezione Story 3.2
- `docs/INDEX.md` — dettaglio legacy
- `docs/06-UX-FLOWS-STATES.md` §2.11-§2.12 · `docs/07-UI-SPEC.md` §2.2, §2.10
- `docs/08-COPY-I18N.md` — le nuove chiavi
- `docs/18-DEV-LOG.md` — la entry della sessione
- `scripts/generate-bundle.ps1` — `$files`
