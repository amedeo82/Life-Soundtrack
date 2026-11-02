# 24 — Artwork enrichment

> Status: 🟡 DRAFT (diventa **🟢 APPROVED v1.0** alla ratifica del project owner)
> Versione: 0.1
> Ultima modifica: Sessione 86 (2026-11-02)
> Responsabile: Boss
> Story: **4.3** (`docs/11-BACKLOG.md` §"Story 4.3") · Area: `enrichment` · Size: M · **Priorità P0**
> Origine: `docs/22-COMPETITIVE-POSITIONING.md` §4, §8 (l'artwork è l'ancora visiva; è il moltiplicatore di 3.2 e 3.3)

---

## 🎯 Scopo

Le copertine degli album sono l'**ancora visiva** del diario: senza, la timeline è un elenco di testo e l'app resta uno strumento tecnico invece di un oggetto emotivo. Oggi **non esiste artwork nel repository**: i campi `Track.artworkUrl` e `Album.artworkUrl` ci sono nello schema (aggiunti in `02` v1.2) ma la pipeline di import scrive **sempre `null`** (`packages/core/src/adapters/pipeline.ts:293` per i track, `:495` per gli album), e il componente `MemoryCard` ha solo lo slot vuoto (`apps/web/src/components/MemoryCard.tsx:6–7`, `:59–62`).

Questa spec definisce **come** popolare quei campi, con quale cascata, sotto quale privacy e con quale cache.

