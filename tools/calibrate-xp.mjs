// calibrate-xp.mjs — калибровка кривой опыта до 100 уровня за ~1000 часов.
// Модель: игрок уровня L сам выбирает глубину с лучшим xp/час (в разумном диапазоне),
// время этажа растёт от соотношения HP врагов и урона игрока.
//
//   node tools/calibrate-xp.mjs

const MAX_LEVEL = 100;

// ---------- модель дохода ----------
const AVG_XP = 21;                       // средний базовый xp моба по пулам
const nEnemies = D => Math.min(90, 8 + 0.6 * D);
// усталость: на глубине заметно меньше 0.8×уровня опыт режется (жадные до глубины!)
const fatigue = (D, L) => Math.pow(Math.min(1, Math.max(0.15, D / (0.8 * L))), 1.5);
const xpFloor = (D, L) =>
  nEnemies(D) * AVG_XP * (1 + 0.16 * (D - 1)) * (D % 5 === 0 ? 1.35 : 1) * fatigue(D, L);

// ---------- модель силы ----------
// урон игрока: статы/уровень линейно × навыки (до +150% к 85 ур) × реликвии (до +100%)
const dmgMult = L => {
  const s = Math.min(1, (L - 1) / 84);
  return (1 + 0.06 * (L - 1)) * (1 + 1.5 * s) * (1 + 1.0 * s);
};
// HP врага: глубина × уровень игрока («чем выше уровень — тем сложнее»)
const ehpMult = (D, L) => (1 + 0.24 * (D - 1)) * (1 + 0.035 * (L - 1));
const clearMin = (D, L) => Math.min(40, Math.max(2.5, 4 * ehpMult(D, L) / dmgMult(L)));

// лучший xp/час для уровня L (перебор разумных глубин)
function bestRateHours(L) {
  let best = 0, bestD = 1;
  for (let D = 1; D <= Math.floor(L * 2.5) + 10; D++) {
    const r = xpFloor(D, L) / clearMin(D, L); // xp за минуту
    if (r > best) { best = r; bestD = D; }
  }
  return { perMin: best, depth: bestD };
}

// ---------- кривая опыта: A * L^P * G^L ----------
const P = +(process.env.P || 1.6), G = +(process.env.G || 1.048);
const baseXp = L => Math.pow(L, P) * Math.pow(G, L);

let sumBaseOverRate = 0;
const times = [];
for (let L = 1; L < MAX_LEVEL; L++) {
  const { perMin } = bestRateHours(L);
  const need = baseXp(L);                 // xp в единицах A
  const hours = need / perMin / 60;       // часов на уровень при A=1
  times.push({ L, hours, depth: bestRateHours(L).depth });
  sumBaseOverRate += hours;
}
const TARGET = 1000;                       // часов суммарно
const A = TARGET / sumBaseOverRate;

console.log('A =', A.toFixed(2));
let acc = 0;
const show = [1, 2, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
for (const t of times) {
  acc += t.hours * A;
  if (show.includes(t.L)) {
    console.log(`L${String(t.L).padStart(2)} → ${String(t.L + 1).padStart(3)}: ` +
      `${(t.hours * A).toFixed(2)} ч (глубина ${t.depth}), всего ${acc.toFixed(1)} ч`);
  }
}
console.log('ИТОГО часов:', acc.toFixed(1));
// итоговая формула для игры: xpNext(L) = round(A * L^1.6 * 1.048^L)
console.log('\nxpNext(1)  =', Math.round(A * baseXp(1)));
console.log('xpNext(50) =', Math.round(A * baseXp(50)));
console.log('xpNext(99) =', Math.round(A * baseXp(99)));
let tot = 0; for (let L = 1; L < 100; L++) tot += Math.round(A * baseXp(L));
console.log('суммарный xp до 100:', tot);
