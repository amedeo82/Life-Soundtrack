import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { detectSpotify } from '../detect';
import { listZipEntries } from '../zip';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../../../../../fixtures/synthetic-history/spotify-sample.json', import.meta.url),
);

/** Detection del formato export Spotify — spotify.md §2.2. */
describe('detectSpotify (§2.2)', () => {
  it('riconosce il JSON fixture (wrapper events con campi ts/ms_played)', async () => {
    const blob = new Blob([readFileSync(FIXTURE_PATH)]);
    await expect(detectSpotify(blob)).resolves.toBe(true);
  });

  it('riconosce un array JSON di eventi (formato produzione)', async () => {
    const json = JSON.stringify([
      { ts: '2024-01-01T00:00:00Z', ms_played: 1000, spotify_track_uri: 'spotify:track:x' },
    ]);
    await expect(detectSpotify(new Blob([json]))).resolves.toBe(true);
  });

  it('riconosce uno ZIP con Streaming_History_Audio_*.json', async () => {
    const zip = zipSync({
      'Streaming_History_Audio_2024_0.json': new TextEncoder().encode('[{"ts":"2024-01-01T00:00:00Z","ms_played":1}]'),
      'Userdata.json': new TextEncoder().encode('{}'),
    });
    await expect(detectSpotify(new Blob([zip]))).resolves.toBe(true);
  });

  it('rifiuta uno ZIP senza streaming history audio (AC CarDetection)', async () => {
    const zip = zipSync({
      'CarDetectionEvent.json': new TextEncoder().encode('[{"ts":"2024-01-01T00:00:00Z","car":true}]'),
      'Userdata.json': new TextEncoder().encode('{}'),
    });
    await expect(detectSpotify(new Blob([zip]))).resolves.toBe(false);
  });

  it('rifiuta CSV/generi non-JSON (es. export Apple Music)', async () => {
    const csv = 'Apple Music,Play Date UTC\n"Song","2024-01-01 00:00:00"\n';
    await expect(detectSpotify(new Blob([csv]))).resolves.toBe(false);
  });

  it('rifiuta JSON senza i campi irrinunciabili ts/ms_played (§2.2)', async () => {
    await expect(detectSpotify(new Blob(['[{"foo":1}]']))).resolves.toBe(false);
  });

  it('rifiuta blob vuoti e ZIP corrotti', async () => {
    await expect(detectSpotify(new Blob([]))).resolves.toBe(false);
    await expect(detectSpotify(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff])]))).resolves.toBe(
      false,
    );
  });
});

describe('listZipEntries', () => {
  it('elenca i nomi dei file del central directory', async () => {
    const zip = zipSync({
      'Streaming_History_Audio_2023_0.json': new TextEncoder().encode('[]'),
      'Follow.json': new TextEncoder().encode('[]'),
      'Playlist1.json': new TextEncoder().encode('{"name":"X","items":[]}'),
    });
    const names = await listZipEntries(new Blob([zip]));
    expect(names.sort()).toEqual([
      'Follow.json',
      'Playlist1.json',
      'Streaming_History_Audio_2023_0.json',
    ]);
  });
});
