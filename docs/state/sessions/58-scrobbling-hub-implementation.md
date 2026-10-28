---
number: 58
title: "Story 1.5 - scrobbling hub: contratto, coda, sink, UI e sync"
date: 2026-10-28
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/173-story-1-5-scrobbling-hub
pr: 176
claim: kilo-hp-elitebook-41xb
cross_refs: [173, 172, 168]
tags: [feat, adapter, db, ui, phase-1]
---

# Sessione 58 — Implementazione della Story 1.5 (issue #173)

## Sintesi

Implementazione completa del **percorso di scrittura** degli scrobble: dalla
coda locale all'invio sui due hub, con il contratto ratificato (ADR-0011) e la
spec ratificata (`20-SCROBBLING-HUB.md` v1.0).

Il perimetro è quello dei **15 deliverable** di `20§16` e dei **31 casi di
test** di `20§14.3`, più il percorso **web auth** di Last.fm (token → session
key) necessario alla firma `api_sig`.

| Deliverable | Dove |
|---|---|
| Contratto `ScrobbleSink` | `packages/core/src/adapters/scrobble/types.ts` |
| Registry dei sink | `packages/core/src/adapters/scrobble/index.ts` |
| Sink Last.fm | `packages/core/src/adapters/lastfm/scrobble.ts` |
| Sink ListenBrainz | `packages/core/src/adapters/listenbrainz/scrobble.ts` |
| `md5Hex` (JS puro) | `packages/core/src/adapters/crypto.ts` |
| Tabella `scrobbleOutbox` (schema Dexie v5) | `packages/core/src/db/db.ts`, `packages/core/src/db/scrobbleOutbox.ts` |
| Ciclo della coda | `packages/core/src/db/scrobbleOutbox.ts` |
| `parseRemote?()` incrementale | `packages/core/src/adapters/listenbrainz/adapter.ts` |
| Web auth Last.fm | `packages/core/src/adapters/lastfm/auth.ts` |
| Chiavi di settings (token, cursori) | `packages/core/src/db/settings.ts` |
| Pannello UI | `apps/web/src/onboarding/ScrobblePanel.tsx` |
| Namespace i18n `scrobble` | `apps/web/src/i18n/locales/{it,en}.json` |
| Fixture | `fixtures/synthetic-history/scrobble-{hub,payloads}-sample.json` |
| Test (31 casi) | `packages/core/src/adapters/scrobble/__tests__/`, `packages/core/src/db/__tests__/scrobble-outbox.test.ts`, `apps/web/src/onboarding/__tests__/ScrobblePanel.test.tsx` |
| Allineamento documentale | `docs/02`, `docs/08`, `docs/11`, `docs/18`, `docs/state/` |

## Trigger

Issue **#173** (`agent-ready`, `size:L`), aperta nella Sessione 57 quando la
spec della Story 1.5 è stata ratificata: le due dipendenze (contratto e spec)
erano soddisfatte e la story era la prossima del progetto.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.58.1 | Il tipo `ScrobbleHubId` vive in `schema/index.ts`, gli altri tipi del contratto in `adapters/scrobble/types.ts` | `PrivacySettings.scrobbleHubs` è un tipo del **dominio** e la tabella `scrobbleOutbox` lo referenzia: metterlo solo negli adapter avrebbe creato una dipendenza dal db verso gli adapter. Il tipo resta **dedicato** (V7) |
| D.58.2 | I brani si risolvono con una **scansione** di `tracks`, non con una query per `listen.trackId` | La PK di `tracks` è `canonicalKey` e `id` **non** è indicizzato (`02§6`): non esiste una query per id. È lo stesso approccio di `db/orphan-cleanup.ts` |
| D.58.3 | Il **cursore** della sync viaggia in `RemoteSource.pagination.to` e l'adapter applica `max_ts = cursore - 1` | C-SH.2 vuole che l'evento al confine non venga riletto: il `-1` è dell'adapter (chi conosce il protocollo), non del core |
| D.58.4 | Il sink espone il delay di retry del protocollo come **capacità opzionale** (`retryDelayMs()`), non come campo del `ScrobbleError` | R-SH.4 impone di rispettare `X-RateLimit-Reset-In`, ma il contratto approvato (`05§4.2`) non ha quel campo: il protocollo resta nel sink (V9) e il sender lo cerca **strutturalmente** |
| D.58.5 | Il **payload di un accettazione parziale** è risolto in ordine FIFO | La risposta dell'hub non dice *quali* elementi ha rifiutato: si assumono i primi `accepted` confermati e gli altri rifiutati. È dichiarato nel codice e nel changelog, non nascosto |
| D.58.6 | Il **test di performance** gira in una run separata (`vitest run --exclude '**/perf.test.ts' && vitest run …`) | Con tre file di test in più, la misura del test finiva dentro il rumore delle suite in parallelo (600 ms contro la soglia locale di 500 ms) e misurava il **carico del runner**, non il layer DB: è lo stesso motivo per cui il file è già escluso dalle run con coverage. **La soglia dell'AC resta invariata** |
| D.58.7 | Il **web auth** è implementato come "apri la pagina di autorizzazione e incolla l'indirizzo di callback" | La PWA non fa da server (ADR-0002) e non ha un dominio di callback registrato: il flusso con popup e service worker sarebbe una capability nuova. Il token viene scambiato in `sk` e la `sk` resta in storage locale |
| D.58.8 | **AC-SH.11 dichiarata parzialmente** soddisfatta | La parte "MBID → DEDUP-2" è già coperta dal pipeline (`raw.mbid`); la parte "`track.genres` via lookup MusicBrainz" dipende dall'**enrichment** (EPIC 4, non implementato). Dichiararlo nella story è più onesto che spuntarlo |

