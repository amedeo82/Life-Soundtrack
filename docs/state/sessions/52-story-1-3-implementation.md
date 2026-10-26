---
number: 52
title: "Implementazione Story 1.3 (adapter Last.fm + ListenBrainz)"
date: 2026-10-26
state: 🟢
merged: true
merged_commit: ""
merged_date: ""
branch: feat/155-lastfm-listenbrainz-adapter
pr: ""
claim: kilo-HP-ELITEBOOK-lb52
cross_refs: [155, 144, 145, 148]
tags: [adapter, phase-1, feat]
---

# Sessione 52 — Implementazione Story 1.3 (adapter Last.fm + ListenBrainz)

## Sintesi

Implementazione della Story 1.3: i due adapter che la story prometteva, con i
percorsi e le semantiche delle due spec 🟢 APPROVED.

- **Adapter ListenBrainz** (`packages/core/src/adapters/listenbrainz/`): export
  API in ZIP (`listens/*.jsonl` + `user.json`) o JSONL sciolto, scanner JSONL
  dedicato (una riga in memoria, riga malformata non abortisce, `TRUNCATED`
  recuperabile a fine stream), `eventKey = listenbrainz:<listened_at>|<recording_msid>`,
  artista ricostruita da `mbid_mapping.artists[]` (mai divisa per `&`).
- **Adapter Last.fm** (`packages/core/src/adapters/lastfm/`): percorso **ibrido**.
  - **file**: CSV `ghan.nl` (8 colonne con header), CSV `lastfm-to-csv` (4 colonne
    senza header, data al minuto) ed export JSON degli stessi tool;
  - **API**: `parseRemote?()` (ADR-0010) con token bucket ~5 req/s, backoff
    esponenziale, mappa dei **10 codici di errore** Last.fm, stop a
    `@attr.totalPages`, `AbortSignal`, streaming senza accumulo.
- **Core**: `SOURCE_UNREACHABLE` aggiunto a `AdapterErrorCode`; `RemoteSource` +
  `parseRemote?()` nel contratto `PlatformAdapter`; `runRemoteImport()` in
  `importSession`; due campi **additivi e opzionali** su `RawListenEvent`
  (`sourceArtistMbid`, `sourceTrackDurationMs`).
- **Storage**: tabella `settings` (Dexie v4) per proxy, `api_key` e username
  Last.fm — per-utente, locali, mai nel bundle, mai nei log.
- **UI**: pannello Last.fm nella schermata di import (config + import da API),
  chiavi i18n `adapter.listenbrainz.*` (12) e `adapter.lastfm.*` (14) +
  `settings.lastfm.*` (10) in `it`/`en`.

**Test**: 198 nel core (di cui 47 nuovi: 7 scanner JSONL, 18 ListenBrainz,
22 Last.fm), 81 nella web (di cui 3 nuovi sul pannello). `lint`, `typecheck`,
`test` e `build` verdi in locale.

## Trigger

Issue #155 (`agent-ready`, size L): la Story 1.3 aveva i suoi tre pezzi
documentali (spec ListenBrainz 🟢 v1.0, ADR-0010 🟢 v1.0, spec Last.fm 🟢 v1.0)
ed era quindi implementabile nelle sue due parti.

## Difetti trovati lungo il percorso

**Il contratto degli adapter non aveva un campo per l'MBID dell'artista.**
Le spec §3.1.2 di entrambe le piattaforme dichiarano `artist.mbid` → `Artist.mbid`
("dato utile e attivo, più affidabile del mbid del brano"), ma `RawListenEvent`
(05§3.1) non ha un campo dedicato: il dato non poteva raggiungere l'entità
`Artist`. Aggiunto `sourceArtistMbid?: string | null` — **additivo e opzionale**:
gli altri quattro adapter non lo valorizzano e restano invariati (V1 di ADR-0010).

**La durata catalogo e la durata dell'evento erano la stessa cosa.**
ListenBrainz espone `additional_info.duration_ms` (durata **catalogo**), ma
l'evento ha durata **0** (D-LB.7: l'ascolto non ha durata). Se la durata catalogo
entrasse nel bucket DEDUP-3, uno stesso brano ascoltato una volta con e una volta
senza il dato finirebbe in **due `Track` distinte** — l'esatto opposto di ciò che la
dedup persegue. Aggiunto `sourceTrackDurationMs?: number | null`: il bucket usa
`sourceDurationMs` (sempre 0 per ListenBrainz e Last.fm), la durata catalogo
resta un **hint** sulla `Track`.

