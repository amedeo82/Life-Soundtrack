#!/usr/bin/env node
// Genera le icone PWA di Life-Soundtrack in formato PNG.
// - 192x192: icona standard (Chrome install criteria)
// - 512x512: icona standard (Chrome install criteria)
// - 512x512 maskable: icona con safe-zone (40% padding) per adaptive icons Android
// - apple-touch-icon 180x180: iOS Safari home screen (no trasparenze, RGB solido)
//
// Determinismo: nessun input esterno, nessuna dipendenza, pixel calcolati da
// una funzione pura (radial gradient brand violet). Sicuro da rieseguire in CI.
//
// Uso: `node scripts/generate-pwa-icons.mjs` (no args, scrive in apps/web/public/icons/).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'apps', 'web', 'public', 'icons');

// Brand violet (#8B5CF6) verso magenta (#EC4899) con un tocco di amber (#F59E0B)
// in alto a sinistra, replicando l'identità del gradient `brand.gradient` di
// `design/tokens.json`. Nessun dato runtime viene usato.
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

/**
 * Calcola il pixel (r, g, b) in coordinate (x, y) su canvas (w x h).
 * Restituisce RGB. Coordinate normalizzate a [0, 1].
 * @param x coordinata x (0..w-1)
 * @param y coordinata y (0..h-1)
 * @param w larghezza canvas
 * @param h altezza canvas
 * @returns {[number, number, number]} tuple [r, g, b]
 */
function gradientPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  // angolo del gradient (135deg), come definito in tokens.json
  const t = Math.max(0, Math.min(1, nx * 0.6 + ny * 0.4));
  const r = lerp(139, 236, t); // #8B5CF6 → #EC4899
  const g = lerp(92, 72, t);
  const b = lerp(246, 153, t);
  return [r, g, b];
}

/**
 * Pinge un canvas PNG RGB (color type 2, 8 bit) di dimensioni w x h.
 * Usa filter byte = 0 (None) per semplicità + deflate.
 * @param w larghezza
 * @param h altezza
 * @param paint funzione (x, y) => [r, g, b]
 */
function paintPng(w, h, paint) {
  const stride = 1 + w * 3; // 1 filter byte + RGB
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const off = rowStart + 1 + x * 3;
      raw[off + 0] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdrBuf(w, h)),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function ihdrBuf(w, h) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(w, 0);
  buf.writeUInt32BE(h, 4);
  buf[8] = 8; // bit depth
  buf[9] = 2; // color type: RGB
  buf[10] = 0; // compression method
  buf[11] = 0; // filter method
  buf[12] = 0; // interlace
  return buf;
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

/**
 * Renderizza un canvas `w x h` applicando un crop centrale di `cropSize`
 * da un canvas logico `2*cropSize x 2*cropSize`. Usato per la variante
 * maskable: la "safe zone" interna al 40% di padding viene preservata,
 * il gradient viene clippato al quadrato interno per evitare cropping
 * spiacevoli sui launcher che applicano maschere circolari/irregolari.
 */
function maskablePaint(w, h, cropSize) {
  return (x, y) => {
    // mappa (x,y) del canvas target dentro al quadrato interno cropSize x cropSize
    const ix = ((x / w) * cropSize) | 0;
    const iy = ((y / h) * cropSize) | 0;
    return gradientPixel(ix, iy, cropSize, cropSize);
  };
}

mkdirSync(OUT_DIR, { recursive: true });

// 192x192 — icona standard
writeFileSync(resolve(OUT_DIR, 'icon-192.png'), paintPng(192, 192, gradientPixel));
process.stdout.write('[icons] icon-192.png (192x192)\n');

// 512x512 — icona standard
writeFileSync(resolve(OUT_DIR, 'icon-512.png'), paintPng(512, 512, gradientPixel));
process.stdout.write('[icons] icon-512.png (512x512)\n');

// 512x512 maskable — safe zone al centro, padding brand magenta/violet solido.
// La safe zone PWA è il 40% centrale (40% = 0.4 * 512 ≈ 204px), ma spec
// Android raccomanda l'80% del canvas. Usiamo cropSize = 410 (≈80%) e
// dipingiamo il padding come colore brand.violet solido.
const MASK_PAD = Buffer.from([139, 92, 246]); // #8B5CF6
writeFileSync(
  resolve(OUT_DIR, 'icon-maskable-512.png'),
  paintPng(512, 512, (x, y) => {
    const cx = 256;
    const cy = 256;
    const r = Math.hypot(x - cx, y - cy);
    const innerR = 256 * 0.8; // safe zone = 80% del canvas
    if (r > innerR) return [MASK_PAD[0], MASK_PAD[1], MASK_PAD[2]];
    // mappa nel quadrato interno 512 x 512
    return gradientPixel(x, y, 512, 512);
  }),
);
process.stdout.write('[icons] icon-maskable-512.png (512x512, safe-zone 80%)\n');

// 180x180 — apple-touch-icon (iOS non supporta trasparenze né maschere)
writeFileSync(resolve(OUT_DIR, 'apple-touch-icon.png'), paintPng(180, 180, gradientPixel));
process.stdout.write('[icons] apple-touch-icon.png (180x180)\n');

process.stdout.write('[icons] OK: 4 icone scritte in apps/web/public/icons/\n');
