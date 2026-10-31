# 04 — Algoritmi di Analisi

> Status: 🟢 APPROVED · Versione 1.3 · Sessione 59 (2026-10-28), emendata nella Sessione 65 (2026-10-30), aggiornata nelle Sessioni 69 (2026-10-31) e 70 (2026-10-31)
> Vincolante per: `packages/core/analysis/*` e relativi test
> Issue di ratifica: #178 (decisioni D-A.1…D-A.5, §11) · Emendamento: #193 (D-A.6, §11.1) · Storie sbloccate: 2.4 (subito), 2.1 (dopo l'EPIC 4.1, §12) · Implementazioni: 2.4 (Sessione 61), 2.1 (Sessione 63), 2.2 (Sessione 69, issue #211), 2.3 (Sessione 70, issue #214)

---

## 1. Principi generali

### 1.1 Derivati versionati

Ogni insight/sessione salvati nel DB porta un campo `derivedVersion`: stringa esadecimale (8 char) calcolata come:

    derivedVersion = sha1(JSON.stringify(configObject)).slice(0, 8)

dove `configObject` contiene tutti i parametri dell'algoritmo (threshold, window, weights). **Quando i parametri cambiano, cambia la versione**: gli insight vecchi diventano `stale` e vengono ricalcolati al prossimo avvio.

### 1.2 Incrementalità

Tutti gli algoritmi devono essere **incrementali**: dato lo stato precedente + nuovi eventi, aggiornare lo stato senza ricalcolare tutto. Serve per non bloccare l'UI durante import di file grandi.

### 1.3 Persistenza

| Entità | Tabella | Aggiornato |
|--------|---------|------------|
| `ListeningSession` | `sessions` | Ad ogni nuovo evento (estende o chiude sessione) |
| `Insight` (mood) | `insights` type=mood_day/week/month | Fine giornata/settimana/mese |
| `Insight` (era) | `insights` type=era | Ad ogni nuova sessione |
| `Insight` (event) | `insights` type=event | Quando viene rilevata anomalia |
| `Insight` (memory) | `insights` type=memory | Generato giornalmente |
| `Insight` (pattern) | `insights` type=pattern | Su richiesta / periodicamente |

### 1.4 Degradazione graziosa