> **Fuori perimetro (dichiarato)**: il **colore dominante dell'era** derivato dalle copertine (dipende dall'artwork: si fa dopo, in una story dedicata), il **lookup MusicBrainz** (Story 4.2, P2: serve solo per il ramo Cover Art Archive, che è opzionale), la **cache binaria** delle immagini (v1: si salva l'URL, non i byte).

## 🔍 Stato reale (verificato in Sessione 86)

| Fatto | Dove |
|-------|------|
| `Track.artworkUrl: string \| null` e `Album.artworkUrl: string \| null` esistono | `packages/core/src/schema/index.ts:146`, `:176` |
| La migrazione Dexie **v3** ha aggiunto i campi in modo non distruttivo | `packages/core/src/db/db.ts:56–63`, `:137–148` |
| L'import scrive `artworkUrl: null` | `packages/core/src/adapters/pipeline.ts:293`, `:495` |
| Nessun modulo di artwork, nessuna cache di immagini, nessun `fetch` di copertine | — |
| `MemoryCard` ha la prop `artworkUrl` e mostra uno slot vuoto se manca | `apps/web/src/components/MemoryCard.tsx:14–29`, `:59–62` |
| `EraBand` **non** ha uno slot artwork | `apps/web/src/components/EraBand.tsx:17–33` |
| CSP `img-src`: `'self'`, `data:`, `https:` → **le immagini remote sono ammesse** | `apps/web/src/security/csp.ts:29` |
| CSP `connect-src`: `'self'`, MusicBrainz, AcousticBrainz, iTunes (search + CDN), DB-IP | `apps/web/src/security/csp.ts:30–42` |
| **Cover Art Archive non è in `connect-src`** | `apps/web/src/security/hosts.ts` (manca) |
| iTunes Search API ha già un resolver con rate limit e match esatto | `packages/core/src/enrichment/itunes.ts:154` `createItunesPreviewResolver` |

## 🧭 Cascata delle fonti (proposta)

```
1. iTunes Search API  (nessun auth, già in CSP, 20 req/min)
2. Cover Art Archive  (nessun auth, serve un MBID → Story 4.2, 1 req/s)
3. placeholder gradient generato a runtime (mai rete)
```

> **D-24.2 — la fonte Spotify Web API esce dalla cascata.** La story originale (`11-BACKLOG.md` §4.3) la prevedeva «se utente Spotify-first»: il progetto **non ha** alcuna infrastruttura OAuth per Spotify (l'import è da export ZIP/JSON, non dall'API) e gli export di Spotify **non contengono** URL di copertina. Mantenerla significherebbe costruire un sistema di token che oggi non esiste: si propone di **rimuoverla** e di usare iTunes + Cover Art Archive. Se il Boss preferisce tenere il ramo Spotify, la story si allarga di un'intera integrazione OAuth (da mettere in una story a sé).

> **D-24.4 — l'URL iTunes va trasformato in URL HTTPS stabile.** iTunes restituisce `artworkUrl100` (100×100). Per la timeline serve almeno 300×300: la regola è `replace('100x100bb', '300x300bb')`, con fallback all'URL originale se il pattern non c'è.

## 📐 Contratti da costruire

### Core — `packages/core/src/enrichment/artwork.ts` (nuovo)

```ts
export type ArtworkSource = 'itunes' | 'coverartarchive' | 'placeholder' | 'none';

export interface ArtworkDeps {
  readonly http: HttpClient;                 // lo stesso client della pipeline audio
  readonly limiter: RateLimiter;             // 1 req/s per Cover Art Archive
  readonly clock: Clock;
  readonly logger?: Logger;
  readonly itunesEndpoint?: string;          // default: ITUNES_SEARCH_ENDPOINT
  readonly coverArtEndpoint?: string;        // default: COVER_ART_ENDPOINT
}

export interface ArtworkRequest {
  readonly trackId: string;
  readonly trackName: string;
  readonly artistName: string;
  readonly albumName: string | null;
  readonly albumId: string | null;
  readonly mbid: string | null;
}

export interface ArtworkOutcome {
  readonly source: ArtworkSource;
  readonly url: string | null;        // null => placeholder
  readonly reason?: string;           // es. 'not_found', 'http_429', 'no_match'
}

export async function fetchArtworkUrl(
  request: ArtworkRequest,
  deps: ArtworkDeps,
): Promise<ArtworkOutcome>;
```

Comportamento richiesto:

1. **iTunes** (`GET {itunesEndpoint}?term={trackName}+{artistName}&entity=song`): match **esatto** (titolo + artista normalizzati, come `itunes.ts:110–122`); si prende `artworkUrl100` → `artworkUrl600` (D-24.4); `result.artistName`/`collectionName` devono combaciare con la richiesta.
2. **Cover Art Archive** (`GET {coverArtEndpoint}/{mbid}`): si usa **solo** se `request.mbid` è presente; si prende `images[0].url` (o la prima entry con `front`); 404 ⇒ `not_found`; 429 ⇒ `http_429` e **nessun retry** (il limiter governa).
3. **placeholder**: nessuna rete — un **gradient deterministico** derivato dall'hash di `trackId`, con la palette mood di `design/tokens.json` (`color.mood.*`). Il risultato è un **data URI** (`data:image/svg+xml;base64,…`), così nessun host esterno serve l'immagine e il placeholder funziona offline.

### Storage — dove finisce il risultato

- `Track.artworkUrl` ← URL o data URI del placeholder;
- `Album.artworkUrl` ← lo stesso, **una volta per album** (deduplicazione per `albumId`).

> **D-24.3 — nessuna migrazione dello schema**: l'artwork già «tentato e non trovato» viene ricordato con un **cursore in `settings`** (`artwork.cursor`), come già avviene per lo scrobbling (`SCROBBLE_CURSOR_LISTENBRAINZ_KEY = 'scrobble.cursor.listenbrainz'`, `packages/core/src/db/settings.ts:23–45`). Un tracciato senza artwork non viene interrogato di nuovo. **Alternativa** (schema v7 + `artworkResolvedAt` su Track/Album): più pulita, ma impone una migrazione Dexie e il bump di `fastCheck` (`db/health.ts:45`, default 6) **e** di `apps/web/src/hooks/useDbHealth.ts:15` (che oggi è fermo a 4 — drift da correggere comunque).

### Politica di rete e privacy

| Vincolo | Applicazione |
|---------|--------------|
| Toggle `enrichMetadata` | è il **primo** check, prima di ogni accesso (come la cascade audio: `enrichment/cascade.ts:181`). Con toggle spento: **zero** uscite, **zero** scritture, **zero** letture della cache (`21§10.4`) |
| Cosa esce | iTunes riceve **nome del brano e dell'artista** (le scelte di ascolto dell'utente: dato personale, non identificativo); Cover Art Archive riceve **un MBID di release** (identifica una release, non l'utente) |
| Cosa non esce | **mai** l'elenco degli ascolti, il catalogo, gli IP, le chiavi |
| Cache | la cache è **locale** (Dexie): URL e data URI |
| Offline | il placeholder funziona offline; le immagini remote no (il degrade è il placeholder) |

### Rate limiting

- iTunes: **20 req/min** (intervallo fisso 3 s) — il limiter esistente (`rateLimiter.ts:36`, `:109–115`);
- Cover Art Archive: **1 req/s** (stessa disciplina di MusicBrainz, `21§7.2`).

### CSP (obbligo tecnico)

- `connect-src` **deve** aggiungere `https://coverartarchive.org` — nuova costante `COVER_ART_HOST` in `apps/web/src/security/hosts.ts` (la costante dedicata è ciò che permette al test della CSP di dimostrare che non entra nessun altro host);
- `img-src` **non va modificata** (`https:` è già ammesso);
- il test della CSP (`apps/web/src/security/__tests__/csp.test.ts`) **deve** essere aggiornato con il nuovo host, e `docs/12-DEVOPS.md` §2.1 (v1.1) deve elencarlo — la lezione dell'issue #196 (host dichiarato nella spec **e** nella CSP applicata) si ripete.

## 🖼️ UI

| Punto | Modifica |
|-------|----------|
| `MemoryCard` | usa già `artworkUrl`: nessuna modifica strutturale; **aggiungere** l'`alt` e il `loading="lazy"` (a11y + performance) |
| `EraBand` | **proposta**: mostrare la copertina del brano più ascoltato dell'era come sfondo sfumato (D-24.5 — opzionale, valutabile in review) |
| Timeline | nessun componente nuovo obbligatorio: la banda dell'era usa il colore del mood (invariato) |
| Nuovi componenti | nessuno in v1 |

## 🧪 Test

| Livello | File | Cosa copre |
|---------|------|-----------|
| unit (core) | `packages/core/src/enrichment/__tests__/artwork.test.ts` | iTunes match esatto → URL 600; nessun match → `not_found`; Cover Art Archive con MBID → URL; 404 → fallback; 429 → `http_429` e **nessun retry**; senza MBID il ramo non parte |
| unit (core) | idem | placeholder **deterministico**: stesso `trackId` → stesso data URI; nessuna rete (http mock che fallisce se chiamato) |
| unit (core) | idem | toggle spento ⇒ **zero** chiamate HTTP |
| integrazione (core) | `packages/core/src/enrichment/__tests__/artwork-persistence.test.ts` | scrittura su `Track.artworkUrl` e `Album.artworkUrl`; deduplicazione per album |
| unit (app) | `apps/web/src/security/__tests__/csp.test.ts` | `coverartarchive.org` in `connect-src`; **nessun** altro host nuovo |
| integrazione (app) | `apps/web/src/components/__tests__/memory-card-artwork.test.tsx` | `alt` e `loading="lazy"`; placeholder quando `artworkUrl` è null |

Fixture: il pattern esistente `fixtures/api-mocks/itunes/*.json` va esteso con un `itunes/search-artwork.json`; aggiungere `fixtures/api-mocks/coverartarchive/{release-with-images,release-404}.json`.

## ✅ Acceptance criteria

- [ ] `fetchArtworkUrl` esiste in `@ls/core/enrichment` ed è coperto da test (le 6 caselle della tabella sopra)
- [ ] La cascata è **iTunes → Cover Art Archive → placeholder**, e il ramo Spotify **non** esiste (D-24.2 ratificata)
- [ ] Con `enrichMetadata = false`: **zero** richieste di rete, **zero** scritture
- [ ] `Track.artworkUrl` e `Album.artworkUrl` vengono popolati; l'import continua a scrivere `null` (l'arricchimento è un job separato)
- [ ] Il placeholder è **deterministico** e non richiede rete
- [ ] `coverartarchive.org` è in `connect-src` **sia** nella CSP applicata **sia** in `docs/12-DEVOPS.md` §2.1, e il test della CSP dimostra che non entra nessun altro host
- [ ] Il rate limit è rispettato: iTunes 20/min, Cover Art Archive 1 req/s
- [ ] `MemoryCard` renderizza l'artwork con `alt` e `loading="lazy"`, e il placeholder quando manca
- [ ] Il ramo Cover Art Archive è **opzionale**: senza MBID (Story 4.2 non fatta) il risultato è comunque un artwork (iTunes o placeholder)

