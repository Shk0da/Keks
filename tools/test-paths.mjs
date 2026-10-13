// test-paths.mjs — проходимость: 600 случайных этажей, путь вход→выход/сундуки/алтарь
// должен существовать с учётом блокирующих пропсов. Запуск: node tools/test-paths.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.window = global;
require('../site/js/util.js');
require('../site/js/data.js');
require('../site/js/dungeon.js');

const { Dungeon } = global;
const W = Dungeon.W, H = Dungeon.H;

function check(lvl) {
  const blocked = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const t = lvl.tiles[i];
    blocked[i] = (t === 0 || t === 2) ? 1 : 0;
  }
  const fat = (x, y) => {
    blocked[y * W + x] = 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) blocked[ny * W + nx] = 1;
    }
  };
  for (const pr of lvl.props) if (pr.blocks) fat(pr.x | 0, pr.y | 0);
  const targets = [];
  if (lvl.exit) targets.push(lvl.exit);
  else if (lvl.spawns.length) targets.push(lvl.spawns[0]);
  for (const c of lvl.chests) targets.push(c);
  const sh = lvl.props.find(p => p.type === 'shrine');
  if (sh) targets.push(sh);
  const seen = new Uint8Array(W * H);
  const start = (lvl.entry.y | 0) * W + (lvl.entry.x | 0);
  if (blocked[start]) return false;
  const q = [start]; seen[start] = 1; let head = 0;
  while (head < q.length) {
    const c = q[head++]; const x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (seen[ni] || blocked[ni]) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return targets.every(t => seen[(t.y | 0) * W + (t.x | 0)]);
}

let fails = 0, blockers = 0, gens = 600;
for (let i = 0; i < gens; i++) {
  const depth = 1 + (i % 30);
  const lvl = Dungeon.generate(depth, K.mulberry32(i * 7919 + 13));
  blockers += lvl.props.filter(p => p.blocks).length;
  if (!check(lvl)) { fails++; if (fails <= 3) console.log('FAIL seed', i, 'depth', depth, lvl.theme.id); }
}
console.log(`Сгенерировано: ${gens}, непроходимых: ${fails}, блокирующих пропсов оставлено: ${blockers}`);
if (fails > 0) { console.error('ОШИБКА: есть непроходимые этажи'); process.exit(1); }
console.log('OK: все этажи проходимы');
