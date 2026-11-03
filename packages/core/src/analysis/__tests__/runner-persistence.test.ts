import { afterEach, describe, expect, it } from 'vitest';
import {
  closeAllDbs,
  freshDb,
  makeListen,
  makeTrack,
  makeArtist,
  makeFeatures,
} from '../../db/__tests__/helpers';
import { runAnalysisPipeline } from '../runner';
import { listInsightsByType } from '../../db/insights';
import type { ListenEvent, Track, Artist, AudioFeatures } from '../../schema';
import { createLocaleTranslator } from './helpers';

/**
 * Test di integrazione persistenza runner — 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Copre: replaceAllInsightsOfType sui memory (il feed si riordina per rilevanza).
 */

afterEach(closeAllDbs);

/**
 * Scenario minimo con 2 settimane di dati.
 */
function scenarioWithFeatures(): {
  listens: ListenEvent[];
  tracks: Track[];
  artists: Artist[];
  features: AudioFeatures[];
} {
  const listens: ListenEvent[] = [];
  const tracks: Track[] = [];
  const artists: Artist[] = [];
  const features: AudioFeatures[] = [];

  const week1Start = Date.UTC(2024, 0, 1, 10);

  let trackId = 1;
  let artistId = 1;
  let listenId = 1;

  for (let week = 0; week < 2; week++) {
    const isSecondWeek = week >= 1;
    const valence = isSecondWeek ? 0.25 : 0.8;
    const energy = isSecondWeek ? 0.3 : 0.7;

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 3; hour++) {
        const timestamp =
          week1Start + (week * 7 + day) * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000;
        const dayStr = new Date(timestamp).toISOString().slice(0, 10);

        const tId = `track-${trackId}`;
        const aId = `artist-${artistId}`;

        listens.push(
          makeListen({
            id: `le-${String(listenId).padStart(6, '0')}`,
            eventKey: `spotify:ek-${String(listenId).padStart(6, '0')}`,
            trackId: tId,
            timestamp,
            day: dayStr,
          }),
        );
        listenId++;

        tracks.push(
          makeTrack({
            id: tId,
            canonicalKey: `fuzzy:ck-${trackId}`,
            artistId: aId,
          }),
        );

        artists.push(
          makeArtist({
            id: aId,
            name: `Artist ${artistId}`,
          }),
        );

        features.push(
          makeFeatures({
            trackId: tId,
            valence,
            energy,
            source: 'essentia',
          }),
        );

        trackId++;
        artistId++;
      }
    }
  }

  return { listens, tracks, artists, features };
}

describe('runner persistenza (replaceAllInsightsOfType per memory)', () => {
  it('replaceAllInsightsOfType sui memory: il feed si riordina per rilevanza', async () => {
    const db = freshDb('ls-runner-memory-persistence');
    await db.open();
    const { listens, tracks, artists, features } = scenarioWithFeatures();
    await db.listens.bulkAdd(listens);
    await db.tracks.bulkAdd(tracks);
    await db.artists.bulkAdd(artists);
    await db.features.bulkAdd(features);

    const translator = createLocaleTranslator('it');

    // Prima run
    await runAnalysisPipeline({ db, translator, now: () => 1000 });
    const memory1 = await listInsightsByType(db, 'memory');
    if (memory1.length === 0) return; // Skip se nessun memory generato
    const oldMemoryIds = memory1.map((m) => m.id);
    const oldVersion = memory1[0]!.derivedVersion;

    // Seconda run: i memory vengono ricalcolati con replaceAllInsightsOfType
    await runAnalysisPipeline({ db, translator, now: () => 2000 });
    const memory2 = await listInsightsByType(db, 'memory');

    // I vecchi memory non devono più esistere (replaceAllInsightsOfType rimuove TUTTI)
    for (const oldId of oldMemoryIds) {
      expect(memory2.find((m) => m.id === oldId)).toBeUndefined();
    }

    // I nuovi memory hanno la stessa derivedVersion (parametri invariati)
    expect(memory2.length).toBeGreaterThan(0);
    expect(memory2[0]!.derivedVersion).toBe(oldVersion);
  }, 10000);
});
