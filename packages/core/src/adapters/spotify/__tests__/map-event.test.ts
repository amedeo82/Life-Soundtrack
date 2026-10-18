import { describe, expect, it } from 'vitest';
import {
  deriveCompleted,
  deriveSkipped,
  E1_NO_CATALOG_THRESHOLD_MS,
  extractTrackId,
  mapDeviceType,
  mapSpotifyEvent,
  normalizeOfflineTimestamp,
} from '../mapEvent';
import type { SpotifyStreamingRecord } from '../types';

/** Regola `skipped` derivata E1 — spotify.md §3.3. */
describe('deriveSkipped (E1, §3.3)', () => {
  const base = { ts: '2024-01-01T00:00:00Z', platform: 'android', ms_played: 200_000 };

  it('skipped === true vince sempre', () => {
    expect(deriveSkipped({ ...base, skipped: true, reason_end: 'trackdone' })).toBe(true);
  });

  it('reason_end fwdbtn/backbtn/unknown ⇒ skip derivato (fixture caso 3: fwdbtn)', () => {
    expect(deriveSkipped({ ...base, skipped: false, reason_end: 'fwdbtn' })).toBe(true);
    expect(deriveSkipped({ ...base, skipped: false, reason_end: 'backbtn' })).toBe(true);
    expect(deriveSkipped({ ...base, skipped: false, reason_end: 'unknown' })).toBe(true);
  });

  it('endplay sotto la soglia fissa ⇒ skip (fixture caso 4: 25000 < 30000)', () => {
    expect(
      deriveSkipped({ ...base, ms_played: 25_000, skipped: false, reason_end: 'endplay' }),
    ).toBe(true);
    expect(E1_NO_CATALOG_THRESHOLD_MS).toBe(30_000);
  });

  it('endplay sopra la soglia ⇒ nessuno skip', () => {
    expect(
      deriveSkipped({ ...base, ms_played: 200_000, skipped: false, reason_end: 'endplay' }),
    ).toBe(false);
  });

  it('trackdone e reason normali ⇒ nessuno skip', () => {
    expect(deriveSkipped({ ...base, skipped: false, reason_end: 'trackdone' })).toBe(false);
    expect(deriveSkipped({ ...base, skipped: false, reason_end: 'logout' })).toBe(false);
    expect(deriveSkipped({ ...base, skipped: null, reason_end: null })).toBe(false);
  });
});

describe('deriveCompleted', () => {
  it('reason_end trackdone ⇒ completato (derivazione GDPR di §3.1)', () => {
    expect(
      deriveCompleted({
        ts: '2024-01-01T00:00:00Z',
        platform: 'x',
        ms_played: 1,
        reason_end: 'trackdone',
      }),
    ).toBe(true);
    expect(
      deriveCompleted({
        ts: '2024-01-01T00:00:00Z',
        platform: 'x',
        ms_played: 1,
        reason_end: 'fwdbtn',
      }),
    ).toBe(false);
  });
});

/** Mapping platform → DeviceType — spotify.md §3.2 (E5). */
describe('mapDeviceType (§3.2)', () => {
  it('fixture: pattern pre e post ott-2023 mappati correttamente', () => {
    expect(mapDeviceType('Android OS 13 (samsung, SM-S911B)')).toBe('mobile');
    expect(mapDeviceType('Windows 10 (10.0.19045; x64)')).toBe('desktop');
    expect(mapDeviceType('web_player windows 10; chrome 119')).toBe('web');
    expect(mapDeviceType('Android OS 7.0 API 24 (motorola, Moto G4)')).toBe('mobile');
    expect(mapDeviceType('iOS 16.4 (iPhone 13)')).toBe('mobile');
    expect(mapDeviceType('android')).toBe('mobile');
    expect(mapDeviceType('windows')).toBe('desktop');
  });

  it('car, speaker e ignoti', () => {
    expect(mapDeviceType('CarPlay')).toBe('car');
    expect(mapDeviceType('Android Auto')).toBe('car');
    expect(mapDeviceType('Sonos')).toBe('speaker');
    expect(mapDeviceType('Chromecast')).toBe('speaker');
    expect(mapDeviceType('Tizen TV 2020')).toBe('unknown');
    expect(mapDeviceType(null)).toBe('unknown');
  });
});

/** E3: unità offline_timestamp — spotify.md §4. */
describe('normalizeOfflineTimestamp (E3)', () => {
  it('valore < 1e12 è in secondi e viene convertito (fixture: 1625933120)', () => {
    const result = normalizeOfflineTimestamp(1_625_933_120);
    expect(result).toEqual({ valueMs: 1_625_933_120_000, converted: true });
  });

  it('valore in ms non viene convertito', () => {
    expect(normalizeOfflineTimestamp(1_625_933_120_000)).toEqual({
      valueMs: 1_625_933_120_000,
      converted: false,
    });
  });

  it('null/0/negativi ⇒ valueMs null', () => {
    expect(normalizeOfflineTimestamp(null).valueMs).toBeNull();
    expect(normalizeOfflineTimestamp(0).valueMs).toBeNull();
  });
});

