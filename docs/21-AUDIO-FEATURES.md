# 21 — Pipeline audio features (provider, privacy, stoccaggio, costi)

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 62 (2026-10-28)
> Issue: #187 (questa spec) · #188 (implementazione della Story 4.1) · #180 (la Story 2.1 che questa spec sblocca) · Story: 4.1 (`11-BACKLOG.md`)
> Spec collegata a: `04-ANALYSIS-ALGORITHMS.md` §3, §11, §12 · `05-ARCHITECTURE.md` §6, §6.1, §6.2, §9, §10 · `02-DATA-SCHEMA.md` §3.4, §3.8, §6 · `09-PRIVACY-SECURITY.md` §3, §4, §7.4, §10 · `10-TESTING.md` §2, §7, §8 · `12-DEVOPS.md` §2.1
> Precedente di struttura: `20-SCROBBLING-HUB.md` (una spec di protocollo, non un adapter)
> Decisioni aperte: **D-AF.1 … D-AF.9**, da chiudere come proposte alla ratifica (§3)

---

## 1. Il problema e il perimetro

La Story 4.1 è la **pipeline di arricchimento audio**: trasforma "un brano di cui
l'utente conosce solo il nome" in "un brano di cui l'utente conosce anche
l'intensità, la positività, il BPM, la tonalità". È il livello 2
(`05§2`), quello che sta **sotto** il motore di analisi e **sopra** l'import.

La sua importanza non è autonoma: **senza questa pipeline la Story 2.1 (Mood
Tracker) non può produrre niente**. `04§3.3` legge `getAudioFeatures(e.trackId)`
e, sotto i 3 eventi con `valence`, restituisce `null`; la decisione **D-A.1**
(`04§11`) ha esplicitamente escluso di consegnare la 2.1 con un fallback su
segnali inventati, perché sarebbe un falso verde. La catena è quindi:

```
4.1 (audio features)  →  2.1 (mood)  →  2.2 (ere) / 2.3 (eventi)
```

`04§12` lo dice senza reticenza: *"L'EPIC 4.1 ha bisogno di una spec propria
(come la Story 1.5 ebbe `20-SCROBBLING-HUB.md`): il provider delle audio
features (Essentia.js), il suo costo, la privacy delle feature e il loro
stoccaggio sono decisioni che non appartengono a `04`."*

**Perimetro di questa spec**: il contratto del provider, la cascata e i suoi
trigger, la mappatura dei campi di `AudioFeatures` (`02§3.4`) per ogni
provider, la normalizzazione, la privacy e la rete, lo stoccaggio e la sua
invalidazione, i costi reali (bundle, modelli, rate limit), il contratto con il
layer di analisi, i test e i fixture, e i criteri di accettazione riscritti
della Story 4.1.

**Fuori perimetro**: l'arricchimento dei **generi** (backfill dei generi
mancanti dal catalogo), il **lookup MusicBrainz** (è la Story 4.2, da cui
questa spec dipende solo per il ramo AcousticBrainz) e l'**artwork** (Story 4.3,
che ha una sua cascata già specificata). Questa spec non implementa niente:
è il documento che rende la Story 4.1 implementabile senza altre decisioni.

---

## 2. Le premesse che la story non dichiarava

La Story 4.1 ha solo quattro acceptance criteria e un riferimento implicito a
`05§6`. Scrivendo la spec sono emerse **cinque premesse** che la cascata
dichiarata non copre. Le prime tre sono **fatti verificati** (le fonti sono in
§2.6); le ultime due sono conseguenze strutturali.

### 2.1 La PWA non ha l'audio: nessun provider può fare analisi acustica senza una fonte

`05§6` scrive: *"Essentia.js (WASM) in-browser — provider di default quando è
disponibile un preview audio (30s) dal catalogo"*. Ma **quale** catalogo? La
risposta non è nel repo, e la risposta non è ovvia: l'app importa **metadati**
(export di Spotify, YouTube Music, Apple Music, Last.fm, ListenBrainz) e non
file audio. Una PWA non ha accesso alla libreria musicale dell'utente.

Le fonti di un brano di 30 secondi oggi sono tre, e solo una è percorribile:

| Fonte | Stato verificato | Costo | Vincolo |
|-------|------------------|-------|---------|
| **Spotify preview URL** | **morto**: le app registrate dopo il 27/11/2024 ricevono 403 su `audio-features` e sui preview multi-get | — | escluso |
| **Apple Music (MusicKit)** | esiste, ma richiede un account Developer a **99 $/anno** e dà 30 s di preview | 99 $/anno | escluso per un progetto personale |
| **iTunes Search API** | **viva e senza autenticazione**: `GET https://itunes.apple.com/search?term=<brano>&artist=<artista>&entity=song` restituisce fra l'altro `previewUrl` (AAC `.m4a`, 30 s) | gratis | rate limit documentato (~20 req/min) |

Verificato il 2026-10-28: la ricerca iTunes per "daft punk" restituisce
`previewUrl = https://audio-ssl.itunes.apple.com/.../mzaf_6906185026678279401.plus.aac.p.m4a`.
L'host del CDN (`audio-ssl.itunes.apple.com`) **non** è oggi in `connect-src`
(`12§2.1`): la pipeline non può scaricare il preview senza una modifica della
CSP.

**Conseguenza**: la copertura di Essentia.js è **legata alla disponibilità del
preview**, non al catalogo dell'utente. Un brano senza preview in iTunes resta
senza feature acustica e scende al ramo successivo della cascata. Questo è un
dato che la UI deve poter mostrare all'utente ("nessun audio disponibile per
questo brano"), non un errore.

### 2.2 Spotify `audio_features` non è un provider: è morto per le nuove app

La premessa è già in `05§6` ("Spotify ha deprecato le audio-features (nov
2024)"), ma la portata è maggiore di quanto la spec suggerisca:

- il **27 novembre 2024** Spotify ha deprecato `audio_features`,
  `audio_analysis`, `recommendations`, `related_artists` e le playlist
  editoriali: le **nuove app ricevono 403**;
- nel **febbraio 2026** la Web API è stata ulteriormente ristretta (developer
  mode con cap e requisiti più severi);
- a **ottobre 2026** non esiste un sostituto ufficiale, e il progetto non ha
  annunciato ritorni.

Il punto che qui conta: **non esiste un percorso "chiediamo a Spotify le
audio features"**. La Story 4.1 non ha un provider "ovvio" già pronto: o si
analizza il segnale audio localmente (Essentia.js), o si accetta un dataset
precalcolato di terze parti (AcousticBrainz), o si stima (euristico). Questo
sposta l'intera story da "integrazione" a "scelta di un motore di inferenza".

### 2.3 AcousticBrainz dà classi `mood_*` e `danceability`, **non** `valence` ed `energy`

Il ramo AcousticBrainz della cascata è reale e funzionante — l'API è **viva**
(verificata il 2026-10-28 con una risposta 200 su
`GET /api/v1/<mbid>/high-level`), ma il **contenuto** non è quello che il mood
tracker aspetta.

