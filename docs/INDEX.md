# 📚 Indice della Documentazione

> Stato master del progetto. Aggiornato ad ogni sessione di progettazione.
> **Leggi questo file prima di qualsiasi altro per avere una panoramica.**

## Legenda stati
| Status | Significato |
|--------|-------------|
| 🟢 APPROVED | Documento approvato da Boss, vincolante per gli agenti |
| 🟡 DRAFT | Bozza in discussione, non ancora approvata |
| 🔴 TODO | Documento da scrivere |

## Documenti fondamentali
| # | File | Stato | Ultima modifica | Descrizione |
|---|------|-------|-----------------|-------------|
| 00 | [`00-VISION.md`](00-VISION.md) | 🟡 DRAFT | Sessione 9 | Visione, missione, target, principi (decisioni strategiche chiuse in S9) |
| 01 | [`01-PLATFORMS.md`](01-PLATFORMS.md) | 🟡 DRAFT | Sessione 57 (v0.7) | Matrice piattaforme europee + campi dati — v0.7: rimandi al percorso di **scrittura** degli hub (§3.7-3.9, Story 1.5 ratificata) |
| 02 | [`02-DATA-SCHEMA.md`](02-DATA-SCHEMA.md) | 🟢 APPROVED | Sessione 68 (v1.7) | Schema dati unificato (TypeScript + Dexie) — v1.2: `artworkUrl` su Track/Album (§11 cascata fonti); v1.4: §6.1 tabella `settings` (schema Dexie v4) + §3.1 i due campi additivi del contratto adapter; v1.6: §3.8 `scrobbleHubs: ScrobbleHubId[]` + §6.2 tabella `scrobbleOutbox` (schema Dexie v5, Story 1.5); **v1.7 (Story 1.6)**: §3.2 i campi derivati `city*`, §3.8 i toggle `retainCountry`/`retainCity`/`retainDeviceType`/`retainDeviceDetail`/`deriveContext`, §3.10 l'entità `ContextPeriod`, §6.3 la tabella `contexts` (schema Dexie v6) e §7 MIG-5 |
| 03 | [`03-ADAPTERS/`](03-ADAPTERS/) | 🟢 APPROVED | Sessione 57 | SPEC-TEMPLATE + Spotify + YouTube Music (🟢 v1.0) + Apple Music (🟢 v1.0, S42) + ListenBrainz (🟢 v1.2, S47/S57: token in scrittura, percorso incrementale) + Last.fm (🟢 v1.2, S50/S51/S57: percorso di scrittura, md5 D-SH.11, proxy D-SH.14) — **adapter implementati** in Sessione 52 (issue #155) |
| 04 | [`04-ANALYSIS-ALGORITHMS.md`](04-ANALYSIS-ALGORITHMS.md) | 🟢 APPROVED | Sessione 59 (v1.0) | Algoritmi di analisi (mood, ere, eventi, ricordi) — **ratificata** (Sessione 59, issue #178): i trigger dei 5 tipi di ricordo sono specificati, il perimetro della tranche è dichiarato; la Story 2.4 è implementata (Sessione 61) e la **2.1 è implementata** (Sessione 63, issue #180) |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | 🟢 APPROVED | Sessione 62 (v1.4) | Architettura tecnica generale — §4.1 Sorgenti remote (ADR-0010); **§4.2 Contratto di scrittura `ScrobbleSink` (ADR-0011)**; §12.1 `rekey()` attivo (Story 1.4); **§6 Pipeline di arricchimento** allineata alla spec `21` (v1.0 🟢) |
| 06 | [`06-UX-FLOWS-STATES.md`](06-UX-FLOWS-STATES.md) | 🟡 DRAFT | Sessione 9 | Flussi UX e stati per schermata |
| 07 | [`07-UI-SPEC.md`](07-UI-SPEC.md) | 🟡 DRAFT | Sessione 7 | Specifiche UI componenti |
| 08 | [`08-COPY-I18N.md`](08-COPY-I18N.md) | 🟡 DRAFT | Sessione 67 (v0.9) | Tutte le stringhe UI con chiavi i18n — v0.5: namespace `scrobble.*` (§2.16, i 15 codici della Story 1.5); v0.7: i template `memory.*` (§2.15) dichiarati **vincolanti** dalla ratifica di `04`; v0.8: namespace `enrichment.*` (§2.17, le 8 chiavi della Story 4.1); v0.9: namespace `timeline.context.*` (§2.12h) e i toggle geo in `settings.privacy.*` (ratifica di `19`) |
| 09 | [`09-PRIVACY-SECURITY.md`](09-PRIVACY-SECURITY.md) | 🟡 DRAFT | Sessione 67 (v0.7) | Privacy spec, data flow, security — v0.5: percorso di scrobbling (§3.3 payload chiuso per costruzione, §4 inventario); v0.6: le righe dell'inventario per le **audio features** e le query di ricerca, i tre host reali (MusicBrainz, iTunes Search, AcousticBrainz) e l'anteprima audio elaborata in locale; v0.7: le righe di inventario di `city`/`ContextPeriod`/database geo e il data flow della derivazione della città (ratifica di `19`) |
| 10 | [`10-TESTING.md`](10-TESTING.md) | 🟢 APPROVED | Sessione 62 (v1.1) | Strategia di testing — v1.1: §8, i mock delle API esterne sono i due provider reali (iTunes Search, AcousticBrainz), non i placeholder mai esistiti |
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | 🟢 APPROVED | Sessione 66 (v1.6.27) | Backlog strutturato (epic → story → task) — stato delle story completate nel blocco `AGGREGATE-STORIES-*` (ADR-0008); v1.6.0: tabella legacy allineata, fonte di verità unica; v1.6.9: Story 1.3 allineata all'issue di implementazione #155; v1.6.10: **Story 1.3 completata** (issue #155) e rimossa dalla tabella roadmap; v1.6.12: conteggio EPIC 1 allineato (`2/5` → `4/5`, issue #161); v1.6.13: **spec della Story 1.5** scritta in `20-SCROBBLING-HUB.md` (issue #164); v1.6.14: **ADR-0011** scritta (contratto di scrittura `ScrobbleSink`, issue #168); v1.6.15: ADR-0011 **ratificata** (🟢 APPROVED v1.0, PR #170); v1.6.16: **spec della Story 1.5 ratificata** (v1.0 🟢 APPROVED, issue #172) → issue di implementazione #173; v1.6.17: **Story 1.5 implementata** (issue #173, PR #176); v1.6.18: **spec dell'analisi ratificata** (`04` v1.0 🟢 APPROVED, issue #178) → #179 (Story 2.4) e #180 (Story 2.1, bloccata); v1.6.20: **Story 2.4 implementata** (issue #179, PR #185: i 5 tipi di ricordo, il feed per rilevanza, la `derivedVersion` calcolata dai parametri); v1.6.21: **Story 2.4 completata** (merge `40ad0b7`) e la catena dell'EPIC 2 dichiarata (4.1 → 2.1 → 2.2/2.3); v1.6.22: **spec dell'EPIC 4.1 ratificata** (`21` v1.0 🟢 APPROVED, issue #187) → #188 (Story 4.1, `agent-ready`); v1.6.23: **Story 2.1 implementata** (issue #180, PR #192: il mood di giorno, settimana e mese dalle audio features persistite); v1.6.24: **Story 2.1 completata** (merge `d018a26`); v1.6.25: **Story 4.1 implementata** (issue #188, PR #197: il pacchetto `packages/core/src/enrichment/` — cascata, provider, limiter, coda, stoccaggio, CSP e i18n); v1.6.26: **Story 4.1 completata** (merge `7458220`); v1.6.27: **ratifica del terzo host della CSP** (`21` v1.1 🟢 APPROVED, issue #196: D-AF.9 emendata, l'host della ricerca iTunes entra in `connect-src`) |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | 🟡 DRAFT | Sessione 67 (v1.2) | CI/CD, deploy, self-hosting — §9.8f gate "fatti del README" (issue #161); §9.10 elenco autorevole dei 18 step di `ci.yml`; §2.1 CSP con i **tre** host delle audio features (v1.1: anche l'host della ricerca iTunes, issue #196); §5.3 licenza **AGPL-3.0** e offerta del sorgente (§13, issue #202) |
| 13 | [`13-ADR/`](13-ADR/) | 🟢 APPROVED | Sessione 56 (0001-0011) | Architecture Decision Records (0001-0003, 0005-0008 APPROVED; **0009 local IP geolocation APPROVED v1.0**; 0006 claim agenti, 0007 macchina a stati `status:*`, 0008 lazy-state aggregation, 0010 sorgenti remote nel contratto adapter APPROVED v1.0; **0011 contratto di scrittura negli hub `ScrobbleSink` APPROVED v1.0**) |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | 🟢 APPROVED | Sessione 62 (v1.1) | Glossario di dominio — v1.1: la voce `Audio features` (misurata / derivata / stimata) |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | 🟡 DRAFT | Sessione 9 | Design system completo |
| 16 | [`16-OPERATIONS.md`](16-OPERATIONS.md) | 🟢 APPROVED | Sessione 53 (Story 1.4) | Runbook operativo: update management (`05§11`) + manutenzione DB (`05§12`); §2.3 API `@ls/core/db` con il report esteso di `rekey()` |
| 19 | [`19-GEO-CONTEXT.md`](19-GEO-CONTEXT.md) | 🟢 APPROVED | Sessione 67 (v1.0) | Geo & contesto di ascolto: L0 paese / L1 contesto dedotto (casa, lavoro, viaggio) / L2 città stimata, toggle per-campo con override per import, nastro contesto — **ratificata** (Sessione 67, issue #201): i 3 punti aperti chiusi (DB geo **on-demand** D-B.2, soglie come **costanti misurabili** D-B.3, `retainCountry` già deciso con l'issue #108), gli edge case geo rinumerati **E19..E24** (E11..E18 erano già presi in `01-PLATFORMS.md` §5) e la revoca di D.39.8 applicata a `03-ADAPTERS/youtube-music.md` §7 |
| 20 | [`20-SCROBBLING-HUB.md`](20-SCROBBLING-HUB.md) | 🟢 APPROVED | Sessione 57 (v1.0) | **Scrobbling hub (Story 1.5)**: protocollo di *scrittura* verso Last.fm e ListenBrainz — contratto `ScrobbleSink`, coda `scrobbleOutbox` (Dexie v5), consenso per-hub `scrobbleHubs`, rate limit per-hub, sync continua a cursore (issue #164); **ratificata** (Sessione 57, issue #172): le 4 decisioni aperte chiuse (D-SH.11…D-SH.14) → issue di implementazione **#173** |
| 21 | [`21-AUDIO-FEATURES.md`](21-AUDIO-FEATURES.md) | 🟢 APPROVED | Sessione 66 (v1.1) | **Pipeline audio features (Story 4.1)**: contratto `AudioFeatureProvider`, cascata cache → Essentia.js (WASM) → AcousticBrainz → euristico, mappatura dei campi `AudioFeatures` (misurata / derivata / stimata), normalizzazione DEAM [1,9] → [0,1], privacy e CSP, stoccaggio e invalidazione, costi reali misurati — **ratificata** (Sessione 62, issue #187, PR #190 `b1dd83e`): le 9 decisioni D-AF.1…D-AF.9 sono chiuse come proposte → issue di implementazione **#188** (`agent-ready`); **v1.1** (Sessione 66, issue #196): **D-AF.9 emendata**, la CSP ammette anche l'host della **ricerca** iTunes (senza il quale D-AF.1 non è applicabile) |

## Documenti di supporto
| File | Stato | Descrizione |
|------|-------|-------------|
| [`state/`](state/_index.md) | 🟢 LIVE | **Sorgenti atomiche di stato** (sessioni + story) — unica fonte di verità per i blocchi aggregati (ADR-0008, Sessione 25) |
| [`SESSIONS.md`](SESSIONS.md) | 🟢 LIVE | Log di tutte le sessioni (progettazione + implementazione) |
| [`BUNDLE.md`](BUNDLE.md) | 🟢 SNAPSHOT | Snapshot completo del progetto per handoff AI |
| [`../AGENTS.md`](../AGENTS.md) | 🟢 v1.27 | Protocollo per agenti (Sessione 54: ownership del `README.md` — due owner, due regole, un gate read-only; issue #161; Sessione 47: i due writer di `main` serializzati ma non ordinati, issue #149; Sessione 38: ownership *blocchi aggregati vs sezioni legacy*, keyword di chiusura `Closes #N`; Sessione 35: automazioni post-merge; Sessione 34: determinismo aggregator; Sessione 33: procedura canonica post-merge; Sessione 27: worktree come default; Sessione 21: catena doc-sync + GH Action; Sessione 19: macchina a stati `status:*` [ADR-0007]; Sessione 18: claim [ADR-0006]) |
| [`../LICENSE`](../LICENSE) | 🟢 AGPL-3.0 | Licenza del progetto (D-AF.2, `21` §2.4 — ratificata dal project owner il 2026-10-30, issue #201) |
| [`AUDIT-2026-10-15.md`](AUDIT-2026-10-15.md) | 🟢 LIVE | Audit completo di documentazione e decisioni |
| [`17-DEV-NOTES.md`](17-DEV-NOTES.md) | 🟡 DRAFT v0.2 | Note di sviluppo: comandi, struttura monorepo, pitfalls toolchain consolidati |
| [`18-DEV-LOG.md`](18-DEV-LOG.md) | 🟡 DRAFT v2.7 | Diario cronologico per story: problemi, fix, lesson learned — §25: ratifica della spec dell'analisi (issue #178) |

## Design & mockup
| Cartella | Contenuto |
|----------|-----------|
| [`../design/mockups/`](../design/mockups/) | Mockup schermate (PNG storiche) |
| [`../design/tokens.json`](../design/tokens.json) | 🟢 Design tokens per il codice (v0.2) |
| [`../design/assets/`](../design/assets/) | 🔴 (futuro) Logo, icone, illustrazioni vettoriali |

## Fixture di test
| Cartella | Contenuto |
|----------|-----------|
| [`../fixtures/synthetic-history/`](../fixtures/synthetic-history/) | Dataset di test per adapter (es. `spotify-sample.json` v1.1) |
| [`../fixtures/db-seed/`](../fixtures/db-seed/) | Dataset di seed DB per test (minimal 10, medium 5k, large 25k) — generati da `scripts/generate-fixtures.mjs` |
| [`../fixtures/scenarios/`](../fixtures/scenarios/) | Scenari di vita sintetici (lockdown-2020, breakup-oct2021, summer-roadtrip) — generati |
| [`../fixtures/demo-user.json`](../fixtures/demo-user.json) | Dataset demo per modalità "Scopri come funziona" (06-UX §2.14) |

## Roadmap Sessioni di Progettazione

<!-- AGGREGATE-INDEX-ROADMAP-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V2, ADR-0008, issue #52).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

| Sessione | Nome | Stato | Merged | PR |
|----------|------|-------|--------|----|
| 22 | 📱 Implementazione Story 0.5 (PWA e service worker) | 🟢 | ✅ | #19 |
| 23 | 🪝 Fix bug pre-commit hook (D3 staged-vs-unstaged, issue #20) | 🟢 | ✅ | #21 |
| 24 | 🌐 Implementazione Story 0.6 i18n setup (issue #5) | 🟢 | ✅ | #22 |
| 27 | Adozione worktree come default per agenti paralleli | 🟢 | ✅ | #54 |
| 28 | GitHub PR template + branch protection enforcement (forza gate CI per BUNDLE, state, Closes #N) | 🟢 | ✅ | #55 |
| 29 | ADR-0008 V2: estendere lazy-state aggregation a docs/INDEX.md e docs/BUNDLE.md | 🟢 | ✅ | #56 |
| 30 | Fix CRLF drift in aggregator + generate-bundle + workflow if:always (issue #58) | 🟢 | ✅ | #59 |
| 31 | AGENTS.md v1.9 cleanup completo del workflow (issue #60 + audit v1.9) | 🟢 | ✅ | #62 |
| 32 | Cleanup cumulativo issue needs-spec non-Story (#41, #45, #47) — verifica obsolescenza | 🟢 | ✅ | #63 |
| 33 | Procedura canonica post-merge (review: mancava l'aggiornamento di `main` prima del delete branch) | 🟢 | ✅ | #69 |
| 34 | Determinismo e idempotenza dell'aggregator (issue #70): 5 cause + gate bloccante | 🟢 | ✅ | #72 |
| 35 | Automazioni post-merge: chiude i buchi di auto-status-done, release e cleanup (issue #73) | 🟢 | ✅ | #74 |
| 36 | Residui post-merge: rilevare i branch locali orfani + fetch prima di creare la worktree (issue #76) | 🟢 | ✅ | #77 |
| 37 | Reconciliare docs/state/ con i merge reali (Story 0.4 assente, 0.7 stale, sessioni 27-36 pending) | 🟢 | ✅ | #85 |
| 38 | Allineare la documentazione di stato legacy e rendere il doc-sync obbligatorio per gli agenti | 🟢 | ✅ | #91 |
| 39 | Specifica adapter YouTube Music (Story 1.1) | 🟢 | ✅ | #97 |
| 40 | Specifica adapter Apple Music (Story 1.2) | 🟢 | ✅ | #100 |
| 41 | Geo & contesto di ascolto: specifica e ADR | 🟢 | ✅ | #102 |
| 42 | Approvazione spec Apple Music (Story 1.2) | 🟢 | ❌ | #134 |
| 43 | auto-state-aggregate committa il blocco NEXT-STEP del README (issue #136) | 🟢 | ❌ | #137 |
| 44 | ci.yml non esegue piu' nessun job: `metadata: read` non e' una scope dichiarabile (issue #135) | 🟢 | ❌ | #138 |
| 45 | auto-state-aggregate fallisce con `non-fast-forward`: il doc-sync della Story 1.2 resta fuori da `main` (issue #140) | 🟢 | ❌ | #141 |
| 46 | Idempotenza dell'aggregator non implementata nel path di scrittura: T3 falliva a intermittenza (issue #142) | 🟢 | ❌ | #143 |
| 47 | Spec adapter ListenBrainz + Last.fm (Story 1.3) | 🟢 | ✅ | #146 |
| 48 | Fix race fra i due writer di main (issue #149) | 🟡 | ❌ | #null |
| 49 | ADR-0010 — Sorgenti remote nel contratto degli adapter | 🟢 | ✅ | #152 |
| 50 | Spec adapter Last.fm (Story 1.3) | 🟢 | ✅ | #154 |
| 51 | Promozione spec Last.fm a APPROVED v1.0 + issue di implementazione 1.3 | 🟢 | ✅ | #156 |
| 52 | Implementazione Story 1.3 (adapter Last.fm + ListenBrainz) | 🟢 | ✅ | #158 |
| 53 | Story 1.4 — rekey(): promozione dedup post-enrichment | 🟢 | ✅ | #162 |
| 54 | Gate \"fatti del README\" — la prosa confrontata con il codice (issue #161) | 🟢 | ✅ | #165 |
| 55 | Spec Story 1.5 — Scrobbling hub (invio, sync continua, toggle) | 🟢 | ✅ | #167 |
| 56 | ADR-0011 — contratto di scrittura negli hub (ScrobbleSink) | 🟢 | ✅ | #170 |
| 57 | Ratifica della spec Scrobbling hub + issue di implementazione (Story 1.5) | 🟢 | ✅ | #174 |
| 58 | Story 1.5 - scrobbling hub: contratto, coda, sink, UI e sync | 🟢 | ✅ | #176 |
| 59 | Ratifica della spec dell'analisi (04-ANALYSIS-ALGORITHMS.md) e apertura delle story 2.4 / 2.1 | 🟢 | ✅ | #181 |
| 60 | Il blocco NEXT-STEP indica solo story lavorabili (issue #182) | 🟢 | ✅ | #183 |
| 61 | Story 2.4 — Memory Engine: i 5 tipi di ricordo e il feed per rilevanza (issue #179) | 🟢 | ✅ | #185 |
| 62 | Spec dell'EPIC 4.1 — pipeline audio features: provider, privacy, stoccaggio, costi (issue #187) | 🟢 | ✅ | #190 |
| 63 | Story 2.1 — Mood Tracker: il mood di giorno, settimana e mese (issue #180) | 🟢 | ✅ | #192 |
| 64 | Story 4.1 — Pipeline audio features: provider, privacy, stoccaggio, costi (issue #188) | 🟢 | ✅ | #197 |
| 65 | Ratifica del fallback mood-by-genre: il fallback non esiste (issue #193) | 🟡 | ❌ | #203 |
| 66 | Ratifica del terzo host della CSP (issue #196): D-AF.1 e D-AF.9 erano incompatibili | 🟡 | ❌ | - |
| 67 | Atti del Boss: ratifica di 19-GEO-CONTEXT + ADR-0009 e licenza AGPL-3.0 (issue #201) | 👀 | ❌ | - |
| 68 | Story 1.6 — Fondazione geo e contesto di ascolto (delta su 02 v1.7 e classificatore L1) (issue #205) | 👀 | ❌ | - |

> Per le sessioni 0-21 (legacy, pre ADR-0008), vedi `docs/SESSIONS.md` legacy fino alla migration V2.1.

<!-- AGGREGATE-INDEX-ROADMAP-END -->

### Sessioni legacy 0-21 (pre ADR-0008)

| Sessione | Nome | Stato |
|----------|------|-------|
| 0 | 🔒 Consolidamento + Bootstrap | ✅ COMPLETATA |
| 1 | 🗄️ Fondamenta dati | ✅ COMPLETATA (APPROVED) |
| 2 | 🔌 Primo adapter (Spotify) | ✅ COMPLETATA (APPROVED) |
| 3 | 📋 Governo (backlog + testing + AGENTS) | ✅ COMPLETATA (APPROVED) |
| 4 | 🧠 Analisi algoritmica | ✅ COMPLETATA |
| 5 | 🧭 UX completa + i18n | ✅ COMPLETATA |
| 6 | 🔐 Privacy & legale | ✅ COMPLETATA |
| 7 | 🎨 UI eseguibile + tokens | ✅ COMPLETATA |
| 8 | ⚙️ DevOps | ✅ COMPLETATA |
| 9 | 🩺 Audit + allineamento post-sessione | ✅ COMPLETATA |
| 10 | 🔄 Policy versioni toolchain (mini) | ✅ COMPLETATA |
| 11 | 🛠️ Implementazione Story 0.1 (scaffold monorepo) | ✅ COMPLETATA |
| 12 | 📚 Doc-sync post-merge (gate AGENTS.md) | ✅ COMPLETATA |
| 13 | 🔧 Consolidamento documentazione pre-Fase 0 | ✅ COMPLETATA |
| 14 | 🗄️ Implementazione Story 0.2 (schema DB e layer Dexie) | ✅ COMPLETATA |
| 17 | 🧹 Governance post-merge (cleanup + parallelismo) | ✅ COMPLETATA |
| 18 | 🎫 Protocollo claim per agenti paralleli (ADR-0006) | ✅ COMPLETATA |
| 19 | 📦 Macchina di stati delle issue (status:* post-claim — ADR-0007) | ✅ COMPLETATA |
| 20 | 🛡️ Hardening multi-agente (push early + pre-commit hook + session checklist) | ✅ COMPLETATA |
| 21 | 🔗 Refactor catena multi-agente (doc-sync IN PR + auto-status:done + hook extensions) | ✅ COMPLETATA |

> Migration V2.1 (issue future): le sessioni legacy 0-21 verranno migrate in `docs/state/sessions/` per essere incluse nel blocco aggregator. Fino ad allora, le entry legacy restano in questa tabella statica.

## Stato del progetto

<!-- AGGREGATE-INDEX-STATUS-START -->

> Blocco auto-generato da `scripts/aggregate-state.ps1` (V2, ADR-0008, issue #52).
> Rigenerare con `pwsh scripts/aggregate-state.ps1`. NON editare a mano.

- Sessioni migrate in state/sessions: **45** (merge: 35)
- Stories migrate in state/stories: **20** (done: 15)
- Ultima sessione migrata: **S68** - Story 1.6 — Fondazione geo e contesto di ascolto (delta su 02 v1.7 e classificatore L1) (issue #205)
- Stories done: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.4, 4.1

> Per il dettaglio completo (incluse sessioni legacy 0-21), vedi sezione "Stato del progetto (legacy)" sotto questo blocco.

<!-- AGGREGATE-INDEX-STATUS-END -->

### Dettaglio (legacy — allineato alla Sessione 38, issue #90)

> **Questa sezione è legacy ma NON è aggregata**: a differenza dei blocchi `<!-- AGGREGATE-* -->` sopra, nessun script la rigenera. È quindi **responsabilità dell'agente** allinearla nella stessa PR che cambia i fatti che dichiara (vedi `AGENTS.md` §"Chi può scrivere cosa nei file globali"). Non duplicare qui informazioni già presenti in un blocco aggregato: generi solo drift.

- **Documenti APPROVED**: 11 documenti (`02` v1.7, `03-ADAPTERS/`, `04` v1.0, `05` v1.4, `10` v1.1, `11` v1.6.30, `14` v1.1, `16-OPERATIONS`, `19` v1.0, `20` v1.0, `21` v1.2) + 10 ADR in `13-ADR/` (0001-0003, 0005-0009, 0010, 0011)
- **Documenti DRAFT**: 10 (`00`, `01`, `06`, `07`, `08`, `09`, `12`, `15`, `17`, `18`) — il Boss ha deciso in S13 di non promuoverli (D.13.8); `08` ora v0.9, `09` ora v0.7, `12` ora v1.2, `17` ora v0.3, `18` ora v2.20; **`19` promosso a 🟢 APPROVED v1.0** nella Sessione 67 (issue #201) e **uscito da questo elenco**, come l'**ADR-0009** (v1.0 🟢); `04` **promosso a 🟢 APPROVED v1.0** nella Sessione 59 (issue #178); `20` **promosso a 🟢 APPROVED v1.0** nella Sessione 57 (issue #172) e uscito da questo elenco; `21` **promosso a 🟢 APPROVED v1.0** nella Sessione 62 (issue #187) e uscito da questo elenco
- **Documenti TODO**: 0
- **Licenza**: **AGPL-3.0** (D-AF.2, `21` §2.4 — ratificata dal project owner il 2026-10-30, issue #201; l'obbligo del §13, offerta del sorgente agli utenti in rete, è il requisito aperto dell'issue **#202**)
- **Business model**: Open-source puro, no monetizzazione
- **Implementazione**: 🟢 **Fase 0 tecnica completa: 7/7 story merged** — 0.1 scaffold (PR #2 `c0fb0a4`) · 0.2 schema DB Dexie (PR #4 `fa09b06`) · 0.3 adapter Spotify (PR #28 `3dc9654`) · 0.4 UI import onboarding (PR #71 `0a8e83f`) · 0.5 PWA e service worker (PR #19 `3fa3c0d`) · 0.6 i18n (PR #22 `5235c88`) · 0.7 operations runbook (PR #64 `b44420b`). Dettaglio per story in `docs/state/stories/` (fonte di verità) e `docs/18-DEV-LOG.md`.
- **Sessione 13** — consolidamento doc **merged in `main`** (PR #3, merge commit `10ecde5`, 2026-10-16): chiusi M13 (PlatformCard 5 stati), M5 (`artworkUrl` in 02 v1.2 + Story 4.3), C6 (fixture Spotify v1.1), V1 (7 fixture + `scripts/generate-fixtures.mjs`); allineata Story 2.2 AC. Gate D.12.1 post-merge applicato senza drift (`18-DEV-LOG.md §5`).
- **Sessione 17** — governance post-merge **merged in `main`** (PR #8, merge commit `a9f31a3`, 2026-10-17, follow-up bundle `e514404`): `AGENTS.md` **v1.2** con §"♻️ Pulizia branch post-merge" obbligatoria + auto-check; **branch remoti stale eliminati** (`origin/feat/0.2-dexie-schema`, `origin/feat/0.2-schema-db-dexie` → zero branch remoti oltre a `main`); **label GitHub di progetto creati** (`agent-ready`, `needs-spec`, `docs`, `phase-0`, `area:*`, `priority:*`, `size:*`); **3 issue `agent-ready` aperte** per il lavoro parallelo della Fase 0: #5 (Story 0.6 i18n), #6 (Story 0.3 Adapter Spotify), #7 (Story 0.5 PWA); follow-up #9 (questo sync) e #10 (bundle-check, `needs-spec`).
- **Sessione 18** — protocollo claim (ADR-0006) **merged in `main`** (PR #12, merge commit `2891cb5`, 2026-10-17): `AGENTS.md` **v1.3** con §"🎫 Presa in carico delle story (claim)" (procedura `gh` completa: claim, riverifica, yield, stale-release, release) + §"🚀 Primo task" riscritta claim-first + label `in-progress` in tabella + PAT esteso a `issues: read/write`; `11-BACKLOG.md` **v1.3.0** con §"Priorità di lavorazione" ora claim-first; `docs/13-ADR/0006-multi-agent-task-claiming.md` 🟢 APPROVED v1.0 (8 regole, alternative considerate, conseguenze); gate D.12.1 applicato senza drift, branch `feat/11-task-claiming-protocol` eliminato (policy §♻️).
- **Sessione 19** — macchina a stati post-claim (ADR-0007) **merged in `main`** (PR #14, merge commit `a500ea2`, 2026-10-17T15:03:21Z): `AGENTS.md` **v1.4** con nuova §"📦 Macchina a stati delle issue (status:*)" (estensione di §"🎫 Presa in carico delle story") + tabella label estesa + campo `Closes #N` reso obbligatorio nella checklist PR; `11-BACKLOG.md` **v1.4.0** con §"Stato di una Story" estesa (4 stati `status:*` + nota mutua esclusione `agent-ready` ∩ `status:*` = ∅); `docs/13-ADR/0007-issue-state-machine.md` 🟢 APPROVED v1.0 (macchina a stati completa, transizioni, `jq` per query candidati, pattern `Closes #N`); 4 label `status:*` create su GitHub (`done` / `in-review` / `wontdo` / `blocked-other`); issue #11 chiusa come completed (rimossa `agent-ready`, era rimasta `OPEN` nonostante `PR #12` mergata — sintomo esatto che ADR-0007 previene); issue #9 rivalutata (rimossa `agent-ready` + `in-progress`, aggiunta `status:done`, chiusa); `scripts/generate-bundle.ps1` `$files` include ADR-0007; BUNDLE rigenerato. **Esito post-merge**: branch `feat/13-issue-state-machine` eliminato (policy §♻️); claim `kilo-HP-ELITEBOOK-jm9f` rilasciato su #13 con `status:done` applicato; issue #13 chiusa via `Closes #13` (auto-close GitHub). Gate D.12.1 applicato.
- **Sessione 20** — hardening multi-agente (push early + pre-commit hook + session checklist) **merged in `main`** (PR #16, merge commit `506c86a`, 2026-10-17T15:24:31Z): `AGENTS.md` **v1.5** con push early obbligatorio in §"🌳 Git workflow" + nuove §"🛡️ Session start checklist" (4 comandi obbligatori) e §"🪝 Pre-commit hook" (setup + bypass); `.githooks/pre-commit` (nuovo script bash committato, verifica pattern branch) + `scripts/setup-hooks.js` (nuovo Node ESM idempotente) + `package.json` con `postinstall` automatico; 3 difese a basso costo coprono 5 failure mode (F1 commit su main, F2 branch invisibile, F4 base stale, F6 collision, F7 commit post-merge); NO worktree (Boss scelta C, F3 file conflict e F5 stash collision non mitigati direttamente, documentati come limiti noti). 4 lesson learned in 18-DEV-LOG §9.
- **Sessione 21** — refactor catena multi-agente (doc-sync IN PR + auto-status:done + hook extensions) **merged in `main`** (PR #18, merge commit `6c0f79b`, 2026-10-17T18:00:26Z): `AGENTS.md` **v1.6** con nuova §"📤 Post-merge actions" (post-merge solo issue-level, no commit su main) + §"🚀 Primo task" step 6 semplificato (GH Action applica status:done) + §"Checklist di sincronizzazione" aggiornata (doc-sync preferito IN PR, "follow-up" declassato); `.github/workflows/auto-status-done.yml` (**nuovo**, D2) + `.githooks/pre-push` (**nuovo**, D4+D5) + `.githooks/pre-commit` esteso (D3 working tree clean check). Race condition al punto 8 (doc-sync post-merge su `main`) eliminato. 4 lesson learned in 18-DEV-LOG §10. 6 decisioni (D.21.1-D.21.6) in SESSIONS.md Sessione 21.
- **Sessione 22** — implementazione Story 0.5 PWA: `vite-plugin-pwa@^2.0.0` (Workbox config); manifest inline (4 icone PNG generate deterministically da `scripts/generate-pwa-icons.mjs` zero deps); strategy precache 12 entries + NetworkFirst `/version.json` + CacheFirst Google Fonts; `useAppUpdate()` hook + `<UpdateBanner>` componente con prompt policy patch/minor/major (CTA bloccante per major); PR #19 aperta su #7 (claim `kilo-HP-ELITEBOOK-3b3f`). **Stato (2026-10-18T15:09Z)**: PR #19 cherry-pick + merge di main con S23+S24; conflitti doc risolti, mancano solo 1-2 commit di cherry-pick + Story 0.5 renumber.
- **Sessione 23** — fix bug pre-commit hook (issue #20, claim `kilo-HP-ELITEBOOK-hc0f`): il check D3 introdotto in S21 verificava `git diff HEAD` (working tree + staged) invece di `git diff` (unstaged-only), bloccando ogni commit normale; fix in `.githooks/pre-commit` con check unstaged (`git diff --quiet`) + untracked (`git ls-files --others --exclude-standard`); test `scripts/test-pre-commit-clean-check.sh` con 8 scenari tutti passati. **Esito post-merge**: PR #21 mergata `8a48e24e8c9d03c7272d1daa0e6d914b0a610f40` (2026-10-18T09:54:10Z, squash da `c81a1c2`), branch eliminata, claim rilasciato, GH Action `auto-status-done` applicato `status:done` a #20. Smoke-test reale: `git commit` con sole staged changes passa senza `--no-verify`.
- **Sessione 24** — implementazione Story 0.6 i18n (issue #5, PR #22 merged `5235c88` 2026-10-18T17:02Z +0200, claim `kilo-HP-ELITEBOOK-7051`): `i18next@^26.5.2` + `react-i18next@^17.1.0` (`apps/web/package.json`); componente `<T>` + hook `useT()` in `apps/web/src/i18n/` + `formatter.ts` (ICU pluralizzazione) + `detector.ts` (localStorage→browser); IT/EN locales con 185+185 voci in `apps/web/src/i18n/locales/{it,en}.json`; test 8/8 in `apps/web/src/__tests__/{formatter,i18n-react,i18n}.test.{ts,tsx}`; wire-up in `apps/web/src/main.tsx`. Branch `feat/5-i18n-setup` eliminata, GH Action `auto-status-done` applicata `status:done` a #5.
- **Prossimo passo tecnico** (aggiornato alla Sessione 68, issue #205): la **Story 1.6 (fondazione geo e contesto di ascolto) è implementata e in review** — il delta su `02` v1.7 (campi `city*`, entità `ContextPeriod`, tabella `contexts` nello schema Dexie v6, toggle `retainCountry`/`retainCity`/`retainDeviceType`/`retainDeviceDetail`/`deriveContext`) e il **classificatore L1** in `packages/core/src/context/` (regole R1..R7, soglia 0.5, `derivedVersion` dai parametri) con la persistenza dei periodi e il fixture di scenario geo. **EPIC 1 — Import core: 5/5 ✅** e tre story dell'EPIC 2/4 completate: la **2.4 (Memory Engine)** (issue **#179**, merge `40ad0b7`), la **2.1 (Mood Tracker)** (issue **#180**, merge `d018a26`, Sessione 63) e la **4.1 (Pipeline audio features)** (issue **#188**, merge `7458220`, Sessione 64): la catena **4.1 (dati) → 2.1 (letture)** è chiusa. **Prossimo passo**: chiudere la review della **1.6** e poi la tranche **geo** — **4.4** (DB IP→città, on-demand, `[DEP:1.6]`) e **3.4** (nastro contesto, `[DEP:1.6, 4.4]`), entrambe con la specifica già ratificata (`19` v1.0 🟢, ADR-0009 v1.0 🟢, Sessione 67, issue #201). Dietro di loro: le **2.2 (Era Detector)** e **2.3 (Event Detector)**, che hanno la dipendenza `[DEP:2.1]` soddisfatta e le AC specificate in `04` (v1.0 🟢 APPROVED), poi la tranche dell'EPIC 3 (**UI**) e il **lookup MusicBrainz** (Story 4.2). L2 è il «condimento»: `retainCity` è **opt-in** e L0/L1 reggono da sole. Fuori perimetro e dichiarato nella 1.6: la **UI dei toggle** (Story 3.x) e la **derivazione L2** (Story 4.4).

---
*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*
