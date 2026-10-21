---
number: 41
title: "Geo & contesto di ascolto: specifica e ADR"
date: 2026-10-21
state: 🟢
merged: true
merged_commit: 856c0f5
merged_date: 2026-10-21T15:35:48+02:00
branch: docs/41-geo-context-spec
pr: 102
claim: ""
cross_refs: [99]
tags: [docs, spec, geo, privacy, phase-1]
---

# Sessione 41 — Geo & contesto di ascolto

## Sintesi

Il project owner ha chiesto di arricchire il progetto con i dati geo presenti nelle piattaforme di streaming e nei log, per ottenere un diario di ascolto che dica "cosa stavo ascoltando, dove, su che dispositivo", con la granularità lasciata alla scelta dell'utente durante l'import.

L'analisi ha rilevato che `country`, `ip` e `deviceType`/`deviceDetail` sono **già** nello schema APPROVED e **già** popolati dall'adapter Spotify (`adapters/spotify/mapEvent.ts:167-170`), scritti dalla pipeline (`adapters/pipeline.ts:90-93`) e **mai letti** da nessuna UI o analisi. Il 60% del diario era quindi già in DB e sprecato.

La stessa analisi ha circoscritto il perimetro reale: **solo Spotify** espone contesto (`conn_country`, `ip_addr`, `platform`); YouTube Music ha `locationInfos` ma lo scarta al parse; Apple, Deezer, Tidal, SoundCloud, Last.fm, ListenBrainz, Plex e Navidrome non espongono nulla (edge case **E9**). Nessuna fonte contiene città o coordinate. Il diario sarà quindi asimmetrico, e questo va dichiarato all'utente invece che mascherato.

Il Boss ha scelto: perimetro **L0 + L1 + L2** (paese, contesto dedotto, città via IP), **pannello per-campo con override per singolo import**, **`locationInfos` di YouTube riattivato** dietro toggle, e **nastro contesto senza mappa**. Queste scelte sono tracciate in `19-GEO-CONTEXT.md` (🟡 DRAFT) e `13-ADR/0009-local-ip-geolocation.md` (🟡 DRAFT). Issue di tracking: **#99** (`needs-spec`).

## Trigger

