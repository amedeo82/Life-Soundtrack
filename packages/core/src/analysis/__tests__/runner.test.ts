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
 * Test del runner di analisi — 23-ANALYSIS-PIPELINE.md v1.0 🟢.
 *
 * Copre: idempotenza, assenza di feature, sostituzione mood.
 */

afterEach(closeAllDbs);

/**
 * Scenario minimo con 2 settimane di dati (14 giorni, 3 ascolti/giorno = 42 ascolti)
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

function scenarioWithoutFeatures(): {
  listens: ListenEvent[];
  tracks: Track[];
  artists: Artist[];
} {
  const { listens, tracks, artists } = scenarioWithFeatures();
  return { listens, tracks, artists };
}

describe('runAnalysisPipeline (23-ANALYSIS-PIPELINE)', () => {
  it('produce mood_day con derivedVersion', async () => {
    const db = freshDb('ls-runner-produce');
    await db.open();
    const { listens, tracks, artists, features } = scenarioWithFeatures();
    await db.listens.bulkAdd(listens);
    await db.tracks.bulkAdd(tracks);
    await db.artists.bulkAdd(artists);
    await db.features.bulkAdd(features);

    const translator = createLocaleTranslator('it');
    const report = await runAnalysisPipeline({ db, translator });

    // mood_day è sempre prodotto con feature sufficienti
    expect(report.produced.mood_day).toBeGreaterThan(0);

    // Verifica derivedVersion presente
    const moodDay = await listInsightsByType(db, 'mood_day');
    expect(moodDay.length).toBe(report.produced.mood_day);
    for (const insight of moodDay) {
      expect(insight.derivedVersion).toMatch(/^[0-9a-f]{8}$/);
    }

    // Verifica report
    // mood_week e mood_month non producono insight con solo 2 settimane di dati
    expect(report.skipped).toBe(2);
    expect(report.durationMs).toBeGreaterThan(0);
    expect(report.missingFeatures).toBe(0);
  }, 10000);

  it('senza feature produce 0 insight basati su valence/energy e missingFeatures > 0', async () => {
    const db = freshDb('ls-runner-no-features');
    await db.open();
    const { listens, tracks, artists } = scenarioWithoutFeatures();
    await db.listens.bulkAdd(listens);
    await db.tracks.bulkAdd(tracks);
    await db.artists.bulkAdd(artists);

    const translator = createLocaleTranslator('it');
    const report = await runAnalysisPipeline({ db, translator });

    // mood_day richiede feature → 0 insight
    expect(report.produced.mood_day).toBe(0);
    expect(report.produced.mood_week).toBe(0);

    // era ed event richiedono feature per valence/energy → 0
    // (event può produrre silence/exploration senza feature, ma non valence_drop/rise)
    expect(report.produced.era).toBe(0);

    // missingFeatures conteggiati
    expect(report.missingFeatures).toBe(listens.length);
  }, 10000);

  it('idempotenza: due run consecutive producono gli stessi insight (stessi id, nessun duplicato)', async () => {
    const db = freshDb('ls-runner-idempotent');
    await db.open();
    const { listens, tracks, artists, features } = scenarioWithFeatures();
    await db.listens.bulkAdd(listens);
    await db.tracks.bulkAdd(tracks);
    await db.artists.bulkAdd(artists);
    await db.features.bulkAdd(features);

    const translator = createLocaleTranslator('it');

    // Prima run
    const report1 = await runAnalysisPipeline({ db, translator, now: () => 1000 });
    const mood1 = await listInsightsByType(db, 'mood_day');

    // Seconda run
    const report2 = await runAnalysisPipeline({ db, translator, now: () => 2000 });
    const mood2 = await listInsightsByType(db, 'mood_day');

    // Stesso numero di insight
    expect(mood2.length).toBe(mood1.length);

    // Stessi id (deterministici)
    for (let i = 0; i < mood1.length; i++) {
      expect(mood2[i]!.id).toBe(mood1[i]!.id);
    }

    // Report della seconda run: inserted = 0 (già presenti)
    expect(report2.produced.mood_day).toBe(report1.produced.mood_day);
    expect(report2.replaced.mood_day).toBe(report1.produced.mood_day);
  }, 10000);

  it('sostituzione mood: ricalcolo non duplica', async () => {
    const db = freshDb('ls-runner-mood-replace');
    await db.open();
    const { listens, tracks, artists, features } = scenarioWithFeatures();
    await db.listens.bulkAdd(listens);
    await db.tracks.bulkAdd(tracks);
    await db.artists.bulkAdd(artists);
    await db.features.bulkAdd(features);

    const translator = createLocaleTranslator('it');

    // Prima run
    await runAnalysisPipeline({ db, translator });
    const mood1 = await listInsightsByType(db, 'mood_day');
    if (mood1.length === 0) return; // Skip se nessun mood generato

    const oldIds = mood1.map((m) => m.id);

    // Seconda run: replaceInsightsOfType non deve duplicare
    await runAnalysisPipeline({ db, translator });
    const mood2 = await listInsightsByType(db, 'mood_day');

    // Stessi id (nessun duplicato)
    for (const oldId of oldIds) {
      expect(mood2.find((m) => m.id === oldId)).toBeDefined();
    }
    expect(mood2.length).toBe(mood1.length);
  }, 10000);
});