Se mancano `AudioFeatures` **misurate o manuali** (valence/energy null), l'algoritmo:
- Non produce insight basati su mood (salta)
- **Non** usa `genre` come proxy: **non esiste** un mapping
  genre→valence/energy ratificato, e inventarlo sarebbe il "segnale inventato"
  che la D-A.1 esclude (§11). La decisione è la **D-A.6** (§11.1, issue #193)
- Logga un warning **aggregato per periodo**: "X eventi senza audio features",
  dove X è il numero di eventi del periodo senza feature misurata o manuale.
  Il warning non porta dati personali: solo periodo e conteggi

Sotto la soglia `minEventsPerPeriod` (§3.4) il periodo non produce insight:
è il comportamento prescritto da §3.3, non una lacuna. La `confidence`
dell'insight (§3, D.63.8) dice quanto del periodo il mood copre.

### 1.5 Tabella config → derivedVersion

| Algoritmo | Config chiave | Versione iniziale |
|-----------|---------------|-------------------|
| Session segmentation | `gapThresholdMs` | `v1.0` |
| Mood tracker | `{weights, moodThresholds}` | `v1.0` |
| Pattern analyzer | `bucketSize` | `v1.0` |
| Era detector | `windowDays`, `kMin`, `kMax`, `similarityThreshold` | `v1.0` |
| Event detector | `zScoreThreshold`, `windowDays`, `baselineDays` | `v1.0` |
| Memory engine | `thresholds` per ogni tipo | `v1.0` |

> I parametri effettivi e i loro default sono in §7.3 (memory engine) e §3.4
> (mood tracker): questa tabella è il **registro** (quali parametri ciascun
> algoritmo versiona), non la loro specifica.

---

## 2. Session Segmentation

### 2.1 Scopo

Dividere la sequenza cronologica di `ListenEvent` in **sessioni di ascolto continue**: una sessione è una sequenza di eventi dove ogni evento inizia entro `gapThresholdMs` dalla fine del precedente.

### 2.2 Algoritmo

**Input**: array `events` ordinato per `startedAt` crescente
**Output**: array `sessions` di `ListeningSession`

    gapThresholdMs = 30 * 60 * 1000  // 30 minuti default

    function segmentSessions(events):
      sessions = []
      current = null
      prevEndTime = -infinity

      for event in events:
        gap = event.startedAt - prevEndTime

        if current == null OR gap > gapThresholdMs:
          if current != null:
            finalize(current)
            sessions.push(current)
          current = newSession(event)
        else:
          extend(current, event)

        prevEndTime = event.timestamp  // fine ascolto

      if current != null:
        finalize(current)
        sessions.push(current)

      return sessions

    function newSession(event):
      return {
        startTime: event.startedAt,
        endTime: event.timestamp,
        events: [event.id],
        tracks: new Set([event.trackId]),
        platform: event.platform,
        deviceType: event.deviceType
      }

    function extend(session, event):
      session.endTime = max(session.endTime, event.timestamp)
      session.events.push(event.id)
      session.tracks.add(event.trackId)

    function finalize(session):
      session.durationMs = session.endTime - session.startTime
      session.eventCount = session.events.length
      session.trackCount = session.tracks.size
      session.gapThresholdMs = gapThresholdMs
      session.derivedVersion = sha1({gapThresholdMs}).slice(0,8)
      session.id = uuid()

### 2.3 Parametri

| Parametro | Default | Range | Note |
|-----------|---------|-------|------|
| `gapThresholdMs` | 1.800.000 (30 min) | 300.000 - 7.200.000 | Utente può personalizzare |

### 2.4 Esempio numerico

Input (3 eventi):
- E1: 10:00-10:05 (Brano A)
- E2: 10:07-10:12 (Brano B)
- E3: 11:30-11:35 (Brano C)

Gap E1→E2: 2 min < 30 min → stessa sessione
Gap E2→E3: 78 min > 30 min → nuova sessione

Output: 2 sessioni (S1: 30 min, 3 eventi, 2 track; S2: 5 min, 1 evento, 1 track)

### 2.5 Invarianti testabili

- ∀ session: `durationMs ≥ 0`
- ∀ session: `eventCount ≥ 1`
- ∀ session: `trackCount ≤ eventCount`
- ∀ session: `startTime ≤ endTime`
- Sum(session.durationMs) ≤ total listening time + (n-1) × gapThresholdMs

---

## 3. Mood Tracker

### 3.1 Scopo

Calcolare il **mood dominante** di un periodo (giorno/settimana/mese) come uno dei 6 valori: `sad | angry | neutral | calm | happy | excited`.

### 3.2 Mappatura valence/energy → mood

Il quadrante è definito da due soglie:

    valenceThreshold = 0.5
    energyThreshold = 0.5

| Valence | Energy | Mood |
|---------|--------|------|
| < 0.5 | < 0.5 | sad |
| < 0.5 | ≥ 0.5 | angry |
| [0.4, 0.6] | [0.4, 0.6] | neutral |
| ≥ 0.5 | < 0.5 | calm |
| ≥ 0.5 | [0.5, 0.75) | happy |
| ≥ 0.5 | ≥ 0.75 | excited |

Note:
- `neutral` è una **fascia centrale** (non un punto) per evitare flip-flop
- `neutral` sovrascrive `sad`/`angry`/`calm`/`happy` se entrambe le coordinate sono nella fascia [0.4, 0.6]
- `excited` richiede valence ALTA (≥0.5) E energy MOLTO ALTA (≥0.75)

### 3.3 Mood di periodo

**Input**: tutti i `ListenEvent` in un periodo (giorno/settimana/mese) con `AudioFeatures` disponibili
**Output**: `MoodPeriodPayload`

    function computeMoodForPeriod(events, periodStart, periodEnd):
      valences = []
      energies = []

      for e in events:
        af = getAudioFeatures(e.trackId)
        if af.valence != null:
          weight = e.durationMs / 240000  // peso = durata / 4 min
          valences.push({val: af.valence, weight})
          energies.push({val: af.energy, weight})

      if valences.length < 3:
        return null  // insufficient data

      avgValence = weightedAverage(valences)
      avgEnergy = weightedAverage(energies)
      mood = classifyMood(avgValence, avgEnergy)

      return {
        kind: 'mood',
        mood,
        avgValence,
        avgEnergy,
        eventCount: events.length
      }

    function weightedAverage(items):
      sum = items.reduce((acc, x) => acc + x.val * x.weight, 0)
      weightSum = items.reduce((acc, x) => acc + x.weight, 0)
      return sum / weightSum

    function classifyMood(v, e):
      if v >= 0.4 AND v <= 0.6 AND e >= 0.4 AND e <= 0.6:
        return 'neutral'
      if v >= 0.5 AND e >= 0.75:
        return 'excited'
      if v >= 0.5 AND e >= 0.5:
        return 'happy'
      if v >= 0.5 AND e < 0.5:
        return 'calm'
      if v < 0.5 AND e < 0.5:
        return 'sad'
      if v < 0.5 AND e >= 0.5:
        return 'angry'

### 3.4 Parametri

| Parametro | Default | Note |
|-----------|---------|------|
| `valenceThreshold` | 0.5 | Centro quadrante |
| `energyThreshold` | 0.5 | Centro quadrante |
| `neutralBand` | 0.1 | Fascia neutra ± |
| `excitedEnergyThreshold` | 0.75 | Per excited serve energy alta |
| `minEventsPerPeriod` | 3 | Sotto questo soglia → no insight |

### 3.5 Esempio numerico

Periodo: lunedì (5 eventi)
- Brano A: valence 0.3, energy 0.4, durata 200s → weight 0.83
- Brano B: valence 0.7, energy 0.8, durata 240s → weight 1.0
- Brano C: valence 0.4, energy 0.6, durata 180s → weight 0.75
- Brano D: valence 0.8, energy 0.9, durata 300s → weight 1.25
- Brano E: valence 0.5, energy 0.5, durata 220s → weight 0.92

Weighted avg valence: (0.3·0.83 + 0.7·1.0 + 0.4·0.75 + 0.8·1.25 + 0.5·0.92) / 4.75 ≈ 0.570
Weighted avg energy: (0.4·0.83 + 0.8·1.0 + 0.6·0.75 + 0.9·1.25 + 0.5·0.92) / 4.75 ≈ 0.667

Classify: valence ≥ 0.5, energy in [0.5, 0.75) → **happy**

### 3.6 Invarianti

- `mood ∈ {sad, angry, neutral, calm, happy, excited}`
- `avgValence ∈ [0, 1]`
- `avgEnergy ∈ [0, 1]`
- Se tutti gli eventi hanno lo stesso (v, e), mood = classifyMood(v, e)

---

## 4. Pattern Analyzer

### 4.1 Scopo

Rilevare pattern ricorrenti negli ascolti: **circadiano** (ora del giorno), **settimanale** (giorno della settimana), **stagionale** (mese dell'anno).

### 4.2 Algoritmo

Per ogni tipo di pattern, distribuire gli eventi in bucket e calcolare quote.

    function computeCircadianPattern(events, userTimezone):
      buckets = {0..23: 0}  // ore
      total = 0
      for e in events:
        hour = hourOf(e.startedAt, userTimezone)
        buckets[hour] += e.durationMs
        total += e.durationMs

      normalizedBuckets = {h: buckets[h] / total for h in 0..23}
      peakHour = argmax(buckets)
      nightShare = sum(buckets[h] for h in [0,1,2,3,4,5]) / total

      return {
        kind: 'pattern',
        patternType: 'circadian',
        buckets: normalizedBuckets,
        peakHour,
        peakDay: null,            // non applicabile (circadian = ore)
        peakMonth: null,          // non applicabile
        nightShare,
        weekendShare: null,      // non applicabile
        userTimezone
      }

    function computeWeeklyPattern(events, userTimezone):
      buckets = {Mon..Sun: 0}
      total = 0
      for e in events:
        day = dayOfWeek(e.startedAt, userTimezone)  // 0=Sun..6=Sat
        buckets[day] += e.durationMs
        total += e.durationMs

      normalizedBuckets = {d: buckets[d] / total for d in 0..6}
      peakDay = argmax(buckets)
      weekendShare = (buckets[0] + buckets[6]) / total  // Sun + Sat

      return {
        kind: 'pattern',
        patternType: 'weekly',
        buckets: normalizedBuckets,
        peakHour: null,           // non applicabile
        peakDay,
        peakMonth: null,          // non applicabile
        nightShare: null,         // non applicabile
        weekendShare,
        userTimezone
      }

    function computeSeasonalPattern(events, userTimezone):
      buckets = {Jan..Dec: 0}
      total = 0
      for e in events:
        month = monthOf(e.startedAt, userTimezone)  // 1..12
        buckets[month] += e.durationMs
        total += e.durationMs

      normalizedBuckets = {m: buckets[m] / total for m in 1..12}
      peakMonth = argmax(buckets)

      return {
        kind: 'pattern',
        patternType: 'seasonal',
        buckets: normalizedBuckets,
        peakHour: null,           // non applicabile
        peakDay: null,            // non applicabile
        peakMonth,
        nightShare: null,         // non applicabile
        weekendShare: null,       // non applicabile
        userTimezone
      }

### 4.3 Metriche derivate

- **peakHour / peakDay / peakMonth**: bucket con quota massima
- **nightShare**: quota ascolti notturni (00:00-05:59) — usata in Era detector
- **weekendShare**: quota sab+dom su totale
- **seasonalEntropy**: quanto è distribuito (bassa = ascolti concentrati in pochi mesi)

### 4.4 Parametri

| Parametro | Default |
|-----------|---------|
| `nightHours` | [0, 1, 2, 3, 4, 5] |
| `weekendDays` | ['Sat', 'Sun'] |
| `minEvents` | 50 (altrimenti pattern non affidabile) |

### 4.5 Invarianti

- `sum(buckets.values) ≈ 1.0` (tolleranza 0.01)
- `nightShare ∈ [0, 1]` se definito, altrimenti `null`
- `weekendShare ∈ [0, 1]` se definito, altrimenti `null`
- `peakHour ∈ 0..23` se definito, altrimenti `null`
- `peakDay ∈ 0..6` se definito, altrimenti `null` (0=Sun, 6=Sat)
- `peakMonth ∈ 1..12` se definito, altrimenti `null`
- `userTimezone` è sempre valorizzato (IANA tz string, es. `Europe/Rome`)
- Campi non applicabili al `patternType` sono `null` (vedi implementazione §4.2)

---

## 5. Era Detector

### 5.1 Scopo

Identificare **ere musicali**: periodi prolungati (≥14 giorni) con caratteristiche coerenti, separati da cambiamenti significativi.

### 5.2 Algoritmo — Sliding window + change point detection

Approccio: calcolare una "firma musicale" per finestre settimanali, rilevare i punti di cambio significativi.

    windowDays = 14
    stepDays = 7
    similarityThreshold = 0.65
    minEraDays = 14

    function detectEras(events, sessions):
      // 1. Calcola firme settimanali
      signatures = computeWeeklySignatures(events, windowDays, stepDays)

      // 2. Rileva change points
      changePoints = detectChangePoints(signatures, similarityThreshold)

      // 3. Costruisci ere dai change points
      eras = buildEras(changePoints, events, minEraDays)

      // 4. Filtra ere troppo corte
      return eras.filter(e => daysBetween(e.start, e.end) >= minEraDays)

    function computeWeeklySignatures(events, windowDays, stepDays):
      signatures = []
      start = events[0].startedAt
      end = events.last().timestamp

      cursor = start
      while cursor < end:
        windowEnd = cursor + windowDays * 86400000
        windowEvents = events.filter(e => e.startedAt >= cursor AND e.startedAt < windowEnd)

        if windowEvents.length >= 5:
          signature = computeSignature(windowEvents)
          signatures.push({start: cursor, end: windowEnd, signature})

        cursor += stepDays * 86400000

      return signatures

    function computeSignature(events):
      // Vettore multidimensionale
      genreDistribution = computeGenreDistribution(events)  // {rock: 0.3, pop: 0.4, ...}
      topArtists = topN(events.groupBy(track.artistId), 5)    // [id1, id2, ...]
      avgValence = computeWeightedAvg(events, 'valence')
      avgEnergy = computeWeightedAvg(events, 'energy')
      nightShare = computeNightShare(events)
      repeatRate = computeRepeatRate(events)

      return {
        genreDistribution,
        topArtists,
        avgValence,
        avgEnergy,
        nightShare,
        repeatRate
      }

    function similarity(sig1, sig2):
      // Cosine similarity su generi + overlap Jaccard su topArtist + distanza normalizzata su valence/energy/nightShare/repeatRate
      genreSim = cosineSimilarity(sig1.genreDistribution, sig2.genreDistribution)
      artistSim = jaccard(sig1.topArtists, sig2.topArtists)
      numericSim = 1 - (
        abs(sig1.avgValence - sig2.avgValence) +
        abs(sig1.avgEnergy - sig2.avgEnergy) +
        abs(sig1.nightShare - sig2.nightShare) +
        abs(sig1.repeatRate - sig2.repeatRate)
      ) / 4

      return 0.5 * genreSim + 0.3 * artistSim + 0.2 * numericSim

    function detectChangePoints(signatures, threshold):
      changePoints = []
      for i in 1..signatures.length-1:
        sim = similarity(signatures[i-1].signature, signatures[i].signature)
        if sim < threshold:
          changePoints.push(signatures[i].start)
      return changePoints

    function buildEras(changePoints, events, minEraDays):
      boundaries = [events[0].startedAt, ...changePoints, events.last().timestamp]
      eras = []
      for i in 0..boundaries.length-2:
        start = boundaries[i]
        end = boundaries[i+1]
        eraEvents = events.filter(e => e.startedAt >= start AND e.startedAt < end)
        signature = computeSignature(eraEvents)
        mood = classifyMood(signature.avgValence, signature.avgEnergy)
        label = generateEraLabel(mood, signature)
        eras.push({
          periodStart: start,
          periodEnd: end,
          payload: {
            kind: 'era',
            label,
            moodDominant: mood,
            topArtistIds: signature.topArtists,
            topTrackIds: topN(eraEvents.groupBy(trackId), 5),
            genreDistribution: signature.genreDistribution,
            avgValence: signature.avgValence,
            avgEnergy: signature.avgEnergy,
            nightShare: signature.nightShare,
            repeatRate: signature.repeatRate
          },
          confidence: computeEraConfidence(eraEvents, signature)
        })
      return eras

    function generateEraLabel(mood, signature):
      topGenre = argmax(signature.genreDistribution)
      moodNames = {
        sad: 'Malinconia', angry: 'Rabbia', neutral: 'Neutro',
        calm: 'Calma', happy: 'Felicità', excited: 'Energia'
      }
      return "Era " + moodNames[mood] + " " + topGenre  // es. "Era Malinconia Indie"

### 5.3 Parametri

| Parametro | Default | Range | Note |
|-----------|---------|-------|------|
| `windowDays` | 14 | 7-30 | Finestra analisi |
| `stepDays` | 7 | 3-14 | Passo scorrimento |
| `similarityThreshold` | 0.65 | 0.5-0.8 | Sotto → change point |
| `minEraDays` | 14 | 7-30 | Sotto → scartata |
| `minEventsPerWindow` | 5 | 3-10 | Sotto → finestra invalida |
| `weights.genre` | 0.5 | | Peso similarity |
| `weights.artist` | 0.3 | | |
| `weights.numeric` | 0.2 | | |

### 5.4 Esempio numerico

30 settimane di ascolto, con cambio netto alla settimana 12 (da pop a indie folk).

- Settimane 1-11: signature simile (cosine genre 0.9, Jaccard artist 0.7)
- Settimane 12-30: signature simile interna, ma similarity con settimana 11 = 0.4 (< 0.65)

Output: 2 ere separate al confine settimana 11/12.

### 5.5 Invarianti

- Ere sono **disgiunte e coprenti**: ∪ere = periodo totale, ∩ere = ∅
- `era.periodStart < era.periodEnd`
- `sum(genreDistribution.values) ≈ 1.0`
- `moodDominant ∈ {sad, angry, neutral, calm, happy, excited}`

---

## 6. Event Detector

### 6.1 Scopo

Rilevare **anomalie significative** nei pattern di ascolto che suggeriscono eventi di vita (non solo variazioni naturali).

### 6.2 Tipi di evento

| Tipo | Descrizione | Trigger |
|------|-------------|---------|
| `spike_artist` | Picco improvviso di un artista | quota artista > 2× baseline |
| `spike_genre` | Picco improvviso di un genere | quota genere > 2× baseline |
| `valence_drop` | Crollo emotivo | Δvalence > 0.25 su 14gg |
| `valence_rise` | Risalita emotiva | Δvalence > 0.25 su 14gg |
| `volume_spike` | Esplosione di ascolto | durata > 2× baseline |
| `volume_drop` | Silenzio prolungato | durata < 0.3× baseline per ≥7gg |
| `exploration` | Esplorazione intensa | ≥10 artisti nuovi in 7gg |
| `silence` | Periodo di non-ascolto | ≥3 giorni senza eventi |

### 6.3 Algoritmo generico (z-score)

    baselineDays = 60
    windowDays = 14
    zScoreThreshold = 2.0

    function detectEvents(events):
      dailyMetrics = computeDailyMetrics(events)  // {day: {volume, valence, energy, diversity, newArtists}}

      events_detected = []
      cursor = earliestDay + baselineDays

      while cursor <= latestDay:
        baseline = dailyMetrics[cursor - baselineDays .. cursor]
        window = dailyMetrics[cursor .. cursor + windowDays]

        for metric in ['volume', 'valence', 'diversity']:
          mean, std = stats(baseline[metric])
          if std == 0: continue
          windowMean = avg(window[metric])
          z = (windowMean - mean) / std

          if abs(z) > zScoreThreshold:
            eventType = metricToEventType(metric, sign(z))
            events_detected.push({
              type: 'event',
              eventType,
              periodStart: cursor,
              periodEnd: cursor + windowDays,
              payload: {
                kind: 'event',
                eventType,
                description: generateDescription(eventType, z, metric),
                metrics: {z, baseline_mean: mean, window_mean: windowMean}
              },
              confidence: min(1, abs(z) / 4)
            })

        cursor += 7 days  // stride settimanale

      return dedupeOverlapping(events_detected)

    function generateDescription(eventType, z, metric):
      templates = {
        spike_artist: "Hai scoperto un nuovo artista che ha dominato il tuo ascolto",
        valence_drop: "La tua musica è diventata più malinconica",
        valence_rise: "La tua musica è diventata più allegra",
        volume_spike: "Hai ascoltato molta più musica del solito",
        volume_drop: "Hai ascoltato molta meno musica del solito",
        exploration: "Hai esplorato molti nuovi artisti",
        silence: "Periodo di silenzio musicale"
      }
      return templates[eventType] + " (z-score: " + z.toFixed(2) + ")"

### 6.4 Rilevatori specializzati (oltre z-score)

**silence detector**:

    function detectSilence(events):
      sorted = events.sortBy(startedAt)
      silences = []
      for i in 1..sorted.length-1:
        gap = sorted[i].startedAt - sorted[i-1].timestamp
        if gap >= 3 * 86400000:  // ≥ 3 giorni
          silences.push({
            periodStart: sorted[i-1].timestamp,
            periodEnd: sorted[i].startedAt,
            eventType: 'silence',
            durationDays: gap / 86400000
          })
      return silences

**exploration detector**:

    function detectExploration(events):
      // 7-day windows, count distinct new artists (mai ascoltati prima)
      ...
      // trigger: ≥10 nuovi artisti in 7 giorni

### 6.5 Parametri

| Parametro | Default |
|-----------|---------|
| `baselineDays` | 60 |
| `windowDays` | 14 |
| `zScoreThreshold` | 2.0 |
| `silenceMinDays` | 3 |
| `explorationMinNewArtists` | 10 |
| `strideDays` | 7 |

### 6.6 Esempio numerico

Baseline 60gg: avg volume 3h/giorno, std 1h
Window 14gg: avg volume 7h/giorno

z = (7 - 3) / 1 = 4.0 > 2.0 → **volume_spike** rilevato con confidence min(1, 4/4) = 1.0

### 6.7 Invarianti

- `confidence ∈ [0, 1]`
- `eventType ∈ enum definito`
- Eventi non sovrapposti (dedupe mantiene solo quello con confidence più alta)
- `periodStart < periodEnd`

### 6.8 Scelte di implementazione (Story 2.3)

Il testo dell'algoritmo (§6.2-§6.6) **non cambia**: le scelte che la spec
non esplicita sono dichiarate in `docs/state/sessions/70-event-detector.md`
(D.70.1…D.70.8) e in `docs/state/stories/2.3-event-detector.md`. In sintesi:

- **la baseline e la finestra non si sovrappongono**: la finestra è
  `[cursor, cursor + windowDays)` e la baseline i `baselineDays` giorni
  immediatamente precedenti (D.70.1);
- **la finestra deve essere completa**: l'ultima finestra utile è quella che
  finisce entro l'ultimo giorno osservato — una finestra troncata ha meno
  giorni e produrrebbe un `volume_drop` sistematico (D.70.3);
- **un giorno senza ascolti non è un giorno a volume zero**: il volume
  misura «quanto hai ascolto nei giorni in cui hai ascoltato», e i buchi
  sono il segnale del detector di silenzio (D.70.5);
- **la deviazione standard è popolazionale** (÷N): la baseline è
  l'intera popolazione dei giorni osservati (D.70.4);
- **il dedupe è per tipo e per soggetto**: due eventi dello stesso tipo (e
  dello stesso artista o genere) che si sovrappongono sono lo stesso evento
  visto da due finestre diverse; due eventi di **tipi diversi** sulla stessa
  finestra coesistono (D.70.8);
- **il detector a quota ha due condizioni**: la **dominanza** (la quota del
  soggetto supera `minDominantShare`) e il **picco** (la quota supera 2× la
  quota in baseline) — il rapporto è definito rispetto alla soglia di
  dominanza quando il soggetto è assente in baseline, così è sempre finito
  (D.70.2, D.70.6);
- **la finestra dell'esplorazione è lunga `strideDays` giorni** (7 per
  default, come i «7gg» di §6.2) ed è allineata alla stessa griglia degli
  altri detector (D.70.7).

---

## 7. Memory Engine

### 7.1 Scopo

Generare **ricordi** giornalieri basati su 5 tipologie.

### 7.2 Tipologie e trigger

#### `on_this_day`

Trigger: esiste almeno un evento nella stessa data (mese+giorno) di `N` anni fa, con N ∈ {1, 2, 3, 5, 10}.

    function generateOnThisDay(today, events):
      memories = []
      for yearsAgo in [1, 2, 3, 5, 10]:
        targetDate = subtractYears(today, yearsAgo)
        eventsOnDate = events.filter(e => isSameDayMonth(e.startedAt, targetDate))
        if eventsOnDate.length > 0:
          topTrack = topByCount(eventsOnDate.groupBy(trackId))[0]
          memories.push({
            memoryKind: 'on_this_day',
            yearsAgo,
            trackId: topTrack.id,
            artistId: topTrack.artistId,
            text: t('memory.on_this_day', { years: yearsAgo, track: topTrack.name, artist: topTrack.artist })
          })
      return memories

#### `first_time`

Trigger: oggi è l'anniversario del primo ascolto di un artista significativo (**≥5 brani distinti**, D-A.3: l'AC della Story 2.4 dice "brani", non "ascolti").

    function generateFirstTime(today, events):
      artistFirstListen = events.groupBy(artistId).map(artist => artist.min(startedAt))
      memories = []
      for artistId, firstDate in artistFirstListen:
        yearsAgo = yearsBetween(firstDate, today)
        if yearsAgo >= 1 AND isSameDayMonth(firstDate, today):
          artistEvents = events.filter(e => e.track.artistId == artistId)
          distinctTracks = distinct(artistEvents.map(e => e.trackId)).length
          if distinctTracks >= firstTimeMinTracks:
            memories.push({
              memoryKind: 'first_time',
              yearsAgo,
              artistId,
              text: t('memory.first_time', { years: yearsAgo, artist })
            })
      return memories

