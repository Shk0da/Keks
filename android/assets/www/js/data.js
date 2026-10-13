// data.js — весь игровой дизайн: темы данжей, бестиарий, боссы, навыки, реликвии, реплики.
'use strict';
window.DATA = (function () {

  // ================= ТЕМЫ ПОДЗЕМЕЛИЙ =================
  // unlock — с какой глубины тема попадает в ротацию
  const THEMES = [
    {
      id: 'crypt', name: 'Катакомбы Стонущих', unlock: 1, gen: 'rooms',
      floor: ['#41465e', '#3a3f55', '#464b64'], wallTop: '#525873', wallL: '#343850', wallR: '#2a2d42',
      grout: 'rgba(14,12,22,.55)', ambient: 0.86, torch: '#ffb46b',
      props: ['sarcoph', 'pillar', 'skulls', 'brazier', 'candle', 'web', 'barrel', 'body', 'arrowwall', 'sword'],
      particles: 'dust', mus: 'crypt',
      quip: 'Тут даже камни вздыхают. Романтика.',
    },
    {
      id: 'hell', name: 'Инферно-будуар', unlock: 2, gen: 'cave',
      floor: ['#4d2a2a', '#452424', '#573030'], wallTop: '#6a3535', wallL: '#482323', wallR: '#3a1b1b',
      grout: 'rgba(20,6,6,.6)', ambient: 0.9, torch: '#ff8a4b', hazard: 'lava',
      props: ['bones', 'brazier', 'pillar', 'skulls', 'web', 'barrel', 'body', 'arrowwall', 'sword'],
      particles: 'ember', mus: 'hell',
      quip: 'Жарко. Плащ спасает. Иногда.',
    },
    {
      id: 'ice', name: 'Ледяные Чертоги', unlock: 5, gen: 'rooms',
      floor: ['#3d5a78', '#35516d', '#476684'], wallTop: '#5b7ea3', wallL: '#3c5878', wallR: '#2f4a68',
      grout: 'rgba(10,18,30,.5)', ambient: 0.82, torch: '#9ec8ff', hazard: 'frost',
      props: ['pillar', 'icicle', 'sarcoph', 'brazier', 'web', 'barrel', 'body', 'sword'],
      particles: 'snow', mus: 'ice',
      quip: 'Холодно ровно настолько, чтобы прижиматься.',
    },
    {
      id: 'hive', name: 'Шёлковый Улей', unlock: 8, gen: 'cave',
      floor: ['#443452', '#3c2e49', '#4e3b5e'], wallTop: '#5c4470', wallL: '#3f2e50', wallR: '#342546',
      grout: 'rgba(16,8,20,.6)', ambient: 0.88, torch: '#e39aff', hazard: 'web',
      props: ['cocoon', 'pillar', 'skulls', 'web', 'body', 'barrel'],
      particles: 'spore', mus: 'hive',
      quip: 'Всё липкое. Не спрашивай.',
    },
    {
      id: 'library', name: 'Библиотека Порока', unlock: 11, gen: 'cross',
      floor: ['#4e4034', '#463a2e', '#584838'], wallTop: '#66513f', wallL: '#483a2c', wallR: '#3c3024',
      grout: 'rgba(18,12,8,.55)', ambient: 0.8, torch: '#ffd08b',
      props: ['shelf', 'candle', 'pillar', 'brazier', 'web', 'barrel', 'body', 'arrowwall', 'sword'],
      particles: 'mote', mus: 'library',
      quip: 'Тише! Тут читают… и перечитывают.',
    },
  ];

  // ================= ЭЛИТКИ (диабловские аффиксы) =================
  // С шансом ELITE_CHANCE моб становится элиткой: 1–2 аффикса, аура цвета,
  // ×2.2 HP, ×2.5 награда. Аффикс — данные: apply(e) при создании,
  // tick(e, game, dt) каждый кадр; особые флаги движок читает сам
  // (sticky — бьёт замедлением, vamp — лечится попадая, glass — ярость).
  const ELITE_CHANCE = 0.12;
  const ELITE_AFFIXES = [
    { id: 'swift', name: 'Стремительная', col: '#ffd860',
      apply(e) { e.speed *= 1.5; } },
    { id: 'fiery', name: 'Пылкая', col: '#ff9a4b',
      tick(e, game, dt) {
        if (Math.random() < dt * 8) game.particles.spawn({
          x: e.x + (Math.random() - 0.5) * 0.5, y: e.y - 0.3,
          vx: 0, vy: -30, life: 0.4, size: 2.5, col: '#ff9a4b' });
        e._fieryCd = (e._fieryCd || 0) - dt;
        if (e._fieryCd <= 0 && K.dist(e.x, e.y, game.player.x, game.player.y) < 0.95) {
          e._fieryCd = 0.6;
          game.playerHurt(e.dmg * 0.3, 'Пылкая аура', true, e);
          game.particles.burst(game.player.x, game.player.y - 0.4, 4, '#ff9a4b', 50);
        }
      } },
    { id: 'sticky', name: 'Липкая', col: '#d8c0f0' },       // её удары замедляют
    { id: 'vamp', name: 'Кровожадная', col: '#ff5a6e' },    // лечится, попадая по тебе
    { id: 'glass', name: 'Хрупкая ярость', col: '#e29aff',
      apply(e) { e.dmg *= 1.7; } },                          // бьёт страшно, бьётся хрупко
  ];


  // Атака моба задаётся строкой ('melee'|'lunge') или объектом
  // {kind:'proj'|'multi', v, col, r, sfx, slow, spread, shots, dmgMult}.
  // Своя логика — поле onAttack(e, game, dist) в описании моба (приоритетнее).
  // ================= РЕЕСТР АТАК МОБОВ =================
  const ATTACKS = {
    melee(e, game) {
      const p = game.player;
      const d = K.dist(e.x, e.y, p.x, p.y);
      if (d < e.def.atkRange + p.r + 0.3) game.playerHurt(e.dmg, e.def.name, false, e);
    },
    lunge(e, game) {
      const p = game.player;
      const a = K.angTo(e.x, e.y, p.x, p.y);
      e.lungeDx = Math.cos(a) * 8.5; e.lungeDy = Math.sin(a) * 8.5;
      e.lungeT = 0.32;
      AudioSys.sfx('dash');
    },
    proj(e, game, o) {
      const p = game.player;
      const a = K.angTo(e.x, e.y, p.x, p.y) + (Math.random() - 0.5) * (o.spread != null ? o.spread : 0.14);
      const pr = new Entities.Projectile(e.x, e.y - 0.3, Math.cos(a) * o.v, Math.sin(a) * o.v,
        e.dmg * (o.dmgMult || 1), o.col, o.r || 0.15, o.slow || 0);
      if (o.homing) pr.homing = o.homing;
      game.projectiles.push(pr);
      AudioSys.sfx(o.sfx || 'shoot');
    },
    multi(e, game, o) {
      const n = o.shots || 3;
      const base = K.angTo(e.x, e.y, game.player.x, game.player.y);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * (o.spread || 0.3);
        const pr = new Entities.Projectile(e.x, e.y - 0.3, Math.cos(a) * o.v, Math.sin(a) * o.v,
          e.dmg * (o.dmgMult || 1), o.col, o.r || 0.15, o.slow || 0);
        if (o.homing) pr.homing = o.homing;
        game.projectiles.push(pr);
      }
      AudioSys.sfx(o.sfx || 'shoot');
    },
  };
  // запуск атаки по описанию (учитывает кастомный onAttack)
  function runAttack(e, game, d) {
    const def = e.def;
    if (typeof def.onAttack === 'function') return def.onAttack(e, game, d);
    const a = def.attack;
    if (typeof a === 'string') return (ATTACKS[a] || ATTACKS.melee)(e, game, {});
    if (a && ATTACKS[a.kind]) return ATTACKS[a.kind](e, game, a);
    return ATTACKS.melee(e, game, {});
  }

  // ================= РЕЕСТР ПАТТЕРНОВ БОССОВ =================
  // Паттерн в bd.patterns — строка ('summon'), пара ['summon', {n:3}]
  // или собственная функция (b, game) — расширяется без правки движка.
  const BOSS_PATTERNS = {
    summon(b, game, o) {
      const n = o.n != null ? o.n : (b.enrage ? 3 : 2);
      const type = o.type || 'imp';
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const e = new Entities.Enemy(type, b.x + Math.cos(ang) * 1.6, b.y + Math.sin(ang) * 1.6,
          game.level.depth, game.player.level);
        e.aggro = true;
        game.enemies.push(e);
        game.particles.burst(e.x, e.y - 0.3, 10, '#d9a8ff', 60);
      }
      UI.toast(o.toast || 'Подкрепление! Сердцеедки в деле', '');
      AudioSys.sfx('net');
    },
    webnova(b, game, o) { BOSS_PATTERNS._radial(b, game, o, '#d8c0f0', 3.4, 1.5, 'net'); },
    novaring(b, game, o) { BOSS_PATTERNS._radial(b, game, o, '#a8e6ff', 3.4, 1.0, 'frost'); },
    firering(b, game, o) { BOSS_PATTERNS._radial(b, game, o, '#ff9a4b', 3.8, 0, 'fire'); },
    _radial(b, game, o, col, v, slow, sfx) {
      const n = (o.n || 10) + (b.enrage ? 6 : 0);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.1;
        game.projectiles.push(new Entities.Projectile(b.x, b.y - 0.4,
          Math.cos(ang) * v, Math.sin(ang) * v, b.dmg * (o.dmgMult || 0.85), col, 0.18, slow));
      }
      AudioSys.sfx(sfx);
    },
    slam(b, game, o) {
      b.teleT = o.windup || 0.9;
      b.teleR = o.r || 2.4;
      b.teleX = game.player.x; b.teleY = game.player.y;
    },
    dash(b, game, o) {
      const reps = o.reps != null ? o.reps : (b.enrage ? 3 : 2);
      for (let i = 0; i < reps; i++) {
        setTimeout(() => {
          if (b.dead || !b.aggro) return;
          const aa = K.angTo(b.x, b.y, game.player.x, game.player.y);
          b.lungeDx = Math.cos(aa) * 10; b.lungeDy = Math.sin(aa) * 10;
          b.lungeT = 0.34;
          game.particles.burst(b.x, b.y - 0.3, 12, '#ff9a4b', 80);
        }, i * (o.gap || 700));
      }
      AudioSys.sfx('dash');
    },
    blink(b, game, o) {
      const p = game.player;
      const ang = Math.random() * Math.PI * 2;
      game.particles.burst(b.x, b.y - 0.4, 16, '#a8e6ff', 80);
      b.x = K.clamp(p.x + Math.cos(ang) * (o.dist || 2.6), 1.5, game.level.w - 1.5);
      b.y = K.clamp(p.y + Math.sin(ang) * (o.dist || 2.6), 1.5, game.level.h - 1.5);
      game.particles.burst(b.x, b.y - 0.4, 16, '#a8e6ff', 80);
      AudioSys.sfx('frost');
      const shots = o.shots != null ? o.shots : 5;
      for (let i = -(shots - 1) / 2; i <= (shots - 1) / 2; i++) {
        const aa = K.angTo(b.x, b.y, p.x, p.y) + i * 0.22;
        game.projectiles.push(new Entities.Projectile(b.x, b.y - 0.4,
          Math.cos(aa) * 4.2, Math.sin(aa) * 4.2, b.dmg * 0.8, '#a8e6ff', 0.16, 1.0));
      }
    },
    homing(b, game, o) {
      const n = o.n || 3;
      const a = K.angTo(b.x, b.y, game.player.x, game.player.y);
      for (let i = 0; i < n; i++) {
        const pr = new Entities.Projectile(b.x, b.y - 0.5,
          Math.cos(a) * 2.6, Math.sin(a) * 2.6, b.dmg * 0.7, '#ffd88a', 0.15);
        pr.homing = o.power || 2.2;
        game.projectiles.push(pr);
      }
      AudioSys.sfx('shoot');
    },
    silence(b, game, o) {
      game.player.spinCd = Math.max(game.player.spinCd, o.lock || 5);
      UI.toast(o.toast || 'Лилит шепчет: «Вихри под запретом!»', '');
      game.particles.burst(game.player.x, game.player.y - 0.5, 14, '#e8d8ff', 60);
      AudioSys.sfx('net');
    },
  };


  // attack: melee | lunge | spit | nova
  // ================= БЕСТИАРИЙ =================
  // Описание моба: статы + attack (см. ATTACKS) + опциональные хуки:
  //   onSpawn(e, game), onTick(e, game, dt), onAttack(e, game, dist),
  //   onHurt(e, game, dmg), onDeath(e, game) — своя логика без правки движка.
  const ENEMIES = {
    imp: {
      name: 'Импка', hp: 26, dmg: 6, speed: 2.1, aggro: 6.5, atkRange: 0.95, atkCd: 1.15,
      attack: 'melee', xp: 11, gold: [1, 4], r: 0.3, size: 0.78, flying: false,
      pal: { skin: '#e8a0bd', hair: '#8a2d55', cloth: '#46284f', glow: '#ff9ecf' },
      horns: true, wings: 'small', tail: true,
      lines: {
        aggro: ['Ой, какой гостеприимный!', 'Он в одном плаще! Стыдно… интересно!', 'Мясо само пришло!', 'Сейчас будет больно-приятно!'],
        hit:  ['Ай! Нечестно!', 'Эй, я только разогрелась!', 'Осторожнее, я хрупкая!'],
        die:  ['Подло… и приятно…', 'Я ещё вернусь, красавчик…', 'Мамочка…'],
      },
    },
    hunter: {
      name: 'Охотница-суккуб', hp: 42, dmg: 9, speed: 2.9, aggro: 8.5, atkRange: 1.1, atkCd: 1.6,
      attack: 'lunge', xp: 18, gold: [2, 6], r: 0.32, size: 0.95, flying: false,
      pal: { skin: '#dfa2b4', hair: '#c2456e', cloth: '#5c1f3d', glow: '#ff7ab8' },
      horns: true, wings: 'big', tail: true,
      lines: {
        aggro: ['Беги, мальчик. Я люблю догонять.', 'Мой хлыст длиннее. Спорим?', 'Наконец-то достойная добыча… и добытчик!', 'Плащ не спасёт. Я проверяла.'],
        hit:  ['Ах ты!.. это было даже смело.', 'Меткий, зараза…', 'Ещё раз так — и я обижусь. Или влюблюсь.'],
        die:  ['Догнала себя…', 'Уважаю… нет, ненавижу… ладно, уважаю…', 'Скажи, что хотя бы впечатлён…'],
      },
    },
    lamia: {
      name: 'Ламия-плевунья', hp: 55, dmg: 8, speed: 1.7, aggro: 9, atkRange: 5.6, atkCd: 2.2,
      attack: { kind: 'proj', v: 4.6, col: '#a8e890', r: 0.16, sfx: 'shoot' }, xp: 24, gold: [3, 8], r: 0.38, size: 1.0, flying: false, snake: true,
      pal: { skin: '#b7c99a', hair: '#2e4a2e', cloth: '#274a3a', glow: '#b6ff9e' },
      horns: false, wings: 'none', tail: false,
      lines: {
        aggro: ['Подойди на длину плевка, милый.', 'Моя слюна ядовита. Проверим на тебе?', 'Ш-ш-ш… какой аппетитный силуэт.'],
        hit:  ['Фу! В причёску!', 'Ш-ш-ш… дерзкий шутник!'],
        die:  ['Я только кожу поменять хотела…', 'Хвост… мой прекрасный хвост…'],
      },
    },
    harpy: {
      name: 'Гарпия-крикунья', hp: 38, dmg: 7, speed: 3.3, aggro: 10, atkRange: 1.0, atkCd: 1.3,
      attack: 'melee', xp: 20, gold: [2, 7], r: 0.3, size: 0.9, flying: true,
      pal: { skin: '#d8c9a8', hair: '#e8d87a', cloth: '#6a5a2a', glow: '#ffe08a' },
      horns: false, wings: 'huge', tail: false,
      lines: {
        aggro: ['Слетались! Слетались!', 'Сверху видно всё, красавчик!', 'Я умею делать «вжух» и больно!'],
        hit:  ['Перья! Мои перья!', 'Оперение порушил, паршивец!'],
        die:  ['Крылья… не держат… комплименты…'],
      },
    },
    webber: {
      name: 'Тенетница', hp: 48, dmg: 5, speed: 1.9, aggro: 9, atkRange: 6.2, atkCd: 2.6,
      attack: { kind: 'proj', v: 3.8, col: '#d8c0f0', r: 0.2, sfx: 'net', slow: 1.6 }, xp: 22, gold: [2, 7], r: 0.36, size: 0.95, flying: false,
      pal: { skin: '#cdb6e0', hair: '#4a3068', cloth: '#33244a', glow: '#d9a8ff' },
      horns: true, wings: 'none', tail: true,
      lines: {
        aggro: ['Не дёргайся, так быстрее запутаешься.', 'У меня паутинка и плохие намерения.', 'Свяжем тебя… по обстоятельствам.'],
        hit:  ['Паутинку порвал! Руками плести буду!', 'Грубиян в моём алькове!'],
        die:  ['Узелок… на память…'],
      },
    },
    marble: {
      name: 'Мраморная Дама', hp: 120, dmg: 15, speed: 1.25, aggro: 7, atkRange: 1.25, atkCd: 2.0,
      attack: 'melee', xp: 40, gold: [6, 14], r: 0.46, size: 1.2, flying: false, stone: true,
      pal: { skin: '#cfd4dd', hair: '#8f97a5', cloth: '#5a6270', glow: '#cfe8ff' },
      horns: false, wings: 'none', tail: false,
      lines: {
        aggro: ['Я стою здесь тысячу лет. Потанцуем?', 'Мрамор. Целомудренно. Тяжело. Как мой удар.', 'Не ругайся внутри мрамора. Эхо обидится.'],
        hit:  ['Скол! Ты сделал мне скол!', 'О, ты сильнее, чем выглядишь.'],
        die:  ['Откололось… сердце… мраморное…'],
      },
    },
    ember: {
      name: 'Пламенная Дева', hp: 60, dmg: 11, speed: 2.3, aggro: 8, atkRange: 4.6, atkCd: 2.4,
      attack: { kind: 'proj', v: 4.2, col: '#ff9a4b', r: 0.17, sfx: 'fire' }, xp: 30, gold: [4, 9], r: 0.34, size: 1.0, flying: false,
      pal: { skin: '#f2b09a', hair: '#e8542e', cloth: '#7a1e14', glow: '#ff9a4b' },
      horns: true, wings: 'small', tail: true, fire: true,
      lines: {
        aggro: ['Огонь, страсть и лёгкое ардерие!', 'Горячо? Это я ещё разогреваюсь.', 'Плащ загорится — останешься честным.'],
        hit:  ['Искры в глазах — твои или мои?', 'Ты дерзкий. Дерзость плавится первой.'],
        die:  ['Дотла… но красиво…'],
      },
    },
    frost: {
      name: 'Ледяная Нимфа', hp: 54, dmg: 9, speed: 2.0, aggro: 9, atkRange: 5.2, atkCd: 2.3,
      attack: { kind: 'proj', v: 4.0, col: '#a8e6ff', r: 0.17, sfx: 'frost', slow: 1.2 }, xp: 28, gold: [3, 9], r: 0.33, size: 0.95, flying: false,
      pal: { skin: '#bcd8ec', hair: '#7ec8e8', cloth: '#2e5a7a', glow: '#a8e6ff' },
      horns: false, wings: 'small', tail: false, ice: true,
      lines: {
        aggro: ['Поцелуй — минус сорок. Согласен?', 'Холодные руки, тёплое сердце, острый сердечный удар.', 'Дрожишь? Это я.'],
        hit:  ['Треснула! Как тонкий лёд!', 'Оттаю — отомщу.'],
        die:  ['Растаяла… от чувств…'],
      },
    },
    // ПРИМЕР РАСШИРЕНИЯ: новый моб одной записью — веер из трёх «поцелуев»
    // (attack.multi из реестра) + хук onDeath. Ни одной правки движка.
    widow: {
      name: 'Вдова-Соблазнительница', hp: 72, dmg: 8, speed: 2.2, aggro: 9.5, atkRange: 6.4, atkCd: 2.5,
      attack: { kind: 'multi', shots: 3, spread: 0.32, v: 4.4, col: '#ff7ab8', r: 0.16, sfx: 'shoot' },
      xp: 32, gold: [4, 10], r: 0.35, size: 1.05, flying: false,
      pal: { skin: '#e8b4c8', hair: '#5a1030', cloth: '#3a0f2a', glow: '#ff7ab8' },
      horns: true, wings: 'small', tail: true,
      onDeath(e, game) {
        game.particles.hearts(e.x, e.y - 0.8, 8);
        game.dmgNums.add(e.x, e.y, '♡ прощай, красавчик…', 'quip');
      },
      lines: {
        aggro: ['Мужья были. Теперь буду ты.', 'Веером, милый, веером!', 'Овдовела — и сразу к тебе. Судьба.'],
        hit:  ['Вдова злится — вдова мстит!', 'Ты уверен, что хочешь меня разозлить?'],
        die:  ['Опять овдовела…'],
      },
    },
  };

  // ================= БОССЫ (каждый 5-й этаж) =================
  const BOSSES = {
    matron: {
      name: 'Матрона Улья', base: 'webber', hp: 380, dmg: 14, speed: 1.55, size: 1.9, r: 0.66,
      xp: 220, gold: [40, 70], crown: true, theme: 'hive',
      patterns: ['summon', 'webnova', 'slam'],
      intro: ['Хозяин гнезда — я. Гостям у нас либо рады, либо завёрнуты.', 'Плети паутину — она у меня липкая от слухов.'],
      outro: ['Гнездо… пустеет… бери с собой хоть воспоминание…', 'Ты распутал весь мой узор… подмигнув?!'],
    },
    inferna: {
      name: 'Княгиня Инферно', base: 'ember', hp: 420, dmg: 16, speed: 1.9, size: 1.95, r: 0.68,
      xp: 260, gold: [50, 85], crown: true, theme: 'hell',
      patterns: ['firering', 'dash', 'summon'],
      intro: ['Добро пожаловать в огонь. Дрессировка плаща — за отдельные деньги.', 'Горячее меня только моё пламя. И то не факт.'],
      outro: ['Гасну… но в твоей памяти буду тлеть вечно…', 'Дым… красивый… в цвет твоего плаща…'],
    },
    frostq: {
      name: 'Королева Стужи', base: 'frost', hp: 400, dmg: 15, speed: 1.8, size: 1.9, r: 0.66,
      xp: 250, gold: [45, 80], crown: true, theme: 'ice',
      patterns: ['novaring', 'blink', 'summon'],
        intro: ['Дрожи! Хотя бы из вежливости.', 'Моё сердце — лёд. Сдаются немногие. Пробуй.'],
      outro: ['Растаяла… по собственной глупой нежности…', 'Тёплые руки… кто ж тебя так обнимал…'],
    },
    librarian: {
      name: 'Библиотекарь Лилит', base: 'marble', hp: 460, dmg: 15, speed: 1.5, size: 1.9, r: 0.68,
      xp: 280, gold: [55, 90], crown: true, theme: 'library',
      patterns: ['homing', 'silence', 'novaring'],
      intro: ['В читальном зале — тишина. Нарушителей заворачиваем. В чём есть.', 'Я знаю тысячу поз… аций для чтения. Присядь.'],
      outro: ['Возвращай… переплёт… ох…', 'Дочитаешь за меня главу про нас?..'],
    },
    abyssia: {
      name: 'Владычица Глубин', base: 'hunter', hp: 520, dmg: 18, speed: 2.1, size: 2.0, r: 0.7,
      xp: 340, gold: [70, 110], crown: true, theme: null, // любая тема
      patterns: ['firering', 'blink', 'summon', 'slam'],
      intro: ['Чем глубже — тем я честнее. Ты не понравишься правде.', 'Все мои глубины ты не пройдёшь. Но попробуй, милый.'],
      outro: ['Глубина… встретила равного…', 'Приятно… умереть от хлыста джентльмена…'],
    },
  };

  // порядок боссов по кругу; каждый 5-й по счёту (глубина 25, 50, …) — Владычица Глубин
  const BOSS_ORDER = ['matron', 'inferna', 'frostq', 'librarian'];
  function bossForDepth(depth) {
    const k = Math.floor(depth / 5); // номер босса: 1, 2, 3…
    if (k % 5 === 0) return 'abyssia';
    return BOSS_ORDER[(k - 1) % BOSS_ORDER.length];
  }

  // пул мобов темы: [тип, вес]
  const THEME_POOLS = {
    crypt:   [['imp', 5], ['hunter', 3], ['lamia', 2], ['marble', 1]],
    hell:    [['imp', 3], ['ember', 4], ['hunter', 3], ['marble', 1], ['widow', 2]],
    ice:     [['frost', 4], ['hunter', 3], ['harpy', 2], ['imp', 2]],
    hive:    [['webber', 4], ['imp', 4], ['lamia', 2], ['harpy', 2]],
    library: [['lamia', 3], ['webber', 2], ['hunter', 3], ['marble', 2], ['frost', 1], ['widow', 2]],
  };

  // ================= ПРОГРЕССИЯ ДО 100 УРОВНЯ =================
  // Кривая опыта откалибрована (tools/calibrate-xp.mjs): при оптимальной игре
  // (глубина ~1.4×уровня, без пробок) сумма времени 1→100 уровень ≈ 1000 часов.
  // xpNext(L) = XP_A * L^XP_P * XP_G^L
  const MAX_LEVEL = 100;
  const XP_A = 9.63, XP_P = 2.2, XP_G = 1.04;
  // «усталость»: на глубине заметно меньше 0.8×уровня опыт режется —
  // качаться на мелководье нельзя, глубина обязана расти вместе с уровнем
  const xpFatigue = (depth, level) =>
    Math.pow(K.clamp(depth / (0.8 * level), 0.15, 1), 1.5);
  // сложность от уровня игрока: чем выше — тем толще и злее нечисть
  const lvlHpMul = level => 1 + 0.035 * (level - 1);
  const lvlDmgMul = level => 1 + 0.02 * (level - 1);
  const threat = (depth, level) =>
    Math.round((1 + 0.24 * (depth - 1)) * lvlHpMul(level) * 10);

  // ================= ДЕРЕВО НАВЫКОВ =================
  // 4 ветки × 5 узлов, ранги [5,5,3,3,5] = 84 очка на всю ветку... на ветку 21,
  // на всё дерево 84. К 100 уровню игрок получает 99 очков — дерево полностью
  // закрывается с запасом, капстоуны (5-е узлы) открываются с 40 уровня.
  const SKILL_TREE = [
    {
      id: 'whip', name: 'Хлыст Праотца',
      nodes: [
        { id: 'thick',  name: 'Толщина греха',  max: 5, reqLvl: 2,  desc: r => 'Удар хлыстом: +' + (r * 15) + '% урона' },
        { id: 'reach',  name: 'Длинный замах',  max: 5, reqLvl: 4,  desc: r => '+' + (r * 12) + '% длина и ширина дуги' },
        { id: 'hard',   name: 'Жёсткость',      max: 3, reqLvl: 8,  desc: r => '+' + (r * 5) + '% шанса крита' },
        { id: 'weave',  name: 'Плетение',       max: 3, reqLvl: 14, desc: r => 'Третий удар серии: дуга +' + (r * 60) + '°' + (r >= 3 ? ' (круговой)' : '') },
        { id: 'awaken', name: 'Пробуждение Хлыста', max: 5, reqLvl: 40, desc: r => 'Крит. урон +' + (r * 20) + '%, завершитель комбо +' + (r * 8) + '%' },
      ],
    },
    {
      id: 'spin', name: 'Вихрь Совести',
      nodes: [
        { id: 'carou',  name: 'Карусель',       max: 5, reqLvl: 2,  desc: r => 'Вихрь: +' + (r * 20) + '% урона' },
        { id: 'longer', name: 'Подольше',       max: 5, reqLvl: 4,  desc: r => '+' + (r * 0.3).toFixed(1) + ' сек вихря' },
        { id: 'yula',   name: 'Юла-балерина',   max: 3, reqLvl: 8,  desc: r => 'Скорость в вихре +' + (r * 15) + '%' },
        { id: 'wind',   name: 'Порыв',          max: 3, reqLvl: 14, desc: r => 'Вихрь: отброс +' + (r * 60) + '%, замедление +' + (r * 0.4).toFixed(1) + ' сек' },
        { id: 'eternal',name: 'Вечная карусель', max: 5, reqLvl: 40, desc: r => 'Вихрь: мана −' + (r * 8) + '%, радиус +' + (r * 6) + '%, тики чаще на ' + (r * 4) + '%' },
      ],
    },
    {
      id: 'cloak', name: 'Плащ на Голое',
      nodes: [
        { id: 'lining',name: 'Тёплая подкладка',max: 5, reqLvl: 2,  desc: r => '+' + (r * 12) + '% здоровья' },
        { id: 'flap',  name: 'Развевание',      max: 5, reqLvl: 4,  desc: r => 'Откат рывка −' + (r * 15) + '%' },
        { id: 'invis', name: 'Невидимка',       max: 3, reqLvl: 8,  desc: r => 'Неуязвимость рывка +' + (r * 0.12).toFixed(2) + ' сек' },
        { id: 'hems',  name: 'Плотные полы',    max: 5, reqLvl: 14, desc: r => 'Броня +' + (r * 8) + '%' },
        { id: 'second',name: 'Второе дыхание',  max: 3, reqLvl: 40, desc: r => 'Смертельный удар оставляет 1 HP (откат ' + (240 - r * 40) + ' сек)' },
      ],
    },
    {
      id: 'charm', name: 'Харизма Наглеца',
      nodes: [
        { id: 'compl', name: 'Комплимент',      max: 5, reqLvl: 2,  desc: r => 'Радиус флирта +' + r },
        { id: 'confess',name:'Признание',       max: 5, reqLvl: 4,  desc: r => 'Смущение дольше на +' + (r * 0.5).toFixed(1) + ' сек' },
        { id: 'jeal',  name: 'Ревность',         max: 3, reqLvl: 8,  desc: r => 'Смущённые получают +' + (r * 25) + '% урона' },
        { id: 'fan',   name: 'Поклонница',       max: 3, reqLvl: 14, desc: r => 'Поклонница сражается ' + (4 + r * 2) + ' сек, её урон +' + (r * 15) + '%' },
        { id: 'harem', name: 'Гарем',            max: 5, reqLvl: 40, desc: r => 'Флирт захватывает +' + r + ' целей, смущение +' + (r * 15) + '%' },
      ],
    },
  ];

  // ================= ОРУЖИЕ (10 хлыстов) =================
  // dmg/spd/range/arc — множители к базовым ударам; trait — особенность.
  // Заточка: +8% к урону оружия за уровень (до +15), цена растёт.
  // Гнёзда под камни: по редкости оружия (тир 1 — одно … тир 5 — три).
  const WEAPONS = [
    { id: 'rope',     name: 'Верёвка Простака',       tier: 1, dmg: 1.0,  spd: 1.0,  range: 1.0,  arc: 1.0,  color: '#c8a888', trait: null,
      quip: 'Найдена в сарае. Сарая больше нет.' },
    { id: 'leather',  name: 'Кожаный Хлыст Ученика',  tier: 1, dmg: 1.15, spd: 0.95, range: 1.05, arc: 1.0,  color: '#a06a3a', trait: null,
      quip: 'Пахнет уважением к мастеру.' },
    { id: 'fortune',  name: 'Плеть Дамы Удачи',       tier: 2, dmg: 1.2,  spd: 1.0,  range: 1.0,  arc: 1.0,  color: '#f0c060', trait: { type: 'gold', val: 30 },
      quip: 'Выиграна в карты. Карты были краплёные.' },
    { id: 'shepherd', name: 'Кнут Пастыря Грехов',    tier: 2, dmg: 1.3,  spd: 1.05, range: 1.25, arc: 1.15, color: '#8fd0a0', trait: null,
      quip: 'Стадо было нестандартное.' },
    { id: 'axe',      name: 'Секира на Верёвке',      tier: 3, dmg: 1.75, spd: 1.4,  range: 0.9,  arc: 1.25, color: '#b8c4d8', trait: null,
      quip: 'Инженерия палача. Плащ в ужасе.' },
    { id: 'awakened', name: 'Хлыст Праотца Пробуждён', tier: 3, dmg: 1.45, spd: 0.92, range: 1.1,  arc: 1.0,  color: '#e8b4ff', trait: { type: 'crit', val: 12 },
      quip: 'Мозаика дрожит от возбуждения.' },
    { id: 'sting',    name: 'Жало Скорпиона',         tier: 3, dmg: 1.3,  spd: 0.9,  range: 1.0,  arc: 0.9,  color: '#a8e890', trait: { type: 'poison', val: 45 },
      quip: 'Яд действует. Потом.' },
    { id: 'ice',      name: 'Ледяная Плеть Нимфы',    tier: 4, dmg: 1.5,  spd: 0.95, range: 1.05, arc: 1.0,  color: '#a8e6ff', trait: { type: 'slow', val: 1.2 },
      quip: 'Поцелуй — минус сорок по хлысту.' },
    { id: 'inferno',  name: 'Пламенный Кнут Инферно', tier: 4, dmg: 1.65, spd: 1.0,  range: 1.05, arc: 1.1,  color: '#ff9a4b', trait: { type: 'burn', val: 50 },
      quip: 'Горячо. Как её взгляд тогда.' },
    { id: 'abyss',    name: 'Бич Владычицы Глубин',   tier: 5, dmg: 1.9,  spd: 0.9,  range: 1.2,  arc: 1.3,  color: '#c86aff', trait: { type: 'leech', val: 6 },
      quip: 'Трофей. Она обещала вернуться за ним.' },
  ];
  const WEAPON_BY_ID = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
  const SHARP_MAX = 15, SHARP_STEP = 0.08;   // +8% урона оружия за заточку
  const sharpCost = (w, lvl) => Math.round((60 + lvl * 45) * Math.pow(1.28, lvl) * w.tier);
  // тир оружия, доступный на глубине
  const tierForDepth = depth => K.clamp(1 + Math.floor(depth / 5), 1, 5);

  // ================= КАМНИ (гнёзда оружия) =================
  // 6 видов × 5 редкостей; значение = base × множитель редкости
  const GEM_TYPES = [
    { id: 'ruby',     name: 'Рубин',   col: '#ff5a6e', base: 4, affix: 'урона' },
    { id: 'diamond',  name: 'Алмаз',   col: '#d8f4ff', base: 3, affix: 'скорости атаки' },
    { id: 'amethyst', name: 'Аметист', col: '#c86aff', base: 2, affix: 'шанса крита' },
    { id: 'topaz',    name: 'Топаз',   col: '#ffd860', base: 8, affix: 'золота' },
    { id: 'emerald',  name: 'Изумруд', col: '#58d890', base: 2, affix: 'похищения HP' },
    { id: 'sapphire', name: 'Сапфир',  col: '#5a8aff', base: 4, affix: 'дешевле вихрь (мана)' },
  ];
  const GEM_RARITIES = [
    { name: 'Осколок',     mult: 1,   col: '#9aa' },
    { name: 'Огранённый',  mult: 1.8, col: '#7dffb0' },
    { name: 'Чистый',      mult: 2.8, col: '#7aa8ff' },
    { name: 'Безупречный', mult: 4.2, col: '#e29aff' },
    { name: 'Звёздный',    mult: 6,   col: '#ffd860' },
  ];
  const GEM_KEY = { ruby: 'dmgPct', diamond: 'aspd', amethyst: 'critPct', topaz: 'goldPct', emerald: 'leech', sapphire: 'mpCost' };
  function gemInstance(rng, depth) {
    const t = K.choice(rng, GEM_TYPES);
    const d = depth || 1;
    // чем глубже, тем щедрее редкости
    const star = Math.min(8, 0.5 + d * 0.08);
    const flawless = Math.min(16, 2 + d * 0.14);
    const pure = Math.min(26, 8 + d * 0.25);
    const cut = Math.min(42, 24 + d * 0.2);
    const roll = rng() * 100;
    let rar = 0;
    if (roll < star) rar = 4;
    else if (roll < star + flawless) rar = 3;
    else if (roll < star + flawless + pure) rar = 2;
    else if (roll < star + flawless + pure + cut) rar = 1;
    return { type: t.id, rar, uid: Math.floor(rng() * 1e9) };
  }
  function gemValue(gem) {
    const t = GEM_TYPES.find(x => x.id === gem.type);
    return Math.round(t.base * GEM_RARITIES[gem.rar].mult * 10) / 10;
  }
  function gemName(gem) {
    const t = GEM_TYPES.find(x => x.id === gem.type);
    return GEM_RARITIES[gem.rar].name + ' ' + t.name;
  }
  function gemTxt(gem) {
    const t = GEM_TYPES.find(x => x.id === gem.type);
    return '+' + gemValue(gem) + '% ' + t.affix;
  }

  // Реестр особенностей оружия: text(val) для интерфейса,
  // onHit(e, game, val, dmg) применяется при попадании.
  // Оружие может нести trait: {type, val} — или собственную функцию
  // trait(e, game, dmg) прямо в описании (приоритетнее).
  const WEAPON_TRAITS = {
    gold:  { text: v => '+' + v + '% золота' },
    crit:  { text: v => '+' + v + '% крита' },
    leech: { text: v => 'похищает ' + v + '% урона в HP' },
    slow:  { text: v => 'замедление ' + v + ' сек при ударе',
             onHit(e, game, v) { e.slowT = Math.max(e.slowT || 0, v); } },
    poison:{ text: v => 'яд: +' + v + '% урона за 3 сек',
             onHit(e, game, v, dmg) { if (e.poisonT <= 0) { e.poisonT = 3; e.poisonTick = 0.5; e.poisonDps = dmg * v / 100 / 3; } } },
    burn:  { text: v => 'огонь: +' + v + '% урона за 3 сек',
             onHit(e, game, v, dmg) { if (e.burnT <= 0) { e.burnT = 3; e.burnTick = 0.5; e.burnDps = dmg * v / 100 / 3; } } },
  };
  function runWeaponTrait(w, e, game, dmg) {
    const tr = w.trait;
    if (!tr) return;
    if (typeof tr === 'function') { tr(e, game, dmg); return; }
    const reg = WEAPON_TRAITS[tr.type];
    if (reg && reg.onHit) reg.onHit(e, game, tr.val, dmg);
  }

  // дроп оружия: не имеющееся, из верхних доступных тиров
  function weaponDrop(rng, depth, ownedIds) {
    const maxT = tierForDepth(depth);
    let pool = WEAPONS.filter(w => w.tier <= maxT && !ownedIds.includes(w.id));
    if (!pool.length) return null;
    const top = Math.max(...pool.map(w => w.tier));
    const near = pool.filter(w => w.tier >= top - 1);
    return K.choice(rng, near);
  }

  // ================= РЕЛИКВИИ =================
  // слоты: amulet, cloak, ring
  const RELIC_SLOTS = [
    { id: 'amulet', name: 'Ожерелье', glyph: '📿' },
    { id: 'cloak',  name: 'Пряжка плаща', glyph: '🎭' },
    { id: 'ring',   name: 'Перстень', glyph: '💍' },
  ];
  const RARITIES = ['Обычная', 'Редкая', 'Эпическая', 'Легендарная'];
  const RELIC_POOL = [
    { id: 'whip_wax',   name: 'Воск Праотца',       slot: 'amulet', bonus: { dmgPct: 8 },  txt: 'Урон +8%' },
    { id: 'long_night', name: 'Долгая Ночь',        slot: 'amulet', bonus: { dmgPct: 12 }, txt: 'Урон +12%' },
    { id: 'moan_stone', name: 'Камень Стонов',      slot: 'amulet', bonus: { xpPct: 15 },  txt: 'Опыт +15%' },
    { id: 'pink_pearl', name: 'Розовая Жемчужина',  slot: 'cloak',  bonus: { hpPct: 10 },  txt: 'Здоровье +10%' },
    { id: 'velvet',     name: 'Бархат Стыдливости', slot: 'cloak',  bonus: { hpPct: 16 },  txt: 'Здоровье +16%' },
    { id: 'silk_step',  name: 'Шёлковый Шаг',       slot: 'cloak',  bonus: { spdPct: 10 }, txt: 'Скорость +10%' },
    { id: 'quick_silk', name: 'Шёлкость Отвага',    slot: 'cloak',  bonus: { cdPct: 10 },  txt: 'Откат навыков −10%' },
    { id: 'honey_ring', name: 'Перстень с Мёдом',   slot: 'ring',   bonus: { charmPct: 20 },txt: 'Сила флирта +20%' },
    { id: 'gold_lust',  name: 'Жадность Блестящая', slot: 'ring',   bonus: { goldPct: 25 },txt: 'Золото +25%' },
    { id: 'crit_eye',   name: 'Намётанный Глаз',    slot: 'ring',   bonus: { critPct: 6 }, txt: 'Крит +6%' },
    { id: 'thorn_rose', name: 'Роза с Шипами',      slot: 'ring',   bonus: { thorns: 6 },  txt: 'Отражает 6 урона' },
    { id: 'vamp_lip',   name: 'Губы Вампирши',      slot: 'amulet', bonus: { leech: 4 },   txt: 'Похищает 4% урона в HP' },
    { id: 'tear_of_ancestor', name: 'Слеза Праотца', slot: 'amulet', bonus: { dmgPct: 15, hpPct: 10 }, txt: 'Урон +15%, здоровье +10%' },
  ];

  // ================= ЗЕЛЬЯ =================
  // Шесть эликсиров: эффекты игрока см. Player.drinkPotion.
  // Веса дропа растут с глубиной для «боевых» зелий.
  // Эффект зелья — функция apply(p, game) прямо в описании: новое зелье
  // добавляется одной записью, движок знает только протокол (apply + quips).
  const POTIONS = [
    { id: 'heal',   name: 'Зелье «Стыд-трава»',      glyph: '🧪', col: '#58d890', dur: 0,  cd: 2.5,
      desc: 'Исцеляет 45% здоровья',
      quips: ['Горько. Как совесть.', 'Зелёное — значит полезное.'],
      apply(p, game) {
        p.hp = K.clamp(p.hp + p.maxHp * 0.45, 0, p.maxHp);
        AudioSys.sfx('potion');
        game.particles.hearts(p.x, p.y - 0.4, 5);
        game.dmgNums.add(p.x, p.y, p.maxHp * 0.45, 'heal');
      } },
    { id: 'speed',  name: 'Зелье «Заячья Прыть»',    glyph: '🐇', col: '#ffd860', dur: 12, cd: 2,
      desc: '+50% скорости на 12 сек',
      quips: ['Ноги сами несут. Куда-то несут!', 'Уши ещё не выросли, проверял.'],
      apply(p, game) {
        p.fx.speed = this.dur;
        AudioSys.sfx('dash');
        game.particles.burst(p.x, p.y - 0.4, 12, this.col, 80, { type: 'spark' });
      } },
    { id: 'invuln', name: 'Эликсир «Дух Праотца»',   glyph: '✨', col: '#f0f4ff', dur: 4,  cd: 6,
      desc: 'Неуязвимость 4 сек',
      quips: ['Праотец, прикрой!', 'Меня тут нет. Я — плащ.'],
      apply(p, game) {
        p.fx.invuln = this.dur;
        p.iframes = Math.max(p.iframes, this.dur);
        AudioSys.sfx('charm');
        game.particles.burst(p.x, p.y - 0.4, 18, this.col, 100, { type: 'spark' });
      } },
    { id: 'power',  name: 'Зелье «Гнев Суккуба»',    glyph: '💥', col: '#ff5a6e', dur: 15, cd: 2,
      desc: '+50% урона на 15 сек',
      quips: ['Гнев чужой, а бить буду я.', 'Пахнет скандалом. Мне нравится.'],
      apply(p, game) {
        p.fx.power = this.dur;
        AudioSys.sfx('crit');
        game.particles.burst(p.x, p.y - 0.4, 14, this.col, 90, { type: 'spark' });
      } },
    { id: 'fury',   name: 'Настойка «Месть Кокетки»', glyph: '⚡', col: '#ff9e4b', dur: 12, cd: 2,
      desc: '+40% скорости атаки на 12 сек',
      quips: ['Хлыст разогрелся до бешенства.', 'Месть подогрета. Подавай очередь.'],
      apply(p, game) {
        p.fx.fury = this.dur;
        AudioSys.sfx('spinStart');
        game.particles.burst(p.x, p.y - 0.4, 14, this.col, 90, { type: 'spark' });
      } },
    { id: 'mana',   name: 'Слёзы Владычицы',         glyph: '💧', col: '#5a8aff', dur: 8,  cd: 2,
      desc: 'Мана полная, вихрь без затрат маны 8 сек',
      quips: ['Плачь, Владычица. Мне полезно.', 'Солёные. Эффективные.'],
      apply(p, game) {
        p.fx.manafree = this.dur;
        p.mp = p.maxMp;
        AudioSys.sfx('frost');
        game.particles.burst(p.x, p.y - 0.4, 12, this.col, 80, { type: 'spark' });
      } },
  ];
  const POTION_BY_ID = id => POTIONS.find(p => p.id === id) || POTIONS[0];
  // взвешенный ролл типа зелья: лечение чаще, редкие — с глубиной
  function potionDrop(rng, depth) {
    const d = depth || 1;
    const w = {
      heal: 55,
      speed: 13 + Math.min(8, d * 0.3),
      power: 11 + Math.min(9, d * 0.35),
      fury: 8 + Math.min(7, d * 0.3),
      mana: 6 + Math.min(6, d * 0.25),
      invuln: 4 + Math.min(5, d * 0.2),
    };
    let total = 0; for (const k in w) total += w[k];
    let roll = rng() * total;
    for (const k in w) { roll -= w[k]; if (roll <= 0) return k; }
    return 'heal';
  }

  // ================= NPC И КВЕСТЫ =================
  // NPC лагеря: unlock(p) — условие появления (однократно, запоминается).
  const NPCS = {
    veks: { id: 'veks', name: 'Мадам Векс', glyph: '💋', col: '#ff7ab8',
      greet: ['Заходи, красавчик. Товар свежий, сплетни — ещё свежее.',
              'Плащ носи гордо. Остальное — по акции.'] },
    moza: { id: 'moza', name: 'Цензоресса Мозаика', glyph: '▦', col: '#c86aff',
      unlock: p => !!(p.quests && p.quests.done && p.quests.done.q1),
      greet: ['Ты носишь его хлыст. Значит, ты — последняя надежда приличия.',
              'Печать Цензуры трещит. Слышишь этот стон? Это не удовольствие. Это она.'] },
    prao: { id: 'prao', name: 'Призрак Праотца', glyph: '🕯', col: '#9ec2ff',
      unlock: p => p.bestDepth >= 20,
      greet: ['Хмм. Плащ мой. Наглость — тоже моя. Наследник вышел удачный.',
              'Я не смог дойти до дна. Дойдёшь ты — или хотя бы попробуй.'] },
  };

  // Цели квестов (движок в quests.js):
  //   {kind:'kill', target:'hunter'|'any', n}   {kind:'bossKill', n}
  //   {kind:'bossDepth', depth} (босс с глубины ≥)  {kind:'collect', what:'heart'|'gem'|'potion', n}
  //   {kind:'gemRarity', rar, n}  {kind:'weaponTier', tier}  {kind:'depth', depth}
  // Награды: gold, xp, relic(rarity), gems(rarity,n), potions, permDmg.
  const QUESTS = [
    { id: 'q1', npc: 'veks', name: 'Стон из глубин',
      story: ['На пятой глубине кто-то стонет. Не от удовольствия — я разбираюсь.',
              'Сходи, щёлкни по носу ихнего «главного». И слушай внимательно: из тьмы ответит та, кого мы ищем.'],
      goal: [{ kind: 'bossDepth', depth: 5 }],
      reward: { gold: 250 },
      outro: 'Из тьмы пятой глубины тебе ответила Цензоресса Мозаика — голосом, мерцающим как её пиксели. Она ждёт тебя в лагере.',
      next: 'q2' },
    { id: 'q2', npc: 'moza', name: 'Печать Первого Круга',
      story: ['Владычица Глубин раздробила Печать Цензуры на осколки.',
              'Камни из недр держат форму. Принеси мне три любых — я сплету первый круг печати.'],
      goal: [{ kind: 'collect', what: 'gem', n: 3 }],
      reward: { gold: 300, xp: 120 },
      outro: 'Круг сплетён. Мозаика на миг проступила сквозь плащ и подмигнула. Кекс покраснел. Мозаика тоже.',
      next: 'q3' },
    { id: 'q3', npc: 'moza', name: 'Испытание плащом',
      story: ['Печать не признает слабака. Покажи характер: двадцать пять охотниц-суккуб.',
              'Они быстрее всех. И злее всех. Как моя бабушка.'],
      goal: [{ kind: 'kill', target: 'hunter', n: 25 }],
      reward: { gold: 350, relic: 1 },
      outro: 'Печать признала тебя. Где-то в глубинах Владычица сломала ноготь — от ярости.',
      next: 'q4' },
    { id: 'q4', npc: 'moza', name: 'Сердца недовольных',
      story: ['Барьер держится на чувствах. Подходят любые — восторг, обида, влюблённость.',
              'Принеси десять сердец. Они сами к тебе липнут, я видела.'],
      goal: [{ kind: 'collect', what: 'heart', n: 10 }],
      reward: { gold: 300, potions: 2 },
      outro: 'Барьер дышит. Мозаика впервые улыбнулась — мозаично, пиксель к пикселю.',
      next: 'q5' },
    { id: 'q5', npc: 'moza', name: 'Печать Второго Круга',
      story: ['Второй круг требует стали и подвига: оружие не ниже третьего тира',
              'и два повержённых босса. Владычица заметит тебя. Пусть боится.'],
      goal: [{ kind: 'weaponTier', tier: 3 }, { kind: 'bossKill', n: 2 }],
      reward: { gold: 500, gems: [2, 2] },
      outro: 'Второй круг сомкнулся. Теперь Владычица знает твоё имя. И, кажется, сохранила его в дневник.',
      next: 'q6' },
    { id: 'q6', npc: 'moza', name: 'Владычица Глубин',
      story: ['Финал. Двадцать пятая глубина. Она держит меня в жемчужной клетке из стыда.',
              'Разбей её. Освободи меня. И пусть весь мир наконец увидит… как красиво работает цензура.'],
      goal: [{ kind: 'bossDepth', depth: 25 }],
      reward: { gold: 1000, relicUnique: 'tear_of_ancestor' },
      outro: 'Мозаика свободна. Печать Цензуры восстановлена, хлыст Праотца мерцает достойно, а лагерь получил нового — и самого пиксельного — жителя. Титры. Аплодисменты. Глубины бесконечны — а теперь и сюжет тоже: Векс всегда найдёт поручение.',
      final: true },
  ];

  // Поручения Векс — бесконечные, генерируются из шаблонов
  const SIDE_TEMPLATES = [
    { name: () => 'Сводить счёты: ' + DATA.ENEMIES.hunter.name,
      goal: p => [{ kind: 'kill', target: 'hunter', n: 15 }],
      reward: () => ({ gold: 220 }) },
    { name: () => 'Крылышки пощипать: ' + DATA.ENEMIES.harpy.name,
      goal: p => [{ kind: 'kill', target: 'harpy', n: 15 }],
      reward: () => ({ gold: 220 }) },
    { name: () => 'Ядовитый завтрак: ' + DATA.ENEMIES.lamia.name,
      goal: p => [{ kind: 'kill', target: 'lamia', n: 12 }],
      reward: () => ({ gold: 240 }) },
    { name: () => 'Любой ценой',
      goal: p => [{ kind: 'kill', target: 'any', n: 25 }],
      reward: () => ({ gold: 280 }) },
    { name: () => 'Аптечка лагеря',
      goal: p => [{ kind: 'collect', what: 'potion', n: 3 }],
      reward: () => ({ gold: 200, potions: 1 }) },
    { name: () => 'Блестяшки для витрины',
      goal: p => [{ kind: 'collect', what: 'gem', n: 2 }],
      reward: () => ({ gold: 260 }) },
  ];

  // Побочный квест Праотца: звёздный камень за наследие
  const PRAO_QUEST = { id: 'pq1', npc: 'prao', name: 'Звёздный камень',
    story: ['Один камень. Звёздный. Редчайший. Как моя молодость.',
            'Принеси — и я поделюсь тем, что осталось от моей силы. Спойлер: немного. Но твоё.'],
    goal: [{ kind: 'gemRarity', rar: 4, n: 1 }],
    reward: { gold: 800, gems: [3, 2] },
    outro: 'Праотец выдохнул туман, и в твоих руках блеснули два безупречных камня. «Не прощёлкай», — сказал он и растаял до следующего раза.' };


  // ================= ТОРГОВКА =================
  const TRADER = {
    name: 'Мадам Векс',
    quips: [
      'Товар свежий. Как утренние слухи о тебе.',
      'Плащ носи гордо. Остальное — по акции.',
      'Золото тратишь — уважение зарабатываешь.',
      'Купи зелье. Или два. Я не настаиваю… громко.',
      'Скидок нет. Есть только ты и я, милый.',
      'Возвращайся живым. Мёртвые плохо платят.',
    ],
    stock: [
      { id: 'potion',   name: 'Зелье «Стыд-трава»', glyph: '🧪', desc: '+1 лечение в сумку', base: 30,  scale: 1.12, max: null },
      { id: 'potion_speed',  name: 'Зелье «Заячья Прыть»',     glyph: '🐇', desc: '+1 зелье скорости', base: 60,  scale: 1.15, max: null },
      { id: 'potion_power',  name: 'Зелье «Гнев Суккуба»',     glyph: '💥', desc: '+1 зелье урона', base: 95,  scale: 1.15, max: null },
      { id: 'potion_fury',   name: 'Настойка «Месть Кокетки»', glyph: '⚡', desc: '+1 зелье скорости атаки', base: 80, scale: 1.15, max: null },
      { id: 'potion_mana',   name: 'Слёзы Владычицы',          glyph: '💧', desc: '+1 зелье маны', base: 70,  scale: 1.15, max: null },
      { id: 'potion_invuln', name: 'Эликсир «Дух Праотца»',    glyph: '✨', desc: '+1 зелье неуязвимости', base: 150, scale: 1.22, max: null },
      { id: 'perm_hp',  name: 'Корсет Выносливости', glyph: '❤', desc: '+12 макс. HP навсегда', base: 90,  scale: 1.35, max: 20 },
      { id: 'perm_dmg', name: 'Точильный Флирт',    glyph: '⚔', desc: '+1 урон навсегда', base: 110, scale: 1.4,  max: 20 },
      { id: 'relic',    name: 'Кот-в-мешке',        glyph: '🎁', desc: 'Случайная реликвия', base: 240, scale: 1.25, max: null },
      { id: 'gempouch', name: 'Мешочек с камнем',   glyph: '💎', desc: 'Случайный камень (реже с глубиной)', base: 130, scale: 1.15, max: null },
      { id: 'weaponbag',name: 'Хлыст в мешке',      glyph: '➰', desc: 'Случайное оружие по твоей глубине', base: 420, scale: 1.3, max: null },
      // марафон до 100 уровня: золотой сток без предела
      { id: 'perm_pctdmg', name: 'Эликсир Гордости', glyph: '🍷', desc: '+3% урона навсегда', base: 500, scale: 1.16, max: null },
      { id: 'perm_pcthp',  name: 'Настой Стойкости', glyph: '🍶', desc: '+3% здоровья навсегда', base: 450, scale: 1.16, max: null },
    ],
  };

  // ================= ПРОЧЕЕ =================
  const LEVELUP_QUIPS = [
    'Уровень! Плащ стал сидеть лучше.',
    'Опыт пришёл. Вместе с самоуверенностью.',
    'Ещё уровень — и мама узнает, кем я стал.',
    'Расту. Во всех смыслах, скромных в основном.',
  ];
  // реплики на круглые вехи пути к 100
  const MILESTONE_LINES = {
    10:  ['Десятый! Демоницы уже шепчутся о цифре.',
          'Двузначный. Плащу нужна гарантия.'],
    25:  ['Четверть сотни! Глубина это оценит. Иначе быть не может.',
          'Уровень 25. Спускайся смелее — мелководье режет опыт.'],
    50:  ['Полсотни! Ты уже легенда лагеря. Половина легенды — правда.',
          '50! Мадам Векс наливает тебе «по тарифу уважения».'],
    75:  ['75! Дно уверенно отдаляется вниз.',
          'Три четверти пути. Хлыст гудит от гордости.'],
    90:  ['90! Слышно, как Владычицы переворачивают страницы дневников.',
          'Почти сотня. Мозаика цензуры сияет ярче.'],
    100: ['СОТНЯ! Максимум. Легенда. Плащ можно сдавать в музей — но не сдавайся сам.',
          '100 уровень! Дальше — только глубже. Опыт закончился, гордость — нет.'],
  };
  const SHRINE_QUIPS = {
    dmg:   'Алтарь Шёпота: удары стали весомее. Как намёки.',
    spd:   'Алтарь Ветра: ноги быстрее, сердце — тоже.',
    regen: 'Алтарь Тепла: раны затягиваются сами. Мазь не нужна.',
  };
  const DEATH_QUIPS = [
    'Суккубы оттащили тебя к выходу. За плату.',
    'Ты очнулся у костра. Кто-то укрыл тебя плащом. Своим же.',
    '«Восстановлен свежим утром» — так написали в ведомости.',
    'Глубина победила. Но только на этом этаже.',
  ];
  const HERO_HIT_LINES = [
    'Ай! Плащ порвёшь — отвечу!',
    'Дерзко! Мне нравится!',
    'Так и знал, что придут с чёрного хода…',
  ];
  // всплывающие реплики демонесс при ударах (пошлые, но невинные)
  const HIT_QUIPS = [
    'Ой!', 'Ах!', 'Ммм…', '♡ Ещё!', 'Ах ты ж…', 'Наглец!', 'Ох!',
    'Сладко…', '♡ Дерзкий!', 'Ай-ай!', 'Ещё раз!', 'Ошалел?!', '♡', 'Ах-х…',
  ];
  // реплики «финала» — крещендо гибели
  const CLIMAX_QUIPS = [
    '♡ а-а-ах!..', '♡ о-ой всё!..', '♡ сли-и-ишком…', '♡ кончено!..',
    '♡ я та-а-аю…', '♡ бесподобно… умираю…',
  ];

  const RELIC_BONUS_SCALE = [1, 1.6, 2.4, 3.4]; // множитель по редкости

  function relicInstance(rng, forcedSlot, minRarity) {
    let pool = RELIC_POOL;
    if (forcedSlot) pool = pool.filter(r => r.slot === forcedSlot);
    const base = K.choice(rng, pool.length ? pool : RELIC_POOL);
    const maxR = minRarity != null ? minRarity : 0;
    // редкость: чем глубже, тем щедрее (передаётся в minRarity)
    let rar = 0;
    const roll = rng();
    if (roll > 0.94) rar = 3; else if (roll > 0.78) rar = 2; else if (roll > 0.5) rar = 1;
    rar = Math.max(rar, Math.min(maxR, 1));
    return { def: base.id, rarity: rar, uid: Math.floor(rng() * 1e9) };
  }

  return {
    THEMES, ENEMIES, BOSSES, bossForDepth, THEME_POOLS,
    ATTACKS, runAttack, BOSS_PATTERNS, WEAPON_TRAITS, runWeaponTrait,
    MAX_LEVEL, XP_A, XP_P, XP_G, xpFatigue, lvlHpMul, lvlDmgMul, threat,
    POTIONS, POTION_BY_ID, potionDrop,
    NPCS, QUESTS, SIDE_TEMPLATES, PRAO_QUEST,
    ELITE_CHANCE, ELITE_AFFIXES,
    WEAPONS, WEAPON_BY_ID, SHARP_MAX, SHARP_STEP, sharpCost, tierForDepth,
    GEM_TYPES, GEM_RARITIES, GEM_KEY, gemInstance, gemValue, gemName, gemTxt, weaponDrop,
    SKILL_TREE, RELIC_SLOTS, RELIC_POOL, RARITIES, RELIC_BONUS_SCALE,
    TRADER, LEVELUP_QUIPS, MILESTONE_LINES, SHRINE_QUIPS, DEATH_QUIPS, HERO_HIT_LINES, HIT_QUIPS, CLIMAX_QUIPS,
    relicInstance,
  };
})();
