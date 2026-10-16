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
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | 🟢 APPROVED | Sessione 13 (v1.2.3) | Backlog strutturato (epic → story → task) — v1.2.3: Story 0.4 PlatformCard 5 stati, Story 2.2 AC allineata, Story 4.3 Artwork enrichment |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | 🟡 DRAFT | Sessione 9 (v0.2) | CI/CD, deploy, self-hosting |
| 13 | [`13-ADR/`](13-ADR/) | 🟢 APPROVED | Sessione 9 | Architecture Decision Records (0001, 0002, 0003, 0005) |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | 🟢 APPROVED | Sessione 1 | Glossario di dominio |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | 🟡 DRAFT | Sessione 9 | Design system completo |

## Documenti di supporto
| File | Stato | Descrizione |
|------|-------|-------------|
| [`SESSIONS.md`](SESSIONS.md) | 🟢 LIVE | Log di tutte le sessioni (progettazione + implementazione) |
| [`BUNDLE.md`](BUNDLE.md) | 🟢 SNAPSHOT | Snapshot completo del progetto per handoff AI |
| [`../AGENTS.md`](../AGENTS.md) | 🟢 v1.1 | Protocollo per agenti |
| [`../LICENSE`](../LICENSE) | 🟢 Apache-2.0 | Licenza del progetto (D.A.10) |
| [`AUDIT-2026-10-15.md`](AUDIT-2026-10-15.md) | 🟢 LIVE | Audit completo di documentazione e decisioni |
| [`17-DEV-NOTES.md`](17-DEV-NOTES.md) | 🟡 DRAFT v0.1 | Note di sviluppo: comandi, struttura monorepo, pitfalls toolchain consolidati |
| [`18-DEV-LOG.md`](18-DEV-LOG.md) | 🟡 DRAFT v0.2 | Diario cronologico per story: problemi, fix, lesson learned |

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

## Stato del progetto (post-Sessione 14, 2026-10-16)
- **Documenti APPROVED**: 8 (02 **v1.2**, 03, **05 v1.0**, 10 **v1.1**, 11 **v1.2.4**, 13-ADR ×4, 14)
- **Documenti DRAFT**: 10 (00, 01, 04, 06, 07, 08, 09, 12, 15, 17, 18) — Boss ha deciso S13 di non promuoverli (D.13.8); 17 ora v0.2, 18 ora v0.5
- **Documenti TODO**: 0
- **Licenza**: Apache-2.0
- **Business model**: Open-source puro, no monetizzazione
- **Implementazione**: 🟡 **Fase 0 tecnica in corso** — Story 0.1 merged in `main` (PR #2, squash `c0fb0a4`); **Story 0.2 (schema DB e layer Dexie) implementata** su `feat/0.2-schema-db-dexie`: 5/5 task + 5/5 AC (coverage `db/` 100%, AC 10k eventi < 500ms), 5 problemi/lesson in `18-DEV-LOG.md` §6, pitfalls P6-P9 in `17-DEV-NOTES.md` §3.
- **Sessione 13** — consolidamento doc **merged in `main`** (PR #3, merge commit `10ecde5`, 2026-10-16): chiusi M13 (PlatformCard 5 stati), M5 (`artworkUrl` in 02 v1.2 + Story 4.3), C6 (fixture Spotify v1.1), V1 (7 fixture + `scripts/generate-fixtures.mjs`); allineata Story 2.2 AC. Gate D.12.1 post-merge applicato senza drift (`18-DEV-LOG.md §5`).
- **Prossimo step tecnico**: review/merge PR Story 0.2, poi **Story 0.3 (Adapter Spotify)** — sbloccata dal 0.2 — e in parallelo Story 0.5 (PWA) / 0.6 (i18n)

---
*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*