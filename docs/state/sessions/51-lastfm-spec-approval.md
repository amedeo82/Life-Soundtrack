---
number: 51
title: "Promozione spec Last.fm a APPROVED v1.0 + issue di implementazione 1.3"
date: 2026-10-26
state: 🟢
merged: true
merged_commit: "6ec71bbb0f900067729e0aa995115daa53070966"
merged_date: 2026-10-26
branch: docs/144-lastfm-spec-approval
pr: 156
claim: kilo-HP-ELITEBOOK-lb47
cross_refs: [144, 155]
tags: [docs, spec, adapter, phase-1]
---

# Sessione 51 — Promozione spec Last.fm + issue di implementazione della 1.3

## Sintesi

Ratifica della spec `03-ADAPTERS/lastfm.md` (v0.1 🟡 DRAFT → **v1.0 🟢 APPROVED**)
e apertura dell'**issue di implementazione** della Story 1.3, che chiude il ciclo
di documentazione iniziato in Sessione 47.

Con questa sessione la Story 1.3 ha i suoi **tre pezzi**:

| Pezzo | Stato | PR |
|-------|-------|-----|
| `03-ADAPTERS/listenbrainz.md` | 🟢 APPROVED v1.0 | #146 |
| `13-ADR/0010-remote-source-adapter.md` | 🟢 APPROVED v1.0 | #152 |
| `03-ADAPTERS/lastfm.md` | 🟢 APPROVED v1.0 | #154 |

## Trigger

Merge della PR #154 (`b3130a9`), ratifica del Boss.

## Decisioni

**D.51.1 — Una sola issue di implementazione per la Story 1.3**, non due.

Il protocolto del progetto è "una story = una issue" (`AGENTS.md` §"🌳 Git workflow":
*una PR = una issue*), e il precedente è lineare: la 1.1 (YouTube Music) → issue #129,
la 1.2 (Apple Music) → issue #132. La 1.3 è **una** story che contiene due adapter,
quindi una sola issue con task distinti per ciascuno.

L'alternativa (due issue, una per adapter) è stata valutata perché i due adapter non
condividono quasi nulla: ListenBrainz è file-only, Last.fm ha rete, proxy,
autenticazione e rate limiting. Ma dividerla frammenterebbe il tracciamento: la story
1.3 resterebbe "in corso" finché entrambe le issue non sono chiuse, e il backlog
avrebbe due righe per una sola story. La dimensione resta `L` (già ricalibrata in
Sessione 47): due adapter, due percorsi di import, un nuovo codice errore, un nuovo
scanner JSONL, mock API.

**D.51.2 — Il percorso web auth Last.fm resta alla Story 1.5** (E.LF.21), confermato
dalla ratifica: `api_sig` richiede md5 e il repo espone solo SHA-1/SHA-256 via Web
Crypto. La 1.3 implementa il percorso **senza** `sk`, che non richiede firma.

## Il contenuto dell'issue di implementazione

L'issue raccoglie i deliverable delle tre specifiche:

**Adapter ListenBrainz** (file-only)
- Detection su ZIP (`listens/*.jsonl` + `user.json`) e su JSONL sciolto
- **Scanner JSONL dedicato**: il `JsonArrayScanner` esistente è uno scanner di array JSON e non va bene per JSONL. Streaming, memoria limitata a una riga, una riga malformata non abortisce lo stream
- `eventKey = listenbrainz:<listened_at>|<recording_msid>` (D-LB.2)
- Semantica uniforme `timestamp = startedAt = listened_at*1000`, `durationMs = 0`
- DEDUP-1 (ISRC) e DEDUP-2 (MBID da `mbid_mapping`); bucket DEDUP-3 sempre 0

