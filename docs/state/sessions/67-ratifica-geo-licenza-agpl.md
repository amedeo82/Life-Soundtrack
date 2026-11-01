---
number: 67
title: "Atti del Boss: ratifica di 19-GEO-CONTEXT + ADR-0009 e licenza AGPL-3.0 (issue #201)"
date: 2026-10-30
state: 🟢
merged: true
merged_commit: "b02a80d2d60bf9075809bccda5ffad9b0075c6e7"
merged_date: "2026-10-30T16:42:25Z"
branch: feat/201-ratifica-geo-licenza-agpl
pr: 204
claim: kilo-HP-EliteBook-b7x2
cross_refs: [201, 202, 196, 193, 108, 187, 188]
tags: [privacy, devops, phase-2]
---

# Sessione 67 — Gli atti del Boss (issue #201)

## Sintesi

Tre atti del project owner erano rimasti aperti dal 2026-10-21: la ratifica
di `19-GEO-CONTEXT.md` (🟡 DRAFT v0.2), quella dell'ADR-0009 (🟡 DRAFT v0.1)
e l'applicazione della **licenza AGPL-3.0** (D-AF.2), che la spec `21`
aveva ratificato ma che era «un atto del Boss» sul file `LICENSE`.

Il project owner ha preso quattro decisioni il 2026-10-30: **D-B.1** la
licenza diventa AGPL-3.0 (non si rinuncia a Essentia); **D-B.2** il database
geo si **scarica on-demand** al primo uso, non è embedded nel bundle;
**D-B.3** le soglie dell'algoritmo (`confidence` 0.5, `R6` 0.4,
`cityConfidence` 0.6) sono **costanti misurabili**: default vincolanti, da
calibrare sul fixture; **D-B.4** la ratifica avviene **con le correzioni** dei
difetti trovati.

Le correzioni non sono cosmetiche: gli edge case geo erano numerati
**E11..E15**, ma nel catalogo di `01-PLATFORMS.md` §5 quegli identificatori
erano **già presi** (ListenBrainz E11..E13, Last.fm E14..E18) → rinumerati in
**E19..E24**. Il delta su `02` era ancorato a **v1.3 / Dexie v2→v3** mentre lo
schema è **v1.6 / Dexie v5**. La revoca di D.39.8 era **dichiarata** in
`19§9` ma **mai applicata** all'adapter YouTube Music. E `19§12` elencava come
aperto un punto che era **già deciso** (issue #108).

## Trigger

Issue **#201** (`size:L`, `agent-ready`, `area:privacy`, `area:devops`,
`priority:important`), aperta in questa sessione con l'analisi dei tre atti.
Claim `kilo-HP-EliteBook-b7x2` (unico claim, riverificato). Worktree
`ls-201-ratifica-geo-licenza-agpl`, branch `feat/201-ratifica-geo-licenza-agpl`.

## Cosa è stato consegnato

