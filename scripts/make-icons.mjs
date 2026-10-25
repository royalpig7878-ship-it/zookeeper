// Draws the game's app icons (a pixel-art cream "Z" on a leaf-green tile) and writes them as PNG files.
// Run with: node scripts/make-icons.mjs   (the results are already in public/, this is only for changing them)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
const png = (size, pixel) => {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw.set([r, g, b, a], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

// A 16x16 design, scaled up: 0 = leaf green, 1 = cream, 2 = dark green border, 3 = gold sparkle
const design = [
  '2222222222222222',
  '2000000000000002',
  '2000000000000002',
  '2001111111111002',
  '2001111111111002',
  '2000000000111002',
  '2000000001110002',
  '2000000011100002',
  '2000000111000002',
  '2000001110000002',
  '2000011100000002',
  '2000111000000002',
  '2001111111111002',
  '2001111111111002',
  '2000000000000032',
  '2222222222222222',
];
const colors = { 0: [75, 143, 90, 255], 1: [244, 236, 208, 255], 2: [45, 59, 42, 255], 3: [240, 200, 80, 255] };

mkdirSync('public/icons', { recursive: true });
for (const size of [180, 192, 512]) {
  const buf = png(size, (x, y) => colors[design[Math.floor((y / size) * 16)][Math.floor((x / size) * 16)]]);
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`public/icons/icon-${size}.png`, buf.length, 'bytes');
}
