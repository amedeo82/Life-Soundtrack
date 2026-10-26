import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../../db';
import { runImport } from '../../importSession';
import { AdapterError } from '../../errors';
import type { PrivacySettings } from '../../../schema';
import { ListenBrainzAdapter } from '../adapter';

const FIXTURE_PATH = fileURLToPath(
  new URL(
    '../../../../../../fixtures/synthetic-history/listenbrainz-sample.jsonl',
    import.meta.url,
  ),
);

const PRIVACY_OFF: PrivacySettings = {
  retainIp: false,
  enrichMetadata: false,
  carDetectionConsent: false,
  scrobbleHubs: [],
  syncCloud: false,
};

const fixtureText = (): string => readFileSync(FIXTURE_PATH, 'utf8');

/** Righe del fixture, in due "mesi" con un buco in mezzo (E.LB.14). */
const fixtureMonths = (): { january: string; march: string } => {
  const lines = fixtureText()
    .split('\n')
    .filter((line) => line.trim().length > 0);
  return {
    january: `${lines.slice(0, 10).join('\n')}\n`,
    march: `${lines.slice(10).join('\n')}\n`,
  };
};

/** Archivio export deterministico: `user.json` + due mesi + file fuori scope. */
const exportArchive = (): Blob => {
  const months = fixtureMonths();
  const zip = zipSync(
    {
      'user.json': new TextEncoder().encode(JSON.stringify({ user_name: 'lb_user' })),
      'listens/2025-01.jsonl': new TextEncoder().encode(months.january),
      'listens/2025-03.jsonl': new TextEncoder().encode(months.march),
      'feedback.jsonl': new TextEncoder().encode('{"recording_mbid":"x","rating":1}\n'),
      'pinned_recording.jsonl': new TextEncoder().encode('{"recording_mbid":"y"}\n'),
    },
    { mtime: new Date('2025-01-01T00:00:00Z') },
  );
  return new Blob([zip as unknown as ArrayBuffer]);
};

describe('ListenBrainzAdapter — detection (§2.2)', () => {
  it("riconosce l'archivio ZIP export (listens/*.jsonl + user.json)", async () => {
    const adapter = new ListenBrainzAdapter();
    await expect(adapter.detect(exportArchive())).resolves.toBe(true);
  });

  it('rifiuta un archivio senza listens/ (export parziale)', async () => {
    const zip = zipSync(
      { 'user.json': new TextEncoder().encode('{}') },
      { mtime: new Date('2025-01-01T00:00:00Z') },
    );
    const adapter = new ListenBrainzAdapter();
    await expect(adapter.detect(new Blob([zip as unknown as ArrayBuffer]))).resolves.toBe(false);
  });

  it('riconosce il JSONL sciolto (prima riga valida)', async () => {
    const adapter = new ListenBrainzAdapter();
    await expect(adapter.detect(new Blob([fixtureText()]))).resolves.toBe(true);
  });

  it('rifiuta un JSON array (non è un export ListenBrainz)', async () => {
    const adapter = new ListenBrainzAdapter();
    await expect(adapter.detect(new Blob(['[{"listened_at":1}]']))).resolves.toBe(false);
  });
});

