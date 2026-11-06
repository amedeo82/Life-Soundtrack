# 07 — Specifiche UI Componenti

> Status: 🟡 DRAFT · Versione 0.4 · Sessione 104 (2026-11-06, issue #270 — Story 3.5)
> Vincolante per: `packages/ui/components`, test di interazione, implementazione frontend

---

## 1. Principi di Design UI

1. **Dark-first**: Tutti i componenti sono progettati per `bg-base` (#0A0E1A). La light mode è un'override, non il default.
2. **Glow over Shadow**: Usare `box-shadow` con colori brand/mood per stati attivi, mai ombre grigie pesanti.
3. **Feedback immediato**: Ogni interazione (hover, click, drag) deve avere una transizione ≤ 150ms.
4. **Accessibilità**: Contrasto minimo 4.5:1. Focus ring visibile per navigazione tastiera.

## 2. Catalogo Componenti

### 2.1 StatCard
**Uso**: Home, Dashboard. Mostra un numero grande con contesto.
- **Props**: `value` (number/string), `label` (string), `icon` (Lucide icon name), `trend` (number, opzionale, % cambiamento)
- **Stati**: `default`, `loading` (skeleton), `hover` (glow viola sottile)
- **A11y**: `role="status"`, `aria-label` descrive il valore e l'unità.
- **Interazione**: Hover → count-up animato del valore (se numerico).

### 2.2 MemoryCard
**Uso**: Feed Ricordi, Home.
- **Props**: `artworkUrl` (string), `title` (string), `subtitle` (string), `mood` (MoodId), `date` (string), `actions` (array di {icon, label, onClick})
- **Stati**: `default`, `hover` (scale 1.02 + glow), `swiping` (mobile)
- **A11y**: Immagine con `alt` descrittivo. Pulsanti azione con `aria-label`.
- **Interazione**: Swipe left (mobile) → nascondi; Swipe right → salva; Tap → deep link.

**Implementazione (Story 3.2, Sessione 97)**: le tre azioni sono **nascondi**,
**salva** e **condividi**; il nascondimento esclude il ricordo dal feed ma non
lo cancella dal database.

### 2.3 EraBand
**Uso**: Timeline. Segmento orizzontale colorato che rappresenta un'era.
- **Props**: `label` (string), `mood` (MoodId), `start` (string), `end` (string), `isActive` (boolean)
- **Stati**: `default`, `hover`, `active` (bordo glow + espansione)
- **A11y**: `role="button"`, `aria-expanded`, `aria-label` con durata e mood.
- **Interazione**: Click → espande dettaglio sotto; Hover → sincronizza highlight con grafici adiacenti.

### 2.4 MoodPill
**Uso**: Filtri, tag, badge.
- **Props**: `mood` (MoodId), `size` ('sm' | 'md'), `clickable` (boolean)
- **Stati**: `default`, `hover` (se clickable), `selected` (bordo solido + glow)
- **A11y**: Se clickable, `role="checkbox"`, `aria-pressed`.
- **Interazione**: Toggle selezione con animazione di scala (0.95 → 1.0).

### 2.5 PlatformCard
**Uso**: Schermata Import.
- **Props**: `platform` (PlatformId), `status` ('empty' | 'validating' | 'parsing' | 'done' | 'error'), `count` (number, opzionale), `onDrop` (function), `onBrowse` (function)
- **Stati**: Vedi `status`. `error` mostra messaggio specifico sotto la card.
- **A11y**: Dropzone con `role="button"`, `aria-describedby` per istruzioni.
- **Interazione**: Drag over → bordo tratteggiato diventa solido + colore brand piattaforma.

### 2.6 DropZone
**Uso**: Area di trascinamento file generica.
- **Props**: `acceptedFormats` (array di stringhe), `onDrop` (function), `label` (string)
- **Stati**: `idle`, `drag-over`, `disabled`
- **A11y**: `role="region"`, `aria-label`, supporto tasto `Enter`/`Space` per aprire file picker.

### 2.7 StreamChart / MoodLine / BarWeek
**Uso**: Visualizzazioni dati.
- **Props**: `data` (array di oggetti con x, y), `colorScheme` (array di hex o 'mood')
- **Stati**: `loading` (skeleton grafico), `ready`, `tooltip-visible`
- **A11y**: Grafico SVG con `<title>` e `<desc>`. Tabella dati nascosta (`sr-only`) per screen reader.
- **Interazione**: Hover su punto/barra → tooltip con valori esatti + highlight incrociato.

### 2.8 QuadrantChart
**Uso**: Mappa Emotiva.
- **Props**: `points` (array di {x, y, size, color, label}), `quadrantLabels` (object)
- **Stati**: `default`, `point-hovered`
- **A11y**: Ogni punto è un `<button>` o `<a>` con `aria-label` descrittivo.
- **Interazione**: Click su punto → aggiorna grafici secondari sotto.

**Implementazione (Story 3.3, Sessione 103)**: i punti sono **`<button>` HTML**
posizionati sopra l'SVG della cornice, non cerchi di SVG: un punto cliccabile
deve essere un controllo della tastiera. Ogni punto ha un `aria-label` che
**dice i due valori** (`analysis.pointAria`: «2026-01: valence 0.80, energy
0.70»), non un nome generico. La **dimensione** del punto è proporzionale agli
ascolti del periodo; il **colore** è il mood dominante. Il click consegna il
periodo al chiamante: è il deep-link alla Timeline (D-25.1).

### 2.9 InsightCard
**Uso**: Analisi, spiegazione algoritmi.
- **Props**: `icon` (Lucide), `title` (string), `description` (string), `confidence` (0-1, opzionale)
- **Stati**: `pending` (bordo giallo), `confirmed` (bordo verde), `dismissed` (opacità 0.5)
- **A11y**: `role="article"`, `aria-labelledby`.
- **Interazione**: Pulsanti nascosti per confermare/correggere/ignorare l'insight.

**Implementazione (Story 3.3, Sessione 103)**: la `description` è la **frase
in prosa** dell'insight, **già resa** dal core (`EventPayload.description`,
`MemoryPayload.text` — D-A.4): la UI non re-renderizza i template. Le tre
azioni (confermare / correggere / ignorare) scrivono `Insight.status` e sono
esposte con `aria-label`; ignorare **esclude** l'insight dalla lista ma **non
lo cancella** dal database (D-25.3).

### 2.10 ShareSheet
**Uso**: Mobile, condivisione ricordi.
- **Props**: `imageUrl` (string), `platforms` (array di {id, icon, label, onClick})
- **Stati**: `generating` (spinner), `ready`, `error`
- **A11y**: Modal con `role="dialog"`, `aria-modal="true"`, focus trap.
- **Interazione**: Swipe down o click backdrop → chiudi.

**Implementazione (Story 3.2, Sessione 97)**: il dialog riceve anche `state`,
`title`, `generatingLabel`, `errorLabel`, `retryLabel` e `closeLabel` **già
resi** (il componente non conosce l'i18n) e un `onRetry` per lo stato `error`.
Le destinazioni sono le tre app (Instagram, WhatsApp, X), la copia negli
appunti, il download della card e il **capitolo HTML** (export statico
alternativo). Ogni destinazione ha un **fallback**: senza Web Share API o senza
clipboard il file viene scaricato.

### 2.10b NoteField (Story 3.2)
**Uso**: il tagging manuale — il nome dell'era e la nota libera del ricordo.
- **Props**: `fieldId` (string), `label` (string), `value` (string | null), `ariaLabel` (string), `onSave` (function)
- **Stati**: `default`, `focus`
- **A11y**: `<label>` collegato all'input, `aria-label` esplicito.
- **Interazione**: si salva all'uscita dal campo o con `Enter`. Il testo è
  locale (`Insight.userNote`) e sopravvive al ricalcolo dell'analisi.

### 2.10c DemoBanner e RevealPreview (Story 3.5)
**Uso**: la **modalità demo** (il diario di esempio) e l'**anteprima** del
risultato nel reveal post-import.

**DemoBanner**
- **Dove**: in cima alla `AppShell`, sopra la navigazione.
- **Contenuto**: il testo dichiarativo (i dati sono sintetici e il database
  dell'utente non è stato toccato) e il bottone **«Esci dalla demo»**.
- **A11y**: `role="status"` — è un annuncio, non un errore; il bottone è un
  `<button>` normale con etichetta tradotta.
- **Stato**: compare solo in modalità demo (`demo`): la shell dell'utente non
  lo mostra mai.

**RevealPreview**
- **Dove**: schermata ⑤ Prima Rivelazione, sotto il contatore degli eventi.
- **Contenuto**: titolo + **almeno tre righe** reali della timeline (periodo,
  numero di ascolti, mood dominante quando esiste).
- **Dati**: le righe vengono dal **database reale** dell'utente (non da una
  simulazione) e l'anno è **calcolato** dallo span dei dati.
- **Stato**: con dati utilizzabili → le righe; senza → nessuna anteprima (il
  reveal resta sul solo contatore), mai un segnaposto vuoto.

**Implementazione (Story 3.5, Sessione 104)**: il banner è dentro la
`AppShell` (che riceve `dbName`, `demo` e `onExitDemo`), l'anteprima è
costruita da `buildRevealPreview` (`apps/web/src/onboarding/revealPreview.ts`)
— un **modello puro** sopra i dati, testabile senza database.

## 3. Regole di Composizione

- **Spacing**: Usare sempre i token di spacing (`gap-4`, `p-6`), mai valori hardcoded.
- **Tipografia**: Titoli `Inter Tight`, corpo `Inter`, dati tecnici `JetBrains Mono`.
- **Responsive**: 
  - Mobile (<768px): 1 colonna, padding 16px, TabBar in basso.
  - Desktop (>1024px): Sidebar a sinistra, griglia 3-4 colonne, padding 32px.

## 4. Animazioni e Transizioni

| Tipo | Durata | Easing | Uso |
|------|--------|--------|-----|
| `fast` | 100ms | `ease-out` | Hover stati, tooltip |
| `base` | 200ms | `ease-in-out` | Click, toggle, modal open |
| `slow` | 400ms | `ease-out` | Page transitions, chart load |
| `count-up` | 600ms | `ease-out` | Numeri StatCard |

Rispettare sempre `@media (prefers-reduced-motion: reduce)`: disabilitare animazioni, usare transizioni istantanee.

---

## Changelog
| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 7 | Prima versione completa |
| 0.2 | Sessione 97 (2026-11-03, issue #241) | **Story 3.2 implementata**: §2.2 (MemoryCard) dichiara le tre azioni reali (nascondi, salva, condividi) e il fatto che il nascondimento **non cancella**; §2.10 (ShareSheet) dichiara le props reali (etichette già rese, `onRetry`) e i **fallback** delle destinazioni; nuova §2.10b (**NoteField**) per il tagging manuale |
| 0.3 | Sessione 103 (2026-11-05, issue #240) | **Story 3.3 implementata**: §2.8 (QuadrantChart) dichiara i punti come **`<button>` HTML** sopra l'SVG (controllo della tastiera, non cerchio), l'`aria-label` che **dichiara i due valori** e il deep-link alla Timeline; §2.9 (InsightCard) dichiara la `description` come **frase già resa** dal core (D-A.4) e le tre azioni che scrivono `Insight.status` (ignorare esclude, non cancella) |
| 0.4 | Sessione 104 (2026-11-06, issue #270) | **Story 3.5 implementata**: nuova §2.10c — il **DemoBanner** (il banner dichiarativo della modalità demo, con `role="status"` e il bottone d'uscita che cancella il database demo) e il **RevealPreview** (le prime righe della timeline reale e l'anno calcolato, costruite da un modello puro) |