import { describe, expect, it } from 'vitest';
import { sha1Hex } from '../../crypto';
import {
  classifyMusicEvent,
  extractChannelId,
  extractVideoId,
  hasWatchVerbPrefix,
  mapYouTubeEvent,
  stripWatchVerbPrefix,
} from '../mapEvent';
import type { YouTubeActivityRecord } from '../types';

/** Record Takeout ben formato (header YouTube Music) con override per caso. */
const baseRecord = (overrides: Partial<YouTubeActivityRecord> = {}): YouTubeActivityRecord => ({
  header: 'YouTube Music',
  title: 'Watched Song',
  titleUrl: 'https://music.youtube.com/watch?v=abc123',
  subtitles: [{ name: 'Artist - Topic', url: 'https://www.youtube.com/channel/UCabc123' }],
  time: '2024-05-01T10:00:00Z',
  products: ['YouTube Music'],
  ...overrides,
});

describe('extractVideoId (§3.1)', () => {
  it('gestisce youtube.com/watch, music.youtube.com e youtu.be (path-short)', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://music.youtube.com/watch?v=abc_1&list=PL123')).toBe('abc_1');
    expect(extractVideoId('https://youtu.be/short_id')).toBe('short_id');
  });

  it('rifiuta host non-Google, URL senza videoId e URL malformati', () => {
    expect(extractVideoId('https://vimeo.com/watch?v=abc')).toBeNull();
    expect(extractVideoId('https://www.youtube.com/channel/UC123')).toBeNull();
    expect(extractVideoId('https://notyoutube.com/watch?v=abc')).toBeNull();
    expect(extractVideoId('non è un url')).toBeNull();
    expect(extractVideoId(null)).toBeNull();
    expect(extractVideoId(undefined)).toBeNull();
  });
});

describe('extractChannelId (§3.1.2)', () => {
  it("estrae l'id dal pattern /channel/<id> e scarta gli altri formati", () => {
    expect(extractChannelId('https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw?si=x')).toBe(
      'UCuAXFkgsw1L7xaCfnd5JJOw',
    );
    expect(extractChannelId('https://www.youtube.com/@handle')).toBeNull();
    expect(extractChannelId(null)).toBeNull();
  });
});

describe('prefissi verbo localizzati (E.YT.3, §10)', () => {
  it('riconosce i prefissi curati EN/IT, case-insensitive', () => {
    expect(hasWatchVerbPrefix('Watched X')).toBe(true);
    expect(hasWatchVerbPrefix('watched x')).toBe(true);
    expect(hasWatchVerbPrefix('Guardato Y')).toBe(true);
    expect(hasWatchVerbPrefix('Visto Z')).toBe(false);
    expect(hasWatchVerbPrefix('Liked W')).toBe(false);
  });

  it('strip: rimuove il prefisso noto, fallback conservativo title intero', () => {
    expect(stripWatchVerbPrefix('Watched Never Gonna Give You Up')).toBe('Never Gonna Give You Up');
    expect(stripWatchVerbPrefix('Guardato Brano In Italiano')).toBe('Brano In Italiano');
    expect(stripWatchVerbPrefix('watched minuscolo')).toBe('minuscolo');
    // Fallback §10: nessun prefisso matcha → title intero (mai tagliare a caso).
    expect(stripWatchVerbPrefix('Visto In Altra Lingua')).toBe('Visto In Altra Lingua');
    expect(stripWatchVerbPrefix('Liked Brano')).toBe('Liked Brano');
  });
});

describe('classifyMusicEvent — filtro E6 (§3.3)', () => {
  it('regola 1: header "YouTube Music" → musica', () => {
    expect(classifyMusicEvent(baseRecord())).toBe('music');
  });

  it('regola 2a: host music.youtube.com → musica', () => {
    expect(classifyMusicEvent(baseRecord({ header: 'YouTube' }))).toBe('music');
  });

  it('regola 2b: canale "- Topic" → musica', () => {
    expect(
      classifyMusicEvent(
        baseRecord({
          header: 'YouTube',
          titleUrl: 'https://www.youtube.com/watch?v=x',
        }),
      ),
    ).toBe('music');
    expect(
      classifyMusicEvent(
        baseRecord({
          header: 'YouTube',
          titleUrl: 'https://www.youtube.com/watch?v=x',
          subtitles: [{ name: 'Artist  -  Topic', url: 'https://www.youtube.com/channel/UC1' }],
        }),
      ),
    ).toBe('music');
  });

  it('regola 2c: canale VEVO → musica', () => {
    expect(
      classifyMusicEvent(
        baseRecord({
          header: 'YouTube',
          titleUrl: 'https://www.youtube.com/watch?v=x',
          subtitles: [{ name: 'Queen VEVO', url: 'https://www.youtube.com/channel/UC2' }],
        }),
      ),
    ).toBe('music');
  });

  it('regola 2d: products include "YouTube Music" → musica (fallback AC campo products)', () => {
    expect(
      classifyMusicEvent(
        baseRecord({
          header: 'YouTube',
          titleUrl: 'https://www.youtube.com/watch?v=x',
          subtitles: [{ name: 'Canale Generico', url: 'https://www.youtube.com/channel/UC3' }],
          products: ['YouTube Music'],
        }),
      ),
    ).toBe('music');
  });

  it('regola 2e: canale generico → non-musica', () => {
    expect(
      classifyMusicEvent(
        baseRecord({
          header: 'YouTube',
          titleUrl: 'https://www.youtube.com/watch?v=x',
          subtitles: [{ name: 'TechChannel', url: 'https://www.youtube.com/channel/UC4' }],
          products: ['YouTube'],
        }),
      ),
    ).toBe('nonMusic');
  });

  it('regola 3: header assente o altro → non-ascolto', () => {
    const noHeader = baseRecord();
    delete noHeader.header;
    expect(classifyMusicEvent(baseRecord({ header: 'Search' }))).toBe('nonListen');
    expect(classifyMusicEvent(noHeader)).toBe('nonListen');
  });
});