describe('extractTrackId', () => {
  it('spotify:track:<id> → <id>', () => {
    expect(extractTrackId('spotify:track:4u7EnebtmKWzUH433cf5Qv')).toBe('4u7EnebtmKWzUH433cf5Qv');
    expect(extractTrackId('spotify:track:')).toBeNull();
    expect(extractTrackId('id-semplice')).toBeNull();
  });
});

/** Mapping integrale record → RawListenEvent — spotify.md §3.1. */
describe('mapSpotifyEvent (§3.1)', () => {
  const record: SpotifyStreamingRecord = {
    ts: '2024-03-15T20:30:00Z',
    platform: 'Android OS 13 (samsung, SM-S911B)',
    ms_played: 245_000,
    conn_country: 'IT',
    ip_addr: '92.40.100.50',
    master_metadata_track_name: 'Bohemian Rhapsody',
    master_metadata_album_artist_name: 'Queen',
    master_metadata_album_album_name: 'A Night at the Opera',
    spotify_track_uri: 'spotify:track:4u7EnebtmKWzUH433cf5Qv',
    reason_start: 'playbtn',
    reason_end: 'trackdone',
    shuffle: false,
    skipped: false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
  };

  it('happy path fixture: tutti i campi mappati (§3.1 + §5)', () => {
    const { raw, discardReason } = mapSpotifyEvent(record);
    expect(discardReason).toBeNull();
    expect(raw?.platform).toBe('spotify');
    expect(raw?.rawTimestamp).toBe(Date.parse('2024-03-15T20:30:00Z'));
    expect(raw?.rawStartedAt).toBe(Date.parse('2024-03-15T20:30:00Z') - 245_000);
    expect(raw?.sourceDurationMs).toBe(245_000);
    expect(raw?.sourceTrackName).toBe('Bohemian Rhapsody');
    expect(raw?.sourceArtistName).toBe('Queen');
    expect(raw?.sourceAlbumName).toBe('A Night at the Opera');
    expect(raw?.sourceEventId).toBe(`4u7EnebtmKWzUH433cf5Qv@${Date.parse('2024-03-15T20:30:00Z')}`);
    expect(raw?.completed).toBe(true);
    expect(raw?.skipped).toBe(false);
    expect(raw?.deviceType).toBe('mobile');
    expect(raw?.deviceDetail).toBe(record.platform);
    expect(raw?.ip).toBe('92.40.100.50');
    expect(raw?.country).toBe('IT');
    expect(raw?.isrc).toBeNull();
    expect(raw?.mbid).toBeNull();
  });

  it('E3: offline in secondi segnala la conversione', () => {
    const { offlineConverted } = mapSpotifyEvent({
      ...record,
      offline: true,
      offline_timestamp: 1_625_933_120,
    });
    expect(offlineConverted).toBe(true);
  });

  it('E6: episodio podcast scartato con discardReason podcast', () => {
    const result = mapSpotifyEvent({
      ts: '2024-02-14T07:30:00Z',
      platform: 'android',
      ms_played: 1_800_000,
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      master_metadata_album_album_name: null,
      spotify_track_uri: null,
      episode_name: 'Episodio 42',
      episode_show_name: 'Rock & Talk',
    });
    expect(result.raw).toBeNull();
    expect(result.discardReason).toBe('podcast');
  });

  it('record senza metadati né episodio ⇒ invalid (§3.1.1 "null → skip")', () => {
    const result = mapSpotifyEvent({
      ts: '2024-01-01T00:00:00Z',
      platform: 'android',
      ms_played: 1000,
      master_metadata_track_name: null,
    });
    expect(result.raw).toBeNull();
    expect(result.discardReason).toBe('invalid');
  });

  it('ts non interpretabile ⇒ invalid', () => {
    const result = mapSpotifyEvent({ ...record, ts: 'not-a-date' });
    expect(result.raw).toBeNull();
    expect(result.discardReason).toBe('invalid');
  });

  it('ms_played negativo ⇒ invalid', () => {
    const result = mapSpotifyEvent({ ...record, ms_played: -5 });
    expect(result.raw).toBeNull();
    expect(result.discardReason).toBe('invalid');
  });

  it('eventi senza uri non generano sourceEventId (fallback sha1 in pipeline)', () => {
    const { raw } = mapSpotifyEvent({ ...record, spotify_track_uri: null });
    expect(raw?.sourceEventId).toBeNull();
  });
});
