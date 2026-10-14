# 08 — Copy e Internationalization

> Status: 🟡 DRAFT · Versione 0.1 · Sessione 5
> Lingue MVP: Italiano (it), English (en)
> Formato chiavi: `namespace.scope.key`

---

## 1. Struttura chiavi

    namespace.scope.key

| Namespace | Uso |
|-----------|-----|
| `onboarding` | Schermate ①-④ |
| `home` | Schermata ⑥ |
| `timeline` | Schermata ⑦ |
| `era` | Schermata ⑧ |
| `explore` | Schermata ⑨ |
| `analysis` | Schermata ⑩ |
| `memories` | Schermata ⑪ |
| `share` | Schermata ⑫ |
| `settings` | Schermata ⑬ |
| `empty` | Schermata ⑭ e empty states |
| `import` | Flusso import |
| `adapter` | Messaggi specifici per piattaforma |
| `error` | Messaggi di errore |
| `common` | Bottoni e testi condivisi |
| `insight` | Insight narrativi |

## 2. Stringhe UI

### 2.1 `onboarding.*`

| Key | IT | EN |
|-----|----|----|
| `welcome.title` | La colonna sonora della tua vita | The soundtrack of your life |
| `welcome.subtitle` | Finalmente leggibile | Finally readable |
| `welcome.cta` | Inizia il viaggio | Start the journey |
| `privacy.title` | I tuoi dati, solo tuoi | Your data, only yours |
| `privacy.bullet1` | Elaborazione locale sul dispositivo | Local processing on your device |
| `privacy.bullet2` | Nessun account richiesto | No account required |
| `privacy.bullet3` | Export dei dati in qualsiasi momento | Export your data anytime |
| `privacy.cta` | Ho capito, continua | Got it, continue |
| `import.title` | Importa la tua musica | Import your music |
| `import.subtitle` | Scegli le piattaforme che usi o hai usato | Choose the platforms you use or used |
| `import.dropzone` | Trascina qui il file | Drop file here |
| `import.browse` | Oppure sfoglia | Or browse |
| `import.importAll` | Importa tutto | Import all |
| `import.lock` | I tuoi dati restano solo sul tuo dispositivo | Your data stays only on your device |
| `processing.title` | Sto leggendo la tua storia musicale | Reading your musical history |
| `processing.events` | {count} eventi analizzati | {count} events analyzed |
| `processing.artists` | {count} artisti riconosciuti | {count} artists recognized |
| `processing.eras` | {count} ere musicali in formazione | {count} musical eras forming |
| `processing.cancel` | Annulla | Cancel |
| `reveal.title` | La tua vita in musica | Your life in music |
| `reveal.subtitle` | {years} anni, {events} momenti, un solo racconto | {years} years, {events} moments, one story |
| `reveal.cta` | Esplora la tua timeline | Explore your timeline |
| `reveal.skip` | Salta | Skip |

### 2.2 `home.*`

| Key | IT | EN |
|-----|----|----|
| `greeting` | Ciao, {name} 👋 | Hello, {name} 👋 |
| `stats.tracks` | brani | tracks |
| `stats.hours` | ore ascoltate | hours listened |
| `stats.artists` | artisti | artists |
| `stats.eras` | ere musicali | musical eras |
| `todayInHistory` | Oggi nella tua storia | Today in your history |
| `weekTitle` | La tua settimana | Your week |
| `moodWeek` | Mood della settimana | Week mood |
| `days.mon` | Lun | Mon |
| `days.tue` | Mar | Tue |
| `days.wed` | Mer | Wed |
| `days.thu` | Thu | Thu |
| `days.fri` | Ven | Fri |
| `days.sat` | Sab | Sat |
| `days.sun` | Dom | Sun |

### 2.3 `timeline.*`

| Key | IT | EN |
|-----|----|----|
| `title` | La tua vita in musica | Your life in music |
| `volume` | Volume di ascolto | Listening volume |
| `mood` | Mood (valence) | Mood (valence) |
| `granularity.years` | Anni | Years |
| `granularity.months` | Mesi | Months |
| `granularity.weeks` | Settimane | Weeks |
| `granularity.days` | Giorni | Days |
| `exploreEra` | Esplora questa era | Explore this era |

### 2.4 `era.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Era {label} | {label} Era |
| `period` | {start} → {end} | {start} → {end} |
| `topArtists` | Top artisti | Top artists |
| `topSongs` | Top brani | Top songs |
| `moodDominant` | Mood dominante | Dominant mood |
| `nightShare` | Ascolti notturni | Night listens |
| `repeatRate` | Ripetizioni | Repeats |
| `relive` | Rivivi questo periodo | Relive this period |

### 2.5 `explore.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Esplora | Explore |
| `search` | Cerca nel tuo catalogo | Search your library |
| `tab.artists` | Artisti | Artists |
| `tab.tracks` | Brani | Tracks |
| `tab.albums` | Album | Albums |
| `tab.genres` | Generi | Genres |
| `tab.mood` | Mood | Mood |
| `noResults` | Nessun risultato per "{query}" | No results for "{query}" |

