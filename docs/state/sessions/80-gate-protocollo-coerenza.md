---
number: 80
title: "Gate di coerenza del protocollo e blocchi aggregati intoccabili (I2-b)"
date: 2026-11-01
state: 🟡
merged: false
branch: feat/252-gate-protocollo-coerenza
pr: 0
claim: kilo-hp-elitebook-1a2b
tags: [devops, governance, tooling]
---

# Sessione 80 — Gate di coerenza del protocollo e blocchi aggregati intoccabili (I2-b)

> **Issue di tracking**: #252 (lotto I2-b dell'epic #248). **Branch**: `feat/252-gate-protocollo-coerenza`.
>
> Secondo lotto dell'epic #248: non chiude altri drift, **chiude la classe di drift**. Nella
> Sessione 79 ne erano stati chiusi 8, uno per uno: senza un gate che li confronti, tornano.

## Sintesi

Il protocollo agenti aveva una proprietà che nessun altro artefatto di governance del repo aveva: **nessun gate**. Il README ha `check-readme-facts.mjs`, le sessioni `check-merge-state.mjs`, i workflow `validate-workflows.mjs`, le label `validate-labels.mjs`, i blocchi aggregati `aggregate-state.ps1`, il bundle `generate-bundle.ps1`. `AGENTS.md` — 1328 righe, 77 anchor, 643 citazioni — no.

Questa sessione aggiunge i due gate che mancavano, entrambi **read-only** (non generano e non scrivono nulla) e entrambi con il proprio **scenario negativo** (un gate che passa sempre non è un gate, lesson 43-1):

| Gate | Controlli | Drift coperti |
|------|-----------|---------------|
| `scripts/check-protocol-consistency.mjs` | 6 | D1, D2, D3, D7, D8 + integrità degli anchor |
| `scripts/check-aggregate-blocks.mjs` | 1 (bloccante) | regola V1 di ADR-0008 |

Il primo giro del gate di coerenza ha trovato **3 riferimenti rotti in `AGENTS.md`** che nessuno aveva notato in 78 sessioni: un typo («Macchina **di** stati» invece di «a stati»), un rimando a una sezione «⚠️ Deprecazione» che non esiste, e un rimando a «🛡️ Hardening multi-agente» (rinominata in «Session start checklist»). Sono il tipo di difetto che la documentazione non può notare da sola: un rimando a una sezione inesistente è indistinguibile da un rimando valido finché nessuno lo clicca.

