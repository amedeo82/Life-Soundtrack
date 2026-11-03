# 06 — UX Flows e Stati per Schermata

> Status: 🟡 DRAFT · Versione 0.5 · Sessione 97 (2026-11-03, issue #241 — Story 3.2)
> Vincolante per: UI implementation, test E2E, copy

---

## 1. Matrice stati globale

Ogni schermata può trovarsi in uno di questi stati:

| Stato | Descrizione | Comportamento |
|-------|-------------|---------------|
| `loading` | Dati/caricamento in corso | Spinner/skeleton, nessuna azione utente |
| `empty` | Nessun dato disponibile | Illustrazione + CTA di uscita |
| `partial` | Alcuni dati, non tutti | Funzionalità ridotte + prompt per completare |
| `ready` | Stato normale | Tutte le funzionalità attive |
| `error` | Errore bloccante | Messaggio + retry + fallback |
| `offline` | Nessuna connessione (solo per feature cloud) | Messaggio + cache locale |

Regola: **mai schermate bianche**. Ogni stato ha un design definito in `15-DESIGN-SYSTEM.md` §Empty States.

## 2. Catalogo schermate con stati

### 2.1 ① Benvenuto

| Stato | Contenuto | CTA |
|-------|-----------|-----|
| `ready` (unico) | Logo + tagline + bottone | `i18n: onboarding.start` → ② |

Note: nessuna gestione errore (schermata statica).

### 2.2 ② Privacy

| Stato | Contenuto | CTA |
|-------|-----------|-----|
| `ready` | Shield + 3 garanzie (bullet) + 4 toggle privacy (`retainIp`, `enrichMetadata`, `carDetectionConsent`, `syncCloud`) + bottone | `i18n: onboarding.understood` → ③ |

### 2.3 ③ Import

| Stato | Comportamento |
|-------|---------------|
| `ready` | Lista PlatformCard (tutte vuote) |
| `partial` | ≥1 piattaforma connessa, bottone "Importa tutto" attivo |
| `loading` | DropZone mostra "Validazione..." durante drop |
| `error` | Piattaforma con file invalido → messaggio specifico sotto la card |
| `empty` | (non applicabile: c'è sempre la lista piattaforme) |

**Stati della singola PlatformCard** (vedi `07-UI-SPEC §2.5`, 5 stati, chiusura M13 audit Sessione 13):

| Stato PlatformCard | Quando | UI |
|--------------------|--------|-----|
| `empty` | Stato iniziale, nessun file | DropZone con istruzioni |
| `validating` | Adapter `detect()` in corso | Spinner + "Riconoscimento file..." |
| `parsing` | `parse()` streaming in corso | Progress bar + counter eventi live |
| `error` | Validazione fallita o parsing troncato non recuperabile | Messaggio specifico (es. "Questo file sembra di Apple Music, non di Spotify") + bottone "Riprova" |
| `done` | Import completato con successo per questa card | Badge verde + conteggio eventi |

**Transizioni**:
- Drop file → PlatformCard `empty` → `validating` (chiamata `adapter.detect()`; vedi `05-ARCHITECTURE §4`)
- `validating` OK → `parsing` (streaming `adapter.parse()` AsyncIterable, vedi `05-ARCHITECTURE §4`)
- `parsing` OK → `done` (transazione committata, vedi `05-ARCHITECTURE §5`)
- `validating` o `parsing` falliti → `error` con `AdapterError.code` (`05-ARCHITECTURE §4`); se `recoverable: true`, gli eventi validi parsati prima dell'errore sono persistiti e la card mostra "Importato parzialmente: X di Y"
- "Importa tutto" disabilitato se 0 piattaforme in stato `done` (o `done` con eventi > 0)

**Edge case UX**:
- Trascinamento di file non supportato → toast "Formato non supportato"
- Doppio drop stesso file (stesso `fileHash`) → toast "File già importato, operazione idempotente" con conteggio `eventsDuplicated`. **Non blocchiamo il re-import** (coerente con D.1.2 di `02-DATA-SCHEMA.md`): l'utente può forzare il re-import cliccando "Riprocessa" e il sistema deduplica via `eventKey`.
- File > 500MB → warning "File grande, potrebbe richiedere qualche minuto"

### 2.4 ④ Processing

| Stato | Contenuto |
|-------|-----------|
| `loading` | Progress ring + counter live + equalizer animato |
| `error` | Messaggio errore + "Riprova" / "Annulla" |
| `ready` | (transizione automatica a ⑤) |

**Counter live** (aggiornati ogni 500ms):
- Eventi analizzati
- Artisti riconosciuti
- Ere musicali in formazione (stima)

**Annullamento**: utente può annullare; import parziali sono salvati, UI torna a ③ con stato `partial`.

### 2.5 ⑤ Prima Rivelazione Timeline

| Stato | Note |
|-------|------|
| `ready` | Mostra una sola volta (flag `first_reveal_done` in localStorage) |
| `loading` | Animazione di formazione ere (sequenza 2016→oggi, 3s) |

**Comportamento**:
- Animazione non skippabile (momento wow deliberato)
- Pulsante "Salta" visibile ma discreto in basso a destra
- Click su un'era durante l'animazione → interrupt e navigazione a ⑧
- Dopo completamento → pulsante "Esplora la tua timeline" → ⑦

### 2.6 ⑥ Home

| Stato | Comportamento |
|-------|---------------|
| `empty` | Empty state: "Importa i tuoi dati per vedere la tua timeline" → ③ |
| `partial` | <100 eventi totali: mostra stats base + messaggio "Più dati importi, più la tua storia diventa ricca" |
| `ready` | 4 StatCard + MemoryCard + BarWeek + mood settimana |
| `loading` | Skeleton su tutte le card durante ricalcolo |

**Animazioni**:
- StatCard: count-up numeri all'apparizione (600ms, easing-out, vedi `design/tokens.json` `motion.countUp.duration`)
- MemoryCard: fade-in con delay 200ms
- BarWeek: barre che crescono con stagger

**Refresh**:
- Pull-to-refresh su mobile
- Auto-refresh all'apertura app se dati modificati

### 2.7 ⑦ Timeline

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Non hai ancora abbastanza dati per una timeline" → suggerisce import |
| `partial` | <6 mesi di dati: timeline presente ma con avviso "Timeline parziale" |
| `loading` | Skeleton chart durante cambio granularità |
| `ready` | EraBands + StreamChart + MoodLine sincronizzati |
| `error` | "Errore caricamento timeline" + retry |

**Granularità**: toggle Anni/Mesi/Settimane/Giorni. Cambio granularità = transizione fade 200ms.

**Sincronizzazione visualizzazioni**:
- Hover su EraBand → highlight punto corrispondente in StreamChart e MoodLine
- Hover su punto MoodLine → highlight EraBand corrispondente
- Click su EraBand → navigazione a ⑧

**Performance**:
- Lazy rendering di ere fuori viewport (virtualized list)
- Debounce hover 50ms

### 2.8 ⑧ Dettaglio Era

| Stato | Comportamento |
|-------|---------------|
| `ready` | Banner + stats + top artists + top tracks + chart |
| `loading` | Skeleton dettagliato |
| `error` | "Impossibile caricare i dettagli" + back button |

**Interazioni**:
- Click artista → ⑨ filtrato su quell'artista
- Click brano → modal con dettagli brano (mood, periodo, contesto)
- "Rivivi questo periodo" → player preview (opzionale) o lista scroll

### 2.9 ⑨ Esplora

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Nessun artista/brano/album da esplorare" → suggerisce import |
| `ready` | Search + tabs + griglie |
| `loading` | Skeleton + spinner search |
| `no-results` | "Nessun risultato per X" + suggerimenti |

**Tabs**: Artisti, Brani, Album, Generi, Mood. Cambio tab = transizione slide 200ms.

**Search**:
- Autocomplete su propri dati (non catalogo globale)
- Debounce 300ms
- Risultati ordinati per listenCount

**Mood pills**: riga in basso con 6 emoji. Click = filtro. Pill attivo ha glow.

### 2.10 ⑩ Analisi — Mappa Emotiva

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Servono almeno 3 mesi di dati per la mappa emotiva" |
| `partial` | 3-6 mesi: mappa parziale + avviso |
| `ready` | QuadrantChart + line charts + insight narrativo |
| `loading` | Skeleton grafici |

**Interazioni**:
- Click su punto mese → highlight nelle line chart sotto
- Hover su punto → tooltip con "Marzo 2024 — valence 0.31, energy 0.42, mood sad"
- Selettore periodo (anno) in alto

### 2.11 ⑪ Ricordi (mobile)

| Stato | Comportamento |
|-------|---------------|
| `empty` | "Nessun ricordo per oggi" + "Guarda tutti i ricordi" |
| `ready` | Feed scrollabile di MemoryCard |
| `loading` | Skeleton 3 card + infinite scroll |
| `error` | "Errore caricamento ricordi" + retry |

**Infinite scroll**: carica 10 ricordi alla volta.

**Swipe actions**:
- Swipe left → "Nascondi questo tipo di ricordo"
- Swipe right → "Salva nei preferiti"

**Nota libera**: sotto ogni card c'è un campo di testo (il **tag** dell'utente):
nome libero e parole chiave separate da virgola. Il testo resta in
`Insight.userNote` e sopravvive al ricalcolo dell'analisi. Il ricordo **nascosto**
esce dal feed ma **resta** nel database: cancellarlo è un atto separato (Story
5.2, export e purge).

### 2.12 ⑫ Share Sheet

| Stato | Comportamento |
|-------|---------------|
| `loading` | "Generazione card..." |
| `ready` | Preview card + 5 destinazioni |
| `error` | "Errore generazione immagine" + retry |

**Destinazioni**:
- Instagram Stories (deep link)
- WhatsApp (share)
- X (Twitter) (share)
- Copia negli appunti
- Scarica
- Capitolo HTML (export statico alternativo, per chi non usa i social)

**Fallback**: ogni destinazione ha un ripiego — senza Web Share API il file si
scarica, senza clipboard il file si scarica. L'utente deve sempre poter portare
fuori la card.

**Bottom sheet**: swipe down o tap fuori → chiudi.

### 2.13 ⑬ Impostazioni

| Stato | Sempre ready |

**Sezioni**:
1. **Piattaforme collegate**: lista con stato (connected/disconnected) + reconnect/disconnect
2. **Privacy**: 4 toggle (`retainIp`, `enrichMetadata`, `carDetectionConsent`, `syncCloud`) + spiegazioni
3. **Dati**: "Esporta tutto (JSON)" + "Cancella tutti i dati" (rosso, con conferma doppia)
4. **Preferenze**: tema, lingua

**Cancella dati**:
- Click → modal conferma 1: "Sicuro?"
- Conferma → modal 2: "Digita ELIMINA per confermare"
- Input corretto → delete + redirect a ⑭ Empty

### 2.14 ⑭ Empty State

| Stato | Comportamento |
|-------|---------------|
| `empty` | Illustrazione + "La tua storia inizia qui" + CTA Import + CTA Demo |

**Variante per sezione**:
- Home: "Importa i tuoi dati di streaming"
- Timeline: "Importa per vedere la tua timeline"
- Esplora: "Importa per esplorare il tuo catalogo"
- Analisi: "Importa per vedere le tue analisi"
- Ricordi: "Importa per generare ricordi"

**Demo mode**: click su "Scopri come funziona" → carica fixture `fixtures/demo-user.json` (1 anno, 4.500 eventi, 200 brani, 30 artisti, generato da `scripts/generate-fixtures.mjs`); flag `_metadata.demoMode = true` (tutti i dati cancellabili con un click).

## 3. Flussi utente principali

### 3.1 Flusso Onboarding (prima volta)

    ① Benvenuto
       │
       ▼ (tap "Inizia il viaggio")
    ② Privacy
       │
       ▼ (tap "Ho capito, continua")
    ③ Import
       │
       ▼ (drag&drop file Spotify + click "Importa tutto")
    ④ Processing
       │
       ▼ (automatico al 100%)
    ⑤ Prima Rivelazione
       │
       ▼ (tap "Esplora la tua timeline")
    ⑦ Timeline
       │
       ▼ (auto-redirect dopo 10s o tap)
    ⑥ Home

### 3.2 Flusso Quotidiano

    Apertura app
       │
       ▼
    ⑥ Home
       ├→ tap StatCard → ⑩ Analisi
       ├→ tap MemoryCard → ⑪ Ricordi
       └→ tap barra settimanale → ⑦ Timeline → ⑧ Era → ⑨ Esplora

### 3.3 Flusso Condivisione Ricordo

    ⑪ Ricordi
       │
       ▼ (tap "Condividi")
    ⑫ Share Sheet
       │
       ├→ Instagram → deep link con immagine
       ├→ WhatsApp → share sheet nativo
       ├→ Copia → toast "Immagine copiata"
       └→ Scarica → save to gallery + toast "Salvato"

### 3.4 Flusso Cancellazione Totale

    ⑬ Impostazioni
       │
       ▼ (tap "Cancella tutti i dati")
    Modal 1 ("Sicuro?")
       │
       ▼ (tap "Continua")
    Modal 2 ("Digita ELIMINA")
       │
       ▼ (input corretto)
    Delete DB + redirect a ⑭ Empty

## 4. Stato machine di Import

    ┌────────┐    drop     ┌─────────────┐   valid    ┌──────────┐
    │  IDLE  │────────────▶│  VALIDATING │───────────▶│ PARSING  │
    └────────┘             └─────────────┘            └─────┬────┘
       ▲                           │                        │
       │                      invalid                   parse ok
       │                           │                        │
       │                           ▼                        ▼
       │                    ┌─────────────┐          ┌──────────┐
       │                    │   ERROR     │          │ENRICHING │
       │                    └─────────────┘          └─────┬────┘
       │                          │                        │
       │                      retry                   enrich ok
       │                          │                        │
       └──────────────────────────┴────────────────────────┴──────▶ DONE
                                                                       │
                                                                    upsert
                                                                       │
                                                                       ▼
                                                                  PERSISTED

## 5. Gestione errori

| Categoria | UX Pattern |
|-----------|------------|
| **Errore validazione file** | Messaggio inline sotto la card, tono umano ("Questo file sembra di Apple Music, non di Spotify") |
| **Errore parsing** | Toast "Import parzialmente fallito: X eventi importati, Y scartati" + dettaglio in Settings |
| **Errore enrichment** | Silenzioso; dati salvati senza audio features; avviso aggregato in Settings |
| **Errore DB** | Modal "Errore critico, ricarica l'app" + log in console |
| **Errore rete (se cloud)** | Banner in alto "Sei offline, i dati sono salvati localmente" |

## 6. Feedback micro-interazioni

| Interazione | Feedback |
|-------------|----------|
| Hover StatCard | Glow + count-up animato |
| Click EraBand | Espansione smooth 200ms |
| Scroll Timeline | Fade-in ere al passaggio |
| Import completato | Confetti sottili (ridotti se `prefers-reduced-motion`) |
| Ricordo condiviso | Toast "Immagine condivisa" 3s |
| Swipe MemoryCard | Animazione 150ms con rubber-band |
| Toggle privacy | Switch 150ms + conferma "Impostazione salvata" |

## 7. Keyboard navigation

| Schermata | Scorciatoie |
|-----------|-------------|
| Globale | `/` focus search; `Esc` chiude modal; `?` mostra shortcuts |
| Timeline | `←` `→` cambio periodo; `+` `-` zoom granularità |
| Home | `M` vai a ricordi; `T` vai a timeline |
| Esplora | `↑` `↓` navigate risultati; `Enter` seleziona |

## 8. Screen reader

Ogni visualizzazione ha un'alternativa testuale nascosta:
- StreamChart → "Ascolti mensili: gennaio 40h, febbraio 52h, ..."
- MoodLine → "Mood dominante: gennaio felice, febbraio neutro, marzo triste"
- QuadrantChart → "Il tuo anno è stato prevalentemente felice (valence media 0.62)"

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 5 | Prima versione completa |
| 0.2 | Sessione 9 (2026-10-15) | Audit: re-import esplicito come idempotente (M8) — niente blocco al doppio drop, dedup via `eventKey`; riferimento count-up al token `motion.countUp.duration` (M11) |
| 0.3 | Sessione 13 (2026-10-16) | **M13 chiuso**: §2.3 Import ora esplicita i 5 stati della singola PlatformCard (`empty`/`validating`/`parsing`/`done`/`error`) con tabella + transizioni dettagliate. §2.14 demo-user.json ora punta a `fixtures/demo-user.json` (1 anno, 4500 eventi, flag `demoMode=true`) |
| 0.4 | Sessione 42 (2026-10-21) | Allineamento §2.2 e §2.13 a 4 toggle privacy (`retainIp`, `enrichMetadata`, `carDetectionConsent`, `syncCloud`); risolto drift documentazione↔codice (issue #107) |
| 0.5 | Sessione 97 (2026-11-03, issue #241) | **Story 3.2 implementata**: §2.11 (⑪ Ricordi) dichiara la **nota libera** sotto ogni card (il tag dell'utente, in `Insight.userNote`, sopravvive al ricalcolo) e il fatto che il ricordo nascosto **resta** nel database; §2.12 (⑫ Share Sheet) aggiunge la destinazione **Capitolo HTML** (export statico alternativo) e il **fallback** di ogni azione (senza Web Share API o senza clipboard il file si scarica) |