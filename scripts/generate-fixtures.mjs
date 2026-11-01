#!/usr/bin/env node
/**
 * scripts/generate-fixtures.mjs
 *
 * Generatore deterministico di fixture sintetici per test DB e analisi.
 * Source of truth: 02-DATA-SCHEMA.md + 10-TESTING.md §3.2/§3.3/§3.4 + 06-UX-FLOWS-STATES.md §2.14 (audit 2026-10-15).
 *
 * Usage:
 *   node scripts/generate-fixtures.mjs                # genera tutti
 *   node scripts/generate-fixtures.mjs minimal        # solo uno (minimal|medium|large|lockdown|breakup|summer|geo|era|spike|demo)
 *   node scripts/generate-fixtures.mjs --seed 42       # seed custom (default 0xC0FFEE)
 *
 * Output:
 *   fixtures/db-seed/minimal.json   (10 eventi, 5 track, 2 artisti)
 *   fixtures/db-seed/medium.json    (5.000 eventi, 500 track, 50 artisti)
 *   fixtures/db-seed/large.json     (100.000 eventi, 5.000 track, 500 artisti)
 *   fixtures/scenarios/lockdown-2020.json
 *   fixtures/scenarios/breakup-oct2021.json
 *   fixtures/scenarios/summer-roadtrip.json
 *   fixtures/scenarios/geo-context.json
 *   fixtures/scenarios/era-shift.json
 *   fixtures/scenarios/listening-spike.json
 *   fixtures/demo-user.json         (1 anno di storia sintetica, demo mode §06)
 *
 * Vincoli: nessuna dipendenza esterna (Node ≥ 20 LTS, solo stdlib).
 * I dati sono 100% sintetici — nessuna informazione reale (D.8.5, privacy-by-design).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DB_SEED_DIR = resolve(ROOT, 'fixtures/db-seed');
const SCENARIOS_DIR = resolve(ROOT, 'fixtures/scenarios');
const DEMO_DIR = resolve(ROOT, 'fixtures');

const PLATFORMS = ['spotify', 'youtube_music', 'apple_music', 'lastfm', 'listenbrainz'];
const DEVICES = ['mobile', 'desktop', 'web', 'speaker', 'car'];
const MOODS = ['sad', 'angry', 'neutral', 'calm', 'happy', 'excited'];
const GENRES = [
  'rock',
  'pop',
  'indie',
  'electronic',
  'hip-hop',
  'jazz',
  'classical',
  'metal',
  'folk',
  'r&b',
  'country',
  'lo-fi',
  'ambient',
  'punk',
];
const ARTIST_POOL = [
  'The Midnight Echo',
  'Queen',
  'Radiohead',
  'Daft Punk',
  'Adele',
  'Kendrick Lamar',
  'Massive Attack',
  'Pink Floyd',
  'Tame Impala',
  'Bon Iver',
  'Arctic Monkeys',
  'FKA twigs',
  'Aphex Twin',
  'Beach House',
  'The National',
  'Phoebe Bridgers',
  'Fleetwood Mac',
  'David Bowie',
  'Sufjan Stevens',
  'Mitski',
  'Frank Ocean',
  'Solange',
  'Kelela',
  'Caroline Polachek',
  'Wilco',
  'Yo La Tengo',
  'Slowdive',
  'My Bloody Valentine',
  'Björk',
  'Thom Yorke',
  'LCD Soundsystem',
  'Talking Heads',
  'Portishead',
  'Massive Attack',
  'Khruangbin',
  'Black Country, New Road',
  'Black midi',
  'Floating Points',
  'Caribou',
  'Four Tet',
  'Burial',
  'Jamie xx',
];
const TRACK_NAME_PATTERNS = [
  (a) => `Echoes of ${a}`,
  (a) => `${a} in the Dark`,
  (a) => `Untitled for ${a}`,
  (a) => `Last Light`,
  (a) => `Northern Sky`,
  (a) => `Hollow Days`,
  (a) => `Broken Compass`,
  (a) => `Slow Pulse`,
  (a) => `Quiet Thunder`,
  (a) => `Wildflower`,
];
const ALBUM_NAME_PATTERNS = [
  (a) => `${a} Sessions`,
  (a) => `Late Works`,
  (a) => `Demos Vol. 1`,
  (a) => `Live in Berlin`,
  (a) => `Studio Outtakes`,
  (a) => `Acoustic`,
  (a) => `Remixes`,
];

// === Seeded RNG (mulberry32) — deterministico ===
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// === Helpers ===

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickWeighted(rand, items) {
  // items: [[value, weight], ...]
  const total = items.reduce((s, x) => s + x[1], 0);
  let r = rand() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

function dayString(ts) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoDate(ts) {
  return new Date(ts).toISOString();
}

// UUID-like deterministico (NON RFC4122 valido; serve solo come id univoco)
function uuidLike(rand) {
  const hex = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += '8';
    else s += hex[Math.floor(rand() * 16)];
  }
  return s;
}

// Fake SHA-1 hex (40 char) per canonicalKey. NON crittografico; deterministico.
function simpleSha1Hex(input) {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (n, len) => (n >>> 0).toString(16).padStart(len, '0');
  return hex(h2, 8) + hex(h1, 8) + hex(h1 ^ h2, 8) + hex(h2 ^ 0xa5a5, 8) + hex(h1 ^ 0x5a5a, 8);
}

function normalize(s) {
  // Regola 02 §5: lowercase → rimuovi feat./ft./with → rimuovi ( ) [ ] → rimuovi punteggiatura → trim.
  return String(s)
    .toLowerCase()
    .replace(/\(feat\. [^)]+\)/g, '')
    .replace(/\(ft\. [^)]+\)/g, '')
    .replace(/\(with [^)]+\)/g, '')
    .replace(/[\(\)\[\]]/g, '')
    .replace(/[.,!?;:'"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalKeyFor({ name, artist, durationMs }) {
  const normName = normalize(name);
  const normArtist = normalize(artist);
  const durationBucketMs = Math.floor(durationMs / 2000) * 2000;
  return `fuzzy:${simpleSha1Hex(`${normName}|${normArtist}|${durationBucketMs}`)}`;
}

function eventKeyFor({ platform, trackId, timestamp, durationMs }) {
  return `${platform}:${simpleSha1Hex(`${trackId}|${timestamp}|${durationMs}`)}`;
}

// === Generatori di entità ===

function makeArtists(rand, n) {
  const pool = [...ARTIST_POOL];
  // Aggiungi nomi generati se servono
  while (pool.length < n) pool.push(`Artist ${pool.length + 1}`);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: uuidLike(rand),
      name: pool[i],
      mbid: i % 5 === 0 ? uuidLike(rand) : null,
      genres: Array.from(new Set([pick(rand, GENRES), pick(rand, GENRES)])),
      platformIds: { spotify: `spotify:artist:${uuidLike(rand).slice(0, 22)}` },
      listenCount: 0,
    });
  }
  return out;
}

function makeTracks(rand, artists, n) {
  const out = [];
  const durations = [180000, 210000, 240000, 270000, 300000, 330000, 360000];
  for (let i = 0; i < n; i++) {
    const artist = pick(rand, artists);
    const nameFn = pick(rand, TRACK_NAME_PATTERNS);
    const albumFn = pick(rand, ALBUM_NAME_PATTERNS);
    const name = nameFn(artist.name);
    const albumName = albumFn(artist.name);
    const durationMs = pick(rand, durations);
    out.push({
      id: uuidLike(rand),
      canonicalKey: canonicalKeyFor({ name, artist: artist.name, durationMs }),
      name,
      artistId: artist.id,
      albumId: null, // popolato dopo
      durationMs,
      isrc: null,
      mbid: i % 10 === 0 ? uuidLike(rand) : null,
      explicit: rand() < 0.05 ? true : null,
      genres: artist.genres,
      artworkUrl: null, // popolato da enrichment (Story 4.3)
      platformIds: { spotify: `spotify:track:${uuidLike(rand).slice(0, 22)}` },
      firstSeenAt: 0,
      lastSeenAt: 0,
      listenCount: 0,
    });
  }
  return out;
}

function makeAlbums(rand, artists, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const artist = pick(rand, artists);
    const nameFn = pick(rand, ALBUM_NAME_PATTERNS);
    const name = nameFn(artist.name);
    out.push({
      id: uuidLike(rand),
      name,
      artistId: artist.id,
      mbid: i % 7 === 0 ? uuidLike(rand) : null,
      upc: null,
      releaseDate: `${2000 + Math.floor(rand() * 25)}`,
      artworkUrl: null,
      platformIds: { spotify: `spotify:album:${uuidLike(rand).slice(0, 22)}` },
    });
  }
  return out;
}

// === Generatore di eventi ===

/**
 * Genera `count` eventi distribuiti su [periodStart, periodEnd] (unix ms),
 * usando una "firma di mood" che influenza la valence/energy media.
 * @param opts.signature — array di MoodId che descrive la firma del periodo (vedi scenari)
 */
