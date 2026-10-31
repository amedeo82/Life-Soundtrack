import { afterEach, describe, expect, it } from 'vitest';
import {
  listInsightsByType,
  listInsightsByTypeAndVersion,
  listStaleInsights,
  putInsights,
  replaceAllInsightsOfType,
} from '../../db/insights';
import { closeAllDbs, freshDb } from '../../db/__tests__/helpers';
import type { Artist, AudioFeatures, ListenEvent, Track } from '../../schema';
import { EventEngine, type EventConfigOverrides } from '../event';
import { createLocaleTranslator, eventPayloadOf } from './helpers';

/**
 * Test della persistenza degli eventi — 02-DATA-SCHEMA.md §6 (tabella
 * `insights`), §7 MIG-3 (insight `stale` al cambio dei parametri) e 04§9
 * (`derivedVersion` calcolata dai parametri).
 *
 * Gli eventi dipendono **dall'intera storia**: la baseline di un rilevamento
 * è l'intero periodo precedente, e un ricalcolo può spostare i confini. Il
 * ricalcolo deve quindi sostituire **l'insieme** degli eventi, non solo quelli
 * del periodo ricalcolato.
 */

afterEach(closeAllDbs);

function engine(config?: EventConfigOverrides) {
  return new EventEngine({
    translator: createLocaleTranslator('it'),
    ...(config ? { config } : {}),
  });
}

const DAY_MS = 86_400_000;
const START = Date.UTC(2024, 0, 1);

/** Un ascolto sintetico. */
function listen(id: string, trackId: string, day: number) {
  const startedAt = START + day * DAY_MS + 12 * 3_600_000;
  return {
    id,
    eventKey: `spotify:${id}`,
    platform: 'spotify' as const,
    importId: 'imp-1',
    timestamp: startedAt + 240_000,
    startedAt,
    durationMs: 240_000,
    trackId,
    completed: true,
    skipped: false,
    shuffle: null,
    offline: null,
    incognito: null,
    reasonStart: null,
    reasonEnd: null,
    deviceType: 'mobile' as const,
    deviceDetail: null,
    ip: null,
    country: 'IT',
    city: null,
    citySource: null,
    cityConfidence: null,
    day: '2024-01-01',
  };
}

/** Un brano sintetico. */
function track(id: string, artistId: string, genres: string[]) {
  return {
    id,
    canonicalKey: `fuzzy:${id}`,
    name: `Brano ${id}`,
    artistId,
    albumId: null,
    durationMs: 240_000,
    isrc: null,
    mbid: null,
    explicit: false,
    genres,
    artworkUrl: null,
    platformIds: { spotify: id },
    firstSeenAt: START,
    lastSeenAt: START,
    listenCount: 0,
  };
}

/** Un artista sintetico. */
function artist(id: string): Artist {
  return {
    id,
    name: `Artista ${id}`,
    mbid: null,
    genres: ['pop'],
    platformIds: {},
    listenCount: 0,
  };
}

/** Una feature misurata. */
function feature(trackId: string, valence: number, energy: number) {
  return {
    trackId,
    valence,
    energy,
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
    source: 'essentia' as const,
    fetchedAt: 0,
    schemaVersion: 1,
  };
}

/**
 * Una cronologia con una baseline (60 giorni) e un picco (14 giorni).
 *
 * Il volume della baseline oscilla (4-6 ascolti al giorno): una baseline
 * costante ha deviazione standard zero e lo z-score non sarebbe definito.
 */
function sampleInput() {
  const listens: ListenEvent[] = [];
  const tracks: Track[] = [];
  const artists: Artist[] = [];
  const features: AudioFeatures[] = [];
  let counter = 0;

  for (let a = 1; a <= 4; a += 1) {
    const artistId = `ar-${a}`;
    const trackId = `tr-${a}`;
    artists.push(artist(artistId));
    tracks.push(track(trackId, artistId, ['pop']));
    features.push(feature(trackId, 0.4 + 0.05 * a, 0.5));
  }

  for (let day = 0; day < 74; day += 1) {
    const count = day < 60 ? 4 + (day % 3) : 24;
    for (let i = 0; i < count; i += 1) {
      counter += 1;
      const artistIndex = (day + i) % 4;
      listens.push(listen(`le-${counter}`, `tr-${artistIndex + 1}`, day));
    }
  }

  return { listens, tracks, artists, features };
}

