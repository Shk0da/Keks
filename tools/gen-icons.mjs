// gen-icons.mjs — иконки приложения без зависимостей: растеризация формулами + PNG через zlib.
// Рисуем: тёмный градиент, капюшон с плащом, светящиеся глаза, мозаика цензуры, завиток хлыста.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- PNG энкодер ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- растеризация ----------
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const smooth = e => { const t = clamp01(e); return t * t * (3 - 2 * t); };

function sdSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function renderIcon(S) {
  const rgba = Buffer.alloc(S * S * 4);
  const cx = 0.5, cy = 0.5;
  const rr = 0.42, rad = 0.18; // скруглённый квадрат
  // точки завитка хлыста (спираль от руки)
  const whip = [];
  for (let a = 0; a < Math.PI * 3.2; a += 0.05) {
    const r = 0.08 + a * 0.028;
    whip.push([0.62 + Math.cos(a + 2.4) * r, 0.62 + Math.sin(a + 2.4) * r * 0.9]);
  }
  // мозаика цензуры 3×3 в районе «низа плаща»
  const mosaic = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    mosaic.push([0.5 + i * 0.045, 0.88 + j * 0.045]);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = (x + 0.5) / S, py = (y + 0.5) / S;
      // маска скруглённого квадрата
      const qx = Math.abs(px - cx) - (rr - rad), qy = Math.abs(py - cy) - (rr - rad);
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      if (sd > 0.002) continue;

      // фон: вертикальный градиент + розовое свечение у лица
      let r = 20 + py * 14, g = 8 + py * 6, b = 26 + py * 18;
      const glow = Math.max(0, 1 - Math.hypot(px - 0.5, py - 0.42) * 2.2);
      r += glow * 70; g += glow * 22; b += glow * 60;

      // капюшон: круг головы + трапеция плаща
      const headD = Math.hypot(px - 0.5, py - 0.36) - 0.145;
      const inBody = px > 0.34 - (py - 0.45) * 0.18 && px < 0.66 + (py - 0.45) * 0.18 && py > 0.40 && py < 0.86;
      const cloak = Math.min(headD, inBody ? -0.05 : 0.05);
      if (cloak < 0.01) {
        const shade = 0.55 + 0.45 * (1 - clamp01((px - 0.30) * 2.4));
        r = 90 * shade + 26; g = 28 * shade + 8; b = 52 * shade + 16;
        // тень лица
        const face = Math.hypot((px - 0.5) * 1.15, (py - 0.37) * 1.5) - 0.095;
        if (face < 0) { r = 14; g = 5; b = 12; }
      }

      // глаза
      const e1 = Math.hypot(px - 0.455, py - 0.365), e2 = Math.hypot(px - 0.545, py - 0.365);
      const eye = Math.max(0, 0.02 - Math.min(e1, e2));
      if (eye > 0) {
        const eg = Math.max(0, 1 - Math.min(e1, e2) / 0.055);
        r = Math.min(255, 255 * eye * 40 + 120 * eg); g = Math.min(255, 150 * eye * 40 + 60 * eg); b = Math.min(255, 200 * eye * 40 + 90 * eg);
      }

      // мозаика цензуры
      for (const [mx, my] of mosaic) {
        if (Math.abs(px - mx) < 0.021 && Math.abs(py - my) < 0.021) {
          const v = ((mx + my) * 90 % 1 + 1) % 1;
          r = 150 + v * 60; g = 110 + v * 40; b = 130 + v * 50;
        }
      }

      // завиток хлыста
      let wd = 1e9;
      for (let i = 1; i < whip.length; i++)
        wd = Math.min(wd, sdSegment(px, py, whip[i - 1][0], whip[i - 1][1], whip[i][0], whip[i][1]));
      const whipA = smooth(0.016 - wd);
      if (whipA > 0) {
        r = r * (1 - whipA) + 255 * whipA;
        g = g * (1 - whipA) + 150 * whipA;
        b = b * (1 - whipA) + 195 * whipA;
      }

      // антиалиасинг края
      const alpha = 1 - smooth(sd * S * 1.4 + 0.5);
      const o = (y * S + x) * 4;
      rgba[o] = Math.min(255, r); rgba[o + 1] = Math.min(255, g);
      rgba[o + 2] = Math.min(255, b); rgba[o + 3] = Math.round(255 * alpha);
    }
  }
  return encodePNG(S, S, rgba);
}

const SIZES = { 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192 };
for (const [dpi, size] of Object.entries(SIZES)) {
  const dir = join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${dpi}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ic_launcher.png'), renderIcon(size));
  console.log(`${dpi}: ${size}×${size}`);
}
console.log('OK: иконки сгенерированы');