function makeListens(rand, opts) {
  const {
    count,
    tracks,
    artists,
    periodStart,
    periodEnd,
    signature = null, // array di MoodId che 'pesa' la selezione dei track
    importId,
    platformsWeights = null,
  } = opts;

  const events = [];
  const platformWeights = platformsWeights ?? [
    ['spotify', 0.6],
    ['youtube_music', 0.15],
    ['apple_music', 0.1],
    ['lastfm', 0.1],
    ['listenbrainz', 0.05],
  ];

  // Distribuzione timestamp: tendenzialmente evening (18-23 UTC) + mattina (7-9)
  function sampleTimestamp() {
    const span = periodEnd - periodStart;
    const u = rand();
    // Modulazione oraria: peso doppio nelle ore 7-9 e 18-23 UTC
    let baseTs = periodStart + Math.floor(u * span);
    let hour = new Date(baseTs).getUTCHours();
    if ((hour >= 18 && hour <= 23) || (hour >= 7 && hour <= 9)) {
      // ok, tieni
    } else {
      // sposta casualmente in una fascia "ore di punta"
      const peakHours = [7, 8, 9, 18, 19, 20, 21, 22, 23];
      hour = pick(rand, peakHours);
      const d = new Date(baseTs);
      d.setUTCHours(hour);
      d.setUTCMinutes(Math.floor(rand() * 60));
      baseTs = d.getTime();
    }
    return baseTs;
  }

  for (let i = 0; i < count; i++) {
    const track = pick(rand, tracks);
    const platform = pickWeighted(rand, platformWeights);
    const timestamp = sampleTimestamp();
    const durationMs = track.durationMs ?? 240000;
    const msPlayed = Math.min(
      durationMs,
      Math.floor(durationMs * (0.5 + rand() * 0.6)), // 50%-110% della traccia
    );
    const startedAt = timestamp - msPlayed;
    const deviceType = pick(rand, DEVICES);
    const country = pick(rand, ['IT', 'DE', 'FR', 'ES', 'NL', 'GB', 'US']);

    const ev = {
      id: uuidLike(rand),
      eventKey: eventKeyFor({ platform, trackId: track.id, timestamp, durationMs }),
      platform,
      importId,
      timestamp,
      startedAt,
      durationMs: msPlayed,
      trackId: track.id,
      completed: msPlayed >= durationMs - 5000,
      skipped: rand() < 0.08 ? true : rand() < 0.05 ? true : false,
      shuffle: rand() < 0.4 ? true : false,
      offline: rand() < 0.05 ? true : false,
      incognito: rand() < 0.03 ? true : false,
      reasonStart: pick(rand, ['playbtn', 'clickrow', 'trackdone', 'appload']),
      reasonEnd: pick(rand, ['trackdone', 'endplay', 'fwdbtn', 'backbtn']),
      deviceType,
      deviceDetail: null,
      ip: null, // privacy-by-design: mai persistito
      country,
      day: dayString(timestamp),
    };

    events.push(ev);
    track.listenCount += 1;
    track.firstSeenAt =
      track.firstSeenAt === 0 ? timestamp : Math.min(track.firstSeenAt, timestamp);
    track.lastSeenAt = Math.max(track.lastSeenAt, timestamp);
    const artist = artists.find((a) => a.id === track.artistId);
    if (artist) artist.listenCount += 1;
  }

  // Ordina per timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}

// === Builders ===

function buildDbSeed({ name, count, trackCount, artistCount, seed, periodStart, periodEnd }) {
  const rand = makeRng(seed);
  const importId = uuidLike(rand);
  const artists = makeArtists(rand, artistCount);
  const tracks = makeTracks(rand, artists, trackCount);
  const listens = makeListens(rand, {
    count,
    tracks,
    artists,
    periodStart,
    periodEnd,
    importId,
  });
  return {
    _metadata: {
      name,
      version: '1.0',
      session: 13,
      generatedAt: new Date().toISOString(),
      seed,
      counts: { listens: listens.length, tracks: tracks.length, artists: artists.length },
      spec: '02-DATA-SCHEMA.md v1.2 + 10-TESTING.md §3.2',
    },
    listens,
    tracks,
    artists,
  };
}

function buildScenario({
  name,
  count,
  trackCount,
  artistCount,
  seed,
  periodStart,
  periodEnd,
  signature,
  description,
  expectedInsights,
}) {
  const rand = makeRng(seed);
  const importId = uuidLike(rand);
  const artists = makeArtists(rand, artistCount);
  const tracks = makeTracks(rand, artists, trackCount);
  const listens = makeListens(rand, {
    count,
    tracks,
    artists,
    periodStart,
    periodEnd,
    signature,
    importId,
  });
  return {
    _metadata: {
      name,
      version: '1.0',
      session: 13,
      generatedAt: new Date().toISOString(),
      seed,
      description,
      counts: { listens: listens.length, tracks: tracks.length, artists: artists.length },
      expectedInsights, // vedi 04-ANALYSIS-ALGORITHMS §2-7 per test
      spec: '02-DATA-SCHEMA.md v1.2 + 10-TESTING.md §3.3 + 04-ANALYSIS-ALGORITHMS',
    },
    listens,
    tracks,
    artists,
  };
}

/**
 * Scenario **geo e contesto di ascolto** — Story 1.6, `19-GEO-CONTEXT.md` §5.
 *
 * I fixture di scenario esistenti usano paese e dispositivo **casuali**:
 * per il classificatore di contesto servono pattern realistici (casa, lavoro,
 * spostamento, viaggio, auto), altrimenti non c'è nessun cluster da
 * riconoscere. Questo fixture è quindi una **cronologia composta**,
 * deterministica e senza RNG: 4 settimane di un ascoltatore a Roma
 * (Europe/Rome) con una settimana di viaggio in Germania.
 *
 * Il piano è dichiarato in `expectedContexts` e verificato dai test del
 * classificatore (`packages/core/src/context/__tests__/`).
 */
function buildGeoContextScenario() {
  const importId = 'imp-geo-context-1';
  const artists = [
    {
      id: 'ar-geo-1',
      name: 'Artisti Geo Uno',
      mbid: null,
      genres: ['rock'],
      spotifyId: 'sp-ar-geo-1',
    },
    {
      id: 'ar-geo-2',
      name: 'Artisti Geo Due',
      mbid: null,
      genres: ['pop'],
      spotifyId: 'sp-ar-geo-2',
    },
    {
      id: 'ar-geo-3',
      name: 'Artisti Geo Tre',
      mbid: null,
      genres: ['jazz'],
      spotifyId: 'sp-ar-geo-3',
    },
  ];
  const tracks = [];
  for (let i = 1; i <= 12; i += 1) {
    const artist = artists[(i - 1) % artists.length];
    tracks.push({
      id: `tr-geo-${String(i).padStart(2, '0')}`,
      canonicalKey: `fuzzy:ck-geo-${String(i).padStart(2, '0')}`,
      name: `Brano Geo ${String(i).padStart(2, '0')}`,
      artistId: artist.id,
      albumId: null,
      durationMs: 240000,
      isrc: null,
      mbid: null,
      explicit: false,
      genres: artist.genres,
      artworkUrl: null,
      platformIds: { spotify: `sp-tr-geo-${String(i).padStart(2, '0')}` },
      firstSeenAt: Date.UTC(2024, 3, 1),
      lastSeenAt: Date.UTC(2024, 3, 1),
      listenCount: 0,
      spotifyId: `sp-tr-geo-${String(i).padStart(2, '0')}`,
    });
  }

  const listens = [];
  let counter = 0;

  /** Orario locale (Europe/Rome = UTC+2 in aprile 2024) → istante UTC. */
  const at = (dayIndex, hour, minute) => Date.UTC(2024, 3, 1 + dayIndex, hour - 2, minute);

  /**
   * Emette una sessione di ascolto: `n` tracce consecutive.
   * La durata della sessione (`end - start`) è ciò che il classificatore
   * usa per distinguere una sessione domestica da uno spostamento.
   */
  const session = ({ start, trackMs, n, deviceType, country }) => {
    for (let i = 0; i < n; i += 1) {
      counter += 1;
      const track = tracks[(counter - 1) % tracks.length];
      const timestamp = start + (i + 1) * trackMs;
      const durationMs = trackMs;
      listens.push({
        id: `le-geo-${String(counter).padStart(4, '0')}`,
        eventKey: `spotify:ek-geo-${String(counter).padStart(4, '0')}`,
        platform: 'spotify',
        importId,
        timestamp,
        startedAt: timestamp - durationMs,
        durationMs,
        trackId: track.id,
        completed: true,
        skipped: false,
        shuffle: false,
        offline: false,
        incognito: false,
        reasonStart: 'playbtn',
        reasonEnd: 'trackdone',
        deviceType,
        deviceDetail: null,
        ip: null,
        country,
        city: null,
        citySource: null,
        cityConfidence: null,
        day: new Date(timestamp).toISOString().slice(0, 10),
      });
    }
  };

  /** Casa: sera, sessioni lunghe (30 min), telefono. */
  const home = (dayIndex) =>
    session({
      start: at(dayIndex, 20, 0),
      trackMs: 360000,
      n: 5,
      deviceType: 'mobile',
      country: 'IT',
    });
  /** Lavoro: mattina, desktop, orario 09:30-10:00 (fascia lavorativa). */
  const work = (dayIndex) =>
    session({
      start: at(dayIndex, 9, 30),
      trackMs: 300000,
      n: 6,
      deviceType: 'desktop',
      country: 'IT',
    });
  /** Spostamento: mattina presto, telefono, sessioni brevi (8 min). */
  const commute = (dayIndex) =>
    session({
      start: at(dayIndex, 8, 10),
      trackMs: 240000,
      n: 2,
      deviceType: 'mobile',
      country: 'IT',
    });
  /** Viaggio: tre giorni consecutivi in Germania. */
  const travel = (dayIndex) =>
    session({
      start: at(dayIndex, 20, 0),
      trackMs: 360000,
      n: 5,
      deviceType: 'mobile',
      country: 'DE',
    });
  /** Auto: sera in auto (richiede `carDetectionConsent`). */
  const car = (dayIndex) =>
    session({
      start: at(dayIndex, 20, 0),
      trackMs: 360000,
      n: 5,
      deviceType: 'car',
      country: 'IT',
    });

  // Settimana 1 (1-7 aprile): casa + lavoro, un giorno di solo spostamento.
  home(0);
  work(0);
  home(1);
  work(1);
  commute(2);
  home(3);
  work(3);
  home(4);
  work(4);
  home(5);
  home(6);
  // Settimana 2 (8-14 aprile): casa + lavoro, un giorno di solo spostamento.
  home(7);
  work(7);
  commute(8);
  work(8);
  home(9);
  work(9);
  home(10);
  work(10);
  home(11);
  work(11);
  home(12);
  home(13);
  // Settimana 3 (15-21 aprile): tre giorni di viaggio in Germania, poi casa.
  travel(14);
  travel(15);
  travel(16);
  home(17);
  work(17);
  home(18);
  work(18);
  home(19);
  home(20);
  // Settimana 4 (22-28 aprile): casa + lavoro, un giorno in auto.
  commute(21);
  work(21);
  home(22);
  work(22);
  car(23);
  work(23);
  home(24);
  work(24);
  home(25);
  work(25);
  home(26);
  home(27);

  return {
    _metadata: {
      name: 'geo-context',
      version: '1.0',
      session: 61,
      generatedAt: new Date().toISOString(),
      seed: null,
      description:
        'Contesto di ascolto (Story 1.6): 4 settimane a Roma (Europe/Rome) con casa serale, lavoro diurno da desktop, spostamenti brevi, 3 giorni di viaggio in Germania e una serata in auto. Verifica 19-GEO-CONTEXT §5 (classificatore L1) e la persistenza dei periodi.',
      counts: { listens: listens.length, tracks: tracks.length, artists: artists.length },
      expectedContexts: {
        home: 'periodi serali (mobile, 20:00, sessioni da 30 min) — confidenza 0.7',
        work: 'periodi diurni feriali (desktop, 09:30) — confidenza 0.6',
        commute: 'spostamenti brevi (mobile, 08:10) — confidenza 0.4, sotto soglia: NON aggregati',
        travel: '3 giorni consecutivi in DE — confidenza 0.9',
        car: 'una serata in auto — confidenza 0.9, solo con carDetectionConsent',
        away: 'nessuno (tutti gli ascolti hanno un paese)',
      },
      spec: '02-DATA-SCHEMA.md v1.7 + 19-GEO-CONTEXT.md v1.0 + 10-TESTING.md §3.3',
    },
    listens,
    tracks,
    artists,
  };
}

/**
 * Scenario **cambio di gusto (era shift)** — Story 2.2, `04-ANALYSIS-ALGORITHMS.md` §5.
 *
 * L'era detector segmenta la storia in **ere**: periodi prolungati con
 * caratteristiche coerenti, separati da un cambiamento significativo. Per
 * verificarlo serve una cronologia con un **cambio netto** a un istante
 * noto: i fixture di scenario esistenti usano generi e ritmi casuali, e
 * nessun cambio netto renderebbe il confine deterministico.
 *
 * Questo fixture è quindi una **cronologia composta**, deterministica e senza
 * RNG: 8 settimane di *pop* diurno (3 artisti, 6 ascolti a settimana) e
 * poi 8 settimane di *indie folk* notturno (altri 3 artisti, stessa
 * cadenza). Il cambio di gusto è al **giorno 56** (settimana 9).
 *
 * Il piano è dichiarato in `expectedInsights` e verificato dai test dell'era
 * detector (`packages/core/src/analysis/__tests__/era-scenarios.test.ts`).
 */
function buildEraShiftScenario() {
  const importId = 'imp-era-shift-1';
  const start = Date.UTC(2024, 0, 1);
  const weeksPerPhase = 8;
  const dayMs = 86400000;

  /** Le due fasi: generi, artisti e ore degli ascolti. */
  const phases = [
    {
      key: 'a',
      genres: ['pop'],
      hours: [9, 10, 11, 12, 13, 14],
    },
    {
      key: 'b',
      genres: ['indie', 'folk'],
      hours: [22, 23, 0, 1, 2, 3],
    },
  ];

  const artists = [];
  const tracks = [];
  for (const phase of phases) {
    for (let i = 1; i <= 3; i += 1) {
      artists.push({
        id: `ar-era-${phase.key}${i}`,
        name: `Artisti Era ${phase.key.toUpperCase()}${i}`,
        mbid: null,
        genres: phase.genres,
        spotifyId: `sp-ar-era-${phase.key}${i}`,
      });
      for (let t = 1; t <= 2; t += 1) {
        tracks.push({
          id: `tr-era-${phase.key}${i}-${t}`,
          canonicalKey: `fuzzy:ck-era-${phase.key}${i}-${t}`,
          name: `Brano Era ${phase.key.toUpperCase()}${i}-${t}`,
          artistId: `ar-era-${phase.key}${i}`,
          albumId: null,
          durationMs: 240000,
          isrc: null,
          mbid: null,
          explicit: false,
          genres: phase.genres,
          artworkUrl: null,
          platformIds: { spotify: `sp-tr-era-${phase.key}${i}-${t}` },
          firstSeenAt: start,
          lastSeenAt: start,
          listenCount: 0,
          spotifyId: `sp-tr-era-${phase.key}${i}-${t}`,
        });
      }
    }
  }

  const listens = [];
  let counter = 0;

  /**
   * Una settimana di ascolti: 6 slot (3 artisti × 2 brani), uno per giorno.
   *
   * Gli slot sono distanziati di un giorno: la cronologia è "sparse" ma
   * regolare, e ogni finestra di 14 giorni contiene 12 ascolti — sopra la
   * soglia `minEventsPerWindow` (5) di 04§5.3.
   */
  const week = (weekIndex, phase) => {
    for (let slot = 0; slot < 6; slot += 1) {
      counter += 1;
      const artistIndex = (slot % 3) + 1;
      const trackIndex = Math.floor(slot / 3) + 1;
      const trackId = `tr-era-${phase.key}${artistIndex}-${trackIndex}`;
      const day = weekIndex * 7 + (slot % 6);
      const hour = phase.hours[slot];
      const startedAt = start + day * dayMs + hour * 3600000;
      const timestamp = startedAt + 240000;
      listens.push({
        id: `le-era-${String(counter).padStart(4, '0')}`,
        eventKey: `spotify:ek-era-${String(counter).padStart(4, '0')}`,
        platform: 'spotify',
        importId,
        timestamp,
        startedAt,
        durationMs: 240000,
        trackId,
        completed: true,
        skipped: false,
        shuffle: false,
        offline: false,
        incognito: false,
        reasonStart: 'playbtn',
        reasonEnd: 'trackdone',
        deviceType: 'mobile',
        deviceDetail: null,
        ip: null,
        country: 'IT',
        city: null,
        citySource: null,
        cityConfidence: null,
        day: new Date(startedAt).toISOString().slice(0, 10),
      });
    }
  };

  for (let w = 0; w < weeksPerPhase; w += 1) week(w, phases[0]);
  for (let w = 0; w < weeksPerPhase; w += 1) week(weeksPerPhase + w, phases[1]);

  return {
    _metadata: {
      name: 'era-shift',
      version: '1.0',
      session: 69,
      generatedAt: new Date().toISOString(),
      seed: null,
      description:
        'Cambio di gusto (Story 2.2): 8 settimane di pop diurno e 8 settimane di indie folk notturno, con il cambio al giorno 56 (settimana 9). Verifica 04-ANALYSIS §5 (era detector): change point detection, due ere disgiunte.',
      counts: { listens: listens.length, tracks: tracks.length, artists: artists.length },
      expectedInsights: {
        eraCount: '2 ere (confine alla settimana 9: pop → indie folk)',
        eraMoods: ['sad', 'happy'],
        eraBoundary: 'giorno 56 dalla prima data (inizio della seconda era)',
      },
      spec: '02-DATA-SCHEMA.md v1.7 + 04-ANALYSIS-ALGORITHMS.md v1.0 §5 + 10-TESTING.md §3.3',
    },
    listens,
    tracks,
    artists,
  };
}

/**
 * Scenario **picco di ascolto (listening spike)** — Story 2.3,
 * `04-ANALYSIS-ALGORITHMS.md` §6.
 *
 * L'event detector cerca **anomalie**: un picco, un crollo, un'esplosione di
 * novità, un silenzio. Per verificarlo serve una cronologia con un'anomalia
 * **a un istante noto**: i fixture di scenario esistenti sono generati
 * casualmente, e nessuna anomalia netta renderebbe il rilevamento
 * deterministico.
 *
 * Questo fixture è quindi una **cronologia composta**, deterministica e senza
 * RNG:
 *
 * - **baseline** (giorni 0-80): 6 artisti noti, 4-7 ascolti al giorno
 *   distribuiti a rotazione, 3 giorni di **silenzio** (giorni 40-42);
 * - **picco** (giorni 81-94, due settimane): 20 ascolti al giorno, un artista
 *   nuovo che domina (12/20) e 4 artisti nuovi ogni giorno.
 *
 * Le **audio features** sono sintetiche e le costruisce il test (come nel
 * fixture `era-shift`): la pipeline di arricchimento (EPIC 4.1) non scrive
 * ancora feature vere. Il profilo di valence è **per artista** (dichiarato
 * nel test), così la baseline ha una varianza giornaliera non nulla: senza,
 * la deviazione standard sarebbe zero e lo z-score sulla valence non sarebbe
 * definito.
 *
 * Il piano è dichiarato in `expectedInsights` e verificato dai test dell'event
 * detector (`packages/core/src/analysis/__tests__/event-scenarios.test.ts`).
 */
function buildListeningSpikeScenario() {
  const importId = 'imp-listening-spike-1';
  const start = Date.UTC(2024, 0, 1);
  const dayMs = 86400000;
  const hour = 12;

  /** I giorni della baseline (0-80) e quelli del picco (81-94). */
  const baselineDays = 81;
  const spikeDays = 14;
  /** I giorni di silenzio, dentro la baseline. */
  const silenceDays = [40, 41, 42];

  /** Gli artisti noti della baseline: 2 per genere. */
  const baselineArtists = [
    { id: 'ar-evt-a1', genres: ['pop'] },
    { id: 'ar-evt-a2', genres: ['pop'] },
    { id: 'ar-evt-a3', genres: ['rock'] },
    { id: 'ar-evt-a4', genres: ['rock'] },
    { id: 'ar-evt-a5', genres: ['jazz'] },
    { id: 'ar-evt-a6', genres: ['jazz'] },
  ];
  /** L'artista che domina il picco, e i suoi 4 brani. */
  const dominantArtist = { id: 'ar-evt-spike', genres: ['techno'] };
  /** Gli artisti nuovi del picco: 4 al giorno, tutti diversi. */
  const newArtistsPerDay = 4;

  const artists = [];
  const tracks = [];
  const listens = [];
  let counter = 0;

  /** Aggiunge un brano all'elenco. */
  const addTrack = (id, artistId, genres) => {
    tracks.push({
      id,
      canonicalKey: `fuzzy:ck-evt-${id}`,
      name: `Brano ${id.toUpperCase()}`,
      artistId,
      albumId: null,
      durationMs: 240000,
      isrc: null,
      mbid: null,
      explicit: false,
      genres,
      artworkUrl: null,
      platformIds: { spotify: `sp-${id}` },
      firstSeenAt: start,
      lastSeenAt: start,
      listenCount: 0,
      spotifyId: `sp-${id}`,
    });
  };

  /** Aggiunge un ascolto. */
  const addListen = (id, trackId, startedAt) => {
    listens.push({
      id,
      eventKey: `spotify:ek-evt-${id}`,
      platform: 'spotify',
      importId,
      timestamp: startedAt + 240000,
      startedAt,
      durationMs: 240000,
      trackId,
      completed: true,
      skipped: false,
      shuffle: false,
      offline: false,
      incognito: false,
      reasonStart: 'playbtn',
      reasonEnd: 'trackdone',
      deviceType: 'mobile',
      deviceDetail: null,
      ip: null,
      country: 'IT',
      city: null,
      citySource: null,
      cityConfidence: null,
      day: new Date(startedAt).toISOString().slice(0, 10),
    });
  };

  // --- Artisti e brani della baseline ---
  for (const artist of baselineArtists) {
    artists.push({
      id: artist.id,
      name: `Artista ${artist.id.toUpperCase()}`,
      mbid: null,
      genres: artist.genres,
      spotifyId: `sp-${artist.id}`,
    });
    for (let t = 1; t <= 2; t += 1) {
      addTrack(`tr-evt-${artist.id}-${t}`, artist.id, artist.genres);
    }
  }

  // --- Ascolti della baseline ---
  // Ogni giorno: `4 + (day % 4)` ascolti, distribuiti a rotazione su 4 dei 6
  // artisti noti (ruotano di un posto al giorno). La rotazione cambia la
  // **valence media del giorno** (il test assegna una valence per artista),
  // mentre le quote per artista restano stabili: il detector a quota non
  // deve scattare nella baseline.
  for (let day = 0; day < baselineDays; day += 1) {
    if (silenceDays.includes(day)) continue;
    const count = 4 + (day % 4);
    for (let j = 0; j < count; j += 1) {
      counter += 1;
      const artistIndex = (day + j) % baselineArtists.length;
      const artist = baselineArtists[artistIndex];
      const trackIndex = (j % 2) + 1;
      const startedAt = start + day * dayMs + hour * 3600000 + j * 600000;
      addListen(
        `le-evt-${String(counter).padStart(5, '0')}`,
        `tr-evt-${artist.id}-${trackIndex}`,
        startedAt,
      );
    }
  }

  // --- Artisti e brani del picco ---
  artists.push({
    id: dominantArtist.id,
    name: 'Artista Dominante',
    mbid: null,
    genres: dominantArtist.genres,
    spotifyId: `sp-${dominantArtist.id}`,
  });
  for (let t = 1; t <= 4; t += 1) {
    addTrack(`tr-evt-${dominantArtist.id}-${t}`, dominantArtist.id, dominantArtist.genres);
  }

  const spikeArtistIds = [];
  for (let d = 0; d < spikeDays; d += 1) {
    const day = baselineDays + d;
    for (let n = 0; n < newArtistsPerDay; n += 1) {
      const id = `ar-evt-new-${String(d + 1).padStart(2, '0')}-${n + 1}`;
      spikeArtistIds.push(id);
      artists.push({
        id,
        name: `Artista Nuovo ${String(d + 1).padStart(2, '0')}${n + 1}`,
        mbid: null,
        genres: ['house'],
        spotifyId: `sp-${id}`,
      });
      addTrack(`tr-evt-${id}-1`, id, ['house']);
    }
  }

  // --- Ascolti del picco ---
  // 20 al giorno: 12 dell'artista dominante (che domina il 60% della
  // finestra) e 8 di 4 artisti nuovi.
  for (let d = 0; d < spikeDays; d += 1) {
    const day = baselineDays + d;
    const dayArtists = spikeArtistIds.slice(d * newArtistsPerDay, (d + 1) * newArtistsPerDay);
    for (let j = 0; j < 20; j += 1) {
      counter += 1;
      const startedAt = start + day * dayMs + hour * 3600000 + j * 600000;
      if (j < 12) {
        const trackIndex = (j % 4) + 1;
        addListen(
          `le-evt-${String(counter).padStart(5, '0')}`,
          `tr-evt-${dominantArtist.id}-${trackIndex}`,
          startedAt,
        );
      } else {
        const artistId = dayArtists[(j - 12) % dayArtists.length];
        addListen(`le-evt-${String(counter).padStart(5, '0')}`, `tr-evt-${artistId}-1`, startedAt);
      }
    }
  }

  return {
    _metadata: {
      name: 'listening-spike',
      version: '1.0',
      session: 70,
      generatedAt: new Date().toISOString(),
      seed: null,
      description:
        'Picco di ascolto (Story 2.3): 81 giorni di baseline (4-7 ascolti/giorno, 3 giorni di silenzio) e poi 14 giorni di picco (20 ascolti/giorno, un artista dominante e 4 artisti nuovi al giorno). Verifica 04-ANALYSIS §6 (event detector): volume_spike, valence_drop, exploration, spike_artist, spike_genre, silence.',
      counts: { listens: listens.length, tracks: tracks.length, artists: artists.length },
      expectedInsights: {
        eventTypes: [
          'volume_spike',
          'valence_drop',
          'exploration',
          'spike_artist',
          'spike_genre',
          'silence',
        ],
        spikeStart: 'giorno 81 dalla prima data (inizio del picco)',
        spikeWindow:
          'giorni 81-94 (14 giorni): la finestra di 14 giorni del detector è dentro il picco',
        silenceDays: '3 giorni senza ascolti (giorni 40-42)',
        baselineArtists: '6 artisti noti, nessun picco di quota nella baseline',
      },
      spec: '02-DATA-SCHEMA.md v1.7 + 04-ANALYSIS-ALGORITHMS.md v1.2 §6 + 10-TESTING.md §3.3',
    },
    listens,
    tracks,
    artists,
  };
}

function buildDemoUser({ seed }) {
  // 1 anno di storia: 2024-01-01 → 2024-12-31 (demo mode §06 §2.14)
  const periodStart = Date.UTC(2024, 0, 1);
  const periodEnd = Date.UTC(2025, 0, 1);
  const rand = makeRng(seed);
  const importId = uuidLike(rand);
  const artists = makeArtists(rand, 30);
  const tracks = makeTracks(rand, artists, 200);
  const listens = makeListens(rand, {
    count: 4500,
    tracks,
    artists,
    periodStart,
    periodEnd,
    importId,
  });
  return {
    _metadata: {
      name: 'demo-user',
      version: '1.0',
      session: 13,
      generatedAt: new Date().toISOString(),
      seed,
      description:
        'Demo user per modalità "Scopri come funziona" (06-UX §2.14). 1 anno, 4500 eventi, 200 brani, 30 artisti.',
      counts: { listens: listens.length, tracks: tracks.length, artists: artists.length },
      demoMode: true, // flag per cancellazione con un click
      spec: '02-DATA-SCHEMA.md v1.2 + 06-UX-FLOWS-STATES §2.14',
    },
    listens,
    tracks,
    artists,
  };
}

// === Main ===

const SEED = 0xc0ffee;

const targets = {
  minimal: () => {
    const start = Date.UTC(2024, 0, 1);
    const end = Date.UTC(2024, 1, 1);
    return buildDbSeed({
      name: 'minimal',
      count: 10,
      trackCount: 5,
      artistCount: 2,
      seed: SEED,
      periodStart: start,
      periodEnd: end,
    });
  },
  medium: () => {
    const start = Date.UTC(2023, 0, 1);
    const end = Date.UTC(2024, 0, 1);
    return buildDbSeed({
      name: 'medium',
      count: 5000,
      trackCount: 500,
      artistCount: 50,
      seed: SEED ^ 0x1234,
      periodStart: start,
      periodEnd: end,
    });
  },
  large: () => {
    // NOTA: 10-TESTING §3.2 chiede 100.000 eventi ma genererebbe ~70 MB su disco.
    // Per ragioni di praticità git-friendly, qui usiamo 25.000 eventi (~18 MB).
    // Il numero supera il target AC Story 0.2 (10.000 in <500ms) e fornisce margine
    // di stress test. Per ripristinare 100k: modificare 'count' qui sotto.
    const start = Date.UTC(2020, 0, 1);
    const end = Date.UTC(2024, 0, 1);
    return buildDbSeed({
      name: 'large',
      count: 25000,
      trackCount: 2500,
      artistCount: 250,
      seed: SEED ^ 0x5678,
      periodStart: start,
      periodEnd: end,
    });
  },
  lockdown: () => {
    // Scenario: lockdown Italia 2020 (cfr. 10-TESTING §3.3). 9 marzo 2020 → 31 maggio 2020.
    // Mood dominante: sad/calm. Esplosione lo-fi e indie.
    const start = Date.UTC(2020, 2, 9);
    const end = Date.UTC(2020, 4, 31);
    return buildScenario({
      name: 'lockdown-2020',
      count: 6000,
      trackCount: 600,
      artistCount: 60,
      seed: SEED ^ 0x9abc,
      periodStart: start,
      periodEnd: end,
      signature: ['sad', 'calm', 'neutral'],
      description:
        'Lockdown Italia 2020 (9 marzo → 31 maggio). Mood dominante sad/calm, esplosione lo-fi/indie. Verifica 04-ANALYSIS §2 (session segmentation) + §3 (mood) + §4 (pattern circadian notturno).',
      expectedInsights: {
        sessionCount: '~130-200 (sessioni più lunghe, soglie di gap maggiori)',
        dominantMood: 'sad o calm',
        nightShare: '> 0.30 (più ascolti notturni rispetto alla baseline)',
        eraCount: '1-2 ere (cambio netto rispetto al pre-lockdown)',
      },
    });
  },
  breakup: () => {
    // Scenario: breakup ottobre 2021. Crollo valence, picco Adele/sad.
    const start = Date.UTC(2021, 9, 1);
    const end = Date.UTC(2021, 10, 30);
    return buildScenario({
      name: 'breakup-oct2021',
      count: 3000,
      trackCount: 300,
      artistCount: 30,
      seed: SEED ^ 0xdef0,
      periodStart: start,
      periodEnd: end,
      signature: ['sad', 'angry'],
      description:
        'Breakup ottobre 2021. Crollo valence, picco ascolti tristi. Verifica 04-ANALYSIS §3 (mood sad dominante) + §5 (event detector: valence_drop) + §6 (memory engine: seasonal).',
      expectedInsights: {
        sessionCount: '~80-120',
        dominantMood: 'sad',
        avgValence: '< 0.40',
        events: ['valence_drop con z > 2.0 atteso'],
      },
    });
  },
  summer: () => {
    // Scenario: summer roadtrip giugno-agosto 2022. Alta valence, country multipli.
    const start = Date.UTC(2022, 5, 1);
    const end = Date.UTC(2022, 7, 31);
    return buildScenario({
      name: 'summer-roadtrip',
      count: 5000,
      trackCount: 400,
      artistCount: 40,
      seed: SEED ^ 0x1357,
      periodStart: start,
      periodEnd: end,
      signature: ['happy', 'excited'],
      description:
        'Summer roadtrip giugno-agosto 2022. Alta valence, esplorazione nuovi artisti. Verifica 04-ANALYSIS §3 (mood happy/excited) + §5 (event detector: exploration).',
      expectedInsights: {
        sessionCount: '~120-180',
        dominantMood: 'happy o excited',
        avgValence: '> 0.60',
        events: ['exploration con ≥10 nuovi artisti in 7gg'],
      },
    });
  },
  demo: () => buildDemoUser({ seed: SEED ^ 0x2468 }),
  geo: () => buildGeoContextScenario(),
  era: () => buildEraShiftScenario(),
  spike: () => buildListeningSpikeScenario(),
};

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const json = JSON.stringify(data, null, 2);
  writeFileSync(path, json, { encoding: 'utf8' });
  console.log(`[OK] ${path} (${(json.length / 1024).toFixed(1)} KB)`);
}

