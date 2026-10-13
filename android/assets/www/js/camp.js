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
    factory: { x: 5.5, y: 12.2 }, // фабрика трофеев
    fire:  { x: 9.5,  y: 7.5 },   // костёр
  };

  // коллайдеры декора (x, y, r)
  const BLOCKERS = [
    { x: SPOTS.fire.x, y: SPOTS.fire.y, r: 0.62 },
    { x: 14.6, y: 11.4, r: 0.95 },
    { x: 16.2, y: 8.6, r: 0.5 },
    { x: 2.5, y: 2.6, r: 0.5 }, { x: 3.4, y: 2.2, r: 0.45 },
    { x: 16.6, y: 12.4, r: 0.5 },
    { x: 8.2, y: 9.4, r: 0.35 }, { x: 10.8, y: 9.3, r: 0.35 },
  ];

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
      { id: 'factory', name: 'Фабрика трофеев' },
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
    // стенки, структуры и декор
    game.collideCircle(p);
    const solids = structures().filter(st => st.id !== 'gate')
      .map(st => ({ x: SPOTS[st.id].x, y: SPOTS[st.id].y, r: 0.75 }))
      .concat(BLOCKERS);
    for (const so of solids) {
      const d = K.dist(p.x, p.y, so.x, so.y);
      if (d < so.r && d > 0.001) {
        p.x += (p.x - so.x) / d * (so.r - d);
        p.y += (p.y - so.y) / d * (so.r - d);
      }
    }
    // ближайшая интерактивная точка
    let best = null, bd = 1.35;
    for (const it of interactables(p)) {
      const d = K.dist(p.x, p.y, it.x, it.y);
      if (d < bd) { bd = d; best = it; }
    }
    game.campFocus = best;
    // угольки костра: медленно и вертикально вверх
    // (в мировых координатах вертикаль экрана = диагональ x=y, скорость мала)
    if (Math.random() < dt * 5) {
      const v = 7 + Math.random() * 9;              // скорость подъёма, px/с
      const wob = (Math.random() - 0.5) * 6;        // лёгкое покачивание
      game.particles.spawn({
        x: SPOTS.fire.x + (Math.random() - 0.5) * 0.25, y: SPOTS.fire.y - 0.15,
        vx: -v + wob, vy: -v - wob,
        life: 1.4 + Math.random() * 0.9, size: 1.4 + Math.random() * 1.5,
        col: Math.random() < 0.5 ? '#ffd08b' : '#ff9a4b',
        grav: -2,
      });
    }
  }

  // декор комнаты: ковёр, гобелены, лавка Векс, стойка оружия, свечи,
  // мозаика, бочки, табуреты — рисуется до построек и NPC
  function drawDecor(g, t) {
    const S2 = (x, y) => [K.isoX(x - 0.5, y - 0.5), K.isoY(x - 0.5, y - 0.5) + K.TH / 2];

    // ковёр у костра: двухцветный iso-эллипс с каймой и ромбами
    {
      const [fx, fy] = S2(SPOTS.fire.x, SPOTS.fire.y);
      g.fillStyle = '#6a2f3a';
      g.beginPath(); g.ellipse(fx, fy + 2, 96, 48, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#84404e';
      g.beginPath(); g.ellipse(fx, fy + 2, 78, 38, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c8956a'; g.lineWidth = 2; g.setLineDash([6, 5]);
      g.beginPath(); g.ellipse(fx, fy + 2, 86, 43, 0, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = 'rgba(200,149,106,.55)'; g.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(fx + i * 26, fy - 8);
        g.lineTo(fx + i * 26 + 12, fy + 2);
        g.lineTo(fx + i * 26, fy + 12);
        g.lineTo(fx + i * 26 - 12, fy + 2);
        g.closePath(); g.stroke();
      }
    }

    // гобелены на северной стене
    for (const bx of [5, 13]) {
      const [wx, wy] = S2(bx, 0.5);
      const top = wy - K.WH;
      g.fillStyle = bx === 5 ? '#5c1f3d' : '#332070';
      g.beginPath();
      g.moveTo(wx - 12, top + 6); g.lineTo(wx + 12, top + 6);
      g.lineTo(wx + 12, top + 30); g.quadraticCurveTo(wx + 6, top + 38, wx, top + 32);
      g.quadraticCurveTo(wx - 6, top + 38, wx - 12, top + 30);
      g.closePath(); g.fill();
      g.strokeStyle = '#c8a030'; g.lineWidth = 1.4; g.stroke();
      if (bx === 5) Sprites.drawHeart(g, wx, top + 18, 5, '#ff7ab8');
      else {
        g.fillStyle = '#c86aff';
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
          g.fillRect(wx + i * 4 - 1.6, top + 18 + j * 4 - 1.6, 3.2, 3.2);
      }
    }

    // лавка Векс: прилавок, навес в полоску, товар
    {
      const [sx, sy] = S2(SPOTS.veks.x, SPOTS.veks.y + 0.9);
      Sprites.shadowE(g, sx, sy + 2, 30, 12, .4);
      g.fillStyle = '#6a4a2a';
      g.beginPath();
      g.moveTo(sx - 26, sy - 8); g.lineTo(sx, sy + 4); g.lineTo(sx + 26, sy - 8);
      g.lineTo(sx + 26, sy - 20); g.lineTo(sx, sy - 8); g.lineTo(sx - 26, sy - 20);
      g.closePath(); g.fill();
      g.fillStyle = '#7c5a34';
      g.beginPath();
      g.moveTo(sx - 26, sy - 20); g.lineTo(sx, sy - 8); g.lineTo(sx + 26, sy - 20); g.lineTo(sx, sy - 32);
      g.closePath(); g.fill();
      for (let i = 0; i < 3; i++) {
        const bx = sx - 12 + i * 12, by = sy - 24 - (i === 1 ? 3 : 0);
        g.fillStyle = ['#58d890', '#ff5a6e', '#5a8aff'][i];
        g.beginPath(); g.ellipse(bx, by, 2.6, 3.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a3a2a'; g.fillRect(bx - 1, by - 6, 2, 3);
      }
      g.strokeStyle = '#5a4028'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(sx - 26, sy - 20); g.lineTo(sx - 26, sy - 54); g.stroke();
      g.beginPath(); g.moveTo(sx + 26, sy - 20); g.lineTo(sx + 26, sy - 54); g.stroke();
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i % 2 ? '#f0e0c0' : '#c2497f';
        const x0 = sx - 30 + i * 12;
        g.beginPath();
        g.moveTo(x0, sy - 56); g.lineTo(x0 + 12, sy - 56);
        g.lineTo(x0 + 14, sy - 44); g.lineTo(x0 + 2, sy - 44);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#f0c060';
      g.beginPath(); g.ellipse(sx + 16, sy - 22, 3, 2, 0, 0, Math.PI * 2); g.fill();
    }

    // стойка оружия у точила
    {
      const [sx, sy] = S2(16.2, 8.6);
      Sprites.shadowE(g, sx, sy + 2, 14, 6, .35);
      g.strokeStyle = '#5a4028'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - 34); g.stroke();
      g.strokeStyle = '#7a6a4a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx - 10, sy - 30); g.lineTo(sx + 10, sy - 30); g.stroke();
      for (const [cx2, col] of [[-5, '#a06a3a'], [6, '#c88aa0']]) {
        g.strokeStyle = col; g.lineWidth = 2.4;
        g.beginPath(); g.ellipse(sx + cx2, sy - 22, 6, 5, 0.3, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.ellipse(sx + cx2, sy - 22, 3.4, 2.8, 0.3, 0, Math.PI * 2); g.stroke();
      }
    }

    // свечи вокруг Праотца
    {
      const [sx, sy] = S2(SPOTS.prao.x, SPOTS.prao.y);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.6;
        const cx2 = sx + Math.cos(a) * 26, cy2 = sy + Math.sin(a) * 12;
        g.fillStyle = '#e8e0c8';
        g.fillRect(cx2 - 1.5, cy2 - 8, 3, 8);
        const fl = 0.7 + Math.sin(t * 10 + i * 2) * 0.3;
        g.fillStyle = K.rgba('#ffd890', fl);
        g.beginPath(); g.ellipse(cx2, cy2 - 11, 1.6, 3 * fl, 0, 0, Math.PI * 2); g.fill();
      }
    }

    // мозаика под Мозаикой: пульсирующий пиксельный круг
    {
      const [sx, sy] = S2(SPOTS.moza.x, SPOTS.moza.y);
      const pul = 0.45 + 0.25 * Math.sin(t * 2.2);
      g.strokeStyle = K.rgba('#c86aff', pul); g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(sx, sy + 2, 40, 20, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = K.rgba('#c86aff', pul * 0.8);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + t * 0.25;
        g.fillRect(sx + Math.cos(a) * 32 - 2, sy + 2 + Math.sin(a) * 15 - 2, 4, 4);
      }
    }

    // бочки и ящик
    const barrel = (x, y) => {
      const [sx, sy] = S2(x, y);
      Sprites.shadowE(g, sx, sy + 2, 12, 5, .4);
      g.fillStyle = '#6a4a2a';
      g.fillRect(sx - 8, sy - 20, 16, 16);
      g.strokeStyle = '#3a2a18'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(sx - 8, sy - 9); g.lineTo(sx + 8, sy - 9); g.stroke();
      g.beginPath(); g.moveTo(sx - 8, sy - 15); g.lineTo(sx + 8, sy - 15); g.stroke();
      g.fillStyle = '#7c5a34';
      g.beginPath(); g.ellipse(sx, sy - 20, 8, 3.4, 0, 0, Math.PI * 2); g.fill();
    };
    barrel(2.5, 2.6); barrel(3.4, 2.2);
    {
      const [sx, sy] = S2(16.6, 12.4);
      Sprites.shadowE(g, sx, sy + 2, 12, 5, .4);
      g.fillStyle = '#7a5a30';
      g.fillRect(sx - 9, sy - 16, 18, 16);
      g.strokeStyle = '#4a3618'; g.lineWidth = 1.4;
      g.strokeRect(sx - 9, sy - 16, 18, 16);
      g.beginPath(); g.moveTo(sx - 9, sy - 16); g.lineTo(sx + 9, sy); g.stroke();
    }

    // табуреты-чурки у костра
    for (const [x, y] of [[8.2, 9.4], [10.8, 9.3]]) {
      const [sx, sy] = S2(x, y);
      Sprites.shadowE(g, sx, sy + 2, 9, 4, .35);
      g.fillStyle = '#8a6a40';
      g.fillRect(sx - 7, sy - 10, 14, 10);
      g.fillStyle = '#9c7a4c';
      g.beginPath(); g.ellipse(sx, sy - 10, 7, 3, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5a4028'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(sx, sy - 10, 7, 3, 0, 0, Math.PI * 2); g.stroke();
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
    // фабрика трофеев: домик с трубой и дымком, шестерёнка над дверью
    {
      const { x, y } = SPOTS.factory;
      const sx = K.isoX(x - 0.5, y - 0.5), sy = K.isoY(x - 0.5, y - 0.5) + K.TH / 2;
      Sprites.shadowE(g, sx, sy + 2, 26, 11, .45);
      g.fillStyle = '#5c4a3a';
      g.fillRect(sx - 18, sy - 34, 36, 34);
      g.fillStyle = '#6e5a48';
      g.beginPath();
      g.moveTo(sx - 23, sy - 34); g.lineTo(sx, sy - 52); g.lineTo(sx + 23, sy - 34);
      g.closePath(); g.fill();
      g.strokeStyle = '#3e3228'; g.lineWidth = 1.4; g.stroke();
      // труба + дым
      g.fillStyle = '#4a3c30';
      g.fillRect(sx + 8, sy - 62, 8, 14);
      const pul = (t * 0.5) % 1;
      g.fillStyle = 'rgba(220,220,230,' + (0.35 * (1 - pul)) + ')';
      g.beginPath();
      g.arc(sx + 12 + Math.sin(t) * 3, sy - 66 - pul * 22, 4 + pul * 7, 0, Math.PI * 2);
      g.fill();
      // дверь + шестерёнка
      g.fillStyle = '#3a2c20';
      g.fillRect(sx - 6, sy - 18, 12, 18);
      g.strokeStyle = '#c8a030'; g.lineWidth = 2;
      g.beginPath(); g.arc(sx, sy - 42, 6, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + i * Math.PI / 3;
        g.beginPath();
        g.moveTo(sx + Math.cos(a) * 6, sy - 42 + Math.sin(a) * 6);
        g.lineTo(sx + Math.cos(a) * 9, sy - 42 + Math.sin(a) * 9);
        g.stroke();
      }
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
      // чугунок на треноге: ужин лагеря
      g.strokeStyle = '#4a3a28'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + 0.4;
        g.beginPath();
        g.moveTo(sx + Math.cos(a) * 12, sy - 2 + Math.sin(a) * 5);
        g.lineTo(sx + Math.cos(a) * 4, sy - 20);
        g.stroke();
      }
      g.fillStyle = '#3c3c44';
      g.beginPath(); g.ellipse(sx, sy - 20, 9, 5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#585864';
      g.beginPath(); g.ellipse(sx, sy - 22, 7, 3.4, 0, 0, Math.PI * 2); g.fill();
      if (Math.sin(t * 2 + 1) > 0.2) {
        g.strokeStyle = 'rgba(240,240,255,.35)'; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(sx, sy - 26);
        g.quadraticCurveTo(sx + 4, sy - 32 + Math.sin(t * 3) * 2, sx, sy - 38);
        g.stroke();
      }
    }
  }

  function drawNpc(g, t, game, n) {
    const p = game.player;
    {
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

  return { build, update, drawDecor, drawStructures, drawNpc, npcs, drawFocus, SPOTS, THEME };
})();
