// util.js — математика, RNG, мелочи. Глобальное пространство K.
'use strict';
window.K = window.K || {};

K.TW = 64;   // ширина ромба тайла, px
K.TH = 32;   // высота ромба тайла, px
K.WH = 58;   // высота блока стены, px

K.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
K.lerp = (a, b, t) => a + (b - a) * t;
K.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
K.angTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
// кратчайшая разница углов
K.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
K.isoX = (x, y) => (x - y) * K.TW / 2;
K.isoY = (x, y) => (x + y) * K.TH / 2;

// Детерминированный RNG (mulberry32)
K.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
// стабильный хеш от координат → 0..1 (для вариаций тайлов)
K.hash2 = function (x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
K.choice = (rng, arr) => arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
K.chance = (rng, p) => rng() < p;
K.irange = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

// затемнение/осветление hex-цвета (f от -1 до 1)
K.shade = function (hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
};
K.rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};
K.fmt = n => {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

K.now = () => performance.now();

// Массив-пул частиц и прочего: удалить «дырки» быстро
K.removeIf = function (arr, pred) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) if (!pred(arr[i])) arr[w++] = arr[i];
  arr.length = w;
};