Richiesta del Boss: "arricchire il progetto con i dati geo presenti nelle piattaforme e forniti nei logs… una funzionalità che dica cosa stavo ascoltando, dove lo ascoltavo, su che dispositivo… il livello di dettaglio e la scelta se mostrarle/importarle oppure no lasciata all'utente durante l'import". L'analisi e le 4 decisioni di perimetro sono state chiuse prima della stesura.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.41.1 | Perimetro "dove" = L0 (paese) + L1 (contesto dedotto) + L2 (città stimata dall'IP) | Scelta del Boss. L0 e L1 sono gratuiti e robusti; L2 è dichiaratamente un diacritico |
| D.41.2 | Il contesto non sta su `ListenEvent` ma su un'entità **derivata** `ContextPeriod` (tabella `contexts`, ricalcolabile con `recompute()`) | MIG-2: i dati ricostruibili non si mettono nella tabella calda da 200k+ righe. `country`/`city` restano sull'evento perché derivati al parse e non ricostruibili |
| D.41.3 | La città si deriva **dentro la pipeline, prima dello scarto dell'IP** (`pipeline.ts:92`), e in DB finisce solo il campo derivato | Con il default `retainIp = false` una derivazione post-persistenza non produrrebbe mai nulla; questa scelta mantiene la minimizzazione e allinea `02` §3.8 con `09` §3.2 |
| D.41.4 | Geolocalizzazione IP **locale** con DB-IP Lite City (CC BY 4.0, MMDB embedded) | GeoLite2 **non è ridistribuibile** in un prodotto Apache-2.0 ( serve la Commercial Redistribution License a pagamento e vincola downstream). DB-IP Lite non richiede account ed è ridistribuibile con semplice attribuzione. Nessuna egress → `09` §3.2 resta letteralmente vero |
| D.41.5 | `city` è **sempre** un dato stimato: `cityConfidence`, soglia di scarto sotto 0.6, copy "circa X", correggibile dall'utente (`citySource = 'manual'`) | Accuratezza free tier: `country` >95%, `city` 70-78% e sugli IP mobili spesso risolve all'HQ dell'operatore. Presentare la città come fatto produrrebbe storie false |
| D.41.6 | Toggle per-campo (`retainCountry`, `retainCity`, `retainDeviceType`, `retainDeviceDetail`, `deriveContext`) con **override per singolo import** | Scelta del Boss. `deviceDetail` è la stringa grezza del provider (identificativa) → default `false`; `city` è stimata → default `false` |
| D.41.7 | **Revoca di D.39.8**: `locationInfos` di YouTube Music letti solo se il toggle `ytLocationInfos` è attivo (default `false`) | La motivazione originale ("nessun toggle dedicato nello schema → scarto incondizionato") cessa di valere: il toggle dedicato è ciò che `19` §7.1 introduce. Da recepire in `03-ADAPTERS/youtube-music.md` v2 |
| D.41.8 | Classificatore di contesto **deterministico e versionato**, non ML; `commute` a confidence 0.4 (sotto la soglia 0.5) e quindi non aggregato; nessun `outdoors` | Coerente con `04-ANALYSIS-ALGORITHMS` (ricalcolabile, ispezionabile, testabile). Il clustering ML renderebbe `derivedVersion` non-deterministico; `outdoors` non è distinguibile da `home` con questi dati |
| D.41.9 | Visualizzazione = **nastro contesto** sotto le EraBand, nessuna mappa | Scelta del Boss e coerente con la scala reale dei dati (paese, talvolta città). Una mappa richiederebbe MapLibre/Leaflet + tile online: uscita di rete in un'app local-first per un dato che non regge la scala cartografica |

## Edge case nuovi catalogati

E11 (IP non risolvibile → `city = null`), **E12 (IP riservati o CGNAT RFC1918/100.64/10 → geolocalizzazione impossibile: è il caso più frequente su rete mobile)**, E13 (cambio paese → `travel`, non errore), E14 (nessun cluster dominante → `unknown`, non aggregato), E15 (re-import con toggle diversi → i campi già persistiti non sono azzerati).

## Contraddizioni sanate (o segnalate)

- `02-DATA-SCHEMA.md` §3.8 ("`country` sempre derivato e conservato" indipendentemente dai toggle) **vs** `09-PRIVACY-SECURITY.md` §4 ("Paese di connessione" con base di liceità *consenso esplicito*). La proposta risolve in favore di `02` (che è APPROVED) con `retainCountry` a `true`, e allinea `09`. **La riga resta bloccata finché il Boss non conferma il default** (`19` §12 punto 1).
- `06-UX-FLOWS-STATES.md` §2.2 dichiara "3 toggle" mentre il codice ne implementa 4 (`OnboardingRouter.tsx:253`) — preesistente, da allineare in `06` v2 insieme al pannello per-campo.

## Verifica

- `scripts/generate-bundle.ps1 --check` → exit 0 (dopo rigenerazione con `$files` esteso)
- `scripts/aggregate-state.ps1 --check` → exit 0 (dopo rigenerazione con la nuova Sessione 41)
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati

## Esito post-merge

