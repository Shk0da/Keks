// camp.js — лагерь как живая комната: NPC на местах, костёр, врата спуска,
// алтарь навыков, точило, зеркало реликвий, доска сводки.
// Движок игры переиспользуется: лагерь — это «уровень» без врагов и тумана.
'use strict';
window.CampScene = (function () {

  const W = 19, H = 15;
  const THEME = {
    id: 'camp', name: 'Лагерь «Последний Взгляд»',
    floor: ['#4a3e30', '#42372b', '#503f33'], wallTop: '#66513d', wallL: '#473629', wallR: '#3a2c20',
    grout: 'rgba(16,10,6,.55)', ambient: 0.55, torch: '#ffd08b',
  };

  // облик NPC для drawDemon (без крыльев/хвостов — люди, ну почти)
  const NPC_LOOK = {
    veks: { pal: { skin: '#eab4c6', hair: '#c2456e', cloth: '#5c1f3d', glow: '#ff7ab8' }, horns: false, wings: 'none', tail: false },
    moza: { pal: { skin: '#dcc9f0', hair: '#7a3fd0', cloth: '#332070', glow: '#c86aff' }, horns: true, wings: 'none', tail: false },
    prao: { pal: { skin: '#b9cdee', hair: '#6a86c0', cloth: '#2c3a60', glow: '#9ec2ff' }, horns: false, wings: 'none', tail: false, ghost: true },
  };

  // где кто стоит (в тайлах, центр)
  const SPOTS = {
    veks:  { x: 14.5, y: 11.0 },
    moza:  { x: 6.5,  y: 6.0 },
    prao:  { x: 15.0, y: 4.0 },
    skills:{ x: 9.5,  y: 3.0 },   // алтарь навыков
    armory:{ x: 15.5, y: 7.5 },   // точило
    relics:{ x: 3.5,  y: 10.5 },  // зеркало реликвий
    board: { x: 3.5,  y: 6.0 },   // доска сводки
    gate:  { x: 9.5,  y: 12.5 },  // врата спуска
    fire:  { x: 9.5,  y: 7.5 },   // костёр
  };

  function build() {
    const tiles = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) tiles[y * W + x] = 1;
    for (let x = 0; x < W; x++) { tiles[x] = 2; tiles[(H - 1) * W + x] = 2; }
    for (let y = 0; y < H; y++) { tiles[y * W] = 2; tiles[y * W + W - 1] = 2; }
    const torches = [];
    for (let x = 3; x < W - 2; x += 4) { torches.push({ x: x + 0.5, y: 0.5 }); torches.push({ x: x + 0.5, y: H - 0.5 }); }
    torches.push({ x: 0.5, y: 4.5 }); torches.push({ x: W - 0.5, y: 4.5 });
    torches.push({ x: SPOTS.fire.x, y: SPOTS.fire.y, campfire: true });
    const level = {
      w: W, h: H, tiles, torches, theme: THEME,
      props: [], chests: [], spawns: [], entry: { x: 9.5, y: 9.0 }, exit: null,
      depth: 0, isCamp: true,
      vis: new Uint8Array(W * H).fill(2),
      flow: new Int16Array(W * H).fill(-1),
    };
    return level;
  }

  function npcs(p) {
    const list = [{ id: 'veks' }];
    if (QuestSys.npcUnlocked(p, 'moza')) list.push({ id: 'moza' });
    if (QuestSys.npcUnlocked(p, 'prao')) list.push({ id: 'prao' });
    return list;
  }

  function structures(p) {
    return [
      { id: 'skills', name: 'Алтарь навыков' },
      { id: 'armory', name: 'Точило Праотца' },
      { id: 'relics', name: 'Зеркало реликвий' },
      { id: 'board',  name: 'Доска сводки' },
      { id: 'gate',   name: 'Врата спуска' },
    ];
  }

  // маркер квеста над NPC: «!» есть квест, «?» выполнен, «…» в процессе
  function npcMark(p, id) {
    const st = QuestSys.state(p);
    for (const aq of [st.main, st.prao, st.side]) {
      if (aq && aq.def.npc === id) return QuestSys.questComplete(aq) ? '?' : '…';
    }
    if (id === 'veks') {
      const mo = QuestSys.mainOffer(p);
      if (mo && mo.npc === 'veks') return '!';
      if (!st.side) return '!';
    }
    if (id === 'moza') {
      const mo = QuestSys.mainOffer(p);
      if (mo && mo.npc === 'moza') return '!';
    }
    if (id === 'prao' && QuestSys.praoOffer(p)) return '!';
    return null;
  }

  // все интерактивные точки с экранными именами
  function interactables(p) {
    const list = [];
    for (const n of npcs(p)) list.push({ kind: 'npc', id: n.id, name: DATA.NPCS[n.id].name, x: SPOTS[n.id].x, y: SPOTS[n.id].y });
    for (const s of structures(p)) list.push({ kind: s.id, id: s.id, name: s.name, x: SPOTS[s.id].x, y: SPOTS[s.id].y });
    return list;
  }

  function update(dt, game) {
    const p = game.player;
    // движение игрока по лагерю (без боевых механик)
    const mv = game.moveInput();
    const len = Math.hypot(mv.x, mv.y);
    p.moving = len > 0.12;
    if (p.moving) {
      const nx = mv.x / len, ny = mv.y / len;
      p.x += nx * p.moveSpeed * 0.85 * dt;
      p.y += ny * p.moveSpeed * 0.85 * dt;
      p.facing = Math.atan2(ny, nx);
      p.walkPhase += dt * 10;
      p.drinkT = Math.max(0, p.drinkT - dt);
      p.strikeT = Math.max(0, p.strikeT - dt);
    }
    // стенки и структуры
    game.collideCircle(p);
    for (const s of structures()) {
      const d = K.dist(p.x, p.y, s.x === 'gate' ? SPOTS.gate.x : SPOTS[s.id].x, SPOTS[s.id].y);
      if (s.id !== 'gate' && d < 0.75 && d > 0.001) {
        p.x += (p.x - SPOTS[s.id].x) / d * (0.75 - d);
        p.y += (p.y - SPOTS[s.id].y) / d * (0.75 - d);
      }
    }
    // ближайшая интерактивная точка
    let best = null, bd = 1.35;
    for (const it of interactables(p)) {
      const d = K.dist(p.x, p.y, it.x, it.y);
      if (d < bd) { bd = d; best = it; }
    }
    game.campFocus = best;
    // угольки костра
    if (Math.random() < dt * 6) {
      game.particles.spawn({
        x: SPOTS.fire.x + (Math.random() - 0.5) * 0.3, y: SPOTS.fire.y - 0.2,
        vx: (Math.random() - 0.5) * 14, vy: -30 - Math.random() * 24,
        life: 0.9 + Math.random() * 0.6, size: 1.6 + Math.random() * 1.6,
        col: Math.random() < 0.5 ? '#ffd08b' : '#ff9a4b',
      });
    }
  }

  function drawStructures(g, t) {
    // алтарь навыков: обелиск с парящей книгой
    {
      const { x, y } = SPOTS.skills;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.shadowE(g, sx, sy + 2, 16, 7, .4);
      g.fillStyle = '#4c5470';
      g.fillRect(sx - 7, sy - 40, 14, 40);
      g.fillStyle = '#5f6890';
      g.beginPath(); g.moveTo(sx - 9, sy - 40); g.lineTo(sx, sy - 52); g.lineTo(sx + 9, sy - 40); g.closePath(); g.fill();
      g.strokeStyle = K.rgba('#a8b4ff', 0.5 + 0.3 * Math.sin(t * 3));
      g.lineWidth = 1.5;
      g.strokeRect(sx - 4, sy - 32, 8, 10);
      // парящая книга
      g.save();
      g.translate(sx, sy - 60 - Math.sin(t * 2.2) * 3);
      g.fillStyle = '#7a5a2a'; g.fillRect(-6, -2, 12, 4);
      g.fillStyle = '#e8d8a8'; g.fillRect(-6, -4, 12, 2.4);
      g.restore();
    }
    // точило: наковальня + искорка
    {
      const { x, y } = SPOTS.armory;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.shadowE(g, sx, sy + 2, 16, 7, .4);
      g.fillStyle = '#3c4148';
      g.fillRect(sx - 10, sy - 16, 20, 8);
      g.fillStyle = '#4a505a';
      g.fillRect(sx - 13, sy - 22, 26, 7);
      g.fillStyle = '#33373d';
      g.beginPath(); g.moveTo(sx - 4, sy - 8); g.lineTo(sx + 4, sy - 8); g.lineTo(sx + 2, sy); g.lineTo(sx - 2, sy); g.closePath(); g.fill();
      g.fillStyle = K.rgba('#ffd860', 0.5 + 0.5 * Math.sin(t * 6));
      g.fillRect(sx + 4, sy - 24 - Math.sin(t * 6) * 2, 2, 2);
    }
    // зеркало реликвий: овальная рама с мерцанием
    {
      const { x, y } = SPOTS.relics;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.shadowE(g, sx, sy + 2, 14, 6, .35);
      g.strokeStyle = '#c8a030'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(sx, sy - 30, 12, 24, 0, 0, Math.PI * 2); g.stroke();
      const gl = g.createLinearGradient(sx - 10, sy - 52, sx + 10, sy - 10);
      gl.addColorStop(0, K.rgba('#bcd8ff', 0.25 + 0.15 * Math.sin(t * 2)));
      gl.addColorStop(0.5, K.rgba('#ffd8ec', 0.3 + 0.15 * Math.sin(t * 2.6)));
      gl.addColorStop(1, K.rgba('#9ec2ff', 0.25 + 0.15 * Math.sin(t * 2.2)));
      g.fillStyle = gl;
      g.beginPath(); g.ellipse(sx, sy - 30, 10, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c8a030';
      g.fillRect(sx - 2, sy - 8, 4, 8);
    }
    // доска сводки: столб с пергаментом
    {
      const { x, y } = SPOTS.board;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.shadowE(g, sx, sy + 2, 12, 5, .35);
      g.strokeStyle = '#5a4028'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 40); g.stroke();
      g.fillStyle = '#e8d8b0';
      g.save(); g.translate(sx, sy - 30); g.rotate(Math.sin(t * 1.2) * 0.03);
      g.fillRect(-9, -8, 18, 16);
      g.strokeStyle = '#8a7048'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-6, -4 + i * 4); g.lineTo(6, -4 + i * 4); g.stroke(); }
      g.restore();
    }
    // врата спуска: во всеоружии — рисуем дверью в южной стене
    {
      const { x, y } = SPOTS.gate;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.drawDoor(g, sx, sy, t, 1, THEME);
      const pul = 0.5 + 0.3 * Math.sin(t * 2.5);
      g.fillStyle = K.rgba('#ffd860', pul);
      g.font = 'bold 12px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('▼', sx, sy - 92 - Math.sin(t * 2.5) * 2);
      g.textAlign = 'left';
    }
    // костёр: брёвна + пламя
    {
      const { x, y } = SPOTS.fire;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.shadowE(g, sx, sy + 2, 18, 8, .4);
      g.strokeStyle = '#5a4028'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx - 10, sy + 2); g.lineTo(sx + 10, sy - 3); g.stroke();
      g.beginPath(); g.moveTo(sx + 10, sy + 2); g.lineTo(sx - 10, sy - 3); g.stroke();
      g.lineCap = 'butt';
      // камни вокруг
      g.fillStyle = '#57505a';
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        g.beginPath(); g.ellipse(sx + Math.cos(a) * 14, sy + Math.sin(a) * 6, 3, 2, 0, 0, Math.PI * 2); g.fill();
      }
      const fl = 0.85 + Math.sin(t * 9) * 0.15;
      const grd = g.createRadialGradient(sx, sy - 12, 1, sx, sy - 12, 16 * fl);
      grd.addColorStop(0, 'rgba(255,240,190,.95)');
      grd.addColorStop(0.4, 'rgba(255,160,70,.85)');
      grd.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(sx, sy - 12, 10 * fl, 17 * fl, 0, 0, Math.PI * 2); g.fill();
    }
  }

  function drawNpcs(g, t, game) {
    const p = game.player;
    for (const n of npcs(p)) {
      const spot = SPOTS[n.id];
      const sx = K.isoX(spot.x - 0.5, spot.y - 0.5), sy = K.isoY(spot.x - 0.5, spot.y - 0.5) + K.TH / 2;
      const look = NPC_LOOK[n.id];
      const fake = { def: look, size: 1.0, phase: t * 0.7 + spot.x, moving: false, hitT: 0, charmT: 0, atkT: 0, aggro: false };
      g.globalAlpha = look.ghost ? 0.7 : 1;
      Sprites.drawDemon(g, fake, sx, sy, t);
      g.globalAlpha = 1;
      // табличка с именем
      g.font = 'bold 11px system-ui, sans-serif';
      g.textAlign = 'center';
      const nm = DATA.NPCS[n.id].name;
      const w = g.measureText(nm).width + 10;
      g.fillStyle = 'rgba(12,6,18,.78)';
      g.beginPath();
      if (g.roundRect) g.roundRect(sx - w / 2, sy - 86, w, 15, 5); else g.rect(sx - w / 2, sy - 86, w, 15);
      g.fill();
      g.strokeStyle = K.rgba(look.pal.glow, 0.5); g.lineWidth = 1; g.stroke();
      g.fillStyle = '#f3e8f5';
      g.fillText(nm, sx, sy - 75);
      // маркер квеста
      const mk = npcMark(p, n.id);
      if (mk) {
        const bobY = Math.sin(t * 4) * 3;
        g.font = 'bold 17px Georgia, serif';
        g.fillStyle = mk === '!' ? '#ffd860' : mk === '?' ? '#7dffb0' : '#ff7ab8';
        g.shadowColor = g.fillStyle; g.shadowBlur = 8;
        g.fillText(mk, sx, sy - 96 + bobY);
        g.shadowBlur = 0;
      }
      g.textAlign = 'left';
    }
  }

  function drawFocus(g, t, game) {
    const f = game.campFocus;
    if (!f) return;
    const spot = SPOTS[f.id];
    const sx = K.isoX(spot.x - 0.5, spot.y - 0.5), sy = K.isoY(spot.x - 0.5, spot.y - 0.5) + K.TH / 2;
    const y = (f.kind === 'npc' ? sy - 104 : sy - 60) + Math.sin(t * 5) * 4;
    g.fillStyle = '#ffd860';
    g.shadowColor = '#ffd860'; g.shadowBlur = 8;
    g.beginPath();
    g.moveTo(sx - 7, y - 8); g.lineTo(sx + 7, y - 8); g.lineTo(sx, y + 2);
    g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.font = 'bold 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 3;
    const label = f.name + ' — «Действие»';
    g.strokeText(label, sx, y - 14);
    g.fillText(label, sx, y - 14);
    g.textAlign = 'left';
  }

  return { build, update, drawStructures, drawNpcs, drawFocus, SPOTS, THEME };
})();