#### `milestone`

Trigger: raggiungimento di soglie cumulative (1000, 5000, 10000, 50000, 100000 eventi; 100, 500, 1000 ore; 100, 500 artisti unici).

    function generateMilestone(today, events):
      milestones = [1000, 5000, 10000, 50000, 100000]
      totalCount = events.length
      memories = []
      for m in milestones:
        if totalCount == m:
          memories.push({
            memoryKind: 'milestone',
            text: `Hai raggiunto ${m} brani ascoltati!`,
            metrics: {milestone: m}
          })
      return memories

#### `return`

Trigger: oggi hai riascoltato un artista che **non ascoltavi da almeno
`returnMinGapDays` (180) giorni** (D-A.2).

    function generateReturn(today, events):
      memories = []
      dayStart = startOfDay(today)
      todayEvents = events.filter(e => e.startedAt >= dayStart)
      for artistId in distinct(todayEvents.map(e => e.track.artistId)):
        previous = events.filter(e => e.track.artistId == artistId && e.startedAt < dayStart)
        if previous.length == 0: continue
        lastSeen = max(previous).startedAt
        gapDays = floor((dayStart - lastSeen) / 86400000)
        if gapDays < returnMinGapDays: continue
        firstToday = min(todayEvents.filter(e => e.track.artistId == artistId))
        memories.push({
          memoryKind: 'return',
          artistId,
          trackId: firstToday.trackId,
          gapDays,
          text: t('memory.return', { artist, months: floor(gapDays / 30) })
        })
      return memories