Il documento `high-level` di AcousticBrainz contiene classificatori
MusicNN: `mood_happy`, `mood_sad`, `mood_relaxed`, `mood_party`,
`mood_aggressive`, `mood_acoustic`, `mood_electronic`, `danceable`,
`gender`, più i generi (`genre_dortmund`, `genre_electronic`, …), `timbre`,
`tonal_atonal`, `voice_instrumental`. Il documento `low-level` contiene
BPM, tonalità, loudness e descrittori spettrali.

Non c'è un campo `valence` né un campo `energy`. E non ci sono in nessun
provider oggi: **valence ed energy sono concetti di Spotify** (Echo Nest), e
nessuno li espone nativamente. Chi li produce oggi li **deriva**:

- **Essentia.js** ha i *classification heads* `deam-msd-musicnn-2`,
  `muse-msd-musicnn-2`, `emoMusic-msd-musicnn-2`, che restituiscono
  `valence` e `arousal` sull'intervallo **[1, 9]** (non [0, 1]);
- **AcousticBrainz** dà le classi mood, da cui valence/energy si possono
  derivare per combinazione lineare (ma è una **derivazione**, non una
  misura).

Ne segue che la specifica deve dichiarare, per ogni campo di `AudioFeatures`,
**se è misurato, derivato o stimato**. `02§3.4` scrive solo "0..1
positività emotiva": la specifica del provider è il posto dove quella
distinzione vive.

### 2.4 `essentia.js` è AGPL-3.0 e l'app è Apache-2.0: il bundling cambia la licenza

Verificato il 2026-10-28 sull'API di npm: `essentia.js@0.1.3` è licenziato
**AGPL-3.0** (`license: "AGPL-3.0"`), mentre il repository dell'app è
**Apache-2.0** (`LICENSE`).

AGPL-3.0 e Apache-2.0 non sono combinabili in un'opera distribuita con una
sola licenza: il codice permissivo può entrare in un'opera AGPL, ma l'opera
combinata distribuita agli utenti (la PWA è servita ai browser, quindi
distribuita) deve essere sotto AGPL-3.0, con l'obbligo di offerta del
sorgente. Per un'applicazione personale open-source il costo è più legale che
tecnico, ma è una **decisione del Boss**, non un dettaglio implementativo: nessun
agente può cambiare la licenza di un repository per conto proprio.

Le alternative sono tre, e vanno messe sul tavolo con i loro costi:

| Opzione | Costo | Perdita |
|---------|-------|---------|
| **(a) L'app passa ad AGPL-3.0** | Licenza del repo da cambiare; il bundle deve servire il sorgente | Nessuna perdita funzionale |
| **(b) Essentia.js non entra nel bundle** | Il provider acustico locale sparisce | Il ramo Essentia della cascata diventa irrealizzabile |
| **(c) Essentia.js in un processo separato, non distribuito** | Il calcolo non può girare nel browser | Non è una PWA: uccide l'ipotesi local-first |

La spec **propone (a)** e chiede la ratifica (§3, D-AF.2). Nota: il runtime
TensorFlow.js è **Apache-2.0** (`@tensorflow/tfjs@4.22.0`), quindi è il solo
`essentia.js` a imporre il cambio.

### 2.5 Il budget del bundle iniziale è 300 KB gzip: il WASM non ci entra, e non deve

`05§10` fissa "Bundle iniziale < 300 KB gzip (worker, D3, WASM lazy)". Il
"lazy" è già nella parentesi, ma nessuno ha mai misurato quanto sia "lazy" in
termini di byte. I numeri reali, verificati il 2026-10-28:

| Componente | Dimensione | Note |
|------------|-----------|------|
| `essentia.js@0.1.3` (npm) | **2,69 MB** tarball · **10,14 MB** unpacked | contiene il WASM (`essentia-wasm.web.wasm`) + il glue JS |
| Backbone MusicNN (TFJS) | **3,19 MB** (`group1-shard1of1.bin`) + 31 KB (`model.json`) | `mood_happy-musicnn-msd-2` misurato nel repo essentia.js |
| Classification head (DEAM / MuSe / emoMusic) | **82 KB** ciascuno | testa di classificazione sul backbone |
| `@tensorflow/tfjs@4.22.0` | **147,5 MB** unpacked (il `tfjs-core` sono 37,1 MB, `tfjs-backend-wasm` 13,2 MB) | solo i pacchetti necessari vanno importati |
| **Totale di un percorso Essentia minimo** | **~6 MB** (WASM + backbone + head + TFJS) | **20× il budget del bundle iniziale** |

Quindi: il WASM e i modelli **non possono stare nel bundle iniziale**, e non
possono stare nel **precache** del service worker (`12§2.1`: `globPatterns:
['**/*.{js,css,html,svg,png,ico,webmanifest}']` — il `.wasm` non è incluso,
il che è corretto). Devono essere:

1. **scaricati su richiesta**, quando l'utente attiva l'arricchimento;
2. **messi in cache** nel Cache Storage del browser, con una strategia
   `CacheFirst` per l'host dei modelli;
3. **versionati** dalla `schemaVersion` di `AudioFeatures` (`02§3.4`, `05§6.2`),
   così un cambio di modello invalida le feature e non lascia pesi vecchi in
   cache.

Il costo per l'utente è reale: ~6 MB una volta, poi in cache. Va detto nella
UI, prima del download (consenso informato, §10).

---

## 3. Le decisioni da chiudere alla ratifica

Il precedente di `20-SCROBBLING-HUB.md` chiude le decisioni "come proposte"
nella spec e le ratifica con il merge. Le nove decisioni qui sotto seguono lo
stesso statuto: **proposte**, da ratificare con il merge della PR.

