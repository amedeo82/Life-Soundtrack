# 05 — Architettura Tecnica

> Status: 🟡 DRAFT
> Versione: 0.1
> Ultima modifica: Sessione 0 (consolidamento)
> ADR collegati: 0001-pwa-first, 0002-local-first, 0003-adapter-pattern (da scrivere in Sessione 1)

---

## 1. Principi architetturali

| Principio | Conseguenza |
|-----------|-------------|
| **Local-first** | Tutti i dati vivono nel browser (IndexedDB). L'app funziona offline dopo il primo caricamento |
| **Privacy-first** | Nessuna telemetria. Le uniche chiamate di rete sono: arricchimento metadati (opzionale), scrobbling hub (opzionale), sync cloud (opzionale, E2E) |
| **Adapter pattern** | Ogni piattaforma è un modulo indipendente che produce il formato unificato; aggiungere una piattaforma = aggiungere un adapter |
| **Analisi deterministica e documentata** | Ogni insight deriva da formule specificate in `04-ANALYSIS-ALGORITHMS.md`, testabili con fixture |
| **Progressive enhancement** | Funziona con una sola piattaforma; migliora con più sorgenti |

## 2. Diagramma a layer

    ┌────────────────────────────────────────────────┐
    │ LIVELLO 4 — PRESENTAZIONE (React PWA)          │
    │  Timeline · Home · Esplora · Analisi · Ricordi │
    │  Impostazioni · Import · Share                 │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 3 — ANALYSIS ENGINE (Web Worker)       │
    │  MoodTracker · EraDetector · EventDetector     │
    │  MemoryEngine · PatternAnalyzer                │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 2 — ENRICHMENT PIPELINE                │
    │  AudioFeatures · MusicBrainz lookup · Generi   │
    ├────────────────────────────────────────────────┤
    │ LIVELLO 1 — IMPORT ENGINE (Adapters)           │
    │  spotify · youtube · apple · deezer · tidal    │
    │  soundcloud · lastfm · listenbrainz · plex     │
    │            ↓ formato unificato ↓               │
    │  LOCAL DATABASE (IndexedDB / Dexie)            │
    └────────────────────────────────────────────────┘

## 3. Formato unificato (record di ascolto)

Ogni adapter produce record conformi a questo schema (dettaglio completo in `02-DATA-SCHEMA.md`):

    {
      "id": "uuid",
      "source_platform": "spotify",
      "source_id": "spotify:track:xxx",
      "timestamp": "2024-03-15T14:30:00Z",
      "duration_ms": 245000,
      "track": {
        "name": "...", "artist": "...", "album": "...",
        "isrc": "GBUM71029604", "mbid": "..."
      },
      "context": {
        "device_type": "mobile", "device_detail": "...",
        "country": "IT", "offline": false, "incognito": false,
        "shuffle": true, "skipped": false,
        "reason_start": "playbtn", "reason_end": "endplay"
      },
      "audio_features": {
        "valence": 0.45, "energy": 0.62, "danceability": 0.41,
        "tempo": 72.3, "key": 2, "mode": 0
      }
    }

I campi contestuali sono **opzionali**: le piattaforme che non li forniscono li lasciano null. Le analisi devono degradare con grazia in loro assenza.

## 4. Adapter pattern — contratto

Ogni adapter espone la stessa interfaccia logica:

    interface PlatformAdapter {
      readonly platform: PlatformId;
      detect(input: File | Blob): boolean;          // riconosce il formato
      parse(input: File | Blob): AsyncIterable<RawListenEvent>;
      parseLibrary?(input: File | Blob): Promise<LibrarySnapshot>; // playlist, saved...
    }

Regole:
- `parse` è **streaming** (AsyncIterable): mai caricare 200k eventi in memoria in un colpo
- Ogni adapter dichiara i propri edge case (vedi `01-PLATFORMS.md` §5) e li gestisce o li marca
- Output grezzo → normalizzazione UTC → deduplicazione → persistenza

