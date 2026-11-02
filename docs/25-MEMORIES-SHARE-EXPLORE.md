# 25 — Ricordi, condivisione, Esplora e Analisi

> Status: 🟢 APPROVED
> Versione: 1.0
> Ultima modifica: Sessione 86 (2026-11-02)
> Ratificato: dal project owner al merge della PR #273 (2026-11-02, commit `89573176`)
> Responsabile: Boss
> Story: **3.2** (Ricordi + Share) e **3.3** (Esplora + Analisi) — `docs/11-BACKLOG.md` · Area: `ui`/`ux` · Size: L ciascuna
> Origine: `docs/22-COMPETITIVE-POSITIONING.md` §8, §10, §11

---

## 🎯 Scopo

Due schermate mancano per chiudere il percorso end-to-end, e sono anche i due "motori virali" dell'analisi competitiva:

- **3.2 — Ricordi + Share**: il feed dei ricordi (⑪), il foglio di condivisione (⑫) e il **tagging manuale** (il ponte fra l'analisi automatica e l'autobiografia);
- **3.3 — Esplora + Analisi**: la ricerca nel proprio catalogo (⑨) e la mappa emotiva (⑩), con **insight in prosa**.

> **Vincolo di privacy che definisce il design**: la condivisione **non esporta il database**: esporta **un capitolo statico** (immagine, HTML autonomo, PDF). Il canale di condivisione non contiene mai dati identificativi (`22` §11).
>
> **Vincolo di contenuto che definisce il 3.3**: un grafico in più non è un "aha moment"; l'«aha» è **la frase** (`22` §8, nota di metodo).

> **Fuori perimetro (dichiarato)**: il **collegamento del pipeline di analisi** (Story 2.5 → `23-ANALYSIS-PIPELINE.md`: senza, le due schermate qui restano vuote), l'**artwork** (Story 4.3 → `24-ARTWORK-ENRICHMENT.md`: le card useranno gli URL già popolati, se presenti), l'**export completo** del database (Story 5.2 → `27-PRIVACY-DATA-SETTINGS.md`).

## 🧱 Cosa esiste già (verificato in Sessione 86)

| Cosa | Stato | Dove |
|------|-------|------|
| Chiavi i18n `memories.*` (11), `share.*` (9), `explore.*` (8), `analysis.*` (12), `empty.description.{explore,analysis,memories}` | ✅ **esistono e non sono usate** | `apps/web/src/i18n/locales/{it,en}.json:109–148`, `:174–176` |
| `MemoryCard` | ✅ montata in Home; **manca** l'array `actions` richiesto da `07§2.2` | `apps/web/src/components/MemoryCard.tsx:14–29` |
| `MoodLine`, `StreamChart` (SVG scritti a mano) | ✅ montate in Timeline, **riutilizzabili** nel 3.3 | `apps/web/src/components/` |
| `QuadrantChart` | ❌ **non esiste** (da costruire, props in `07§2.8`) | — |
| `InsightCard` | ❌ **non esiste** (props in `07§2.9`) | — |
| `ShareSheet` | ❌ **non esiste** (props in `07§2.10`) | — |
| Canvas / Web Share API / download | ❌ **zero occorrenze** in tutto il repo | — |
| `Insight.userNote` | ✅ nello schema, **scritto sempre `null`**, nessun lettore/scrittore | `packages/core/src/schema/index.ts:245` |
| Writer per `userNote`/`status` degli insight | ❌ non esiste | `packages/core/src/db/insights.ts` |
| Router / deep-link | ❌ **non esiste**: la navigazione è `AppSection = 'home' \| 'timeline'` | `apps/web/src/screens/AppShell.tsx:21` |
| Modello puro di bucketing (`bucketizeListens`, `bucketizeMood`, `toEraBands`) | ✅ esiste e riusabile | `apps/web/src/screens/homeTimelineModel.ts` |

## 🧭 Navigazione (da definire, perché il router non esiste)

> **D-25.1 — la navigazione resta a stato, senza librerie.** Si estende `AppSection` con `'memories' | 'explore' | 'analysis'` e si aggiunge un **payload di focus** opzionale per il deep-link alla Timeline:

```ts
export type AppSection = 'home' | 'timeline' | 'memories' | 'explore' | 'analysis';

export interface AppFocus {
  readonly kind: 'era' | 'track' | 'period';
  readonly id: string;
  readonly at: number;        // timestamp UTC del periodo
}
```