describe('mapYouTubeEvent (§3.1, §5, §7)', () => {
  it('mappa un evento musica con eventKey stabile e semantica D2/E.YT.5', async () => {
    const { raw, discardReason } = await mapYouTubeEvent(
      baseRecord({ title: 'Watched Song X', time: '2024-05-01T10:00:00Z' }),
    );
    expect(discardReason).toBeNull();
    expect(raw).not.toBeNull();
    const rawEvent = raw!;
    expect(rawEvent.platform).toBe('youtube_music');
    // eventKey §3.1: sha1(videoId + '|' + rawTime) — solo dati grezzi.
    expect(rawEvent.sourceEventId).toBe(await sha1Hex('abc123|2024-05-01T10:00:00Z'));
    expect(rawEvent.rawTimestamp).toBe(Date.parse('2024-05-01T10:00:00Z'));
    expect(rawEvent.rawStartedAt).toBe(rawEvent.rawTimestamp); // D2: time è inizio ascolto
    expect(rawEvent.sourceDurationMs).toBe(0); // E.YT.5: durata non presente
    expect(rawEvent.completed).toBe(false);
    expect(rawEvent.skipped).toBeNull();
    expect(rawEvent.shuffle).toBeNull();
    expect(rawEvent.offline).toBeNull();
    expect(rawEvent.incognito).toBeNull();
    expect(rawEvent.reasonStart).toBeNull();
    expect(rawEvent.reasonEnd).toBeNull();
    expect(rawEvent.deviceType).toBe('unknown');
    expect(rawEvent.deviceDetail).toBeNull();
    expect(rawEvent.ip).toBeNull();
    expect(rawEvent.country).toBeNull(); // privacy §7: locationInfos scartati
    expect(rawEvent.sourceTrackUri).toBe('youtube_music:video:abc123'); // §3.1.1
    expect(rawEvent.sourceArtistUri).toBe('youtube_music:channel:UCabc123'); // §3.1.2
    expect(rawEvent.sourceTrackName).toBe('Song X');
    expect(rawEvent.sourceArtistName).toBe('Artist - Topic');
    expect(rawEvent.sourceAlbumName).toBeNull();
    expect(rawEvent.isrc).toBeNull();
    expect(rawEvent.mbid).toBeNull();
  });

  it('E.YT.2: verbo di watch ma nessun videoId → skip con unwatchable', async () => {
    const removed = baseRecord({
      title: 'Watched https://music.youtube.com/watch?v=removed',
    });
    delete removed.titleUrl;
    delete removed.subtitles;
    const { raw, discardReason } = await mapYouTubeEvent(removed);
    expect(raw).toBeNull();
    expect(discardReason).toBe('unwatchable');
  });

  it('eventi non-ascolto (Liked/Searched) → nonListen, skip silenzioso', async () => {
    const liked = baseRecord({ header: 'YouTube', title: 'Liked Song' });
    delete liked.titleUrl;
    const likedResult = await mapYouTubeEvent(liked);
    expect(likedResult.raw).toBeNull();
    expect(likedResult.discardReason).toBe('nonListen');
    const searched = baseRecord({ header: 'Search', title: 'Searched for X' });
    delete searched.titleUrl;
    const searchedResult = await mapYouTubeEvent(searched);
    expect(searchedResult.raw).toBeNull();
    expect(searchedResult.discardReason).toBe('nonListen');
  });

  it('non-musica (canale generico) → nonMusic', async () => {
    const { raw, discardReason } = await mapYouTubeEvent(
      baseRecord({
        header: 'YouTube',
        titleUrl: 'https://www.youtube.com/watch?v=tech',
        subtitles: [{ name: 'TechChannel', url: 'https://www.youtube.com/channel/UCtech' }],
        products: ['YouTube'],
      }),
    );
    expect(raw).toBeNull();
    expect(discardReason).toBe('nonMusic');
  });

  it('E.YT.3 fallback: title senza prefisso noto → name = title intero', async () => {
    const { raw } = await mapYouTubeEvent(baseRecord({ title: 'Song Without Known Verb' }));
    expect(raw?.sourceTrackName).toBe('Song Without Known Verb');
  });

  it('timestamp non interpretabile → skip silenzioso', async () => {
    const { raw, discardReason } = await mapYouTubeEvent(baseRecord({ time: 'non-una-data' }));
    expect(raw).toBeNull();
    expect(discardReason).toBe('nonListen');
  });

  it('subtitles assenti → artista null (pipeline risolve "Unknown"), channelId null', async () => {
    const { raw } = await mapYouTubeEvent(baseRecord({ subtitles: [] }));
    expect(raw?.sourceArtistName).toBeNull();
    expect(raw?.sourceArtistUri).toBeNull();
  });
});
