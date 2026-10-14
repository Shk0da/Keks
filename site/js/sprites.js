// sprites.js — вся процедурная графика: тайлы, стены, пропсы, персонажи, хлыст, эффекты.
// Стиль: тёмное фэнтези, контурная подсветка (rim light), глубокие тени, свечение.
'use strict';
window.Sprites = (function () {

  const TW = K.TW, TH = K.TH, WH = K.WH;
  let cache = {}; // theme.id → {floors:[canvas], wallTop..}

  // ---------- canvas-иконки способностей ----------
  const iconCache = {};
  function icon(id) {
    if (iconCache[id]) return iconCache[id];
    const cv = document.createElement('canvas');
    cv.width = 48; cv.height = 48;
    const g = cv.getContext('2d');
    g.scale(2, 2);
    g.lineCap = 'round';
    switch (id) {
      case 'atk':
        g.strokeStyle = '#a06a3a'; g.lineWidth = 3.4;
        g.beginPath(); g.ellipse(12, 12, 7, 6, 0.4, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(12, 12, 3.6, 3, 0.4, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#c88aa0'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(18, 16); g.quadraticCurveTo(21, 10, 19, 4); g.stroke();
        g.strokeStyle = '#3a2030'; g.lineWidth = 3.8;
        g.beginPath(); g.moveTo(6, 18); g.lineTo(2.5, 21.5); g.stroke();
        g.fillStyle = '#ffd8ec';
        g.beginPath(); g.arc(19, 4, 1.4, 0, Math.PI * 2); g.fill();
        break;
      case 'spatter':
        for (var d1 of [[12, 4], [6, 8], [18, 8], [8, 14], [16, 14], [12, 10]]) {
          g.fillStyle = '#f4f0ff';
          g.beginPath();
          g.moveTo(d1[0], d1[1] - 4);
          g.quadraticCurveTo(d1[0] + 3, d1[1], d1[0], d1[1] + 3);
          g.quadraticCurveTo(d1[0] - 3, d1[1], d1[0], d1[1] - 4);
          g.fill();
        }
        g.fillStyle = '#c8c4e0';
        g.beginPath(); g.arc(10, 19, 1.4, 0, Math.PI * 2); g.fill();
        break;
      case 'spin':
        g.strokeStyle = '#ff9ecf'; g.lineWidth = 2.6;
        g.beginPath();
        for (var a1 = 0; a1 < Math.PI * 4.6; a1 += 0.15) {
          var r1 = 1.4 + a1 * 1.05;
          var px1 = 12 + Math.cos(a1) * r1, py1 = 12 + Math.sin(a1) * r1 * 0.9;
          a1 === 0 ? g.moveTo(px1, py1) : g.lineTo(px1, py1);
        }
        g.stroke();
        g.fillStyle = '#e8b4c8'; g.fillRect(18, 4, 3, 3);
        g.fillStyle = '#c88aa0'; g.fillRect(21, 7, 3, 3);
        break;
      case 'dash':
        g.strokeStyle = '#9ec2ff'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(3, 8); g.quadraticCurveTo(10, 4, 20, 9); g.stroke();
        g.beginPath(); g.moveTo(3, 14); g.quadraticCurveTo(10, 10, 20, 15); g.stroke();
        g.beginPath(); g.moveTo(5, 20); g.quadraticCurveTo(11, 16, 19, 20); g.stroke();
        g.fillStyle = '#f4f0ff';
        g.beginPath(); g.moveTo(22, 12); g.lineTo(13, 7); g.lineTo(15, 12); g.lineTo(13, 17);
        g.closePath(); g.fill();
        break;
      case 'charm':
        drawHeart(g, 12, 13, 8, '#ff6a9e');
        g.fillStyle = 'rgba(255,255,255,.6)';
        g.fillRect(9, 9, 2, 2);
        g.strokeStyle = '#ffd860'; g.lineWidth = 1.2;
        for (var s1 of [[3, 5], [20, 4], [4, 19], [21, 18]]) {
          g.beginPath();
          g.moveTo(s1[0] - 2, s1[1]); g.lineTo(s1[0] + 2, s1[1]);
          g.moveTo(s1[0], s1[1] - 2); g.lineTo(s1[0], s1[1] + 2);
          g.stroke();
        }
        break;
      case 'interact':
        g.fillStyle = '#2c2038';
        g.beginPath();
        g.moveTo(3, 5); g.lineTo(21, 5); g.lineTo(21, 15); g.lineTo(10, 15);
        g.lineTo(6, 20); g.lineTo(7, 15); g.lineTo(3, 15);
        g.closePath(); g.fill();
        g.strokeStyle = '#c9a0e8'; g.lineWidth = 1.2; g.stroke();
        g.strokeStyle = '#f3e8f5'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(6, 9); g.lineTo(18, 9); g.stroke();
        g.beginPath(); g.moveTo(6, 12); g.lineTo(14, 12); g.stroke();
        break;
      case 'potion':
        g.fillStyle = '#58d890';
        g.beginPath(); g.ellipse(12, 14, 5.5, 7, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a7a50';
        g.fillRect(10, 3.5, 4, 5);
        g.strokeStyle = '#1e5a3a'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(12, 14, 5.5, 7, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)';
        g.beginPath(); g.ellipse(10, 11, 1.6, 2.6, 0.4, 0, 0, Math.PI * 2); g.fill();
        break;
    }
    iconCache[id] = cv;
    return cv;
  }

  // ---------- кэш света ----------
  const lightCache = {};
  function lightSprite(col, alpha) {
    var key = col + '_' + Math.round(alpha * 20);
    if (lightCache[key]) return lightCache[key];
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 256;
    var lg = cv.getContext('2d');
    var grd = lg.createRadialGradient(128, 128, 8, 128, 128, 128);
    grd.addColorStop(0, K.rgba(col, alpha));
    grd.addColorStop(0.7, K.rgba(col, alpha * 0.55));
    grd.addColorStop(1, K.rgba(col, 0));
    lg.fillStyle = grd;
    lg.fillRect(0, 0, 256, 256);
    lightCache[key] = cv;
    return cv;
  }

  // ============ подготовка кэша темы ============
  function prepare(theme) {
    if (cache[theme.id]) return cache[theme.id];
    const entry = { floors: [], walls: [] };
    const floors = [];
    for (let v = 0; v < 4; v++) {
      const cv = document.createElement('canvas');
      cv.width = TW + 2; cv.height = TH + 2;
      const g = cv.getContext('2d');
      const col = theme.floor[v % theme.floor.length];
      g.translate(cv.width / 2, 1);
      diamond(g, TW, TH);
      g.fillStyle = col; g.fill();
      // крап + трещины
      const rng = K.mulberry32(v * 7919 + theme.id.length * 131);
      g.strokeStyle = theme.grout; g.lineWidth = 1;
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const px = (rng() - 0.5) * TW * 0.6, py = rng() * TH * 0.6;
        g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.05)';
        g.fillRect(px, py, 2 + rng() * 3, 1 + rng() * 2);
      }
      if (v > 1 && rng() < 0.7) { // трещина
        g.strokeStyle = theme.grout; g.lineWidth = 1.2;
        g.beginPath();
        let cx0 = (rng() - 0.5) * 20, cy0 = rng() * 10 + 4;
        g.moveTo(cx0, cy0);
        for (let s = 0; s < 3; s++) { cx0 += (rng() - 0.5) * 16; cy0 += rng() * 8; g.lineTo(cx0, cy0); }
        g.stroke();
      }
      floors.push(cv);
    }
    // стены: 3 варианта, пре-рендер в offscreen (66×94)
    for (let v = 0; v < 3; v++) {
      const wcv = document.createElement('canvas');
      wcv.width = 66; wcv.height = 94;
      const wg = wcv.getContext('2d');
      const br = 0.93 + v * 0.05;
      const T = [33, 1], R = [65, 17], B = [33, 33], L = [1, 17];
      const T2 = [33, 1 + WH], R2 = [65, 17 + WH], B2 = [33, 33 + WH], L2 = [1, 17 + WH];
      // правая грань
      wg.fillStyle = K.shade(theme.wallR, br - 1);
      wg.beginPath(); wg.moveTo(B[0], B[1]); wg.lineTo(R[0], R[1]); wg.lineTo(R2[0], R2[1]); wg.lineTo(B2[0], B2[1]); wg.closePath(); wg.fill();
      // левая грань
      wg.fillStyle = K.shade(theme.wallL, br - 1);
      wg.beginPath(); wg.moveTo(L[0], L[1]); wg.lineTo(B[0], B[1]); wg.lineTo(B2[0], B2[1]); wg.lineTo(L2[0], L2[1]); wg.closePath(); wg.fill();
      // верхний ромб
      wg.fillStyle = K.shade(theme.wallTop, br - 1);
      wg.beginPath(); wg.moveTo(T[0], T[1]); wg.lineTo(R[0], R[1]); wg.lineTo(B[0], B[1]); wg.lineTo(L[0], L[1]); wg.closePath(); wg.fill();
      wg.strokeStyle = 'rgba(0,0,0,.3)'; wg.lineWidth = 1; wg.stroke();
      // кладка: горизонтальные швы по обеим граням
      wg.strokeStyle = 'rgba(0,0,0,.2)';
      for (let i = 1; i < 3; i++) {
        const y1 = 33 + i * (WH / 3);
        const inset = (y1 - 17) * 0.5;
        wg.beginPath();
        wg.moveTo(1 + inset, y1 - inset);
        wg.lineTo(33, y1);
        wg.lineTo(65 - inset, y1 - inset);
        wg.stroke();
      }
      entry.walls.push(wcv);
    }
    entry.floors = floors;
    cache[theme.id] = entry;
    return entry;
  }

  function diamond(g, w, h) {
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(w / 2, h / 2); g.lineTo(0, h); g.lineTo(-w / 2, h / 2);
    g.closePath();
  }

  // ============ отрисовка мира ============
  function drawFloor(g, theme, tx, ty, sx, sy) {
    const c = prepare(theme);
    const v = (K.hash2(tx, ty) * 4) | 0;
    g.drawImage(c.floors[v], sx - TW / 2 - 1, sy - 1);
  }

  // стена-призма: рисуется кэшированным спрайтом темы
  function drawWall(g, theme, tx, ty, sx, sy) {
    const c = prepare(theme);
    const v = (K.hash2(tx, ty) * 3) | 0;
    g.drawImage(c.walls[v], sx - 33, sy - WH - 1);
  }

  // настенный факел: кронштейн + пламя
  function drawTorch(g, sx, sy, t) {
    // пламя на уровне стены
    const fy = sy - 30;
    g.strokeStyle = '#3a3040'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(sx, sy - 8); g.lineTo(sx, fy + 4); g.stroke();
    g.fillStyle = '#2c2434';
    g.beginPath(); g.ellipse(sx, fy + 4, 4, 2.5, 0, 0, Math.PI * 2); g.fill();
    const fl = 0.8 + Math.sin(t * 9 + sx * 1.7) * 0.2;
    const grd = g.createRadialGradient(sx, fy, 1, sx, fy, 13 * fl);
    grd.addColorStop(0, 'rgba(255,240,180,.95)');
    grd.addColorStop(0.4, 'rgba(255,150,60,.8)');
    grd.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(sx, fy, 8 * fl, 13 * fl, 0, 0, Math.PI * 2); g.fill();
  }

  // опасный тайл (лава/иней/паутина)
  function drawHazard(g, theme, tx, ty, sx, sy, t) {
    let col1, col2;
    if (theme.hazard === 'lava') { col1 = '#ff5a1e'; col2 = '#ffd23e'; }
    else if (theme.hazard === 'frost') { col1 = '#7ec8e8'; col2 = '#d8f4ff'; }
    else { col1 = '#b898d8'; col2 = '#e8d8ff'; }
    const pulse = 0.55 + 0.2 * Math.sin(t * 2.2 + tx * 3.1 + ty * 1.7);
    g.save();
    g.translate(sx, sy);
    diamond(g, TW - 6, TH - 3);
    g.fillStyle = K.rgba(col1, pulse); g.fill();
    g.strokeStyle = K.rgba(col2, 0.6); g.lineWidth = 1.4; g.stroke();
    // блики
    g.fillStyle = K.rgba(col2, 0.5);
    const r1 = K.hash2(tx, ty);
    g.fillRect(-10 + r1 * 8, 4 + Math.sin(t + r1 * 9) * 2, 8, 2);
    g.restore();
  }

  // ============ пропсы ============
  function drawProp(g, p, sx, sy, t) {
    switch (p.type) {
      case 'pillar': pillar(g, sx, sy, 1); break;
      case 'sarcoph': sarcoph(g, sx, sy, p.seed); break;
      case 'skulls': skulls(g, sx, sy, p.seed); break;
      case 'bones': bones(g, sx, sy, p.seed); break;
      case 'brazier': brazier(g, sx, sy, t); break;
      case 'candle': candle(g, sx, sy, t); break;
      case 'cocoon': cocoon(g, sx, sy, t); break;
      case 'shelf': shelf(g, sx, sy, p.seed); break;
      case 'icicle': icicle(g, sx, sy, p.seed); break;
      case 'shrine': shrine(g, sx, sy, t); break;
      // --- украшения данжа ---
      case 'web': web(g, sx, sy, p.seed); break;
      case 'body': bodyCorner(g, sx, sy, p.seed); break;
      case 'barrel': emptyBarrel(g, sx, sy, p.seed); break;
      case 'arrowwall': arrowWall(g, sx, sy, p.seed); break;
      case 'sword': swordWall(g, sx, sy, p.seed); break;
    }
  }

  // паутина: полотно с паучком
  function web(g, sx, sy, seed) {
    const rng = K.mulberry32(seed || 1);
    const r = 16 + rng() * 10;
    g.strokeStyle = 'rgba(225,225,235,.4)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = rng() * Math.PI * 2;
      g.beginPath(); g.moveTo(sx, sy - 20);
      g.lineTo(sx + Math.cos(a) * r, sy - 20 + Math.sin(a) * r * 0.6 + 10);
      g.stroke();
    }
    for (let k = 1; k <= 3; k++) {
      g.beginPath();
      g.ellipse(sx, sy - 12, r * k / 3.2, r * k / 5.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#2a2430';
    g.beginPath(); g.arc(sx + r * 0.5, sy - 8, 1.6, 0, Math.PI * 2); g.fill();
  }

  // тело в углу: силуэт под тряпкой
  function bodyCorner(g, sx, sy, seed) {
    const rng = K.mulberry32(seed || 2);
    const rot = (rng() - 0.5) * 0.6;
    g.save();
    g.translate(sx, sy); g.rotate(rot);
    g.fillStyle = rng() < 0.5 ? '#4a4258' : '#54483a';
    g.beginPath();
    g.moveTo(-12, 0); g.quadraticCurveTo(-14, -10, -6, -12);
    g.quadraticCurveTo(2, -16, 8, -10); g.quadraticCurveTo(12, -4, 8, 0);
    g.closePath(); g.fill();
    g.strokeStyle = '#c8b49a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(7, -8); g.lineTo(14, -3); g.stroke();
    g.lineCap = 'butt';
    g.restore();
  }

  // пустая бочка (на боку)
  function emptyBarrel(g, sx, sy, seed) {
    const rng = K.mulberry32(seed || 3);
    shadowE(g, sx, sy + 1, 16, 6, .35);
    g.save();
    g.translate(sx, sy - 6);
    g.rotate(rng() < 0.5 ? -0.35 : 0.3);
    g.fillStyle = '#5e442c';
    g.fillRect(-14, -7, 28, 14);
    g.strokeStyle = '#3a2a18'; g.lineWidth = 1.3;
    g.strokeRect(-14, -7, 28, 14);
    g.beginPath(); g.moveTo(-14, -2); g.lineTo(14, -2); g.stroke();
    g.beginPath(); g.moveTo(-14, 3); g.lineTo(14, 3); g.stroke();
    g.fillStyle = '#1a120a';
    g.beginPath(); g.ellipse(14, 0, 3, 6.5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // стрелы, торчащие из пола/стены
  function arrowWall(g, sx, sy, seed) {
    const rng = K.mulberry32(seed || 4);
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const ax = sx + (rng() - 0.5) * 26, ay = sy + (rng() - 0.5) * 14;
      const a = -Math.PI / 2 + (rng() - 0.5) * 0.9;
      const len = 12 + rng() * 8;
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(ax + Math.cos(a) * len * 0.3, ay + Math.sin(a) * len);
      g.stroke();
      g.strokeStyle = '#c8b490'; g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(ax + Math.cos(a) * len * 0.3, ay + Math.sin(a) * len);
      g.lineTo(ax + Math.cos(a) * len * 0.3 + 4, ay + Math.sin(a) * len - 3);
      g.stroke();
    }
  }

  // меч в полу
  function swordWall(g, sx, sy, seed) {
    const rng = K.mulberry32(seed || 5);
    const a = -Math.PI / 2 + (rng() - 0.5) * 0.7;
    g.save();
    g.translate(sx, sy); g.rotate(a + Math.PI / 2);
    const grd = g.createLinearGradient(0, -20, 0, 6);
    grd.addColorStop(0, '#b8c4d8'); grd.addColorStop(1, '#6a7488');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-2.4, -22); g.lineTo(2.4, -22); g.lineTo(1.6, 6); g.lineTo(-1.6, 6);
    g.closePath(); g.fill();
    g.fillStyle = '#8a6a30';
    g.fillRect(-6, -22, 12, 3);
    g.fillStyle = '#4a3220';
    g.fillRect(-1.5, -30, 3, 8);
    g.restore();
  }

  // летучая мышь: порхает по эллипсу
  function drawBat(g, sx, sy, t, seed) {
    const ph = t * 3 + seed;
    const flap = Math.sin(ph * 14);
    const yy = sy - 70 - Math.sin(ph) * 10 - Math.sin(ph * 2.2) * 6;
    g.fillStyle = 'rgba(30,24,40,.9)';
    g.beginPath(); g.ellipse(sx, yy, 3, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath();
    g.moveTo(sx - 2, yy);
    g.quadraticCurveTo(sx - 10, yy - 6 * flap - 4, sx - 15, yy - 2 * flap);
    g.quadraticCurveTo(sx - 9, yy + 3, sx - 2, yy + 2);
    g.fill();
    g.beginPath();
    g.moveTo(sx + 2, yy);
    g.quadraticCurveTo(sx + 10, yy - 6 * flap - 4, sx + 15, yy - 2 * flap);
    g.quadraticCurveTo(sx + 9, yy + 3, sx + 2, yy + 2);
    g.fill();
    g.beginPath(); g.moveTo(sx - 2, yy - 4); g.lineTo(sx - 3, yy - 7); g.lineTo(sx - 0.5, yy - 4.5); g.fill();
    g.beginPath(); g.moveTo(sx + 2, yy - 4); g.lineTo(sx + 3, yy - 7); g.lineTo(sx + 0.5, yy - 4.5); g.fill();
    g.fillStyle = '#ffd060';
    g.fillRect(sx - 1.8, yy - 1, 1.2, 1);
    g.fillRect(sx + 0.6, yy - 1, 1.2, 1);
  }

  // таракан: суета по полу
  function drawRoach(g, sx, sy, t, seed) {
    const ph = t * 2 + seed;
    const wig = Math.sin(ph * 26) * 2;
    const yy = sy - 2 + Math.sin(ph * 3);
    g.fillStyle = '#3a2a20';
    g.beginPath(); g.ellipse(sx + wig * 0.5, yy, 3.4, 2, wig * 0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2a20'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(sx + wig * 0.5 + 3, yy - 0.5); g.lineTo(sx + wig * 0.5 + 6, yy - 2 + wig); g.stroke();
    g.beginPath(); g.moveTo(sx + wig * 0.5 + 3, yy + 0.5); g.lineTo(sx + wig * 0.5 + 6, yy + 2 + wig); g.stroke();
    g.beginPath(); g.moveTo(sx - 1 + wig, yy + 2); g.lineTo(sx - 2 + wig, yy + 4); g.stroke();
    g.beginPath(); g.moveTo(sx + 1 + wig, yy + 2); g.lineTo(sx + 2 + wig, yy + 4); g.stroke();
  }

  // привидение: медленно проплывает, полупрозрачное
  function drawGhostCritter(g, sx, sy, t, seed) {
    const ph = t * 0.5 + seed;
    const drift = Math.sin(ph) * 40;
    const yy = sy - 55 + Math.sin(ph * 1.7) * 12;
    g.save();
    g.globalAlpha = 0.35 + 0.12 * Math.sin(t * 2 + seed);
    g.fillStyle = '#cfe0f8';
    g.beginPath();
    g.moveTo(sx + drift - 9, yy + 14);
    g.quadraticCurveTo(sx + drift - 11, yy - 12, sx + drift, yy - 16);
    g.quadraticCurveTo(sx + drift + 11, yy - 12, sx + drift + 9, yy + 14);
    for (let i = 0; i < 3; i++)
      g.quadraticCurveTo(sx + drift + 9 - i * 6 - 3, yy + 14 + (i % 2 ? 4 : -2) + Math.sin(t * 3 + i) * 2,
                         sx + drift + 9 - (i + 1) * 6, yy + 14);
    g.closePath(); g.fill();
    g.fillStyle = '#3a4a68';
    g.beginPath(); g.ellipse(sx + drift - 3, yy - 4, 1.8, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(sx + drift + 3, yy - 4, 1.8, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }



  function shadowE(g, sx, sy, rx, ry, a) {
    g.fillStyle = 'rgba(0,0,5,' + (a || 0.4) + ')';
    g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }

  function pillar(g, sx, sy) {
    shadowE(g, sx, sy + 2, 20, 9, .45);
    // основание, ствол, капитель — рисуем «изометрический» цилиндр
    const h = 66;
    g.fillStyle = '#3c4258';
    g.beginPath();
    g.moveTo(sx - 13, sy - 6); g.lineTo(sx + 13, sy - 6);
    g.lineTo(sx + 13, sy - h); g.lineTo(sx - 13, sy - h);
    g.closePath(); g.fill();
    g.fillStyle = '#2c3042';
    g.beginPath();
    g.ellipse(sx + 13, sy - 6, 5, 8, 0, Math.PI / 2, -Math.PI / 2, true);
    g.lineTo(sx + 13, sy - h); g.ellipse(sx + 13, sy - h, 5, 8, 0, -Math.PI / 2, Math.PI / 2, true);
    g.closePath(); g.fill();
    g.fillStyle = '#4c5470';
    g.beginPath(); g.ellipse(sx, sy - h, 13, 8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(sx, sy - h, 13, 8, 0, 0, Math.PI * 2); g.stroke();
    // блики
    g.strokeStyle = 'rgba(160,180,230,.25)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(sx - 8, sy - 14); g.lineTo(sx - 8, sy - h + 6); g.stroke();
  }

  function sarcoph(g, sx, sy, seed) {
    shadowE(g, sx, sy + 2, 26, 12, .45);
    const rng = K.mulberry32(seed);
    g.fillStyle = '#4a4f66';
    g.beginPath();
    g.moveTo(sx - 24, sy - 4); g.lineTo(sx, sy + 8); g.lineTo(sx + 24, sy - 4);
    g.lineTo(sx + 24, sy - 22); g.lineTo(sx, sy - 10); g.lineTo(sx - 24, sy - 22);
    g.closePath(); g.fill();
    g.fillStyle = '#5a6078';
    g.beginPath();
    g.moveTo(sx - 24, sy - 22); g.lineTo(sx, sy - 10); g.lineTo(sx + 24, sy - 22);
    g.lineTo(sx, sy - 34);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.stroke();
    // трещины
    g.strokeStyle = 'rgba(0,0,0,.3)';
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      let x = sx - 12 + rng() * 24, y = sy - 26 + rng() * 10;
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 10, y - rng() * 8); g.stroke();
    }
  }

  function skulls(g, sx, sy, seed) {
    const rng = K.mulberry32(seed);
    for (let i = 0; i < 5; i++) {
      const x = sx + (rng() - 0.5) * 26, y = sy + (rng() - 0.5) * 10;
      const s = 3 + rng() * 3;
      g.fillStyle = '#cfc4b0';
      g.beginPath(); g.ellipse(x, y, s, s * 0.85, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1418';
      g.fillRect(x - s * 0.55, y - s * 0.2, s * 0.35, s * 0.3);
      g.fillRect(x + s * 0.2, y - s * 0.2, s * 0.35, s * 0.3);
    }
  }

  function bones(g, sx, sy, seed) {
    const rng = K.mulberry32(seed);
    g.strokeStyle = '#c8bda8'; g.lineWidth = 2.5; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const x = sx + (rng() - 0.5) * 30, y = sy + (rng() - 0.5) * 12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 6); g.stroke();
    }
    g.lineCap = 'butt';
  }

  function brazier(g, sx, sy, t) {
    shadowE(g, sx, sy + 2, 14, 6, .4);
    g.fillStyle = '#3a3040';
    g.beginPath(); g.moveTo(sx - 10, sy - 2); g.lineTo(sx + 10, sy - 2);
    g.lineTo(sx + 6, sy - 18); g.lineTo(sx - 6, sy - 18); g.closePath(); g.fill();
    g.fillStyle = '#2c2434';
    g.beginPath(); g.ellipse(sx, sy - 18, 8, 4, 0, 0, Math.PI * 2); g.fill();
    // огонь
    const fl = 0.8 + Math.sin(t * 9 + sx) * 0.2;
    const grd = g.createRadialGradient(sx, sy - 24, 1, sx, sy - 24, 14 * fl);
    grd.addColorStop(0, 'rgba(255,240,180,.95)');
    grd.addColorStop(0.4, 'rgba(255,150,60,.75)');
    grd.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(sx, sy - 24, 9 * fl, 15 * fl, 0, 0, Math.PI * 2); g.fill();
  }

  function candle(g, sx, sy, t) {
    g.fillStyle = '#d8d0c0';
    g.fillRect(sx - 2, sy - 12, 4, 12);
    const fl = 0.7 + Math.sin(t * 11 + sx * 2) * 0.3;
    const grd = g.createRadialGradient(sx, sy - 16, 0.5, sx, sy - 16, 9 * fl);
    grd.addColorStop(0, 'rgba(255,235,190,.95)');
    grd.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(sx, sy - 16, 9 * fl, 0, Math.PI * 2); g.fill();
  }

  function cocoon(g, sx, sy, t) {
    shadowE(g, sx, sy + 2, 16, 7, .4);
    const pul = 1 + Math.sin(t * 1.8 + sx) * 0.03;
    g.save(); g.translate(sx, sy); g.scale(pul, 1);
    g.fillStyle = '#c8b4d8';
    g.beginPath(); g.ellipse(0, -26, 14, 30, 0.08, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(90,60,110,.5)'; g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      g.beginPath(); g.ellipse(0, -26, 13, 29, 0.08 + i * 0.12, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
    // тень внутри — намёк на обитательницу
    g.fillStyle = 'rgba(60,30,70,.55)';
    g.beginPath(); g.ellipse(sx + 2, sy - 28, 5, 16, 0.05, 0, Math.PI * 2); g.fill();
  }

  function shelf(g, sx, sy, seed) {
    shadowE(g, sx, sy + 2, 24, 10, .45);
    const rng = K.mulberry32(seed);
    g.fillStyle = '#4e3a28';
    g.fillRect(sx - 24, sy - 58, 48, 58);
    g.fillStyle = '#3a2a1c';
    g.fillRect(sx - 20, sy - 54, 40, 50);
    for (let row = 0; row < 3; row++) {
      const y = sy - 44 + row * 16;
      let x = sx - 19;
      while (x < sx + 15) {
        const w = 3 + rng() * 3, h = 10 + rng() * 4;
        const hue = ['#8a3040', '#3a5a8a', '#7a6a2a', '#5a3a7a', '#8a5a2a'][(rng() * 5) | 0];
        g.fillStyle = hue;
        g.fillRect(x, y - h, w, h);
        x += w + 1;
      }
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.fillRect(sx - 20, y + 1, 40, 2);
    }
  }

  function icicle(g, sx, sy, seed) {
    shadowE(g, sx, sy + 2, 16, 7, .35);
    g.fillStyle = 'rgba(190,225,250,.9)';
    g.beginPath();
    g.moveTo(sx - 12, sy - 2); g.lineTo(sx, sy + 6); g.lineTo(sx + 12, sy - 2);
    g.lineTo(sx + 8, sy - 34); g.lineTo(sx - 8, sy - 34);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.beginPath(); g.moveTo(sx - 6, sy - 30); g.lineTo(sx - 2, sy - 4); g.lineTo(sx + 2, sy - 4); g.closePath(); g.fill();
  }

  function shrine(g, sx, sy, t) {
    shadowE(g, sx, sy + 2, 20, 9, .5);
    g.fillStyle = '#4c4460';
    g.beginPath(); g.ellipse(sx, sy - 8, 16, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5c5470';
    g.fillRect(sx - 6, sy - 26, 12, 18);
    const pul = 0.6 + Math.sin(t * 3) * 0.25;
    const grd = g.createRadialGradient(sx, sy - 34, 1, sx, sy - 34, 18);
    grd.addColorStop(0, K.rgba('#ff9ecf', pul));
    grd.addColorStop(1, 'rgba(255,158,207,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(sx, sy - 34, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd8ec';
    g.beginPath(); g.arc(sx, sy - 34, 3.5, 0, Math.PI * 2); g.fill();
  }

  // ============ выход/портал/сундук ============
  // Готические врата спуска (выход этажа): арка, решётка поднимается при подходе.
  // openK: 0 — закрыта, 1 — открыта.
  function drawDoor(g, sx, sy, t, openK, theme) {
    const W = 46, H = 84;                       // ширина/высота арки
    const accent = theme ? theme.torch : '#ffb46b';
    shadowE(g, sx, sy + 2, 30, 12, .5);

    // проём: тёмный зев с глубинным градиентом
    const dg = g.createLinearGradient(sx, sy - H, sx, sy);
    dg.addColorStop(0, '#0a0612');
    dg.addColorStop(1, '#150a20');
    g.fillStyle = dg;
    g.beginPath();
    g.moveTo(sx - W / 2 + 6, sy);
    g.lineTo(sx - W / 2 + 6, sy - H + W / 2);
    g.arc(sx, sy - H + W / 2, W / 2 - 6, Math.PI, 0);
    g.lineTo(sx + W / 2 - 6, sy);
    g.closePath();
    g.fill();

    // свет из-за врат, когда открыты
    if (openK > 0.05) {
      const glowA = 0.35 * openK + 0.12 * Math.sin(t * 5) * openK;
      const rg = g.createRadialGradient(sx, sy - H * 0.45, 2, sx, sy - H * 0.45, 34 * openK + 8);
      rg.addColorStop(0, K.rgba(accent, glowA));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(sx, sy - H * 0.45, 22 * openK + 6, 30 * openK + 8, 0, 0, Math.PI * 2); g.fill();
      // руна-круг на полу проёма
      g.strokeStyle = K.rgba(accent, 0.5 * openK);
      g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(sx, sy - 2, 16 * openK, 7 * openK, 0, 0, Math.PI * 2); g.stroke();
    }

    // решётка: вертикальные прутья, уезжает вверх при открытии
    if (openK < 0.98) {
      const lift = openK * H * 0.85;
      g.save();
      g.beginPath();
      g.rect(sx - W / 2 + 7, sy - H + 4, W - 14, H - 4);   // клип проёма
      g.clip();
      g.translate(0, -lift);
      g.strokeStyle = '#6a6478'; g.lineWidth = 2.6;
      for (let i = 0; i < 5; i++) {
        const bx = sx - W / 2 + 12 + i * ((W - 24) / 4);
        g.beginPath(); g.moveTo(bx, sy - H + 4); g.lineTo(bx, sy); g.stroke();
      }
      g.strokeStyle = '#57516a'; g.lineWidth = 2;
      for (let j = 1; j <= 3; j++) {
        const by = sy - H * 0.25 * j;
        g.beginPath(); g.moveTo(sx - W / 2 + 8, by); g.lineTo(sx + W / 2 - 8, by); g.stroke();
      }
      g.restore();
    }

    // каменные стойки арки
    const pillar = (px) => {
      g.fillStyle = theme ? theme.wallTop : '#525873';
      g.fillRect(px - 7, sy - H - 4, 14, H + 6);
      g.fillStyle = theme ? theme.wallL : '#343850';
      g.fillRect(px + 4, sy - H - 4, 3, H + 6);            // тень-грань
      g.fillStyle = theme ? K.shade(theme.wallTop, 0.18) : '#5f6683';
      g.fillRect(px - 9, sy - H - 10, 18, 8);              // капитель
      g.fillRect(px - 8, sy - 6, 16, 8);                   // база
    };
    pillar(sx - W / 2);
    pillar(sx + W / 2);
    // арочный замоќовый камень + клинья
    g.fillStyle = theme ? K.shade(theme.wallTop, 0.1) : '#5a6078';
    g.beginPath();
    g.moveTo(sx - W / 2 + 2, sy - H + W / 2);
    g.arc(sx, sy - H + W / 2, W / 2 - 2, Math.PI, 0);
    g.lineTo(sx + W / 2 - 2, sy - H + W / 2);
    g.lineTo(sx + W / 2 - 6, sy - H + W / 2 - 4);
    g.arc(sx, sy - H + W / 2, W / 2 - 6, 0, Math.PI, true);
    g.closePath();
    g.fill();
    g.fillStyle = theme ? K.shade(theme.wallTop, 0.3) : '#707896';
    g.beginPath();
    g.moveTo(sx, sy - H - 6); g.lineTo(sx + 7, sy - H + 6); g.lineTo(sx - 7, sy - H + 6);
    g.closePath(); g.fill();

    // пульсирующие руны на стойках (ярче, когда открыто)
    const runeA = 0.35 + 0.5 * openK + 0.15 * Math.sin(t * 6);
    g.fillStyle = K.rgba(accent, runeA);
    g.shadowColor = K.rgba(accent, 0.8); g.shadowBlur = 6;
    for (const px of [sx - W / 2, sx + W / 2]) {
      g.fillRect(px - 2, sy - H * 0.66, 4, 10);
      g.fillRect(px - 2, sy - H * 0.36, 4, 10);
    }
    g.shadowBlur = 0;
  }


  // ============ лестница (устаревший выход) / портал / сундук ============
  function drawStairs(g, sx, sy, t) {
    g.save(); g.translate(sx, sy);
    diamond(g, TW - 8, TH - 4); g.fillStyle = '#241e30'; g.fill();
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(0, -4 * i); g.scale(1 - i * 0.18, 1 - i * 0.18);
      diamond(g, TW - 10, TH - 5);
      g.fillStyle = i % 2 ? '#38304a' : '#443a58'; g.fill();
      g.strokeStyle = 'rgba(140,120,190,.3)'; g.stroke();
      g.restore();
    }
    g.restore();
    // свечение
    const pul = 0.5 + Math.sin(t * 2.6) * 0.25;
    const grd = g.createRadialGradient(sx, sy - 8, 2, sx, sy - 8, 30);
    grd.addColorStop(0, K.rgba('#9a78ff', 0.5 * pul));
    grd.addColorStop(1, 'rgba(154,120,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(sx, sy - 4, 26, 15, 0, 0, Math.PI * 2); g.fill();
  }

  function drawPortal(g, sx, sy, t, hue) {
    shadowE(g, sx, sy + 2, 22, 10, .5);
    const pul = 0.85 + Math.sin(t * 3.2) * 0.15;
    g.save(); g.translate(sx, sy - 34);
    for (let i = 3; i >= 0; i--) {
      const r = (26 - i * 5) * pul;
      g.strokeStyle = K.rgba(hue || '#ff7ab8', 0.25 + i * 0.2);
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(0, 0, r * 0.72, r, Math.sin(t * 1.4 + i) * 0.2, 0, Math.PI * 2); g.stroke();
    }
    const grd = g.createRadialGradient(0, 0, 2, 0, 0, 24 * pul);
    grd.addColorStop(0, 'rgba(255,255,255,.75)');
    grd.addColorStop(0.35, K.rgba(hue || '#ff7ab8', 0.5));
    grd.addColorStop(1, 'rgba(255,122,184,0)');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, 20 * pul, 26 * pul, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawChest(g, sx, sy, opened, t) {
    shadowE(g, sx, sy + 2, 18, 8, .4);
    g.fillStyle = '#6a4a2a';
    g.fillRect(sx - 15, sy - 16, 30, 16);
    g.fillStyle = '#7a5a34';
    if (opened) {
      g.save(); g.translate(sx, sy - 16); g.rotate(-0.5);
      g.fillStyle = '#5a3e22';
      g.fillRect(-15, -12, 30, 12);
      g.restore();
      // блеск изнутри
      const pul = 0.6 + Math.sin(t * 4) * 0.3;
      const grd = g.createRadialGradient(sx, sy - 14, 1, sx, sy - 14, 16);
      grd.addColorStop(0, K.rgba('#ffd860', 0.8 * pul));
      grd.addColorStop(1, 'rgba(255,216,96,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(sx, sy - 12, 16, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath();
      g.moveTo(sx - 15, sy - 16); g.quadraticCurveTo(sx, sy - 30, sx + 15, sy - 16);
      g.closePath(); g.fill();
    }
    g.strokeStyle = '#3a2814'; g.lineWidth = 1.5;
    g.strokeRect(sx - 15, sy - 16, 30, 16);
    g.fillStyle = '#f0c060';
    g.fillRect(sx - 2, sy - 14, 4, 8);
  }

  // ============ ГЕРОЙ ============
  // p: {x,y,facing,walkPhase,moving,attackT,attackDir,spinT,dashT,hp,maxHp}
  function drawPlayer(g, p, sx, sy, t, whip) {
    const breathe = Math.sin(t * 2.4) * 1.5;
    const moving = p.moving;
    const wp = p.walkPhase;
    const bob = moving ? Math.abs(Math.sin(wp)) * 3 : breathe * 0.6;
    const hipY = sy - 26 - bob * 0.4;
    const shoulderY = sy - 52 - bob;
    const headY = sy - 62 - bob;

    shadowE(g, sx, sy + 1, 17, 8, .5);

    // --- плащ (за телом) ---
    const flap = Math.sin(t * 6) * (moving ? 5 : 2) + (moving ? Math.sin(wp) * 3 : 0);
    const spread = moving ? 10 : 6;
    g.beginPath();
    g.moveTo(sx - 11, shoulderY + 2);
    g.quadraticCurveTo(sx - 16 - spread, hipY - 6, sx - 13 - flap * 0.4, sy - 2);
    g.quadraticCurveTo(sx, sy + 3 + Math.sin(t * 4) * 1.5, sx + 13 + flap * 0.4, sy - 2);
    g.quadraticCurveTo(sx + 16 + spread, hipY - 6, sx + 11, shoulderY + 2);
    g.quadraticCurveTo(sx, shoulderY - 7, sx - 11, shoulderY + 2);
    g.closePath();
    const cg = g.createLinearGradient(sx, shoulderY, sx, sy);
    cg.addColorStop(0, '#5a1f3d'); cg.addColorStop(1, '#2e0f22');
    g.fillStyle = cg; g.fill();
    g.strokeStyle = '#8a2f5a'; g.lineWidth = 1.6; g.stroke();
    // складки
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(sx + i * 6, shoulderY + 6);
      g.quadraticCurveTo(sx + i * 8 + flap * 0.3, hipY, sx + i * 7 + flap * 0.5, sy - 4);
      g.stroke();
    }

    // --- ноги (из-под плаща, при движении шагают) ---
    g.strokeStyle = '#d8a882'; g.lineWidth = 4.5; g.lineCap = 'round';
    const st = moving ? Math.sin(wp) * 6 : 0;
    g.beginPath(); g.moveTo(sx - 4, hipY); g.lineTo(sx - 4 - st * 0.6, sy - 1 + (moving ? Math.abs(Math.cos(wp)) * -1 : 0)); g.stroke();
    g.beginPath(); g.moveTo(sx + 4, hipY); g.lineTo(sx + 4 + st * 0.6, sy - 1 + (moving ? Math.abs(Math.cos(wp + Math.PI)) * -1 : 0)); g.stroke();
    // обувь
    g.strokeStyle = '#3a2430'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(sx - 4 - st * 0.6, sy - 2); g.lineTo(sx - 5 - st * 0.7, sy); g.stroke();
    g.beginPath(); g.moveTo(sx + 4 + st * 0.6, sy - 2); g.lineTo(sx + 5 + st * 0.7, sy); g.stroke();
    g.lineCap = 'butt';

    // --- торс (голый, атлетичный, стилизованно) ---
    const tg = g.createLinearGradient(sx - 8, shoulderY, sx + 8, hipY);
    tg.addColorStop(0, '#e8b48c'); tg.addColorStop(1, '#c68d68');
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(sx - 8, shoulderY + 3);
    g.quadraticCurveTo(sx - 10, hipY - 12, sx - 7, hipY);
    g.lineTo(sx + 7, hipY);
    g.quadraticCurveTo(sx + 10, hipY - 12, sx + 8, shoulderY + 3);
    g.quadraticCurveTo(sx, shoulderY - 4, sx - 8, shoulderY + 3);
    g.closePath(); g.fill();
    // мышцы пресса и груди — лёгкие линии
    g.strokeStyle = 'rgba(120,70,40,.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(sx, shoulderY + 8); g.lineTo(sx, hipY - 2); g.stroke();
    for (let i = 0; i < 2; i++) {
      const yy = shoulderY + 14 + i * 7;
      g.beginPath(); g.moveTo(sx - 4, yy); g.lineTo(sx + 4, yy); g.stroke();
    }
    g.beginPath(); g.moveTo(sx - 5, shoulderY + 7); g.quadraticCurveTo(sx - 2, shoulderY + 9, sx, shoulderY + 7); g.stroke();
    g.beginPath(); g.moveTo(sx + 5, shoulderY + 7); g.quadraticCurveTo(sx + 2, shoulderY + 9, sx, shoulderY + 7); g.stroke();

    // --- сосковые висюльки: золотые колечки с кулонами, качаются от шагов ---
    // в покое — лёгкое дыхание, на бегу — маятник в такт, в вихре — разлёт
    const inSpin = p.spinT > 0;
    const swayAmp = inSpin ? 1.2 : (p.moving ? 0.5 : 0.09);
    const swaySpd = inSpin ? 22 : (p.moving ? 9 : 1.8);
    const walkKick = p.moving ? Math.cos(p.walkPhase) * 0.18 : 0;
    [[-4.5, 0], [4.5, Math.PI]].forEach(([nx, ph], idx) => {
      const axp = sx + nx, ayp = shoulderY + 9;
      const th = Math.sin(t * swaySpd + ph) * swayAmp + walkKick;
      const L1 = 3, L2 = 3;
      const x1 = axp + Math.sin(th) * L1, y1 = ayp + Math.cos(th) * L1;
      const th2 = th * 0.85 + Math.sin(t * swaySpd * 1.7 + ph) * 0.1;
      const x2 = x1 + Math.sin(th2) * L2, y2 = y1 + Math.cos(th2) * L2;
      // колечко у соска
      g.strokeStyle = '#f0c060'; g.lineWidth = 1.3;
      g.beginPath(); g.arc(axp, ayp, 1.8, 0, Math.PI * 2); g.stroke();
      // цепочка
      g.beginPath(); g.moveTo(axp, ayp + 1.5); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      // кулон: слева сердечко, справа камушек-ромбик
      if (idx === 0) drawHeart(g, x2, y2 + 2.5, 2.6, '#ff6a9e');
      else {
        g.fillStyle = '#a8e6ff';
        g.beginPath();
        g.moveTo(x2, y2); g.lineTo(x2 + 2, y2 + 2.5); g.lineTo(x2, y2 + 5); g.lineTo(x2 - 2, y2 + 2.5);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.5; g.stroke();
      }
    });

    // --- ЦЕНЗОРНАЯ МОЗАИКА (гэг 18+) — здесь же «гнездо» Хлыста Праотца:
    //     при ударе/вихре мозаика заряжается и хлыст вырывается из-за неё ---
    const mx = sx, my = hipY - 4;
    const cell = 3.4;
    const charging = (p.strikeT > 0) || (p.spinT > 0);
    const pulse = charging ? 0.5 + 0.5 * Math.sin(t * 22) : 0;
    if (charging) {
      // сияние «заряда» за мозаикой
      const grd = g.createRadialGradient(mx, my, 1, mx, my, 14 + pulse * 6);
      grd.addColorStop(0, K.rgba('#ff9ecf', 0.35 + pulse * 0.3));
      grd.addColorStop(1, 'rgba(255,158,207,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(mx, my, 14 + pulse * 6, 0, Math.PI * 2); g.fill();
    }
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const sh = 0.75 + ((i + j + 2 + Math.floor(t * 7)) % 3) * 0.12;
      let col = K.shade('#b08090', sh - 1);
      if (charging && (i + j + Math.floor(t * 15)) % 3 === 0) col = '#ffd8ec';
      g.fillStyle = col;
      g.fillRect(mx + i * cell - cell / 2, my + j * cell - cell / 2, cell - 0.3, cell - 0.3);
    }
    g.strokeStyle = charging ? K.rgba('#ff9ecf', 0.7) : 'rgba(255,255,255,.15)';
    g.lineWidth = charging ? 1.2 : 0.6;
    g.strokeRect(mx - cell * 1.5, my - cell * 1.5, cell * 3, cell * 3);

    // --- голова в капюшоне ---
    g.fillStyle = '#2e0f22';
    g.beginPath();
    g.moveTo(sx - 9, headY + 8);
    g.quadraticCurveTo(sx - 10, headY - 6, sx, headY - 8);
    g.quadraticCurveTo(sx + 10, headY - 6, sx + 9, headY + 8);
    g.quadraticCurveTo(sx, headY + 13, sx - 9, headY + 8);
    g.closePath(); g.fill();
    g.strokeStyle = '#8a2f5a'; g.lineWidth = 1.4; g.stroke();
    // тень лица + светящиеся глаза
    g.fillStyle = '#14060f';
    g.beginPath(); g.ellipse(sx, headY + 4, 6, 5, 0, 0, Math.PI * 2); g.fill();
    const eyeGlow = 0.7 + Math.sin(t * 3.5) * 0.3;
    g.fillStyle = K.rgba('#ffd8ec', eyeGlow);
    g.shadowColor = '#ff7ab8'; g.shadowBlur = 6;
    g.fillRect(sx - 3.5, headY + 3, 2.4, 1.8);
    g.fillRect(sx + 1.5, headY + 3, 2.4, 1.8);
    g.shadowBlur = 0;

    // --- рука: театральный жест дирижёра (хлыст живёт у мозаики) / флакон зелья ---
    const drinking = p.drinkT > 0;
    const armAng = drinking ? -1.9 : (whip ? whip.armAngle : p.facing);
    const ax = sx + Math.cos(armAng) * 10, ay = shoulderY + 8 + Math.sin(armAng) * 4;
    g.strokeStyle = '#e8b48c'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx + 5, shoulderY + 6); g.lineTo(ax, ay); g.stroke();
    g.lineCap = 'butt';
    // поза пития: флакон у рта, лёгкий наклон головы назад
    if (drinking) {
      const col = p.lastPotionCol || '#58d890';
      g.save();
      g.translate(ax - 1, ay - 2);
      g.rotate(-0.5 - Math.sin(t * 14) * 0.12); // трясёт флакон — «глотки»
      g.fillStyle = col;
      g.beginPath(); g.ellipse(0, 0, 3, 4.4, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = K.shade(col, -0.5); g.lineWidth = 1; g.stroke();
      g.fillStyle = K.shade(col, -0.5);
      g.fillRect(-1.2, -6.5, 2.4, 3);
      g.restore();
      // пузырьки над головой
      if (Math.random() < 0.3) {
        g.fillStyle = K.rgba(col, 0.7);
        g.beginPath(); g.arc(sx - 3 + Math.random() * 6, headY - 6 - Math.random() * 6, 1.2, 0, Math.PI * 2); g.fill();
      }
    }

    // хлыст растёт из-за мозаики цензуры (рука — лишь указующее па)
    if (whip) whip.draw(g, mx, my - 2, t);
  }

  // ============ ХЛЫСТ-ВЕРЛЕТ ============
  function makeWhip() {
    const N = 11, LEN = 6.2; // сегментов, длина в px
    // «покорная» длина в покое: кончик чуть ниже колен (не до пола);
    // при выхлесте/вихре хлыст вырастает до полной
    const REST_IDLE = 2.0;
    const pts = [];
    for (let i = 0; i < N; i++) pts.push({ x: 0, y: 0, px: 0, py: 0 });
    let inited = false;
    let rest = LEN;
    return {
      pts,
      armAngle: 0,
      update(ax, ay, t, spin, strike) {
        if (!inited) { pts.forEach(p => { p.x = ax; p.y = ay; p.px = ax; p.py = ay; }); inited = true; }
        // длина подстраивается: покой — коротко и смирно, удар — полная
        const wantRest = (spin || strike > 0) ? LEN : REST_IDLE;
        rest += (wantRest - rest) * 0.16;
        // голова
        pts[0].x = ax; pts[0].y = ay;
        if (spin) {
          // вращение над головой: точки утягиваются по окружности
          const r = 12 + 26 * (0.5 + 0.5 * Math.sin(t * 2));
          for (let i = 1; i < N; i++) {
            const a = this.armAngle - i * 0.38;
            const tx = ax + Math.cos(a) * (r * (0.3 + i / N));
            const ty = ay - 14 + Math.sin(a) * (r * 0.5 * (0.3 + i / N)) - i * 0.4;
            pts[i].x += (tx - pts[i].x) * 0.5;
            pts[i].y += (ty - pts[i].y) * 0.5;
          }
        } else if (strike > 0) {
          // удар-выхлёст: быстрый разгон волной к цели (0→0.72) и возврат (0.72→1)
          const prog = K.clamp(1 - strike / 0.22, 0, 1);
          const ext = prog < 0.72
            ? Math.pow(prog / 0.72, 0.55)                       // резко вперёд
            : 1 - Math.pow((prog - 0.72) / 0.28, 1.5) * 0.6;    // мягко назад
          for (let i = 1; i < N; i++) {
            const reach = K.clamp(prog * N * 1.9 - i, 0, 1) * ext;
            const tx = ax + Math.cos(this.armAngle) * (LEN * i * (0.35 + 0.65 * reach));
            const ty = ay + Math.sin(this.armAngle) * (LEN * i * (0.35 + 0.65 * reach)) * 0.75 - i * 0.9 * (1 - reach);
            pts[i].x += (tx - pts[i].x) * 0.6;
            pts[i].y += (ty - pts[i].y) * 0.6;
          }
        } else {
          // покой: висит смирно, чуть ниже колен — лёгкое дыхание-покачивание
          for (let i = 1; i < N; i++) {
            const vy = pts[i].y + (pts[i].y - pts[i].py) * 0.8 + 0.5;
            const vx = pts[i].x + (pts[i].x - pts[i].px) * 0.8 + Math.sin(t * 1.6 + i * 0.7) * 0.04;
            pts[i].px = pts[i].x; pts[i].py = pts[i].y;
            pts[i].x = vx; pts[i].y = vy;
          }
        }
        // связи — с текущей длиной сегмента (покой короче, удар полный)
        for (let k = 0; k < 3; k++) for (let i = 1; i < N; i++) {
          const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
          const d = Math.hypot(dx, dy) || 1;
          const diff = (d - rest) / d;
          if (i === 1) { pts[i].x -= dx * diff; pts[i].y -= dy * diff; }
          else {
            pts[i].x -= dx * diff * 0.5; pts[i].y -= dy * diff * 0.5;
            pts[i - 1].x += dx * diff * 0.5; pts[i - 1].y += dy * diff * 0.5;
          }
        }
      },
      draw(g, ax, ay, t, spin) {
        // тело хлыста
        g.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath();
          g.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < N; i++) {
            const xc = (pts[i - 1].x + pts[i].x) / 2, yc = (pts[i - 1].y + pts[i].y) / 2;
            g.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
          }
          if (pass === 0) {
            g.strokeStyle = spin ? 'rgba(255,150,200,.35)' : 'rgba(0,0,0,.35)';
            g.lineWidth = 7;
          } else {
            const wg = g.createLinearGradient(pts[0].x, pts[0].y, pts[N - 1].x, pts[N - 1].y);
            wg.addColorStop(0, this.col1 || '#5a3040'); wg.addColorStop(1, this.col2 || '#c88aa0');
            g.strokeStyle = wg; g.lineWidth = 3.4;
          }
          g.stroke();
        }
        // рукоять
        g.fillStyle = '#3a2030';
        g.beginPath(); g.arc(ax, ay, 3, 0, Math.PI * 2); g.fill();
        // кончик со свечением цвета оружия
        const tip = pts[N - 1];
        g.fillStyle = spin ? '#ffd8ec' : (this.col2 || '#e8b4c8');
        g.shadowColor = this.col2 || '#ff7ab8'; g.shadowBlur = spin ? 12 : 5;
        g.beginPath(); g.arc(tip.x, tip.y, spin ? 3.4 : 2.2, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        // ЦЕНЗОРНАЯ МОЗАИКА вдоль хлыста при вращении — гэг
        if (spin) {
          for (let i = 2; i < N; i += 3) {
            const p = pts[i];
            const cell = 4;
            for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
              if ((a + b + i + Math.floor(t * 9)) % 3 === 0) continue;
              g.fillStyle = 'rgba(216,140,180,.55)';
              g.fillRect(p.x + a * cell - cell / 2, p.y + b * cell - cell / 2, cell - 0.5, cell - 0.5);
            }
          }
        }
        g.lineCap = 'butt';
      },
    };
  }

  // ============ ДЕМОНИЦА ============
  // e: {def,size,phase,animT,hitT,charmT,stone,fire,ice,snake,flying,crown,hpFrac}
  function drawDemon(g, e, sx, sy, t) {
    const d = e.def;
    // пошлая дрожь от удара: всё тело мелко-мелко трясётся
    if (e.hitT > 0.03) sx += Math.sin(t * 62) * 2.4 * e.hitT;
    const S = (e.size || 1) * 1.05;
    const pal = d.pal;
    const moving = e.moving;
    const wp = e.phase;
    const bob = moving ? Math.abs(Math.sin(wp)) * 2.5 : Math.sin(t * 2 + wp) * 1.2;
    const grounded = e.flying ? -14 - Math.sin(t * 3 + wp) * 4 : 0; // парящие выше
    sy = sy + grounded;
    const hipY = sy - 30 * S - bob * 0.5;
    const shoulderY = sy - 56 * S - bob;
    const headY = sy - 66 * S - bob;

    // парящие — тень на земле остаётся
    shadowE(g, sx, sy + (e.flying ? 12 : 1), 15 * S, 7 * S, e.flying ? 0.28 : 0.45);

    g.save();
    if (e.hitT > 0) { /* вспышка белым при ударе — через фильтр поверх */ }

    // ---- хвост со сердечком (за телом) ----
    if (d.tail) {
      const tw = Math.sin(t * 2.2 + wp) * 6;
      g.strokeStyle = pal.skin; g.lineWidth = 2.6 * S; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(sx + 6 * S, hipY);
      g.quadraticCurveTo(sx + (18 + tw) * S, hipY + 6 * S, sx + (20 + tw) * S, hipY - 10 * S);
      g.stroke();
      // сердечко на кончике
      const hx = sx + (20 + tw) * S, hy = hipY - 12 * S;
      g.fillStyle = pal.glow;
      g.beginPath();
      g.moveTo(hx, hy + 3 * S);
      g.bezierCurveTo(hx - 4 * S, hy - 2 * S, hx - 1 * S, hy - 5 * S, hx, hy - 2 * S);
      g.bezierCurveTo(hx + 1 * S, hy - 5 * S, hx + 4 * S, hy - 2 * S, hx, hy + 3 * S);
      g.fill();
      g.lineCap = 'butt';
    }

    // ---- крылья (за телом) ----
    const wingFlap = Math.sin(t * (e.flying ? 9 : 3.2) + wp);
    if (d.wings && d.wings !== 'none') {
      const big = d.wings === 'big' || d.wings === 'huge' ? 1.35 : 0.9;
      [[-1, 0], [1, 0]].forEach(([side]) => {
        const wx = sx + side * 8 * S, wy = shoulderY + 4 * S;
        const spread = (0.4 + 0.25 * wingFlap) * big;
        g.beginPath();
        g.moveTo(wx, wy);
        g.quadraticCurveTo(wx + side * 26 * S * spread, wy - 20 * S * big,
                           wx + side * 34 * S * spread, wy + 4 * S * big);
        g.quadraticCurveTo(wx + side * 20 * S * spread, wy + 2 * S, wx + side * 14 * S, wy + 8 * S);
        g.closePath();
        const wg = g.createLinearGradient(wx, wy - 10, wx + side * 30 * S, wy + 6);
        wg.addColorStop(0, K.shade(pal.cloth, 0.18));
        wg.addColorStop(1, pal.cloth);
        g.fillStyle = wg;
        g.fill();
        g.strokeStyle = K.shade(pal.hair, -0.15); g.lineWidth = 1.2; g.stroke();
      });
    }

    // ---- змеиный низ (ламия) ----
    if (d.snake) {
      const coil = Math.sin(t * 1.6 + wp) * 3;
      g.strokeStyle = pal.hair; g.lineWidth = 13 * S; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx - 14 * S + coil, sy - 8 * S, sx - 6 * S, hipY + 8 * S);
      g.stroke();
      g.strokeStyle = pal.cloth; g.lineWidth = 13 * S;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 1 * S, sy - 4 * S); g.stroke();
      // чешуйки
      g.fillStyle = K.shade(pal.hair, 0.25);
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.arc(sx - 4 - i * 3 * S, sy - i * 5 * S - coil * 0.2, 2 * S, 0, Math.PI * 2); g.fill();
      }
      g.lineCap = 'butt';
    } else {
      // ---- ноги на каблуках ----
      const st = moving ? Math.sin(wp) * 6 : 0;
      g.strokeStyle = pal.skin; g.lineWidth = 4.2 * S; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx - 4 * S, hipY); g.lineTo(sx - 4 * S - st * 0.5, sy - 2); g.stroke();
      g.beginPath(); g.moveTo(sx + 4 * S, hipY); g.lineTo(sx + 4 * S + st * 0.5, sy - 2); g.stroke();
      // чулки
      g.strokeStyle = pal.cloth; g.lineWidth = 4.4 * S;
      g.beginPath(); g.moveTo(sx - 4 * S - st * 0.25, (hipY + sy) / 2); g.lineTo(sx - 4 * S - st * 0.5, sy - 4); g.stroke();
      g.beginPath(); g.moveTo(sx + 4 * S + st * 0.25, (hipY + sy) / 2); g.lineTo(sx + 4 * S + st * 0.5, sy - 4); g.stroke();
      // каблуки
      g.strokeStyle = K.shade(pal.cloth, -0.4); g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx - 4 * S - st * 0.5, sy - 3); g.lineTo(sx - 4.5 * S - st * 0.5, sy + 1); g.stroke();
      g.beginPath(); g.moveTo(sx + 4 * S + st * 0.5, sy - 3); g.lineTo(sx + 4.5 * S + st * 0.5, sy + 1); g.stroke();
      g.lineCap = 'butt';
    }

    // ---- силуэт: корсет/бёдра (стилизованно и целомудренно) ----
    const bg = g.createLinearGradient(sx, shoulderY, sx, hipY);
    bg.addColorStop(0, pal.skin); bg.addColorStop(1, K.shade(pal.skin, -0.18));
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(sx - 7 * S, shoulderY + 4 * S);
    g.quadraticCurveTo(sx - 11 * S, (shoulderY + hipY) / 2, sx - 9 * S, hipY - 2 * S);
    g.quadraticCurveTo(sx, hipY + 3 * S, sx + 9 * S, hipY - 2 * S);
    g.quadraticCurveTo(sx + 11 * S, (shoulderY + hipY) / 2, sx + 7 * S, shoulderY + 4 * S);
    g.quadraticCurveTo(sx, shoulderY - 2 * S, sx - 7 * S, shoulderY + 4 * S);
    g.closePath(); g.fill();
    // корсет
    g.fillStyle = pal.cloth;
    g.beginPath();
    g.moveTo(sx - 6.5 * S, shoulderY + 8 * S);
    g.quadraticCurveTo(sx - 9 * S, (shoulderY + hipY) / 2 + 4 * S, sx - 7 * S, hipY - 3 * S);
    g.lineTo(sx + 7 * S, hipY - 3 * S);
    g.quadraticCurveTo(sx + 9 * S, (shoulderY + hipY) / 2 + 4 * S, sx + 6.5 * S, shoulderY + 8 * S);
    g.closePath(); g.fill();
    g.strokeStyle = K.shade(pal.cloth, 0.25); g.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      g.beginPath(); g.moveTo(sx + i * 3 * S, shoulderY + 9 * S); g.lineTo(sx + i * 3.4 * S, hipY - 4 * S); g.stroke();
    }
    // шея/воротник
    g.fillStyle = K.shade(pal.cloth, 0.1);
    g.fillRect(sx - 3 * S, shoulderY - 2 * S, 6 * S, 5 * S);

    // ---- руки ----
    const armSw = moving ? Math.sin(wp + Math.PI) * 4 : Math.sin(t * 2 + wp) * 1.5;
    g.strokeStyle = pal.skin; g.lineWidth = 3.4 * S; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx - 7 * S, shoulderY + 6 * S); g.lineTo(sx - 10 * S, hipY - 6 * S + armSw); g.stroke();
    // передняя рука — замах при атаке
    let fArm = 0;
    if (e.atkT > 0) fArm = Math.sin(e.atkT * Math.PI) * 10;
    g.beginPath(); g.moveTo(sx + 7 * S, shoulderY + 6 * S);
    g.lineTo(sx + 11 * S + fArm, hipY - 8 * S - fArm * 0.4 - armSw); g.stroke();
    // когти
    g.strokeStyle = K.shade(pal.hair, 0.3); g.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(sx + 11 * S + fArm, hipY - 8 * S - fArm * 0.4 - armSw);
      g.lineTo(sx + 12 * S + fArm + i * 2, hipY - 11 * S - fArm * 0.4 - armSw);
      g.stroke();
    }
    g.lineCap = 'butt';

    // ---- голова: лицо в тени, светящиеся глаза, волосы, рога ----
    // волосы (за головой)
    const hairSw = Math.sin(t * 1.8 + wp) * 3 + (moving ? 3 : 0);
    g.fillStyle = pal.hair;
    g.beginPath();
    g.moveTo(sx - 7 * S, headY + 2 * S);
    g.quadraticCurveTo(sx - 12 * S - hairSw, headY + 16 * S, sx - 8 * S - hairSw * 1.4, headY + 26 * S);
    g.quadraticCurveTo(sx - 2 * S, headY + 22 * S, sx - 6 * S, headY + 4 * S);
    g.closePath(); g.fill();
    // лицо
    g.fillStyle = K.shade(pal.skin, -0.12);
    g.beginPath(); g.ellipse(sx, headY + 3 * S, 6 * S, 6.6 * S, 0, 0, Math.PI * 2); g.fill();
    // глаза светятся
    const eg = e.charmT > 0 ? '#ffd860' : pal.glow;
    g.fillStyle = eg;
    g.shadowColor = eg; g.shadowBlur = 7;
    g.beginPath(); g.ellipse(sx - 2.2 * S, headY + 2.6 * S, 1.6 * S, 1.1 * S, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(sx + 2.2 * S, headY + 2.6 * S, 1.6 * S, 1.1 * S, -0.2, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // улыбка с клыками при агрессии
    if (e.aggro) {
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.9;
      g.beginPath(); g.arc(sx, headY + 5.6 * S, 2.4 * S, 0.25, Math.PI - 0.25); g.stroke();
    }
    // чёлка
    g.fillStyle = pal.hair;
    g.beginPath();
    g.moveTo(sx - 7 * S, headY + 3 * S);
    g.quadraticCurveTo(sx - 3 * S, headY - 4 * S, sx + 7 * S, headY + 3 * S);
    g.quadraticCurveTo(sx + 3 * S, headY - 1 * S, sx - 7 * S, headY + 3 * S);
    g.fill();
    // рога
    if (d.horns) {
      g.strokeStyle = '#e8d8c0'; g.lineWidth = 2 * S; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx - 5 * S, headY - 1 * S); g.quadraticCurveTo(sx - 9 * S, headY - 6 * S, sx - 7 * S, headY - 9 * S); g.stroke();
      g.beginPath(); g.moveTo(sx + 5 * S, headY - 1 * S); g.quadraticCurveTo(sx + 9 * S, headY - 6 * S, sx + 7 * S, headY - 9 * S); g.stroke();
      g.lineCap = 'butt';
    }

    // ---- эффекты состояний ----
    // мрамор
    if (d.stone) {
      g.globalAlpha = 0.35;
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // смущение ИЛИ недавний удар: румянец + сердечки
    if (e.charmT > 0 || e.hitT > 0.05) {
      g.fillStyle = 'rgba(255,120,150,' + (e.charmT > 0 ? 0.5 : 0.4 * e.hitT) + ')';
      g.beginPath(); g.ellipse(sx - 4 * S, headY + 5 * S, 1.8 * S, 1 * S, 0.3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(sx + 4 * S, headY + 5 * S, 1.8 * S, 1 * S, -0.3, 0, Math.PI * 2); g.fill();
      if (e.charmT > 0) {
        const hY = headY - 14 * S - Math.sin(t * 4) * 3;
        drawHeart(g, sx + 10 * S, hY, 3.2 * S, '#ff6a9e');
        drawHeart(g, sx - 9 * S, hY - 5 * S + Math.sin(t * 4 + 1) * 2, 2.4 * S, '#ff9ec4');
      } else {
        // от удара — один вспыхнувший сердечко-синяк
        drawHeart(g, sx + 8 * S, headY - 10 * S, 2.2 * S * e.hitT, '#ff8fae');
      }
    }
    // вспышка урона
    if (e.hitT > 0) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,255,255,' + (e.hitT * 0.45) + ')';
      g.beginPath(); g.ellipse(sx, (headY + sy) / 2, 14 * S, (sy - headY) / 2 + 4, 0, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();

    // ---- аура босса и корона ----
    if (e.crown) {
      // корона
      g.fillStyle = '#f0c060';
      g.beginPath();
      g.moveTo(sx - 6 * S, headY - 7 * S);
      g.lineTo(sx - 4 * S, headY - 13 * S); g.lineTo(sx - 1.5 * S, headY - 8 * S);
      g.lineTo(sx + 1.5 * S, headY - 14 * S); g.lineTo(sx + 4 * S, headY - 8 * S);
      g.lineTo(sx + 6 * S, headY - 13 * S); g.lineTo(sx + 6.5 * S, headY - 6 * S);
      g.closePath(); g.fill();
      g.strokeStyle = '#8a6a20'; g.lineWidth = 1; g.stroke();
      // пульсирующее кольцо ауры
      const ap = (t * 0.7) % 1;
      g.strokeStyle = K.rgba(pal.glow, 0.5 * (1 - ap));
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(sx, sy + 1, (16 + ap * 30) * S, (8 + ap * 15) * S, 0, 0, Math.PI * 2); g.stroke();
    }
  }

  function drawHeart(g, x, y, s, col) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y + s);
    g.bezierCurveTo(x - s * 1.3, y - s * 0.5, x - s * 0.5, y - s * 1.2, x, y - s * 0.4);
    g.bezierCurveTo(x + s * 0.5, y - s * 1.2, x + s * 1.3, y - s * 0.5, x, y + s);
    g.fill();
  }

  // монет-ка/сердце-дропы
  function drawCoin(g, sx, sy, t) {
    const w = Math.abs(Math.cos(t * 6));
    g.fillStyle = '#f0c060';
    g.beginPath(); g.ellipse(sx, sy, 4 * w + 1, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6a20'; g.lineWidth = 1; g.stroke();
  }
  function drawHeartPickup(g, sx, sy, t) {
    const fl = Math.sin(t * 4) * 2;
    g.fillStyle = '#ff5a7e';
    g.shadowColor = '#ff5a7e'; g.shadowBlur = 6;
    drawHeart(g, sx, sy + fl, 5, '#ff5a7e');
    g.shadowBlur = 0;
  }
  function drawPotionPickup(g, sx, sy, t, col) {
    col = col || '#58d890';
    const fl = Math.sin(t * 4) * 2;
    // сияние цвета зелья
    const grd = g.createRadialGradient(sx, sy + fl, 1, sx, sy + fl, 12);
    grd.addColorStop(0, K.rgba(col, 0.5));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(sx, sy + fl, 12, 0, Math.PI * 2); g.fill();
    // колба
    g.fillStyle = col;
    g.beginPath(); g.ellipse(sx, sy + fl, 4, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = K.shade(col, -0.45); g.lineWidth = 1;
    g.stroke();
    g.fillStyle = K.shade(col, -0.45);
    g.fillRect(sx - 1.5, sy - 8 + fl, 3, 4);
    // блик
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillRect(sx - 2, sy - 2 + fl, 1.5, 3);
  }
  function drawRelicPickup(g, sx, sy, t) {
    const pul = 0.7 + Math.sin(t * 5) * 0.3;
    const grd = g.createRadialGradient(sx, sy, 1, sx, sy, 16);
    grd.addColorStop(0, K.rgba('#ffe8a0', pul));
    grd.addColorStop(1, 'rgba(255,232,160,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(sx, sy - 4, 16, 0, Math.PI * 2); g.fill();
    // ромб-артефакт
    g.fillStyle = '#f0c060';
    g.save(); g.translate(sx, sy - 6 - Math.sin(t * 3) * 2); g.rotate(t);
    g.fillRect(-4, -4, 8, 8);
    g.restore();
  }

  // камень: кристалл цвета вида, размер/блик по редкости
  function drawGemPickup(g, sx, sy, t, gem) {
    const type = DATA.GEM_TYPES.find(x => x.id === gem.type) || DATA.GEM_TYPES[0];
    const rar = DATA.GEM_RARITIES[gem.rar] || DATA.GEM_RARITIES[0];
    const s = 4 + gem.rar * 1.3;
    const fl = Math.sin(t * 4) * 2;
    const yy = sy - 4 + fl;
    // сияние
    const grd = g.createRadialGradient(sx, yy, 1, sx, yy, 14 + gem.rar * 3);
    grd.addColorStop(0, K.rgba(type.col, 0.55));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(sx, yy, 14 + gem.rar * 3, 0, Math.PI * 2); g.fill();
    // кристалл-ромб
    g.fillStyle = type.col;
    g.beginPath();
    g.moveTo(sx, yy - s * 1.5); g.lineTo(sx + s, yy); g.lineTo(sx, yy + s * 1.5); g.lineTo(sx - s, yy);
    g.closePath(); g.fill();
    g.strokeStyle = rar.col; g.lineWidth = gem.rar >= 3 ? 2 : 1;
    g.stroke();
    // звёздочка у легендарных
    if (gem.rar >= 4) {
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1;
      const a = t * 2;
      g.beginPath();
      g.moveTo(sx - 6 * Math.cos(a), yy - 6 * Math.sin(a)); g.lineTo(sx + 6 * Math.cos(a), yy + 6 * Math.sin(a));
      g.stroke();
    }
    // блик
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.beginPath(); g.moveTo(sx, yy - s * 1.1); g.lineTo(sx + s * 0.3, yy - s * 0.2); g.lineTo(sx - s * 0.2, yy - s * 0.3);
    g.closePath(); g.fill();
  }

  // оружие: моток хлыста цвета оружия + рукоять
  function drawWeaponPickup(g, sx, sy, t, w) {
    const fl = Math.sin(t * 3) * 2;
    const yy = sy - 6 + fl;
    const grd = g.createRadialGradient(sx, yy, 1, sx, yy, 20);
    grd.addColorStop(0, K.rgba(w.color, 0.45));
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(sx, yy, 20, 0, Math.PI * 2); g.fill();
    // рукоять
    g.strokeStyle = '#3a2030'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(sx - 2, yy + 12); g.lineTo(sx + 3, yy - 2); g.stroke();
    // моток
    g.strokeStyle = w.color; g.lineWidth = 2.6;
    g.beginPath(); g.ellipse(sx + 5, yy - 6, 8 + w.tier, 6 + w.tier * 0.8, t * 0.6, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = K.shade(w.color, -0.3); g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(sx + 5, yy - 6, 5 + w.tier * 0.6, 3.5 + w.tier * 0.5, -t * 0.8 + 1, 0, Math.PI * 2); g.stroke();
    // кончик со свисающим кончиком хлыста
    g.strokeStyle = w.color; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(sx + 10, yy - 4);
    g.quadraticCurveTo(sx + 16, yy + 4, sx + 13 + Math.sin(t * 2) * 2, yy + 14);
    g.stroke();
    // тир — звёздочки
    g.fillStyle = '#ffd860';
    for (let i = 0; i < w.tier; i++) {
      g.beginPath(); g.arc(sx - 8 + i * 5, yy - 16, 1.4, 0, Math.PI * 2); g.fill();
    }
  }

  return {
    icon, lightSprite,
    prepare, drawFloor, drawWall, drawHazard, drawProp, drawTorch,
    drawStairs, drawDoor, drawPortal, drawChest,
    drawPlayer, drawDemon, makeWhip,
    drawBat, drawRoach, drawGhostCritter,
    drawCoin, drawHeartPickup, drawPotionPickup, drawRelicPickup,
    drawGemPickup, drawWeaponPickup,
    drawHeart, shadowE,
  };
})();
