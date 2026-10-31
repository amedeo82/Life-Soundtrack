# 08 — Copy e Internationalization

> Status: 🟡 DRAFT · Versione 0.11 · Sessione 67 (2026-10-30, issue #201), aggiornata nelle Sessioni 69 (2026-10-31, issue #211) e 70 (2026-10-31, issue #214)
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
| `scrobble` | Invio degli ascolti ai hub (Story 1.5 — spec `20-SCROBBLING-HUB.md` §13.2) |
| `enrichment` | Stato della pipeline delle audio features (Story 4.1 — spec `21-AUDIO-FEATURES.md` §14) |

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
| `title` | {label} | {label} |
| `period` | {start} → {end} | {start} → {end} |
| `topArtists` | Top artisti | Top artists |
| `topSongs` | Top brani | Top songs |
| `moodDominant` | Mood dominante | Dominant mood |
| `nightShare` | Ascolti notturni | Night listens |
| `repeatRate` | Ripetizioni | Repeats |
| `relive` | Rivivi questo periodo | Relive this period |

> **`title` è un pass-through**: l'etichetta dell'era (`EraPayload.label`,
> `02§4`) **contiene già** il prefisso «Era» — lo schema lo dichiara
> (`es. "Era Malinconia"`) e `04-ANALYSIS-ALGORITHMS.md` §5.2 lo costruisce
> così (`"Era " + mood + " " + topGenre`). Il titolo della schermata ⑧ è
> quindi **l'etichetta stessa**: anteporre «Era» produrrebbe «Era Era
> Malinconia Indie».

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
| `privacy.retainCountry` | Conserva il paese di connessione | Retain connection country |
| `privacy.retainCountryDesc` | Il paese resta anche senza l'IP: è un dato derivato, non identificativo | The country stays even without the IP: derived, non-identifying |
| `privacy.retainCity` | Deduce la città dall'IP | Derive the city from the IP |
| `privacy.retainCityDesc` | Stima incerta e opt-in: richiede il database locale | Uncertain, opt-in estimate: needs the local database |
| `privacy.retainDeviceType` | Conserva il tipo di dispositivo | Retain device type |
| `privacy.retainDeviceDetail` | Conserva la stringa grezza del dispositivo | Retain the raw device string |
| `privacy.deriveContext` | Deduce il contesto (casa, lavoro, viaggio) | Infer context (home, work, travel) |
| `privacy.enrich` | Arricchimento metadati online | Online metadata enrichment |
| `privacy.enrichDesc` | Recupera audio features da fonti esterne | Fetch audio features from external sources |
| `privacy.carDetection` | Rileva ascolti in auto | Detect car listening |
| `privacy.carDetectionDesc` | Deduce l'ascolto in auto da segnali locali (Bluetooth, CarPlay). Nessun dato lascia il dispositivo | Deduce car listening from local signals (Bluetooth, CarPlay). No data leaves the device |
| `privacy.syncCloud` | Sincronizza tra dispositivi (Fase 2) | Sync across devices (Phase 2) |
| `privacy.syncCloudDesc` | Sincronizzazione cifrata end-to-end, opzionale | End-to-end encrypted sync, optional |
| `data.export` | Esporta tutto (JSON) | Export all (JSON) |
| `data.delete` | Cancella tutti i dati | Delete all data |
| `prefs.theme` | Tema | Theme |
| `prefs.theme.dark` | Scuro | Dark |
| `prefs.theme.light` | Chiaro | Light |
| `prefs.language` | Lingua | Language |
| `delete.confirm1` | Sei sicuro? Questa azione è irreversibile. | Are you sure? This cannot be undone. |
| `delete.confirm2` | Digita ELIMINA per confermare | Type DELETE to confirm |
| `delete.keyword` | ELIMINA | DELETE |
| `license` | Licenza | License |
| `licenseText` | AGPL-3.0 — il sorgente corrispondente è offerto per AGPL §13 (vedi Informazioni). | AGPL-3.0 — the corresponding source is offered per AGPL §13 (see About). |
| `sourceOffer` | Sorgente corrispondente (AGPL §13) | Corresponding Source (AGPL §13) |

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
| `spotify.warn.offlineConverted` | {count} tracce offline convertite in eventi stimati | {count} offline tracks converted to estimated events |
| `spotify.info.complete` | Import completato: {events} eventi, {tracks} brani unici | Import complete: {events} events, {tracks} unique tracks |
| *(analoghi per youtube, apple, deezer, tidal, soundcloud, lastfm, listenbrainz)* | | |

### 2.12b `adapter.youtube_music.*` (Story 1.1 — spec `03-ADAPTERS/youtube-music.md` §9)

| Key | IT | EN |
|-----|----|----|
| `youtube_music.detect.success` | File YouTube Music riconosciuto | YouTube Music file recognized |
| `youtube_music.detect.fail` | File non riconosciuto come export YouTube (Google Takeout) | File not recognized as a YouTube export (Google Takeout) |
| `youtube_music.wrongFormat` | Questo file sembra di {platform}, non di YouTube Music | This file looks like {platform}, not YouTube Music |
| `youtube_music.error.htmlExport` | Questo è l'export HTML: riesporta da Google Takeout selezionando il formato JSON per la cronologia | This is the HTML export: re-export from Google Takeout selecting the JSON format for history |
| `youtube_music.warn.nonMusicSkipped` | {count} eventi video non musicali esclusi | {count} non-music video events excluded |
| `youtube_music.warn.unwatchableSkipped` | {count} eventi con metadati incompleti esclusi (video rimossi) | {count} events with incomplete metadata excluded (removed videos) |
| `youtube_music.info.playlistsDeferred` | Le playlist non sono incluse in questo import (in arrivo) | Playlists are not included in this import (coming soon) |
| `youtube_music.info.partialHistory` | La cronologia Google potrebbe non coprire l'intera storia dell'account | Google history may not cover your entire account lifetime |
| `youtube_music.info.complete` | Import completato: {events} eventi, {tracks} brani unici | Import complete: {events} events, {tracks} unique tracks |

### 2.12c `adapter.listenbrainz.*` (Story 1.3 — spec `03-ADAPTERS/listenbrainz.md` §9)

| Key | IT | EN |
|-----|----|----|
| `listenbrainz.detect.success` | Archivio ListenBrainz riconosciuto | ListenBrainz archive recognized |
| `listenbrainz.detect.fail` | File non riconosciuto come export ListenBrainz (manca la cartella `listens/`) | File not recognized as a ListenBrainz export (missing the `listens/` folder) |
| `listenbrainz.warn.malformedSkipped_one` | {{count}} riga non leggibile esclusa | {{count}} unreadable row excluded |
| `listenbrainz.warn.malformedSkipped_other` | {{count}} righe non leggibili escluse | {{count}} unreadable rows excluded |
| `listenbrainz.warn.tooOldSkipped_one` | {{count}} ascolto anteriore al 2001 escluso | {{count}} listen before 2001 excluded |
| `listenbrainz.warn.tooOldSkipped_other` | {{count}} ascolti anteriori al 2001 esclusi | {{count}} listens before 2001 excluded |
| `listenbrainz.warn.noTitleSkipped_one` | {{count}} ascolto senza titolo escluso | {{count}} listen without a title excluded |
| `listenbrainz.warn.noTitleSkipped_other` | {{count}} ascolti senza titolo esclusi | {{count}} listens without a title excluded |
| `listenbrainz.warn.durationMissing_one` | {{count}} ascolto senza durata: il brano non è distinguibile dalle sue versioni alternative | {{count}} listen without a duration: the track cannot be told apart from its alternative versions |
| `listenbrainz.warn.durationMissing_other` | {{count}} ascolti senza durata: i brani non sono distinguibili dalle loro versioni alternative | {{count}} listens without a duration: tracks cannot be told apart from their alternative versions |
| `listenbrainz.info.libraryDeferred` | I tuoi like e le registrazioni fissate non sono inclusi in questo import (in arrivo) | Your likes and pinned recordings are not included in this import (coming soon) |
| `listenbrainz.info.exportNotSnapshot` | L'export di ListenBrainz è generato in modo asincronico: un import successivo può aggiungere ascolti, ma non rimuove quelli che hai cancellato sul sito | The ListenBrainz export is generated asynchronously: a later import can add listens, but does not remove the ones you deleted on the site |
| `listenbrainz.info.complete` | Import completato: {{events}} eventi, {{tracks}} brani unici | Import complete: {{events}} events, {{tracks}} unique tracks |

### 2.12d `adapter.lastfm.*` (Story 1.3 — spec `03-ADAPTERS/lastfm.md` §9)

| Key | IT | EN |
|-----|----|----|
| `lastfm.detect.success` | Account Last.fm riconosciuto | Last.fm account recognized |
| `lastfm.detect.fail` | Configurazione Last.fm incompleta: manca il proxy, la chiave API o il nome utente | Last.fm configuration incomplete: missing the proxy, the API key or the username |
| `lastfm.warn.noTitleSkipped_one` | {{count}} ascolto senza titolo escluso | {{count}} listen without a title excluded |
| `lastfm.warn.noTitleSkipped_other` | {{count}} ascolti senza titolo esclusi | {{count}} listens without a title excluded |
| `lastfm.warn.noArtistSkipped_one` | {{count}} ascolto senza artista escluso | {{count}} listen without an artist excluded |
| `lastfm.warn.noArtistSkipped_other` | {{count}} ascolti senza artista esclusi | {{count}} listens without an artist excluded |
| `lastfm.warn.noDateSkipped_one` | {{count}} ascolto senza data escluso | {{count}} listen without a date excluded |
| `lastfm.warn.noDateSkipped_other` | {{count}} ascolti senza data esclusi | {{count}} listens without a date excluded |
| `lastfm.warn.mbidMissing_one` | {{count}} ascolto senza MusicBrainz ID: alcuni brani potrebbero non essere riconosciuti come univoci | {{count}} listen without a MusicBrainz ID: some tracks may not be recognized as unique |
| `lastfm.warn.mbidMissing_other` | {{count}} ascolti senza MusicBrainz ID: alcuni brani potrebbero non essere riconosciuti come univoci | {{count}} listens without a MusicBrainz ID: some tracks may not be recognized as unique |
| `lastfm.info.privateProfile` | Il tuo profilo Last.fm non mostra gli ascolti recenti: accedi con la sessione web per importarli | Your Last.fm profile does not show recent listens: sign in with the web session to import them |
| `lastfm.info.libraryDeferred` | I tuoi brani preferiti non sono inclusi in questo import (in arrivo) | Your loved tracks are not included in this import (coming soon) |
| `lastfm.info.proxyTrust` | Le richieste passano dal proxy che hai configurato: lui vede la tua chiave API | The requests go through the proxy you configured: it sees your API key |
| `lastfm.info.complete` | Import completato: {{events}} eventi, {{tracks}} brani unici | Import complete: {{events}} events, {{tracks}} unique tracks |

### 2.12e `settings.lastfm.*` (Story 1.3 — pannello di configurazione del proxy)

Chiavi del pannello Last.fm (configurazione locale + import via API). I tre
dati che l'utente inserisce (proxy, chiave API, username) **non** sono stringhe
tradotte: sono valori dell'utente, e la UI li dichiara come dati locali.

| Key | IT | EN |
|-----|----|----|
| `settings.lastfm.hint` | Per importare da Last.fm serve un proxy CORS, la tua chiave API e il tuo nome utente: restano solo su questo dispositivo. | To import from Last.fm you need a CORS proxy, your API key and your username: they stay on this device only. |
| `settings.lastfm.proxy` | Proxy CORS (base URL) | CORS proxy (base URL) |
| `settings.lastfm.username` | Nome utente Last.fm | Last.fm username |
| `settings.lastfm.apiKey` | Chiave API Last.fm | Last.fm API key |
| `settings.lastfm.save` | Salva | Save |
| `settings.lastfm.saved` | Configurazione salvata su questo dispositivo | Configuration saved on this device |
| `settings.lastfm.import` | Importa da Last.fm | Import from Last.fm |
| `settings.lastfm.importing` | Import in corso... | Importing... |
| `settings.lastfm.imported_one` | {{count}} evento importato | {{count}} event imported |
| `settings.lastfm.imported_other` | {{count}} eventi importati | {{count}} events imported |
| `settings.lastfm.notConfigured` | Inserisci proxy, chiave API e nome utente per abilitare l'import da Last.fm. Il percorso file resta disponibile. | Enter a proxy, an API key and a username to enable the Last.fm import. The file path stays available. |

### 2.13 `error.*`

| Key | IT | EN |
|-----|----|----|
| `generic` | Qualcosa è andato storto | Something went wrong |
| `retry` | Riprova | Retry |
| `fileTooLarge` | File troppo grande (max 500MB) | File too large (max 500MB) |
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

I template degli insight: umore, eventi, **ere** e **ricordi**. Le chiavi dei
ricordi (`memory.*`) sono **vincolanti** dalla ratifica di
`04-ANALYSIS-ALGORITHMS.md` v1.0 🟢 (§7.3.1, decisione D-A.4): il `text` del
ricordo è una **stringa resa** alla generazione — il ricordo è uno snapshot
e la lingua in cui è stato scritto è parte della memoria — ma il **template**
è internazionalizzato, e la generazione non scrive mai stringhe italiane
inline.

Lo stesso vale per l'**etichetta dell'era** (`era.*`, Story 2.2): `EraPayload.label`
(`02§4`) è una stringa resa, costruita dal template `insight.era.label` a
partire dal **nome localizzato** del mood (`insight.era.mood.*`) e dal genere
più ascoltato — che è **dato**, non copia, e non viene tradotto.

Vale per la **descrizione dell'evento** (`event.*`, Story 2.3):
`EventPayload.description` (`02§4`) è una stringa resa dal template
`insight.event.<eventType>`, come il ricordo e l'etichetta dell'era. I
template di `event.*` accettano due segnaposto: `{{artist}}` (il nome
dell'artista che domina, per `spike_artist`) e `{{genre}}` (il genere che
domina, per `spike_genre`) — il genere è **dato**, non copia, e non viene
tradotto. La descrizione è seguita dal **suffisso numerico** del detector che
l'ha prodotta: `(z-score: 4.00)` per il detector a z-score, `(×2.40)` per
quello a quota. Il suffisso è **linguisticamente neutro** (il nome della
statistica e un numero): è il dato che rende l'evento verificabile.

| Key | IT | EN |
|-----|----|----|
| `mood.happy` | La tua musica è stata prevalentemente felice | Your music was mostly happy |
| `mood.sad` | La tua musica è stata prevalentemente malinconica | Your music was mostly melancholic |
| `mood.excited` | Periodo ad alta energia | High-energy period |
| `mood.calm` | Periodo rilassato | Relaxed period |
| `event.spike_artist` | Hai scoperto {artist} che ha dominato il tuo ascolto | You discovered {artist} who dominated your listening |
| `event.spike_genre` | Il genere {genre} ha dominato il tuo ascolto | The {genre} genre dominated your listening |
| `event.valence_drop` | La tua musica è diventata più malinconica | Your music became more melancholic |
| `event.valence_rise` | La tua musica è diventata più allegra | Your music became more cheerful |
| `event.volume_spike` | Hai ascoltato molta più musica del solito | You listened to much more music than usual |
| `event.volume_drop` | Hai ascoltato molta meno musica del solito | You listened to much less music than usual |
| `event.exploration` | Hai esplorato molti nuovi artisti | You explored many new artists |
| `event.silence` | Periodo di silenzio musicale | Period of musical silence |
| `era.label` | Era {mood} {genre} | {mood} {genre} Era |
| `era.mood.sad` | Malinconia | Melancholy |
| `era.mood.angry` | Rabbia | Anger |
| `era.mood.neutral` | Neutro | Neutral |
| `era.mood.calm` | Calma | Calm |
| `era.mood.happy` | Felicità | Happiness |
| `era.mood.excited` | Energia | Energy |
| `memory.on_this_day` | {years} anni fa ascoltavi "{track}" di {artist} | {years} years ago you were listening to "{track}" by {artist} |
| `memory.first_time` | {years} anni fa scoprivi {artist} | {years} years ago you discovered {artist} |
| `memory.milestone.events` | Hai raggiunto {count} brani ascoltati! | You reached {count} tracks listened! |
| `memory.milestone.artists` | Hai raggiunto {count} artisti unici! | You reached {count} unique artists! |
| `memory.milestone.hours` | Hai raggiunto {count} ore di ascolto! | You reached {count} hours of listening! |
| `memory.return` | Non ascoltavi {artist} da {months} mesi | You hadn't listened to {artist} for {months} months |
| `memory.seasonal` | Come ogni {month}, è tornato il periodo {genre} | Like every {month}, the {genre} period is back |
| `disclaimer` | Questo insight è generato automaticamente a partire dai tuoi dati di ascolto. Non è una diagnosi. | This insight is derived automatically from your listening data. It is not a diagnosis. |
| `disclaimerShort` | Generato automaticamente | Auto-generated |

### 2.16 `scrobble.*` (Story 1.5 — spec `20-SCROBBLING-HUB.md` §13.2)

Namespace dell'invio degli ascolti ai hub. I 15 codici sono **vincolanti**
(spec ratificata in v1.0 🟢): il contratto `ScrobbleSink` (`05§4.2`) e la mappa
`ScrobbleError` decidono **quale** codice compare in **quale** caso.

| Key | IT | EN |
|-----|----|----|
| `scrobble.info.hubEnabled` | Invio degli ascolti attivo su {hub} | Sending your listens to {hub} is on |
| `scrobble.info.hubDisabled` | Invio degli ascolti disattivato su {hub}: la coda è stata svuotata | Sending your listens to {hub} is off: the queue has been cleared |
| `scrobble.info.batchSent` | {count} ascolti inviati a {hub} | {count} listens sent to {hub} |
| `scrobble.warn.hubUnreachable` | {hub} non è raggiungibile: gli invii sono in attesa | {hub} is unreachable: sends are pending |
| `scrobble.warn.rateLimited` | {hub} ha limitato le richieste: gli invii riprenderanno più tardi | {hub} has rate-limited the requests: sends will resume later |
| `scrobble.warn.unconfirmedSend` | {count} invii a {hub} non sono stati confermati: controlla il profilo per evitare duplicati | {count} sends to {hub} were not confirmed: check your profile to avoid duplicates |
| `scrobble.warn.writeProxyMissing` | Il proxy configurato non inoltra le scritture: {hub} può essere solo in lettura | The configured proxy does not forward writes: {hub} can only be read |
| `scrobble.warn.durationEstimated` | {count} ascolti inviati con durata stimata | {count} listens sent with an estimated duration |
| `scrobble.warn.tooShortSkipped` | {count} ascolti troppo brevi esclusi | {count} too-short listens skipped |
| `scrobble.warn.partialAccept` | {hub} ha accettato {accepted} invii su {total}: i restanti verranno ritentati | {hub} accepted {accepted} of {total} sends: the rest will be retried |
| `scrobble.error.tokenExpired` | Il token di {hub} non è più valido: rinnovalo nelle impostazioni | The {hub} token is no longer valid: renew it in the settings |
| `scrobble.error.sessionRevoked` | La sessione di {hub} è stata revocata: riautenticati | The {hub} session was revoked: sign in again |
| `scrobble.error.invalidSignature` | {hub} ha rifiutato la firma della richiesta: verifica le credenziali | {hub} rejected the request signature: check your credentials |
| `scrobble.error.payloadTooLarge` | Il lotto di invio supera il limite di {hub}: è stato suddiviso | The send batch exceeds the {hub} limit: it has been split |
| `scrobble.error.dbReadOnly` | Il database è in sola lettura: gli invii sono sospesi | The database is read-only: sends are suspended |

**Pluralizzazione**: le quattro stringhe con `{count}` (`scrobble.info.batchSent`,
`scrobble.warn.unconfirmedSend`, `scrobble.warn.durationEstimated`,
`scrobble.warn.tooShortSkipped`) seguono §3 — `{count, plural, one {…} other {…}}`.
Le stringhe con `{hub}`, `{accepted}` e `{total}` sono parametri semplici.

### 2.12f `settings.scrobble.*` (Story 1.5 — UI del pannello scrobbling)

Le stringhe **di interfaccia** del pannello scrobbling (selettore per-hub, modalità
del proxy, vista della coda) stanno nel namespace `settings`, come le altre
chiavi di pannello (`settings.lastfm.*`); il namespace `scrobble` di §2.16
resta quello degli **errori e degli avvisi** del percorso di scrittura.

| Key | IT | EN |
|-----|----|----|
| `settings.scrobble.title` | Invio ai hub di scrobbling | Send to scrobbling hubs |
| `settings.scrobble.hint` | Gli ascolti di questo dispositivo possono essere inviati ai hub che scegli: la coda resta qui, e niente esce senza il tuo consenso. | The listens on this device can be sent to the hubs you choose: the queue stays here, and nothing leaves without your consent. |
| `settings.scrobble.hubLastfm` | Last.fm | Last.fm |
| `settings.scrobble.hubListenbrainz` | ListenBrainz | ListenBrainz |
| `settings.scrobble.proxyMode` | Modalità del proxy Last.fm | Last.fm proxy mode |
| `settings.scrobble.proxyReadOnly` | Solo lettura (predefinito) | Read only (default) |
| `settings.scrobble.proxyReadWrite` | Lettura e scrittura | Read and write |
| `settings.scrobble.proxyHint` | La scrittura su Last.fm passa dal tuo proxy: deve inoltrare le richieste POST. | Writing to Last.fm goes through your proxy: it must forward POST requests. |
| `settings.scrobble.queue` | Coda di invio | Send queue |
| `settings.scrobble.queuePending` | In attesa | Pending |
| `settings.scrobble.queueInFlight` | In corso | In flight |
| `settings.scrobble.queueSent` | Inviati | Sent |
| `settings.scrobble.queueFailed` | Falliti | Failed |
| `settings.scrobble.queueEmpty` | La coda è vuota | The queue is empty |
| `settings.scrobble.sendNow` | Invia ora | Send now |
| `settings.scrobble.sending` | Invio in corso... | Sending... |
| `settings.scrobble.sent_one` | {{count}} ascolto in coda | {{count}} listen queued |
| `settings.scrobble.sent_other` | {{count}} ascolti in coda | {{count}} listens queued |
| `settings.scrobble.noHubSelected` | Nessun hub selezionato: nessun invio partirà | No hub selected: nothing will be sent |
| `settings.scrobble.save` | Salva | Save |
| `settings.scrobble.saved` | Configurazione salvata su questo dispositivo | Configuration saved on this device |

**Pluralizzazione**: `settings.scrobble.sent` ha le varianti `_one`/`_other`
(§3).

### 2.12g `settings.lastfm.auth*` (Story 1.5 — percorso web auth)

Il **web auth** di Last.fm (D-LF.2) è l'unico percorso che produce una
**session key**: l'utente autorizza nel browser e incolla l'indirizzo di
callback, dal quale l'app estrae il token e lo scambia in `sk`. Le stringhe
sono nel namespace `settings`, accanto alle altre chiavi del pannello Last.fm.

| Key | IT | EN |
|-----|----|----|
| `settings.lastfm.sharedSecret` | Shared secret (per la firma delle richieste) | Shared secret (to sign the requests) |
| `settings.lastfm.auth` | Autorizza la scrittura su Last.fm | Authorize writing to Last.fm |
| `settings.lastfm.authHint` | Apri la pagina di autorizzazione, accetta, poi incolla qui l\'indirizzo della pagina a cui sei stato reindirizzato: la chiave di sessione resta su questo dispositivo. | Open the authorization page, accept, then paste here the address of the page you were redirected to: the session key stays on this device. |
| `settings.lastfm.authCallback` | Indirizzo di callback | Callback address |
| `settings.lastfm.authConnect` | Collega la sessione | Connect the session |
| `settings.lastfm.authSaved` | Sessione autorizzata: la scrittura su Last.fm è abilitata | Session authorized: writing to Last.fm is enabled |
| `settings.lastfm.authMissingToken` | Nell\'indirizzo incollato non c\'è un token: copia l\'intero indirizzo della pagina di reindirizzamento | There is no token in the pasted address: copy the whole redirect page address |

### 2.17 `enrichment.*` (Story 4.1 — spec `21-AUDIO-FEATURES.md` §14)

Namespace della pipeline delle **audio features**. Le **otto chiavi** sono
**vincolanti** (spec ratificata in v1.0 🟢): la coppia chiave → stato della
pipeline è decisa dalla spec, non dalla UI.

| Key | IT | EN |
|-----|----|----|
| `enrichment.status.queued` | In coda | In the queue |
| `enrichment.status.analyzing` | In analisi | Analyzing |
| `enrichment.status.done` | Fatto ({source}) | Done ({source}) |
| `enrichment.status.estimated` | Fatto, ma è una stima | Done, but it's an estimate |
| `enrichment.status.no_audio` | Nessun audio disponibile | No audio available |
| `enrichment.status.disabled` | Arricchimento spento | Enrichment is off |
| `enrichment.download.size` | L'analisi acustica scarica ~6 MB, una volta sola. Vuoi continuare? | Acoustic analysis downloads ~6 MB, once. Do you want to continue? |
| `enrichment.error.aggregate` | {count, plural, one {Un brano non è stato analizzato} other {# brani non sono stati analizzati}} | {count, plural, one {One track could not be analyzed} other {# tracks could not be analyzed}} |

**Pluralizzazione**: `enrichment.error.aggregate` segue §3
(`{count, plural, one {…} other {…}}`).

**Parametri**: `{source}` = il nome della fonte della feature (`Essentia`,
`AcousticBrainz`, `manuale`); `{count}` = il numero di brani non analizzati
nell'avviso aggregato di `06§5`.

**Il confine "stima ≠ misura"**: `enrichment.status.estimated` è l'unica chiave
che può descrivere una feature **euristica**; le altre descrivono una feature
**misurata** o **derivata**. Il testo dell'euristico non usa mai la parola
"analizzato" (`21§12`, D-AF.4): la stima non è un'analisi, e la UI non deve
farla sembrare tale.

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
| 0.2 | Sessione 9 (2026-10-15) | Audit: rimosse `privacy.stats`/`privacy.statsDesc` (D.A.1, rinviate a Fase 2); aggiunte `privacy.carDetection` e `privacy.syncCloud` (02 v1.1); aggiunte `insight.disclaimer` e `insight.disclaimerShort` (C9); aggiunta `adapter.spotify.warn.offlineConverted` (M2); `fileTooLarge` portato a 500MB per coerenza con 06§2.3 (M3) |
| 0.3 | Sessione 47 (2026-10-26, issue #145) | Aggiunta §2.12c `adapter.listenbrainz.*` (12 chiavi, spec `03-ADAPTERS/listenbrainz.md` §9). Le varianti `_one`/`_other` seguono la convenzione i18n per i conteggi (stesso pattern di `adapter.spotify.*` e `adapter.youtube_music.*`) |
| 0.4 | Sessione 52 (2026-10-26, issue #155) | **Materializzazione** delle chiavi della Story 1.3: `adapter.listenbrainz.*` (§2.12c) e `adapter.lastfm.*` (§2.12d, 14 chiavi) sono ora nei locale `it`/`en` dell'app; aggiunta §2.12e `settings.lastfm.*` (11 chiavi) per il pannello di configurazione del proxy. I nomi delle chiavi nel materializzato sono **completti** (`adapter.listenbrainz.detect.success`): le tabelle delle sezioni omettono il prefisso `adapter.` come le altre (§2.12a/§2.12b) |
| 0.5 | Sessione 57 (2026-10-27, issue #172) | **Story 1.5 — namespace `scrobble.*`**: §1 (tabella dei namespace) e **§2.16 (nuova)**, i **15 codici** della spec `20-SCROBBLING-HUB.md` §13.2 (ratificata in v1.0 🟢), con i testi IT ed EN. La coppia codice → caso d'uso è **vincolante**: la mappa `ScrobbleError` (`05§4.2`) decide quale codice compare in quale situazione. Nota sulla pluralizzazione delle quattro stringhe con `{count}` (§3). Header allineato (era fermo a v0.2 dal Sessione 9, mentre il changelog era già alla 0.4) |
| 0.6 | Sessione 58 (2026-10-28, issue #173) | **Story 1.5 — UI del percorso di scrittura**: §2.12f (nuova) le chiavi di interfaccia del pannello scrobbling (`settings.scrobble.*`: selettore per-hub, modalità del proxy, vista della coda) e §2.12g (nuova) le chiavi del percorso **web auth** Last.fm (`settings.lastfm.auth*`). Il namespace `scrobble` di §2.16 (i 15 codici di errore e avviso) è stato **materializzato** nei locale `it`/`en` dell'app, con le varianti `_one`/`_other` per le quattro stringhe con `{count}` |
| 0.7 | Sessione 59 (2026-10-28, issue #178) | **§2.15 `insight.*` — i template dei ricordi** (`memory.onThisDay`, `memory.firstTime`, `memory.milestone.*`, `memory.return`, `memory.seasonal`, `memory.disclaimer*`): la ratifica di `04-ANALYSIS-ALGORITHMS.md` (v1.0 🟢 APPROVED) li dichiara **vincolanti** (D-A.4). Riga di changelog mancante: la modifica c'era (Sessione 59) ma il header e la tabella erano rimasti a **v0.6** — il drift è stato corretto dalla Sessione 62 (issue #187) |
| 0.8 | Sessione 62 (2026-10-28, issue #187) | **§2.17 `enrichment.*` (nuova) — Story 4.1**: le **otto chiavi** della pipeline audio features elencate da `21-AUDIO-FEATURES.md` §14, con i testi IT ed EN: gli stati della pipeline (`queued`, `analyzing`, `done`, `estimated`, `no_audio`, `disabled`), l'avviso **prima** del download del WASM (`download.size`, ~6 MB una volta sola) e l'avviso aggregato in Settings (`error.aggregate`, con pluralizzazione §3). §1: il namespace `enrichment` aggiunto alla tabella dei namespace. Il **confine "stima ≠ misura"** è dichiarato nei testi: `enrichment.status.estimated` è l'unica chiave che può descrivere una feature euristica e non usa mai la parola "analizzato" (`21§12`, D-AF.4). Header allineato (era fermo a **v0.6** dal Sessione 58, mentre il changelog era già alla 0.5 e `docs/INDEX.md` dichiarava v0.7) |
| 0.9 | Sessione 67 (2026-10-30, issue #201) | **Story 1.6 ratificata** (`19-GEO-CONTEXT.md` v1.0 🟢 APPROVED): §2.9 — aggiunte le chiavi dei toggle `retainCountry`, `retainCity`, `retainDeviceType`, `retainDeviceDetail`, `deriveContext` (namespace `settings.privacy.*`, già previsto da `19§8.3`); nuova sezione §2.12h `timeline.context.*` (nastro contesto e dettaglio del periodo, `19§8.2-8.3`), con la regola di linguaggio vincolante: **la città è sempre introdotta da un indicatore di incertezza, il paese mai**. |
| 0.10 | Sessione 69 (2026-10-31, issue #211) | **Story 2.2 — l'etichetta dell'era**: §2.15 — aggiunte le **otto chiavi** `insight.era.*` (il template `label` e i **sei** nomi dei mood, `sad`/`angry`/`neutral`/`calm`/`happy`/`excited`), materializzate nei locale `it`/`en` dell'app. `EraPayload.label` (`02§4`) è una **stringa resa**, come il `text` del ricordo (D-A.4): il core non contiene stringhe italiane, l'app inietta il resolver. §2.4 — `era.title` diventa un **pass-through** (`{label}`): l'etichetta contiene già il prefisso «Era» (`02§4`, `04§5.2`), e anteporlo produrrebbe «Era Era Malinconia Indie». Il **genere** non viene tradotto: è dato, non copia |
| 0.11 | Sessione 70 (2026-10-31, issue #214) | **Story 2.3 — la descrizione dell'evento**: §2.15 — la `description` di `EventPayload` (`02§4`) è una **stringa resa**, come il ricordo e l'etichetta dell'era: il core non contiene stringhe italiane, l'app inietta il resolver. Aggiunta la chiave **`insight.event.spike_genre`** (l'unica dei otto tipi che mancava: `{{genre}}`), materializzata nei locale `it`/`en`. I template di `event.*` accettano due segnaposto, `{{artist}}` (il nome dell'artista che domina) e `{{genre}}` (il genere che domina — **dato**, non copia, e non tradotto). La descrizione è seguita dal **suffisso numerico** del detector: `(z-score: 4.00)` per il detector a z-score, `(×2.40)` per quello a quota — neutro, è il dato che rende l'evento verificabile |
