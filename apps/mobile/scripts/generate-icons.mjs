/* Generates the ConDeck Remote PWA icons without any image dependency.
 * Run with: node apps/mobile/scripts/generate-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const COLORS = {
  background: [10, 12, 17, 255],
  accent: [124, 92, 255, 255],
  tile: [34, 40, 54, 255],
  highlight: [152, 161, 179, 255],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, sample) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = sample((x + 0.5) / width, (y + 0.5) / height);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedSquare(x, y, left, top, size, radius) {
  if (x < left || x > left + size || y < top || y > top + size) {
    return false;
  }
  const innerLeft = left + radius;
  const innerRight = left + size - radius;
  const innerTop = top + radius;
  const innerBottom = top + size - radius;

  const cx = Math.min(Math.max(x, innerLeft), innerRight);
  const cy = Math.min(Math.max(y, innerTop), innerBottom);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function render(size, { maskable }) {
  const scale = maskable ? 0.62 : 0.78;
  const contentSize = scale;
  const origin = (1 - contentSize) / 2;
  const gap = contentSize * 0.1;
  const tileSize = (contentSize - gap) / 2;
  const radius = tileSize * 0.28;

  const tiles = [
    { x: origin, y: origin, color: COLORS.accent },
    { x: origin + tileSize + gap, y: origin, color: COLORS.tile },
    { x: origin, y: origin + tileSize + gap, color: COLORS.tile },
    { x: origin + tileSize + gap, y: origin + tileSize + gap, color: COLORS.highlight },
  ];

  return encodePng(size, size, (u, v) => {
    for (const tile of tiles) {
      if (insideRoundedSquare(u, v, tile.x, tile.y, tileSize, radius)) {
        return tile.color;
      }
    }
    return COLORS.background;
  });
}

mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ['icon-192.png', render(192, { maskable: false })],
  ['icon-512.png', render(512, { maskable: false })],
  ['maskable-512.png', render(512, { maskable: true })],
];

for (const [name, buffer] of files) {
  writeFileSync(join(OUT_DIR, name), buffer);
  console.log(`wrote ${name} (${buffer.length} bytes)`);
}