Il "silenzio" è l'**ultimo** ascolto precedente dell'artista, non il gap più
lungo della sua storia: il trigger è "**ti è tornato** dopo una pausa", non "una
volta hai avuto un buco". L'artefatto è il brano di oggi (`trackId`), non il
brano di allora: il ricordo riguarda il ritorno.

#### `seasonal`

Trigger: un artista che ascolti **prevalentemente in questo mese** (≥
`seasonalConcentration` = 60% dei suoi ascolti negli **ultimi 12 mesi**) e che
**quest'anno** hai riascoltato in quel mese (D-A.2).

    function generateSeasonal(today, events):
      currentMonth = monthOf(today)
      window = events.filter(e => e.startedAt >= today - 365d)
      memories = []
      for genre in distinct(window.flatMap(e => e.track.genres)):
        genreEvents = window.filter(e => e.track.genres.includes(genre))
        if genreEvents.length < seasonalMinEvents: continue
        inMonth = genreEvents.filter(e => monthOf(e.startedAt) == currentMonth)
        monthShare = inMonth.length / genreEvents.length
        if monthShare < seasonalConcentration: continue
        thisYear = inMonth.filter(e => yearOf(e.startedAt) == yearOf(today))
        if thisYear.length == 0: continue
        memories.push({
          memoryKind: 'seasonal',
          genre,
          month: currentMonth,
          text: t('memory.seasonal', { month: monthName(currentMonth, locale), genre })
        })
      return memories

