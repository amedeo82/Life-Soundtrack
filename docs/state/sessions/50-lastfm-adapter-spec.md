---
number: 50
title: "Spec adapter Last.fm (Story 1.3)"
date: 2026-10-26
state: 🟢
merged: true
merged_commit: "b3130a9ff7a4b7e2ffb652839243bb3d49b18c50"
merged_date: 2026-10-26
branch: feat/144-lastfm-adapter-spec
pr: 154
claim: kilo-HP-ELITEBOOK-lb47
cross_refs: [144]
tags: [docs, spec, adapter, phase-1]
---

# Sessione 50 — Spec adapter Last.fm (Story 1.3)

## Sintesi

Scrittura della spec `03-ADAPTERS/lastfm.md` v0.1 (🟡 DRAFT): l'ultimo deliverable
della Story 1.3. Con questa spec, la story ha i suoi tre pezzi — spec
ListenBrainz (🟢 v1.0), ADR-0010 (🟢 v1.0) e spec Last.fm (🟡 v0.1).

La spec è la più complessa del progetto: due percorsi di import (API via proxy +
file da export di terze parti), credenziali per-utente, rate limiting non
pubblicato, dieci codici errore specifici, e un job lungo (1-15 minuti su uno
storico medio).

## Trigger

Issue #144, sbloccata dalla ratifica di ADR-0010 (Sessione 49): il contratto
`parseRemote?()` che l'adapter deve consumare esiste ed è vincolante.

## Decisioni confermate (Boss, Sessione 47, issue #144)

| # | Decisione | Contenuto nella spec |
|---|-----------|----------------------|
| D-LF.0 | Proxy CORS configurato dall'utente | §1, §2.1: default vuoto → card `disabled`, zero richieste. Nessun proxy fornito dal progetto |
| D-LF.1 | `api_key` per-utente | §7: storage locale, mai nel bundle. I ToS §4.4 vietano una key che serva N utenti |
| D-LF.2 | Web auth per la `sk` | §2.2, §10: **differito alla Story 1.5** (E.LF.21) |
| D-LF.3 | Percorso ibrido | §1, §2.3: API + file, con `eventKey` unificato |
| D-LF.4 | Semantica temporale uniforme | §5: `timestamp = startedAt = date.uts*1000`, `durationMs = 0`, bias dichiarato |
| D-LF.5 | `extended=1` sempre | §1: espone `mbid` su artista/album/brano e `loved` |
| D-LF.6 | Rate limiting | §10: token bucket ~5 req/s, backoff su `11/16/29/429/5xx` |
| D-LF.7 | `eventKey` al minuto | §3.1, §4 (E.LF.16), §6: normalizzazione al minuto su tutti i percorsi |
| D-LF.8 | Metodo opzionale `parseRemote?()` | §10 + ADR-0010 |

## Difetti trovati lungo il percorso

**`limit` massimo: 200, non 1000.** La issue #144 riportava "max 200" ma la
ricerca ne ha trovate due versioni: la doc ufficiale (`last.fm/api/show/user.getRecentTracks`)
dice *"Defaults to 50. Maximum is 200"*, quella non ufficiale dice 1000. La spec usa
**200**: è il valore documentato ufficialmente, ed è quello che gli strumenti di
export osservano in pratica (*"Last.fm hands over 200 scrobbles per page"*, depth.fm).

**`artist` ha due forme, non una.** Con `extended=1` è un oggetto `{mbid, #text,
name, url, image[]}`; senza, è una **stringa**. Un parser che facesse
`artist["#text"]` andrebbe in crash su metà delle risposte. La spec lo dichiara
come E.LF.14/E.LF.15 e il test 5 verifica che lo stesso fixture produca gli stessi
eventi nelle due forme.

**Il brano in riproduzione non ha `date`.** `@attr.nowplaying = "true"` identifica
l'ascolto in corso, che non è ancora uno scrobble. È il caso E.LF.1.

**`api_sig` richiede md5, e il repo non ha un helper md5.** `crypto.ts` espone
SHA-1 e SHA-256 via Web Crypto, che non supportano md5. Il percorso web auth
(D-LF.2) è quindi **rinviato alla Story 1.5**, dove serve davvero (la sync continua
usa la `sk`): la 1.3 implementa il percorso **senza** `sk`, che non richiede firma
e funziona subito. Dichiarato come E.LF.21, non come gap silenzioso.