| # | Decisione | Scelta proposta | Motivazione |
|---|-----------|-----------------|-------------|
| **D-AF.1** | **Da dove arriva l'audio** per il provider acustico | Il **preview di 30 s dell'iTunes Search API** (`previewUrl`), scaricato e decodificato in memoria | È l'unica fonte gratuita, senza autenticazione e senza account a pagamento (§2.1). Il percorso alternativo (file forniti dall'utente) è un progetto separato |
| **D-AF.2** | **Il regime di licenza** dell'app | L'app passa da **Apache-2.0 a AGPL-3.0** | `essentia.js` è AGPL-3.0 e il bundle è distribuito ai browser (§2.4). Rinunciare a Essentia (opzione b) lascia la cascata senza provider acustico e la 2.1 senza feature reali |
| **D-AF.3** | **Il modello per valence/energy** | **DEAM** (`deam-msd-musicnn-2`, 1.802 brani, CCC 0,647 su valence) | Il dataset più ampio e la correlazione migliore fra i tre disponibili (emoMusic: 1.000 brani, CCC 0,622). `energy` = `arousal` normalizzato |
| **D-AF.4** | **Il fallback euristico e D-A.1** | L'euristico **non alimenta il mood tracker**: il layer di analisi legge solo `source ∈ {essentia, acousticbrainz, manual}`. L'euristico serve la UI (copertura 100%) ed è etichettato come stima | `04§11` (D-A.1) esclude i segnali inventati dalle letture di umore. `05§6` lo mette in cascata per la copertura, non per l'analisi: le due cose non si contraddicono se il consumo è separato |
| **D-AF.5** | **Dove vive il codice** | `packages/core/src/enrichment/` **senza React**: il core espone porte e orchestratore puri; `apps/web` fornisce l'implementazione HTTP e lo stato per la UI | `05§9.2` dichiara `@ls/core` foglia runtime-agnostic ( gira anche nel Worker) e `05§9` colloca lì un modulo annotato "React Query": le due cose non possono stare insieme. React Query resta nel web, per la UI |
| **D-AF.6** | **Il rate limiting** | **MusicBrainz**: 1 req/s (AC della Story 4.1, valore noto e pubblicato). **AcousticBrainz**: il limite **si legge dagli header** `X-RateLimit-Limit` / `-Remaining` / `-Reset-In`, senza costanti | Il limite AB non è stabile: la documentazione dice "tipicamente 10 query ogni 10 secondi per IP", ma il 28/10/2026 la risposta live diceva `Limit: 100`, `Remaining: 99`, `Reset-In: 2`. Un valore hard-coded sbaglierebbe in entrambe le direzioni |
| **D-AF.7** | **I trigger e il budget** | Confermati i tre trigger di `05§6.1` (on-import, on-demand, scheduled idle), con **concurrency 1** e **budget 5 min/giorno**; l'on-import **non** attende la rete (si popola in background) | `05§6.1` è APPROVED e dice "l'arricchimento non blocca mai l'import": la specifica non può indebolirlo. La concurrency 1 evita di saturare il rate limit di MB/AB |
| **D-AF.8** | **Il `source` delle feature derivate** | Una feature derivata da un classificatore (AB mood → valence/energy) resta `source: 'acousticbrainz'`, con la derivazione dichiarata in questo documento | `02§3.4` è APPROVED e chiude `source` a quattro valori: non si può aggiungere `'derived'`. La trasparenza la dà il documento, non il valore |
| **D-AF.9** | **La rete consentita** (CSP) | `connect-src` aggiunge `https://acousticbrainz.org` e `https://audio-ssl.itunes.apple.com` | Sono gli unici due host nuovi. `12§2.1` è DRAFT e può essere aggiornato; la modifica va nella stessa PR di implementazione |

**Punti che restano al di sopra di questa spec** (non sono decisioni
implementabili): la **politica editoriale** dei testi pubblici (non in questa
spec) e la **ratifica** delle nove decisioni.

---

## 4. Il contratto: `AudioFeatureProvider`

### 4.1 Il tipo

Il provider è un **porta**, non un adapter: non ha bisogno di credenziali
(quindi non è un `PlatformAdapter` di `03-ADAPTERS/SPEC-TEMPLATE.md`) e non
produce `ListenEvent`. Produce `AudioFeatures`.

```ts
/** Una fonte di audio features per un brano. 21-AUDIO-FEATURES.md §4. */
export interface AudioFeatureProvider {
  /** Identificatore stabile del provider: coincide con `AudioFeatures.source`. */
  readonly id: AudioFeatures['source'];
  /**
   * True se il provider può rispondere per questo brano, senza farlo.
   * Serve a skippare un ramo della cascata senza tentativi ed errori.
   */
  canHandle(track: Track): boolean;
  /**
   * Calcola le feature del brano. Non deve scrivere sul DB: la persistenza
   * è compito della cascata (`§5`), così il provider resta puro e testabile.
   */
  fetch(track: Track): Promise<AudioFeatures | null>;
}
```

`AudioFeatures` è **APPROVED** (`02§3.4`) e non si modifica: il provider
restituisce esattamente quel tipo, con `trackId` valorizzato e `fetchedAt` /
`schemaVersion` riempiti dalla cascata.

### 4.2 Le garanzie che il contratto promette

1. **Puro**: `fetch` non scrive sul DB e non parla con la UI. Riceve tutto
   via dipendenze iniettate (`fetch`, clock, logger).
2. **Mai throws**: un provider che fallisce restituisce `null` (o lancia un
   errore tipizzato che la cascata traduce in `null` + log). Il fallimento di
   un ramo non può interrompere gli altri: è la regola di `05§7.2`
   ("failure isolation") applicata al livello 2.
3. **Deterministico a parità di input**: stessi brano, stessi parametri,
   stesso risultato — è ciò che rende `schemaVersion` sufficiente come
   criterio di invalidazione (`05§6.2`).
4. **Dichiara la sua fonte**: ogni feature prodotta porta il `source` del
   provider che l'ha prodotta, e i campi che quel provider **non** misura
   restano `null` invece di essere inventati.
5. **Nessun dato utente in uscita**: i provider non inviano timestamp,
   ascolti, né identificativi dell'utente. Solo identificatori del brano
   (`09§3.3`).
6. **Idempotente**: due chiamate sullo stesso brano producono la stessa
   feature (salvo `fetchedAt`).

### 4.3 Dove vive il codice

```
packages/core/src/enrichment/
├── index.ts             # barrel pubblico (@ls/core/enrichment)
├── types.ts             # AudioFeatureProvider, FeatureRequest, esiti
├── cascade.ts           # orchestratore della cascata (§5)
├── mapping.ts           # normalizzazione dei campi 02§3.4 (§6.2, §7.3)
├── essentia.ts          # provider WASM (lazy, §6)
├── acousticbrainz.ts    # provider HTTP su MBID (§7)
├── heuristic.ts         # fallback euristico (§8)
└── __tests__/           # unit + integrazione (mock, §15)
```

`packages/core/package.json` riceve il subpath `"./enrichment"` (come
`./analysis`, aggiunto dalla Story 2.4). Il core resta **senza React**: la
cascata riceve `fetch` e logger come dipendenze iniettate, così i test non
toccano la rete (`10§8`: *"Mai chiamate reali in CI"*).

---

## 5. La cascata

### 5.1 L'ordine e i salti

La cascata di `05§6` (APPROVED) è la sequenza **cache → Essentia.js →
AcousticBrainz → euristico**. La specifica ne precisa il comportamento:

```
per ogni brano senza feature:
  1. CACHE      → se esiste una feature valida (schemaVersion corrente,
                   TTL non scaduto, source ≠ 'heuristic' se l'analisi la
                   consumerà), si usa e si esce
  2. ESSENTIA   → se c'è un preview audio disponibile (§2.1) e il motore WASM
                   è caricato: analisi locale, source = 'essentia'
  3. ACOUSTICBRAINZ → se il brano ha un MBID (Story 4.2): lookup, source =
                   'acousticbrainz'
  4. EURISTICO  → stima dai metadata, source = 'heuristic'
  5. NIENTE     → nessuna feature: l'analisi degrada (§12)
```

Tre precisazioni:

- **Il ramo Essentia è condizionato dall'audio**, non dal brano: senza
  preview il ramo salta, e non è un errore (§2.1).
- **Il ramo AcousticBrainz è condizionato dall'MBID**: senza MBID salta. La
  Story 4.2 è il prerequisito; senza di lei il ramo non parte mai e la
  pipeline degrada al ramo 4.
- **Il ramo euristico è sempre disponibile** (copre il 100% del catalogo,
  `05§6`): è l'unico ramo che non può fallire.

### 5.2 I trigger

