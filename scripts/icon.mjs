/**
 * Draws the marketplace icon.
 *
 * The marketplace wants a 128x128 PNG and the activity bar wants an SVG, so
 * the two cannot be one file. Rather than commit a binary nobody can diff,
 * this generates the PNG from the same geometry `resources/ank.svg` draws,
 * using node's own zlib and no dependency: `npm run icon`.
 *
 * The glyph is ank's own mark, taken from `assets/ank.svg` upstream. It is
 * pixel art on a 24-unit grid with `shape-rendering="crispEdges"`, so it is
 * scaled by a whole number and never resampled: at 5x it is 120 units inside a
 * 128 canvas, leaving a four-pixel margin and edges that stay square.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const SIZE = 128;
const SCALE = 5;
const GRID = 24;
const MARGIN = (SIZE - GRID * SCALE) / 2;

const BACKGROUND = [0x14, 0x17, 0x1f];
const GLYPH = [0xe6, 0xed, 0xf3];

/**
 * The mark, as rectangles on the 24-unit grid.
 *
 * Read off the two `<path>` elements of `resources/ank.svg`, which are written
 * as a run of axis-aligned rects: a loop of four bars at the top, the stem
 * down the middle, and the crossbar with the two uprights under it.
 */
const RECTS = [
  // the loop
  [10, 2, 4, 2],
  [10, 8, 4, 2],
  [8, 4, 2, 4],
  [14, 4, 2, 4],
  // the stem
  [11, 9, 2, 12],
  // the crossbar, its uprights, and the two shoulders
  [5, 20, 14, 2],
  [3, 12, 2, 8],
  [19, 12, 2, 8],
  [5, 12, 2, 2],
  [17, 12, 2, 2],
];

function render() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);

  // Ground first.
  for (let at = 0; at < SIZE * SIZE; at += 1) {
    pixels[at * 4] = BACKGROUND[0];
    pixels[at * 4 + 1] = BACKGROUND[1];
    pixels[at * 4 + 2] = BACKGROUND[2];
    pixels[at * 4 + 3] = 0xff;
  }

  // Then the mark, block by block. Every edge lands on a pixel boundary, so
  // there is nothing to antialias and nothing to blur.
  for (const [x, y, width, height] of RECTS) {
    const left = MARGIN + x * SCALE;
    const top = MARGIN + y * SCALE;
    for (let row = 0; row < height * SCALE; row += 1) {
      for (let column = 0; column < width * SCALE; column += 1) {
        const at = ((top + row) * SIZE + left + column) * 4;
        pixels[at] = GLYPH[0];
        pixels[at + 1] = GLYPH[1];
        pixels[at + 2] = GLYPH[2];
      }
    }
  }

  return pixels;
}

/** PNG wants a filter byte in front of every scanline. Zero is "none". */
function scanlines(pixels) {
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return raw;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // colour type: RGBA
header[10] = 0; // deflate
header[11] = 0; // adaptive filtering
header[12] = 0; // no interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(scanlines(render()), { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(import.meta.dirname, '..', 'resources', 'icon.png');
writeFileSync(out, png);
console.log(`wrote ${out} (${String(png.length)} bytes)`);