Il gate dei blocchi aggregati ha una **prova di non-vacuità**: applicato alla **PR #249 reale** (base `5e98866` → merge commit `2478a9a`) rileva **5 violazioni** — la PR aveva committato i blocchi `AGGREGATE-*` rigenerati in locale, violando la regola V1 di ADR-0008. La **PR #250** (doc-sync di chiusura della Sessione 79) aveva la stessa violazione ed è stata corretta prima di questo merge.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-80.1 | Il gate dei blocchi confronta **base vs PR**, non "contenuto calcolato vs contenuto su disco" | La regola V1 di ADR-0008 è «il blocco non è stato toccato»: è una domanda **testuale**, e quindi immune all'incompatibilità PS 5.1/PS 7 che tiene warning-only il check aggregatore (issue #63). Perciò può essere **bloccante** (decisione D4 del project owner) |
| D-80.2 | `AGGREGATE-BUNDLE-INVENTORY` è **esente** | Il suo contenuto è una **misura** (le dimensioni dei file in catalogo), non uno stato: cambia con qualsiasi modifica di contenuto, e il `pre-push` lo rigenera da solo. Gli altri 7 blocchi sono stati, e la loro unica sorgente è l'agregator, post-merge |
| D-80.3 | I **documenti storici** non sono verificati (footer changelog di `AGENTS.md`, `docs/18-DEV-LOG.md`, `docs/SESSIONS.md`, `docs/BUNDLE.md`) | Un riferimento a una sezione **come era all'epoca** («La CI: 11 job» quando oggi sono 12) non è un drift: è un record. Verificarli produrrebbe solo falsi positivi |
| D-80.4 | Il riferimento a un altro documento è attribuito al **documento citato più vicino** | Una riga può citare più documenti (`AGENTS.md §"x" e docs/12-DEVOPS.md §9.10`): ogni `§` appartiene all'ultimo citato prima di lui |
| D-80.5 | Il gate C4 verifica i riferimenti **anche dentro `AGENTS.md`** | I riferimenti interni non citano il file stesso: senza questo, il gate ne ignorava la maggior parte |
| D-80.6 | I flag citati sono verificati **solo dentro i blocchi di codice** | Una flag citata in prosa per dire che *non esiste* (es. `-Strict`, che il protocollo dichiara inesistente) non è un riferimento da verificare |
| D-80.7 | C6 confronta le voci di checklist **con il contenuto del PR template**, non con la loro presenza | `AGENTS.md` ha 3 voci di checklist **proprie** (i criteri di accettazione di un'issue): non sono un duplicato. Il duplicato è la *copia* di una voce del template |
| D-80.8 | Il job CI è `gates-protocol`, con `fetch-depth: 0` | Serve il confronto con `origin/main`; non richiede `pnpm install` (solo moduli built-in di node) |

## Analisi di avanzamento

**Numeri.** L'implementazione non cambia: **75%** (21 story completate su 28, effort pesato 77%),
restano **7 step** (3.2 Ricordi + Share · 3.3 Esplora + Analisi · 4.2 MusicBrainz lookup ·
4.3 Artwork enrichment · 5.1 Privacy spec finale · 5.2 Export e purge · 6.1 Upgrade toolchain).
Questa sessione è lavoro di **governance** su un'epic (#248), non una story del backlog.

**Il numero che conta.** I gate del repository passano da **26** a **30** (4 nuovi step nel job
`gates-protocol`), e il **protocollo agenti** passa da **0** a **2** gate che lo verificano. Per la
prima volta ogni regola normativa di `AGENTS.md` che può essere confrontata con la realtà **ha un
gate**: il principio di ADR-0012 («una regola senza gate è un consiglio») smette di essere un
principio e diventa un inventario.

**Cosa è pronto.** I due gate (6 + 1 controlli), le due suite di scenario negativo (8 + 6
scenari), il job `gates-protocol` in `ci.yml` (4 step bloccanti + `fetch-depth: 0`), la nuova
sezione §"✅ Il contratto del protocollo: regola ⟺ gate" in `AGENTS.md` (v1.34 → v1.35), il
catalogo dei gate in `docs/12-DEVOPS.md §9.10` (13 job, 31 step), 3 riferimenti rotti corretti in
`AGENTS.md`, 1 riferimento stale corretto in `scripts/generate-fixtures.mjs` (`AGENTS.md §V1`, che
non esiste più dalla ristrutturazione v1.0).

**Cosa manca.** Il lotto **I2-c** (`agent-claim.ps1` con claim e riverifica in sequenza atomica,
`agent-pr.ps1`, `check-claim-state.mjs`) e il lotto **I3** (rifinitura di `AGENTS.md` a ~400 righe
con 77 anchor invariati — il gate C4 ne è la rete di sicurezza). Resta aperta l'issue **#251**
(la catena post-merge si annulla da sola: il concurrency group `post-merge-main` cancella i run in
attesa invece di accodarli — misurato nel merge della PR #249).

**Salute tecnica.** Worktree attiva su `feat/252-gate-protocollo-coerenza`. Claim riverificato
sull'issue #252. Nessun blocco `AGGREGATE-*` modificato a mano: verificato con
`node scripts/check-aggregate-blocks.mjs` (0 violazioni). `pwsh` 7.6.9.

**Gate di testabilità.** `node scripts/check-protocol-consistency.mjs` (6 check, 0 falliti) ·
`node scripts/check-aggregate-blocks.mjs` (0 violazioni) ·
`bash scripts/test-protocol-consistency.sh` (8 scenari, 0 falliti) ·
`bash scripts/test-aggregate-blocks.sh` (6 scenari, 0 falliti) ·
`pwsh scripts/aggregate-state.ps1 -Check` (exit 0) · `pwsh scripts/generate-bundle.ps1 -Check`
(exit 0) · `node scripts/validate-workflows.mjs .github/workflows` (0 falliti).

## Lesson learned

| Osservazione | Conseguenza |
|--------------|-------------|
| Un **rimando** a una sezione inesistente è indistinguibile da uno valido finché nessuno lo clicca: 3 in 78 sessioni, e nessun gate li aveva visti | Il gate C4 verifica gli anchor **come parte del gate di coerenza**, non come controllo separato: un controllo in più significa un posto in più dove può non essere eseguito |
| Il primo giro di un gate appena scritto finds **falsi positivi** prima che veri problemi: 2 «riferimenti rotti» erano in realtà riferimenti ad altri documenti (attribuzione per menzione più vicina) e riferimenti a sottosezioni (freccia `→`) | L'ordine è: prima far passare il gate sullo stato **vero** del repository (che è sano), poi giudicare i fallimenti. Un gate che segnala 20 problemi e 15 sono sue bug non viene ascoltato quando ne segnala 21 e 20 sono suoi bug |
| La prova che un gate non è vacuo si fa su **un caso reale già esistente**, non su una fixture | `check-aggregate-blocks.mjs` è stato eseguito sulla PR #249 reale: 5 violazioni. Una fixture costruita apposta avrebbe dimostrato che il gate funziona, non che c'era qualcosa da trovare |
| Il **checkout del gate in CI** deve avere la base, non solo il merge commit | `fetch-depth: 0`: senza, `origin/main` non esiste e il confronto base-vs-PR non può girare. È il dettaglio che distingue un gate che passa sempre da un gate che verifica |

## Documenti aggiornati

- `scripts/check-protocol-consistency.mjs` (nuovo) · `scripts/check-aggregate-blocks.mjs` (nuovo)
- `scripts/test-protocol-consistency.sh` (nuovo) · `scripts/test-aggregate-blocks.sh` (nuovo)
- `scripts/generate-fixtures.mjs`: riferimento stale `AGENTS.md §V1` → `02-DATA-SCHEMA.md`
- `.github/workflows/ci.yml`: nuovo job `gates-protocol` (4 step) + aggregatore `quality`
- `AGENTS.md` v1.34 → v1.35: nuova sezione §"✅ Il contratto del protocollo: regola ⟺ gate"; 3
  riferimenti rotti corretti
- `docs/12-DEVOPS.md §9.10`: catalogo dei gate (13 job, 31 step) + sezione sul job `gates-protocol`
- `docs/18-DEV-LOG.md` §46
- `scripts/generate-bundle.ps1`: `$files` += i 4 nuovi script + la sessione 80
- `docs/INDEX.md`: versione di `AGENTS.md`, riga `13-ADR/`, riga `18-DEV-LOG.md`