La concentrazione è calcolata sui **12 mesi** precedenti, non sull'intera
storia: altrimenti un ascolto del 2019 "peserebbe" per sempre e il ricordo
diventerebbe un fatto storico invece di una stagionalità.

Il ricordo stagionale è **per genere** (non per artista): il testo ne porta il
nome. `MemoryPayload` (`02§4`) non ha un campo `genre`, quindi l'informazione
vive nel `text` reso — coerente con D-A.4: il payload è chiuso e il testo è la
memoria.

### 7.3 Parametri

| Parametro | Default | Note |
|-----------|---------|------|
| `onThisDayYears` | [1, 2, 3, 5, 10] | |
| `firstTimeMinTracks` | 5 | **brani distinti**, non ascolti (D-A.3) |
| `milestones` | [1000, 5000, 10000, 50000, 100000] | |
| `returnMinGapDays` | 180 | silenzio minimo dell'artista |
| `seasonalConcentration` | 0.6 | quota di ascolti dell'artista nel mese corrente (finestra 12 mesi) |
| `seasonalMinEvents` | 5 | ascolti minimi dell'artista nella finestra, per non generare ricordi da un singolo ascolto |

### 7.3.1 Il testo dei ricordi

Il `text` di `MemoryPayload` (`02-DATA-SCHEMA.md` §4) è una **stringa già resa**,
non una chiave i18n (D-A.4): il ricordo è uno **snapshot** di un momento, e la
lingua in cui è stato scritto è parte della memoria. Il **template** vive
comunque in `08-COPY-I18N.md` §2.15, così la generazione è internazionalizzata e
non hardcoded.

