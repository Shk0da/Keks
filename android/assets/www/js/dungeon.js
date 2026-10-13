// dungeon.js — процедурная генерация бесконечных подземелий + туман войны + поле потоков.
// Тайлы: 0 пустота, 1 пол, 2 стена, 3 опасность (лава/иней/паутина).
'use strict';
window.Dungeon = (function () {

  const W = 56, H = 56; // сетка

  function idx(x, y) { return y * W + x; }
  function inB(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

  // ---------- планировка: комнаты + коридоры ----------
  function genRooms(rng) {
    const tiles = new Uint8Array(W * H);
    const rooms = [];
    const target = K.irange(rng, 9, 13);
    let tries = 0;
    while (rooms.length < target && tries++ < 400) {
      const w = K.irange(rng, 4, 9), h = K.irange(rng, 4, 9);
      const x = K.irange(rng, 2, W - w - 3), y = K.irange(rng, 2, H - h - 3);
      const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
      if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
      rooms.push(r);
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) tiles[idx(i, j)] = 1;
    }
    // коридоры: цепочка + пара циклов
    const link = (a, b) => {
      let x = a.cx, y = a.cy;
      // проходы шириной 3 клетки: столбики/саркофаги не запирают путь
      const carve = () => {
        for (let d = -1; d <= 1; d++) {
          if (inB(x + d, y)) tiles[idx(x + d, y)] = 1;
          if (inB(x, y + d)) tiles[idx(x, y + d)] = 1;
        }
      };
      while (x !== b.cx) { carve(); x += x < b.cx ? 1 : -1; }
      while (y !== b.cy) { carve(); y += y < b.cy ? 1 : -1; }
      carve();
    };
    for (let i = 1; i < rooms.length; i++) link(rooms[i - 1], rooms[i]);
    for (let k = 0; k < 2 && rooms.length > 3; k++) {
      const a = K.choice(rng, rooms), b = K.choice(rng, rooms);
      if (a !== b) link(a, b);
    }
    return { tiles, rooms };
  }

  // ---------- планировка: пещера (клеточный автомат) ----------
  function genCave(rng) {
    const tiles = new Uint8Array(W * H);
    let cur = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++)
      cur[idx(x, y)] = rng() < 0.44 ? 0 : 1; // 1 = скала
    for (let it = 0; it < 4; it++) {
      const next = new Uint8Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
          if ((dx || dy) && !cur[idx(x + dx, y + dy)]) n++;
        next[idx(x, y)] = (cur[idx(x, y)] ? n >= 4 : n >= 5) ? 1 : 0;
      }
      cur = next;
    }
    // рамка — скала: без этого заливка регионов ходит «по краю карты»,
    // склеивая отдельные пещеры, и рамочный проход их потом перерезает
    for (let x = 0; x < W; x++) { cur[idx(x, 0)] = 1; cur[idx(x, H - 1)] = 1; }
    for (let y = 0; y < H; y++) { cur[idx(0, y)] = 1; cur[idx(W - 1, y)] = 1; }
    // самая большая полость
    const mark = new Int32Array(W * H).fill(-1);
    let best = -1, bestSize = 0, region = 0;
    for (let i = 0; i < W * H; i++) {
      if (cur[i] || mark[i] >= 0) continue;
      const q = [i]; mark[i] = region; let size = 0;
      while (q.length) {
        const p = q.pop(); size++;
        const px = p % W, py = (p / W) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = px + dx, ny = py + dy;
          if (inB(nx, ny) && !cur[idx(nx, ny)] && mark[idx(nx, ny)] < 0) { mark[idx(nx, ny)] = region; q.push(idx(nx, ny)); }
        });
      }
      if (size > bestSize) { bestSize = size; best = region; }
      region++;
    }
    const rooms = [];
    for (let i = 0; i < W * H; i++) {
      if (!cur[i] && mark[i] === best) {
        tiles[i] = 1;
        const x = i % W, y = (i / W) | 0;
        // маркеры-«комнаты» только на полу, не у рамки
        if (x % 7 === 0 && y % 7 === 0 && x > 2 && y > 2 && x < W - 3 && y < H - 3)
          rooms.push({ x: x - 2, y: y - 2, w: 5, h: 5, cx: x, cy: y, cave: true });
      }
    }
    if (!rooms.length) {
      // гарантированная камера в центре + коридор до ближайшего пола региона
      let bx = -1, by = -1, bd = 1e9;
      for (let i = 0; i < W * H; i++) {
        if (tiles[i] !== 1) continue;
        const x = i % W, y = (i / W) | 0;
        const d = Math.abs(x - 28) + Math.abs(y - 28);
        if (d < bd) { bd = d; bx = x; by = y; }
      }
      for (let j = 25; j < 32; j++) for (let i = 25; i < 32; i++) tiles[idx(i, j)] = 1;
      if (bx >= 0) {
        let x = 28, y = 28;
        while (x !== bx) { tiles[idx(x, y)] = 1; x += x < bx ? 1 : -1; }
        while (y !== by) { tiles[idx(x, y)] = 1; y += y < by ? 1 : -1; }
        tiles[idx(bx, by)] = 1;
      }
      rooms.push({ x: 25, y: 25, w: 6, h: 6, cx: 28, cy: 28, cave: true });
    }
    return { tiles, rooms };
  }

  // ---------- планировка: катакомбы (лабиринт с широкими ходами) ----------
  // По-диабловски: ходы в две плитки (клетки 2×2, стены в одну), DFS-лабиринт,
  // ~12% стен снесено в петли; поверх 4–6 кельи-камер, тупики — ниши
  // под саркофаги. Всё связно по построению.
  function genCatacombs(rng) {
    const tiles = new Uint8Array(W * H);
    const CN = 13;                                     // 13×13 клеток, шаг 4 тайла
    const cellX = c => 1 + c * 4, cellY = c => 1 + c * 4;
    const carveCell = (cx, cy) => {
      const px = cellX(cx), py = cellY(cy);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) tiles[idx(px + i, py + j)] = 1;
    };
    const carveLink = (cx, cy, dx, dy) => {
      const px = cellX(cx), py = cellY(cy);
      // стена-перемычка между клетками: колонка/строка по направлению (3 тайла)
      const wx = px + (dx === 1 ? 3 : dx === -1 ? -1 : 0);
      const wy = py + (dy === 1 ? 3 : dy === -1 ? -1 : 0);
      if (dx) { for (let j = 0; j < 3; j++) tiles[idx(wx, py + j)] = 1; }
      else    { for (let i = 0; i < 3; i++) tiles[idx(px + i, wy)] = 1; }
    };
    const visited = new Uint8Array(CN * CN);
    const scx = Math.floor(rng() * CN), scy = Math.floor(rng() * CN);
    visited[scy * CN + scx] = 1;
    carveCell(scx, scy);
    const stack = [[scx, scy]];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const dirs = DIRS.slice();
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
      let moved = false;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= CN || ny >= CN || visited[ny * CN + nx]) continue;
        visited[ny * CN + nx] = 1;
        carveCell(nx, ny);
        carveLink(cx, cy, dx, dy);
        stack.push([nx, ny]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }
    // петли: сносим часть стоящих стен, чтобы лабиринт не был деревом
    for (let cy = 0; cy < CN; cy++) for (let cx = 0; cx < CN; cx++) {
      if (cx + 1 < CN && rng() < 0.12) carveLink(cx, cy, 1, 0);
      if (cy + 1 < CN && rng() < 0.12) carveLink(cx, cy, 0, 1);
    }
    // кельи-камеры поверх лабиринта
    const rooms = [];
    const nCh = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < nCh; i++) {
      const w = 6 + Math.floor(rng() * 4), h = 6 + Math.floor(rng() * 4);
      const x = 1 + Math.floor(rng() * Math.max(1, W - w - 3));
      const y = 1 + Math.floor(rng() * Math.max(1, H - h - 3));
      for (let j = y; j < y + h && j < H - 1; j++)
        for (let ii = x; ii < x + w && ii < W - 1; ii++) tiles[idx(ii, j)] = 1;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    // ниши и развилки — маркеры для саркофагов/спавнов
    let extra = 0;
    for (let cy = 0; cy < CN && extra < 12; cy++) for (let cx = 0; cx < CN && extra < 12; cx++) {
      const px = cellX(cx), py = cellY(cy);
      if (tiles[idx(px, py)] !== 1) continue;
      let open = 0;
      for (const [dx, dy] of DIRS) if (tiles[idx(px + dx * 4, py + dy * 4)] === 1) open++;
      if (open >= 3 && rng() < 0.25) {
        rooms.push({ x: px - 1, y: py - 1, w: 4, h: 4, cx: px, cy: py, cave: true });
        extra++;
      } else if (open === 1 && rng() < 0.35) {
        rooms.push({ x: px - 1, y: py - 1, w: 4, h: 4, cx: px, cy: py, cave: true, niche: true });
        extra++;
      }
    }
    return { tiles, rooms };
  }

  // ---------- планировка: крестовый собор (симметрия) ----------
  function genCross(rng) {
    const tiles = new Uint8Array(W * H);
    const rooms = [];
    const put = (x, y, w, h) => {
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
        if (inB(i, j)) tiles[idx(i, j)] = 1;
    };
    put(23, 8, 10, 40);  // вертикальный неф
    put(8, 23, 40, 10);  // горизонтальный неф
    put(10, 10, 9, 9); put(37, 10, 9, 9); // боковые капеллы
    put(10, 37, 9, 9); put(37, 37, 9, 9);
    // коридоры от капелл к вертикальному нефу (иначе капеллы — острова)
    put(18, 13, 6, 2); put(18, 40, 6, 2);   // левые капеллы → неф
    put(31, 13, 7, 2); put(31, 40, 7, 2);   // правые капеллы → неф
    // колоннады вдоль нефов
    for (let y = 12; y < 44; y += 4) { if (!tiles[idx(24, y)]) tiles[idx(24, y)] = 1; if (!tiles[idx(31, y)]) tiles[idx(31, y)] = 1; }
    for (let x = 12; x < 44; x += 4) { if (!tiles[idx(x, 24)]) tiles[idx(x, 24)] = 1; if (!tiles[idx(x, 31)]) tiles[idx(x, 31)] = 1; }
    return { tiles, rooms };
  }

  // ---------- босс-арена ----------
  function genArena(rng) {
    const tiles = new Uint8Array(W * H);
    const rooms = [];
    const cx = 28, cy = 30;
    putRect(tiles, cx - 8, cy - 8, 17, 17);
    rooms.push({ x: cx - 8, y: cy - 8, w: 17, h: 17, cx, cy });
    // вход сверху
    putRect(tiles, cx - 1, 6, 3, 18);
    rooms.push({ x: cx - 1, y: 6, w: 3, h: 6, cx, cy: 9, entry: true });
    return { tiles, rooms };
  }
  function putRect(tiles, x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
      if (inB(i, j)) tiles[idx(i, j)] = 1;
  }

  // ближайший тайл пола (спиральный поиск) — страховка входов/спавнов
  function nearestFloor(tiles, x, y) {
    const ix = K.clamp(Math.round(x), 1, W - 2), iy = K.clamp(Math.round(y), 1, H - 2);
    if (tiles[idx(ix, iy)] === 1) return [ix + 0.5, iy + 0.5];
    for (let r = 1; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = ix + dx, ny = iy + dy;
        if (inB(nx, ny) && tiles[idx(nx, ny)] === 1) return [nx + 0.5, ny + 0.5];
      }
    }
    return [ix + 0.5, iy + 0.5];
  }

  // ---------- финальная сборка уровня ----------
  function generate(depth, rng) {
    const isBoss = depth % 5 === 0;
    let theme;
    if (isBoss) {
      const bt = DATA.BOSSES[DATA.bossForDepth(depth)].theme;
      const pool = DATA.THEMES.filter(t => t.unlock <= depth && (!bt || t.id === bt));
      theme = pool.length ? pool[pool.length - 1] : DATA.THEMES[0];
    } else {
      const pool = DATA.THEMES.filter(t => t.unlock <= depth);
      theme = K.choice(rng, pool);
    }

    let plan;
    if (isBoss) plan = genArena(rng);
    else if (theme.id === 'crypt' && rng() < 0.6) plan = genCatacombs(rng);  // катакомбы: лабиринт или комнаты
    else if (theme.gen === 'cave') plan = genCave(rng);
    else if (theme.gen === 'cross') plan = genCross(rng);
    else plan = genRooms(rng);

    const tiles = plan.tiles, rooms = plan.rooms;

    // стены: сосед пустоты с полом
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tiles[idx(x, y)] !== 0) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++)
        if (inB(x + dx, y + dy) && tiles[idx(x + dx, y + dy)] === 1) { near = true; break; }
      if (near) tiles[idx(x, y)] = 2;
    }
    // рамка — гарантированные стены
    for (let x = 0; x < W; x++) { if (tiles[idx(x, 0)] === 1) tiles[idx(x, 0)] = 2; if (tiles[idx(x, H - 1)] === 1) tiles[idx(x, H - 1)] = 2; }
    for (let y = 0; y < H; y++) { if (tiles[idx(0, y)] === 1) tiles[idx(0, y)] = 2; if (tiles[idx(W - 1, y)] === 1) tiles[idx(W - 1, y)] = 2; }

    // опасные тайлы (лава/иней/паутина) — немного, у стен комнат
    if (theme.hazard && !isBoss) {
      for (const r of rooms) {
        if (r.cave || !K.chance(rng, 0.65)) continue;
        const hx = r.x + K.irange(rng, 1, Math.max(1, r.w - 3));
        const hy = r.y + K.irange(rng, 1, Math.max(1, r.h - 3));
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++)
          if (tiles[idx(hx + i, hy + j)] === 1 && K.chance(rng, 0.8)) tiles[idx(hx + i, hy + j)] = 3;
      }
    }

    // вход: первая комната (или прихожая арены) — с гарантией пола
    const entryRoom = rooms.find(r => r.entry) || rooms[0];
    const entryFix = nearestFloor(tiles, entryRoom.cx + 0.5, entryRoom.cy + 0.5);
    const entry = { x: entryFix[0], y: entryFix[1] };

    // выход: самая далёкая от входа комната
    let exitRoom = rooms[0], bestD = -1;
    for (const r of rooms) {
      if (r === entryRoom) continue;
      const d = (r.cx - entryRoom.cx) ** 2 + (r.cy - entryRoom.cy) ** 2;
      if (d > bestD) { bestD = d; exitRoom = r; }
    }
    let exit = null;
    if (!isBoss) {
      const exFix = nearestFloor(tiles, exitRoom.cx + 0.5, exitRoom.cy + 0.5);
      exit = { x: exFix[0], y: exFix[1] };
    }

    // факелы: у стен комнат
    const torches = [];
    for (const r of rooms) {
      if (r.cave) {
        if (K.chance(rng, 0.7)) torches.push({ x: r.cx + 0.5 + K.irange(rng, -2, 2), y: r.cy + 0.5 + K.irange(rng, -2, 2) });
        continue;
      }
      const n = K.irange(rng, 2, 4);
      for (let i = 0; i < n; i++) {
        const side = K.irange(rng, 0, 3);
        let tx, ty;
        if (side === 0) { tx = K.irange(rng, r.x, r.x + r.w - 1); ty = r.y - 1; }
        else if (side === 1) { tx = K.irange(rng, r.x, r.x + r.w - 1); ty = r.y + r.h; }
        else if (side === 2) { tx = r.x - 1; ty = K.irange(rng, r.y, r.y + r.h - 1); }
        else { tx = r.x + r.w; ty = K.irange(rng, r.y, r.y + r.h - 1); }
        if (inB(tx, ty) && tiles[idx(tx, ty)] === 2) torches.push({ x: tx + 0.5, y: ty + 0.5 });
      }
    }

    // пропсы: блокирующие и декоративные
    const props = [];
    const propDefs = theme.props;
    const blocked = (x, y) => props.some(p => p.blocks && Math.abs(p.x - x) < 1.4 && Math.abs(p.y - y) < 1.4);
    for (const r of rooms) {
      if (r === entryRoom) continue;
      const n = K.irange(rng, 2, 5);
      for (let i = 0; i < n; i++) {
        const type = K.choice(rng, propDefs);
        const x = r.x + 0.5 + K.irange(rng, 0, r.w - 1);
        const y = r.y + 0.5 + K.irange(rng, 0, r.h - 1);
        const t = inB(x | 0, y | 0) ? tiles[idx(x | 0, y | 0)] : 0;
        if (t !== 1 || blocked(x, y)) continue;
        if (Math.hypot(x - entry.x, y - entry.y) < 2.2) continue;
        const def = {
          pillar: { blocks: true, light: false },
          sarcoph: { blocks: true, light: false },
          cocoon: { blocks: true, light: false },
          shelf: { blocks: true, light: false },
          icicle: { blocks: true, light: false },
          skulls: { blocks: false, light: false },
          bones: { blocks: false, light: false },
          candle: { blocks: false, light: true },
          brazier: { blocks: true, light: true },
        }[type];
        props.push({ type, x, y, blocks: def.blocks, light: def.light, seed: K.irange(rng, 0, 9999) });
      }
    }
    // алтарь-бафф в случайной комнате
    if (K.chance(rng, 0.75)) {
      const r = K.choice(rng, rooms.filter(r => r !== entryRoom) || rooms);
      if (r) props.push({ type: 'shrine', x: r.cx + 0.5, y: r.cy + 0.5, blocks: false, light: true, seed: 1 });
    }

    // сундуки
    const chests = [];
    if (!isBoss) {
      const n = K.irange(rng, 1, 3);
      for (let i = 0; i < n; i++) {
        const r = K.choice(rng, rooms.filter(r => !r.entry && r !== entryRoom));
        if (!r) continue;
        const fix = nearestFloor(tiles, r.cx + 0.5 + K.irange(rng, -1, 1), r.cy + 0.5 + K.irange(rng, -1, 1));
        chests.push({ x: fix[0], y: fix[1], opened: false });
      }
    }

    // ---------- гарантия проходимости ----------
    // Блокирующие пропсы (колонны, саркофаги, коконы, стеллажи) добавляем по
    // одному: если путь от входа до выхода/сундуков/алтаря запирается —
    // пропс не ставится. Никаких «колонна в проходе».
    const targets = [];
    if (exit) targets.push([exit.x, exit.y]);
    else targets.push([rooms[0].cx + 0.5, rooms[0].cy + 0.5]);   // центр арены босса
    for (const c of chests) targets.push([c.x, c.y]);
    const shrineProp = props.find(p => p.type === 'shrine');
    if (shrineProp) targets.push([shrineProp.x, shrineProp.y]);
    // пропс, стоящий ровно на цели, убираем безоговорочно
    for (let i = props.length - 1; i >= 0; i--) {
      const pr = props[i];
      if (pr.blocks && targets.some(t => (t[0] | 0) === (pr.x | 0) && (t[1] | 0) === (pr.y | 0)))
        props.splice(i, 1);
    }
    const solidBase = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solidBase[i] = (tiles[i] === 0 || tiles[i] === 2) ? 1 : 0;
    const pathsExist = (blocks) => {
      const blocked = new Uint8Array(solidBase);
      // «жирный» блок: столбик занимает свою клетку и мешает соседним —
      // если даже так путь заперт, столбик не ставится
      for (const b of blocks) {
        const bx = b[0] | 0, by = b[1] | 0;
        blocked[idx(bx, by)] = 1;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
          if (inB(bx + dx, by + dy)) blocked[idx(bx + dx, by + dy)] = 1;
      }
      const seen = new Uint8Array(W * H);
      const start = idx(entry.x | 0, entry.y | 0);
      if (blocked[start]) return false;
      const q = [start]; seen[start] = 1;
      let head = 0;
      while (head < q.length) {
        const c = q[head++];
        const x = c % W, y = (c / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = idx(nx, ny);
          if (seen[ni] || blocked[ni]) continue;
          seen[ni] = 1; q.push(ni);
        }
      }
      return targets.every(t => seen[idx(K.clamp(t[0] | 0, 0, W - 1), K.clamp(t[1] | 0, 0, H - 1))]);
    };
    const blockers = props.filter(p => p.blocks);
    const keptBlocks = [];
    for (const pr of blockers) {
      const test = keptBlocks.map(p => [p.x, p.y]);
      test.push([pr.x, pr.y]);
      if (pathsExist(test)) keptBlocks.push(pr);
    }
    for (let i = props.length - 1; i >= 0; i--)
      if (props[i].blocks && !keptBlocks.includes(props[i])) props.splice(i, 1);

    // спавны мобов
    const spawns = [];
    if (isBoss) {
      const bossId = DATA.bossForDepth(depth);
      spawns.push({ type: 'boss:' + bossId, x: cx0(rooms[0]), y: cy0(rooms[0]) });
    } else {
      const pool = DATA.THEME_POOLS[theme.id];
      const total = pool.reduce((s, p) => s + p[1], 0);
      const count = K.clamp(8 + Math.floor(depth * 0.6), 8, 90);
      for (let i = 0; i < count; i++) {
        const r = K.choice(rng, rooms.filter(r => !r.entry && r !== entryRoom));
        if (!r) continue;
        let roll = rng() * total, type = pool[0][0];
        for (const [t, w] of pool) { roll -= w; if (roll <= 0) { type = t; break; } }
        const fix = nearestFloor(tiles, r.x + 0.5 + rng() * (r.w - 1), r.y + 0.5 + rng() * (r.h - 1));
        spawns.push({ type, x: fix[0], y: fix[1] });
      }
    }

    function cx0(r) { return r.cx + 0.5; }
    function cy0(r) { return r.cy + 0.5; }

    return {
      w: W, h: H, tiles, rooms, props, torches, chests, spawns, entry, exit,
      theme, depth, isBoss,
      vis: new Uint8Array(W * H),   // 0 неведомо, 1 помним, 2 видно
      flow: new Int16Array(W * H), flowAge: 99,
    };
  }

  // ---------- геометрия ----------
  function isWall(level, x, y) {
    const tx = x | 0, ty = y | 0;
    if (!inB(tx, ty)) return true;
    const t = level.tiles[idx(tx, ty)];
    return t === 0 || t === 2;
  }
  function isHazard(level, x, y) {
    const tx = x | 0, ty = y | 0;
    if (!inB(tx, ty)) return false;
    return level.tiles[idx(tx, ty)] === 3;
  }

  // ---------- туман войны: LOS по Брезенхэму ----------
  function updateFOV(level, px, py, radius) {
    const vis = level.vis;
    const R2 = radius * radius;
    const ptx = px | 0, pty = py | 0;
    for (let y = pty - radius; y <= pty + radius; y++)
      for (let x = ptx - radius; x <= ptx + radius; x++) {
        if (!inB(x, y)) continue;
        const dx = x - ptx, dy = y - pty;
        if (dx * dx + dy * dy > R2) continue;
        if (losClear(level, ptx, pty, x, y)) vis[idx(x, y)] = 2;
      }
  }
  function losClear(level, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      if (!(x === x0 && y === y0) && isWall(level, x, y)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
  }

  // ---------- поле потоков: BFS от игрока (8-связно, стены непроходимы) ----------
  function updateFlow(level, px, py) {
    const flow = level.flow;
    flow.fill(-1);
    const start = idx(px | 0, py | 0);
    if (isWall(level, px | 0, py | 0)) return;
    flow[start] = 0;
    const q = [start];
    let head = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (head < q.length) {
      const p = q[head++];
      const d = flow[p];
      if (d > 90) continue;
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!inB(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (flow[ni] >= 0) continue;
        if (isWall(level, nx, ny)) continue;
        // диагональ не сквозь угол
        if (dx && dy && (isWall(level, x + dx, y) || isWall(level, x, y + dy))) continue;
        flow[ni] = d + 1;
        q.push(ni);
      }
    }
  }

  // отладочный хук: план без пост-обработки (для тестов связности)
  const __plan = (gen, rng) =>
    gen === 'cave' ? genCave(rng) : gen === 'cross' ? genCross(rng) :
    gen === 'catacombs' ? genCatacombs(rng) : genRooms(rng);

  return { generate, isWall, isHazard, updateFOV, updateFlow, W, H, idx, inB, __plan };
})();
