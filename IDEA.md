# 📋 LIFE SOUNDTRACK — Documento di Progettazione Completo v1.0

Boss, ecco la **"bibbia del progetto"**. Ho strutturato tutto in sezioni che potrai usare come riferimento costante durante lo sviluppo. Questo documento è pensato per essere letto da te, da eventuali collaboratori, e da chiunque voglia capire cosa stiamo costruendo.

---

## 📑 INDICE DEL DOCUMENTO

1. [Visione e Missione](#1)
2. [Matrice Piattaforme Europee e Dati Ottenibili](#2)
3. [Schema Dati Unificato](#3)
4. [Motore di Analisi — Risultati Ottenibili](#4)
5. [Architettura del Prodotto](#5)
6. [Scelta della Piattaforma — Desktop vs Mobile vs Web](#6)
7. [Mockup delle Schermate](#7)
8. [Specifiche Tecniche](#8)
9. [Roadmap di Implementazione](#9)
10. [Rischi e Mitigazioni](#10)

---

## 1. 🌟 VISIONE E MISSIONE

### 1.1 Il Problema

Le piattaforme di streaming musicale raccolgono **una quantità enorme di dati intimi** su ogni utente: cosa ascolta, quando, dove, da quale dispositivo, per quanto tempo, se salta i brani, se usa lo shuffle. Eppure, tutto quello che restituiscono è un **"Wrapped" annuale** con 5 artisti e 5 brani.

È come avere un diario segreto di 10 anni e usarlo solo per contare quante volte hai scritto la parola "ciao".

### 1.2 La Soluzione

**Life Soundtrack** è un'applicazione che trasforma i metadati grezzi delle piattaforme di streaming in un **diario di vita musicale**: una timeline personale, emotiva e contestuale che racconta la storia dell'utente attraverso la musica.

### 1.3 Principi Fondamentali

| Principio | Significato |
|-----------|-------------|
| **Privacy-first** | I dati restano sul dispositivo dell'utente. Nessun server centrale. |
| **Local-first** | L'app funziona offline. I dati non lasciano mai il device. |
| **Open data** | L'utente è proprietario dei propri dati e può esportarli in qualsiasi momento. |
| **Estensibilità** | Aggiungere una nuova piattaforma non richiede modifiche al core. |
| **Nessun lock-in** | Nessun abbonamento forzato, nessun dato ostaggio. |

### 1.4 Tagline

> *"La colonna sonora della tua vita, finalmente leggibile."*

### 1.5 Target Utenti

| Segmento | Descrizione | Bisogno |
|----------|-------------|---------|
| **Nostalgici** | 25-45 anni, vogliono rivivere periodi della vita | "Che musica ascoltavo quando mi sono laureato?" |
| **Quantified Self** | Appassionati di dati personali, tracking | "Voglio vedere pattern e statistiche profonde" |
| **Audiofili** | Collezionisti, utenti Qobuz/Tidal/Plex | "Voglio unificare tutte le mie fonti" |
| **Curiosi** | Utenti casuali incuriositi da Wrapped | "Voglio andare oltre le 5 canzoni top" |
| **Privacy-conscious** | Utenti europei sensibili a GDPR | "Voglio i miei dati, non quelli di Spotify" |

---

## 2. 📊 MATRICE PIATTAFORME EUROPEE E DATI OTTENIBILI

### 2.1 Panoramica delle Sorgenti

| # | Piattaforma | Sede | Metodo di accesso | Formato | Frequenza aggiornamento | Difficoltà |
|---|-------------|------|-------------------|---------|------------------------|------------|
| 1 | **Spotify** | Svezia | GDPR Download | JSON | Manuale (richiesta) | 🟢 Bassa |
| 2 | **YouTube Music** | USA (dominante in EU) | Google Takeout | JSON/CSV | Manuale | 🟢 Bassa |
| 3 | **Apple Music** | USA (molto diffusa) | Privacy Portal | CSV/JSON | Manuale | 🟡 Media |
| 4 | **Deezer** | Francia | GDPR Download + API | JSON | Manuale + real-time | 🟡 Media |
| 5 | **Tidal** | Norvegia/Svezia | API OAuth 2.0 | JSON | Real-time | 🟡 Media |
| 6 | **SoundCloud** | Germania | GDPR + API | JSON | Manuale | 🟡 Media |
| 7 | **Last.fm** | UK (CBS) | API pubblica | JSON/XML | Real-time | 🟢 Bassa |
| 8 | **ListenBrainz** | USA (no-profit) | API pubblica | JSON | Real-time | 🟢 Bassa |
| 9 | **Qobuz** | Francia | Export playlist | CSV | Manuale | 🔴 Alta |
| 10 | **IDAGIO** | Germania | Da valutare | — | — | 🔴 Alta |
| 11 | **Plex/Navidrome** | Self-hosted | API locale | JSON | Real-time | 🟢 Bassa |

### 2.2 Dettaglio Campi per Piattaforma

#### SPOTIFY — GDPR Extended Streaming History

```
Campi disponibili per ogni evento di ascolto:
├── ts                          → Timestamp fine ascolto (UTC, ISO 8601)
├── platform                    → Dispositivo (es. "Android OS 13 (samsung)")
├── ms_played                   → Millisecondi ascoltati
├── conn_country                → Paese di connessione (ISO 3166-1)
├── ip_addr                     → Indirizzo IP
├── master_metadata_track_name  → Nome brano
├── master_metadata_album_artist_name → Nome artista
├── master_metadata_album_album_name  → Nome album
├── spotify_track_uri           → URI univoco (spotify:track:xxx)
├── episode_name                → Nome episodio podcast (se podcast)
├── episode_show_name           → Nome show podcast
├── reason_start                → Come è iniziato (playbtn, clickrow, trackdone, appload...)
├── reason_end                  → Come è finito (endplay, fwdbtn, backbtn, trackdone...)
├── shuffle                     → true/false
├── skipped                     → true/false
├── offline                     → true/false
├── offline_timestamp           → Timestamp modalità offline
└── incognito_mode              → true/false

File aggiuntivi nel download:
├── SearchQueries.json          → Tutte le ricerche con timestamp
├── Playlist*.json              → Playlist con date di creazione/aggiunta
├── YourLibrary.json            → Brani salvati, artisti seguiti
├── Follow.json                 → Chi segui
├── Wrapped*.json               → Dati Wrapped annuali
├── CarDetectionEvent.json      → Rilevamento auto (Bluetooth)
├── AdRequestEvent.json         → Pubblicità (account free)
└── Userdata.json               → Dati account
```

**Volume stimato**: ~15.000 eventi/anno per utente attivo. 10 anni = ~150.000 eventi.

#### YOUTUBE MUSIC — Google Takeout

```
Campi disponibili:
├── time                        → Timestamp (ISO 8601)
├── title                       → Titolo video/brano
├── titleUrl                    → URL del video
├── activityControls            → Tipo di attività
├── products                    → ["YouTube", "YouTube Music"]
├── details                     → Metadati aggiuntivi
│   ├── name                    → Nome canale/artista
│   └── url                     → URL canale
└── locationInfo                → Geolocalizzazione (se attiva)

Limitazioni:
- Cronologia combinata YouTube + YouTube Music
- Non distingue sempre tra ascolto attivo e video in background
- Formato leggermente diverso tra YouTube e YT Music
```

#### APPLE MUSIC — Privacy Portal

```
Campi disponibili (formato CSV):
├── Song Name                   → Nome brano
├── Artist Name                 → Nome artista
├── Album Name                  → Nome album
├── Play Date UTC               → Timestamp ascolto
├── Media Type                  → Tipo media (audio, video)
├── Playlist Name               → Playlist di provenienza
└── Content Rating              → Rating contenuto

File aggiuntivi:
├── Apple Media Services Information → Dati account
├── Playlists.csv               → Playlist con date
├── Library.csv                 → Libreria salvata
└── Replay data                 → Dati annuali (tipo Wrapped)

Limitazioni:
- Nessuna audio features
- Formato CSV meno strutturato di Spotify
- Nessun campo "skipped" o "shuffle"
```

#### DEEZER — GDPR + API

```
Campi GDPR (simili a Spotify ma meno dettagliati):
├── timestamp                   → Data/ora ascolto
├── track_name                  → Nome brano
├── artist_name                 → Nome artista
├── album_name                  → Nome album
└── duration                    → Durata ascoltata

API pubblica (in tempo reale, limitata):
├── /user/me                    → Profilo utente
├── /user/me/history            → Cronologia (limitata)
├── /user/me/playlists          → Playlist
├── /user/me/favorites          → Preferiti
└── /user/me/recommendations    → Raccomandazioni

Limitazioni:
- GDPR export lento (fino a 11 mesi in alcuni casi)
- API non restituisce tutta la cronologia storica
- Meno metadati contestuali rispetto a Spotify
```

#### TIDAL — API Pubblica

```
API OAuth 2.0 (openapi.tidal.com v2):
├── /users/me                   → Profilo utente
├── /users/me/playlists         → Playlist personali
├── /users/me/favorites         → Preferiti
├── /playlists/{id}/items       → Contenuto playlist
├── /tracks/{id}                → Metadata brano
├── /albums/{id}                → Metadata album
└── /artists/{id}               → Metadata artista

Campi per traccia:
├── title, artist, album
├── duration
├── isrc
├── audioQuality (LOW, HIGH, LOSSLESS, HI_RES)
├── audioModes (STEREO, DOLBY_ATMOS)
└── explicit

Limitazioni:
- Nessuna cronologia di ascolto storica via API
- Serve account Tidal attivo
- Rate limits da verificare
```

#### SOUNDCLOUD — GDPR + API

```
GDPR Export:
├── Cronologia ascolti (max 1000 brani)
├── Like e preferiti
├── Playlist
├── Follow
└── Commenti

API pubblica:
├── /users/me                   → Profilo
├── /users/me/favorites         → Preferiti
├── /users/me/playlists         → Playlist
└── /users/me/followings        → Chi segui

Limitazioni:
- Cronologia limitata a 1000 brani
- API con rate limits
- Molti brani rimossi/privati nel tempo
```

#### LAST.FM — API Pubblica

```
Endpoint principali:
├── user.getInfo                → Profilo utente
├── user.getRecentTracks        → Ultime tracce (paginabile)
├── user.getTopArtists          → Top artisti per periodo
├── user.getTopTracks           → Top brani per periodo
├── user.getTopAlbums           → Top album per periodo
├── user.getWeeklyTrackChart    → Chart settimanale
├── user.getWeeklyArtistChart   → Chart settimanale artisti
└── user.getPlaylists           → Playlist

Campi per scrobble:
├── name, artist, album
├── date (timestamp)
├── loved (0/1)
└── image (varie dimensioni)

Vantaggi:
- API gratuita e ben documentata
- Paginazione completa (tutta la storia)
- Nessun limite temporale
- Supporta "loved tracks" (brani preferiti)

Limitazioni:
- Nessun contesto (dispositivo, luogo, shuffle)
- Solo dati inseriti tramite scrobbling
- Rate limit: 5 richieste/secondo (API key gratuita)
```

#### LISTENBRAINZ — API Pubblica

```
Endpoint principali:
├── /1/user/{username}/listens       → Tutti gli ascolti (paginabile)
├── /1/user/{username}/listen-count  → Numero totale
├── /1/user/{username}/playing-now   → In ascolto ora
├── /1/user/{username}/stats         → Statistiche aggregate
├── /1/user/{username}/feed          → Feed sociale
└── /1/user/{username}/recommendations → Raccomandazioni

Campi per listen:
├── listened_at (timestamp unix)
├── track_metadata:
│   ├── track_name
│   ├── artist_name
│   ├── release_name
│   └── additional_info:
│       ├── recording_mbid (MusicBrainz ID)
│       ├── artist_mbids
│       ├── release_mbid
│       ├── isrc
│       ├── spotify_id
│       ├── youtube_id
│       └── origin_url
└── user_name

Vantaggi:
- Completamente open source e gratuito
- API senza limiti restrittivi
- MusicBrainz IDs integrati (normalizzazione perfetta)
- Supporta 30+ piattaforme come sorgente
- Dati arricchiti con tag, generi, relazioni MusicBrainz

Limitazioni:
- Nessun contesto (dispositivo, luogo)
- Solo dati scrobblati (non storici pre-adozione)
```

### 2.3 Tabella Riassuntiva — Dati per Categoria

| Categoria di dato | Spotify | YT Music | Apple | Deezer | Tidal | SoundCloud | Last.fm | ListenBrainz |
|---|---|---|---|---|---|---|---|---|
| Timestamp ascolto | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ | ✅ |
| Durata ascoltata | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dispositivo | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| IP / Paese | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Skip | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Shuffle | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Offline | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ricerche | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Playlist con date | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Brani salvati | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| MusicBrainz IDs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| ISRC | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Audio Quality | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Loved/Favorite | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Copertura storica | Completa | Completa | Completa | Parziale | No | 1000 max | Completa | Completa |

**Legenda**: ✅ Completo | ⚠️ Parziale | ❌ Assente

---

## 3. 🗄️ SCHEMA DATI UNIFICATO

### 3.1 Modello Concettuale

```
┌─────────────────────────────────────────────────────────────────┐
│                        LISTEN_EVENT                             │
│  (L'atomo fondamentale: un singolo evento di ascolto)          │
├─────────────────────────────────────────────────────────────────┤
│  id: UUID                                                       │
│  timestamp: DateTime (UTC)                                      │
│  duration_ms: Integer                                           │
│  source_platform: Enum                                          │
│  source_track_id: String (URI originale)                        │
│  skipped: Boolean                                               │
│  shuffle: Boolean                                               │
│  offline: Boolean                                               │
│  incognito: Boolean                                             │
│  reason_start: Enum                                             │
│  reason_end: Enum                                               │
│  device_type: Enum (mobile, desktop, web, speaker, car, other)  │
│  device_detail: String                                          │
│  country: String (ISO 3166-1)                                   │
│  ──────────────────────────────────────────────────────────────  │
│  track_id: FK → Track                                           │
│  session_id: FK → ListeningSession                              │
│  context_id: FK → Context (opzionale)                           │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          TRACK                                   │
│  (Il brano musicale, normalizzato)                               │
├─────────────────────────────────────────────────────────────────┤
│  id: UUID                                                       │
│  name: String                                                   │
│  artist_id: FK → Artist                                         │
│  album_id: FK → Album                                           │
│  isrc: String (univoco internazionale)                          │
│  mbid: String (MusicBrainz Recording ID)                        │
│  duration_ms: Integer                                           │
│  explicit: Boolean                                              │
│  audio_features_id: FK → AudioFeatures                          │
│  ──────────────────────────────────────────────────────────────  │
│  platform_ids: JSONB                                            │
│  {                                                              │
│    "spotify": "spotify:track:xxx",                              │
│    "apple": "1234567890",                                       │
│    "deezer": "987654321",                                       │
│    "youtube": "dQw4w9WgXcQ"                                     │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AUDIO_FEATURES                            │
│  (Le caratteristiche acustiche del brano)                       │
├─────────────────────────────────────────────────────────────────┤
│  id: UUID                                                       │
│  track_id: FK → Track                                           │
│  valence: Float (0-1) → positività emotiva                      │
│  energy: Float (0-1) → intensità                                │
│  danceability: Float (0-1) → ballabilità                        │
│  acousticness: Float (0-1) → acusticità                         │
│  instrumentalness: Float (0-1) → strumentale                    │
│  speechiness: Float (0-1) → parlato                             │
│  liveness: Float (0-1) → dal vivo                               │
│  tempo: Float (BPM)                                             │
│  key: Integer (0-11)                                            │
│  mode: Integer (0=minore, 1=maggiore)                           │
│  loudness: Float (dB)                                           │
│  time_signature: Integer                                        │
│  source: Enum (spotify, essentia, acousticbrainz, manual)       │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       LISTENING_SESSION                          │
│  (Una sessione di ascolto continuo)                             │
├─────────────────────────────────────────────────────────────────┤
│  id: UUID                                                       │
│  start_time: DateTime                                           │
│  end_time: DateTime                                             │
│  duration_ms: Integer                                           │
│  track_count: Integer                                           │
│  device_type: Enum                                              │
│  platform: Enum                                                 │
│  mood_inferred: String (calcolato)                              │
│  context_inferred: String (lavoro, relax, viaggio, sport...)    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Entità Derivate (calcolate, non salvate direttamente)

| Entità | Descrizione | Come si calcola |
|--------|-------------|-----------------|
| **Era Musicale** | Periodo con caratteristiche distintive | Clustering su generi, artisti, audio features |
| **Mood del giorno** | Stato emotivo prevalente | Media pesata valence/energy degli ascolti del giorno |
| **Evento di vita** | Cambiamento significativo | Anomaly detection su pattern di ascolto |
| **Colonna sonora** | Brani rappresentativi di un periodo | Top brani per frequenza + engagement |
| **Luogo** | Dove si ascoltava | Geocoding IP (opzionale, privacy-sensitive) |

---

## 4. 🧠 MOTORE DI ANALISI — RISULTATI OTTENIBILI

### 4.1 Livelli di Analisi

```
LIVELLO 1 — STATISTICHE BASE (già esistenti nelle app, ma unificate)
├── Totale brani/album/artisti ascoltati
├── Tempo totale di ascolto
├── Top artisti/brani/album per periodo
├── Generi più ascoltati
└── Confronto tra periodi

LIVELLO 2 — PATTERN TEMPORALI (differenziante)
├── Ritmo circadiano musicale (cosa ascolti a che ora)
├── Pattern settimanali (lunedì vs sabato)
├── Pattern stagionali (inverno vs estate)
├── Durata media sessioni nel tempo
├── Frequenza di ascolto (giorni attivi vs totali)
└── "Orari insoliti" (ascolti alle 3 di notte)

LIVELLO 3 — ANALISI EMOTIVA (molto differenziante)
├── Mood tracking giornaliero/settimanale/mensile
├── Grafico valence/energy nel tempo
├── Periodi di musica "felice" vs "triste"
├── Correlazione con stagioni/meteo
├── Brani "ancora emotiva" (associati a periodi specifici)
└── Transizioni emotive (cambiamenti di mood)

LIVELLO 4 — EVENTI DI VITA (il cuore del progetto)
├── Rilevamento "ere musicali" (cambiamenti di gusto)
├── Anomaly detection (picchi improvvisi di un artista/genere)
├── Periodi di ripetizione ossessiva (comfort listening)
├── Periodi di esplorazione (tanta musica nuova)
├── Periodi di silenzio (meno ascolto = periodo intenso?)
├── Cambiamenti correlati a eventi esterni (lockdown, estate, ecc.)
└── "Canzone del momento" per ogni periodo significativo

LIVELLO 5 — PROFILO PERSONALE (avanzato)
├── Personalità musicale (Big Five correlati)
├── Livello di "obscuring" (mainstream vs nicchia)
├── Apertura musicale (diversità generi nel tempo)
├── Fedeltà vs esplorazione (artisti ricorrenti vs nuovi)
├── Stile di ascolto (attivo vs passivo, shuffle vs sequenziale)
└── "Impronta musicale" (firma unica dell'utente)
```

### 4.2 Esempi Concreti di Output

#### Esempio 1: "Il tuo marzo 2020"
```
📅 Marzo 2020 — "L'era del lockdown"

🎵 Colonna sonora del mese:
   1. "Everything I Wanted" — Billie Eilish (47 ascolti)
   2. "Blinding Lights" — The Weeknd (39 ascolti)
   3. "Dance Monkey" — Tones and I (31 ascolti)

📊 Dati:
   • 342 ore di ascolto (+180% rispetto a febbraio)
   • 89% da mobile (eri sempre a casa)
   • Picco di ascolto: 21:00-23:00
   • Generi dominanti: Pop (45%), Indie (22%), Lo-fi (18%)

🎭 Mood del mese:
   • Valence media: 0.52 (neutro-leggermente positivo)
   • Energy media: 0.48 (bassa, musica rilassante)
   • Pattern: musica più calma la sera, più energica al mattino

💡 Insight:
   "Il tuo ascolto è triplicato a marzo 2020. La musica è diventata
   la tua compagna durante il lockdown. Hai scoperto il Lo-fi,
   che non avevi mai ascoltato prima, e lo hai usato come
   sottofondo per lavorare da casa."
```

#### Esempio 2: "La tua estate 2019"
```
📅 Luglio-Agosto 2019 — "L'estate on the road"

🎵 Colonna sonora:
   1. "Old Town Road" — Lil Nas X (62 ascolti)
   2. "Señorita" — Shawn Mendes, Camila Cabello (48 ascolti)
   3. "Dance Monkey" — Tones and I (41 ascolti)

📊 Dati:
   • 78% ascolti da mobile
   • 23% offline (viaggi senza connessione)
   • conn_country cambiato: IT → HR → GR → IT
   • Shuffle: 92% (ascolto casuale, relax)

🎭 Mood:
   • Valence: 0.78 (molto positivo)
   • Energy: 0.72 (alta, musica estiva)
   • Danceability: 0.81 (molto ballabile)

💡 Insight:
   "La tua estate 2019 è stata itinerante: sei stato in Croazia
   e Grecia. La musica era allegra, ballabile, e l'hai ascoltata
   quasi sempre in shuffle — segno di relax e spensieratezza.
   'Old Town Road' è stata la tua canzone dell'estate."
```

#### Esempio 3: "Rilevamento evento"
```
⚡ Evento rilevato: Ottobre 2021

📊 Cosa è cambiato:
   • Picco improvviso di ascolti di Adele (+400% in 2 settimane)
   • Valence crollata da 0.65 a 0.31
   • Ascolti notturni (01:00-03:00) aumentati del 300%
   • Skip rate aumentato (irrequietezza)
   • Sessioni più lunghe ma meno varie

🎵 Brani dominanti:
   • "Someone Like You" — Adele
   • "When We Were Young" — Adele
   • "Fix You" — Coldplay

💡 Possibile interpretazione:
   "Nell'ottobre 2021 c'è stato un cambiamento emotivo significativo.
   La musica è diventata più malinconica, con ascolti notturni e
   ripetitivi. Potrebbe indicare un periodo di riflessione,
   una rottura, o un momento difficile."

   [L'utente può confermare, modificare o ignorare]
```

### 4.3 Funzionalità "Ricordi" (tipo Facebook Memories)

| Tipo di ricordo | Trigger | Esempio |
|-----------------|---------|---------|
| **On questo giorno** | Stessa data, anni fa | "3 anni fa ascoltavi 'Bohemian Rhapsody' in loop" |
| **Canzone dell'anno** | Brano più ascoltato dell'anno | "Nel 2019, la tua canzone era 'Old Town Road'" |
| **Prima volta** | Primo ascolto di un artista | "5 anni fa scoprivi i Radiohead" |
| **Era musicale** | Inizio/fine di un periodo | "L'era 'Indie Folk' è durata da marzo a settembre 2020" |
| **Milestone** | Traguardi numerici | "Hai ascoltato 100.000 brani! Il primo fu..." |
| **Ritorno** | Artista riascoltato dopo tempo | "Non ascoltavi i Daft Punk da 3 anni. Bentornato!" |
| **Stagionale** | Pattern annuale | "Come ogni dicembre, è tornato il periodo jazz" |

---

## 5. 🏗️ ARCHITETTURA DEL PRODOTTO

### 5.1 Architettura Generale

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LIFE SOUNDTRACK                             │
│                    Architettura Local-First                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    LIVELLO PRESENTAZIONE                     │    │
│  │                                                             │    │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │
│  │   │  Web App     │  │  Desktop App │  │  PWA Mobile  │     │    │
│  │   │  (React)     │  │  (Electron)  │  │  (Responsive)│     │    │
│  │   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │    │
│  │          │                 │                  │              │    │
│  │          └─────────────────┴──────────────────┘              │    │
│  │                            │                                 │    │
│  │                            ▼                                 │    │
│  │              ┌──────────────────────────┐                    │    │
│  │              │     State Management     │                    │    │
│  │              │     (React Query /       │                    │    │
│  │              │      Zustand)            │                    │    │
│  │              └────────────┬─────────────┘                    │    │
│  └───────────────────────────┼──────────────────────────────────┘    │
│                              │                                      │
│  ┌───────────────────────────┼──────────────────────────────────┐    │
│  │                    LIVELLO LOGICA                             │    │
│  │                              │                                │    │
│  │   ┌──────────────────────────┴──────────────────────────┐     │    │
│  │   │              ANALYSIS ENGINE                         │     │    │
│  │   │                                                     │     │    │
│  │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │     │    │
│  │   │  │  Mood   │ │  Era    │ │  Event  │ │  Memory │  │     │    │
│  │   │  │ Tracker │ │ Detector│ │ Detector│ │ Engine  │  │     │    │
│  │   │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │     │    │
│  │   └─────────────────────────────────────────────────────┘     │    │
│  │                              │                                │    │
│  │   ┌──────────────────────────┴──────────────────────────┐     │    │
│  │   │            ENRICHMENT PIPELINE                       │     │    │
│  │   │                                                     │     │    │
│  │   │  Audio Features → MusicBrainz → Genre → Tags        │     │    │
│  │   └─────────────────────────────────────────────────────┘     │    │
│  └───────────────────────────┼──────────────────────────────────┘    │
│                              │                                      │
│  ┌───────────────────────────┼──────────────────────────────────┐    │
│  │                    LIVELLO DATI                               │    │
│  │                              │                                │    │
│  │   ┌──────────────────────────┴──────────────────────────┐     │    │
│  │   │              IMPORT ENGINE (Adapters)                │     │    │
│  │   │                                                     │     │    │
│  │   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │     │    │
│  │   │  │Spotify │ │YouTube │ │ Apple  │ │Deezer  │ ...   │     │    │
│  │   │  │Adapter │ │Adapter │ │Adapter │ │Adapter │       │     │    │
│  │   │  └────────┘ └────────┘ └────────┘ └────────┘       │     │    │
│  │   └─────────────────────────────────────────────────────┘     │    │
│  │                              │                                │    │
│  │   ┌──────────────────────────┴──────────────────────────┐     │    │
│  │   │              LOCAL DATABASE                           │     │    │
│  │   │         (SQLite / IndexedDB)                         │     │    │
│  │   │                                                     │     │    │
│  │   │  listen_events | tracks | artists | albums          │     │    │
│  │   │  audio_features | sessions | derived_insights       │     │    │
│  │   └─────────────────────────────────────────────────────┘     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │              OPZIONALE: CLOUD SYNC                            │    │
│  │         (solo se l'utente lo richiede esplicitamente)         │    │
│  │              End-to-end encrypted                             │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Principio "Local-First"

**I dati NON lasciano mai il dispositivo dell'utente** se non per:
1. Arricchimento audio features (chiamata API a Essentia/FreqBlog con solo il nome del brano, senza dati personali)
2. Lookup MusicBrainz (solo metadati brano, senza dati utente)
3. Sync cloud opzionale (end-to-end encrypted, solo se l'utente lo attiva)

---

## 6. 📱 SCELTA DELLA PIATTAFORMA

### 6.1 Analisi Comparativa

| Criterio | Web App (PWA) | Desktop App | Mobile App |
|----------|---------------|-------------|------------|
| **Screen real estate** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Installabilità** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Accesso ai file** | ⭐⭐ (drag&drop) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Notifiche "Ricordi"** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Condivisione social** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Privacy (local)** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Costo sviluppo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Manutenzione** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Distribuzione** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ (app store) |
| **Funziona offline** | ⭐⭐⭐⭐ (PWA) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### 6.2 La Mia Raccomandazione

**🏆 PWA (Progressive Web App) come piattaforma primaria**

Motivazioni:

1. **Un codebase, tutte le piattaforme**: funziona su desktop, tablet e mobile con lo stesso codice
2. **Nessun app store**: distribuzione diretta, aggiornamenti immediati, niente commissioni Apple/Google
3. **Local-first possibile**: con IndexedDB e Service Workers, funziona offline e salva dati localmente
4. **Installabile**: l'utente può "installarla" sul desktop o sulla home del telefono
5. **Privacy**: nessun intermediario, i dati restano nel browser
6. **Costo**: un terzo del costo rispetto a sviluppare 3 app separate

**🥈 Desktop App (Electron/Tauri) come seconda fase**

Per utenti power (audiofili, quantified self) che vogliono:
- Accesso diretto al file system
- Processing pesante in background
- Integrazione con Plex/Navidrome locale
- Notifiche desktop

**🥉 Mobile come PWA responsive**

La PWA funziona già su mobile. Per notifiche push e condivisione social, in fase 2 si può valutare un wrapper nativo.

### 6.3 Struttura della PWA

```
┌─────────────────────────────────────────────┐
│              LIFE SOUNDTRACK PWA            │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend: React + TypeScript               │
│  ├── UI Components (shadcn/ui)              │
│  ├── Visualizations (D3.js / Recharts)      │
│  ├── State Management (Zustand)             │
│  └── Routing (React Router)                 │
│                                             │
│  Data Layer:                                │
│  ├── IndexedDB (via Dexie.js) → dati utente │
│  ├── LocalStorage → preferenze              │
│  └── File System Access API → import files  │
│                                             │
│  Service Worker:                            │
│  ├── Cache static assets                    │
│  ├── Background sync (opzionale)            │
│  └── Push notifications (fase 2)           │
│                                             │
│  Processing:                                │
│  ├── Web Workers → analisi pesanti          │
│  ├── WASM (Essentia compile) → audio feat.  │
│  └── Worker thread → import parallelo       │
│                                             │
│  Hosting:                                   │
│  ├── Self-hosted (utente scarica e apre)    │
│  ├── GitHub Pages / Netlify (versione web)  │
│  └── Docker (per chi vuole self-hostare)    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 7. 🎨 MOCKUP DELLE SCHERMATE

### 7.1 Mappa delle Schermate

```
┌─────────────────────────────────────────────────────────────┐
│                     LIFE SOUNDTRACK                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. ONBOARDING                                              │
│     ├── 1a. Benvenuto                                       │
│     ├── 1b. Import dati (selezione piattaforme)             │
│     ├── 1c. Upload file / Connessione API                   │
│     └── 1d. Processing (barra di avanzamento)               │
│                                                             │
│  2. HOME — "La tua vita in musica"                          │
│     ├── 2a. Hero: stats principali                          │
│     ├── 2b. "Oggi nella tua storia" (ricordi)               │
│     ├── 2c. Timeline panoramica                             │
│     └── 2d. Mood del periodo                                │
│                                                             │
│  3. TIMELINE — "Il diario"                                  │
│     ├── 3a. Vista annuale                                   │
│     ├── 3b. Vista mensile                                   │
│     ├── 3c. Vista giornaliera                               │
│     └── 3d. Vista "Ere musicali"                            │
│                                                             │
│  4. ESPLORA                                                 │
│     ├── 4a. Artisti                                         │
│     ├── 4b. Brani                                           │
│     ├── 4c. Album                                           │
│     ├── 4d. Generi                                          │
│     └── 4e. Mood                                            │
│                                                             │
│  5. ANALISI                                                 │
│     ├── 5a. Dashboard statistiche                           │
│     ├── 5b. Pattern temporali                               │
│     ├── 5c. Mappa emotiva                                   │
│     ├── 5d. Eventi rilevati                                 │
│     └── 5e. Profilo musicale                                │
│                                                             │
│  6. RICORDI                                                 │
│     ├── 6a. Feed dei ricordi                                │
│     ├── 6b. "On questo giorno"                              │
│     └── 6c. Condivisione                                    │
│                                                             │
│  7. IMPOSTAZIONI                                            │
│     ├── 7a. Piattaforme collegate                           │
│     ├── 7b. Privacy                                         │
│     ├── 7c. Export dati                                     │
│     └── 7d. Preferenze                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Mockup Dettagliati

#### 📱 SCHERMATA 1b — Import Dati

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Life Soundtrack                                    ⚙️  👤  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Importa la tua musica                                          │
│  Scegli le piattaforme che usi o hai usato                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ✅ Spotify                                             │    │
│  │  Importa il file JSON dal download GDPR                 │    │
│  │  [Trascina qui il file ZIP]  oppure  [Sfoglia...]      │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  📁 Streaming_History_Audio_2016-2026.zip (155 MB)     │    │
│  │  ✅ 227.024 eventi trovati                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⬜ YouTube Music                                       │    │
│  │  Importa da Google Takeout                              │    │
│  │  [Trascina qui il file]                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⬜ Apple Music                                         │    │
│  │  Importa il CSV dal Privacy Portal                      │    │
│  │  [Trascina qui il file]                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⬜ Last.fm / ListenBrainz                              │    │
│  │  Connetti il tuo account                                │    │
│  │  Username: [_______________]  [Connetti]               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⬜ Deezer  ⬜ Tidal  ⬜ SoundCloud  ⬜ Plex             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│              [ Importa tutto → ]                                │
│                                                                 │
│  🔒 I dati restano solo sul tuo dispositivo.                    │
│     Nessun server. Nessun tracciamento.                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 SCHERMATA 2a — Home

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Life Soundtrack                                    ⚙️  👤  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Ciao, Boss 👋                                                  │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  12.847  │ │  847 h   │ │   2.341  │ │    8     │          │
│  │  brani   │ │ ascoltate│ │  artisti │ │ ere      │          │
│  │  quest'  │ │ nel 2026 │ │  nel 2026│ │ musicali │          │
│  │  anno    │ │          │ │          │ │          │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  💫 Oggi nella tua storia                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🎂 5 anni fa, il 15 gennaio 2021, ascoltavi:           │    │
│  │                                                         │    │
│  │  🎵 "Drivers License" — Olivia Rodrigo                  │    │
│  │     (43 ascolti quella settimana)                       │    │
│  │                                                         │    │
│  │  📍 Da mobile, shuffle attivo, valence: 0.34            │    │
│  │  💭 Era un periodo malinconico...                       │    │
│  │                                                         │    │
│  │  [Rivivi quel periodo →]                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔄 3 anni fa scoprivi i Radiohead                      │    │
│  │     Il primo brano: "Creep" (12 gen 2023)              │    │
│  │     [Esplora l'era Radiohead →]                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  📊 La tua settimana                                            │
│                                                                 │
│  Lun ▓▓▓▓▓▓▓▓░░ 3.2h                                           │
│  Mar ▓▓▓▓▓▓░░░░ 2.4h                                           │
│  Mer ▓▓▓▓▓▓▓▓▓▓ 4.1h                                           │
│  Gio ▓▓▓▓▓░░░░░ 1.8h                                           │
│  Ven ▓▓▓▓▓▓▓░░░ 2.9h                                           │
│  Sab ▓▓▓▓▓▓▓▓▓▓ 4.5h  ← picco                                 │
│  Dom ▓▓▓▓▓▓░░░░ 2.6h                                           │
│                                                                 │
│  Mood della settimana: 🟡 Neutro-positivo (valence: 0.58)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 SCHERMATA 3a — Timeline Annuale

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Life Soundtrack    Timeline    ⚙️  👤                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2016 ─────────────────────────────────────────── 2026          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │  2016    2017    2018    2019    2020    2021    2022   │    │
│  │  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐     │    │
│  │  │🎸 │  │🎹 │  │🎤 │  │🎧 │  │🏠 │  │💔 │  │🌅 │     │    │
│  │  │Rock│  │Indie│ │Pop │  │Elec│  │Lo-fi│  │Sad │  │Hope│     │    │
│  │  │Era │  │Era │  │Era │  │Era │  │Era │  │Era │  │Era │     │    │
│  │  └───┘  └───┘  └───┘  └───┘  └───┘  └───┘  └───┘     │    │
│  │                                                         │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Volume di ascolto:                                     │    │
│  │  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇██▇▅▃▂▁▂▃▅▇▇▅▃▂▁▂▃▅▇█▇▅▃▂▁          │    │
│  │  2016          2018          2020          2022   2026  │    │
│  │                                                         │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Mood (valence):                                        │    │
│  │  ───────╲___╱──────────╲_____╱──────────╱─────────     │    │
│  │  (felice)      (triste)       (felice)    (neutro)      │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  🔍 Clicca su un'era per esplorarla                             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  💔 Era "Malinconia" (Set 2021 - Feb 2022)              │    │
│  │                                                         │    │
│  │  Top artisti: Adele, Coldplay, Billie Eilish            │    │
│  │  Valence media: 0.31 | Energy: 0.42                     │    │
│  │  Brani più ascoltati: "Someone Like You", "Fix You"     │    │
│  │  Pattern: ascolti notturni, ripetitivi, da mobile       │    │
│  │                                                         │    │
│  │  [Esplora questa era →]                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Vista: [Anni] [Mesi] [Settimane] [Giorni]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 SCHERMATA 5c — Mappa Emotiva

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Life Soundtrack    Analisi    ⚙️  👤                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎭 La tua mappa emotiva — 2026                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  │        ALTA ENERGIA                                     │    │
│  │            │                                            │    │
│  │     😤     │     🎉                                     │    │
│  │   Arrabbiato│   Eccitato                                │    │
│  │            │                                            │    │
│  │  ──────────┼────────── VALENCE →                        │    │
│  │            │                                            │    │
│  │     😢     │     😊                                     │    │
│  │   Triste   │   Felice                                   │    │
│  │            │                                            │    │
│  │        BASSA ENERGIA                                    │    │
│  │                                                         │    │
│  │  ● Gen  ● Feb  ● Mar  ● Apr  ● Mag  ● Giu             │    │
│  │  (punti = posizione media del mese nel grafico)        │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  📈 Mood nel tempo (ultimi 12 mesi)                             │
│                                                                 │
│  Valence:                                                       │
│  1.0 ┤                                                          │
│  0.8 ┤         ╭──╮                                            │
│  0.6 ┤    ╭───╯  ╰──╮     ╭──╮                                │
│  0.4 ┤───╯          ╰──╮╭─╯  ╰──╮                             │
│  0.2 ┤                 ╰╯       ╰───                           │
│  0.0 ┤                                                          │
│      └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──              │
│        Gen Feb Mar Apr Mag Giu Lug Ago Set Ott Nov Dic         │
│                                                                 │
│  Energy:                                                        │
│  1.0 ┤                                                          │
│  0.8 ┤      ╭──╮                                               │
│  0.6 ┤  ╭──╯  ╰──╮    ╭──╮    ╭──╮                            │
│  0.4 ┤─╯         ╰──╮╭╯  ╰──╮╭╯  ╰──╮                         │
│  0.2 ┤              ╰╯      ╰╯      ╰──                        │
│  0.0 ┤                                                          │
│      └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──              │
│        Gen Feb Mar Apr Mag Giu Lug Ago Set Ott Nov Dic         │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                 │
│  💡 Insight:                                                    │
│  "Il tuo umore musicale segue un pattern stagionale:            │
│   più energico in primavera/estate, più riflessivo              │
│   in autunno/inverno. A novembre 2025 c'è stato un              │
│   calo significativo di valence che è durato 6 settimane."      │
│                                                                 │
│  Periodo: [2026 ▼]  Granularità: [Mese ▼]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 📱 SCHERMATA 6a — Ricordi

```
┌─────────────────────────────────────────────────────────────────┐
│  🎵 Life Soundtrack    Ricordi    ⚙️  👤                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✨ I tuoi ricordi musicali                                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📅 ON QUESTO GIORNO — 15 gennaio                       │    │
│  │                                                         │    │
│  │  5 anni fa (2021):                                      │    │
│  │  🎵 "Drivers License" — Olivia Rodrigo                  │    │
│  │  L'hai ascoltata 43 volte in una settimana.             │    │
│  │  Era il tuo periodo "malinconia invernale".             │    │
│  │                                                         │    │
│  │  3 anni fa (2023):                                      │    │
│  │  🎵 "Creep" — Radiohead                                 │    │
│  │  Il primo brano dei Radiohead che hai ascoltato.        │    │
│  │  Da lì è nata un'era musicale durata 8 mesi.            │    │
│  │                                                         │    │
│  │  [Rivivi →]  [Condividi →]  [Nascondi]                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🏆 MILESTONE                                           │    │
│  │                                                         │    │
│  │  🎉 Hai superato i 100.000 brani ascoltati!             │    │
│  │  Il primo in assoluto: "Bohemian Rhapsody" (2016)       │    │
│  │  Il 50.000°: "Blinding Lights" (2021)                   │    │
│  │  Il 100.000°: "Flowers" — Miley Cyrus (2025)            │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🔄 RITORNO                                             │    │
│  │                                                         │    │
│  │  Non ascoltavi i Daft Punk da 2 anni e 3 mesi.          │    │
│  │  Oggi hai riascoltato "Get Lucky".                      │    │
│  │  L'ultima volta era l'estate 2024.                      │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🌊 STAGIONALE                                          │    │
│  │                                                         │    │
│  │  Come ogni gennaio, è tornato il periodo jazz.          │    │
│  │  Lo fai da 4 anni consecutivi.                          │    │
│  │  Artista di quest'anno: Miles Davis (12h questa sett.)  │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Design System

| Elemento | Scelta | Motivazione |
|----------|--------|-------------|
| **Font** | Inter (UI) + JetBrains Mono (dati) | Leggibilità, modernità |
| **Colori primari** | Gradient viola-blu (musica/notte) | Evoca musica, introspezione |
| **Colori mood** | Scala da blu (triste) a giallo (felice) | Intuitivo, universale |
| **Dark mode** | Default | L'app si usa spesso la sera |
| **Animazioni** | Smooth, sottili (Framer Motion) | Eleganza senza distrazione |
| **Componenti** | shadcn/ui + Radix | Accessibilità, qualità |
| **Grafici** | D3.js (custom) + Recharts (standard) | Flessibilità + velocità |
| **Icone** | Lucide | Coerenza, minimalismo |

---

## 8. 🔧 SPECIFICHE TECNICHE

### 8.1 Stack Tecnologico

```
FRONTEND (PWA)
├── Framework: React 19 + TypeScript
├── Build tool: Vite
├── Styling: Tailwind CSS + shadcn/ui
├── State: Zustand (leggero) + React Query (server state)
├── Charts: D3.js (timeline custom) + Recharts (grafici standard)
├── Animations: Framer Motion
├── Routing: React Router v7
├── PWA: vite-plugin-pwa (Workbox)
└── Testing: Vitest + React Testing Library

DATA LAYER
├── Local DB: IndexedDB via Dexie.js
├── File parsing: PapaParse (CSV), native JSON
├── File access: File System Access API
├── Processing: Web Workers (import pesante)
└── Cache: Service Worker + Cache API

ANALYSIS ENGINE
├── Runtime: Web Worker dedicato
├── Statistics: simple-statistics.js
├── Clustering: ml-kmeans
├── Anomaly detection: custom (z-score, IQR)
├── Audio features: Essentia.js (WASM) o API esterna
└── MusicBrainz: fetch API (lookup MBID/ISRC)

DESKTOP (Fase 2, opzionale)
├── Runtime: Tauri 2.0 (Rust + WebView)
├── Perché Tauri: 10x più leggero di Electron, nativo
├── File system: accesso diretto
└── Background processing: sidecar Python (opzionale)

BACKEND (opzionale, solo per sync)
├── Runtime: Node.js + Fastify
├── DB: PostgreSQL
├── Auth: Passkeys (no password)
├── Sync: CRDT (Conflict-free Replicated Data Types)
└── Encryption: end-to-end (libsodium)
```

### 8.2 Requisiti Non Funzionali

| Requisito | Target |
|-----------|--------|
| **Tempo di import** | < 30 secondi per 100.000 eventi |
| **Tempo di rendering timeline** | < 1 secondo |
| **Dimensione app** | < 5 MB (PWA) |
| **Funziona offline** | Sì, al 100% dopo primo caricamento |
| **Privacy** | Zero dati inviati a server (tranne enrichment opzionale) |
| **Accessibilità** | WCAG 2.1 AA |
| **Browser supportati** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| **Dispositivi** | Desktop (1280px+), Tablet (768px+), Mobile (375px+) |

### 8.3 Struttura del Progetto (Monorepo)

```
life-soundtrack/
├── apps/
│   ├── web/                    # PWA principale
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── pages/          # Pagine/schermate
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── workers/        # Web Workers
│   │   │   ├── lib/            # Utility functions
│   │   │   └── styles/         # CSS/Tailwind
│   │   ├── public/             # Assets statici
│   │   └── index.html
│   └── desktop/                # Tauri app (fase 2)
│       ├── src-tauri/          # Rust backend
│       └── ...
├── packages/
│   ├── core/                   # Logica condivisa
│   │   ├── adapters/           # Adapters per piattaforma
│   │   │   ├── spotify/
│   │   │   ├── youtube/
│   │   │   ├── apple/
│   │   │   ├── deezer/
│   │   │   ├── tidal/
│   │   │   ├── soundcloud/
│   │   │   ├── lastfm/
│   │   │   └── listenbrainz/
│   │   ├── analysis/           # Motore di analisi
│   │   │   ├── mood-tracker.ts
│   │   │   ├── era-detector.ts
│   │   │   ├── event-detector.ts
│   │   │   └── memory-engine.ts
│   │   ├── enrichment/         # Arricchimento dati
│   │   │   ├── audio-features.ts
│   │   │   ├── musicbrainz.ts
│   │   │   └── genre-mapper.ts
│   │   ├── schema/             # Tipi e interfacce
│   │   │   ├── listen-event.ts
│   │   │   ├── track.ts
│   │   │   └── unified.ts
│   │   └── db/                 # Layer database
│   │       ├── indexeddb.ts
│   │       └── migrations/
│   └── ui/                     # Design system condiviso
│       ├── components/
│       └── tokens/
├── docs/                       # Documentazione
│   ├── PRD.md                  # Questo documento
│   ├── ARCHITECTURE.md
│   ├── ADAPTERS.md
│   └── API.md
├── tests/                      # Test integrati
├── scripts/                    # Script di build/deploy
├── docker-compose.yml          # Per self-hosting
├── package.json
├── turbo.json                  # Turborepo config
└── README.md
```

---

## 9. 📅 ROADMAP DI IMPLEMENTAZIONE

### Panoramica

```
FASE 0        FASE 1         FASE 2         FASE 3         FASE 4
Fondamenta    Import Core    Analisi        UI/UX          Beta
(2 sett)      (4 sett)       (4 sett)       (4 sett)       (2 sett)
─────────────────────────────────────────────────────────────────────
    │              │              │              │              │
    ▼              ▼              ▼              ▼              ▼
Setup +       Spotify +       Mood +         Timeline +     Beta
Schema        YouTube +       Ere +          Ricordi +      privata
dati          Apple           Eventi         Condivisione   (20 utenti)
```

### Dettaglio per Fase

#### FASE 0 — Fondamenta (Settimane 1-2)

| Task | Output | Priorità |
|------|--------|----------|
| Definire schema dati TypeScript | `packages/core/schema/` | 🔴 Alta |
| Setup monorepo (Turborepo) | Struttura progetto | 🔴 Alta |
| Setup PWA (Vite + React) | App funzionante vuota | 🔴 Alta |
| Setup IndexedDB (Dexie) | DB locale funzionante | 🔴 Alta |
| Creare pagina Onboarding | UI import base | 🟡 Media |
| Scrivere documentazione adapter | `docs/ADAPTERS.md` | 🟡 Media |

#### FASE 1 — Import Core (Settimane 3-6)

| Task | Output | Priorità |
|------|--------|----------|
| Spotify Adapter (JSON parser) | Import GDPR Spotify | 🔴 Alta |
| YouTube Music Adapter (Takeout) | Import Takeout | 🔴 Alta |
| Apple Music Adapter (CSV) | Import Privacy Portal | 🔴 Alta |
| Deduplicazione tracce | Unione brani duplicati | 🔴 Alta |
| Normalizzazione (MusicBrainz) | ISRC/MBID lookup | 🟡 Media |
| Last.fm Adapter (API) | Import storico | 🟡 Media |
| ListenBrainz Adapter (API) | Import storico | 🟡 Media |
| Pagina Import UI completa | UX import fluida | 🔴 Alta |
| Test con dati reali | Validazione | 🔴 Alta |

#### FASE 2 — Motore di Analisi (Settimane 7-10)

| Task | Output | Priorità |
|------|--------|----------|
| Calcolo audio features (Essentia/API) | Valence, energy, ecc. | 🔴 Alta |
| Mood Tracker giornaliero | Mood per giorno | 🔴 Alta |
| Era Detector (clustering) | Ere musicali | 🔴 Alta |
| Event Detector (anomaly) | Eventi di vita | 🟡 Media |
| Memory Engine | "On questo giorno" | 🔴 Alta |
| Pattern temporali | Ritmi circadiani/stagionali | 🟡 Media |
| Profilo musicale | Big Five, obscuring | 🟢 Bassa |

#### FASE 3 — UI/UX (Settimane 11-14)

| Task | Output | Priorità |
|------|--------|----------|
| Home page | Dashboard principale | 🔴 Alta |
| Timeline interattiva | Vista anni/mesi/giorni | 🔴 Alta |
| Mappa emotiva | Grafico valence/energy | 🔴 Alta |
| Pagina Ricordi | Feed ricordi | 🔴 Alta |
| Pagina Esplora | Artisti, brani, generi | 🟡 Media |
| Pagina Analisi | Dashboard statistiche | 🟡 Media |
| Condivisione (immagine/link) | Share ricordi | 🟡 Media |
| Dark mode + responsive | Accessibilità | 🔴 Alta |

#### FASE 4 — Beta (Settimane 15-16)

| Task | Output | Priorità |
|------|--------|----------|
| Beta privata (20 utenti) | Feedback reale | 🔴 Alta |
| Bug fixing | Stabilità | 🔴 Alta |
| Ottimizzazione performance | Velocità | 🟡 Media |
| Documentazione utente | Guide | 🟡 Media |
| Preparazione lancio pubblico | Marketing | 🟢 Bassa |

---

## 10. ⚠️ RISCHI E MITIGAZIONI

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Formato GDPR Spotify cambia | Media | Alto | Adapter modulare, facile aggiornare |
| Audio features non disponibili per tutti i brani | Alta | Medio | Fallback su generi/tag, media mobile |
| Dati sporchi/incoerenti | Alta | Medio | Pipeline di cleaning robusta, logging |
| Performance con 200k+ eventi | Media | Alto | Web Workers, indicizzazione, lazy loading |
| Utente non sa come scaricare i dati | Alta | Medio | Guide passo-passo con screenshot |
| Privacy concerns | Bassa | Alto | Local-first, zero tracking, open source |
| Browser blocca File System Access | Media | Medio | Fallback su drag&drop / file input |
| Essentia WASM troppo pesante | Media | Medio | API esterna come fallback |

---

## 📎 ALLEGATI E PROSSIMI PASSI

### Documenti da creare successivamente:
1. **ADAPTERS.md** — Specifica tecnica di ogni adapter
2. **ANALYSIS.md** — Algoritmi di analisi in dettaglio
3. **PRIVACY.md** — Privacy policy e gestione dati
4. **USER_GUIDE.md** — Guida utente finale
5. **BRAND.md** — Identità visiva, nome, logo

### Decisioni da prendere insieme:
1. **Nome del progetto**: "Life Soundtrack" è un placeholder. Vuoi un nome diverso?
2. **Open source o proprietario?** (consiglio: open source per trust)
3. **Modello di business**: gratuito + premium features? Donazioni? SaaS?
4. **Lingua**: solo italiano, solo inglese, o multilingua?

---

Boss, questo documento è la **fondazione** del progetto. Ogni sezione può essere approfondita ulteriormente quando serve. Ti consiglio di:

1. **Leggerlo con calma** e segnare cosa non ti convince
2. **Dirmi le tue impressioni** su architettura, mockup, e scelte tecniche
3. **Decidere le priorità** per la Fase 0
4. **Scegliere il nome** del progetto (se vuoi)

# 🎨 Life Soundtrack — Identità Visiva e Design System

Boss, ottima idea: passare dai wireframe testuali a mockup visivi concreti rende il progetto immediatamente tangibile. Prima di generare le immagini, definiamo insieme la **visual identity** completa — colori, tipografia, principi UI/UX — così le immagini saranno coerenti tra loro.

---

## 1. 🎭 CONCETTO VISIVO: "La notte che ricorda"

### 1.1 La Metafora Centrale

Il concept grafico nasce dall'idea che **la musica è memoria, e la memoria vive nella notte**. L'app deve sembrare un **diario notturno illuminato dalla musica** — intimo, elegante, profondo. Non una dashboard aziendale fredda, ma uno spazio personale caldo.

| Riferimento | Cosa prendiamo |
|-------------|----------------|
| **Spotify Wrapped** | L'energia narrativa, il colore espressivo |
| **Apple Health** | La chiarezza dei dati, il minimalismo |
| **Last.fm** | La profondità storica, la densità informativa |
| **Diario cartaceo** | L'intimità, la nostalgia |
| **Vinile/giradischi** | La matericità, il calore analogico |

### 1.2 Palette Colori

```
FONDO (Dark Mode — default)
├── Background principale    #0A0E1A  (blu notte profondo)
├── Background card          #131829  (blu notte chiaro)
├── Background elevato       #1C2238  (per modali, hover)
└── Bordi sottili            #2A3050  (viola spento)

ACCENTI (il gradiente "Aurora Musicale")
├── Primario                 #8B5CF6  (viola vibrante)
├── Secondario               #6366F1  (indaco)
├── Terziario                #EC4899  (rosa magenta)
└── Gradiente hero           #8B5CF6 → #EC4899 → #F59E0B

SCALE MOOD (per la mappa emotiva)
├── Triste/malinconico       #3B82F6  (blu)
├── Neutro                   #8B5CF6  (viola)
├── Felice                   #F59E0B  (ambra)
├── Energico                 #EC4899  (rosa)
└── Calmo                    #10B981  (verde smeraldo)

TESTO
├── Primario                 #F8FAFC  (bianco sporco)
├── Secondario               #94A3B8  (grigio-blu)
└── Disabilitato             #475569  (grigio scuro)

SEMANTICI
├── Successo                 #10B981
├── Warning                  #F59E0B
├── Errore                   #EF4444
└── Info                     #3B82F6
```

**Light Mode** (opzionale, seconda fase): sfondo #FAFBFF, card bianche, stessi accenti ma con saturazione ridotta del 10%.

### 1.3 Tipografia

| Uso | Font | Peso | Perché |
|-----|------|------|--------|
| **UI (interfaccia)** | Inter | 400/500/600 | Leggibilità perfetta su schermo, neutro ma moderno |
| **Display (titoli hero)** | Inter Tight o Space Grotesk | 600/700 | Carattere per i numeri grandi e i titoli emotivi |
| **Dati/numeri** | JetBrains Mono | 400/500 | Allineamento perfetto per statistiche e timestamp |
| **Citazioni/narrazione** | Inter italic | 400 | Per gli "insight" generati, tono diaristico |

**Scala tipografica:**
- Hero number: 56-72px (le statistiche grandi della Home)
- H1 pagina: 32px semibold
- H2 sezione: 22px semibold
- Body: 15px regular
- Caption: 13px regular (grigio secondario)
- Micro-label: 11px medium uppercase (tracking +0.05em)

### 1.4 Il Logo

**Concept**: un'onda sonora che si trasforma in una linea del tempo — il simbolo della musica che diventa vita. In alternativa, un vinile stilizzato il cui solco centrale diventa una timeline.

Le immagini del brand e delle schermate principali sono contenute nella directory /images del repo, vai acontrollare il contenuto della directory per capire lo stile del proposto per il progetto.

# 🎨 LIFE SOUNDTRACK — Design System & UI/UX Completo

Boss, ho creato i mockup visivi delle schermate principali e ora ti presento il **sistema di design completo**. Le immagini che hai visto sopra sono la base visiva del progetto. Ecco la documentazione che le accompagna.

---

## 1. 🖼️ PANORAMICA DEI MOCKUP GENERATI

| # | Schermata | Piattaforma | Cosa mostra |
|---|-----------|-------------|-------------|
| 1 | **Brand Identity** | — | Logo, varianti, palette |
| 2 | **Home Dashboard** | Desktop | Statistiche, ricordi, grafico settimanale |
| 3 | **Timeline** | Desktop | Ere musicali, volume, mood nel tempo |
| 4 | **Mappa Emotiva** | Desktop | Quadrante valence/energy, pattern temporali |
| 5 | **Ricordi (Memories)** | Mobile | Feed di ricordi, milestone, ritorni |
| 6 | **Import Onboarding** | Mobile | Selezione piattaforme, upload file |

---

## 2. 🎭 IDENTITÀ VISIVA (BRAND)

### 2.1 Il Logo

Il marchio è un'**onda sonora che si trasforma in linea del tempo**: la parte sinistra è una forma d'onda vibrante (la musica), che si distende progressivamente in una linea orizzontale piatta (il tempo, la vita). È la metafora perfetta del progetto: *la musica che diventa storia*.

**Varianti disponibili:**
- **Primaria**: gradiente completo su sfondo scuro
- **Monocromatica viola**: per contesti ridotti
- **Grigia/neutra**: per watermark e stampe
- **Bianca**: per sfondi scuri alternativi
- **Wordmark**: "LIFE SOUNDTRACK" in maiuscolo, spaziatura ampia

### 2.2 Palette Colori

#### Colori Base (Dark Mode — default)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-base` | `#0A0E1A` | Sfondo principale (navy profondo) |
| `bg-surface` | `#131829` | Card e pannelli |
| `bg-elevated` | `#1A2138` | Card hover, modali |
| `border-subtle` | `rgba(139,92,246,0.25)` | Bordi card |
| `text-primary` | `#FFFFFF` | Titoli, numeri |
| `text-secondary` | `#94A3B8` | Sottotitoli, label |
| `text-muted` | `#64748B` | Meta-informazioni |

#### Gradiente Primario (Brand)

```
Violet #8B5CF6 → Magenta #EC4899 → Amber #F59E0B
```
Usato per: logo, CTA principali, elementi attivi, highlight.

#### Palette Mood (semantica)

Questa è la palette **più importante** del progetto: codifica gli stati emotivi.

| Mood | Hex | Valence/Energy |
|------|-----|----------------|
| 😢 Triste | `#3B82F6` (blu) | Bassa valence, bassa energy |
| 😤 Arrabbiato | `#EF4444` (rosso) | Bassa valence, alta energy |
| 😐 Neutro | `#8B5CF6` (viola) | Media valence |
| 😊 Felice | `#F59E0B` (ambra) | Alta valence, media energy |
| 🎉 Eccitato | `#EC4899` (magenta) | Alta valence, alta energy |
| 🧘 Calmo | `#10B981` (verde) | Media valence, bassa energy |

**Regola d'oro**: ogni visualizzazione di mood usa questa palette in modo coerente. L'utente impara a "leggere" i colori come emozioni.

#### Colori Piattaforma (per import)

| Piattaforma | Colore |
|-------------|--------|
| Spotify | `#1DB954` |
| YouTube Music | `#FF0000` |
| Apple Music | `#FA243C` |
| Deezer | `#A238FF` |
| Tidal | `#00FFFF` |
| Last.fm | `#D51007` |
| ListenBrainz | `#EB7431` |

### 2.3 Tipografia

| Uso | Font | Peso | Note |
|-----|------|------|------|
| Titoli pagina | **Inter Tight** | 700 | Grande impatto, tracking stretto |
| Numeri/statistiche | **Inter Tight** | 800 | Tabular figures per allineamento |
| Corpo testo | **Inter** | 400 | Leggibilità |
| Label/UI | **Inter** | 500-600 | Bottoni, menu |
| Dati tecnici/timestamp | **JetBrains Mono** | 400 | IP, URI, codici |

**Scala tipografica:**
- Display: 48-64px (hero, numeri grandi)
- H1: 32px | H2: 24px | H3: 20px
- Body: 16px | Small: 14px | Caption: 12px

### 2.4 Principi Stilistici

1. **Dark-first**: il dark mode non è un'opzione, è l'identità. La musica si ascolta spesso di sera; l'app deve sentirsi "notturna".
2. **Glow, non ombre**: invece di drop shadow pesanti, usiamo bagliori sottili (glow) colorati sugli elementi attivi — come luci di un palco.
3. **Glassmorphism moderato**: card semi-trasparenti con blur leggero, bordi gradiente sottili.
4. **Angoli generosi**: 16px per card, 20px per card mobili, full-round per pill e bottoni.
5. **Spazio respirante**: padding generoso (24-32px), le visualizzazioni hanno bisogno di aria.

---

## 3. 🧩 UI SYSTEM — COMPONENTI

### 3.1 Inventario Componenti

| Componente | Descrizione | Dove si usa |
|------------|-------------|-------------|
| **StatCard** | Card con numero grande + label + icona | Home |
| **MemoryCard** | Card ricordo con artwork, titolo, tag mood, azioni | Home, Ricordi |
| **EraBand** | Segmento orizzontale colorato con emoji + label | Timeline |
| **MoodPill** | Pill colorata con nome mood | Ovunque ci sia mood |
| **GradientButton** | Bottone CTA con gradiente violet→magenta | Azioni primarie |
| **GhostButton** | Bottone secondario con bordo sottile | Azioni secondarie |
| **PlatformCard** | Card piattaforma con logo, stato, azione | Import |
| **DropZone** | Area tratteggiata per drag&drop file | Import |
| **StreamChart** | Area chart con gradiente | Timeline, Analisi |
| **MoodLine** | Line chart colorata per segmento di mood | Analisi |
| **QuadrantChart** | Scatter 2D con quadranti emotivi | Mappa Emotiva |
| **BarWeek** | Bar chart settimanale con glow sul picco | Home |
| **NavBar (desktop)** | Sidebar verticale con icone | Tutte le pagine desktop |
| **TabBar (mobile)** | Bottom navigation 5 voci | Tutte le pagine mobile |
| **InsightCard** | Card con icona lampadina + testo narrativo | Analisi |
| **ShareSheet** | Overlay per condivisione ricordo | Ricordi |

### 3.2 Regole di Composizione

- **Gerarchia visiva**: numero > titolo > grafico > dettaglio. L'occhio deve seguire: *quanto → cosa → come → perché*.
- **Una visualizzazione dominante per schermata**: mai più di un grafico "eroe" per viewport.
- **Il colore racconta**: i gradienti non sono decorativi, codificano dati (mood, energia, periodo).
- **Empty state curati**: ogni schermata vuota ha un'illustrazione + CTA (es. "Importa i tuoi dati per vedere la tua timeline").

---

## 4. 🧠 UX — PRINCIPI E FLUSSI

### 4.1 I Cinque Principi UX

#### 1. **Privacy come feature, non come ostacolo**
Il messaggio "I tuoi dati restano sul tuo dispositivo" appare in ogni punto di contatto con i dati (import, settings, condivisione). Non è una nota legale: è un **valore di vendita**.

#### 2. **Progressive disclosure**
L'utente vede prima l'emozione (ricordi, mood), poi i dati (statistiche), poi i dettagli tecnici (raw data). Mai il contrario. Il percorso è: *sentire → capire → esplorare*.

#### 3. **Narrazione prima dei numeri**
Ogni insight è una **frase in linguaggio naturale**, non un grafico nudo. Esempio: invece di "valence: 0.31", l'app dice *"Nell'ottobre 2021 la tua musica è diventata più malinconica"*. I numeri sono il supporto, non il messaggio.

#### 4. **L'utente ha sempre l'ultima parola**
Le inferenze (eventi di vita, mood) sono **ipotesi**, non verità. Ogni rilevamento può essere confermato, corretto o ignorato dall'utente. Questo costruisce trust e migliora il modello nel tempo.

#### 5. **Zero frizione nell'import**
L'import è il momento più delicato: se fallisce, l'utente abbandona. Quindi: drag&drop ovunque, validazione immediata, progress bar per file, messaggi di errore umani ("Questo file sembra di Apple Music, non di Spotify — vuoi provarlo comunque?").

### 4.2 Flussi Principali

#### Flusso 1: Primo Avvio (Onboarding)

```
[Benvenuto]
   "La colonna sonora della tua vita, finalmente leggibile."
   [Inizia →]
        │
        ▼
[Privacy First]
   "Tutto resta sul tuo dispositivo. Nessun account richiesto."
   [Ho capito →]
        │
        ▼
[Import — Passo 2 di 3]  ← (mockup mobile #6)
   Selezione piattaforme + upload file
        │
        ▼
[Processing]
   Barra di avanzamento + anteprima live
   "Sto leggendo 227.024 momenti della tua vita..."
        │
        ▼
[Prima Timeline — momento "wow"]
   La timeline completa appare con animazione
   Le ere musicali si formano una a una
        │
        ▼
[Home personalizzata]
```

**Momento chiave**: la prima visualizzazione della timeline deve essere **emozionante** — animazione di formazione, le ere che si colorano in sequenza. È il momento in cui l'utente capisce il valore del prodotto.

#### Flusso 2: Esplorazione della Timeline

```
[Vista Anni]  ← (mockup desktop #3)
   Click su un'era
        │
        ▼
[Vista Mesi dell'era]
   Click su un mese
        │
        ▼
[Vista Giorni]
   Click su un giorno
        │
        ▼
[Dettaglio Giorno]
   Lista brani con orari, mood, dispositivo
   "Il 14 febbraio 2019 hai ascoltato..."
```

**Interazione**: zoom progressivo (anni → mesi → giorni) con transizioni fluide, come Google Maps ma nel tempo.

#### Flusso 3: Scoperta di un Ricordo

```
[Notifica/Push o badge su "Ricordi"]
   "Hai un ricordo di 5 anni fa"
        │
        ▼
[Memory Card]  ← (mockup mobile #5)
   Artwork + brano + contesto
        │
        ├──→ [Rivivi] → apre la timeline in quel periodo
        ├──→ [Condividi] → genera immagine shareable
        └──→ [♥] → salva nei preferiti
```

### 4.3 Micro-interazioni

| Interazione | Feedback |
|-------------|----------|
| Hover su StatCard | Glow leggero + numero che conta up |
| Click su EraBand | Espansione smooth + dettaglio sotto |
| Scroll timeline | Le ere si illuminano al passaggio |
| Import completato | Confetti sottili + suono opzionale |
| Ricordo condiviso | Genera card immagine con brand |
| Mood pill hover | Tooltip con spiegazione del mood |
| Long-press su brano (mobile) | Menu contestuale (dettagli, periodo, mood) |

### 4.4 Accessibilità

- **Contrasto**: tutti i testi ≥ 4.5:1 su sfondo scuro
- **Mood non solo a colori**: ogni mood ha emoji + label testuale (non solo colore, per daltonici)
- **Keyboard navigation**: tutte le visualizzazioni navigabili da tastiera
- **Screen reader**: ogni grafico ha un'alternativa testuale ("Il tuo mood di marzo era prevalentemente malinconico")
- **Motion reduction**: animazioni disattivabili

---

## 5. 📐 SPECIFICHE PER SCHERMATA

### 5.1 Home (Desktop — mockup #2)

**Struttura:**
1. Header: saluto personalizzato + emoji
2. Riga di 4 StatCard (brani, ore, artisti, ere)
3. MemoryCard "Oggi nella tua storia" (il ricordo del giorno)
4. BarWeek: grafico settimanale con glow sul picco
5. Mood indicator della settimana

**Comportamento:**
- Le StatCard contano i numeri al caricamento (animazione 600ms)
- La MemoryCard cambia ogni giorno
- Il grafico settimanale mostra il giorno corrente evidenziato

### 5.2 Timeline (Desktop — mockup #3)

**Struttura:**
1. Header: titolo + selettore range anni + toggle granularità
2. EraBands: sequenza orizzontale di ere colorate
3. StreamChart "Volume di ascolto"
4. MoodLine "Mood (valence)" con gradiente blu→giallo
5. DetailCard dell'era selezionata

**Comportamento:**
- Click su un'era → zoom nella vista mesi di quell'era
- Hover su MoodLine → tooltip con data e valore
- Le tre visualizzazioni sono **sincronizzate**: hover su un punto evidenzia lo stesso momento in tutte

### 5.3 Mappa Emotiva (Desktop — mockup #4)

**Struttura:**
1. QuadrantChart: scatter 2D (valence × energy) con quadranti emotivi
2. Percorso temporale che collega i mesi in sequenza
3. Due line chart: Valence nel tempo, Energy nel tempo
4. InsightCard narrativa

**Comportamento:**
- Ogni punto = un mese, dimensione = volume di ascolto
- Il percorso mostra il **viaggio emotivo** dell'anno
- Click su un punto → evidenzia il mese nelle line chart

### 5.4 Ricordi (Mobile — mockup #5)

**Struttura:**
1. Header con logo + avatar
2. Feed verticale di MemoryCard
3. Tipi di card: On Questo Giorno, Milestone, Ritorno, Stagionale
4. Bottom TabBar

**Comportamento:**
- Scroll infinito con caricamento progressivo
- Swipe per condividere/ignorare
- Tap su "Rivivi" → deep link alla timeline

### 5.5 Import (Mobile — mockup #6)

**Struttura:**
1. Step indicator (Passo 2 di 3)
2. Titolo + sottotitolo
3. Lista PlatformCard con stati diversi
4. Privacy note con lucchetto
5. CTA gradiente "Importa tutto"

**Stati delle PlatformCard:**
- **Vuoto**: dropzone tratteggiata
- **In elaborazione**: progress bar animata
- **Completato**: badge verde con conteggio eventi
- **Errore**: badge rosso + messaggio + retry

---

## 6. 🔄 DESIGN RESPONSIVE

| Breakpoint | Layout |
|------------|--------|
| **Mobile** (<768px) | Single column, bottom TabBar, card full-width |
| **Tablet** (768-1024px) | Sidebar collassata a icone, grid 2 colonne |
| **Desktop** (>1024px) | Sidebar completa, grid 3-4 colonne |
| **Wide** (>1440px) | Contenuto centrato max 1400px |

**Regola**: le visualizzazioni complesse (QuadrantChart, Timeline) su mobile diventano **interattive con pinch-zoom** invece di ridursi illeggibilmente.

---

## 7. ✅ PROSSIMI PASSI SUL DESIGN

Boss, ora che abbiamo il design system, ti propongo:

1. **Validazione**: dimmi cosa ti piace e cosa cambieresti dei mockup (colori? layout? densità?)
2. **Light mode**: vogliamo una variante chiara? (consiglio: sì, come opzione secondaria)
3. **Altre schermate**: posso generare mockup per Esplora, Settings, Share Sheet, Empty States
4. **Design token file**: posso prepararti il file JSON/CSS con tutti i token (colori, spaziature, tipografia) pronto per lo sviluppo
5. **Component library**: posso scrivere i primi componenti React (StatCard, MemoryCard, MoodPill) con Tailwind

# 🎬 LIFE SOUNDTRACK — Il Tour Completo dell'App

Boss, ecco fatto: ho generato le 9 schermate mancanti e ora abbiamo **tutte le 14 schermate del progetto**. Te le presento nell'ordine esatto in cui un utente le vivrebbe, come un vero e proprio tour guidato. Ogni tappa include scopo, interazioni e punto di uscita.

---

## 🗺️ MAPPA DEL TOUR

```
ATTO 1 — PRIMO AVVIO (mobile)
  ① Benvenuto → ② Privacy → ③ Import → ④ Processing
                                              │
ATTO 2 — IL MOMENTO WOW (desktop)             ▼
  ⑤ Prima Rivelazione della Timeline ←────────┘
                      │
ATTO 3 — VITA QUOTIDIANA                      │
  ⑥ Home  ⑦ Timeline → ⑧ Dettaglio Era      │
       │         │                            │
       │         └→  Esplora                 │
       │                   │                  │
       └→  Analisi        │                  │
                 │         │                  │
                 └→ ⑪ Ricordi (mobile)        │
                          │                   │
ATTO 4 — CONDIVISIONE E CONTROLLO             │
  ⑫ Share Sheet ←─┘                           │
  ⑬ Impostazioni                              │
  ⑭ Empty State (stato speciale, sempre pronto)
```

---

## ATTO 1 — PRIMO AVVIO 📱

### ① BENVENUTO
**Schermata**: hero mobile con logo waveform neon su nebulosa viola.
**Scopo**: prima impressione emotiva. Una sola frase, una sola azione.
**Copy**: "Life Soundtrack — La colonna sonora della tua vita, finalmente leggibile."
**Interazioni**:
- Tap su "Inizia il viaggio" → vai a ②
- Il logo pulsa leggermente (animazione loop, come un battito)
**Nota UX**: nessun login, nessun form. È deliberato: il primo contatto deve essere *emozione*, non burocrazia.

### ② PRIVACY FIRST
**Schermata**: scudo viola luminoso + tre garanzie con check.
**Scopo**: trasformare la privacy da nota legale a **valore di vendita**.
**Copy**: "I tuoi dati, solo tuoi" / "Elaborazione locale sul dispositivo" / "Nessun account richiesto" / "Export dei dati in qualsiasi momento".
**Interazioni**:
- Tap "Ho capito, continua" → vai a ③
- I dot in basso indicano la posizione nell'onboarding (2 di 3)
**Nota UX**: questa schermata esiste perché il nostro target europeo è sensibile al GDPR. Dirlo *prima* di chiedere i dati costruisce fiducia.

### ③ IMPORT
**Schermata**: lista PlatformCard (Spotify, YouTube Music, Apple Music, Last.fm/ListenBrainz).
**Scopo**: il momento tecnico più delicato del prodotto.
**Stati visibili nel mockup**:
- Spotify = **completato** (badge verde "227.024 eventi trovati" + progress bar piena)
- YouTube Music = **vuoto** (dropzone "Trascina qui il file Takeout")
- Apple Music = **vuoto** ("Sfoglia file CSV")
- Last.fm/ListenBrainz = **connessione** (campo username + "Connetti")
**Interazioni**:
- Drag&drop o sfoglia per ogni piattaforma
- Validazione immediata del formato con messaggio umano in caso di errore
- "Importa tutto" → vai a ④
**Nota UX**: il lucchetto in basso ("I tuoi dati restano solo sul tuo dispositivo") è ripetuto qui perché è il punto di massima ansia dell'utente.

### ④ PROCESSING
**Schermata**: anello di progresso al 68% + contatori live + equalizer animato.
**Scopo**: rendere attesa e trasparenza piacevoli. L'utente vede *cosa* sta succedendo ai suoi dati.
**Copy**: "Sto leggendo la tua storia musicale" / "227.024 eventi analizzati" / "1.842 artisti riconosciuti" / "8 ere musicali in formazione".
**Interazioni**:
- Nessuna azione richiesta; i contatori salgono in tempo reale
- Al 100% → transizione automatica a ⑤
**Nota UX**: "8 ere musicali in formazione" è la frase chiave: anticipa la ricompensa. L'utente capisce che sta per vedere qualcosa di unico.

---

## ATTO 2 — IL MOMENTO WOW 🖥️

### ⑤ PRIMA RIVELAZIONE DELLA TIMELINE
**Schermata**: titolo "La tua vita in musica" + le 7 ere che si accendono in sequenza con particelle di luce.
**Scopo**: il **payoff emotivo** dell'intero onboarding. È la schermata che fa dire "wow, è la mia vita".
**Copy**: "10 anni, 227.024 momenti, un solo racconto."
**Interazioni**:
- Animazione di formazione: le ere si colorano una a una da sinistra a destra (2016 → 2026)
- Al termine, appare il pulsante "Esplora la tua timeline" → vai a ⑦
- Click su un'era già da qui → vai a ⑧
**Nota UX**: questa schermata appare **una sola volta** (flag `first_reveal_done`). Dopo, l'utente atterra sulla Home. Ma può rivederla dalle Impostazioni ("Rivedi la mia prima timeline").

---

## ATTO 3 — VITA QUOTIDIANA 🔄

### ⑥ HOME
**Schermata**: saluto + 4 StatCard + ricordo del giorno + grafico settimanale.
**Scopo**: il "rituale quotidiano". Apri l'app e vedi: i numeri della tua anno, un ricordo, il ritmo della settimana.
**Interazioni**:
- StatCard: hover = glow + count-up animato
- MemoryCard "Oggi nella tua storia": tap → ⑪ (Ricordi) o deep-link alla Timeline nel periodo
- BarWeek: il giorno corrente ha il glow; tap su una barra → ⑦ vista giorni
**Uscite**: sidebar → qualsiasi sezione.

### ⑦ TIMELINE
**Schermata**: "La tua vita in musica" con EraBands colorate, StreamChart del volume, MoodLine valence.
**Scopo**: la vista "mappa" della vita musicale. Zoom progressivo: Anni → Mesi → Settimane → Giorni.
**Interazioni**:
- Toggle granularità in alto a destra (Anni/Mesi/Settimane/Giorni)
- Click su un'EraBand → ⑧ Dettaglio Era
- Hover su MoodLine → tooltip data+valore; le tre visualizzazioni sono sincronizzate
- Selettore range anni (2016–2026) in alto
**Uscite**: DetailCard "Esplora questa era" → ⑧.

### ⑧ DETTAGLIO ERA *(nuova)*
**Schermata**: banner gradiente blu-viola "Era Malinconia — Set 2021 · Feb 2022" + 4 stat card + Top Artists + Top Songs + chart discendente.
**Scopo**: il "capitolo" del diario. Ogni era è una pagina della autobiografia.
**Contenuti**:
- Stat: Valence 0.31, Energy 0.42, 4.210 ascolti, 68% notturni
- Top Artists con avatar e percentuali
- Mood pill comportamentali: "Notturno", "Ripetitivo"
- Chart del mood che mostra la discesa emotiva del periodo
**Interazioni**:
- Click su un artista → ⑨ Esplora filtrato su quell'artista
- Click su "Rivivi questo periodo" → player preview dei brani top (se disponibile) o lista completa
- Breadcrumb per tornare a ⑦
**Nota UX**: il banner cambia colore in base al mood dominante dell'era (blu = malinconia, ambra = speranza...). Coerenza con la palette mood.

### ⑨ ESPLORA *(nuova)*
**Schermata**: search bar + tab (Artisti/Brani/Album/Generi/Mood) + griglia artist card + genre cloud + mood row.
**Scopo**: navigazione "library-first": cercare e riscoprire il proprio catalogo personale.
**Interazioni**:
- Tab switch con animazione slide
- Search con autocompletamento sui propri dati (non sul catalogo globale)
- Click artist card → pagina artista (top brani, periodi, mood associati)
- Click genre pill → filtra tutto per genere
- Mood row con emoji: filtra per stato emotivo ("fammi rivedere i periodi felici")
**Nota UX**: la riga di emoji-mood in basso è una feature distintiva: **navigare la propria musica per emozione**, non solo per nome.

### ⑩ ANALISI — MAPPA EMOTIVA
**Schermata**: QuadrantChart (valence × energy) con percorso temporale + due line chart + InsightCard.
**Scopo**: la vista "scientifica": capire i pattern emotivi dell'anno.
**Interazioni**:
- Ogni punto = un mese; dimensione = volume; colore = mood
- Il percorso collegato mostra il **viaggio emotivo** dell'anno
- Click su un punto → evidenzia il mese nelle line chart sotto
- InsightCard narrativa in fondo: frase in linguaggio naturale, non numeri
**Uscite**: click su un mese → ⑦ Timeline vista mesi di quel periodo.

### ⑪ RICORDI (mobile) 📱
**Schermata**: feed verticale di MemoryCard (On Questo Giorno, Milestone, Ritorno, Stagionale).
**Scopo**: il momento "Facebook Memories" ma musicale. È la feature più condivisibile.
**Interazioni**:
- Scroll infinito
- Tap "Rivivi" → deep-link a ⑦/⑧ nel periodo
- Tap "Condividi" → ⑫ Share Sheet
- Tap ♥ → salva nei ricordi preferiti
- Swipe left → nascondi quel tipo di ricordo
**Nota UX**: su mobile ha la bottom TabBar; è la schermata pensata per essere aperta "ogni mattina con il caffè".

---

## ATTO 4 — CONDIVISIONE E CONTROLLO ⚙️

### ⑫ SHARE SHEET *(nuova, mobile)*
**Schermata**: bottom sheet con anteprima della card condivisibile + 5 destinazioni.
**Scopo**: trasformare un ricordo in un oggetto sociale brandizzato.
**La card generata** contiene: artwork vinile, titolo brano, "5 anni fa, il 15 gennaio 2021", mood pill, logo Life Soundtrack. È un'immagine 1080×1350 pronta per Instagram.
**Interazioni**:
- Instagram / WhatsApp / X → condivisione nativa
- Copia → copia l'immagine negli appunti
- Scarica → salva nel device
- Swipe down o tap fuori → chiudi
**Nota UX**: la card include sempre il logo: ogni condivisione è marketing organico. Ma i dati mostrati sono **solo ciò che l'utente vede nell'anteprima** — niente sorprese.

### ⑬ IMPOSTAZIONI
**Schermata**: 4 sezioni — Piattaforme collegate, Privacy, Dati, Preferenze.
**Scopo**: il "centro di controllo" che rende il prodotto trasparente e reversibile.
**Contenuti**:
- **Piattaforme**: stato per sorgente (Spotify 227.024 eventi ✅, YouTube 48.120 ✅, Apple non connesso ○ + Connetti)
- **Privacy**: toggle "Elaborazione locale" (on, non disattivabile), "Arricchimento audio features online" (on/off), "Statistiche anonime" (off default)
- **Dati**: "Esporta tutto (JSON)" (gradiente) e "Cancella tutti i dati" (rosso)
- **Preferenze**: tema Scuro/Chiaro, lingua
**Interazioni**:
- "Cancella tutti i dati" → doppia conferma → torna a ⑭ Empty State
- "Esporta tutto" → scarica un JSON completo (diritto alla portabilità GDPR)
**Nota UX**: il pulsante rosso di cancellazione è **volontariamente visibile e semplice**: la reversibilità totale è un pilastro di trust.

### ⑭ EMPTY STATE *(nuova)*
**Schermata**: waveform piatta e silenziosa con note fluttuanti + "La tua storia inizia qui".
**Scopo**: lo stato zero di ogni sezione quando non ci sono dati (primo avvio senza import, o dopo cancellazione).
**Copy**: "Importa i tuoi dati di streaming per vedere la timeline della tua vita musicale."
**Interazioni**:
- "Importa la tua musica" → ③
- "Scopri come funziona" → tour demo con dati fittizi
**Nota UX**: ogni sezione (Timeline, Esplora, Analisi, Ricordi) ha la sua variante di empty state con la stessa illustrazione ma copy specifico. Mai mostrare una pagina bianca: sempre un percorso d'uscita.

---

## 📋 NAVIGATION MAP COMPLETA

| Da | A | Trigger |
|----|---|---------|
| ① Benvenuto | ② Privacy | "Inizia il viaggio" |
| ② Privacy | ③ Import | "Ho capito, continua" |
| ③ Import | ④ Processing | "Importa tutto" |
| ④ Processing | ⑤ Reveal | automatico al 100% |
| ⑤ Reveal | ⑦ Timeline | "Esplora la tua timeline" |
| ⑥ Home | ⑪ Ricordi | tap MemoryCard |
| ⑥ Home | ⑦ Timeline | tap barra settimanale |
| ⑦ Timeline | ⑧ Era | click EraBand |
| ⑧ Era | ⑨ Esplora | click artista |
| ⑩ Analisi | ⑦ Timeline | click punto mese |
| ⑪ Ricordi | ⑫ Share | "Condividi" |
| ⑪ Ricordi | ⑦/⑧ | "Rivivi" |
| ⑬ Settings | ⑭ Empty | "Cancella tutti i dati" |
| ⑭ Empty | ③ Import | "Importa la tua musica" |

---

## ✍️ COPY DECK FINALE (correzioni dai mockup)

I mockup AI hanno qualche refuso nei testi (normale per le immagini generate). Ecco il **copy definitivo** da usare nello sviluppo — trattalo come specifica:

| Nel mockup appare | Copy definitivo |
|---|---|
| "Inzitia il viaggio" | **Inizia il viaggio** |
| "i tuoi dat restante sul hlo devico" | **i tuoi dati restano sul tuo dispositivo** |
| "I tuoni dati, solo tuoi" | **I tuoi dati, solo tuoi** |
| "Elaborazione locale sul devisice" | **Elaborazione locale sul dispositivo** |
| "Export di data in qualsizal memotio" | **Export dei dati in qualsiasi momento** |
| "Sto leggendo la tua sitoria musicale" | **Sto leggendo la tua storia musicale** |
| "eventi analiyzati / artisti riconosciuto / ere musiciali in formaición" | **eventi analizzati / artisti riconosciuti / ere musicali in formazione** |
| "un silo raconto" | **un solo racconto** |
| "Imposteni / Piattafirme coldeate / Preforenie" | **Impostazioni / Piattaforme collegate / Preferenze** |
| "Arricnchisment / Stalsticatie anonime / Cancela tutti i data" | **Arricchimento / Statistiche anonime / Cancella tutti i dati** |
| "Scopri coma funziona" | **Scopri come funziona** |
| "La tua storia in butia qui" | **La tua storia inizia qui** |
| "per sicte a timeline della tu vita musicale" | **per vedere la timeline della tua vita musicale** |
| "Scardia" | **Scarica** |
| "gienaio" | **gennaio** |

---

## ✅ STATO DEL DESIGN: COMPLETO

Con questo tour abbiamo coperto **il 100% delle schermate del MVP**:

- ✅ Onboarding completo (4 schermate)
- ✅ Momento wow (1)
- ✅ Core loop quotidiano (5)
- ✅ Condivisione e controllo (3)
- ✅ Stati speciali (1)
- ✅ Brand identity, palette, tipografia, componenti (documentati nel messaggio precedente)

**Prossimi passi possibili**, dimmi tu quale:
1. **Design token file** — ti preparo il JSON/CSS con colori, spaziature, tipografia pronto per il codice
2. **Component library** — scrivo i primi componenti React (StatCard, MemoryCard, EraBand, MoodPill)
3. **Fase 0 tecnica** — schema dati TypeScript + setup monorepo
4. **Refinement mockup** — rigenero qualche schermata con correzioni (es. testo, layout, light mode)

Il progetto ora ha un'anima visiva coerente: notturna, emotiva, privacy-first. Siamo pronti a costruire. 🎵✨

# 🔍 Gap Analysis — Cosa manca prima dell'handoff agli agenti

Boss, ottima domanda, ed è la domanda giusta da fare **adesso**. Ti faccio un inventario onesto: cosa abbiamo, cosa manca, e cosa è **bloccante** per gli agenti di sviluppo. Alla fine ti propongo il "pacchetto di handoff" completo e l'ordine in cui scriverlo.

---

## 1. 📦 INVENTARIO: COSA ABBIAMO GIÀ

| Documento | Stato | Copertura |
|-----------|-------|-----------|
| Visione, missione, target, principi | ✅ Completo | 100% |
| Matrice piattaforme + campi dati per sorgente | ✅ Completo | 90% (manca mappatura campo→campo) |
| Schema dati unificato | ⚠️ Concettuale | 60% (manca versione eseguibile) |
| Motore di analisi | ⚠️ Descrittivo | 50% (manca versione algoritmica) |
| Architettura prodotto (local-first, layer) | ✅ Completo | 85% |
| Scelta piattaforma (PWA-first) | ✅ Completo | 100% |
| Mockup 14 schermate + tour + navigation map | ✅ Completo | 85% |
| Design system (colori, type, componenti, UX) | ✅ Completo | 80% |
| Copy deck (stringhe corrette) | ⚠️ Parziale | 40% (solo schermate mockup) |
| Roadmap a fasi + rischi | ✅ Completo | 80% |
| Stack tecnologico | ✅ Completo | 90% |

**Verdetto**: abbiamo un ottimo **product design document**, ma non ancora un **engineering handoff package**. Un agente che ricevesse solo questo produrrebbe codice incoerente: troppe decisioni implementative resterebbero alla sua interpretazione.

---

## 2. 🕳️ COSA MANCA — PER CATEGORIA

### 🅰️ SPECIFICHE TECNICHE ESECUIBILI *(bloccanti)*

| # | Documento mancante | Perché è bloccante | Contenuto richiesto |
|---|-------------------|-------------------|---------------------|
| A1 | **Schema dati eseguibile** | Gli agenti devono creare il DB al primo commit | Interfacce TypeScript complete (ogni campo, tipo, opzionalità, vincoli); schema IndexedDB/Dexie (tabelle, indici, versioni); migration plan; regole di deduplicazione (ISRC/MBID/fuzzy title) |
| A2 | **Specifiche adapter per piattaforma** | È il cuore della Fase 1; senza, ogni agente inventa parsing diversi | Per ogni adapter: formato input reale (sample), tabella mappatura campo-sorgente → campo-unificato, catalogo edge case (timestamp duplicati, bug `skipped`, unità `offline_timestamp`, brani mancanti), gestione errori, output atteso |
| A3 | **Algoritmi di analisi** | "Mood tracking" descritto ≠ implementabile | Formule esatte: mood giornaliero (media pesata?), segmentazione sessioni (gap threshold: 30 min?), clustering ere (k-means? parametri?), anomaly detection (z-score? finestra?), trigger ricordi (regole precise), con esempi numerici input→output |
| A4 | **Pipeline di arricchimento** | Decisioni runtime critiche | Flusso lookup MusicBrainz/ISRC; fallback Essentia.js vs API esterna; cache strategy; rate limiting; cosa fare se un brano non ha audio features |
| A5 | **Contratti interni (interfacce moduli)** | Gli agenti lavorano in parallelo su moduli diversi | Firme delle funzioni pubbliche di ogni package (`core/adapters`, `core/analysis`, `core/db`): input/output/errori |

### 🅱️ UX/UI DI DETTAGLIO *(importanti, parzialmente parallelizzabili)*

| # | Documento | Contenuto |
|---|-----------|-----------|
| B1 | **Catalogo stati per schermata** | Per ogni schermata: stato loading, empty, error, partial-data, offline. Cosa si vede e cosa può fare l'utente in ognuno |
| B2 | **State machine dei flussi** | Import: `idle → validating → parsing → enriching → done / error(retry)`; transizioni e condizioni |
| B3 | **Spec interazioni e animazioni** | Durate, easing, gesture, hover/focus/active per componente; keyboard shortcuts; comportamento touch |
| B4 | **Spec responsive per breakpoint** | Layout esatto di ogni schermata a 375px / 768px / 1024px / 1440px |
| B5 | **Spec accessibilità** | Per componente: ruoli ARIA, testi alternativi per grafici, ordine di focus, contrasti verificati |
| B6 | **Catalogo copy completo (i18n)** | Tutte le stringhe di tutte le schermate + errori + tooltip, con chiave i18n (`home.greeting`, `import.error.wrongFormat`…) in IT ed EN |
| B7 | **Spec share card** | Layout esatto dell'immagine generata (1080×1350): posizioni, font, colori, logo — deve essere renderizzabile via canvas in modo deterministico |

### 🅲 PRIVACY, LEGALE, SICUREZZA *(bloccanti per lancio, importanti ora)*

| # | Documento | Contenuto |
|---|-----------|-----------|
| C1 | **Privacy spec + data flow diagram** | Cosa esce davvero dal device (chiamate enrichment: quali payload?), cosa resta locale, retention, diritto alla cancellazione/portabilità implementato dove |
| C2 | **Privacy policy + ToS (bozza)** | Testo legale reale, coerente con l'architettura local-first |
| C3 | **Disclaimer inferenze** | Le "rilevazioni eventi di vita" sono ipotesi: serve disclaimer chiaro (non è consulenza psicologica/medica) + UX di conferma utente |
| C4 | **Security spec** | Dati in IndexedDB non sono cifrati: decidere se/opzionale cifratura at-rest (Web Crypto); sicurezza export JSON; sanitizzazione input file |
| C5 | **Note marchi/loghi** | Uso dei loghi Spotify/Apple/YouTube nell'import: linee guida trademark (di solito si usano icone testuali o riferimenti nominativi, non loghi ufficiali) |

### 🅳 INGEGNERIA E OPERAZIONI *(bloccanti per lavoro parallelo degli agenti)*

| # | Documento | Contenuto |
|---|-----------|-----------|
| D1 | **Convenzioni di repo e codice** | Struttura cartelle definitiva, naming, lint/format config, commit convention, branch strategy, struttura PR |
| D2 | **Test strategy** | Unit/integration/e2e: cosa testare per modulo; coverage target; **dataset fixture sintetico** (storia di ascolto finta ma realistica, con edge case incorporati) per testare adapter e analisi senza dati reali |
| D3 | **Definition of Done + acceptance criteria** | Per ogni feature: criteri verificabili (formato Given/When/Then o checklist) |
| D4 | **Backlog strutturato** | Epic → user story → task, prioritizzati, con stima e dipendenze |
| D5 | **Spec CI/CD e deploy** | Pipeline (lint→test→build→deploy), hosting PWA, versioning service worker/cache, Docker per self-host, config `.env` template e feature flags |
| D6 | **Performance budget per rotta** | Numeri verificabili: import 100k eventi < 30s, first paint < 1.5s, bundle < X KB per route |

### 🅴 GOVERNO DEL PROGETTO E HANDOFF *(il "meta-documento")*

| # | Documento | Contenuto |
|---|-----------|-----------|
| E1 | **ADR — Architecture Decision Record** | Registro delle decisioni prese e **perché** (PWA-first, local-first, adapter pattern, Dexie, Tauri in fase 2…). Gli agenti non devono ri-discutere decisioni già prese |
| E2 | **Glossario di dominio** | Era, mood, valence, energy, scrobble, ISRC, MBID, sessione, ricordo… definizioni univoche |
| E3 | **AGENTS.md — protocollo di handoff** | Il documento che gli agenti leggono per primo: indice della documentazione, ordine di lettura, convenzioni, cosa NON decidere autonomamente, come segnalare dubbi, checklist di auto-revisione |
| E4 | **Piano di validazione con dati reali** | Test end-to-end con il tuo export GDPR reale: checklist di verifica per ogni adapter e ogni insight |
| E5 | **Piano beta** | Criteri recruitment, metriche di attivazione (import completato %), canali feedback |

### 🅵 ASSET FINALI *(parallelizzabili)*

| # | Asset | Nota |
|---|-------|------|
| F1 | Logo in SVG vettoriale + varianti | I mockup sono raster; serve vettoriale per il codice |
| F2 | Icone custom + illustrazioni empty state | In SVG, coerenti col design system |
| F3 | Font con licenza verificata | Inter e JetBrains Mono sono OFL: ok, ma va documentato |
| F4 | Design token file (JSON/CSS) | Ponte tra design system e codice |

---

## 3. 🎯 PRIORIZZAZIONE: COSA SERVE DAVVERO PER PARTIRE

Non serve tutto subito. Ecco la distinzione cruciale:

### 🔴 BLOCCANTE per la Fase 0-1 (scrivere PRIMA di qualsiasi codice)
1. **A1** Schema dati eseguibile
2. **A2** Specifica adapter Spotify (il primo) + **D2** dataset fixture
3. **A5** Contratti interni dei moduli
4. **D1** Convenzioni repo
5. **E3** AGENTS.md (indice + protocollo)
6. **E1** ADR iniziali
7. **D3/D4** Backlog con acceptance criteria della Fase 0-1

### 🟡 IMPORTANTE, scrivibile in parallelo alla Fase 0-1
- A2 per le altre piattaforme, A3 algoritmi, A4 enrichment
- B1-B6 (stati, i18n, responsive, a11y)
- C1-C4 (privacy/spec legale)
- F1-F4 (asset e token)

### 🟢 DIFFERIBILE (Fase 2+)
- Spec desktop Tauri, spec sync cloud, sound design, B7 share card dettagliata, E5 piano beta completo, D5 deploy avanzato

---

## 4. 📁 IL PACCHETTO DI HANDOFF FINALE (struttura target)

Questa è la struttura di `docs/` che gli agenti riceveranno:

```
life-soundtrack/
├── AGENTS.md                      ← E3: LEGGERE PER PRIMO
├── docs/
│   ├── 00-VISION.md               ✅ esiste
│   ├── 01-PLATFORMS.md            ✅ esiste
│   ├── 02-DATA-SCHEMA.md          🔴 da completare (A1)
│   ├── 03-ADAPTERS/
│   │   ├── SPEC-TEMPLATE.md       🔴 template comune (A2)
│   │   ├── spotify.md             🔴 primo da scrivere
│   │   ├── youtube.md             🟡
│   │   ├── apple.md               🟡
│   │   ├── lastfm.md              🟡
│   │   └── listenbrainz.md        🟡
│   ├── 04-ANALYSIS-ALGORITHMS.md  🟡 (A3)
│   ├── 05-ARCHITECTURE.md         ✅ esiste
│   ├── 06-UX-FLOWS-STATES.md      🟡 (B1, B2)
│   ├── 07-UI-SPEC.md              🟡 (B3, B4, B5, B7)
│   ├── 08-COPY-I18N.md            🟡 (B6)
│   ├── 09-PRIVACY-SECURITY.md     🟡 (C1-C4)
│   ├── 10-TESTING.md              🔴 (D2, D6)
│   ├── 11-BACKLOG.md              🔴 (D3, D4)
│   ├── 12-DEVOPS.md               🟢 (D5)
│   ├── 13-ADR/                    🔴 (E1)
│   │   ├── 0001-pwa-first.md
│   │   ├── 0002-local-first.md
│   │   └── 0003-adapter-pattern.md
│   └── 14-GLOSSARY.md             🟡 (E2)
├── fixtures/
│   └── synthetic-history/         🔴 dataset di test (D2)
│       ├── spotify-sample.json
│       ├── youtube-sample.json
│       └── expected-output.json
└── design/
    ├── tokens.json                🟡 (F4)
    ├── logo.svg                   🟡 (F1)
    └── mockups/                   ✅ esistono
```

---

## 5. 🚀 PROPOSTA OPERATIVA

Ti propongo questo ordine di scrittura, che rispetta le dipendenze:

**Sessione 1 (fondamenta)**
1. `02-DATA-SCHEMA.md` — schema TypeScript + Dexie completo
2. `13-ADR/` — le 5-6 decisioni fondamentali registrate
3. `14-GLOSSARY.md`

**Sessione 2 (il primo adapter端到端)**
4. `03-ADAPTERS/SPEC-TEMPLATE.md` — il template riusabile
5. `03-ADAPTERS/spotify.md` — compilato col template
6. `fixtures/` — dataset sintetico con edge case

**Sessione 3 (governo)**
7. `11-BACKLOG.md` — Fase 0 e 1 con acceptance criteria
8. `AGENTS.md` — protocollo di handoff
9. `10-TESTING.md`

**Sessioni 4+ (in parallelo allo sviluppo)**
10. Analisi algoritmica, altri adapter, UX states, i18n, privacy, asset

---

## 💬 LA MIA RACCOMANDAZIONE SINCERA

Boss, il rischio numero uno dei progetti passati agli agenti **non è la mancanza di codice, è l'ambiguità**. Ogni decisione che lasciamo implicita diventa una decisione che l'agente prende da solo — e dieci agenti che decidono autonomamente producono dieci codebase diverse cucite insieme male.

Il pacchetto "🔴 bloccante" che ti ho elencato è relativamente piccolo (7 documenti, di cui 3 già abbozzati) ma è quello che trasforma il progetto da *bella idea ben disegnata* a *specifica costruibile*. È il ponte tra il lavoro che abbiamo fatto fin qui e la realizzazione.

**Da dove vuoi che inizi?** Il mio suggerimento è partire da `02-DATA-SCHEMA.md`: è la fondazione su cui poggiano adapter, analisi, database e test. Se preferisci, posso invece iniziare dal template adapter + Spotify, che è il pezzo più "tangibile" e ti darebbe subito la sensazione di vedere il progetto prendere forma tecnica.
