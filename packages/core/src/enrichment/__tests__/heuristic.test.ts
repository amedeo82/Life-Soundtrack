import { describe, expect, it } from 'vitest';
import {
  GENRE_ACOUSTICNESS,
  GENRE_DANCEABILITY,
  GENRE_TEMPO,
  createHeuristicProvider,
  estimateFromGenres,
  normalizeGenre,
} from '../heuristic';
import { createFakeClock, makeContext, makeTrack } from './helpers';

/**
 * Il fallback euristico — `21-AUDIO-FEATURES.md` §8.
 *
 * I tre limiti che il test verifica sono quelli dichiarati dalla spec:
 * nessuna rete, nessuna stima di valence/energy, nessuna misura inventata.
 */
describe('le stime dai generi (21§8.1)', () => {
  it('il BPM è stimato dal genere', async () => {
    const provider = createHeuristicProvider({ clock: createFakeClock() });
    const feature = await provider.fetch(makeTrack({ genres: ['house'] }), makeContext());

    expect(feature?.tempo).toBe(GENRE_TEMPO.house);
    expect(feature?.source).toBe('heuristic');
  });

  it("la ballabilità e l'acustica sono stimate dal genere", async () => {
    const provider = createHeuristicProvider({ clock: createFakeClock() });
    const feature = await provider.fetch(makeTrack({ genres: ['techno'] }), makeContext());

    expect(feature?.danceability).toBe(GENRE_DANCEABILITY.techno);
    expect(feature?.acousticness).toBe(GENRE_ACOUSTICNESS.techno);
  });

  it("il genere dell'artista è usato quando il brano non ha generi", async () => {
    const provider = createHeuristicProvider({ clock: createFakeClock() });
    const feature = await provider.fetch(
      makeTrack({ genres: [] }),
      makeContext({ artistGenres: ['jazz'] }),
    );

    expect(feature?.tempo).toBe(GENRE_TEMPO.jazz);
  });

  it("senza generi non c'è stima: nessuna riga vuota (21§11.3)", async () => {
    const provider = createHeuristicProvider({ clock: createFakeClock() });
    const feature = await provider.fetch(makeTrack({ genres: [] }), makeContext());

    expect(feature).toBeNull();
  });

  it('valence ed energy NON sono stimati (21§8.1, D-AF.4)', async () => {
    const provider = createHeuristicProvider({ clock: createFakeClock() });
    const feature = await provider.fetch(makeTrack({ genres: ['pop'] }), makeContext());

    expect(feature?.valence).toBeNull();
    expect(feature?.energy).toBeNull();
  });

  it("i campi che l'euristico non copre restano null", async () => {
    const provider = createHeuristicProvider({ clock: createFakeClock() });
    const feature = await provider.fetch(makeTrack({ genres: ['pop'] }), makeContext());

    expect(feature?.instrumentalness).toBeNull();
    expect(feature?.speechiness).toBeNull();
    expect(feature?.liveness).toBeNull();
    expect(feature?.key).toBeNull();
    expect(feature?.mode).toBeNull();
    expect(feature?.loudness).toBeNull();
    expect(feature?.timeSignature).toBeNull();
  });
});

describe('il match dei generi è deterministico', () => {
  it('il match esatto vince sul match per contenimento', () => {
    expect(estimateFromGenres(['rock'], GENRE_TEMPO)).toBe(GENRE_TEMPO.rock);
  });

  it('senza match esatto vince la chiave più lunga (la più specifica)', () => {
    expect(estimateFromGenres(['indie rock'], GENRE_TEMPO)).toBe(GENRE_TEMPO['indie rock']);
    expect(estimateFromGenres(['electronic rock'], GENRE_TEMPO)).toBe(GENRE_TEMPO.electronic);
  });

  it('nessun genere corrispondente ⇒ null', () => {
    expect(estimateFromGenres(['polka'], GENRE_TEMPO)).toBeNull();
  });

  it('la normalizzazione del genere ignora maiuscole e spazi', () => {
    expect(normalizeGenre('  House ')).toBe('house');
  });

  it('le tabelle contengono solo valori in [0,1] per ballabilità e acustica', () => {
    for (const value of Object.values(GENRE_DANCEABILITY)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (const value of Object.values(GENRE_ACOUSTICNESS)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('i BPM stimati sono in un intervallo sensato', () => {
    for (const value of Object.values(GENRE_TEMPO)) {
      expect(value).toBeGreaterThanOrEqual(50);
      expect(value).toBeLessThanOrEqual(200);
    }
  });
});
