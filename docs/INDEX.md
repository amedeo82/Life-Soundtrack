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
| 01 | [`01-PLATFORMS.md`](01-PLATFORMS.md) | 🟡 DRAFT | Sessione 9 | Matrice piattaforme europee + campi dati |
| 02 | [`02-DATA-SCHEMA.md`](02-DATA-SCHEMA.md) | 🟢 APPROVED | Sessione 13 (v1.2) | Schema dati unificato (TypeScript + Dexie) — v1.2: `artworkUrl` su Track/Album (§11 cascata fonti) |
| 03 | [`03-ADAPTERS/`](03-ADAPTERS/) | 🟢 APPROVED | Sessione 2 | SPEC-TEMPLATE + Spotify (altri TBD) |
| 04 | [`04-ANALYSIS-ALGORITHMS.md`](04-ANALYSIS-ALGORITHMS.md) | 🟡 DRAFT | Sessione 9 | Algoritmi di analisi (mood, ere, eventi, ricordi) |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | 🟢 APPROVED | Sessione 9 (v1.0) | Architettura tecnica generale |
| 06 | [`06-UX-FLOWS-STATES.md`](06-UX-FLOWS-STATES.md) | 🟡 DRAFT | Sessione 9 | Flussi UX e stati per schermata |
| 07 | [`07-UI-SPEC.md`](07-UI-SPEC.md) | 🟡 DRAFT | Sessione 7 | Specifiche UI componenti |
| 08 | [`08-COPY-I18N.md`](08-COPY-I18N.md) | 🟡 DRAFT | Sessione 9 (v0.2) | Tutte le stringhe UI con chiavi i18n |
| 09 | [`09-PRIVACY-SECURITY.md`](09-PRIVACY-SECURITY.md) | 🟡 DRAFT | Sessione 6 | Privacy spec, data flow, security |
| 10 | [`10-TESTING.md`](10-TESTING.md) | 🟢 APPROVED | Sessione 3 | Strategia di testing |
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | 🟢 APPROVED | Sessione 38 (v1.6.0) | Backlog strutturato (epic → story → task) — stato delle story completate nel blocco `AGGREGATE-STORIES-*` (ADR-0008); v1.6.0: tabella legacy allineata, fonte di verità unica |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | 🟡 DRAFT | Sessione 9 (v0.2) | CI/CD, deploy, self-hosting |
| 13 | [`13-ADR/`](13-ADR/) | 🟢 APPROVED | Sessione 29 (0001-0008) | Architecture Decision Records (0001-0003, 0005-0008; 0006 claim agenti, 0007 macchina a stati `status:*`, 0008 lazy-state aggregation) |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | 🟢 APPROVED | Sessione 1 | Glossario di dominio |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | 🟡 DRAFT | Sessione 9 | Design system completo |
| 16 | [`16-OPERATIONS.md`](16-OPERATIONS.md) | 🟢 APPROVED | Sessione 37 (Story 0.7, PR #64) | Runbook operativo: update management (`05§11`) + manutenzione DB (`05§12`) |

## Documenti di supporto
| File | Stato | Descrizione |
|------|-------|-------------|
| [`state/`](state/_index.md) | 🟢 LIVE | **Sorgenti atomiche di stato** (sessioni + story) — unica fonte di verità per i blocchi aggregati (ADR-0008, Sessione 25) |
| [`SESSIONS.md`](SESSIONS.md) | 🟢 LIVE | Log di tutte le sessioni (progettazione + implementazione) |
| [`BUNDLE.md`](BUNDLE.md) | 🟢 SNAPSHOT | Snapshot completo del progetto per handoff AI |
| [`../AGENTS.md`](../AGENTS.md) | 🟢 v1.18 | Protocollo per agenti (Sessione 38: ownership *blocchi aggregati vs sezioni legacy*, keyword di chiusura `Closes #N`; Sessione 35: automazioni post-merge; Sessione 34: determinismo aggregator; Sessione 33: procedura canonica post-merge; Sessione 27: worktree come default; Sessione 21: catena doc-sync + GH Action; Sessione 19: macchina a stati `status:*` [ADR-0007]; Sessione 18: claim [ADR-0006]) |
| [`../LICENSE`](../LICENSE) | 🟢 Apache-2.0 | Licenza del progetto (D.A.10) |
| [`AUDIT-2026-10-15.md`](AUDIT-2026-10-15.md) | 🟢 LIVE | Audit completo di documentazione e decisioni |
| [`17-DEV-NOTES.md`](17-DEV-NOTES.md) | 🟡 DRAFT v0.2 | Note di sviluppo: comandi, struttura monorepo, pitfalls toolchain consolidati |
| [`18-DEV-LOG.md`](18-DEV-LOG.md) | 🟡 DRAFT v0.6 | Diario cronologico per story: problemi, fix, lesson learned |

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

| Sessione | Nome | Stato | PR |
|----------|------|-------|----|
| 22 | 📱 Implementazione Story 0.5 (PWA e service worker) | 🟢 | #19 |
| 23 | 🪝 Fix bug pre-commit hook (D3 staged-vs-unstaged, issue #20) | 🟢 | #21 |
| 24 | 🌐 Implementazione Story 0.6 i18n setup (issue #5) | 🟢 | #22 |
| 27 | Adozione worktree come default per agenti paralleli | 🟢 | #54 |
| 28 | GitHub PR template + branch protection enforcement (forza gate CI per BUNDLE, state, Closes #N) | 🟢 | #55 |
| 29 | ADR-0008 V2: estendere lazy-state aggregation a docs/INDEX.md e docs/BUNDLE.md | 🟢 | #56 |
| 30 | Fix CRLF drift in aggregator + generate-bundle + workflow if:always (issue #58) | 🟢 | #59 |
| 31 | AGENTS.md v1.9 cleanup completo del workflow (issue #60 + audit v1.9) | 🟢 | #62 |
| 32 | Cleanup cumulativo issue needs-spec non-Story (#41, #45, #47) — verifica obsolescenza | 🟢 | #63 |
| 33 | Procedura canonica post-merge (review: mancava l'aggiornamento di `main` prima del delete branch) | 🟢 | #69 |
| 34 | Determinismo e idempotenza dell'aggregator (issue #70): 5 cause + gate bloccante | 🟢 | #72 |
| 35 | Automazioni post-merge: chiude i buchi di auto-status-done, release e cleanup (issue #73) | 🟢 | #74 |
| 36 | Residui post-merge: rilevare i branch locali orfani + fetch prima di creare la worktree (issue #76) | 🟢 | #77 |
| 37 | Reconciliare docs/state/ con i merge reali (Story 0.4 assente, 0.7 stale, sessioni 27-36 pending) | 🟡 | #85 |
| 38 | Allineare la documentazione di stato legacy e rendere il doc-sync obbligatorio per gli agenti | 🟡 | #91 |

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

- Sessioni migrate in state/sessions: **15**
- Stories migrate in state/stories: **5** (done: 5)
- Ultima sessione migrata: **S38** - Allineare la documentazione di stato legacy e rendere il doc-sync obbligatorio per gli agenti
- Stories done: 0.3, 0.4, 0.5, 0.6, 0.7

> Per il dettaglio completo (incluse sessioni legacy 0-21), vedi sezione "Stato del progetto (legacy)" sotto questo blocco.

<!-- AGGREGATE-INDEX-STATUS-END -->

### Dettaglio (legacy — allineato alla Sessione 38, issue #90)

> **Questa sezione è legacy ma NON è aggregata**: a differenza dei blocchi `<!-- AGGREGATE-* -->` sopra, nessun script la rigenera. È quindi **responsabilità dell'agente** allinearla nella stessa PR che cambia i fatti che dichiara (vedi `AGENTS.md` §"Chi può scrivere cosa nei file globali"). Non duplicare qui informazioni già presenti in un blocco aggregato: generi solo drift.

- **Documenti APPROVED**: 7 documenti (`02` v1.2, `03-ADAPTERS/`, `05` v1.0, `10`, `11` v1.6.0, `14`, `16-OPERATIONS`) + 7 ADR in `13-ADR/` (0001-0003, 0005-0008)
- **Documenti DRAFT**: 11 (`00`, `01`, `04`, `06`, `07`, `08`, `09`, `12`, `15`, `17`, `18`) — il Boss ha deciso in S13 di non promuoverli (D.13.8); `17` ora v0.2, `18` ora v0.6
- **Documenti TODO**: 0
- **Licenza**: Apache-2.0
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
- **Prossimo step tecnico** (aggiornato alla Sessione 38): la Fase 0 è chiusa e non ci sono issue aperte su GitHub. Il prossimo blocco è la **Fase 1 (EPIC 1 — Import core)**, bloccata su un prerequisito di specifica: le Story 1.1 (YouTube Music), 1.2 (Apple Music) e 1.3 (Last.fm + ListenBrainz) possono diventare `agent-ready` solo dopo aver scritto e approvato le rispettive specifiche adapter in `docs/03-ADAPTERS/` (oggi contiene solo `SPEC-TEMPLATE.md` e `spotify.md`; `01-PLATFORMS.md` è ancora 🟡 DRAFT). Ordine: (1) spec adapter YouTube Music + Apple Music + Last.fm/ListenBrainz, (2) fixture in `fixtures/synthetic-history/` per i nuovi adapter, (3) issue `agent-ready` per 1.1/1.2/1.3 (parallele). Nel frattempo sono eseguibili la Story 1.4 (dedup promozione, spec `02-DATA-SCHEMA.md` §5-6 🟢 APPROVED) e la Story 1.5 (scrobbling hub).

---
*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*
