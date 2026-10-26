---
number: 47
title: "Spec adapter ListenBrainz + Last.fm (Story 1.3)"
date: 2026-10-26
state: 🟢
merged: true
merged_commit: "6d662331e2a946cf8c54c4f2c9f533fba6f1072a"
merged_date: 2026-10-26
branch: feat/145-listenbrainz-adapter-spec
pr: 146
claim: kilo-HP-ELITEBOOK-lb47
cross_refs: [144, 145]
tags: [docs, spec, adapter, phase-1]
---

# Sessione 47 — Spec adapter ListenBrainz + Last.fm (Story 1.3)

## Sintesi

Apertura delle due issue di spec mancanti per la Story 1.3 e stesura della spec
ListenBrainz. La sessione ha prodotto più di quanto il backlog descrivesse: la
formulazione originaria della 1.3 ("Import storico via API (paginazione
completa)") era imprecisa **per entrambe** le piattaforme, e una delle due ha una
pretesa di piattaforma (`recording_msid` come identificativo univoco) che, se
presa per buona, avrebbe perso dati in silenzio.

Il secondo risultato è architetturale: la Story 1.3, così formulata, non è
implementabile nel perimetro dell'app. ListenBrainz ha un export API che la
piattaforma stessa prescrive per lo storico completo e che **sconsiglia esplicitamente
la paginazione** dell'endpoint listens; Last.fm non ha un export utilizzabile
dall'app e la sua API non emette header CORS, quindi richiede un proxy
configurato dall'utente e una `api_key` per-utente (i ToS vietano esplicitamente
una key condivisa che serva più utenti).

## Trigger

Richiesta del Boss di aprire l'issue per la Story 1.3 e discuterne insieme il
perimetro, a seguito del merge della Story 1.2.