**La formula dell'`eventKey` Last.fm della spec non soddisfa E.LF.16 ed E.LF.19.**
La spec dichiara `lastfm:<minuto>|<mbid ?? name|artist>` e, nello stesso
documento, che il **re-import misto** (API + file) non deve duplicare nulla. Ma
l'API espone il MBID **spesso vuoto** (E.LF.5) mentre l'export `ghan.nl` lo porta:
con il MBID nella chiave, lo stesso scrobble avrebbe due chiavi diverse a
seconda del percorso. Risolto con `LastfmEventKeyBuilder`: **il MBID entra nella
chiave solo quando serve a disambiguare** (stesso minuto, stessa coppia
nome|artista, MBID diversi → E.LF.4); in tutti gli altri casi la chiave è
`<minuto>|<nome>|<artista>`, che è la forma che converge fra i due percorsi.
Documentato in `docs/03-ADAPTERS/lastfm.md` §3.1.

**`skipped = null` non è rappresentabile nel modello.** La spec chiede
`skipped = null` ("nessun dato, non dedurre da `durationMs = 0`"), ma
`ListenEvent.skipped` è `boolean` non nullabile (02§3.2): l'adapter passa `null`
e il core lo normalizza a `false`, come per gli altri adapter. Dichiarato, non
nascosto.

**`ListenEvent.durationMs` per gli export tool è al secondo, non al minuto.**
I CSV `lastfm-to-csv` portano la data al minuto, l'API al secondo: la
normalizzazione D-LF.7 risolve il *timestamp* dell'evento, ma non quello della
**riga** del file. Diverge nel caso limite: due scrobble distinti nella stessa
minestra di 60 s hanno timestamp diversi ma la stessa chiave di riga, quindi il
secondo verrebbe scartato come duplicato **se il file viene ricaricato** (la
riga ha un solo `uts`). Dichiarato come gap noto della 1.3.

## Verifica

- `pnpm run lint` → verde (3 task)
- `pnpm run typecheck` → verde (3 task)
- `pnpm --filter @ls/core exec vitest run` → **198 test verdi** (17 file)
- `pnpm --filter @ls/web exec vitest run` → **81 test verdi** (10 file)
- `pnpm run build` → verde (3 task)
- `pwsh scripts/generate-bundle.ps1 --check` → exit 0
- `pwsh scripts/aggregate-state.ps1 --check` → drift atteso sui blocchi aggregati
  (li rigenera `auto-state-aggregate` post-merge)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 52-1 | **Una spec 🟢 APPROVED può contenere due clausole che si contraddicono, e il test lo trova prima del review.** La formula dell'`eventKey` (`mbid ?? name|artist`) e la promessa del re-import misto senza duplicati (E.LF.16/E.LF.19) non possono valere insieme: l'API e il CSV non espongono il MBID con la stessa copertura. Il test che l'ha fatto emergere è quello scritto **per la specifica** ("lo stesso scrobble via API e via CSV → stesso `eventKey`"): un test scritto per la spec è anche il test che può smontarla. La regola: quando un test di una spec approvata fallisce, il difetto è della specifica finché non si dimostra il contrario — e allora va **dichiarato** e risolto nel codice, non aggirato |