`AppShell` passa `focus` a `Timeline`, che evidenzia la banda dell'era (o il punto del grafico) e porta la Timeline in primo piano. **Nessuna nuova dipendenza** (niente router): il progetto non ne ha e non ne ha bisogno.

## 📐 Contratti da costruire

### 1. Core — scrittura delle note utente (`packages/core/src/db/insights.ts`)

```ts
export interface InsightUserNote {
  readonly userNote: string | null;
  readonly status: 'pending' | 'confirmed' | 'corrected' | 'dismissed';
}
export async function setInsightUserNote(
  db: LifeSoundtrackDB,
  id: string,
  value: InsightUserNote,
): Promise<Insight | null>;          // transazionale
export async function setInsightStatus(
  db: LifeSoundtrackDB,
  id: string,
  status: Insight['status'],
): Promise<Insight | null>;         // transazionale
```

> **D-25.4 — nessuna migrazione dello schema**: il testo libero dell'utente (il **nome** dell'era e le sue **parole chiave**) sta in `Insight.userNote`, che esiste già per questo. Le parole chiave sono separate da virgola e interpretate dall'app (`parseTags(note)` → `string[]`), non dal core. **Alternativa** (tabella dedicata `insightTags`): più pulita, ma impone il DB **v7** + il bump di `fastCheck` (`db/health.ts:45`, default 6) **e** la correzione del drift già presente in `apps/web/src/hooks/useDbHealth.ts:15` (fermato a 4). La decisione è del project owner (D-25.4).
>
> **Semantica di `status`**: `confirmed` = l'utente ha battezzato o annotato l'insight; `dismissed` = l'utente l'ha nascosto (il feed dei ricordi non lo mostra, ma **resta** nel database e nell'export).

### 2. App — hook del feed dei ricordi (`apps/web/src/hooks/useMemories.ts`, nuovo)

```ts
export interface MemoryCardModel {
  readonly id: string;
  readonly title: string;            // MemoryPayload.text (stringa già resa)
  readonly kind: MemoryKind;         // on_this_day | first_time | milestone | return | seasonal
  readonly date: string;             // ISO date
  readonly yearsAgo: number | null;
  readonly artworkUrl: string | null;
  readonly trackId: string | null;
  readonly artistId: string | null;
  readonly status: Insight['status'];
  readonly userNote: string | null;
}

export interface MemoriesData {
  readonly state: 'loading' | 'empty' | 'ready' | 'error';
  readonly items: readonly MemoryCardModel[];
  readonly hasMore: boolean;
  readonly loadMore: () => void;
}

export function useMemories(pageSize?: number): MemoriesData;   // default 10 (06§2.11)
```

- legge gli insight `type === 'memory'` dal DB (`listInsightsByType`), **esclude** quelli con `status === 'dismissed'`;
- ordina per **rilevanza**: `Insight.confidence` (che contiene il ranking `04§7.4`);
- **paginazione a 10** con infinite scroll (`06§2.11`);
- stato vuoto con il copy esistente `empty.description.memories`.

### 3. App — renderer della card (`apps/web/src/share/renderMemoryCard.ts`, nuovo)

```ts
export interface MemoryCardInput {
  readonly title: string;
  readonly periodLabel: string;        // es. "estate 2019"
  readonly eraName: string | null;
  readonly symbolTrack: { name: string; artist: string; artworkUrl: string | null } | null;
  readonly artworks: readonly { url: string | null; mood: MoodId | null }[];
}

export interface RenderedCard {
  readonly blob: Blob;                 // image/png
  readonly width: 1080;
  readonly height: 1350;
}

export async function renderMemoryCard(
  input: MemoryCardInput,
  deps: { fonts?: FontFace[]; logger?: Logger },
): Promise<RenderedCard>;
```

Vincoli tecnici (non negoziabili):

1. **canvas 1080×1350**, `devicePixelRatio` gestito (il PNG resta 1080×1350);
2. **nessun taint del canvas**: le immagini remote si caricano con `img.crossOrigin = 'anonymous'`; se il server non invia CORS o l'errore è 404, si **sostituisce il placeholder** (gradient deterministico, come `24-ARTWORK-ENRICHMENT.md` §"placeholder") e si continua — **mai** un `toBlob` che fallisce;
3. **testo in italiano**: il font deve essere **caricato** (`document.fonts.load`) prima del disegno, altrimenti il canvas usa il fallback e il testo non è quello del design system;
4. il risultato è un **Blob PNG** (mai un `dataURL`): il `dataURL` è 33% più pesante e non va nei `File` del Web Share API;
5. **nessun dato identificativo** nel canvas: solo copertine, periodo, nome dell'era, brano simbolo.

### 4. App — `ShareSheet` (`apps/web/src/components/ShareSheet.tsx`, nuovo)

Props (da `07§2.10`): `{ imageUrl: string; platforms: { id: string; icon: string; label: string; onClick: () => void }[]; onClose: () => void }`.
Stati: `generating` (spinner), `ready`, `error` (retry). A11y: `role="dialog"`, `aria-modal="true"`, focus trap, chiusura con `Esc` o backdrop.

Azioni (tutte sul **Blob**, mai sull'URL remoto):

| Azione | Implementazione | Fallback |
|--------|----------------|----------|
| Condivisione nativa | `navigator.canShare({files})` → `navigator.share({files:[new File([blob],'life-soundtrack.png',{type:'image/png'})]})` | download |
| Copia negli appunti | `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` | download + toast |
| Scarica | `<a download>` con `URL.createObjectURL` + `revokeObjectURL` | — |
| Instagram / WhatsApp / X | **Web Share API** (è l'unico modo affidabile di passare un file) | download + istruzione |

> **D-25.2 — niente deep link "Instagram"**: Instagram non accetta file via deep link. L'etichetta «Instagram» del copy esistente (`share.instagram`) indica la **destinazione desiderata**, non un'API: l'azione apre il Web Share API e l'utente sceglie l'app. Si evita di promettere un'integrazione che il sistema non permette.

### 5. App — tagging manuale e rinomina dell'era

- **Rinominare un'era**: `EraBandModel` (in `homeTimelineModel.ts`) gains `userNote: string | null`; `EraBand` renderizza `userNote ?? label`. Il testo è salvato con `setInsightUserNote(era.id, {userNote, status:'confirmed'})` (l'id dell'era è deterministico: `era-${periodStart}`).
- **Parole chiave**: la UI di dettaglio dell'era (⑧, oggi assente) accetta una riga di testo: `nome, viaggio a Berlino, esame di laurea`. Il nome è la prima parte, le parole chiave sono le successive. Il testo è **locale** ed è incluso nell'export della 5.2.
- **Nascondere un ricordo**: `setInsightStatus(id, 'dismissed')` (swipe left, `06§2.11`).

### 6. App — Esplora (⑨)

- **Dati**: solo i **propri** dati (`tracks`, `artists`, `albums`, `genres` dei track, mood dagli insight). Nessuna ricerca globale, nessuna rete (`06§2.9`).
- **Query**: `db.tracks` per nome (`listTracksByName`), `db.artists` (`listArtistsByName`), `db.albums` (`listAlbumsByArtist`); ordinamento per `listenCount` descendente.
- **Debounce 300 ms** (`06§2.9`).
- **Tabs**: Artisti · Brani · Album · Generi · Mood (le etichette esistono già: `explore.tab.*`).
- **Mood pills**: le 6 mood (`analysis.moods.*`), filtro sui periodi con quel mood.
- Componenti nuovi: `ExploreScreen.tsx`, `SearchField.tsx` (con `aria-label` e `role="searchbox"`).

### 7. App — Analisi (⑩)

- **QuadrantChart** (`07§2.8`): props `{ points: {x: number; y: number; size: number; color: string; label: string}[]; quadrantLabels: {...} }`; ogni punto è un `<button>` con `aria-label` descrittivo; i quadranti usano `analysis.quadrant.*`.
- **Dati**: i punti sono i **periodi** (mese) con `avgValence`/`avgEnergy` dagli insight `mood_day` (aggregati per mese) — cioè la stessa serie che `MoodLine` già disegna, letta dal DB.
- **Insight in prosa**: sotto i grafici, una `InsightCard` per ogni `event` e per i `memory` del periodo, con `EventPayload.description` e `MemoryPayload.text` (sono **già stringhe rese**: nessuna stringa italiana nel core, D-A.4).
- **InsightCard** (`07§2.9`): props `{ icon, title, description, confidence? }`; stati `pending` / `confirmed` / `dismissed`; pulsanti per confermare/correggere/ignorare → `setInsightStatus`.
- Il percorso è **interamente locale**: nessuna richiesta di rete (`11-BACKLOG.md` §3.3, AC).

## 🔒 Privacy

| Vincolo | Applicazione |
|---------|--------------|
| Il canale di condivisione non contiene il database | si esporta **un capitolo**: copertine, periodo, era, brano simbolo |
| Il testo dell'utente (nomi, tag) è dato personale | resta locale; è incluso nell'export della 5.2 e cancellato dalla 5.2 |
| Nessuna richiesta di rete nel 3.3 | la ricerca è sul DB locale |
| Il Web Share API non può condividere più di quanto l'utente sceglie | la condivisione è **esplicita**, mai automatica |

## 🧪 Test

| Livello | File | Cosa copre |
|---------|------|-----------|
| unit (core) | `packages/core/src/db/__tests__/insight-user-note.test.ts` | `setInsightUserNote` / `setInsightStatus` transazionali; il testo sopravvive; `dismissed` non sparisce dal DB |
| unit (app) | `apps/web/src/hooks/__tests__/useMemories.test.ts` | paginazione a 10, esclusione dei `dismissed`, ordinamento per rilevanza, stato vuoto |
| unit (app) | `apps/web/src/share/__tests__/renderMemoryCard.test.ts` | canvas 1080×1350 (dimensioni del PNG), **taint**: immagine senza CORS → placeholder, **nessun crash**; il PNG non contiene dati identificativi (test sui pixel di una card vuota? — almeno: nessun `localStorage`/DB letto) |
| unit (app) | `apps/web/src/components/__tests__/share-sheet.test.tsx` | stati `generating`/`ready`/`error`, `role="dialog"`, `aria-modal`, chiusura con `Esc`, il fallback download quando `navigator.share` non esiste |
| unit (app) | `apps/web/src/components/__tests__/memory-card-actions.test.tsx` | le azioni del `MemoryCard` (array `actions` di `07§2.2`) sono renderizzate e invocabili |
| integrazione (app) | `apps/web/src/screens/__tests__/explore-search.test.tsx` | la ricerca filtra i propri dati, nessuna rete, debounce |
| integrazione (app) | `apps/web/src/screens/__tests__/analysis-insights.test.tsx` | ogni grafico è accompagnato da **almeno una frase**; il punto del quadrante è un `<button>` con `aria-label` |
| integrazione (app) | `apps/web/src/screens/__tests__/era-rename.test.tsx` | la rinomina dell'era persiste e sopravvive al ricalcolo dell'analisi (**non** è sovrascritta dalla `replaceAllInsightsOfType`) |

> ⚠️ **Test da scrivere con cura**: `replaceAllInsightsOfType` (Story 2.5) **cancella e reinserisce** gli insight del tipo. Se il `userNote` non viene preservato, la rinomina dell'era è persa al primo ricalcolo. **Requisito**: la persistenza degli insight deve **leggere il `userNote` esistente** prima di sostituire le righe (o la sostituzione deve preservarlo). Da mettere in chiaro nella spec 23 e verificato in un test di integrazione **in cross**.

## ✅ Acceptance criteria

### Story 3.2
- [ ] Il feed dei ricordi (⑪) mostra le card con `MemoryCard`, ordinate per rilevanza, con infinite scroll a 10
- [ ] Un ricordo `dismissed` non compare nel feed ma **resta** nel database (ed è esportato)
- [ ] La card 1080×1350 è generata **in locale** (canvas) e resta un PNG valido anche senza copertine raggiungibili
- [ ] Il foglio di condivisione (⑫) ha gli stati `generating`/`ready`/`error`, è un dialog accessibile e si chiude con `Esc`
- [ ] La condivisione nativa usa il **Web Share API** quando disponibile, con **download** di fallback
- [ ] **Nessun dump del database** nel file condiviso: il contenuto è un capitolo statico
- [ ] L'utente può rinominare un'era e aggiungere parole chiave; il testo **sopravvive** al ricalcolo dell'analisi
- [ ] Il `MemoryCard` espone l'array `actions` richiesto da `07§2.2` (nascondi / salva / condividi)
- [ ] Le nuove stringhe (se qualcuna) sono in **it** ed **en**, e i file locale restano allineati chiave per chiave

### Story 3.3
- [ ] La ricerca (⑨) filtra **solo** i propri dati, con debounce 300 ms e risultati ordinati per `listenCount`
- [ ] La mappa emotiva (⑩) mostra il `QuadrantChart` con i punti come `<button>` ad accessibili
- [ ] **Ogni grafico è accompagnato da almeno una frase** (`insight.*`), mai da un solo valore numerico
- [ ] Gli insight mostrati sono **persistiti** e arrivano dalla Story 2.5
- [ ] Il percorso è **interamente locale**: nessuna richiesta di rete
- [ ] Il click su un punto passa il contesto alla Timeline (deep-link interno, senza router)

## 📋 Task

- T25.1 — Core: `setInsightUserNote`, `setInsightStatus` in `db/insights.ts` (+ test)
- T25.2 — Core: preservazione del `userNote` nella sostituzione degli insight (coordinato con `23`)
- T25.3 — App: `useMemories` (hook) + test
- T25.4 — App: `renderMemoryCard` (canvas) + test (dimensioni, taint, fallback)
- T25.5 — App: `ShareSheet` + azioni (Web Share, clipboard, download) + test
- T25.6 — App: `MemoryCard` con `actions`; swipe sinistro = nascondi (D-25.3)
- T25.7 — App: rinomina e tag dell'era (`EraBandModel.userNote`, `EraBand`, dettaglio era) + test
- T25.8 — App: `ExploreScreen` + ricerca con debounce + tab + mood pills + test
- T25.9 — App: `QuadrantChart`, `InsightCard`, `AnalysisScreen` + test
- T25.10 — App: navigazione estesa (`AppSection`, `AppFocus`) + deep-link alla Timeline
- T25.11 — i18n: chiavi nuove in it/en (le esistenti `memories.*`, `share.*`, `explore.*`, `analysis.*` vanno **usate**, non duplicate) + `docs/08-COPY-I18N.md`
- T25.12 — Allineamento documentale: `docs/07-UI-SPEC.md`, `docs/06-UX-FLOWS-STATES.md`, `docs/INDEX.md`, `docs/11-BACKLOG.md` (§3.2, §3.3), `docs/state/stories/3.2-*.md`, `docs/state/stories/3.3-*.md`

## 🧾 Decisioni proposte

| # | Decisione | Motivazione |
|---|-----------|-------------|
| D-25.1 | Navigazione a **stato** (`AppSection` + `AppFocus`), senza librerie di routing | Il progetto non ha un router; aggiungerne uno per tre schermate è un costo senza beneficio; il deep-link è un contratto interno |
| D-25.2 | Il pulsante «Instagram» usa il **Web Share API** (nessun deep link con file) | Instagram non accetta file via deep link: prometterlo sarebbe una bugia funzionale |
| D-25.3 | Swipe sinistro = **nascondi** (`status: 'dismissed'`), non cancellare | Un ricordo nascosto resta nell'export e nella cronologia: cancellare è un atto separato (5.2) |
| D-25.4 | Il testo libero sta in **`Insight.userNote`**, senza migrazione dello schema | Il campo esiste per questo; una tabella dedicata imporrebbe il DB v7 e il bump di `fastCheck` |
| D-25.5 | La card è un **PNG** (Blob), non un data URL | Il Blob è il formato che `navigator.share` e `clipboard.write` accettano; il data URL è più pesante |
| D-25.6 | L'insight «in prosa» usa le stringhe **già rese** (`EventPayload.description`, `MemoryPayload.text`) | D-A.4: il core non contiene stringhe; la UI non deve re-renderizzare i template |

## 🚧 Cosa NON è in scope

- Il collegamento del pipeline di analisi (Story 2.5) e la produzione degli insight.
- L'artwork delle copertine (Story 4.3): la card usa gli URL già presenti, con placeholder.
- L'export completo del database (Story 5.2).
- I **toast** e i microtesti non coperti dal copy esistente: le nuove chiavi vanno in it/en con lo stesso criterio (namespace già dichiarato in `apps/web/src/i18n/index.ts:23–43`).

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 86 (2026-11-02) | Prima stesura: contratti di feed, card canvas, ShareSheet, tagging (con il vincolo di preservazione del `userNote` al ricalcolo), Esplora e Analisi; copy esistente già presente e da riusare; D-25.1…D-25.6 |
| 1.0 | Sessione 87 (2026-11-02) | **Ratificata** dal project owner al merge della PR #273: status 🟢 APPROVED, versione 1.0, decisioni vincolanti |

---

*Questo documento è **vincolante** (🟢 APPROVED v1.0) dal 2026-11-02: le decisioni che contiene sono applicabili dagli agenti senza ulteriore approvazione.*