## 5. Database locale

- **Engine**: IndexedDB via Dexie.js
- **Tabelle principali**: `listen_events`, `tracks`, `artists`, `albums`, `audio_features`, `sessions`, `insights`, `imports_log`
- **Indici critici**: `listen_events.timestamp`, `listen_events.track_id`, `tracks.isrc`, `tracks.mbid`
- **Migrazioni**: versionate in Dexie; ogni cambio schema = nuova versione + funzione di upgrade
- Dettaglio completo in `02-DATA-SCHEMA.md` (Sessione 1)

## 6. Pipeline di arricchimento

Problema: Spotify ha deprecato le audio-features (nov 2024); Apple non le ha mai avute.

Strategia a cascata per ogni traccia:
1. **Cache locale** (già calcolata in precedenza)
2. **AcousticBrainz dump** (gratuito, congelato a giu-2022) per MBID/ISRC noti
3. **API esterna** (FreqBlog / Musicae) — chiamata opzionale, governata dal toggle privacy
4. **Essentia.js (WASM) in-browser** su preview audio quando disponibile
5. **Fallback**: nessuna feature → le analisi basate su valence/energy degradano a analisi per genere/tag

Ogni feature salvata registra la **fonte** (`source: acousticbrainz | api | essentia | manual`) per trasparenza e ri-calcolo futuro.

## 7. Analysis engine

Esegue in **Web Worker** dedicato per non bloccare la UI. Moduli: MoodTracker, EraDetector, EventDetector, MemoryEngine, PatternAnalyzer. Ogni algoritmo è specificato con formula, parametri e esempio input→output in `04-ANALYSIS-ALGORITHMS.md` (Sessione 4). I risultati sono persistiti in `insights` con versionamento del parametro-set (permette ricalcolo coerente).

## 8. Stack tecnologico

| Componente | Scelta | Motivazione |
|------------|--------|-------------|
| Runtime UI | React 19 + TypeScript + Vite | Ecosistema, PWA-first |
| PWA | vite-plugin-pwa (Workbox) | Offline, installabilità |
| Stato | Zustand + React Query | Leggerezza, semplicità |
| DB locale | Dexie.js (IndexedDB) | API matura, migrazioni |
| Grafici | D3.js (custom) + Recharts (standard) | Timeline custom + velocità |
| UI kit | Tailwind + shadcn/ui | Coerenza col design system |
| Parsing | PapaParse (CSV), JSON nativo, streaming | File grandi |
| Audio features | Essentia.js (WASM) + API fallback | Open source |
| Test | Vitest + Playwright | Unit + e2e |
| Desktop (Fase 2) | Tauri 2.0 | 10x più leggero di Electron |
| Sync cloud (Fase 2+, opzionale) | Fastify + PostgreSQL + CRDT + E2E | Solo se richiesto |

## 9. Struttura monorepo (target Fase 0 tecnica)

    life-soundtrack/
    ├── apps/
    │   ├── web/                  # PWA principale
    │   └── desktop/              # Tauri (Fase 2)
    ├── packages/
    │   ├── core/
    │   │   ├── adapters/         # un modulo per piattaforma
    │   │   ├── analysis/
    │   │   ├── enrichment/
    │   │   ├── schema/           # tipi TypeScript condivisi
    │   │   └── db/
    │   └── ui/                   # design system componentizzato
    ├── docs/ · design/ · fixtures/ · scripts/

## 10. Requisiti non funzionali

| Requisito | Target |
|-----------|--------|
| Import 100k eventi | < 30 s |
| First contentful paint | < 1.5 s |
| Bundle iniziale | < 300 KB gzip (worker e WASM lazy) |
| Offline | 100% funzionale dopo primo load |
| Privacy | Zero PII in uscita senza toggle esplicito |
| Accessibilità | WCAG 2.1 AA |
| Browser | Chrome/Edge 90+, Firefox 90+, Safari 15+ |

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 0 | Consolidamento dalle sessioni esplorative |