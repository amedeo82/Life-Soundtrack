# 07 — Specifiche UI Componenti

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 7
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

### 2.9 InsightCard
**Uso**: Analisi, spiegazione algoritmi.
- **Props**: `icon` (Lucide), `title` (string), `description` (string), `confidence` (0-1, opzionale)
- **Stati**: `pending` (bordo giallo), `confirmed` (bordo verde), `dismissed` (opacità 0.5)
- **A11y**: `role="article"`, `aria-labelledby`.
- **Interazione**: Pulsanti nascosti per confermare/correggere/ignorare l'insight.

### 2.10 ShareSheet
**Uso**: Mobile, condivisione ricordi.
- **Props**: `imageUrl` (string), `platforms` (array di {id, icon, label, onClick})
- **Stati**: `generating` (spinner), `ready`, `error`
- **A11y**: Modal con `role="dialog"`, `aria-modal="true"`, focus trap.
- **Interazione**: Swipe down o click backdrop → chiudi.

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