**Adapter Last.fm** (API + file)
- `parseRemote?()` (ADR-0010) su `RemoteSource`, con proxy configurato dall'utente
- Percorso file: CSV ghan.nl (8 colonne) e lastfm-to-csv (4 colonne, senza header), JSON
- `eventKey` normalizzato al **minuto** su tutti i percorsi (D-LF.7)
- Token bucket ~5 req/s, backoff su `11/16/29/429/5xx`, `AbortSignal`
- Mappa dei 10 codici errore Last.fm → `AdapterError`
- **Aggiungere `SOURCE_UNREACHABLE`** a `packages/core/src/adapters/errors.ts` (il tipo `AdapterErrorCode` ha oggi 4 valori) — deliverable scoperto scrivendo la spec

**Trasversale**
- Codice errore `SOURCE_UNREACHABLE` in `errors.ts`
- 5 fixture `fixtures/synthetic-history/lastfm-*` + 2 `listenbrainz-*`
- i18n `adapter.lastfm.*` (§2.12d) e `adapter.listenbrainz.*` (§2.12c) → locale JSON
- Settings: proxy, `api_key`, username Last.fm (locali, mai nel bundle)

## Verifica

- `pwsh scripts/generate-bundle.ps1 --check` → exit 0
- `pwsh scripts/aggregate-state.ps1 --check` → drift atteso (blocchi aggregati)
- Nessun file applicativo toccato

## Lesson learned

| # | Osservazione |
|---|----------------|
| 51-1 | **Una story con due adapter non è due story.** La tentazione di dividere Last.fm e ListenBrainz in due issue di implementazione è naturale — non condividono codice, hanno complessità diverse, e il backlog le elencerebbe meglio separate. Ma la story è un'unità di **valore** (l'utente importa la sua storia), non un'unità di codice: dividerla crea due righe di backlog per un solo risultato e rende ambiguo quando la story è "fatta". Le issue si dividono per **indipendenza di lavoro**, non per diversità di implementazione — e qui l'indipendenza non c'è, perché l'`eventKey` normalizzato al minuto (D-LF.7) è un contratto **fra** i due adapter: è il Last.fm a imporre la granularità che il ListenBrainz deve rispettare |
| 51-2 | **Un deliverable scoperto dalla specifica è un deliverable della story.** Scrivere la spec Last.fm ha rivelato che il codice `SOURCE_UNREACHABLE`, ratificato in ADR-0010, non è implementato: `errors.ts` ha ancora 4 valori in `AdapterErrorCode`. Non è un dettaglio dell'ADR (che non implementa nulla per definizione) né un bug: è lavoro che la story deve fare, e che senza la spec nessuno avrebbe elencato. La specifica è anche lo strumento che rende visibile il lavoro implicito |

## Documenti aggiornati

- `docs/03-ADAPTERS/lastfm.md` — 🟡 DRAFT v0.1 → **🟢 APPROVED v1.0**; changelog
- `docs/state/sessions/50-lastfm-adapter-spec.md` — `pr: 154`, `merged_commit: b3130a9`, `state: 🟢`, `merged: true`
- `docs/state/stories/1.3-adapter-lastfm-listenbrainz.md` — T1.3.6 completato; "Stato attuale" aggiornato
- `docs/11-BACKLOG.md` — Story 1.3 (stato, spec), riga roadmap, changelog 1.6.8
- `docs/01-PLATFORMS.md` — §3.7: riferimento alla spec aggiornato a v1.0 APPROVED
- `docs/state/sessions/51-lastfm-spec-approval.md` — **nuovo**
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#144** — spec Last.fm, chiusa con `status:done` (PR #154, merge `b3130a9`)
- **#155** — issue di implementazione della Story 1.3 (aperta in questa sessione)
- **PR #156** — promozione della spec Last.fm a 🟢 APPROVED v1.0 + apertura di #155 (merge `6ec71bb`, 2026-10-26): è la PR che chiude questa sessione
- `docs/03-ADAPTERS/listenbrainz.md` (🟢 v1.0) · `docs/13-ADR/0010-remote-source-adapter.md` (🟢 v1.0)
- Prossimo passo: l'issue #155 è `agent-ready` e implementabile da un agente
