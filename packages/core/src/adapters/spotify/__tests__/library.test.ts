import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../../db';
import { importLibrary } from '../../importSession';
import type { PrivacySettings } from '../../../schema';
import { SpotifyAdapter } from '../adapter';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../../../../../fixtures/synthetic-history/spotify-sample.json', import.meta.url),
);

const PRIVACY_OFF: PrivacySettings = {
  retainIp: false,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const fixtureBytes = (): Uint8Array<ArrayBuffer> => {
  const src = readFileSync(FIXTURE_PATH);
  const copy = new Uint8Array(src.byteLength);
  copy.set(src);
  return copy;
};

/**
 * Elaborazione dei file library/playlist/follow dell'export GDPR Spotify
 * (T0.3.6, spotify.md §2.3, §3.4). La risoluzione uri → trackId avviene
 * in `importLibrary` contro le track già presenti nel DB (popolate da un
 * import della cronologia precedente).
 */
describe('SpotifyAdapter — library/playlist/follow (§3.4)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`spotify-library-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('parseLibrary: ZIP con YourLibrary + Playlist + Follow produce snapshot', async () => {
    const zip = zipSync({
      'YourLibrary.json': new TextEncoder().encode(
        JSON.stringify({
          tracks: [{ track: { trackUri: 'spotify:track:lib-1' }, addedDate: '2024-01-15' }],
          albums: [
            { album: { uri: 'spotify:album:lib-1', name: 'Album Lib 1' }, addedDate: '2024-01-15' },
          ],
        }),
      ),
      'Playlist1.json': new TextEncoder().encode(
        JSON.stringify({
          name: 'My Mix',
          lastModifiedDate: '2024-03-20T12:00:00Z',
          items: [
            { addedDate: '2024-03-20T12:00:00Z', track: { trackUri: 'spotify:track:pl-1' } },
            { addedDate: '2024-03-19T10:00:00Z', track: { trackUri: 'spotify:track:pl-2' } },
          ],
        }),
      ),
      'Follow.json': new TextEncoder().encode(
        JSON.stringify([
          { artist: { name: 'Some Artist', uri: 'spotify:artist:a1' } },
          { artist: { name: 'Another Artist', uri: 'spotify:artist:a2' } },
        ]),
      ),
    });
    const adapter = new SpotifyAdapter();
    const snap = await adapter.parseLibrary(new Blob([new Uint8Array(zip)]));
    expect(snap.playlists).toHaveLength(1);
    expect(snap.playlists[0]!.name).toBe('My Mix');
    expect(snap.playlistItems).toHaveLength(2);
    expect(snap.libraryItems.filter((r) => r.kind === 'saved_track')).toHaveLength(1);
    expect(snap.libraryItems.filter((r) => r.kind === 'followed_artist')).toHaveLength(2);
    expect(snap.libraryItems.filter((r) => r.kind === 'saved_album')).toHaveLength(1);
  });

  it('importLibrary: risolve uri → trackId e popola library/playlists', async () => {
    // 1) Import cronologia per popolare le track (platformIds.spotify = "4u7EnebtmKWzUH433cf5Qv")
    await runImportLite(db, fixtureBytes());

    // 2) Import library
    const zip = zipSync({
      'YourLibrary.json': new TextEncoder().encode(
        JSON.stringify({
          tracks: [
            {
              track: { trackUri: 'spotify:track:4u7EnebtmKWzUH433cf5Qv' },
              addedDate: '2024-04-01',
            },
          ],
        }),
      ),
      'Playlist1.json': new TextEncoder().encode(
        JSON.stringify({
          name: 'Test Playlist',
          lastModifiedDate: '2024-04-01T00:00:00Z',
          items: [
            {
              addedDate: '2024-04-01T00:00:00Z',
              track: { trackUri: 'spotify:track:4u7EnebtmKWzUH433cf5Qv' },
            },
            { addedDate: '2024-04-02T00:00:00Z', track: { trackUri: 'spotify:track:unknown' } },
          ],
        }),
      ),
      'Follow.json': new TextEncoder().encode(
        JSON.stringify([{ artist: { name: 'Queen', uri: 'spotify:artist:q1' } }]),
      ),
    });
    const adapter = new SpotifyAdapter();
    const snap = await adapter.parseLibrary(new Blob([new Uint8Array(zip)]));
    const summary = await importLibrary(db, snap);

    expect(summary.playlists).toBe(1);
    expect(summary.playlistItems).toBe(1); // uno risolto, uno (uri sconosciuto) scartato
    expect(summary.playlistItemsSkipped).toBe(1);
    // saved_track risolto + followed_artist "Queen" risolto (esiste nel DB)
    expect(summary.libraryItems).toBe(2);
    expect(summary.libraryItemsSkipped).toBe(0);

    expect(await db.playlists.count()).toBe(1);
    expect(await db.playlistItems.count()).toBe(1);
    // saved_track + followed_artist "Queen" risolto
    expect(await db.library.count()).toBe(2);
    // Follow: l'artista Queen esiste già nel DB (import cronologia) →
    expect(await db.artists.filter((a) => a.name === 'Queen').first()).toBeDefined();
  });
});

// Helper locale (evita di importare runImport in cima al file: dedup test isolation)
async function runImportLite(db: LifeSoundtrackDB, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const { runImport } = await import('../../importSession');
  const { SpotifyAdapter } = await import('../adapter');
  await runImport(db, new SpotifyAdapter(), new Blob([bytes]), { privacy: PRIVACY_OFF });
}