Le chiavi sono **quelle già dichiarate** in `08§2.15`:

| `memoryKind` | Chiave i18n | Parametri |
|---|---|---|
| `on_this_day` | `memory.on_this_day` | `years`, `track`, `artist` |
| `first_time` | `memory.first_time` | `years`, `artist` |
| `milestone` | `memory.milestone.events` / `.hours` / `.artists` | `count` |
| `return` | `memory.return` | `artist`, `months` |
| `seasonal` | `memory.seasonal` | `month`, `genre` |

La generazione **non** scrive mai stringhe italiane inline: chi implementa
chiama il resolver i18n con la chiave e i parametri del ricordo.

### 7.4 Ranking ricordi

Ogni ricordo ha un `score` calcolato come:

    score = baseScore(memoryKind) × relevance × recency

- `baseScore`: `on_this_day=10`, `first_time=8`, `milestone=9`, `return=7`, `seasonal=6`
- `relevance`: `trackCount / medianTrackCount` (quanto è rappresentativo il brano)
- `recency`: `exp(-daysAgo / 365)` (attenuazione per distanza)

Il feed ricordi mostra i top N score per giorno.

### 7.5 Invarianti

- `memoryKind ∈ enum`
- `yearsAgo ∈ {1, 2, 3, 5, 10}` per `on_this_day`
- `text` mai vuoto, contiene sempre almeno un dato concreto (nome artista/brano/numero)

---

## 8. Pipeline orchestratore

L'orchestratore è **incrementale** e **pluggabile** (D-A.5): ogni generatore è
indipendente dagli altri e riceve gli eventi nuovi più lo stato corrente.

    function analyzeIncremental(newEvents, state):
      // 1. Aggiorna sessioni
      sessions = updateSessions(state.sessions, newEvents)

      // 2. Aggiorna pattern
      patterns = updatePatterns(state.patterns, newEvents)

      // 3. Calcola mood per periodi appena chiusi
      newDayInsights = computeMoodForPeriod(newEvents, 'day')
      newWeekInsights = computeMoodForPeriod(newEvents, 'week')

      // 4. Rileva ere (solo se nuovo change point)
      eras = detectErasIncremental(state.eras, newEvents)

      // 5. Rileva eventi
      events = detectEvents(state.events, newEvents)

      // 6. Genera ricordi del giorno
      memories = generateMemories(today(), state.allEvents)

      return {
        sessions,
        patterns,
        insights: [...newDayInsights, ...newWeekInsights, ...eras, ...events, ...memories]
      }

### 8.1 Perimetro di questa tranche (D-A.5)

Il codice dell'orchestratore è **il contratto**; i **generatori** sono plug-in.
La prima tranche (Story 2.4, e poi 2.1) implementa:

| Generatore | Stato | Note |
|---|---|---|
| **Memory engine** (§7) | ✅ in questa tranche | usa solo ascolti, brani e artisti |
| **Mood tracker** (§3) | ✅ in questa tranche (Story 2.1, Sessione 63) | legge le feature **misurate o manuali**; senza audio features non produce insight (D-A.1, D-A.6, §12) |
| **Era detector** (§5) | ✅ in questa tranche (Story 2.2, Sessione 69) | change point detection su firme settimanali; senza feature misurate o manuali non produce ere (D-A.1) |
| **Event detector** (§6) | ✅ in questa tranche (Story 2.3, Sessione 70) | z-score su griglia settimanale, detector a quota e detector specialistici; senza feature misurate o manuali non produce eventi di valence (D-A.1) |
| Session segmentation (§2) | ⏭ differita | serve a `ListeningSession` (EPIC 2, tranche successiva) |
| Pattern analyzer (§4) | ⏭ differita | il pattern analyzer è un generatore a sé (storia futura): `nightShare` è la sua metrica (§4.3) |

L'orchestratore della tranche corrente chiama **solo** i generatori
implementati: gli altri si aggiungono senza cambiarne il contratto, come i sink
di scrobbling si sono aggiunti al registry senza modificare `PlatformAdapter`
(ADR-0011 V1).

> **I parametri dell'event detector** (§6.5) sono **otto**, non sei: alle
> soglie ratificate (`baselineDays`, `windowDays`, `zScoreThreshold`,
> `silenceMinDays`, `explorationMinNewArtists`, `strideDays`) si aggiungono
> `minBaselineDays` e `minDominantShare`, le due condizioni che la spec non
> esplicita e che la Story 2.3 dichiara (D.70.1, D.70.2). Il registro dei
> parametri è in §9.

---

## 9. DerivedVersion registry

| Algoritmo | Config object | Versione |
|-----------|---------------|----------|
| Session segmentation | `{gapThresholdMs}` | calcolata |
| Mood tracker | `{valenceThreshold, energyThreshold, neutralBand, excitedEnergyThreshold, minEventsPerPeriod}` | calcolata |
| Pattern analyzer | `{nightHours, weekendDays, minEvents}` | calcolata |
| Era detector | `{windowDays, stepDays, similarityThreshold, minEraDays, weights}` | calcolata |
| Event detector | `{baselineDays, windowDays, zScoreThreshold, silenceMinDays, explorationMinNewArtists, strideDays, minBaselineDays, minDominantShare}` | calcolata |
| Memory engine | `{onThisDayYears, firstTimeMinTracks, milestones, returnMinGapDays, seasonalConcentration, seasonalMinEvents}` | calcolata |