describe('ListenBrainzAdapter — import del fixture (§8: casi 1-20)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`lb-adapter-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('importa 16 eventi, scarta 4 righe e conta i warning per categoria', async () => {
    const summary = await runImport(db, new ListenBrainzAdapter(), exportArchive(), {
      privacy: PRIVACY_OFF,
      fileName: 'listenbrainz-export.zip',
    });

    expect(summary.status).toBe('done');
    expect(summary.eventsParsed).toBe(16);
    expect(summary.eventsInserted).toBe(16);
    expect(summary.eventsDuplicated).toBe(0);

    // Filtro §3.3: 2 malformate, 1 troppo vecchia (E.LB.17), 1 senza titolo.
    expect(summary.warningCounts['adapter.listenbrainz.warn.malformedSkipped']).toBe(2);
    expect(summary.warningCounts['adapter.listenbrainz.warn.tooOldSkipped']).toBe(1);
    expect(summary.warningCounts['adapter.listenbrainz.warn.noTitleSkipped']).toBe(1);
    // E.LB.16: un solo warning aggregato per i file fuori scope.
    expect(summary.warningCounts['adapter.listenbrainz.info.libraryDeferred']).toBe(1);

    expect(await db.listens.count()).toBe(16);
    // 12 Track uniche: 4 eventi condividono il brano (msid diverso → stessa
    // Track DEDUP-3) e 1 evento è lo stesso brano ISRC della happy path.
    expect(await db.tracks.count()).toBe(12);
    expect(await db.artists.count()).toBe(10);
  });

  it('eventKey D-LB.2: listened_at + recording_msid', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const event = await db.listens.get('listenbrainz:1710498600|msid-happy-1');
    expect(event).toBeDefined();
    expect(event!.platform).toBe('listenbrainz');
    expect(event!.timestamp).toBe(1710498600000);
    expect(event!.startedAt).toBe(event!.timestamp);
    expect(event!.durationMs).toBe(0);
  });

  it('E.LB.8: stesso msid con listened_at diverse → due eventi distinti', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    expect(await db.listens.get('listenbrainz:1710592200|msid-shared')).toBeDefined();
    expect(await db.listens.get('listenbrainz:1710592260|msid-shared')).toBeDefined();
  });

  it('E.LB.13: stesso brano con msid diversi → due eventi, una Track', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    expect(await db.listens.get('listenbrainz:1710678600|msid-client-a')).toBeDefined();
    expect(await db.listens.get('listenbrainz:1710682200|msid-client-b')).toBeDefined();
    const creep = await db.tracks.where('name').equals('Creep').first();
    expect(creep).toBeDefined();
    expect(creep!.listenCount).toBe(2);
  });

  it('DEDUP-1 (ISRC) e DEDUP-2 (MBID) con precedenza del mbid_mapping (D2)', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const spaceOddity = await db.tracks.where('name').equals('Space Oddity').first();
    expect(spaceOddity!.canonicalKey).toBe('isrc:GBAYE0601498');
    expect(spaceOddity!.isrc).toBe('GBAYE0601498');

    const tames = await db.tracks.where('name').equals('Apocalypse Dreams').first();
    expect(tames!.canonicalKey).toBe('mbid:mbid-rec-2');

    // Conflitto: mbid_mapping (server) vince su additional_info (client).
    const eirp = await db.tracks.where('name').equals('Everything In Its Right Place').first();
    expect(eirp!.canonicalKey).toBe('mbid:mbid-from-server');
    expect(eirp!.mbid).toBe('mbid-from-server');
  });

  it('E.LB.11: artista ricostruita dal mapping, mai divisa per "&"', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const walk = await db.tracks.where('name').equals('Walk').first();
    const artist = await db.artists.get(walk!.artistId);
    expect(artist!.name).toBe('Artist A & Artist B');
    expect(artist!.mbid).toBe('mbid-artist-a');

    const songD = await db.tracks.where('name').equals('Song D').first();
    const rawArtist = await db.artists.get(songD!.artistId);
    expect(rawArtist!.name).toBe('Artist C & Artist D');
  });

  it('E.LB.1/E.LB.2: durata assente → stesso bucket DEDUP-3, durata solo hint sulla Track', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const sunrise = await db.tracks.where('name').equals('Sunrise').first();
    expect(sunrise).toBeDefined();
    expect(sunrise!.listenCount).toBe(2);
    expect(sunrise!.durationMs).toBe(215000);
    const events = await db.listens.where('eventKey').startsWith('listenbrainz:171111').toArray();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.durationMs === 0)).toBe(true);
  });

  it('senza msid e senza MBID: sourceEventId null → fallback SHA-1 del core', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const event = await db.listens
      .where('trackId')
      .notEqual('')
      .filter((e) => e.timestamp === 1711372200000)
      .first();
    expect(event).toBeDefined();
    expect(event!.eventKey.startsWith('listenbrainz:')).toBe(true);
    expect(event!.eventKey).not.toContain('msid');
  });

  it("E.LB.19: il tempo dell'evento è listened_at, non inserted_at", async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const event = await db.listens.get('listenbrainz:1711458600|msid-backdated');
    expect(event).toBeDefined();
    expect(event!.timestamp).toBe(1711458600000);
  });

  it('E10: day derivato dal timestamp UTC (confine di mezzanotte)', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const event = await db.listens.get('listenbrainz:1711929630|msid-midnight');
    expect(event).toBeDefined();
    expect(event!.day).toBe('2024-04-01');
  });

  it('privacy: user_name, ip e country mai persistiti', async () => {
    await runImport(db, new ListenBrainzAdapter(), exportArchive(), { privacy: PRIVACY_OFF });
    const events = await db.listens.toArray();
    expect(events.every((e) => e.ip === null && e.country === null)).toBe(true);
    const dump = JSON.stringify(events) + JSON.stringify(await db.tracks.toArray());
    expect(dump).not.toContain('lb_user');
    expect(dump).not.toContain('user-tag');
    expect(dump).not.toContain('spotify-ignored');
  });

  it('idempotenza: re-import dello stesso archivio → 16 duplicati', async () => {
    const adapter = new ListenBrainzAdapter();
    await runImport(db, adapter, exportArchive(), { privacy: PRIVACY_OFF });
    const second = await runImport(db, adapter, exportArchive(), { privacy: PRIVACY_OFF });
    expect(second.eventsInserted).toBe(0);
    expect(second.eventsDuplicated).toBe(16);
    expect(await db.listens.count()).toBe(16);
  });

  it('righe malformate: una riga JSON rotta non abortisce lo stream', async () => {
    const broken = '{"listened_at": 1710498600, "track_metadata": {"track_name": "Ok"\n';
    const good = JSON.stringify({
      listened_at: 1710498600,
      recording_msid: 'msid-ok',
      track_metadata: { track_name: 'Ok', artist_name: 'A' },
    });
    const blob = new Blob([`${broken}\n${good}\n`]);
    const adapter = new ListenBrainzAdapter();
    const events = [];
    for await (const event of adapter.parse(blob)) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]!.sourceEventId).toBe('1710498600|msid-ok');
  });

  it('file troncato (senza terminatore) → TRUNCATED recuperabile', async () => {
    const blob = new Blob(['{"listened_at": 1710498600, "recording_msid": "x"']);
    const adapter = new ListenBrainzAdapter();
    await expect(async () => {
      for await (const _event of adapter.parse(blob)) {
        void _event;
      }
    }).rejects.toThrow(AdapterError);
  });
});