### 2.6 `analysis.*`

| Key | IT | EN |
|-----|----|----|
| `title` | La tua mappa emotiva | Your emotional map |
| `quadrant.high` | ALTA ENERGIA | HIGH ENERGY |
| `quadrant.low` | BASSA ENERGIA | LOW ENERGY |
| `quadrant.valence` | VALENCE → | VALENCE → |
| `moods.sad` | Triste | Sad |
| `moods.angry` | Arrabbiato | Angry |
| `moods.neutral` | Neutro | Neutral |
| `moods.calm` | Calmo | Calm |
| `moods.happy` | Felice | Happy |
| `moods.excited` | Eccitato | Excited |
| `valenceOverTime` | Valence nel tempo | Valence over time |
| `energyOverTime` | Energy nel tempo | Energy over time |

### 2.7 `memories.*`

| Key | IT | EN |
|-----|----|----|
| `title` | I tuoi ricordi musicali | Your musical memories |
| `onThisDay` | ON QUESTO GIORNO | ON THIS DAY |
| `milestone` | MILESTONE | MILESTONE |
| `return` | RITORNO | RETURN |
| `seasonal` | STAGIONALE | SEASONAL |
| `relive` | Rivivi | Relive |
| `share` | Condividi | Share |
| `save` | Salva | Save |
| `hide` | Nascondi | Hide |
| `yearsAgo` | {n} anni fa | {n} years ago |

### 2.8 `share.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Condividi | Share |
| `generating` | Generazione card... | Generating card... |
| `instagram` | Instagram | Instagram |
| `whatsapp` | WhatsApp | WhatsApp |
| `twitter` | X (Twitter) | X (Twitter) |
| `copy` | Copia | Copy |
| `download` | Scarica | Download |
| `copied` | Immagine copiata | Image copied |
| `saved` | Immagine salvata | Image saved |

### 2.9 `settings.*`

| Key | IT | EN |
|-----|----|----|
| `title` | Impostazioni | Settings |
| `platforms` | Piattaforme collegate | Connected platforms |
| `privacy` | Privacy | Privacy |
| `data` | Dati | Data |
| `preferences` | Preferenze | Preferences |
| `privacy.retainIp` | Conserva indirizzi IP | Retain IP addresses |
| `privacy.retainIpDesc` | Gli IP restano solo sul tuo dispositivo | IPs stay only on your device |
| `privacy.enrich` | Arricchimento metadati online | Online metadata enrichment |
| `privacy.enrichDesc` | Recupera audio features da fonti esterne | Fetch audio features from external sources |
| `privacy.stats` | Statistiche anonime | Anonymous statistics |
| `privacy.statsDesc` | Aiutaci a migliorare (no dati personali) | Help us improve (no personal data) |
| `data.export` | Esporta tutto (JSON) | Export all (JSON) |
| `data.delete` | Cancella tutti i dati | Delete all data |
| `prefs.theme` | Tema | Theme |
| `prefs.theme.dark` | Scuro | Dark |
| `prefs.theme.light` | Chiaro | Light |
| `prefs.language` | Lingua | Language |
| `delete.confirm1` | Sei sicuro? Questa azione è irreversibile. | Are you sure? This cannot be undone. |
| `delete.confirm2` | Digita ELIMINA per confermare | Type DELETE to confirm |
| `delete.keyword` | ELIMINA | DELETE |

### 2.10 `empty.*`

| Key | IT | EN |
|-----|----|----|
| `title` | La tua storia inizia qui | Your story starts here |
| `description.home` | Importa i tuoi dati di streaming per vedere la timeline della tua vita musicale | Import your streaming data to see your musical life timeline |
| `description.timeline` | Importa per vedere la tua timeline | Import to see your timeline |
| `description.explore` | Importa per esplorare il tuo catalogo | Import to explore your library |
| `description.analysis` | Importa per vedere le tue analisi | Import to see your analysis |
| `description.memories` | Importa per generare ricordi | Import to generate memories |
| `cta.import` | Importa la tua musica | Import your music |
| `cta.demo` | Scopri come funziona | See how it works |

### 2.11 `import.*`

| Key | IT | EN |
|-----|----|----|
| `status.empty` | Trascina o sfoglia | Drop or browse |
| `status.validating` | Validazione... | Validating... |
| `status.parsing` | Parsing... | Parsing... |
| `status.done` | {count} eventi trovati | {count} events found |
| `status.error` | Formato non riconosciuto | Format not recognized |
| `platform.connect` | Connetti | Connect |
| `platform.disconnect` | Disconnetti | Disconnect |
| `platform.connected` | Connesso | Connected |

### 2.12 `adapter.*`