| Deliverable | Dove |
|-------------|------|
| Il testo **AGPL-3.0** canonico al posto di Apache-2.0 | `LICENSE` |
| Il campo `"license": "AGPL-3.0"` (che **non esisteva**) | `package.json` |
| La sezione "Licenza" del README e l'obbligo del §13 | `README.md` |
| `19-GEO-CONTEXT.md` 🟢 APPROVED **v1.0** (punti aperti chiusi, E19..E24, delta riallineato) | `docs/19-GEO-CONTEXT.md` |
| `13-ADR/0009-local-ip-geolocation.md` 🟢 APPROVED **v1.0** (DB on-demand, motivazione GeoLite2 riscritta, CC BY, freschezza) | `docs/13-ADR/0009/` |
| La revoca di D.39.8 applicata all'adapter | `docs/03-ADAPTERS/youtube-music.md` (v2.0) |
| La matrice di disponibilità geo e gli edge case E19..E24 | `docs/01-PLATFORMS.md` (v0.8) |
| L'inventario privacy di `city`/`ContextPeriod`/database geo | `docs/09-PRIVACY-SECURITY.md` (v0.7) |
| Il namespace `timeline.context.*` e i toggle geo | `docs/08-COPY-I18N.md` (v0.9) |
| La §5.3 licenza e offerta del sorgente | `docs/12-DEVOPS.md` (v1.2) |
| Il pitfall P10 (le dipendenze distribuite contano) | `docs/17-DEV-NOTES.md` (v0.3) |
| La chiusura del punto aperto D-AF.2 | `docs/21-AUDIO-FEATURES.md` (v1.2, §19 punto 1) |
| Le tre story geo nella roadmap e la priorità | `docs/11-BACKLOG.md` (v1.6.28) |
| I 6 nuovi state file (sessione 67 + le story 2.2, 2.3, 1.6, 4.4, 3.4) | `docs/state/` |

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| **D-B.1** | Il repository passa da **Apache-2.0 a AGPL-3.0** (D-AF.2 eseguita) | `essentia.js` è AGPL-3.0 e la PWA distribuisce il modulo acustico agli utenti: il codice permissivo può entrare in un'opera AGPL, il contrario no. **Non** si rinuncia a Essentia (opzione b): la cascata avrebbe perso l'unico provider che misura `valence`/`energy` davvero (AcousticBrainz è congelato a giugno 2022 e copre solo i brani con MBID) e il mood tracker sarebbe rimasto senza dati misurati (D-A.1). L'obbligo del **§13** (offerta del Corresponding Source agli utenti che interagiscono in rete) è un **requisito aperto**: issue #202 |
| **D-B.2** | Il database MMDB geo si **scarica on-demand** al primo uso, **non** è embedded | Il vincolo che rendeva necessaria la misura (il budget di 300 KB gzip, `05§10`) è proprio ciò che la decisione elimina: il database non entra nel bundle. È lo stesso pattern già deciso per il WASM di Essentia (`21§6.5`): fuori dal bundle, fuori dal precache, in Cache Storage. **L0 (paese) e L1 (contesto) reggono da sole**: senza database c'è il paese, non la città |
| **D-B.3** | Le soglie (`confidence` 0.5, `R6` 0.4, `cityConfidence` 0.6) sono **costanti misurabili** | Sono ragionate, non misurate: la ratifica le fissa come **default vincolanti**, le espone come parametri di config (quindi dentro il `derivedVersion`, MIG-3) e dichiara la calibrazione sul fixture realistico come deliverable della tranche di implementazione. Ogni variazione produce un bump di `derivedVersion` e un ricalcolo |
| **D-B.4** | La ratifica avviene **con le correzioni** dei difetti trovati | Un documento che attende mesi invecchia contro gli altri documenti: tre versioni di schema, otto identificatori di edge case presi altrove, una revoca dichiarata e mai applicata, un punto aperto già chiuso. La ratifica non è un atto di firma: è il confronto con lo stato reale |
| **D.67.1** | Gli edge case geo sono **E19..E24** (non E11..E15) | `01-PLATFORMS.md` §5 usa già E11..E18 (ListenBrainz, Last.fm). Rinumerare è l'unico modo per non avere due significati per lo stesso identificatore in due documenti che si citano. Il sesto caso, «database assente», nasce dalla D-B.2 |
| **D.67.2** | Il delta su `02` è **ratificato come decisione**, applicato nella Story 1.6 | È il percorso già fatto dalla `21`: ratificata nella Sessione 62, applicata a `02` nella Sessione 64 dalla Story 4.1. Fino ad allora `02` v1.6 resta il contratto vigente per il codice |

## Difetti trovati lungo il percorso

