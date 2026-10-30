import { describe, expect, it } from 'vitest';
import { SCENARIOS, loadScenario } from '../../analysis/__tests__/helpers';
import { buildFeatureIndex } from '../../analysis/mood/features';
import type { Artist, AudioFeatures, Track } from '../../schema';
import { createEnrichmentCascade } from '../cascade';
import { createHeuristicProvider } from '../heuristic';
import { createMemoryFeatureStore } from '../storage';
import type { AudioFeatureProvider, FeatureContext } from '../types';
import { createFakeClock } from './helpers';

/**
 * La pipeline sui **fixture di scenario** — `21-AUDIO-FEATURES.md` §15.3
 * (T-AF.13), `10-TESTING.md` §3.3.
 *
 * I fixture dichiarano gli scenari di vita; qui il contratto è che la
 * pipeline è **deterministica**: per ogni brano esattamente una feature, e
 * la sorgente dipende solo dai dati del brano (MBID presente ⇒ Acoustic
 * Brainz, assente ⇒ euristico).
 *
 * Il provider AcousticBrainz è finto ma **non triviale**: risponde ai
 * brani con MBID (che sono il 10% dei fixture) con valori derivati
 * deterministicamente dall'id del brano. Nessuna chiamata di rete.
 */

/** Un provider AcousticBrainz finto e deterministico. */
function fakeAcousticBrainz(): AudioFeatureProvider {
  return {
    id: 'acousticbrainz',
    canHandle: (track: Track) => typeof track.mbid === 'string' && track.mbid.length > 0,
    fetch: async (track: Track) => {
      const seed = track.id
        .split('')
        .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1000, 7);
      const valence = (seed % 100) / 100;
      const energy = ((seed * 7) % 100) / 100;
      return {
        trackId: track.id,
        valence,
        energy,
        danceability: ((seed * 13) % 100) / 100,
        acousticness: null,
        instrumentalness: null,
        speechiness: null,
        liveness: null,
        tempo: null,
        key: null,
        mode: null,
        loudness: null,
        timeSignature: null,
        source: 'acousticbrainz',
        fetchedAt: 0,
        schemaVersion: 1,
      };
    },
  };
}

/** Il contesto di un brano, ricavato dal fixture. */
function contextFor(track: Track, artists: ReadonlyMap<string, Artist>): FeatureContext {
  const artist = artists.get(track.artistId);
  return {
    artistName: artist?.name ?? 'Artista sconosciuto',
    artistGenres: artist?.genres ?? [],
  };
}

/** Esegue la pipeline su uno scenario e restituisce le righe prodotte. */
async function runScenario(name: (typeof SCENARIOS)[number]): Promise<{
  rows: AudioFeatures[];
  withMbid: number;
  tracks: number;
}> {
  const scenario = loadScenario(name);
  const artists = new Map(scenario.artists.map((artist) => [artist.id, artist]));
  const store = createMemoryFeatureStore();
  const cascade = createEnrichmentCascade({
    store,
    policy: { isEnabled: () => true },
    clock: createFakeClock(),
    providers: {
      acousticbrainz: fakeAcousticBrainz(),
      heuristic: createHeuristicProvider({ clock: createFakeClock() }),
    },
  });

  for (const track of scenario.tracks) {
    await cascade.enrich(track, contextFor(track, artists));
  }

  return {
    rows: await store.all(),
    withMbid: scenario.tracks.filter((track) => track.mbid !== null).length,
    tracks: scenario.tracks.length,
  };
}

describe('T-AF.13 — i tre scenari di fixtures/scenarios', () => {
  for (const name of SCENARIOS) {
    it(`${name}: una feature per brano, con sorgente deterministica`, async () => {
      const { rows, withMbid, tracks } = await runScenario(name);

      expect(rows).toHaveLength(tracks);
      expect(
        rows.every((row) => row.source === 'acousticbrainz' || row.source === 'heuristic'),
      ).toBe(true);

      const acoustic = rows.filter((row) => row.source === 'acousticbrainz');
      const heuristic = rows.filter((row) => row.source === 'heuristic');
      expect(acoustic).toHaveLength(withMbid);
      expect(heuristic).toHaveLength(tracks - withMbid);
    });

    it(`${name}: due esecuzioni producono la stessa tabella`, async () => {
      const first = await runScenario(name);
      const second = await runScenario(name);

      expect(second.rows).toEqual(first.rows);
    });
  }

  it('il mood tracker vede solo le feature misurate, non quelle euristiche (21§12)', async () => {
    const { rows } = await runScenario('lockdown-2020');
    const index = buildFeatureIndex(rows);

    const measured = rows.filter((row) => row.source === 'acousticbrainz').length;
    expect(index.size).toBe(measured);
    expect(index.size).toBeLessThan(rows.length);
  });
});
