import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../db';
import { runImport } from '../importSession';
import { SpotifyAdapter } from '../spotify/adapter';
import type { PrivacySettings } from '../../schema';
import type { SpotifyStreamingRecord } from '../spotify/types';

/**
 * Toggle privacy nell'import — 02-DATA-SCHEMA.md §3.8, 19-GEO-CONTEXT.md §7.1
 * (Story 1.6).
 *
 * Il punto centrale è il **consenso per il paese**: il `country` è derivato
 * e conservato **indipendentemente** da `retainIp` (issue #108, decisione
 * del project owner: metterlo a `false` sarebbe una regressione di feature,
 * non un rafforzamento della privacy).
 */

const DEFAULTS: PrivacySettings = {
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

const record: SpotifyStreamingRecord = {
  ts: '2024-04-01T18:00:00Z',
  platform: 'iOS 16.4 (iPhone 13)',
  ms_played: 214_000,
  master_metadata_track_name: 'Bohemian Rhapsody',
  master_metadata_album_artist_name: 'Queen',
  master_metadata_album_album_name: 'A Night at the Opera',
  spotify_track_uri: 'spotify:track:1t2yc2ShL54GfGKWclFzWZ',
  reason_end: 'trackdone',
  conn_country: 'IT',
  ip_addr: '192.0.2.50',
};

/** Importa un record con le impostazioni indicate e restituisce l'evento. */
async function importWith(
  db: LifeSoundtrackDB,
  privacy: PrivacySettings,
): Promise<{
  deviceType: string;
  deviceDetail: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  citySource: string | null;
  cityConfidence: number | null;
}> {
  const blob = new Blob([new TextEncoder().encode(JSON.stringify([record]))]);
  const summary = await runImport(db, new SpotifyAdapter(), blob, {
    privacy,
    fileName: 'streaming-history-privacy.json',
  });
  expect(summary.status).toBe('done');
  const listen = await db.listens.toCollection().first();
  expect(listen).toBeDefined();
  return {
    deviceType: listen!.deviceType,
    deviceDetail: listen!.deviceDetail,
    ip: listen!.ip,
    country: listen!.country,
    city: listen!.city,
    citySource: listen!.citySource,
    cityConfidence: listen!.cityConfidence,
  };
}

describe('toggle privacy nell’import (02§3.8, 19§7.1)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`privacy-toggles-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('il paese è conservato indipendentemente da `retainIp` (issue #108)', async () => {
    const stored = await importWith(db, DEFAULTS);
    expect(stored.ip).toBeNull();
    expect(stored.country).toBe('IT');
  });

  it('con `retainCountry` disattivato il paese non viene persistito', async () => {
    const stored = await importWith(db, { ...DEFAULTS, retainCountry: false });
    expect(stored.country).toBeNull();
    expect(stored.ip).toBeNull();
  });

  it('`retainDeviceType` disattivato degrada il tipo di dispositivo', async () => {
    const stored = await importWith(db, { ...DEFAULTS, retainDeviceType: false });
    expect(stored.deviceType).toBe('unknown');
  });

  it('`retainDeviceDetail` disattivato non conserva la stringa grezza del provider', async () => {
    const stored = await importWith(db, DEFAULTS);
    expect(stored.deviceDetail).toBeNull();

    const db2 = new LifeSoundtrackDB(`privacy-toggles-detail-${crypto.randomUUID()}`);
    try {
      const kept = await importWith(db2, { ...DEFAULTS, retainDeviceDetail: true });
      expect(kept.deviceDetail).toBe('iOS 16.4 (iPhone 13)');
    } finally {
      await db2.delete();
    }
  });

  it('i campi città esistono e sono nulli: la derivazione L2 è la Story 4.4', async () => {
    const stored = await importWith(db, DEFAULTS);
    expect(stored.city).toBeNull();
    expect(stored.citySource).toBeNull();
    expect(stored.cityConfidence).toBeNull();
  });
});