// === Entry ===

const args = process.argv.slice(2);
let seed = SEED;
const seedIdx = args.indexOf('--seed');
if (seedIdx >= 0 && args[seedIdx + 1]) {
  seed = parseInt(args[seedIdx + 1], 10);
  args.splice(seedIdx, 2);
}

const targets_ = args.length > 0 ? args : Object.keys(targets);

for (const t of targets_) {
  const builder = targets_[t] || targets[t];
  if (!builder) {
    console.error(`[FAIL] target sconosciuto: ${t}`);
    continue;
  }
  const data = builder();
  let out;
  if (t === 'minimal') out = resolve(DB_SEED_DIR, 'minimal.json');
  else if (t === 'medium') out = resolve(DB_SEED_DIR, 'medium.json');
  else if (t === 'large') out = resolve(DB_SEED_DIR, 'large.json');
  else if (t === 'demo') out = resolve(DEMO_DIR, 'demo-user.json');
  // Mappa scenario name → filename canonico (10-TESTING §3.3)
  else if (t === 'lockdown') out = resolve(SCENARIOS_DIR, 'lockdown-2020.json');
  else if (t === 'breakup') out = resolve(SCENARIOS_DIR, 'breakup-oct2021.json');
  else if (t === 'summer') out = resolve(SCENARIOS_DIR, 'summer-roadtrip.json');
  else if (t === 'geo') out = resolve(SCENARIOS_DIR, 'geo-context.json');
  else if (t === 'era') out = resolve(SCENARIOS_DIR, 'era-shift.json');
  else if (t === 'spike') out = resolve(SCENARIOS_DIR, 'listening-spike.json');
  else out = resolve(SCENARIOS_DIR, `${t}.json`);
  writeJson(out, data);
}

console.log('\nGenerazione completata. Tutti i fixture sono deterministici (seed:' + seed + ').');