Confermati i tre trigger di `05§6.1`, con le regole di D-AF.7:

| Trigger | Quando | Comportamento |
|---------|--------|---------------|
| **on-import** | a import committato | per ogni `trackId` nuovo senza feature: si **accodano** (non si eseguono) |
| **on-demand** | l'utente apre una vista di analisi | refresh lazy delle feature mancanti dei brani in vista |
| **scheduled** | idle (`requestIdleCallback`), max 5 min/giorno | backfill in batch delle feature mancanti |

Regole comuni:

- **mai bloccante**: l'import non attende la rete; l'on-import si limita a
  mettere in coda.
- **concurrency 1**: un brano alla volta (l'analisi audio è CPU-bound e le
  API hanno rate limit).
- **budget giornaliero**: 5 minuti/giorno, come `05§6.1`; il job interrotto
  riprende al trigger successivo (è idempotente).
- **interrompibile**: un brano in corso può essere abbandonato se l'utente
  chiude la app; la feature parziale **non** viene scritta.

### 5.3 "Non blocca mai l'import"

`05§6.1` è categorico: *"se Essentia o AB falliscono, si cade immediatamente al
fallback euristico, e l'utente vede i risultati senza attendere"*. La
specifica lo traduce in regole osservabili:

1. l'import non ha un hook di attesa della rete;
2. ogni errore di provider è **loggato e convertito in `null`**;
3. la cascata non fa più di **un tentativo per ramo** per brano (nessun
   retry inline: il retry è un trigger successivo);
