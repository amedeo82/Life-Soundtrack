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
| 02 | [`02-DATA-SCHEMA.md`](02-DATA-SCHEMA.md) | 🔴 TODO | — | Schema dati unificato (TypeScript + Dexie) |
| 03 | [`03-ADAPTERS/`](03-ADAPTERS/) | 🔴 TODO | — | Specifiche dei singoli adapter |
| 04 | [`04-ANALYSIS-ALGORITHMS.md`](04-ANALYSIS-ALGORITHMS.md) | 🔴 TODO | — | Algoritmi di analisi (mood, ere, eventi) |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | 🟡 DRAFT | Sessione 0 | Architettura tecnica generale |
| 06 | [`06-UX-FLOWS-STATES.md`](06-UX-FLOWS-STATES.md) | 🔴 TODO | — | Flussi UX e stati per schermata |
| 07 | [`07-UI-SPEC.md`](07-UI-SPEC.md) | 🔴 TODO | — | Specifiche UI componenti |
| 08 | [`08-COPY-I18N.md`](08-COPY-I18N.md) | 🔴 TODO | — | Tutte le stringhe UI con chiavi i18n |
| 09 | [`09-PRIVACY-SECURITY.md`](09-PRIVACY-SECURITY.md) | 🔴 TODO | — | Privacy spec, data flow, security |
| 10 | [`10-TESTING.md`](10-TESTING.md) | 🔴 TODO | — | Strategia di testing |
| 11 | [`11-BACKLOG.md`](11-BACKLOG.md) | 🔴 TODO | — | Backlog strutturato (epic → story → task) |
| 12 | [`12-DEVOPS.md`](12-DEVOPS.md) | 🔴 TODO | — | CI/CD, deploy, self-hosting |
| 13 | [`13-ADR/`](13-ADR/) | 🔴 TODO | — | Architecture Decision Records |
| 14 | [`14-GLOSSARY.md`](14-GLOSSARY.md) | 🔴 TODO | — | Glossario di dominio |
| 15 | [`15-DESIGN-SYSTEM.md`](15-DESIGN-SYSTEM.md) | 🟡 DRAFT | Sessione 0 | Design system completo |

## Documenti di supporto

| File | Stato | Descrizione |
|------|-------|-------------|
| [`SESSIONS.md`](SESSIONS.md) | 🟡 LIVE | Log di tutte le sessioni di progettazione |
| [`../AGENTS.md`](../AGENTS.md) | 🟡 DRAFT | Protocollo per agenti |

## Design & mockup

| Cartella | Contenuto |
|----------|-----------|
| [`../design/mockups/`](../design/mockups/) | Le 14 schermate generate + tour logico |
| [`../design/tokens.json`](../design/tokens.json) | (futuro) Design tokens per il codice |
| [`../design/assets/`](../design/assets/) | (futuro) Logo, icone, illustrazioni |

## Fixture di test

| Cartella | Contenuto |
|----------|-----------|
| [`../fixtures/synthetic-history/`](../fixtures/synthetic-history/) | Dataset di test sintetici per ogni adapter |

## Roadmap Sessioni di Progettazione

| Sessione | Nome | Stato |
|----------|------|-------|
| 0 | 🔒 Consolidamento + Bootstrap | ✅ **COMPLETATA** |
| 1 | 🗄️ Fondamenta dati | 🔴 Prossima |
| 2 | 🔌 Primo adapter (Spotify) | 🔴 |
| 3 | 📋 Governo (backlog + testing + AGENTS finale) | 🔴 |
| 4 | 🧠 Analisi algoritmica | 🔴 |
| 5 | 🧭 UX completa + i18n | 🔴 |
| 6 | 🔐 Privacy & legale | 🔴 |
| 7 | 🎨 UI eseguibile + tokens | 🔴 |
| 8 | ⚙️ DevOps | 🔴 |

---

*Questo file viene aggiornato ad ogni sessione. Non modificarlo senza aggiornare anche `SESSIONS.md`.*