# 📝 Log delle Sessioni di Progettazione

> Memoria cronologica di tutte le sessioni di lavoro sul progetto.
> **Questo file è la nostra memoria condivisa** tra Boss, AI progettista e futuri agenti.

---

## Sessione 0 — 🔒 Consolidamento + Bootstrap

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `README.md`
- ✅ `AGENTS.md` (scheletro, poi raffinato in Sessione 3)
- ✅ `docs/INDEX.md`
- ✅ `docs/SESSIONS.md` (questo file)
- ✅ `docs/00-VISION.md`

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D0.1 | Repo su account `amedeo82`, nome `Life-Soundtrack` | Scelta del project owner |
| D0.2 | Struttura: `docs/`, `design/`, `fixtures/`, `scripts/` | Separazione responsabilità |
| D0.3 | Branch model: `main` protetto + branch temporanei | Semplice e sicuro |
| D0.4 | Conventional Commits | Leggibilità storia |
| D0.5 | Label `agent-ready` come gate | Agenti lavorano solo su spec approvate |
| D0.6 | 8 sessioni di progettazione pianificate | Copertura completa |
| D0.7 | Pilastri: local-first, privacy-first | Differenziazione e compliance GDPR |

---

## Sessione 0 — Parte 2 — 📦 Consolidamento materiale esplorativo

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/01-PLATFORMS.md`
- ✅ `docs/05-ARCHITECTURE.md`
- ✅ `docs/15-DESIGN-SYSTEM.md`

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D0.8 | Scope MVP = 8 sorgenti europee + self-hosted via scrobbling | Copertura 90% mercato con sforzo sostenibile |
| D0.9 | Design system consolidato; spec per componente in Sessione 7 | Evitare over-engineering |
| D0.10 | Edge case catalogati in `01-PLATFORMS.md` §5 | Agenti non devono riscoprirli |

---

## Sessione 1 — 🗄️ Fondamenta dati

**Data**: ottobre 2026
**Stato**: ✅ Completata + APPROVED

### Documenti prodotti
- ✅ `docs/02-DATA-SCHEMA.md` (APPROVED)
- ✅ `docs/14-GLOSSARY.md` (APPROVED)
- ✅ `docs/13-ADR/0001-pwa-first.md` (APPROVED)
- ✅ `docs/13-ADR/0002-local-first.md` (APPROVED)
- ✅ `docs/13-ADR/0003-adapter-pattern.md` (APPROVED)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D1.1 | `timestamp` = fine ascolto, `startedAt` = inizio | Coerenza cross-platform |
| D1.2 | Idempotenza via `eventKey` unico | Re-import sicuri |
| D1.3 | Dedup: ISRC → MBID → fuzzy hash con durata (bucket 2s) | Precisione + copertura |
| D1.4 | IP non persistito di default; toggle `retainIp` | Privacy-by-design |
| D1.5 | Derivati versionati (`derivedVersion`) | Ricalcolo coerente |
| D1.6 | Contatori denormalizzati ricalcolabili | Performance senza perdere verità |

---

## Sessione 2 — 🔌 Template adapter + Spotify

**Data**: ottobre 2026
**Stato**: ✅ Completata + APPROVED

### Documenti prodotti
- ✅ `docs/03-ADAPTERS/SPEC-TEMPLATE.md` (APPROVED)
- ✅ `docs/03-ADAPTERS/spotify.md` (APPROVED)
- ✅ `fixtures/synthetic-history/spotify-sample.json`

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D2.1 | SPEC-TEMPLATE come formato fisso | Coerenza adapter |
| D2.2 | Regola `skipped` derivata (E1) | Risolve bug storico Spotify |
| D2.3 | `CarDetectionEvent.json` consenso separato | Tracciamento movimenti = dato sensibile |
| D2.4 | Fixture 10 eventi con edge case | Base test universale |
| D2.5 | `eventKey` = `platform:uri` o hash fallback | Idempotenza garantita |

---

## Sessione 3 — 📋 Governo

**Data**: ottobre 2026
**Stato**: ✅ Completata + APPROVED

### Documenti prodotti
- ✅ `docs/11-BACKLOG.md` (APPROVED) — 5 epic, 17 story
- ✅ `docs/10-TESTING.md` (APPROVED) — piramide + coverage + fixture
- ✅ `AGENTS.md` v1.0 (APPROVED) — protocollo con handoff tra chat

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D3.1 | 5 epic (fondamenta, import, analisi, UI, privacy) | Copertura MVP + estensioni |
| D3.2 | Story 0.1-0.4 sequenziali | Dipendenze critiche |
| D3.3 | Label `agent-ready` come gate | Evita agenti che improvvisano |
| D3.4 | Coverage differenziato per modulo | Adapter 90%, UI 70% |
| D3.5 | 3 categorie fixture: synthetic, db-seed, scenarios | Separazione responsabilità |
| D3.6 | AGENTS.md v1.0 con handoff | Pronti per chat multiple |

---

## Sessione 4 — 🧠 Algoritmi di analisi

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/04-ANALYSIS-ALGORITHMS.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D4.1 | Mood come quadrante valence×energy con fascia neutra | Evita flip-flop |
| D4.2 | Era detector via change point detection su firme settimanali | Più robusto di k-means puro |
| D4.3 | Similarity pesata (generi 50%, artisti 30%, numerici 20%) | Bilancia aspetti qualitativi/quantitativi |
| D4.4 | Event detector: z-score + specializzati | Interpretabilità + copertura |
| D4.5 | 5 tipi di ricordo con scoring e ranking | Feed ordinato per rilevanza |
| D4.6 | Pipeline incrementale | Performance su file grandi |
| D4.7 | derivedVersion = sha1(config)[:8] | Rileva cambi parametri |

---

## Sessione 5 — 🧭 UX completa + i18n

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/06-UX-FLOWS-STATES.md` (DRAFT)
- ✅ `docs/08-COPY-I18N.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D5.1 | 6 stati globali (loading/empty/partial/ready/error/offline) | Copertura scenari |
| D5.2 | Stato machine Import con 6 stati | Tracciamento preciso |
| D5.3 | Keyboard navigation per ogni schermata | Accessibilità |
| D5.4 | Alternative testuali per visualizzazioni | Screen reader |
| D5.5 | Namespace i18n per modulo | Manutenibilità |
| D5.6 | MVP bilingue IT+EN | Target europeo |
| D5.7 | Pluralizzazione ICU | Supporto lingue future |
| D5.8 | Demo mode con fixture sintetico | Onboarding senza dati personali |

---

## Sessione 5 — Parte 2 (Review repo)

**Data**: ottobre 2026
**Stato**: ✅ Completata

Boss ha reso il repo pubblico. Trovati 6 problemi di sincronizzazione risolti con commit di fix: INDEX/SESSIONS/AGENTS vecchi, status APPROVED non riflessi, SPEC-TEMPLATE refusi, BUNDLE mancante.

---

## Sessione 6 — 🔐 Privacy & Legale

**Data**: ottobre 2026
**Stato**: ✅ Completata

### Documenti prodotti
- ✅ `docs/09-PRIVACY-SECURITY.md` (DRAFT)

### Decisioni prese
| # | Decisione | Motivazione |
|---|-----------|-------------|
| D6.1 | Base giuridica unica: consenso esplicito art. 6.1.a | Coerenza con local-first |
| D6.2 | Inferenze come dati potenzialmente sensibili | Massima cautela |
| D6.3 | Disclaimer inferenze obbligatorio in app | Trasparenza, non è consulenza psicologica |
| D6.4 | Loghi ufficiali VIETATI senza licenza | Rischio trademark |
| D6.5 | Mai dati reali nei fixture + check CI | Prevenzione leak |
| D6.6 | DPIA probabilmente non richiesta | Da confermare con legale |
| D6.7 | Privacy policy = BOZZA da revisionare con legale | Onestà intellettuale |

---

## Template sessione (da copiare per le sessioni future)

    ## Sessione N — 🎯 [Nome]

    **Data**: [data]
    **Stato**: 🟡 In corso / ✅ Completata

    ### Documenti prodotti
    - ✅ `percorso/file.md` (APPROVED/DRAFT)

    ### Decisioni prese
    | # | Decisione | Motivazione |
    |---|-----------|-------------|
    | D.N.1 | ... | ... |

---

*Aggiornato ad ogni nuova sessione.*