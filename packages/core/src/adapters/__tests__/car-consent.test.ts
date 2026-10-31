import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../db';
import { runImport } from '../importSession';
import { applyCarConsent } from '../pipeline';
import { SpotifyAdapter } from '../spotify/adapter';
import type { DeviceType, PrivacySettings } from '../../schema';
import type { SpotifyStreamingRecord } from '../spotify/types';

/**
 * Gate `carDetectionConsent` su `deviceType='car'` (02-DATA-SCHEMA.md §3.8,
 * issue #109). Stesso record Spotify letto due volte — consenso ON e OFF —
 * con assert sul `deviceType` persistito.
 */

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

/**
 * Impostazioni con la stringa grezza del dispositivo conservata.
 *
 * `retainDeviceDetail` (default `false`, `19-GEO-CONTEXT.md` §7.1) governa
 * la persistenza di `deviceDetail`: è un dato **identificante**, quindi
 * opt-in. I test che distinguono i record importati per la stringa del
 * provider (`CarPlay`, `Android Auto`) hanno bisogno del consenso espresso:
 * il gate `carDetectionConsent` è **separato** e resta il soggetto di questi
 * test.
 */
const PRIVACY_WITH_DETAIL: PrivacySettings = {
  ...PRIVACY_DEFAULTS,
  retainDeviceDetail: true,
};

/** Record di streaming history con `platform` CarPlay (mapDeviceType → 'car'). */
const carPlayRecord: SpotifyStreamingRecord = {
  ts: '2024-03-15T07:30:00Z',
  platform: 'CarPlay',
  ms_played: 214_000,
  master_metadata_track_name: 'Bohemian Rhapsody',
  master_metadata_album_artist_name: 'Queen',
  master_metadata_album_album_name: 'A Night at the Opera',
  spotify_track_uri: 'spotify:track:1t2yc2ShL54GfGKWclFzWZ',
  reason_end: 'trackdone',
  conn_country: 'IT',
};

/** Secondo record, Android Auto: stesso gate, segnale diverso. */
const androidAutoRecord: SpotifyStreamingRecord = {
  ...carPlayRecord,
  ts: '2024-03-15T07:40:00Z',
  platform: 'Android Auto',
  spotify_track_uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b',
  master_metadata_track_name: 'Another One Bites The Dust',
};

/** Record non-auto: il gate non deve toccarlo in nessuna delle due modalità. */
const mobileRecord: SpotifyStreamingRecord = {
  ...carPlayRecord,
  ts: '2024-03-15T07:50:00Z',
  platform: 'iOS 16.4 (iPhone 13)',
  spotify_track_uri: 'spotify:track:2fZClNriCvt8TqnbESl0MJ',
  master_metadata_track_name: 'Under Pressure',
};

const historyBlob = (records: SpotifyStreamingRecord[]): Blob =>
  new Blob([new TextEncoder().encode(JSON.stringify(records))]);

/** Import dei record e lettura degli `ListenEvent` persistiti, ordinati per ts. */
async function importWith(
  db: LifeSoundtrackDB,
  privacy: PrivacySettings,
  records: SpotifyStreamingRecord[],
): Promise<Map<string, DeviceType>> {
  const summary = await runImport(db, new SpotifyAdapter(), historyBlob(records), {
    privacy,
    fileName: 'streaming-history-car.json',
  });
  expect(summary.status).toBe('done');
  const listens = (await db.listens.toArray()).sort((a, b) => a.timestamp - b.timestamp);
  return new Map(listens.map((l) => [l.deviceDetail ?? '', l.deviceType]));
}

describe('applyCarConsent (02§3.8 — gate di default)', () => {
  it('senza consenso `car` degrada a `unknown`', () => {
    expect(applyCarConsent('car', false)).toBe('unknown');
  });

  it('con consenso `car` resta `car`', () => {
    expect(applyCarConsent('car', true)).toBe('car');
  });

  it('gli altri deviceType non sono mai toccati, in nessuna modalità', () => {
    const others: DeviceType[] = [
      'mobile',
      'desktop',
      'web',
      'speaker',
      'wearable',
      'tv',
      'unknown',
    ];
    for (const deviceType of others) {
      expect(applyCarConsent(deviceType, false)).toBe(deviceType);
      expect(applyCarConsent(deviceType, true)).toBe(deviceType);
    }
  });
});

describe('import Spotify — carDetectionConsent on/off sullo stesso record (issue #109)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`car-consent-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('CarPlay: consenso OFF ⇒ deviceType `unknown`, consenso ON ⇒ `car`', async () => {
    const off = await importWith(db, PRIVACY_WITH_DETAIL, [carPlayRecord]);
    expect(off.get('CarPlay')).toBe('unknown');
    expect(off.size).toBe(1);

    const on = await importWith(db, { ...PRIVACY_WITH_DETAIL, carDetectionConsent: true }, [
      carPlayRecord,
    ]);
    expect(on.get('CarPlay')).toBe('car');
  });

  it('Android Auto: stesso gate di CarPlay (entrambi i segnali citati in 02§3.8)', async () => {
    const off = await importWith(db, PRIVACY_WITH_DETAIL, [androidAutoRecord]);
    expect(off.get('Android Auto')).toBe('unknown');

    const on = await importWith(db, { ...PRIVACY_WITH_DETAIL, carDetectionConsent: true }, [
      androidAutoRecord,
    ]);
    expect(on.get('Android Auto')).toBe('car');
  });

  it('la stringa grezza `deviceDetail` è conservata solo con `retainDeviceDetail` (default false)', async () => {
    await importWith(db, PRIVACY_WITH_DETAIL, [carPlayRecord]);
    const kept = await db.listens.toCollection().first();
    expect(kept?.deviceDetail).toBe('CarPlay');
    expect(kept?.deviceType).toBe('unknown');

    // Senza il consenso esplicito la stringa grezza non viene persistita:
    // `deviceDetail` è un dato identificante (`19-GEO-CONTEXT.md` §7.1).
    const db2 = new LifeSoundtrackDB(`car-consent-detail-${crypto.randomUUID()}`);
    try {
      await importWith(db2, PRIVACY_DEFAULTS, [carPlayRecord]);
      const dropped = await db2.listens.toCollection().first();
      expect(dropped?.deviceDetail).toBeNull();
      expect(dropped?.deviceType).toBe('unknown');
    } finally {
      await db2.delete();
    }
  });

  it('i deviceType non-auto sopravvivono al gate in entrambe le modalità', async () => {
    const records = [carPlayRecord, androidAutoRecord, mobileRecord];
    const off = await importWith(db, PRIVACY_WITH_DETAIL, records);
    expect(off.get('iOS 16.4 (iPhone 13)')).toBe('mobile');
    expect(off.get('CarPlay')).toBe('unknown');

    const on = await importWith(db, { ...PRIVACY_WITH_DETAIL, carDetectionConsent: true }, records);
    expect(on.get('iOS 16.4 (iPhone 13)')).toBe('mobile');
    expect(on.get('CarPlay')).toBe('car');
    expect(on.get('Android Auto')).toBe('car');
  });

  it("nessun evento `deviceType='car'` resta in DB con consenso OFF", async () => {
    await importWith(db, PRIVACY_DEFAULTS, [carPlayRecord, androidAutoRecord, mobileRecord]);
    expect(await db.listens.filter((l) => l.deviceType === 'car').count()).toBe(0);
    expect(await db.listens.count()).toBe(3);
  });
});