describe('persistenza degli eventi (02§6, §7 MIG-3)', () => {
  it('scrive e rilegge gli insight di tipo event', async () => {
    const db = freshDb('ls-event-put');
    await db.open();
    const input = sampleInput();
    const eventEngine = engine();
    const generated = await eventEngine.generate(input);

    expect(generated.length).toBeGreaterThan(0);
    await putInsights(
      db,
      generated.map((event) => event.insight),
    );

    const stored = await listInsightsByType(db, 'event');
    expect(stored).toHaveLength(generated.length);
    expect(stored[0]!.payload.kind).toBe('event');
    expect(stored[0]!.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    expect(stored[0]!.derivedVersion).toBe(await eventEngine.derivedVersion());
    expect(eventPayloadOf(stored[0]!).description.length).toBeGreaterThan(0);
  });

  it('gli eventi generati con parametri diversi diventano stale (MIG-3)', async () => {
    const db = freshDb('ls-event-stale');
    await db.open();
    const input = sampleInput();

    const first = await engine().generate(input);
    await putInsights(
      db,
      first.map((event) => event.insight),
    );

    const second = await engine({ zScoreThreshold: 3 }).generate(input);
    const newVersion = second[0]!.insight.derivedVersion;
    expect(newVersion).not.toBe(first[0]!.insight.derivedVersion);

    const stale = await listStaleInsights(db, 'event', newVersion);
    expect(stale).toHaveLength(first.length);
    expect(await listInsightsByTypeAndVersion(db, 'event', newVersion)).toHaveLength(0);
  });

  it('il ricalcolo sostituisce l’insieme degli eventi', async () => {
    const db = freshDb('ls-event-replace');
    await db.open();
    const input = sampleInput();

    const first = await engine().generate(input);
    await putInsights(
      db,
      first.map((event) => event.insight),
    );
    expect(await listInsightsByType(db, 'event')).toHaveLength(first.length);

    // Un ricalcolo con una soglia diversa sposta i confini: gli eventi vecchi
    // hanno un `periodStart` diverso e non verrebbero rimossi da un
    // ricalcolo per periodo.
    const second = await engine({ zScoreThreshold: 3 }).generate(input);
    const report = await replaceAllInsightsOfType(db, {
      type: 'event',
      insights: second.map((event) => event.insight),
      derivedVersion: second[0]!.insight.derivedVersion,
    });

    expect(report.removedStale).toBe(first.length);
    expect(report.inserted).toBe(second.length);

    const stored = await listInsightsByType(db, 'event');
    expect(stored).toHaveLength(second.length);
    for (const insight of stored) {
      expect(insight.derivedVersion).toBe(second[0]!.insight.derivedVersion);
    }
  });

  it('ricalcolare due volte non duplica gli insight', async () => {
    const db = freshDb('ls-event-idempotent');
    await db.open();
    const input = sampleInput();

    const generated = await engine().generate(input);
    const version = generated[0]!.insight.derivedVersion;
    const options = {
      type: 'event' as const,
      insights: generated.map((event) => event.insight),
      derivedVersion: version,
    };

    await replaceAllInsightsOfType(db, options);
    const second = await replaceAllInsightsOfType(db, options);

    expect(second.inserted).toBe(options.insights.length);
    expect(second.removedSuperseded).toBe(options.insights.length);
    expect(await listInsightsByType(db, 'event')).toHaveLength(options.insights.length);
  });

  it('il ricalcolo non tocca gli insight degli altri tipi', async () => {
    const db = freshDb('ls-event-isolated');
    await db.open();
    const input = sampleInput();

    const generated = await engine().generate(input);
    await putInsights(db, [
      {
        id: 'mood-day-2024-01-01',
        type: 'mood_day',
        periodStart: START,
        periodEnd: START + DAY_MS,
        payload: {
          kind: 'mood',
          mood: 'sad',
          avgValence: 0.3,
          avgEnergy: 0.35,
          eventCount: 6,
        },
        confidence: 1,
        derivedVersion: 'deadbeef',
        status: 'pending',
        userNote: null,
        createdAt: 0,
      },
    ]);

    await replaceAllInsightsOfType(db, {
      type: 'event',
      insights: generated.map((event) => event.insight),
      derivedVersion: generated[0]!.insight.derivedVersion,
    });

    expect(await listInsightsByType(db, 'mood_day')).toHaveLength(1);
    expect(await listInsightsByType(db, 'event')).toHaveLength(generated.length);
  });
});
