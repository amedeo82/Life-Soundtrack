import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../../db';
import { recount } from '../../../db';
import { runImport } from '../../importSession';
import { AdapterError } from '../../errors';
import { sha1Hex } from '../../crypto';
import type { PrivacySettings } from '../../../schema';
import { YouTubeMusicAdapter } from '../adapter';

const FIXTURE_PATH = fileURLToPath(
  new URL('../../../../../../fixtures/synthetic-history/youtube-sample.json', import.meta.url),
);

const PRIVACY_DEFAULTS: PrivacySettings = {
  retainIp: false,
  retainCountry: true,
  retainCity: false,
  retainDeviceType: true,
  retainDeviceDetail: false,
  deriveContext: true,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const fixtureBytes = (): Uint8Array => new Uint8Array(readFileSync(FIXTURE_PATH));
const fixtureBlob = (): Blob => new Blob([fixtureBytes() as unknown as ArrayBuffer]);

/** EventKey §3.1: 'youtube_music:' + sha1(videoId + '|' + rawTime). */
const eventKeyOf = async (videoId: string, rawTime: string): Promise<string> =>
  `youtube_music:${await sha1Hex(`${videoId}|${rawTime}`)}`;

/**
 * Import end-to-end del fixture `youtube-sample.json` v1.0 (Story 1.1):
 * 13 eventi nel file — 9 importati (8 Track uniche dopo il merge DEDUP-3
 * sulla coppia con videoId diversi, 8 artisti), 4 scartati (1 E6 non-musica
 * con warning, 1 E.YT.2 unwatchable con warning, 2 non-ascolto in silenzio).
 * Vedi `_expectedOutput` nel fixture (la derivazione interna è il canone).
 */
describe('YouTubeMusicAdapter — import fixture (§8: casi 1-12)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`yt-adapter-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('caso 1 (happy path): 9 eventi con semantica D2/E.YT.5, eventKey stabile, day UTC', async () => {
    const summary = await runImport(db, new YouTubeMusicAdapter(), fixtureBlob(), {
      privacy: PRIVACY_DEFAULTS,
      fileName: 'watch-history.json',
    });

    expect(summary.status).toBe('done');
    expect(summary.eventsParsed).toBe(9);
    expect(summary.eventsInserted).toBe(9);
    expect(summary.eventsDuplicated).toBe(0);
    expect(summary.fileHash).toMatch(/^[0-9a-f]{64}$/);

    // _expectedOutput (derivazione interna come canone)
    expect(await db.listens.count()).toBe(9);
    expect(await db.tracks.count()).toBe(8);
    expect(await db.artists.count()).toBe(8);

    // Casi 4-5 (§8): warning E6 ed E.YT.2; i non-ascolto (Liked/Search) sono
    // skip silenziosi → nessun altro codice.
    expect(summary.warningCounts['adapter.youtube_music.warn.nonMusicSkipped']).toBe(1);
    expect(summary.warningCounts['adapter.youtube_music.warn.unwatchableSkipped']).toBe(1);
    expect(summary.warnings).toEqual([
      'adapter.youtube_music.warn.nonMusicSkipped',
      'adapter.youtube_music.warn.unwatchableSkipped',
    ]);

    // EventKey §3.1 + startedAt = timestamp (D2) + durationMs = 0 (E.YT.5).
    const first = await db.listens.get(await eventKeyOf('vid_happy_1', '2024-03-15T20:30:00Z'));
    expect(first).toBeDefined();
    expect(first!.platform).toBe('youtube_music');
    expect(first!.startedAt).toBe(first!.timestamp);
    expect(first!.durationMs).toBe(0);
    expect(first!.day).toBe('2024-03-15');
    expect(first!.importId).toBe(summary.id);

    // Caso 6 (§8): nessuna durata ovunque → completed = false, skipped = false.
    // Caso 9 (§8): privacy — country sempre null, nessun dato di location.
    for (const listen of await db.listens.toArray()) {
      expect(listen.durationMs).toBe(0);
      expect(listen.startedAt).toBe(listen.timestamp);
      expect(listen.completed).toBe(false);
      expect(listen.skipped).toBe(false);
      expect(listen.platform).toBe('youtube_music');
      expect(listen.country).toBeNull();
      expect(listen.ip).toBeNull();
      expect(listen.deviceType).toBe('unknown');
    }

    // Caso 8 (§8): E10 — time +02:00 → timestamp UTC e cambio giorno.
    const tz = await db.listens.get(await eventKeyOf('vid_tz', '2024-05-01T00:30:00+02:00'));
    expect(tz).toBeDefined();
    expect(tz!.timestamp).toBe(Date.parse('2024-04-30T22:30:00Z'));
    expect(tz!.day).toBe('2024-04-30');

    // Caso 11 (§8): prefisso localizzato IT rimosso dal name.
    const localized = await db.tracks.filter((t) => t.name === 'Brano In Italiano').toArray();
    expect(localized).toHaveLength(1);
    expect(await db.tracks.filter((t) => t.name.startsWith('Guardato')).count()).toBe(0);
    // platformIds Track (§3.1.1): { youtube_music: videoId }.
    expect(localized[0]!.platformIds.youtube_music).toBe('vid_localized');
    expect(localized[0]!.albumId).toBeNull();
    expect(localized[0]!.isrc).toBeNull();
    expect(localized[0]!.durationMs).toBeNull();

    // Caso 4 (§8): il video non musicale non è nel DB.
    expect(await db.tracks.filter((t) => t.name.includes('Tutorial Docker')).count()).toBe(0);
  });

  it('caso 10 (§8): DEDUP — stesso brano con videoId diversi → una Track, 2 ascolti', async () => {
    await runImport(db, new YouTubeMusicAdapter(), fixtureBlob(), { privacy: PRIVACY_DEFAULTS });
    const sinfonia = await db.tracks.filter((t) => t.name === 'Sinfonia Della Vita').toArray();
    expect(sinfonia).toHaveLength(1);
    expect(await db.listens.where('trackId').equals(sinfonia[0]!.id).count()).toBe(2);
    // DEDUP-3 degradato (§6): durata assente → durationMs resta null.
    expect(sinfonia[0]!.durationMs).toBeNull();
    // §3.1.2: channelId nativo dell'artista su Artist.platformIds.
    const artist = await db.artists.get(sinfonia[0]!.artistId);
    expect(artist).toBeDefined();
    expect(artist!.name).toBe('Sinfonia Artist - Topic');
    expect(artist!.platformIds.youtube_music).toBe('UC_dedup');
    await recount(db);
    expect(sinfonia[0]!.listenCount).toBe(2);
  });

  it('caso 2 (§8): re-import dello stesso file è idempotente (eventKey §3.1)', async () => {
    const adapter = new YouTubeMusicAdapter();
    const first = await runImport(db, adapter, fixtureBlob(), { privacy: PRIVACY_DEFAULTS });
    const second = await runImport(db, adapter, fixtureBlob(), { privacy: PRIVACY_DEFAULTS });

    expect(first.eventsInserted).toBe(9);
    expect(second.eventsInserted).toBe(0);
    expect(second.eventsDuplicated).toBe(9);
    expect(second.status).toBe('done');
    expect(await db.listens.count()).toBe(9);
    expect(await db.tracks.count()).toBe(8);
    expect(await db.artists.count()).toBe(8);
  });

  it('caso 7 (§8): E.YT.6 — stesso evento in due export → un solo ListenEvent', async () => {
    const adapter = new YouTubeMusicAdapter();
    await runImport(db, adapter, fixtureBlob(), { privacy: PRIVACY_DEFAULTS });
    const duplicate = {
      header: 'YouTube Music',
      title: 'Watched Never Gonna Give You Up',
      titleUrl: 'https://music.youtube.com/watch?v=vid_happy_1',
      subtitles: [
        { name: 'Rick Astley - Topic', url: 'https://www.youtube.com/channel/UC_happy_1' },
      ],
      time: '2024-03-15T20:30:00Z',
    };
    const second = await runImport(
      db,
      adapter,
      new Blob([new TextEncoder().encode(JSON.stringify([duplicate])) as unknown as ArrayBuffer]),
      { privacy: PRIVACY_DEFAULTS },
    );
    expect(second.eventsParsed).toBe(1);
    expect(second.eventsInserted).toBe(0);
    expect(second.eventsDuplicated).toBe(1);
    expect(await db.listens.count()).toBe(9);
  });

  it('caso 12 (§8): HTML rifiutato → detect false, runImport INVALID_FORMAT, nessuna scrittura', async () => {
    const html = new Blob(['<!DOCTYPE html><html><body>Watch history</body></html>']);
    expect(await new YouTubeMusicAdapter().detect(html)).toBe(false);
    await expect(
      runImport(db, new YouTubeMusicAdapter(), html, { privacy: PRIVACY_DEFAULTS }),
    ).rejects.toThrow(AdapterError);
    expect(await db.listens.count()).toBe(0);
    const record = (await db.imports.toArray())[0]!;
    expect(record!.status).toBe('failed');
  });

  it('ZIP Takeout con nomi localizzati (E.YT.1): importa la history, scarta search-history senza warning spuri (D7)', async () => {
    const searchHistory = JSON.stringify([
      { header: 'Search', title: 'Searched for Queen', time: '2024-03-21T10:00:00Z' },
    ]);
    const zip = zipSync({
      'Takeout/YouTube e YouTube Music/history/watch-history.json': fixtureBytes(),
      'Takeout/YouTube e YouTube Music/history/search-history.json': new TextEncoder().encode(
        searchHistory,
      ),
      'Takeout/README.txt': new TextEncoder().encode('testo non json'),
    });
    const summary = await runImport(
      db,
      new YouTubeMusicAdapter(),
      new Blob([zip as unknown as ArrayBuffer]),
      { privacy: PRIVACY_DEFAULTS, fileName: 'takeout.zip' },
    );
    expect(summary.status).toBe('done');
    expect(summary.eventsInserted).toBe(9);
    expect(await db.listens.count()).toBe(9);
    // I file fuori scope (D7) non generano né eventi né warning.
    expect(summary.warnings).toEqual([
      'adapter.youtube_music.warn.nonMusicSkipped',
      'adapter.youtube_music.warn.unwatchableSkipped',
    ]);
  });

  it('file troncato a metà ⇒ partial con eventi già scritti (05§4)', async () => {
    const full = new TextDecoder().decode(fixtureBytes());
    const cut = new Blob([full.slice(0, Math.floor(full.length * 0.7))]);
    let failure: unknown;
    try {
      await runImport(db, new YouTubeMusicAdapter(), cut, { privacy: PRIVACY_DEFAULTS });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AdapterError);
    expect((failure as AdapterError).code).toBe('TRUNCATED');
    expect((failure as AdapterError).recoverable).toBe(true);

    const record = (await db.imports.toArray())[0]!;
    expect(record!.status).toBe('partial');
    expect(record!.eventsInserted).toBeGreaterThan(0);
    expect(await db.listens.count()).toBe(record!.eventsInserted);
  });

  it('cancellazione cooperativa: AbortSignal ⇒ status partial senza errori (05§4)', async () => {
    const controller = new AbortController();
    const summary = await runImport(db, new YouTubeMusicAdapter(), fixtureBlob(), {
      privacy: PRIVACY_DEFAULTS,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    expect(summary.status).toBe('partial');
    expect(summary.eventsInserted).toBe(1);
  });

  it("recount() dopo l'import resta coerente (02§7 MIG-4)", async () => {
    await runImport(db, new YouTubeMusicAdapter(), fixtureBlob(), { privacy: PRIVACY_DEFAULTS });
    await recount(db);
    const tracks = await db.tracks.toArray();
    const totalListens = tracks.reduce((sum, t) => sum + t.listenCount, 0);
    expect(totalListens).toBe(9);
    expect(await db.listens.count()).toBe(9);
  });
});