**Il codice `SOURCE_UNREACHABLE` non è ancora implementato.** Ratificato in
ADR-0010 §4.1, `packages/core/src/adapters/errors.ts` ha ancora 4 valori in
`AdapterErrorCode`. È un deliverable della Story 1.3, elencato negli AC del
backlog: la spec **dichiara** il codice, l'implementazione lo aggiunge.

## Verifica

- `pwsh scripts/generate-bundle.ps1 --check` → exit 0
- `pwsh scripts/aggregate-state.ps1 --check` → drift atteso sui blocchi aggregati
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati
- Fonti primarie: doc ufficiale Last.fm (`user.getRecentTracks`, `authspec`,
  `desktopauth`, error codes), doc non ufficiale Last.fm (struttura JSON
  dell'errore, `limit`), depth.fm (formati CSV dei tool di export), multi-scrobbler
  (requisito della `sk` con "Hide recent listening")

## Lesson learned

| # | Osservazione |
|---|----------------|
| 50-1 | **Un'API ha più forme per lo stesso campo, non meno.** `artist` è una stringa senza `extended=1` e un oggetto con `extended=1`; `mbid` esiste solo con `extended=1`; `date` manca del tutto per il brano in riproduzione. La specifica di un adapter non descrive *un* formato di risposta, ma la **griglia** dei formati possibili e la regola di normalizzazione che li unifica. Il crash non nasce da un campo sconosciuto, ma da un campo che cambia forma |
| 50-2 | **La firma delle richieste è un vincolo architetturale, non un dettaglio del protocollo.** `api_sig` = md5 dei parametri + shared secret, e md5 non è in Web Crypto. L'assenza dell'helper nel repo non è un incidente: è un **criterio di fattibilità** che sposta un percorso dalla 1.3 alla 1.5, dichiarato come E.LF.21 invece che scoperto in fase di test. I ToS di una piattaforma possono imporre primitive crittografiche che il progetto non ha ancora |
| 50-3 | **La normalizzazione dell'`eventKey` va progettata per il re-import misto, non per l'import singolo.** L'API dà il timestamp al secondo, l'export `lastfm-to-csv` al minuto. Due `eventKey` diverse per lo stesso scrobble significano che l'utente che importa via API e poi ricarica l'export si ritrova **ogni scrobble duplicato** — senza alcun errore. La normalizzazione al minuto (D-LF.7) costa la fusione di due scrobble dello stesso brano nello stesso minuto, e compra l'idempotenza tra percorsi: è uno scambio esplicito, dichiarato in §4 (E.LF.16) e nei test 17-18 |

## Documenti aggiornati

- `docs/03-ADAPTERS/lastfm.md` — **nuovo**, v0.1 🟡 DRAFT (10 sezioni, 21 edge case, 23 casi di fixture)
- `docs/01-PLATFORMS.md` — §3.7 riscritto, tabella §4 (2 celle da ❌ a ⚠️), E14-E18, changelog 0.6
- `docs/02-DATA-SCHEMA.md` — §2 riga Last.fm + terza deroga dichiarata, §5 tabella durata, changelog
- `docs/08-COPY-I18N.md` — §2.12d `adapter.lastfm.*` (14 chiavi)
- `docs/09-PRIVACY-SECURITY.md` — §4 cinque righe, §7.2 nota sul proxy, changelog 0.4
- `docs/11-BACKLOG.md` — Story 1.3 (stato, AC, spec), changelog 1.6.7
- `docs/state/stories/1.3-adapter-lastfm-listenbrainz.md` — T1.3.4 completato
- `docs/state/sessions/50-lastfm-adapter-spec.md` — **nuovo**
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#144** — issue della spec Last.fm, chiusa con `status:done` (PR #154, merge `b3130a9`)
- `docs/13-ADR/0010-remote-source-adapter.md` — il contratto che l'adapter consuma
- `docs/03-ADAPTERS/listenbrainz.md` — la spec sorella (🟢 v1.0)
- Promozione a v1.0 🟢 APPROVED nella Sessione 51 (stesso pattern della spec ListenBrainz, PR #147, e dell'ADR-0010, PR #153)
- Prossimo passo: **issue di implementazione della Story 1.3** (`agent-ready`, size L) — la story ha i suoi tre pezzi
