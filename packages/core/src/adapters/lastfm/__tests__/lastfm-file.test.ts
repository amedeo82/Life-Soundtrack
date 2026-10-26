import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifeSoundtrackDB } from '../../../db';
import { runImport } from '../../importSession';
import type { PrivacySettings } from '../../../schema';
import { LastfmAdapter } from '../adapter';

const GHANL_CSV = fileURLToPath(
  new URL(
    '../../../../../../fixtures/synthetic-history/lastfm-export-ghanl-sample.csv',
    import.meta.url,
  ),
);
const FOUR_COL_CSV = fileURLToPath(
  new URL(
    '../../../../../../fixtures/synthetic-history/lastfm-export-4col-sample.csv',
    import.meta.url,
  ),
);
const JSON_EXPORT = fileURLToPath(
  new URL(
    '../../../../../../fixtures/synthetic-history/lastfm-export-sample.json',
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

const blobFrom = (path: string): Blob =>
  new Blob([new Uint8Array(readFileSync(path)) as unknown as ArrayBuffer]);

/** Minuto normalizzato del 20 Oct 2020 09:40 UTC (1603186800). */
const MINUTE_0940 = '2020-10-20T09:40';

/** Minuto normalizzato del 20 Oct 2020 09:43 UTC (1603186980). */
const MINUTE_0943 = '2020-10-20T09:43';

describe('LastfmAdapter — percorso file (§2.3, §8 casi 14-16, 19, 22)', () => {
  let db: LifeSoundtrackDB;

  beforeEach(() => {
    db = new LifeSoundtrackDB(`lf-file-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('detect: CSV con header, CSV a 4 colonne e JSON export sono riconosciuti', async () => {
    const adapter = new LastfmAdapter();
    await expect(adapter.detect(blobFrom(GHANL_CSV))).resolves.toBe(true);
    await expect(adapter.detect(blobFrom(FOUR_COL_CSV))).resolves.toBe(true);
    await expect(adapter.detect(blobFrom(JSON_EXPORT))).resolves.toBe(true);
    await expect(adapter.detect(new Blob(['{"hello":"world"}']))).resolves.toBe(false);
    await expect(adapter.detect(new Blob(['a,b,c\n1,2,3']))).resolves.toBe(false);
  });

  it('CSV ghan.nl (8 colonne): 3 eventi, timestamp da uts, durata 0', async () => {
    const summary = await runImport(db, new LastfmAdapter(), blobFrom(GHANL_CSV), {
      privacy: PRIVACY_OFF,
      fileName: 'lastfm-ghanl.csv',
    });
    expect(summary.status).toBe('done');
    expect(summary.eventsParsed).toBe(3);
    expect(summary.eventsInserted).toBe(3);

    const event = await db.listens.get(`lastfm:${MINUTE_0940}|Apocalypse Dreams|Tame Impala`);
    expect(event).toBeDefined();
    expect(event!.timestamp).toBe(1603186824000);
    expect(event!.startedAt).toBe(event!.timestamp);
    expect(event!.durationMs).toBe(0);
    expect(event!.completed).toBe(false);
    // Il modello (`02§3.2`) ha `skipped: boolean` non nullabile: l'adapter
    // passa `null` ("nessun dato", §3.1) e il core lo normalizza a false.
    expect(event!.skipped).toBe(false);
    expect(event!.deviceType).toBe('unknown');
    expect(event!.ip).toBeNull();
    expect(event!.country).toBeNull();
  });

  it("CSV lastfm-to-csv (4 colonne): 3 eventi, l'ultima riga senza data è scartata", async () => {
    const summary = await runImport(db, new LastfmAdapter(), blobFrom(FOUR_COL_CSV), {
      privacy: PRIVACY_OFF,
      fileName: 'lastfm-4col.csv',
    });
    expect(summary.eventsParsed).toBe(2);
    expect(summary.eventsInserted).toBe(2);
    // E.LF.18: la riga senza data è scartata con `noDateSkipped`.
    expect(summary.warningCounts['adapter.lastfm.warn.noDateSkipped']).toBe(1);

    const event = await db.listens.get(`lastfm:${MINUTE_0940}|Apocalypse Dreams|Tame Impala`);
    expect(event).toBeDefined();
    expect(event!.timestamp).toBe(1603186800000);
  });

  it('E.LF.16 / D-LF.7: lo stesso scrobble via API (secondi) e via CSV (minuto) → stesso eventKey', async () => {
    await runImport(db, new LastfmAdapter(), blobFrom(GHANL_CSV), { privacy: PRIVACY_OFF });
    await runImport(db, new LastfmAdapter(), blobFrom(FOUR_COL_CSV), { privacy: PRIVACY_OFF });
    // "Airbag" non ha mbid in nessuno dei due percorsi → la normalizzazione
    // al minuto li fa convergere sulla stessa chiave.
    const key = `lastfm:${MINUTE_0943}|Airbag|Radiohead`;
    const event = await db.listens.get(key);
    expect(event).toBeDefined();
    expect(await db.listens.count()).toBe(3);
  });

  it('export JSON: 3 eventi con lo stesso mapping del CSV', async () => {
    const summary = await runImport(db, new LastfmAdapter(), blobFrom(JSON_EXPORT), {
      privacy: PRIVACY_OFF,
      fileName: 'lastfm-export.json',
    });
    expect(summary.eventsParsed).toBe(3);
    const event = await db.listens.get(`lastfm:${MINUTE_0940}|Apocalypse Dreams|Tame Impala`);
    expect(event).toBeDefined();
    expect(event!.timestamp).toBe(1603186824000);
  });

  it('E.LF.20: CSV con BOM UTF-8 → letto correttamente', async () => {
    const csv = readFileSync(GHANL_CSV, 'utf8');
    const withBom = new Blob(['\uFEFF' + csv]);
    const adapter = new LastfmAdapter();
    await expect(adapter.detect(withBom)).resolves.toBe(true);
    const events = [];
    for await (const event of adapter.parse(withBom)) {
      events.push(event);
    }
    expect(events).toHaveLength(3);
  });

  it('E.LF.5: mbid mancante → un solo warning aggregato con il conteggio', async () => {
    const summary = await runImport(db, new LastfmAdapter(), blobFrom(GHANL_CSV), {
      privacy: PRIVACY_OFF,
    });
    expect(summary.warningCounts['adapter.lastfm.warn.mbidMissing']).toBe(2);
  });

  it('idempotenza: re-import dello stesso CSV → duplicati, nessuna nuova riga', async () => {
    const adapter = new LastfmAdapter();
    await runImport(db, adapter, blobFrom(GHANL_CSV), { privacy: PRIVACY_OFF });
    const second = await runImport(db, adapter, blobFrom(GHANL_CSV), { privacy: PRIVACY_OFF });
    expect(second.eventsInserted).toBe(0);
    expect(second.eventsDuplicated).toBe(3);
  });
});