4. l'utente vede lo stato della pipeline ("12 brani senza feature: nessun
   audio disponibile") **nella UI**, non un errore bloccante — coerente con
   `06§5` ("Errore enrichment: silenzioso; dati salvati senza audio features;
   avviso aggregato in Settings").

---

## 6. Il provider Essentia.js (WASM)

### 6.1 I modelli e la mappatura

Essentia espone un **backbone** (MusicNN, un CNN addestrato su MusicBrainz) e
dei **classification head** lineari che lo specializzano. Per valence/energy
i tre head disponibili sono:

| Head | Dataset | Addestramento | Uscita | Metrica dichiarata |
|------|---------|---------------|--------|--------------------|
| `deam-msd-musicnn-2` | DEAM (1.802 brani) | trasferimento da MusicNN | `valence`, `arousal` in **[1, 9]** | CCC 0,647 (valence) |
| `muse-msd-musicnn-2` | MuSe | idem | `valence`, `arousal` in **[1, 9]** | — |
| `emoMusic-msd-musicnn-2` | emoMusic (1.000 brani) | idem | `valence`, `arousal` in **[1, 9]** | CCC 0,622 (valence) |

Per `danceability` esiste `danceability-msd-musicnn-1` (uscita
`danceable`/`not_danceable` con probabilità).

**Proposta (D-AF.3): DEAM.** Il dataset più ampio e la correlazione migliore.

La mappatura verso `AudioFeatures` (`02§3.4`):

| Campo `02§3.4` | Da Essentia (DEAM) | Tipo |
|-----------------|---------------------|------|
| `valence` | `valence` normalizzata da [1,9] a [0,1] | **misurata** |
| `energy` | `arousal` normalizzata da [1,9] a [0,1] | **misurata** ( arousal ≈ energy) |
| `danceability` | `danceable` (probabilità 0..1) | **misurata** |
| `tempo` | `RhythmExtractor2013` → BPM | **misurata** |
| `key` / `mode` | `KeyExtractor` → key 0..11 + scale | **misurata** |
| `loudness` | `LoudnessExtractor` → dB | **misurata** |
| `timeSignature` | `RhythmExtractor2013` | **misurata** |
| `acousticness`, `instrumentalness`, `speechiness`, `liveness` | `null` | **non coperte** |

L'ultima riga è importante: `02§3.4` li prevede tutti, ma **nessun provider
li produce onestamente** in questa tranche. Il regola è quella di `04§1.4`
("le feature mancanti degradano"): un campo non misurato resta `null`, non
approssimato. Inventare `instrumentalness` per riempire la riga sarebbe
falsificare la misura.

### 6.2 La normalizzazione

I classification head restituiscono valori in **[1, 9]**, mentre `02§3.4`
vuole **[0, 1]**. La normalizzazione è lineare e va dichiarata:

```
normalized = (value - 1) / (9 - 1)      →  [1,9] ⟶ [0,1]
```

con arrotondamento a 4 decimali (determinismo: stesse feature, stessi byte).
Il valore grezzo non viene persistito: `AudioFeatures` (`02§3.4`) ha i soli
campi 0..1 e non ammette campi aggiuntivi.

L'invariante di `10§7` ("`valence ∈ [0, 1]` per ogni audio feature") è quindi
**garantita per costruzione**, e resta un property-based test.

### 6.3 Il costo

I numeri sono in §2.5. Sintesi per la UI e per il dimensionamento:

- **download una tantum**: ~6 MB (WASM 2,7 MB compressi + backbone 3,2 MB +
  TFJS + head 82 KB), messo in cache;
- **tempo di calcolo**: dell'ordine di 1–3 s per brano su un laptop medio
  (l'analisi MusicNN su 30 s di audio + l'inferenza). Da **misurare** nella
  tranche di implementazione: il numero va nel fixture, non nella promessa.
- **memoria**: il runtime TFJS alloca decine di MB per l'inferenza: va
  verificato su
  un device mobile medio, e il fallback (skip del provider) deve esistere.

Il tempo per brano è il vero collo di bottiglia della pipeline: con 10.000
brani e 2 s per brano, il backfill completo sono ~5,5 ore. Per questo
l'on-demand esiste (`05§6.1`): l'utente vede le feature dei brani che sta
guardando, e il backfill completo è un lavoro di fondo.

### 6.4 La licenza

`essentia.js` è **AGPL-3.0** (§2.4). Consequences:

1. l'app deve essere distribuita sotto AGPL-3.0 (D-AF.2);
2. il sorgente del bundle deve essere offerto agli utenti (la PWA è servita
   dal repository: l'offerta del sorgente è il link al repository stesso);
3. `@tensorflow/tfjs` è Apache-2.0 e non cambia nulla.

Nessun altro componente della pipeline ha implicazioni di licenza:
AcousticBrainz pubblica dati **CC0**, l'iTunes Search API restituisce
metadata e anteprime per uso personale, e il runtime è proprietario ma
l'esecuzione è locale.

### 6.5 Il caricamento

- **lazy**: il modulo WASM non è importato staticamente. Si carica con
  `import()` dinamico al primo arricchimento acustico, e il risultato è
  memoizzato nel worker.
- **fuori dal precache**: il `.wasm` non è nel `globPatterns` del service
  worker (`12§2.1`) → non entra nel precache. I modelli si scaricano
  on-demand e si mettono in **Cache Storage** con `CacheFirst`.
- **versionato**: l'URL del modello porta la versione (`deam-msd-musicnn-2`),
  e `schemaVersion` (`02§3.4`) registra la versione del motore usata: un
  bump invalida le feature e il trigger successivo ricalcola.
- **degradazione**: se il download fallisce (rete assente, quota), il ramo
  Essentia **salta** e si va al ramo successivo. Un utente offline ottiene
  feature euristiche e AB dalla cache, non un errore.

### 6.6 L'audio: il preview di 30 s

- **sorgente**: `GET https://itunes.apple.com/search?term=<brano>&artist=<artista>&entity=song`
  → `previewUrl` (30 s, AAC `.m4a`);
- **richiesta**: nome del brano + nome dell'artista, **nulla** dell'utente
  (`09§3.3`: "Solo stringhe titolo/artista"). Nessun timestamp, nessun
  ascolto, nessun identificativo di sessione;
- **consentimento**: la chiamata è coperta da `PrivacySettings.enrichMetadata`
  (`02§3.8`): con il toggle spento **non esce niente**, e la pipeline non
  tenta neppure la cache (§10.4);
- **rate limit**: ~20 req/min (limite pubblicato di Apple). Il client
  rispetta un **concurrency 1** e un ritardo minimo, e reagisce al 429 con
  backoff;
- **memoria**: i byte dell'anteprima sono decodificati e **non persistiti**:
  restano in memoria per la durata dell'analisi. Nessun file audio lascia il
  dispositivo e nessun file audio viene scritto sul disco.

---

## 7. Il provider AcousticBrainz

### 7.1 L'endpoint e la risposta

- **lookup**: `GET https://acousticbrainz.org/api/v1/<recording-mbid>/high-level`
  (documentazione: `https://acousticbrainz.readthedocs.io/api.html`);
- **verifica del 28/10/2026**: l'endpoint risponde **200** con il documento
  `high-level` (classificatori `mood_*`, `danceable`, generi, `timbre`,
  `tonal_atonal`, `voice_instrumental`) e gli header di rate limit;
- **prequisito**: un **MBID di recording**. È la Story 4.2 a procurarlo
  (lookup per nome brano + artista, cache locale dell'MBID). Senza MBID il
  ramo salta;
- **dati congelati**: il dataset è congelato a **giugno 2022**: un brano
  pubblicato dopo non ha feature. È il motivo del TTL di 90 giorni
  (`05§6.2`) e del fatto che il ramo AB è un **bonus**, non la spina dorsale;
- **licenza dei dati**: CC0 (riutilizzo libero).

### 7.2 Il rate limit

La documentazione dichiara "tipicamente 10 query ogni 10 secondi per IP", ma
**i valori effettivi cambiano** e sono comunicati dagli header. La risposta
live del 28/10/2026 riportava:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset-In: 2
```

Il client **deve leggere gli header** (D-AF.6): prima di ogni richiesta,
se `Remaining` è 0, attende `Reset-In`; dopo una 429, rispetta `Retry-After`.
Nessuna costante hard-coded.

### 7.3 La mappatura mood → valence/energy

**Non esiste** `valence`/`energy` in AcousticBrainz (§2.3). La derivazione
proposta è una combinazione lineare delle probabilità mood, dichiarata come
**derivata** (non misurata):

```
valence ≈ P(happy) + 0,5·P(relaxed) − P(sad) − 0,5·P(aggressive)
energy  ≈ P(party) + P(aggressive) + 0,5·P(electronic)
```

normalizzate in [0,1] e troncate. I pesi sono una **scelta di progetto**, non
una misura: sono dichiarati qui perché un peso non dichiarato è un peso
nascosto.

Attenzione al segno: `mood_acoustic` e `mood_electronic` non sono "energia
positiva": sono qualità timbrali, e il loro uso per l'energia è un abuso
lessicale. La formula li usa solo come segnale secondario.

Il `source` resta `acousticbrainz` (D-AF.8): lo schema è chiuso e la
trasparenza la dà questo documento.

### 7.4 Gli altri campi

`low-level` (BPM, tonalità, loudness) è disponibile con la stessa
identificazione, ma è una **seconda richiesta**: per la prima tranche la
pipeline usa solo `high-level` (che è ciò che serve al mood tracker) e lascia
`tempo`, `key`, `mode`, `loudness` a `null`. Aggiungere `low-level` è un
incremento (stesso pattern, un endpoint in più), non un blocco.

---

## 8. Il fallback euristico

### 8.1 Che cosa stima

`05§6` lo descrive: *"stime da metadata (BPM da genre, energia da popolarità,
valence da key/mode); qualità bassa ma copre il 100% del catalogo"*. La
specifica ne fissa i limiti:

- **solo** campi ricavabili dai metadata **già presenti** (genere, tonalità,
  durata, anno, popolarità se presente): nessuna chiamata di rete;
- l'euristico **non stima `valence` ed `energy`** se non ha un segnale
  strutturale (la tonalità da sola non dice il mood: un brano in mi minore
  può essere sia tristezia che tensione). Per D-AF.4 l'euristico non alimenta
  comunque il mood tracker: i campi che stima servono alla UI (BPM di
  ballo, per esempio) e al `manuale`;
- **mai** presentato come misurato: il `source` è `heuristic` e la UI lo
  dichiara.

### 8.2 Il vincolo D-A.1

`04§11` (D-A.1) esclude esplicitamente i segnali inventati dalle letture di
umore: *"Un fallback su segnali inventati (opzione C) è escluso: la vision
promette letture vere"*.

Il fallback euristico e D-A.1 sono dunque compatibili **solo se** i consumi
sono separati (D-AF.4): l'euristico riempie la tabella `features` per la
copertura e la UI, e il **layer di analisi non lo legge**. Il contratto con
l'analisi è §12.

---

## 9. Il provider `manuale`

`02§3.4` ammette `source: 'manual'`: le feature inserite a mano
dall'utente (correzioni, valori noti). La specifica non ne definisce la UI
(di competenza delle tranche UI) ma stabilisce le regole:

- una feature manuale **non** viene sovrascritta dalla cascata (è
  l'intento dell'utente): la cascata salta i brani che ne hanno una;
- `fetchedAt` è il momento dell'inserimento, `schemaVersion` quello della
  versione dello schema (non del motore);
- il `manuale` è un source **accettato dal mood tracker** (D-AF.4): è
  l'utente, non il sistema, ad affermare il mood del brano.

---

## 10. Privacy e rete

### 10.1 Che cosa esce e che cosa non esce

| Dato | Destinazione | Trigger | Contenuto inviato |
|------|--------------|---------|-------------------|
| Nome brano + artista | iTunes Search API | `enrichMetadata` ON | Solo le due stringhe |
| Recording MBID | AcousticBrainz | `enrichMetadata` ON | Solo l'MBID (un identificatore di registrazione, non di utente) |
| Audio (30 s) | — | — | **non esce**: viene scaricato e analizzato in locale |
| Feature calcolate | — | — | **non escono**: restano in IndexedDB |

Non escono mai: cronologia di ascolto, timestamp, IP, dati di dispositivo,
insight (`09§3.2`).

### 10.2 La CSP

`12§2.1` oggi dichiara:

```
connect-src 'self' https://api.musicbrainz.org https://*.musicbrainz.org;
```

Con D-AF.9 diventa:

```
connect-src 'self' https://api.musicbrainz.org https://*.musicbrainz.org
           https://acousticbrainz.org https://audio-ssl.itunes.apple.com;
```

`script-src 'self' 'wasm-unsafe-eval'` è **già** predisposto per Essentia.js
e resta. Nessun altro host entra.

### 10.3 L'inventario dati (`09§4`)

`09§4` non ha oggi **nessuna riga** per le audio features: è un buco. Le
righe da aggiungere (nella PR di implementazione, dato che `09` è DRAFT):

| Dato | Categoria | Fonte | Persistito? | Base giuridica |
|------|-----------|-------|-------------|----------------|
| Audio features (valence, energy, BPM, …) | Dati derivati (potenzialmente sensibili) | Calcolo locale o dataset pubblico | Sì (locale, tabella `features`) | Consenso esplicito (toggle `enrichMetadata`) |
| Query di ricerca (nome brano + artista) | Dati personali | Ricerca su servizi pubblici | No (solo nel log di rete, senza PII) | Consenso esplicito |

E la riga `09§3.3` (cosa esce) va allineata: oggi dice "MusicBrainz / API
audio features" e il diagramma di `09§3.1` menziona ancora **FreqBlog**,
un provider che non è più usato (`02§3.4` lo ha rimosso, `12§2.1` lo ha
rimosso dalla CSP): la riga va riscritta con i due host reali.

### 10.4 Il toggle

`PrivacySettings.enrichMetadata` (default **false**, `02§3.8`) governa tutta
la pipeline. `05§6.2` è categorico: *"se `PrivacySettings.enrichMetadata ===
false`, la cache non viene letta né scritta; le analisi degradano a
mood-by-genre"*.

La specifica ne precisa tre conseguenze:

1. **nessuna uscita di rete**: nessun ramo viene tentato (nemmeno la cache
   AB, che pure è una lettura);
2. **nessuna scrittura**: la tabella `features` resta vuota;
3. **la cache non si legge**: le feature già calcolate non sono usate. È la
   regola di `05§6.2` e la più restrittiva: il toggle è "spegnere
   l'arricchimento", non "non fare nuove richieste".

Il toggle va spiegato nella UI con la stessa trasparenza degli altri
(`09§2`): che cosa fa, che cosa esce, che cosa resta locale.

---

## 11. Stoccaggio

### 11.1 La tabella `features`

Lo schema è **APPROVED** e non cambia (`02§6`, Dexie schema v2):

```
features: '&trackId, source'
```

- PK `trackId` → **una** riga per brano (1:1). Una seconda fonte per lo
  stesso brano **sovrascrive** la prima: la cascata scrive solo quando ha
  prodotto qualcosa di migliore (vedi §11.3).
- indice `source` → per il backfill ("quanto mi manca di `essentia`?") e
  per l'audit di trasparenza (`02§3.4`).
- la riga viene ripuntata al brano sopravvissuto da `rekey()` (`02§5`).

### 11.2 TTL, `schemaVersion`, LRU

Confermato da `05§6.2`:

- **TTL**: nessuno per `essentia` e `heuristic` (calcolo locale,
  deterministico); **90 giorni** per `acousticbrainz` (il dataset è congelato
  a giugno 2022: un TTL lungo non ha senso, uno corto non costa niente);
- **`schemaVersion`**: bump quando cambia la versione di Essentia, del
  modello o della regola euristica → le righe con la versione vecchia
  vengono ricalcolate al trigger successivo. È il meccanismo di invalidazione
  (ed è l'equivalente, per le features, del `derivedVersion` degli insight);
- **LRU**: 50.000 righe oltre; evict della più vecchia per `lastSeenAt` del
  brano. Nota: `AudioFeatures` (`02§3.4`) **non ha un campo `lastSeenAt`**: il
  LRU usa il `lastSeenAt` del **brano** (`Track`), non della feature. Se
  `Track.lastSeenAt` non esiste, il criterio è `fetchedAt` della feature.

### 11.3 Il ricalcolo e la riscrittura

- una feature con `schemaVersion` vecchia **non** viene usata: la cascata la
  ricalcola (trigger successivo) e la sovrascrive;
- la sorgente `manual` non viene mai sovrascritta (§9);
- il ramo euristico scrive solo se **non esiste già** una feature di una
  fonte migliore (l'euristico non degrada una feature misurata);
- la pipeline non scrive mai una riga **vuota**: se nessun provider ha
  prodotto niente, non c'è riga (la tabella vuota è il segnale "nessuna
  feature", non "feature vuota").

---

## 12. Il contratto con il layer di analisi

`04§3.3` (APPROVED) pseudocodifica:

```
af = getAudioFeatures(e.trackId)
if af.valence != null: ...
if valences.length < 3: return null
```

La specifica definisce la semantica di `getAudioFeatures` **senza modificare
`04`** (che è APPROVED e non si tocca):

1. `getAudioFeatures(trackId)` restituisce la riga della tabella `features`
   per quel brano, **filtrata per sorgente**:
   `source ∈ {essentia, acousticbrainz, manual}`;
2. le feature `heuristic` **non** sono visibili al layer di analisi (D-AF.4):
   il mood tracker non deve costruire un umore su una stima;
3. se la riga esiste ma è `heuristic`, per l'analisi è come se **non
   esistesse**: l'analisi degrada a mood-by-genre (`04§1.4`), che è
   esattamente il comportamento dichiarato per le feature mancanti;
4. la funzione è **pura e sincrona** dal punto di vista dell'analisi: il
   layer di analisi gira nel Web Worker (`05§7`) e legge da IndexedDB
   attraverso il repository (`getFeatures` esiste già in
   `packages/core/src/db/repositories.ts`).

La regola che ne deriva, in una riga: **il mood tracker vede solo le feature
misurate o manuali**.

---

## 13. Edge case

| # | Caso | Comportamento |
|---|------|---------------|
| E1 | Brano senza MBID e senza preview | ramo Essentia salta, ramo AB salta → euristico (o nessuna feature) |
| E2 | Preview iTunes non trovato (titolo ambiguo) | si tenta il match esatto (titolo + artista normalizzati); altrimenti ramo salta. **Non** si sceglie a caso: una feature sbagliata è peggio di nessuna |
| E3 | Preview scaricabile ma audio non decodificabile | ramo salta, log, nessuna feature scritta |
| E4 | Essentia non disponibile (download fallito, quota, browser senza WASM) | ramo salta; la pipeline continua con gli altri rami. Il WASM è supportato dai browser moderni, ma il fallback deve esistere |
| E5 | Utente offline | nessuna rete: si usa **solo** la cache locale (se il toggle lo consente); il backfill è rinviato |
| E6 | Feature già presente con `source: 'manual'` | la cascata non la tocca (§9) |
| E7 | Brano cancellato / rekey | `rekey()` ripunta la riga `features` al brano sopravvissuto (`02§5`); se il brano sparisce, la riga è candidata all'evict |
| E8 | `valence` o `energy` fuori [0,1] (bug del modello) | **clamp a [0,1]** prima della scrittura, e log di warning con il `trackId`: l'invariante di `10§7` non può mai essere violata in DB |
| E9 | Due trigger concorrono sullo stesso brano | la coda è **per brano** (idempotente): il secondo trigger vede il brano già in coda e lo salta |
| E10 | Feature con `schemaVersion` vecchia | ricalcolata al trigger successivo, non usata intanto |
| E11 | Il toggle passa da ON a OFF a pipeline in corso | il job in corso **si ferma** al prossimo brano; nessuna nuova uscita di rete |
| E12 | Oltre 50.000 righe | evict LRU (§11.2) |

---

## 14. UI e i18n

La UI della pipeline è di competenza delle tranche UI (Story 3.x); la spec
fissa però i **testi** e gli **stati** che il backend deve poter descrivere.

Stati della pipeline (per brano e aggregati):

- `in coda` · `in analisi` · `fatto (fonte: essentia | acousticbrainz | manual)` ·
  `fatto (stima)` · `nessun audio disponibile` · `non arricchito (toggle spento)` ·
  `errore (dettaglio in Settings)`.

Le chiavi i18n (namespace `enrichment.*`, da aggiungere a `08§2.16` e ai
locale `it`/`en`):

| Chiave | Uso |
|--------|-----|
| `enrichment.status.queued` | in coda |
| `enrichment.status.analyzing` | in analisi |
| `enrichment.status.done` | fatto, con il nome della fonte |
| `enrichment.status.estimated` | fatto, ma stima (euristico) |
| `enrichment.status.no_audio` | nessun audio disponibile |
| `enrichment.status.disabled` | toggle spento |
| `enrichment.download.size` | avviso prima del download del WASM ("~6 MB, una volta") |
| `enrichment.error.aggregate` | avviso aggregato in Settings (`06§5`) |

Nessuna stringa inline nel core: i testi sono chiavi i18n, come già fatto per
i ricordi (`04§7.3.1`, D-A.4).

---

## 15. Test e fixture

### 15.1 Struttura

| Tipo | Dove | Cosa |
|------|------|------|
| Unit | `packages/core/src/enrichment/__tests__/` | normalizzazione, mappatura, euristico, regole della cascata (con provider finti) |
| Integrazione | `packages/core/src/enrichment/__tests__/` | cascata completa con `fetch` finto (fixture di risposte) |
| Property-based | idem | invarianti di `10§7` (`valence ∈ [0,1]`, `energy ∈ [0,1]`, `danceability ∈ [0,1]`) |
| Scenario | `fixtures/scenarios/` | i tre scenari esistenti arricchiti con le feature attese |

### 15.2 I mock

`10§8` prescrive "Mai chiamate reali in CI". Le fixture delle risposte
esterne vanno in `fixtures/api-mocks/`:

```
fixtures/api-mocks/
├── itunes/search-<case>.json     # una risposta per brano (previewUrl incluso)
├── acousticbrainz/high-level-<case>.json
└── acousticbrainz/headers-rate-limit.json
```

(`fixtures/api-mocks/` è oggi **referenziato** da `10§8` ma **non esiste**:
la directory va creata.)

Il mock di `fetch` deve essere iniettabile: la pipeline non chiama `fetch`
globale, ma un `HttpClient` passato dalla factory (così il test è
deterministico e non serve `nock`/`msw`).

### 15.3 I casi minimi

| # | Caso | Asserzione |
|---|------|-----------|
| T-AF.1 | brano con feature in cache | nessuna chiamata di rete; la feature in cache è restituita |
| T-AF.2 | brano senza feature, preview disponibile | Essentia chiamato; `source = 'essentia'`; `valence` in [0,1] |
| T-AF.3 | brano senza preview ma con MBID | Essentia saltato; AB chiamato; `source = 'acousticbrainz'` |
| T-AF.4 | brano senza preview e senza MBID | solo euristico; `source = 'heuristic'` |
| T-AF.5 | tutti i provider falliscono | nessuna riga scritta; nessun errore propagato |
| T-AF.6 | toggle `enrichMetadata = false` | **zero** chiamate di rete e **zero** scritture; la cache non è neppure letta |
| T-AF.7 | feature `heuristic` già in tabella | il mood tracker **non** la vede (§12) |
| T-AF.8 | normalizzazione DEAM | `valence` grezzo 1 → 0,0; 5 → 0,5; 9 → 1,0 |
| T-AF.9 | `X-RateLimit-Remaining: 0` | la pipeline **attende** `Reset-In` prima della richiesta successiva |
| T-AF.10 | `schemaVersion` vecchia | la feature non viene usata; il ricalcolo la sovrascrive |
| T-AF.11 | `source: 'manual'` presente | la cascata non lo sovrascrive |
| T-AF.12 | valore fuori [0,1] dal modello | clamp a [0,1] + warning |
| T-AF.13 | i tre scenari di `fixtures/scenarios/` | il numero di feature per brano e la loro fonte sono deterministici |
| T-AF.14 | idempotenza | due esecuzioni producono la stessa tabella (byte per byte, salvo `fetchedAt`) |

### 15.4 I gate

- coverage di `packages/core/enrichment/*` **≥ 75%** (`10§2`, riga già
  presente);
- invarianti di `10§7` (già presenti: `valence ∈ [0,1]`);
- `pnpm run lint`, `typecheck`, `test`, `build` verdi;
- il bundle iniziale resta **< 300 KB gzip** (`05§10`): il gate è che il
  WASM **non** finisca nel bundle iniziale (si verifica che il chunk WASM non
  sia importato staticamente dal percorso di startup).

---

## 16. I criteri di accettazione della Story 4.1 (riscritti)

Gli AC originali (`11-BACKLOG.md`) sono quattro e uno di loro è ambiguo. La
versione riscritta, verificabile:

- [ ] La cascata è **cache → Essentia.js → AcousticBrainz → euristico**,
      con i salti dichiarati (§5.1) e la regola "l'import non attende mai la
      rete" (`05§6.1`)
- [ ] `PrivacySettings.enrichMetadata` è rispettato in **tutte** le forme:
      zero uscite, zero scritture, zero letture della cache (§10.4)
- [ ] Il rate limiting è applicato a **MusicBrainz** (1 req/s) e ad
      **AcousticBrainz** (letto dagli header `X-RateLimit-*`, senza costanti
      hard-coded) (§7.2, D-AF.6)
- [ ] `AudioFeatures.source` ∈ `{essentia, acousticbrainz, heuristic, manual}`
      è tracciato e **le feature derivate sono dichiarate** come derivate
      (§7.3, D-AF.8)
- [ ] `valence` ed `energy` sono in [0,1] **per costruzione** (normalizzazione
      dichiarata) e l'invariante di `10§7` è verificato da un test
      property-based (§6.2)
- [ ] Il layer di analisi legge **solo** le feature misurate o manuali: il
      fallback euristico non alimenta il mood tracker (§12, D-AF.4)
- [ ] Il WASM e i modelli **non** sono nel bundle iniziale né nel precache:
      download su richiesta, cache browser, versionamento (§6.5)
- [ ] La pipeline è **idempotente** e **interrompibile**: due esecuzioni non
      producono righe duplicate; un job interrotto non lascia righe parziali
      (§11.3, T-AF.14)
- [ ] Il consumo di rete è limitato ai **due host** dichiarati, con la CSP
      allineata (§10.2)
- [ ] L'inventario dati di `09§4` ha le righe delle audio features e delle
      query di ricerca (§10.3)
- [ ] I test coprono i 14 casi minimi (§15.3) con i mock delle API esterne,
      **mai** chiamate reali (§15.2)

---

## 17. I deliverable di implementazione

| # | Deliverable | Dove |
|---|-------------|------|
| T4.1.1 | Il tipo `AudioFeatureProvider` e le factory dei provider | `packages/core/src/enrichment/types.ts` |
| T4.1.2 | La cascata (orchestratore) con cache, salti e regole di non-blocking | `packages/core/src/enrichment/cascade.ts` |
| T4.1.3 | La normalizzazione e la mappatura dei campi | `packages/core/src/enrichment/mapping.ts` |
| T4.1.4 | Il provider Essentia.js (WASM lazy, DEAM) | `packages/core/src/enrichment/essentia.ts` |
| T4.1.5 | Il provider AcousticBrainz (HTTP, rate limit dagli header) | `packages/core/src/enrichment/acousticbrainz.ts` |
| T4.1.6 | Il fallback euristico | `packages/core/src/enrichment/heuristic.ts` |
| T4.1.7 | Il subpath `@ls/core/enrichment` e il barrel | `packages/core/package.json`, `packages/core/src/enrichment/index.ts` |
| T4.1.8 | La coda e i trigger (on-import, on-demand, scheduled) | `packages/core/src/enrichment/queue.ts` |
| T4.1.9 | I mock e i fixture delle API esterne | `fixtures/api-mocks/` |
| T4.1.10 | I test (unit, integrazione, property-based, scenario) | `packages/core/src/enrichment/__tests__/` |
| T4.1.11 | La CSP allineata | `docs/12-DEVOPS.md` §2.1 |
| T4.1.12 | L'inventario privacy e i testi pubblici | `docs/09-PRIVACY-SECURITY.md` §3.1, §3.3, §4; `docs/08-COPY-I18N.md` §2.16 + locale |
| T4.1.13 | La verifica del bundle (il WASM non è nel bundle iniziale) | `apps/web/vite.config.ts` (config manualChunks) + check in CI |

---

## 18. L'impatto sui documenti

| Documento | Cosa cambia | Quando |
|-----------|-------------|--------|
| `docs/05-ARCHITECTURE.md` §6 | Le premesse (§2) e la fonte dell'audio: il testo dichiara "preview dal catalogo" senza dire quale | Alla ratifica, se il Boss approva D-AF.1 |
| `docs/05-ARCHITECTURE.md` §9 | Il modulo `enrichment` è in `core` **senza React** (D-AF.5): la dicitura "React Query per MB/Last.fm" va corretta | Alla ratifica |
| `docs/02-DATA-SCHEMA.md` §3.4 | Nessuna modifica (APPROVED): il tipo resta com'è. La distinzione "misurata / derivata / stimata" resta nella spec | — |
| `docs/09-PRIVACY-SECURITY.md` §3.1, §3.3, §4 | Le righe mancanti dell'inventario, la riga "cosa esce" riscritta, la rimozione di FreqBlog dal diagramma | Nell'implementazione (T4.1.12) |
| `docs/12-DEVOPS.md` §2.1 | La CSP con i due host nuovi | Nell'implementazione (T4.1.11) |
| `docs/10-TESTING.md` §8 | La riga "FreqBlog / Musicae" (provider inesistenti) va sostituita con i due mock reali; la directory `fixtures/api-mocks/` viene creata | Nell'implementazione (T4.1.9) |
| `docs/08-COPY-I18N.md` §2.16 | Il namespace `enrichment.*` con le 8 chiavi | Nell'implementazione (T4.1.12) |
| `docs/14-GLOSSARY.md` | "Valence" e "Danceability" ci sono; manca **Energy** e manca la distinzione misurata/derivata/stimata | Alla ratifica |
| `docs/11-BACKLOG.md` Story 4.1 | Gli AC riscritti (§16) e la riga `**Stato**:` | Alla ratifica |
| `docs/04-ANALYSIS-ALGORITHMS.md` | **Nessuna modifica**: `04` è APPROVED e la semantica di `getAudioFeatures` è definita qui, in `§12` | — |

---

## 19. I punti aperti

1. **La licenza dell'app** (D-AF.2): la ratifica della spec deve cambiare la
   licenza del repository da Apache-2.0 ad AGPL-3.0, o rinunciare al
   provider acustico locale. È una decisione del Boss e ha effetti legali
   sulla distribuzione.
2. **Il costo di 6 MB e il consenso**: un download da 6 MB sul telefono è
   una decisione dell'utente, non un dettaglio. Va detto prima (chiave
   `enrichment.download.size`).
3. **Il tempo di calcolo per brano**: l'ordine di grandezza (1–3 s) è una
   stima, non una misura. La tranche di implementazione deve misurarlo e
   riportarlo qui: se il tempo reale è un ordine di grandezza superiore,
   l'on-demand diventa l'unico percorso praticabile e il backfill completo
   non è realistico.
4. **Il match del brano in iTunes**: il titolo ambiguo ("Greatest Hits") può
   associare il brano sbagliato. Una feature sbagliata è peggio di nessuna:
   il criterio di E2 va verificato su un campione reale.
5. **La copertura di AcousticBrainz**: il dataset è congelato a giugno 2022 e
   copre solo i brani con MBID. La copertura reale sui cataloghi moderni
   (specialmente le release indipendenti) è sconosciuta e va misurata.
6. **L'euristico e la UI**: la specifica dice che l'euristico non alimenta
   l'analisi, ma non dice cosa mostra la UI quando mostra una stima. Il
   confine "stima ≠ misura" va tenuto anche nei testi.
7. **`Track.lastSeenAt`**: il criterio LRU di `05§6.2` presuppone un campo
   che `02§3.3` non dichiara. Va verificato in fase di implementazione; il
   fallback è `fetchedAt`.

---

## 20. Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | 2026-10-28 (Sessione 62, issue #187) | Prima stesura. Definisce il contratto `AudioFeatureProvider`, la cascata (`05§6`), la mappatura dei campi di `AudioFeatures` per ogni provider, la normalizzazione DEAM [1,9] → [0,1], la separazione fra feature misurate/derivate/stimate, il contratto con il layer di analisi (`getAudioFeatures` filtrato per sorgente), la privacy e la CSP, lo stoccaggio e l'invalidazione, i costi reali misurati (WASM ~2,7 MB + backbone ~3,2 MB + TFJS), i 14 casi di test minimi e gli AC riscritti della Story 4.1. Apre **9 decisioni** (D-AF.1…D-AF.9) da chiudere alla ratifica. Verificati in data: la morte di Spotify `audio_features` per le nuove app (27/11/2024, con restrizioni 2026), l'API di AcousticBrainz viva ma con sole classi `mood_*` (nessuna `valence`/`energy`), l'anteprima di 30 s dell'iTunes Search API senza autenticazione, la licenza AGPL-3.0 di `essentia.js` contro Apache-2.0 dell'app, il rate limit di AcousticBrainz letto dagli header (`Limit: 100`, `Reset-In: 2` il 28/10/2026) |