**I difetti di una ratifica sono quasi sempre di numerazione e di riferimenti
incrociati, non di sostanza.** Nessuno dei cinque difetti trovati riguardava
il merito della specifica: riguardavano gli identificatori (E11..E15 già
presi), la versione di uno schema (v1.3 invece di v1.6), una decisione già
applicata in un altro documento (D.39.8) e un punto aperto già chiuso
(issue #108). La lezione è la stessa della Sessione 65 (lesson 65-4): i
riferimenti fra documenti APPROVED vanno cercati **per nome**, non per numero
di sezione.

**La ragione di una decisione può invecchiare senza che cambi la
conclusione.** La motivazione su MaxMind GeoLite2 diceva «incompatibile con
Apache-2.0»: dopo il passaggio ad AGPL-3.0 la frase è falsa (l'obiezione non
dipende dalla licenza dell'app, è la EULA di MaxMind), ma la conclusione
resta: si usa DB-IP Lite. Cambia la ragione, non la scelta.

**Un host che il codice usa e la spec non dichiara è una richiesta bloccata.**
La CSP applicata è `script-src 'self' 'wasm-unsafe-eval'` e `21§6.5` prevede
il download on-demand del modulo WASM: l'host da cui arriva non è dichiarato
da nessuna parte. È la stessa classe della issue #196 (l'host della ricerca
iTunes), vista dal lato opposto: lì la CSP mancava di un host, qui la spec
manca dell'host che la CSP deve consentire.

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0
- `pwsh scripts/aggregate-state.ps1 -Check` → drift **atteso** nei blocchi
  aggregati (SESSIONS/BACKLOG/INDEX/BUNDLE/README): li rigenera
  `auto-state-aggregate` post-merge (ADR-0008). Nessun numero di sessione
  duplicato (`67` pre-allocato con la procedura di `docs/state/_index.md`)
- `node scripts/check-readme-facts.mjs` → 15 check, 0 falliti
- `pnpm run lint` / `typecheck` / `test` / `build` → verdi (nessun codice di
  applicazione cambiato: solo documentazione, `LICENSE` e `package.json`)

## Lesson learned

| # | Osservazione |
|---|---|
| 67-1 | **Ratificare non è firmare: è confrontare con lo stato reale.** Cinque difetti, nessuno di merito: due di numerazione, uno di versione, uno di decisione non applicata, uno di punto già chiuso. Un documento DRAFT che aspetta settimane invecchia contro tutto ciò che gli sta intorno |
| 67-2 | **Una ragione che cambia va riscritta anche se la conclusione resta.** «Incompatibile con Apache-2.0» era vero e non lo è più: l'obiezione è la EULA di MaxMind, indipendente dalla licenza dell'app. Una motivazione falsa è una bugia utile, se lascia intendere che la decisione regge su di essa |
| 67-3 | **I numeri degli edge case sono uno spazio globale, non un inventario per documento.** `01-PLATFORMS.md` §5 è il catalogo: chi scrive in un altro documento deve allocare lì, o dichiarare il numero che userà. Nessun gate lo verifica oggi — è il candidato naturale a un check come quello dei fatti del README (issue #161) |
| 67-4 | **La CSP e la spec devono dire la stessa cosa, anche per gli script.** L'errore della issue #196 era un host `connect-src` mancante; il suo gemello è un host `script-src` mancante per un asset scaricato on-demand. La regola è una sola: ciò che il codice carica va dichiarato dove il codice lo dichiara |

## Documenti aggiornati

- `LICENSE` — il testo AGPL-3.0 canonico
- `package.json` — il campo `license`
- `README.md` — la sezione "Licenza" e l'obbligo del §13
- `docs/19-GEO-CONTEXT.md` — v1.0 🟢 APPROVED
- `docs/13-ADR/0009-local-ip-geolocation.md` — v1.0 🟢 APPROVED
- `docs/03-ADAPTERS/youtube-music.md` — v2.0 (revoca di D.39.8)
- `docs/01-PLATFORMS.md` — v0.8 (E19..E24 + matrice geo)
- `docs/09-PRIVACY-SECURITY.md` — v0.7 (inventario e data flow)
- `docs/08-COPY-I18N.md` — v0.9 (namespace e toggle)
- `docs/12-DEVOPS.md` — v1.2 (§5.3 licenza; nota sull'host geo)
- `docs/17-DEV-NOTES.md` — v0.3 (P10)
- `docs/21-AUDIO-FEATURES.md` — v1.2 (§19 punto 1 chiuso)
- `docs/11-BACKLOG.md` — v1.6.28 (tre story geo, priorità, roadmap)
- `docs/INDEX.md` — le righe legacy, lo stato dei documenti, la licenza, il prossimo passo
- `docs/18-DEV-LOG.md` — v2.20 (§32 e changelog)
- `docs/state/sessions/67-ratifica-geo-licenza-agpl.md` — **nuovo**
- `docs/state/stories/{2.2,2.3,1.6,4.4,3.4}-*.md` — **nuovi**
- `scripts/generate-bundle.ps1` — `$files`: i 6 nuovi file

## Cross-refs

- **#201** — gli atti del Boss (claim `kilo-HP-EliteBook-b7x2`)
- **#202** — l'offerta del sorgente richiesta dal §13 della licenza (aperta da questa sessione)
- **#196** — la lezione della CSP: la spec e la CSP applicata devono dire la stessa cosa
- **#193** — la Sessione 65 (D-A.6: il fallback mood-by-genre non esiste)
- **#108** — la decisione su `retainCountry` (opzione A), chiusa nella ratifica
- **#187 / #188** — la spec delle audio features e la sua implementazione (la catena 4.1 → 2.1)