Ogni volta che si cambia un parametro di default, la versione cambia e gli insight diventano `stale` → ricalcolo automatico al prossimo avvio.

> Il config object dell'**event detector** comprende **otto** chiavi: le sei
> di `04§6.5` più `minBaselineDays` (i giorni con dati minimi perché una
> baseline sia utilizzabile) e `minDominantShare` (la quota minima perché un
> artista o un genere **domini** la finestra). Le due sono dichiarate dalla
> Story 2.3 (D.70.1, D.70.2): senza, una baseline di due giorni produrrebbe
> z-score arbitrari e ogni variazione ordinaria di una quota sembrerebbe un
> «picco».

---

## 10. Esempio end-to-end

**Utente**: 10.000 eventi in 2 anni.

1. Import → 10.000 ListenEvent persistiti
2. Session segmentation → ~1.500 sessioni
3. Mood tracker → 730 insight `mood_day`, 104 `mood_week`, 24 `mood_month`
4. Pattern analyzer → 3 insight (circadian, weekly, seasonal)
5. Era detector → ~4-8 ere (dipende da similarity threshold)
6. Event detector → ~10-30 eventi (spike, drop, exploration)
7. Memory engine → 1-5 ricordi generati ogni giorno

Tempo di esecuzione target su laptop medio: < 5 secondi totali (incrementale dopo primo calcolo).

---

## 11. Decisioni di ratifica (Sessione 59, issue #178)

Le cinque decisioni che la spec lasciava aperte sono chiuse **come proposte**,
con la ratifica del Boss (merge della PR) come atto di ratifica. Il precedente
è il ciclo della Story 1.5: le decisioni D1-D7 della spec ListenBrainz e le
decisioni D-SH.11…D-SH.14 della spec Scrobbling hub sono state chiuse come
proposte nella spec e ratificate dal merge.

| # | Decisione | Scelta | Motivazione |
|---|-----------|--------|-------------|
| **D-A.1** | La Story 2.1 (mood) dipende dagli **audio features** (EPIC 4.1), che non sono implementate | La 2.1 **aspetta** l'EPIC 4.1; parte la **2.4** (i ricordi), che dipende solo dagli ascolti | §3.3 legge `getAudioFeatures(e.trackId)` e restituisce `null` sotto i 3 eventi con valence: senza feature il mood tracker non produce **nulla**. Consegnare la 2.1 così sarebbe un falso verde (la lezione 58-4). Un fallback su segnali inventati (opzione C) è escluso: la vision promette letture vere |
| **D-A.2** | `return` e `seasonal` non erano specificati (pseudocodice `...`) | **Specificati** in §7.2, con `seasonalMinEvents` come nuovo parametro | L'AC della Story 2.4 chiede i **5** tipi; ridurli a 3 riscriverebbe l'AC. Le formule sono naturali: il silenzio dell'artista e la concentrazione stagionale su 12 mesi |
| **D-A.3** | `first_time`: "≥5 brani" o "≥5 ascolti"? | **5 brani distinti** (`firstTimeMinTracks`) | L'AC dice "brani", il pseudocodice contava gli ascolti: un artista con un solo brano ascoltato 5 volte non è "significativo" |
| **D-A.4** | Il `text` del ricordo: stringa resa o chiave i18n? | **Stringa resa** alla generazione, con il **template** i18n in `08` (`insight.memory.*`) | `MemoryPayload.text` è APPROVED e non viene toccato; il ricordo è uno **snapshot** e la lingua in cui è stato scritto è parte della memoria. La generazione resta i18n: nessuna stringa italiana inline |
| **D-A.5** | Il perimetro dell'implementazione | **Orchestratore minimale estensibile**: solo i generatori della tranche | Le Story 2.2/2.3 hanno AC e issue proprie; implementarle qui le renderebbe implicite. Il pattern è quello del registry dei sink (ADR-0011 V1): il contratto resta, i generatori si aggiungono |

**Effetti sulle regole già scritte**: D-A.2 e D-A.3 modificano **§7.2** (i due
algoritmi mancanti e il criterio di `first_time`), D-A.3 e D-A.2 modificano
**§7.3** e **§9** (i parametri), D-A.4 aggiunge **§7.3.1** (il testo dei
ricordi) e un namespace in `08-COPY-I18N.md`, D-A.5 aggiunge **§8.1** (il
perimetro della tranche).

### 11.1 Emendamento ratificato nella Sessione 65 (issue #193)

Il **project owner** ha ratificato il 2026-10-30 l'**opzione B** della issue
#193: *il fallback mood-by-genre non esiste*. Come D-A.1…D-A.5, la decisione è
chiusa **come proposta** nella spec e ratificata dal merge della PR.

| # | Decisione | Scelta | Motivazione |
|---|-----------|--------|-------------|
| **D-A.6** | Esiste un fallback mood-by-genre (`§1.4`: "mapping genre→valence/energy di default")? | **No** (opzione B): `§1.4` è riscritta sul comportamento reale — nessun insight mood senza feature misurate o manuali, più il warning aggregato per periodo — e `21-AUDIO-FEATURES.md` **§12** (punto 3) è allineato: la feature `heuristic`, per l'analisi, è come se non esistesse | La mappa non era ratificata in nessun documento: `§1.4` la nominava dal 2026-10-14 (Sessione 4) e la ratifica della Sessione 59 non l'ha aggiunta. Inventarla sarebbe il "segnale inventato" che la D-A.1 esclude — *"la vision promette letture vere"*. Le opzioni alternative (ratificare la mappa, o un insight di stima separato) avrebbero richiesto un campo che marcasse la stima in `MoodPeriodPayload` (`02§4`, **chiuso**): un mood stimato sarebbe indistinguibile da uno misurato nel dato persistito. Il costo dichiarato: **il mood resta un dato raro** (solo periodi con ≥3 ascolti misurati o manuali) e `Insight.confidence` dice quanto il mood copre |

**Effetti sulle regole già scritte**: la D-A.6 modifica **§1.4** (la degradazione
dichiarata), **§8.1** (lo stato dei generatori) e **§12** (la nota di stato);
`21-AUDIO-FEATURES.md` **§12** (punto 3) è allineato nella stessa PR. Il codice
di `§3` **non cambia**: il mood tracker già restituiva `null` sotto la soglia
(D.63.4) — la modifica del comportamento è solo il **warning aggregato**, che
`§1.4` dichiarava e il codice non emetteva.

---

## 12. Perimetro e dipendenze di questa versione

| Storia | Stato dopo questa ratifica | Dipendenza |
|--------|---------------------------|------------|
| **2.4 — Memory Engine** | 🟢 **implementabile subito** | solo gli ascolti, i brani e gli artisti |
| **2.1 — Mood Tracker** | ⛔ **in attesa** | le **audio features** (valence, energy) dell'**EPIC 4.1**, che non sono implementate: senza feature il mood tracker non può produrre insight (D-A.1) |

Il codice del mood tracker (§3) **resta specificato** in questa versione: quando
l'EPIC 4.1 porterà le features, la Story 2.1 si implementa senza altre
decisioni. Nel frattempo l'issue della 2.1 resta aperta e **non** candidabile.

**L'EPIC 4.1 ha bisogno di una spec propria** (come la Story 1.5 ebbe
`20-SCROBBLING-HUB.md`): il provider delle audio features (Essentia.js), il suo
costo, la privacy delle feature e il loro stoccaggio sono decisioni che non
appartengono a `04`.

> **Stato al 2026-10-30 (Sessione 65)**: la tabella sopra è la fotografia **al
> momento della ratifica della Sessione 59**. Da allora la **2.4** è
> implementata (Sessione 61, PR #185), la **2.1** è implementata (Sessione 63,
> PR #192) e l'**EPIC 4.1** è implementata (Sessione 64, PR #197): la catena
> **4.1 (dati) → 2.1 (letture)** è completa. Lo stato corrente delle storie
> vive in `11-BACKLOG.md` e in `docs/state/stories/`.

---

## Changelog

| Versione | Data | Modifiche |
|----------|------|-----------|
| 0.1 | Sessione 4 | Prima versione completa |
| 0.2 | Sessione 9 (2026-10-15) | Audit: §4.2 `computeCircadianPattern`/`Weekly`/`Seasonal` estesi con tutti i campi `PatternPayload` (`02§4` v1.1) — `peakDay`, `peakMonth`, `weekendShare`, `userTimezone`; campi non applicabili esplicitamente `null`; §4.5 invarianti aggiornate |
| 1.0 | Sessione 59 (2026-10-28, issue #178) | 🟢 APPROVED — **ratifica del Boss al merge della PR**: le cinque decisioni aperte (§11, D-A.1…D-A.5) sono chiuse **come proposte**. **§7.2**: `return` e `seasonal` sono specificati (il silenzio è l'ultimo ascolto precedente dell'artista; la concentrazione stagionale è calcolata su 12 mesi) e `first_time` passa a **5 brani distinti** (`firstTimeMinTracks`, D-A.3); **§7.3**: i parametri allineati (`firstTimeMinTracks`, `seasonalMinEvents`) e il parametro `returnMinGapDays` dichiarato; **§7.3.1** (nuova): il `text` del ricordo è una stringa **resa** alla generazione con il template i18n `insight.memory.*` (D-A.4), non una chiave né una stringa italiana inline; **§8.1** (nuova): il perimetro della tranche — orchestratore minimale estensibile, solo i generatori implementati (D-A.5); **§9**: il registro dei parametri allineato; **§11** (nuova): le cinque decisioni con la motivazione; **§12** (nuova): il perimetro — la **Story 2.4** è implementabile subito, la **Story 2.1** aspetta le **audio features dell'EPIC 4.1** (D-A.1). Le formule, i parametri e i vinanti di §1…§10 restano quelli di v0.2, salvo le modifiche elencate |
| 1.1 | Sessione 65 (2026-10-30, issue #193) | 🟢 APPROVED — **emendamento ratificato dal project owner** (opzione B): il fallback **mood-by-genre non esiste**. **§1.4**: la degradazione è riscritta sul comportamento reale — nessun insight mood senza feature misurate o manuali, **nessun proxy sul genere** e il warning **aggregato per periodo** ("X eventi senza audio features", solo conteggi); **§8.1**: il mood tracker passa da "in attesa dell'EPIC 4.1" a generatore della tranche; **§11.1** (nuova): la decisione **D-A.6** con la motivazione e gli effetti; **§12**: nota di stato (la tabella resta la fotografia della ratifica della Sessione 59). Il codice di `§3` **non cambia** nel calcolo: il mood tracker già restituiva `null` sotto `minEventsPerPeriod` (D.63.4); la modifica del comportamento è il **warning aggregato**, che `§1.4` dichiarava e il codice non emetteva. `21-AUDIO-FEATURES.md` §12 (punto 3) è allineato nella stessa PR |
| 1.2 | Sessione 69 (2026-10-31, issue #211) | **Story 2.2 implementata** (era detector): **§8.1** l'era detector passa da "differita" a **generatore della tranche** (`packages/core/src/analysis/era/`). Il testo dell'algoritmo (§5.2-§5.5) **non cambia**: le scelte che la spec non explicita sono dichiarate in `docs/state/stories/2.2-era-detector.md` (D.69.1…D.69.7) e in `docs/state/sessions/69-era-detector.md`. **§9**: il config object dell'era detector comprende anche le **soglie del mood**, perché il mood dominante dell'era è classificato dal **classificatore del mood tracker** (D.69.2): senza, un cambio delle soglie non renderebbe `stale` le ere (MIG-3). **§4.3**: la `nightShare` è la metrica che l'era detector riusa (orari UTC, D.69.4) |
| 1.3 | Sessione 70 (2026-10-31, issue #214) | **Story 2.3 implementata** (event detector): **§8.1** l'event detector passa da "differita" a **generatore della tranche** (`packages/core/src/analysis/event/`). Il testo dell'algoritmo (§6.2-§6.6) **non cambia**: le scelte che la spec non explicita sono dichiarate in **§6.8** (nuova) e nei file di stato (D.70.1…D.70.8). **§9**: il config object dell'event detector comprende **otto** chiavi — le sei di §6.5 più `minBaselineDays` (D.70.1) e `minDominantShare` (D.70.2): senza, una baseline di due giorni produrrebbe z-score arbitrari e ogni variazione ordinaria di una quota sembrerebbe un «picco». **§6.8** (nuova): le scelte di implementazione del detector, dichiarate in sintesi |