| 52-2 | **Un contratto che non prevede un dato è un buco che solo l'implementazione fa emergere.** `RawListenEvent` non aveva un campo per l'MBID dell'artista, e nessuna delle quattro piattaforme precedenti ne aveva bisogno: il buco era invisibile fino a Last.fm e ListenBrainz, che sono le prime a portarlo. Due campi **opzionali** lo hanno chiuso senza toccare gli adapter esistenti (V1). Il costo dell'estensione è nullo quando la forma è additiva; il costo del non estenderlo è il dato perso |
| 52-3 | **Normalizzare al minuto non basta: bisogna normalizzare *anche* l'identità del brano.** D-LF.7 normalizza il timestamp, ma l'`eventKey` conteneva anche il MBID, la cui *copertura* dipende dal percorso. La normalizzazione va applicata all'intera parte variabile della chiave, non solo a una parte: il resto della chiave deve essere **path-independent**, altrimenti la deduplicazione vale solo dentro un percorso |
| 52-4 | **Il test di un contratto di rete non è un test di network: è un test di forma.** Lo stub di `fetch` con orologio e sleep iniettabili rende verificabili tre cose che il mocking a mano rende fragili: il ritmo del token bucket (le richieste sono **spaziate**, non solo non superate), il backoff (l'attesa è misurabile) e l'**ordine** dei tentativi (un errore 9 fa **un** tentativo, non un loop). Nessuna dipendenza nuova: `msw` non serve per quattro casi |
| 52-5 | **Il percorso file e il percorso API non sono due implementazioni: sono due fonti dello stesso oggetto.** Mappare entrambi sugli stessi `RawListenEvent` e far passare i due attraverso la **stessa** pipeline (V2 di ADR-0010) è ciò che rende il re-import idempotente. Il percorso file non ha bisogno di `detect()`-remoto né di `api_key`: sono due sorgenti diverse dello stesso contratto |

## Documenti aggiornati

- `packages/core/src/adapters/listenbrainz/` — **nuovo**: `types.ts`, `detect.ts`,
  `mapEvent.ts`, `adapter.ts`, `index.ts`
- `packages/core/src/adapters/lastfm/` — **nuovo**: `types.ts`, `detect.ts`,
  `mapEvent.ts`, `eventKey.ts`, `api.ts`, `adapter.ts`, `index.ts`
- `packages/core/src/adapters/jsonlStream.ts` — **nuovo**: scanner JSONL
- `packages/core/src/adapters/errors.ts` — `SOURCE_UNREACHABLE`
- `packages/core/src/adapters/types.ts` — `RemoteSource`, `parseRemote?()`,
  `sourceArtistMbid`, `sourceTrackDurationMs`, `onWarning(code, count?)`
- `packages/core/src/adapters/importSession.ts` — `runRemoteImport()`, sessione
  unica file/ remota
- `packages/core/src/adapters/pipeline.ts` — `Artist.mbid` e durata catalogo
- `packages/core/src/db/db.ts` + `settings.ts` — schema Dexie v4 (tabella `settings`)
- `packages/core/package.json` — subpath exports `./adapters/listenbrainz`,
  `./adapters/lastfm`
- `apps/web/src/onboarding/LastfmPanel.tsx` — **nuovo**; `OnboardingRouter.tsx` —
  wiring dei due adapter e del pannello
- `apps/web/src/i18n/locales/{it,en}.json` — 38 chiavi nuove
- `fixtures/synthetic-history/` — **6 fixture nuovi** (ListenBrainz JSONL,
  Last.fm API×2, CSV×2, export JSON)
- `docs/02-DATA-SCHEMA.md` — §6: tabella `settings` (v4)
- `docs/05-ARCHITECTURE.md` — §4: sottosezione "Sorgenti remote"
- `docs/03-ADAPTERS/lastfm.md` — §3.1: chiave normalizzata (il MBID entra solo
  quando disambigua)
- `docs/03-ADAPTERS/listenbrainz.md` — nota sui campi del contratto
- `docs/08-COPY-I18N.md` — §2.12c/§2.12d: materializzazione delle chiavi
- `docs/09-PRIVACY-SECURITY.md` — §4: storage locale delle credenziali
- `docs/11-BACKLOG.md` — Story 1.3 completata, changelog
- `docs/state/stories/1.3-adapter-lastfm-listenbrainz.md` — stato 🟢
- `docs/state/sessions/52-story-1-3-implementation.md` — **nuovo**
- `docs/18-DEV-LOG.md` — §18
- `scripts/generate-bundle.ps1` — `$files`: 6 fixture + la sessione 52
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#155** — issue di implementazione della Story 1.3 (chiusa al merge della PR)
- **#144** / **#145** / **#148** — issue delle spec (ListenBrainz, Last.fm, ADR-0010)
- `docs/03-ADAPTERS/listenbrainz.md` · `docs/03-ADAPTERS/lastfm.md` — le spec consumate
- `docs/13-ADR/0010-remote-source-adapter.md` — il contratto `parseRemote?()`
- Prossimo passo: **Story 1.4** (dedup promozione post-enrichment) e
  **Story 1.5** (sync continua, percorso web auth con `sk` + md5 per `api_sig`)
