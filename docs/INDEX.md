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
| 00 | [`00-VISION.md`](00-VISION.md) | 🟡 DRAFT | Sessione 0 | Visione, missione, target, principi |
| 01 | [`01-PLATFORMS.md`](01-PLATFORMS.md) | 🟡 DRAFT | Sessione 0 | Matrice piattaforme europee + campi dati |
| 02 | [`02-DATA-SCHEMA.md`](02-DATA-SCHEMA.md) | 🟢 APPROVED | Sessione 1 | Schema dati unificato (TypeScript + Dexie) |
| 03 | [`03-ADAPTERS/`](03-ADAPTERS/) | 🟢 APPROVED | Sessione 2 | SPEC-TEMPLATE + Spotify (altri TBD) |
| 04 | [`04-ANALYSIS-ALGORITHMS.md`](04-ANALYSIS-ALGORITHMS.md) | 🟡 DRAFT | Sessione 4 | Algoritmi di analisi (mood, ere, eventi, ricordi) |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | 🟡 DRAFT | Sessione 0 | Architettura tecnica generale |
| 06 | [`06-UX-FLOWS-STATES.md`](06-UX-FLOWS-STATES.md) | 🟡 DRAFT | Sessione 5 | Flussi UX e stati per schermata |
| 07 | [`07-UI-SPEC.md`](07-UI-SPEC.md) | 🟡 DRAFT | Sessione 7 | Specifiche UI componenti |
| 08 | [`08-COPY-I18N.md`](08-COPY-I18N.md) | 🟡 DRAFT | Sessione 5 | Tutte le stringhe UI con chiavi i18n |
| 09 | [`09-PRIVACY-SECURITY.md`](09-PRIVACY-SECURITY.md) | 🟡 DRAFT | Sessione 6 | Privacy spec, data flow, security |
| 10 | [`10-TESTING.md`](10-TESTING.md) | 🟢 APPROVED | Sessione 3 | Strategia di testing |
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | 🟢 APPROVED | Sessione 3 | Backlog strutturato (epic → story → task) |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | 🟡 DRAFT | Sessione 8 | CI/CD, deploy, self-hosting |
| 13 | [`13-ADR/`](13-ADR/) | 🟢 APPROVED | Sessione 1 | Architecture Decision Records (0001-0003) |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | 🟢 APPROVED | Sessione 1 | Glossario di dominio |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | 🟡 DRAFT | Sessione 0 | Design system completo |

## Documenti di supporto
| File | Stato | Descrizione |
|------|-------|-------------|
| [`SESSIONS.md`](SESSIONS.md) | 🟢 LIVE | Log di tutte le sessioni di progettazione |
| [`BUNDLE.md`](BUNDLE.md) | 🟢 SNAPSHOT | Backup completo del progetto |
| [`../AGENTS.md`](../AGENTS.md) | 🟢 v1.0 | Protocollo per agenti |

## Design & mockup
| Cartella | Contenuto |
|----------|-----------|
| [`../design/mockups/`](../design/mockups/) | Mockup schermate (PNG storiche) |
| [`../design/tokens.json`](../design/tokens.json) | 🟢 Design tokens per il codice |
| [`../design/assets/`](../design/assets/) | 🔴 (futuro) Logo, icone, illustrazioni vettoriali |

## Fixture di test
| Cartella | Contenuto |
|----------|-----------|
| [`../fixtures/synthetic-history/`](../fixtures/synthetic-history/) | Dataset di test sintetici per ogni adapter |

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

## Stato del progetto
- **Documenti APPROVED**: 9 (02, 03, 10, 11, 13-ADR×3, 14, AGENTS)
- **Documenti DRAFT**: 8 (00, 01, 04, 05, 06, 07, 08, 09, 12, 15)
- **Documenti TODO**: 0
- **Completamento progettazione**: 🎉 **100%**

---
*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*