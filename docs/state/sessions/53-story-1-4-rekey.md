---
number: 53
title: "Story 1.4 — rekey(): promozione dedup post-enrichment"
date: 2026-10-26
state: 🟡
merged: false
merged_commit: ""
merged_date: ""
branch: feat/160-rekey-dedup-promotion
pr: 162
claim: kilo-HP-ELITEBOOK-lb53
cross_refs: [160, 39]
tags: [db, phase-1, feat]
---

# Sessione 53 — Story 1.4: `rekey()` (promozione dedup post-enrichment)

## Sintesi

Completamento e irrobustimento del job `rekey()` (`packages/core/src/db/rekey.ts`),
che promuove la `canonicalKey` di una `Track` da `fuzzy:` a `isrc:`/`mbid:`
quando l'enrichment MusicBrainz scopre gli identificativi, e **fuse** i
duplicati.

La funzione **esisteva già** dalla Story 0.7 (PR #39, `20da75d`) ed è già
esportata da `@ls/core/db` e descritta in `16-OPERATIONS.md` §2.3 e
`05-ARCHITECTURE.md` §12.1. Ma era **incompleta** rispetto agli acceptance
criteria della story, e non aveva i test che la story chiede. La Sessione 53 ne
ha chiuso i buchi.

**Che cosa è cambiato** (dettaglio nel file di story `1.4-dedup-promotion.md`):

- **Atomicità**: l'operazione è ora interamente dentro una transazione Dexie.
  Prima non lo era, nonostante il doc-commento lo dichiarasse: un crash a metà
  lasciava il DB con la track promossa *e* la vecchia, cioè il brano duplicato
  in modo permanente e silenzioso.
- **Determinismo**: sopravvive la track **più vecchia** (primo ascolto), con
  disambiguazione sul `canonicalKey`. Prima dipendeva dall'ordine di
  enumerazione di IndexedDB, che non è garantito (lesson 34-1: stesso input →
  stesso output su ogni piattaforma).
- **Riferimenti**: `library`, `playlistItems` e `features` sono riorientati
  sulla track sopravvissuta; i duplicati (stesso brano già in libreria, già in
  playlist) sono scartati, perché libreria e playlist sono insiemi.
- **Nessuna perdita di dati**: `platformIds`, `genres`, `firstSeenAt`/`lastSeenAt`
  della track perdente vengono uniti a quelli della sopravvissuta. Prima
  sparivano: il brano "uscito" da una piattaforma perdeva la traccia di esservi
  arrivato.
- **ISRC normalizzato** in maiuscole: `isrc:${isrc}` senza normalizzare non
  coincideva con la chiave che calcola la pipeline (`isrc:<ISRC upper>`, `02§5`),
  quindi la promozione non produceva la dedup che prometteva.
- **Contatori dalla fonte di verità**: `rekey()` non somma più i contatori
  memorizzati ma delega a `recount()` (MIG-4). La somma manuale produceva
  numeri che non corrispondevano a nessun ascolto reale.

**Test**: 9 nuovi in `packages/core/src/db/__tests__/rekey.test.ts`, fra cui il
caso esplicito della story (due track `fuzzy:` diverse con lo stesso ISRC →
una sola track), che non era coperto. Corretto anche un test della Story 0.7
che codificava la somma manuale dei contatori.

## Trigger

Issue #160 (`agent-ready`, size S): la Story 1.4 era la prima del backlog con
la spec già 🟢 APPROVED (`02§5`, `05§12.1`) e la sola carenza aperta — la
storia dichiarava AC che l'implementazione esistente non soddisfava.

## Difetti trovati lungo il percorso

**Un `where()` su un indice inesistente fallisce a runtime, non a compile
time.** La prima stesura della fusione usava
`db.library.where('[platform+trackId]')` e
`db.playlistItems.where('trackId')`: entrambe le query sono corrette *in
apparenza* e nessuna delle due esiste nello schema (`02§6`: `library` ha
`trackId` e `platform` separati; `playlistItems` ha solo `[playlistId+trackId]`
e `playlistId`). Dexie fallisce a runtime con "KeyPath ... is not indexed", e
il fallimento sarebbe avvenuto **dentro la transazione**, proprio nel mezzo
della fusione: il DB si sarebbe rotto per un job di manutenzione. Il controllo
preventivo è stato leggere `DB_SCHEMA_V1` prima di scrivere le query — e la
lezione è che **il tipo del DB non ti protegge**: `db.library` è tipizzato
`Table<LibraryItem, string>` e accetta qualsiasi stringa come chiave di indice.

**Il contatore denormalizzato e la fonte di verità erano due cose diverse.**
La Story 0.7 aggregava `listenCount` sommando i valori memorizzati delle due
track (5 + 3 = 8) mentre nel DB c'erano 2 ascolti. Il numero 8 non corrispondeva
a nessun ascolto: era la somma di due numeri che a loro volta potevano essere
stale. `02§7` (MIG-4) dice che `recount()` è l'unica fonte di verità dei
contatori, e `rekey()` ora la delega invece di ricalcolare in proprio.

**Il test che la story scriveva ("due track fuzzy con lo stesso ISRC → una
sola track") era proprio quello che ha trovato il bug della fusione.** Nella
prima stesura, la track promossa veniva riscritta con la **chiave vecchia**
durante la fusione: il risultato era che il DB restava con due track, una
promossa e una tornata `fuzzy:`. Il bug non si vedeva nei test preesistenti
(che coprivano solo la fusione con una track già `isrc:`), perché il caso
"promozione + fusione nella stessa esecuzione" non era mai stato eseguito.

## Verifica

- `pnpm run lint` → verde (3 task)
- `pnpm run typecheck` → verde (3 task)
- `pnpm --filter @ls/core exec vitest run` → **208 test verdi** (18 file, di cui 1 nuovo)
- `pnpm --filter @ls/web exec vitest run` → **81 test verdi** (10 file)
- `pnpm run build` → verde (3 task)
- `pwsh scripts/generate-bundle.ps1 --check` → exit 0
- `pwsh scripts/aggregate-state.ps1 --check` → drift atteso sui blocchi aggregati
  (li rigenera `auto-state-aggregate` post-merge)

## Lesson learned

| # | Osservazione |
|---|----------------|
| 53-1 | **Una funzione "già implementata" può essere una story aperta.** `rekey()` era scritta, esportata e descritta in tre documenti: sembrava fatta. Ma la story ne dichiarava tre AC che l'implementazione non soddisfava, e nessun test copriva il caso centrale (due varianti fuzzy dello stesso brano). Il segnale non è "il file esiste" né "l'export c'è": è **"gli AC della story sono verificabili e qualcuno li verifica"**. Una story con AC non coperti da test è una story aperta, indipendentemente dalle righe di codice |
| 53-2 | **Il tipo del DB non protegge da una query sbagliata.** `db.library.where('[platform+trackId]')` compila, passa il typecheck e fallisce a runtime, dentro la transazione, nel mezzo del lavoro. Gli indici Dexie sono un **contratto separato** dal tipo: va letto lo schema (`02§6`), non dedotto dall'API. Il sintomo peggiore di questo bug non sarebbe stato l'errore, ma il DB rotto da un job di manutenzione |
| 53-3 | **Un contatore denormalizzato che si somma a mano è una seconda fonte di verità.** `5 + 3 = 8` mentre gli ascolti reali sono 2: la somma era formalmente corretta e sostanzialmente falsa. `recount()` esiste proprio per questo (MIG-4): ogni job che tocca i contatori deve **delegare**, non aggregare |
| 53-4 | **Il determinismo è una proprietà del *dato*, non dell'algoritmo.** "Cancella e reinserisci" è un algoritmo corretto; ma *quale* delle due track sopravvive dipendeva dall'ordine in cui IndexedDB le enumerava. Il criterio ("la più vecchia vince") è una **decisione di dominio** — e va scritta nel codice, non lasciata all'osservazione del database |

## Documenti aggiornati

- `packages/core/src/db/rekey.ts` — transazione, determinismo, riorientamento dei
  riferimenti, unione dei campi, ISRC normalizzato, `recount()` delegato
- `packages/core/src/db/__tests__/rekey.test.ts` — **nuovo**: 9 test
- `packages/core/src/db/__tests__/operations.test.ts` — il test della Story 0.7
  aggiornato alla semantica `recount()`
- `docs/05-ARCHITECTURE.md` — §12.1 e §12.2: `rekey()` da "futuro" a "attivo
  (Story 1.4)"
- `docs/16-OPERATIONS.md` — §2.3: forma del report aggiornata + changelog
- `docs/02-DATA-SCHEMA.md` — §5: nota sul job di promozione
- `docs/11-BACKLOG.md` — Story 1.4 completata, rimossa dalla tabella roadmap,
  changelog 1.6.11
- `docs/INDEX.md` — righe `05`, `11`, `16`, `18-DEV-LOG` e "Prossimo passo tecnico"
- `docs/state/stories/1.4-dedup-promotion.md` — **nuovo**
- `docs/state/sessions/53-story-1-4-rekey.md` — **nuovo**
- `docs/18-DEV-LOG.md` — §19 + changelog 1.9
- `scripts/generate-bundle.ps1` — `$files`: i due file di stato nuovi
- `docs/BUNDLE.md` — rigenerato

## Cross-refs

- **#160** — issue della Story 1.4 (chiusa al merge della PR)
- **#39** — PR della Story 0.7, che aveva creato `rekey()` (`20da75d`)
- `docs/02-DATA-SCHEMA.md` §5 — regole DEDUP-1/2/3
- `docs/05-ARCHITECTURE.md` §12.1 — le operazioni di manutenzione
- `docs/16-OPERATIONS.md` §2.3 — l'API `@ls/core/db`
- Prossimo passo: **Story 1.5** (scrobbling hub + sync continua, con il percorso
  incrementale ListenBrainz e il web auth Last.fm: `api_sig` richiede md5, che il
  repo non espone)