## Decisioni

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D.47.1 | **Story 1.5 ridimensionata**: T1.5.1 (Last.fm) e T1.5.2 (ListenBrainz) duplicavano letteralmente il recupero storico della 1.3. La 1.5 resta *invio scrobble + sync continua + toggle* e riusa gli adapter della 1.3. Aggiunto il task di scrittura T1.5.6, che mancava | Due implementazioni parallele dello stesso adapter avrebbero raddoppiato costo di review e manutenzione su una base di codice che non esiste ancora |
| D.47.2 | **Story 1.3 `[SIZE:M]` → `[SIZE:L]`** | 2 fonti dati, 2 API, autenticazione (session key + User Token), rate limiting, mock API, 2 percorsi per adapter. Lo stesso criterio con cui la 1.2 è passata da `M` a `L` in Sessione 42 |
| D.47.3 | **ListenBrainz: export API (ZIP/JSONL), non paginazione `/listens`** | La doc ufficiale: *"To retrieve a user's entire listening history, use the export API. Do not scrape or paginate through the user's entire history using the listens endpoint."* Il percorso `/listens` resta alla 1.5 (query incrementali). L'adapter diventa **file-only**: il contratto `05§4` non viene toccato e **non serve alcun ADR** per questa piattaforma |
| D.47.4 | **`eventKey = listenbrainz:<listened_at>\|<recording_msid>`** — non il solo `recording_msid` | Il `recording_msid` è un hash dei **metadati**, non un ID univoco per occorrenza: *"Broadly speaking if two listens have the same track and artist name, both get the same MSID"* (MetaBrainz). La dedup lato server usa la tupla `(listened_at, user_id, recording_msid)`. La prima stesura della issue propose il solo msid → 300 ascolti dello stesso brano si sarebbero collassati in **un solo evento** |
| D.47.5 | **Semantica temporale uniforme** per ListenBrainz: `timestamp = startedAt = listened_at*1000`, `durationMs = 0` | `additional_info.duration_ms` è **opzionale** e di durata *catalogo*: applicare alla lettera `02§2` (`timestamp = listened_at + durationMs`) produrrebbe due semantiche diverse nello stesso import (fine dell'ascolto quando il dato c'è, inizio quando manca) e sposterebbe il confine `day` per una parte degli eventi. Precedente identico: YouTube Music §5 (E.YT.5) |
| D.47.6 | **Bucket DEDUP-3 sempre 0** per ListenBrainz; la durata va sulla `Track` come hint, fuori dal `canonicalKey` | Se la durata entrasse nel bucket, lo stesso brano presente in un ascolto con `duration_ms` e in uno senza finirebbe in **due `Track` distinte** (E.LB.2) — l'esatto opposto di ciò che la dedup persegue. La priorità DEDUP-1/2 (ISRC/MBID nativi) compensa: è l'unica fonte del perimetro con identificatori MusicBrainz |
| D.47.7 | **Last.fm: proxy CORS configurabile dall'utente**, nessun proxy fornito dal progetto | L'API non emette `Access-Control-Allow-Origin`: dalla PWA la `fetch` è bloccata e il vincolo è aggirabile solo lato server. Nessun proxy nostro: la località dei dati resta una scelta dell'utente (ADR-0002, local-first) |
| D.47.8 | **Last.fm: `api_key` per-utente, mai embedded nel bundle** | I ToS §4.4: i limiti possono includere *"the number of users you may serve"*; §2.6: *"You may only use APIs in conjunction with the most recent user authentication key provided to You by Last.fm"*. Una key condivisa nel bundle che serve N utenti è il caso sanzionato, e l'errore 26 (*"API Key Suspended"*) colpirebbe **tutti** gli utenti dell'app |
| D.47.9 | **Last.fm: web auth in-app per la `sk`** | Gli utenti con *"Hide recent listening"* attivo non vedono nulla senza `sk` (`multi-scrobbler`: *"sk is required if user has 'Hide recent listening' enabled on their profile"*). Il flusso `last.fm/api/auth?cb=<route-app>` → `auth.getSession` non richiede backend: la callback è una route della PWA |
| D.47.10 | **Last.fm: `eventKey` normalizzato al minuto** su entrambi i percorsi (API e file) | L'API dà `date.uts` al secondo, gli export tool danno la data al **minuto**: con chiavi diverse un re-import misto duplicherebbe ogni scrobble. La normalizzazione al minuto perde il caso raro di due scrobble dello stesso brano nello stesso minuto — dichiarato |
| D.47.11 | **Last.fm: metodo opzionale `parseRemote?()` su `PlatformAdapter`** (non un'interfaccia separata) | `05§4` prevede solo `parse(input: Blob)` e il percorso API non ha un file. Un metodo opzionale lascia intatti i tre adapter esistenti. Essendo `05§4` 🟢 APPROVED, l'estensione richiede un **ADR-0010** |
| D.47.12 | **Last.fm: percorso ibrido** (API + file da export di terze parti) | L'export GDPR di Last.fm è manuale, via email, e la community segnala export incompleti. Il percorso file copre chi non vuole/possono girare un proxy, al costo di una superficie di test doppia |

## Difetti trovati lungo il percorso

**`recording_msid` non è un ID univoco per singolo ascolto.** La prima stesura
delle issue (#144, #145) proponeva `eventKey = listenbrainz:<recording_msid>`.
La verifica su MetaBrainz ha ribaltato la premessa: il MSID è un hash dei
metadati (artist + track + release + tracknumber + duration) e la dedup lato
server avviene su `(listened_at, user_id, recording_msid)`. Con la chiave
proposta, 300 ascolti dello stesso brano in momenti diversi avrebbero prodotto
**un solo** `ListenEvent`: perdita di 299 eventi, in silenzio, senza alcun errore
o warning. Lo stesso difetto, in forma inversa, si presenta per l'identità del
*brano*: il MSID cambia se un client scrobbla lo stesso brano con dettagli
diversi (un player invia `tracknumber`, un altro no) → il msid **non** va usato
come identità di brano, solo come parte dell'`eventKey` (E.LB.13).

**`MAX_ITEMS_PER_GET` = 1000, non 100.** La tabella riportava 100, desunta dalla
doc di sviluppo superata. Il sorgente (`api_tools.py`, master) fissa
`MAX_ITEMS_PER_GET = 1000` e `DEFAULT_ITEMS_PER_GET = 25`. Con rate limit
1 req/s la differenza è ~16 minuti per milione di ascolti, non 2,7 ore.

**L'export API di ListenBrainz *è* CORS-ok.** La doc di sviluppo non lo
dichiara; il sorgente sì: `views/export_api.py` applica `@crossdomain` a tutti
gli endpoint del blueprint, incluso `download_export_archive`. La scelta
D.47.3 (opzione A, l'utente scarica) **non** è imposta da un blocco tecnico ma
da ergonomia, rate limit e assenza di snapshot atomico. Verificare il sorgente
prima di dichiarare un blocco CORS ha evitato di costruire una decisione
architetturale su un presupposto errato.

**Last.fm non ha un export utilizzabile dall'app.** L'export GDPR è una
procedura manuale (richiesta via form o email a `dp3@last.fm`, attesa di giorni)
e la community segnala incompletità (*"the dump didn't include my list of
events"*). L'unico canale dell'app è l'API.

**La `api_key` Last.fm non è condivisibile.** I ToS §4.4 elencano fra i limiti
possibili *"the number of users you may serve"*, e l'errore 26 sospende la key
per l'intera applicazione. La D8 della prima stesura dell'issue — «nessun
segreto da gestire» — era semplicemente falsa: servono `api_key` **e**
`sk`, entrambe per-utente.

## Verifica

- `pwsh scripts/generate-bundle.ps1 -Check` → exit 0 (bundle rigenerato)
- `pwsh scripts/aggregate-state.ps1 -Check` → exit 0
- Nessun file applicativo toccato: `lint`/`typecheck`/`test`/`build` non impattati
- Fonti primarie: sorgente `listenbrainz-server` (`export_api.py`, `api_tools.py`,
  `decorators.py`, `export.py`), doc ufficiale ListenBrainz (Core API), doc
  Last.fm (`user.getRecentTracks`, `track.scrobble`, ToS, error codes)

## Lesson learned

| # | Osservazione |
|---|--------------|
| 47-1 | **Un identificatore con un nome che promette unicità non è un identificatore univoco**: `recording_msid` (*"MessyBrainz ID"*) suona come un ID di registrazione ed è invece un hash dei metadati. La domanda da portare a ogni chiave di dedup non è «è univoco?» ma «**univoco rispetto a cosa?**»: qui la tupla corretta include il tempo, perché l'identità dell'evento è `(istante, canzone)` |
| 47-2 | **La documentazione di sviluppo invecchia più in fretta del sorgente**: la stessa piattaforma ha un doc che dichiara `MAX_ITEMS_PER_GET = 100` e un sorgente che fissa `1000`. Quando un limite è un numero, va letto nel codice |
| 47-3 | **Verificare il presupposto CORS sul sorgente, non sul doc**: la doc di sviluppo non menziona CORS per gli export; il sorgente applica `@crossdomain` a ogni endpoint. Dichiarare un blocco architetturale senza aver letto il codice rischia di costruire una decisione (un ADR, un cambio di contratto) su un presupposto errato |
| 47-4 | **Le stesse parole nel backlog possono descrivere due realtà diverse**: «import storico via API (paginazione completa)» è corretto per Last.fm e **sbagliato** per ListenBrainz, dove la piattaforma sconsiglia la paginazione e prescrive un export. Le story aggregate per piattaforma vanno verificate una per una: la specificità costa una sessione, l'aggregazione costa dati |
| 47-5 | **Un ToS è un requisito architetturale, non un dettaglio legale**: la clausola «the number of users you may serve» trasforma una scelta di packaging (chiave embedded vs per-utente) in una scelta di sicurezza per tutti gli utanti dell'app, con un errore API che la spegne per tutti |

## Documenti aggiornati

- `docs/03-ADAPTERS/listenbrainz.md` — **nuovo**, v0.1 🟡 DRAFT: 10 sezioni del
  template, D-LB.1…D-LB.5, 20 casi di fixture, 19 edge case (E.LB.1…E.LB.19)
- `docs/01-PLATFORMS.md` — §3.8 riscritto (export API come canale MVP, limiti
  corretti, `recording_msid` documentato), §5 tre edge case nuovi (E11, E12,
  E13), changelog 0.5
- `docs/02-DATA-SCHEMA.md` — §2 riga ListenBrainz aggiornata + due deroghe
  dichiarate (YouTube, ListenBrainz), §5 nuova sottosezione "Sorgenti con durata
  non affidabile", changelog
- `docs/08-COPY-I18N.md` — §2.12c `adapter.listenbrainz.*` (12 chiavi),
  changelog 0.3
- `docs/09-PRIVACY-SECURITY.md` — §4 tre righe (username, User Token,
  `inserted_at`), §7.2 nota sulle credenziali di piattaforma, changelog 0.3
- `docs/11-BACKLOG.md` — Story 1.3 riscritta (perimetro corretto, AC dalle due
  spec, `[SIZE:L]`), Story 1.5 ridimensionata, riga roadmap 1.3, changelog 1.6.5
- `docs/state/stories/1.3-adapter-lastfm-listenbrainz.md` — **nuovo**
- `docs/state/sessions/47-listenbrainz-lastfm-adapter-spec.md` — **nuovo**
- `docs/BUNDLE.md` — rigenerato

## Note operative

- Issue **#145** (ListenBrainz) e **#144** (Last.fm) create con `needs-spec` +
  `docs`, poi passate a `agent-ready` dopo la chiusura delle decisioni: la
  precedente #96/#98 usava `agent-ready` fin dall'apertura perché le decisioni
  erano già chiuse. Lo swap è avvenuto **dopo** che le decisioni sono state prese
  in questa sessione, non prima
- **Nessuna keyword di chiusura nel body della PR**: chiudere #145 significherebbe
  `status:done` su una story che non è iniziata. Si cita la keyword spezzata
  (`` `Closes` #145 ``) per non attivare `auto-status-done`
- Worktree: `pwsh scripts/setup-worktree.ps1 145 -Slug listenbrainz-adapter-spec
  -BranchName feat/145-listenbrainz-adapter-spec`, poi claim su #145
- `scripts/generate-bundle.ps1` **non** è stato toccato: i nuovi file `state/`
  seguono la curation già in essere (solo esempi: 0.4, 0.7, S38, S41), coerente
  con le Story 1.1 e 1.2 che non hanno aggiunto il proprio state file a `$files`

## Cross-refs

- **#145** — issue della spec ListenBrainz (`agent-ready`, claim preso in questa
  sessione)
- **#144** — issue della spec Last.fm (`agent-ready`, da prendere)
- **ADR-0010** — da scrivere: estensione di `05§4` con il metodo opzionale
  `parseRemote?()` (D.47.11). Prerequisito dell'approvazione della spec Last.fm
- Prossima story lavorabile: **1.3** (Last.fm + ListenBrainz), dopo
  approvazione delle due spec; la **1.5** dipende dall'ADR-0010 per il percorso
  incrementale