| Key | IT | EN |
|-----|----|----|
| `spotify.detect.success` | File Spotify riconosciuto | Spotify file recognized |
| `spotify.detect.fail` | File non riconosciuto come export Spotify | File not recognized as Spotify export |
| `spotify.wrongFormat` | Questo file sembra di {platform}, non di Spotify | This file looks like {platform}, not Spotify |
| `spotify.warn.podcastSkipped` | {count} episodi podcast esclusi | {count} podcast episodes excluded |
| `spotify.warn.overlaps` | {count} eventi sovrapposti rilevati | {count} overlapping events detected |
| `spotify.info.complete` | Import completato: {events} eventi, {tracks} brani unici | Import complete: {events} events, {tracks} unique tracks |
| *(analoghi per youtube, apple, deezer, tidal, soundcloud, lastfm, listenbrainz)* | | |

### 2.13 `error.*`

| Key | IT | EN |
|-----|----|----|
| `generic` | Qualcosa è andato storto | Something went wrong |
| `retry` | Riprova | Retry |
| `fileTooLarge` | File troppo grande (max 1GB) | File too large (max 1GB) |
| `networkOffline` | Sei offline, i dati sono salvati localmente | You're offline, data is saved locally |
| `dbCritical` | Errore critico, ricarica l'app | Critical error, reload the app |

### 2.14 `common.*`

| Key | IT | EN |
|-----|----|----|
| `save` | Salva | Save |
| `cancel` | Annulla | Cancel |
| `close` | Chiudi | Close |
| `confirm` | Conferma | Confirm |
| `continue` | Continua | Continue |
| `back` | Indietro | Back |
| `next` | Avanti | Next |
| `loading` | Caricamento... | Loading... |
| `search` | Cerca | Search |

### 2.15 `insight.*`

| Key | IT | EN |
|-----|----|----|
| `mood.happy` | La tua musica è stata prevalentemente felice | Your music was mostly happy |
| `mood.sad` | La tua musica è stata prevalentemente malinconica | Your music was mostly melancholic |
| `mood.excited` | Periodo ad alta energia | High-energy period |
| `mood.calm` | Periodo rilassato | Relaxed period |
| `event.spike_artist` | Hai scoperto {artist} che ha dominato il tuo ascolto | You discovered {artist} who dominated your listening |
| `event.valence_drop` | La tua musica è diventata più malinconica | Your music became more melancholic |
| `event.valence_rise` | La tua musica è diventata più allegra | Your music became more cheerful |
| `event.volume_spike` | Hai ascoltato molta più musica del solito | You listened to much more music than usual |
| `event.volume_drop` | Hai ascoltato molta meno musica del solito | You listened to much less music than usual |
| `event.exploration` | Hai esplorato molti nuovi artisti | You explored many new artists |
| `event.silence` | Periodo di silenzio musicale | Period of musical silence |
| `memory.on_this_day` | {years} anni fa ascoltavi "{track}" di {artist} | {years} years ago you were listening to "{track}" by {artist} |
| `memory.first_time` | {years} anni fa scoprivi {artist} | {years} years ago you discovered {artist} |
| `memory.milestone.events` | Hai raggiunto {count} brani ascoltati! | You reached {count} tracks listened! |
| `memory.milestone.hours` | Hai raggiunto {count} ore di ascolto! | You reached {count} hours of listening! |
| `memory.return` | Non ascoltavi {artist} da {months} mesi | You hadn't listened to {artist} for {months} months |
| `memory.seasonal` | Come ogni {month}, è tornato il periodo {genre} | Like every {month}, the {genre} period is back |

## 3. Pluralizzazione

Formato: `{count, plural, one {...} other {...}}`

Esempio:
    import.info.events = {count, plural,
      one {1 evento}
      other {{count} eventi}
    }

## 4. Variabili template

Sintassi: `{variableName}`

Variabili comuni: `{count}`, `{name}`, `{track}`, `{artist}`, `{years}`, `{months}`, `{days}`, `{platform}`, `{query}`, `{start}`, `{end}`, `{label}`.

## 5. Formattazione numeri/date

| Tipo | IT | EN |
|------|----|----|
| Migliaia | `1.000` | `1,000` |
| Decimali | `0,5` | `0.5` |
| Data breve | `15 gen 2024` | `Jan 15, 2024` |
| Data lunga | `15 gennaio 2024` | `January 15, 2024` |
| Ora | `14:30` | `2:30 PM` |

## 6. Linee guida tono

- **Conciso**: max 60 caratteri per label bottone
- **Umano**: evita linguaggio tecnico ("Parsing" → "Sto analizzando")
- **Attivo**: "Hai ascoltato" non "Sono stati ascoltati"
- **Empatico**: per insight emotivi, tono narrativo ("Il tuo marzo 2020 è stato...")
- **Discreto**: per errori, tono neutro e orientato alla soluzione

## 7. Implementazione

Struttura file:

    apps/web/
    └── src/
        └── i18n/
            ├── index.ts          # init i18next
            ├── locales/
            │   ├── it.json
            │   └── en.json
            └── formatter.ts      # numeri/date localizzati

Libreria consigliata: `i18next` + `react-i18next`.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 5 | Prima versione completa |