- PR **#102** mergata in `main` il 2026-10-21T13:35:49Z, merge commit **`856c0f5`**
- CI: `quality` verde · `auto-branch-cleanup` verde · `auto-state-aggregate` verde (bot `c1d2ca2`)
- `auto-status-done`: nessuna transizione, come previsto — la PR non contiene keyword di chiusura (`#99` resta `needs-spec`)
- Procedura canonica `scripts/post-merge.ps1 -Branch docs/41-geo-context-spec` → exit 0: `main` allineato a `origin/main`, branch remoto già assente (idempotente), branch locale eliminato con `git branch -d`
- Verifica post-merge (livello 3): `aggregate-state.ps1 -Check` exit 0 · `generate-bundle.ps1 -Check` exit 0 (63 file) · `post-merge.ps1 -Check` exit 0 (nessun residuo)
- Risoluzione conflitto di numerazione: la PR iniziale era la **#101** su branch `docs/40-geo-context-spec`; chiusa e sostituita dalla **#102** su `docs/41-geo-context-spec` dopo che l'agente su #98 aveva mergiato la PR #100 numerando anch'egli la sua sessione come 40 (lesson 41-4)

## Lesson learned

| # | Osservazione |
|---|--------------|
| 41-1 | `pwsh` (PowerShell 7) non è installato su questa macchina: gli script repo vanno invocati con `& .\scripts\<nome>.ps1` dentro Windows PowerShell 5.1 — conferma della lesson 39-1. **Attenzione al doppio trattino**: in PS 5.1 `generate-bundle.ps1 --check` **non viene riconosciuto come switch** e ricade silenziosamente in modalità *genera*, riscrivendo `docs/BUNDLE.md` invece di verificarlo (stesso effetto per `aggregate-state.ps1 --check`). La forma corretta è `-Check`: verificare sempre l'`exit code` **e** la riga `[OK] … in sync` nell'output |
| 41-2 | In PowerShell 5.1 una here-string passata come `--body` a `gh` viene spezzata in più argomenti: scrivere il body su file temporaneo e usare `--body-file` — conferma e generalizzazione della lesson 39-2 |
| 41-3 | Quando si aggiungono file in `docs/`, `INDEX.md` (tabelle + §"Dettaglio (legacy)": conteggi APPROVED/DRAFT e "Prossimo step tecnico"), `scripts/generate-bundle.ps1` `$files` e `docs/BUNDLE.md` vanno aggiornati **nella stessa PR**: i conteggi dei documenti sono legacy section e il gate `--check` non li copre, quindi il drift sarebbe silenzioso |
| 41-4 | **Collisione di numerazione fra agenti paralleli**: questa sessione era inizialmente la 40; l'agente su #98 l'ha assegnata alla spec Apple Music e la sua PR (#100) è stata mergiata *mentre* questa sessione scriveva i documenti. Nessun gate lo rileva: `aggregate-state.ps1` ordina per `number` e il tie-break produce **due righe "Sessione 40"** in `SESSIONS.md`, senza errore. Prima di allocare un numero di sessione: `git fetch origin` + `git ls-tree origin/main docs/state/sessions/`; se l'ultimo numero è occupato, prendere il successivo e rinumerare **prima** del push |

## Documenti aggiornati

- `docs/19-GEO-CONTEXT.md` (**nuovo**, 🟡 DRAFT) — la specifica
- `docs/13-ADR/0009-local-ip-geolocation.md` (**nuovo**, 🟡 DRAFT) — la decisione architetturale
- `docs/INDEX.md` — riga `19` + riga `13` (0001-0009) + conteggi DRAFT e "Prossimo step tecnico"
- `scripts/generate-bundle.ps1` — `$files` con i 2 nuovi documenti e la Sessione 41
- `docs/BUNDLE.md` — rigenerato
- `docs/state/sessions/41-geo-context-spec.md` (**nuovo**) — questa entry

## Cross-refs

- **#99** — issue di questo lavoro (`needs-spec`): tiene il perimetro, i vincoli e i 10 cantieri
- **`11-BACKLOG.md`** — le story 1.6 / 4.4 / 3.4 non sono ancora state create: la loro numerazione è proposta in `19` §11 e va ratificata con il backlog (Sessione 43)
- Prossime sessioni: 42 (`02` v1.3 + `03-ADAPTERS/youtube-music.md` v2 + `09` + `01`), 43 (`04` + `06`/`07`/`08` + backlog)