## Difetti trovati lungo il percorso

**Il test di performance misurava il carico, non il layer DB** (D.58.6): con
tre file di test in più la suite parallela faceva superare la soglia locale di
500 ms (600-670 ms), mentre il test in isolamento passava (1,4 s il file intero,
best-of-3 sotto soglia). La verifica decisive: togliendo i tre file nuovi la
suite tornava verde **con** la tabella `scrobbleOutbox` già presente, quindi la
causa non era lo schema.

**L'header di `db/health.ts` dichiarava la versione attesa 4**: con la tabella
v5 il check di salute segnalava un falso "schema sotto l'attesa". Aggiornato a 5.

**`db.test.ts` contava 13 tabelle e la versione 4**: aggiornati elenco,
indici e versione (la 14ª tabella è `scrobbleOutbox`).

**Il bundle contava i file**: l'aggiunta dei due fixture di scrittura richiede
l'array `$files` di `scripts/generate-bundle.ps1` (bundle: 98 → 100 file).

## Verifica

- `pnpm run lint` → exit 0
- `pnpm run typecheck` → exit 0
- `pnpm run test` → **267** test in `@ls/core` (265 + 2 performance) e **91** in
  `@ls/web`: verdi
- `pnpm run build` → exit 0
- `node scripts/check-readme-facts.mjs` → exit 0 (15 check, 0 falliti)
- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (100 file)
- Nessuna modifica ai blocchi `<!-- AGGREGATE-* -->` (ADR-0008)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 58-1 | **Un tipo del dominio che finisce in due posti va definito in un posto solo.** `ScrobbleHubId` serve allo schema (`PrivacySettings`) e alla coda (`scrobbleOutbox`): definirlo solo negli adapter avrebbe fatto dipendere il db dagli adapter. L'ADR diceva "i tipi del contratto in `adapters/scrobble/types.ts`", ma il vincolo che conta è quello del **layer** (il db non conosce gli adapter), e l'ADR-0011 §"Dove vive il codice" non lo contraddiceva: elencava i tipi *del contratto di scrittura*, non il tipo di dominio condiviso |
| 58-2 | **Il vincolo di aciclicità dei package non copre i vincoli fra moduli.** `05§9.2` parla di package (`@ls/core` è una foglia), e dentro il package la regola è rimasta implicita: il db che importa dagli adapter e gli adapter che importano dal db è un ciclo **fra moduli** che nessun gate misura. Il perimetro si risolve pensando al **layer** (chi dipende da chi), non ai package |
| 58-3 | **Un test di performance è una misura di un ambiente, non solo del codice.** Con più file di test in parallelo la misura include il rumore delle altre suite: il test è diventato rosso senza che il layer DB fosse cambiato. La risposta non è alzare la soglia (avrebbe spento l'AC) ma **isolare la misura**: è la stessa disciplina che il file aveva già per la coverage |
| 58-4 | **Un AC che mescola due story è un AC che non si può spuntare.** "MBID → DEDUP-2 **e** `track.genres` via lookup MusicBrainz" unisce una capability dell'EPIC 1 (il MBID, già nel pipeline) a una dell'EPIC 4 (l'enrichment, non implementato). La lezione è dichiararlo parzialmente e aprire la issue dedicata quando l'EPIC 4 parte: uno AC spuntato che copre metà del lavoro è un falso verde |
| 58-5 | **La firma `api_sig` ha un dettaglio che solo si vede con ≥ 10 elementi**: il server ordina i **nomi** dei parametri (`artist[10]` prima di `artist[2]`), non gli indici. Il test con 11 elementi lo rende visibile; un test con 2 passerebbe anche con l'ordinamento numerico sbagliato |

## Documenti aggiornati

- `docs/08-COPY-I18N.md` — §2.12f (le chiavi di UI `settings.scrobble.*`) e la
  materializzazione del namespace `scrobble`
- `docs/11-BACKLOG.md` — Story 1.5 ✅, AC spuntati, riga roadmap rimossa,
  changelog 1.6.17
- `docs/INDEX.md` — conteggi legacy e "Prossimo step tecnico"
- `docs/18-DEV-LOG.md` — §24 (nuova) + changelog 2.5
- `docs/state/stories/1.5-scrobbling-hub.md` — `status: done`
- `docs/state/sessions/58-scrobbling-hub-implementation.md` — **nuovo**
- `docs/state/_index.md` — righe della Sessione 58 e della Story 1.5
- `scripts/generate-bundle.ps1` + `docs/BUNDLE.md` — i due fixture nuovi e la
  sessione 58
- `README.md` — la prosa: la Story 1.5 non è più "non ancora implementato"

## Cross-refs

- **#173** — implementazione della Story 1.5 (claim `kilo-hp-elitebook-41xb`)
- **#172** — le quattro decisioni di protocollo chiuse nella Sessione 57
- **#168** — ADR-0011, il contratto di scrittura (Sessione 56)
- `docs/20-SCROBBLING-HUB.md` v1.0 🟢 — la spec che l'implementazione
  materializza
