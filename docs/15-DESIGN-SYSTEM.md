# 15 — Design System

> Status: 🟡 DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 0 (consolidamento)
> Asset collegati: `design/mockups/` (14 schermate), `design/tokens.json` (Sessione 7)

---

## 1. Identità del brand

### 1.1 Concept del logo

Un'**onda sonora che si distende in linea del tempo**: a sinistra la forma d'onda vibrante (la musica), a destra una linea orizzontale stabile (la vita). Metafora del prodotto: *la musica che diventa storia*.

Varianti: primaria gradiente · monocroma viola · neutra grigia · bianca · wordmark "LIFE SOUNDTRACK".

### 1.2 Tagline

> *"La colonna sonora della tua vita, finalmente leggibile."*

## 2. Palette

### 2.1 Base (dark-first, default)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-base` | `#0A0E1A` | Sfondo principale |
| `bg-surface` | `#131829` | Card e pannelli |
| `bg-elevated` | `#1A2138` | Hover, modali |
| `border-subtle` | `rgba(139,92,246,0.25)` | Bordi card |
| `text-primary` | `#FFFFFF` | Titoli, numeri |
| `text-secondary` | `#94A3B8` | Sottotitoli |
| `text-muted` | `#64748B` | Meta-info |

### 2.2 Gradiente brand

`#8B5CF6` (violet) → `#EC4899` (magenta) → `#F59E0B` (amber)
Usi: logo, CTA primarie, elementi attivi, highlight.

### 2.3 Palette mood (semantica, vincolante)

| Mood | Hex | Posizione valence/energy |
|------|-----|--------------------------|
| 😢 Triste | `#3B82F6` | valence bassa, energy bassa |
| 😤 Arrabbiato | `#EF4444` | valence bassa, energy alta |
| 😐 Neutro | `#8B5CF6` | valence media |
| 🧘 Calmo | `#10B981` | valence media, energy bassa |
| 😊 Felice | `#F59E0B` | valence alta, energy media |
| 🎉 Eccitato | `#EC4899` | valence alta, energy alta |

**Regola**: ogni visualizzazione di mood usa questa palette. Ogni mood ha sempre emoji + label testuale (mai solo colore).

### 2.4 Colori piattaforma (schermate import/settings)

Spotify `#1DB954` · YouTube `#FF0000` · Apple Music `#FA243C` · Deezer `#A238FF` · Tidal `#00FFFF` · Last.fm `#D51007` · ListenBrainz `#EB7431`

⚠️ Nota legale: nell'UI usare **riferimenti nominativi testuali o icone proprie**, non i loghi ufficiali (trademark). Da verificare in Sessione 6.

## 3. Tipografia

| Uso | Font | Peso |
|-----|------|------|
| Titoli, numeri grandi | Inter Tight | 700-800 (tabular figures) |
| Corpo, UI | Inter | 400-600 |
| Dati tecnici (URI, timestamp, IP) | JetBrains Mono | 400 |

Scala: Display 48-64 · H1 32 · H2 24 · H3 20 · Body 16 · Small 14 · Caption 12.
Licenze: Inter e JetBrains Mono sono SIL OFL → ok per uso commerciale. Documentare in Sessione 6.

## 4. Principi stilistici

1. **Dark-first**: il dark non è un'opzione, è l'identità (light mode come opzione secondaria)
2. **Glow, non ombre**: bagliori colorati sugli elementi attivi, come luci di un palco
3. **Glassmorphism moderato**: card semi-trasparenti, blur leggero, bordi gradiente sottili
4. **Angoli generosi**: 16px card desktop · 20px card mobile · full-round per pill e bottoni
5. **Spazio respirante**: padding 24-32px; una sola visualizzazione "eroe" per viewport
6. **Il colore codifica dati**: i gradienti non sono decorazione, raccontano mood/energia/periodo

## 5. Inventario componenti

| Componente | Uso |
|------------|-----|
| StatCard | Numeri grandi + label + icona (Home) |
| MemoryCard | Ricordo con artwork, titolo, mood pill, azioni |
| EraBand | Segmento colorato di era musicale (Timeline) |
| MoodPill | Pill colorata con nome mood |
| GradientButton / GhostButton | CTA primaria / secondaria |
| PlatformCard | Piattaforma con stato import (vuoto/processing/done/error) |
| DropZone | Area drag&drop file |
| StreamChart / MoodLine / QuadrantChart / BarWeek | Visualizzazioni |
| InsightCard | Narrazione in linguaggio naturale con icona lampadina |
| NavBar (desktop) / TabBar (mobile) | Navigazione |
| ShareSheet | Condivisione ricordo con card generata |

Spec dettagliate per componente (props, stati, a11y) → Sessione 7 (`07-UI-SPEC.md`).

## 6. Principi UX

1. **Privacy come feature**: il messaggio "i tuoi dati restano sul tuo dispositivo" appare in ogni punto di contatto coi dati
2. **Progressive disclosure**: prima l'emozione (ricordi, mood), poi i dati, poi i dettagli tecnici
3. **Narrazione prima dei numeri**: ogni insight è una frase in linguaggio naturale; i numeri sono supporto
4. **L'utente ha l'ultima parola**: le inferenze (eventi, mood) sono ipotesi confermabili/correggibili/ignorabili
5. **Zero frizione nell'import**: drag&drop ovunque, validazione immediata, errori con messaggi umani

## 7. Flussi principali (sintesi)

- **Onboarding**: Benvenuto → Privacy → Import → Processing → Prima Rivelazione Timeline (momento wow, una sola volta)
- **Loop quotidiano**: Home (stat + ricordo del giorno + settimana) → Timeline → Era → Esplora/Analisi
- **Ricordi**: feed mobile → Rivivi (deep-link timeline) / Condividi (ShareSheet) / Salva
- **Controllo**: Settings (piattaforme, privacy toggle, export JSON, cancellazione totale)
- **Empty state**: ogni sezione ha illustrazione + CTA di uscita; mai pagine bianche

Tour completo delle 14 schermate con navigation map: `design/mockups/TOUR.md` (da creare in Sessione 5).

## 8. Micro-interazioni

| Interazione | Feedback |
|-------------|----------|
| Hover StatCard | Glow + count-up numeri |
| Click EraBand | Espansione smooth + dettaglio |
| Scroll Timeline | Ere si illuminano al passaggio |
| Import completato | Confetti sottili |
| Prima rivelazione | Ere si colorano in sequenza 2016→2026 |
| Long-press brano (mobile) | Menu contestuale |

Motion reduction rispettata (`prefers-reduced-motion`).

## 9. Accessibilità

- Contrasti ≥ 4.5:1 su sfondo scuro
- Mood sempre con emoji + testo (non solo colore)
- Navigazione da tastiera completa; focus visibile
- Alternative testuali per ogni grafico (screen reader)
- Touch target ≥ 44px su mobile

## 10. Responsive

| Breakpoint | Layout |
|------------|--------|
| < 768px | 1 colonna, TabBar bottom, card full-width, pinch-zoom sui grafici |
| 768-1024px | Sidebar a icone, grid 2 colonne |
| > 1024px | Sidebar completa, grid 3-4 colonne |
| > 1440px | Contenuto centrato max 1400px |




---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |