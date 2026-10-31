import { describe, expect, it } from 'vitest';
import type { Artist, AudioFeatures, EventKind, ListenEvent, Track } from '../../schema';
import {
  DEFAULT_EVENT_CONFIG,
  EventEngine,
  EVENT_QUOTA_RATIO,
  metricToEventType,
  resolveEventConfig,
  type EventConfigOverrides,
} from '../event';
import { createLocaleTranslator, eventPayloadOf } from './helpers';

/**
 * Test del motore dell'event detector — `04-ANALYSIS-ALGORITHMS.md` v1.2 🟢
 * §6 (Story 2.3).
 *
 * Le cronologie sono **sintetiche e dichiarate**: la baseline occupa i
 * giorni 0-59 (i `baselineDays` del detector) e la finestra anomala i giorni
 * 60-73 (i `windowDays`). Il volume e la valence oscillano nella baseline:
 * una baseline costante ha deviazione standard zero, e lo z-score non
 * sarebbe definito (04§6.3).
 */

const DAY_MS = 86_400_000;
const START = Date.UTC(2024, 0, 1);

/** Opzioni della cronologia sintetica. */
interface HistoryOptions {
  /** I giorni totali della cronologia. */
  readonly days: number;
  /** Gli ascolti del giorno. */
  readonly count: (day: number) => number;
  /** Gli artisti della baseline (prima di `anomalyFrom`). */
  readonly baseline: readonly PoolArtist[];
  /**
   * Gli artisti della fase anomala (da `anomalyFrom` in poi).
   *
   * Se assenti, la cronologia usa gli stessi artisti della baseline per
   * tutto il periodo: il volume può cambiare senza che cambi la valence.
   */
  readonly anomaly?: readonly PoolArtist[];
  /** Il giorno da cui scatta l'anomalia (default 60). */
  readonly anomalyFrom?: number;
  /** Nella fase anomala tutti gli ascolti vanno al primo artista. */
  readonly dominant?: boolean;
}

/** Un artista della cronologia sintetica. */
interface PoolArtist {
  /** La valence del suo brano (la feature è per brano, 02§3.4). */
  readonly valence: number;
  /** Il genere del suo brano. */
  readonly genre: string;
}

/** I 4 artisti della baseline: la rotazione cambia il mix del giorno. */
const BASELINE_POOL: readonly PoolArtist[] = [
  { valence: 0.4, genre: 'pop' },
  { valence: 0.45, genre: 'rock' },
  { valence: 0.5, genre: 'jazz' },
  { valence: 0.55, genre: 'indie' },
];

/** Gli artisti della fase anomala: la valence crolla e un genere domina. */
const ANOMALY_POOL: readonly PoolArtist[] = [
  { valence: 0.15, genre: 'techno' },
  { valence: 0.15, genre: 'house' },
  { valence: 0.15, genre: 'house' },
  { valence: 0.15, genre: 'house' },
];

/** Gli artisti della fase anomala con la valence che sale. */
const RISEN_POOL: readonly PoolArtist[] = [
  { valence: 0.85, genre: 'techno' },
  { valence: 0.85, genre: 'house' },
  { valence: 0.85, genre: 'house' },
  { valence: 0.85, genre: 'house' },
];

/** Una cronologia sintetica. */
function buildHistory(options: HistoryOptions) {
  const artists: Artist[] = [];
  const tracks: Track[] = [];
  const listens: ListenEvent[] = [];
  const features: AudioFeatures[] = [];

  /** Aggiunge un artista e il suo brano. */
  const addArtist = (index: number, artist: PoolArtist): string => {
    const artistId = `ar-${index}`;
    const trackId = `tr-${index}`;
    artists.push({
      id: artistId,
      name: `Artista ${index}`,
      mbid: null,
      genres: [artist.genre],
      platformIds: {},
      listenCount: 0,
    });
    tracks.push({
      id: trackId,
      canonicalKey: `fuzzy:tr-${index}`,
      name: `Brano ${index}`,
      artistId,
      albumId: null,
      durationMs: 240_000,
      isrc: null,
      mbid: null,
      explicit: false,
      genres: [artist.genre],
      artworkUrl: null,
      platformIds: {},
      firstSeenAt: START,
      lastSeenAt: START,
      listenCount: 0,
    });
    features.push({
      trackId,
      valence: artist.valence,
      energy: 0.5,
      danceability: null,
      acousticness: null,
      instrumentalness: null,
      speechiness: null,
      liveness: null,
      tempo: null,
      key: null,
      mode: null,
      loudness: null,
      timeSignature: null,
      source: 'essentia',
      fetchedAt: 0,
      schemaVersion: 1,
    });
    return trackId;
  };

  const baselineIds = options.baseline.map((artist, index) => addArtist(index + 1, artist));
  const anomalyIds = options.anomaly?.map((artist, index) => addArtist(index + 101, artist)) ?? [];

  let counter = 0;
  for (let day = 0; day < options.days; day += 1) {
    const anomalous = day >= (options.anomalyFrom ?? 60);
    // Senza un pool "anomalo" la cronologia usa gli stessi artisti della
    // baseline: il volume può cambiare senza che cambi la valence.
    const pool = options.anomaly && anomalous ? anomalyIds : baselineIds;
    if (pool.length === 0) continue;

    const count = options.count(day);
    for (let i = 0; i < count; i += 1) {
      counter += 1;
      // Nella fase anomala l'artista dominante prende tutto: nella baseline
      // la rotazione cambia il mix del giorno (e con esso la valence media).
      const index = anomalous && options.dominant ? 0 : (day + i) % pool.length;
      const startedAt = START + day * DAY_MS + 12 * 3_600_000 + i * 60_000;
      listens.push({
        id: `le-${counter}`,
        eventKey: `spotify:le-${counter}`,
        platform: 'spotify',
        importId: 'imp-1',
        timestamp: startedAt + 240_000,
        startedAt,
        durationMs: 240_000,
        trackId: pool[index]!,
        completed: true,
        skipped: false,
        shuffle: null,
        offline: null,
        incognito: null,
        reasonStart: null,
        reasonEnd: null,
        deviceType: 'mobile',
        deviceDetail: null,
        ip: null,
        country: 'IT',
        city: null,
        citySource: null,
        cityConfidence: null,
        day: '2024-01-01',
      });
    }
  }

  return { listens, tracks, artists, features };
}

/** Il motore con i parametri di default. */
function engine(config?: EventConfigOverrides) {
  return new EventEngine({
    translator: createLocaleTranslator('it'),
    ...(config ? { config } : {}),
  });
}

/** I tipi di evento rilevati. */
function typesOf(generated: ReadonlyArray<{ payload: { eventType: EventKind } }>): EventKind[] {
  return generated.map((event) => event.payload.eventType);
}

describe('event detector — il detector a z-score (04§6.3)', () => {
  it('rileva un volume_spike quando la finestra ascolta molto di più', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 4 + (day % 3) : 24),
      baseline: BASELINE_POOL,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).toContain('volume_spike');
    const spike = generated.find((event) => event.payload.eventType === 'volume_spike')!;
    expect(spike.payload.metrics.z!).toBeGreaterThan(2);
    expect(spike.payload.metrics.window_mean!).toBeGreaterThan(
      spike.payload.metrics.baseline_mean!,
    );
  });

  it('rileva un volume_drop quando la finestra ascolta molto di meno', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 24 + (day % 3) : 4),
      baseline: BASELINE_POOL,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).toContain('volume_drop');
  });

  it('rileva un valence_drop quando la musica diventa più malinconica', async () => {
    const history = buildHistory({
      days: 74,
      count: () => 6,
      baseline: BASELINE_POOL,
      anomaly: ANOMALY_POOL,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).toContain('valence_drop');
  });

  it('rileva un valence_rise quando la musica diventa più allegra', async () => {
    const history = buildHistory({
      days: 74,
      count: () => 6,
      baseline: BASELINE_POOL,
      anomaly: RISEN_POOL,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).toContain('valence_rise');
  });

  it('senza feature non produce eventi di valence (D-A.1)', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 4 + (day % 3) : 24),
      baseline: BASELINE_POOL,
    });
    const generated = await engine().generate({ ...history, features: [] });

    const types = typesOf(generated);
    expect(types).not.toContain('valence_drop');
    expect(types).not.toContain('valence_rise');
    // Il volume non dipende dalle feature: l'evento c'è.
    expect(types).toContain('volume_spike');
  });

  it('le feature euristiche non alimentano l’analisi (D-AF.4)', async () => {
    const history = buildHistory({
      days: 74,
      count: () => 6,
      baseline: BASELINE_POOL,
      anomaly: ANOMALY_POOL,
    });
    const heuristic = history.features.map((f) => ({ ...f, source: 'heuristic' as const }));
    const generated = await engine().generate({ ...history, features: heuristic });

    expect(typesOf(generated)).not.toContain('valence_drop');
  });

  it('una baseline senza dispersione non produce eventi (std = 0)', async () => {
    const history = buildHistory({ days: 74, count: () => 6, baseline: BASELINE_POOL });
    const generated = await engine().generate(history);

    // Il volume è costante: la deviazione standard è zero e il detector
    // z-score non è definito (04§6.3, «if std == 0: continue»).
    expect(typesOf(generated)).not.toContain('volume_spike');
    expect(typesOf(generated)).not.toContain('volume_drop');
  });
});

describe('event detector — il detector a quota (04§6.2)', () => {
  it('rileva un spike_artist quando un artista domina la finestra', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 8 + (day % 3) : 20),
      baseline: BASELINE_POOL,
      anomaly: ANOMALY_POOL,
      dominant: true,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).toContain('spike_artist');
    const spike = generated.find((event) => event.payload.eventType === 'spike_artist')!;
    expect(spike.payload.metrics.window_share!).toBeGreaterThanOrEqual(
      DEFAULT_EVENT_CONFIG.minDominantShare,
    );
    expect(spike.payload.metrics.share_ratio!).toBeGreaterThan(EVENT_QUOTA_RATIO);
  });

  it('rileva un spike_genre quando un genere domina la finestra', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 8 + (day % 3) : 20),
      baseline: BASELINE_POOL,
      anomaly: ANOMALY_POOL,
      dominant: true,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).toContain('spike_genre');
    const spike = generated.find((event) => event.payload.eventType === 'spike_genre')!;
    expect(spike.payload.metrics.window_share!).toBeGreaterThanOrEqual(
      DEFAULT_EVENT_CONFIG.minDominantShare,
    );
  });

  it('non rileva un picco se il soggetto non domina la finestra', async () => {
    // Nessun artista raggiunge la quota di dominanza: la baseline è equa.
    const history = buildHistory({
      days: 74,
      count: (day) => 8 + (day % 3),
      baseline: BASELINE_POOL,
    });
    const generated = await engine().generate(history);

    expect(typesOf(generated)).not.toContain('spike_artist');
    expect(typesOf(generated)).not.toContain('spike_genre');
  });
});

describe('event detector — i detector specialistici (04§6.4)', () => {
  it('rileva il silenzio fra due ascolti lontani', async () => {
    const history = buildHistory({ days: 74, count: () => 6, baseline: BASELINE_POOL });
    // Un buco di 5 giorni: l'ultimo ascolto del giorno 30 e il primo del 35.
    const before = history.listens.filter((listen) => {
      const day = Math.floor((listen.startedAt! - START) / DAY_MS);
      return day <= 30;
    });
    const after = history.listens.filter((listen) => {
      const day = Math.floor((listen.startedAt! - START) / DAY_MS);
      return day >= 35;
    });
    const trimmed = [...before, ...after];

    const generated = await engine().generate({ ...history, listens: trimmed });
    const silences = generated.filter((event) => event.payload.eventType === 'silence');

    expect(silences).toHaveLength(1);
    expect(silences[0]!.payload.metrics.duration_days!).toBeGreaterThanOrEqual(3);
  });

  it('rileva l’esplorazione quando compaiono molti artisti nuovi', async () => {
    const history = buildHistory({ days: 74, count: () => 6, baseline: BASELINE_POOL });
    // Dodici artisti nuovi nella finestra: il detector li conta dai primi
    // ascolti in assoluto.
    const extraTracks: Track[] = [];
    const extraArtists: Artist[] = [];
    const extraListens: ListenEvent[] = [];
    for (let n = 0; n < 12; n += 1) {
      const artistId = `ar-new-${n}`;
      const trackId = `tr-new-${n}`;
      extraArtists.push({
        id: artistId,
        name: `Nuovo ${n}`,
        mbid: null,
        genres: ['house'],
        platformIds: {},
        listenCount: 0,
      });
      extraTracks.push({
        id: trackId,
        canonicalKey: `fuzzy:tr-new-${n}`,
        name: `Nuovo ${n}`,
        artistId,
        albumId: null,
        durationMs: 240_000,
        isrc: null,
        mbid: null,
        explicit: false,
        genres: ['house'],
        artworkUrl: null,
        platformIds: {},
        firstSeenAt: START,
        lastSeenAt: START,
        listenCount: 0,
      });
      const startedAt = START + 65 * DAY_MS + 13 * 3_600_000 + n * 60_000;
      extraListens.push({
        ...history.listens[0]!,
        id: `le-new-${n}`,
        eventKey: `spotify:le-new-${n}`,
        trackId,
        startedAt,
        timestamp: startedAt + 240_000,
      });
    }

    const generated = await engine().generate({
      ...history,
      listens: [...history.listens, ...extraListens],
      tracks: [...history.tracks, ...extraTracks],
      artists: [...history.artists, ...extraArtists],
    });
    const explorations = generated.filter((event) => event.payload.eventType === 'exploration');

    expect(explorations.length).toBeGreaterThanOrEqual(1);
    expect(explorations[0]!.payload.metrics.new_artists!).toBeGreaterThanOrEqual(10);
  });
});

describe('event detector — invarianti e determinismo (04§6.7)', () => {
  it('ogni evento ha periodStart < periodEnd e confidenza in [0, 1]', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 4 + (day % 3) : 24),
      baseline: BASELINE_POOL,
      anomaly: ANOMALY_POOL,
    });
    const generated = await engine().generate(history);

    expect(generated.length).toBeGreaterThan(0);
    for (const event of generated) {
      expect(event.insight.periodStart).toBeLessThan(event.insight.periodEnd);
      expect(event.insight.confidence).toBeGreaterThanOrEqual(0);
      expect(event.insight.confidence).toBeLessThanOrEqual(1);
      expect(event.insight.type).toBe('event');
      expect(event.insight.status).toBe('pending');
      expect(event.insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('gli eventi sovrapposti dello stesso tipo sono deduplicati', async () => {
    const history = buildHistory({
      days: 100,
      count: (day) => (day < 60 ? 4 + (day % 3) : 24),
      baseline: BASELINE_POOL,
    });
    const generated = await engine().generate(history);
    const spikes = generated.filter((event) => event.payload.eventType === 'volume_spike');

    // La finestra (14 giorni) e lo stride (7 giorni) fanno sovrapporre le
    // finestre consecutive: il dedupe ne lascia una sola (04§6.3).
    expect(spikes.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < spikes.length; i += 1) {
      const previous = spikes[i - 1]!.insight;
      const current = spikes[i]!.insight;
      const overlaps =
        previous.periodStart < current.periodEnd && current.periodStart < previous.periodEnd;
      expect(overlaps).toBe(false);
    }
  });

  it('a parità di input produce gli stessi eventi (determinismo)', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 4 + (day % 3) : 24),
      baseline: BASELINE_POOL,
    });
    const first = await engine().generate(history);
    const second = await engine().generate(history);

    expect(second.map((event) => event.insight.id)).toEqual(first.map((event) => event.insight.id));
    expect(second.map((event) => eventPayloadOf(event.insight))).toEqual(
      first.map((event) => eventPayloadOf(event.insight)),
    );
  });

  it('un parametro cambiato cambia la derivedVersion (MIG-3)', async () => {
    const config = resolveEventConfig();
    const other = resolveEventConfig({ zScoreThreshold: 3 });

    expect(other.zScoreThreshold).not.toBe(config.zScoreThreshold);
    expect(await engine().derivedVersion()).not.toBe(
      await engine({ zScoreThreshold: 3 }).derivedVersion(),
    );
  });

  it('una storia vuota non produce eventi', async () => {
    const history = buildHistory({ days: 0, count: () => 0, baseline: BASELINE_POOL });
    const generated = await engine().generate(history);

    expect(generated).toEqual([]);
  });

  it('la descrizione è resa dal resolver i18n e contiene il suffisso del detector', async () => {
    const history = buildHistory({
      days: 74,
      count: (day) => (day < 60 ? 4 + (day % 3) : 24),
      baseline: BASELINE_POOL,
    });
    const generated = await engine().generate(history);
    const spike = generated.find((event) => event.payload.eventType === 'volume_spike')!;

    expect(spike.payload.description).toContain('Hai ascoltato molta più musica del solito');
    expect(spike.payload.description).toContain('(z-score:');
  });

  it('il mapping metrica → tipo segue il segno dello z-score', () => {
    expect(metricToEventType('volume', 3)).toBe('volume_spike');
    expect(metricToEventType('volume', -3)).toBe('volume_drop');
    expect(metricToEventType('valence', 3)).toBe('valence_rise');
    expect(metricToEventType('valence', -3)).toBe('valence_drop');
    expect(metricToEventType('diversity', 3)).toBe('exploration');
    // Una diversità in calo non ha tipo: l'enum di 02§4 non ne prevede uno.
    expect(metricToEventType('diversity', -3)).toBeNull();
  });
});