## 📋 Task

- T24.1 — `packages/core/src/enrichment/artwork.ts`: resolver con cascata, placeholder deterministico, rispetto del toggle
- T24.2 — Costante `COVER_ART_HOST` in `apps/web/src/security/hosts.ts` + `connect-src` in `csp.ts` + test CSP
- T24.3 — Persistenza: scrittura su `Track`/`Album` + cursore in `settings` (`artwork.cursor`) + deduplicazione per album
- T24.4 — Trigger: job di arricchimento artwork in coda, dopo l'import (stessa disciplina della coda audio: budget, interruzione)
- T24.5 — UI: `MemoryCard` con `alt` + `loading="lazy"`; (opzionale) sfondo dell'`EraBand` (D-24.5)
- T24.6 — Fixture `fixtures/api-mocks/itunes/search-artwork.json` e `fixtures/api-mocks/coverartarchive/*`
- T24.7 — Allineamento documentale: `docs/02-DATA-SCHEMA.md` §11 (aggiornare la cascata: via Spotify, ordine nuovo), `docs/05-ARCHITECTURE.md` §6, `docs/12-DEVOPS.md` §2.1, `docs/INDEX.md`, `docs/11-BACKLOG.md` §4.3, `docs/state/stories/4.3-*.md`

## 🧾 Decisioni proposte

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-24.1 | L'artwork diventa **P0** e **perde** il vincolo `[DEP:4.2]` | Le copertine sono l'ancora visiva e non attendono il lookup MusicBrainz: iTunes + placeholder bastano (`22-COMPETITIVE-POSITIONING.md` §8, §15) |
| D-24.2 | Il ramo **Spotify Web API** esce dalla cascata | Il progetto non ha OAuth per Spotify e gli export non contengono copertine: il ramo sarebbe codice morto |
| D-24.3 | Il tracciato "artwork tentato e non trovato" si ricorda con un **cursore in `settings`**, senza migrazione dello schema | Coerente col cursore dello scrobbling; evita il DB v7 (che richiederebbe il bump di `fastCheck` e la correzione del drift `useDbHealth`) |
| D-24.4 | `artworkUrl100` → `artworkUrl600` con fallback all'URL originale | 100×100 è illeggibile in una card 1080×1350 |
| D-24.5 | L'`EraBand` mostra la copertina come sfondo sfumato | È il "capitolo visuale" delle ere (`22` §10); **opzionale**, valutabile in review |
| D-24.6 | In v1 si salva **l'URL**, non i byte dell'immagine | La cache binaria è un'altra storia (Cache Storage, invalidazione, quota): tenerla fuori riduce il rischio |

## 🚧 Cosa NON è in scope

- La **cache binaria** delle immagini e il funzionamento offline delle copertine reali (D-24.6).
- Il **colore dominante dell'era** (dipende dall'artwork: story separata).
- Il **lookup MusicBrainz** (Story 4.2, P2) — il ramo Cover Art Archive è progettato per funzionare anche senza.
- L'**OAuth Spotify** (D-24.2).
- Il **packaging** delle copertine nella card condivisibile (Story 3.2): userà gli URL già populati.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 86 (2026-11-02) | Prima stesura: stato reale (nessun artwork nel repository), cascata proposta (iTunes → Cover Art Archive → placeholder), contratti del resolver e della persistenza, obbligo CSP, piano di test, D-24.1…D-24.6 |

---

*Questo documento diventa vincolante (🟢 APPROVED v1.0) alla ratifica del project owner.*
