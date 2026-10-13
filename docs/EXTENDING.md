# Расширение KEKS: мобы, предметы, боссы

Игра построена на **данных с хуками**: почти всё новое добавляется одной
записью в `site/js/data.js` — без правки движка (`entities.js`, `main.js`).
Движок знает только протоколы (имена полей и хуков), логика живёт в данных.

Все примеры ниже — рабочий код, копируй и меняй.

---

## 1. Новый моб

Запись в `DATA.ENEMIES` (`data.js`). Обязательны только статы и `attack`;
хуки, `lines` и прочее — по желанию.

```js
DATA.ENEMIES // — просто добавь ключ в объект ENEMIES в data.js:

widow: {
  name: 'Вдова-Соблазнительница',
  hp: 72, dmg: 8, speed: 2.2,        // статы базы (масштаб глубины/уровня — автоматом)
  aggro: 9.5,                        // радиус агрессии в тайлах
  atkRange: 6.4, atkCd: 2.5,         // дальность и откат атаки
  attack: { kind: 'multi', shots: 3, spread: 0.32, v: 4.4,
            col: '#ff7ab8', r: 0.16, sfx: 'shoot' },
  xp: 32, gold: [4, 10],             // награда
  r: 0.35, size: 1.05, flying: false,
  pal: { skin: '#e8b4c8', hair: '#5a1030', cloth: '#3a0f2a', glow: '#ff7ab8' },
  horns: true, wings: 'small', tail: true,   // внешность drawDemon
  onDeath(e, game) {                 // ← хук: своя логика при смерти
    game.particles.hearts(e.x, e.y - 0.8, 8);
  },
  lines: { aggro: ['...'], hit: ['...'], die: ['...'] },
}
```

И добавь моба в пул темы (`THEME_POOLS`), например в ад:

```js
hell: [['imp', 3], ..., ['widow', 2]],
```

### `attack` — строка или объект

- `'melee'` — удар в упор;
- `'lunge'` — выпад (рывок до игрока с уроном при касании);
- `{kind:'proj', v, col, r, sfx, slow, spread, dmgMult, homing}` — снаряд;
- `{kind:'multi', shots, spread, ...}` — веер снарядов.

Свои виды атак — расширь реестр `ATTACKS` в data.js:

```js
ATTACKS.boom(e, game, o) {           // взрыв вокруг себя
  game.projectiles.push(/* ... */);
}
// в мобе: attack: { kind: 'boom', r: 2 }
```

### Хуки моба (все опциональны)

| Хук | Сигнатура | Когда |
|---|---|---|
| `onSpawn` | `(e, game)` | моб вошёл в мир (этаж сгенерирован) |
| `onTick` | `(e, game, dt)` | каждый кадр обновления |
| `onAttack` | `(e, game, dist)` | вместо реестровой атаки (приоритетнее) |
| `onHurt` | `(e, game, dmg)` | моб получил урон |
| `onDeath` | `(e, game)` | смерть (до дропа) |

Через `e` доступны и меняются: `e.x/y`, `e.hp/maxHp`, `e.dmg`, `e.slowT`,
`e.charmT`, `e.poisonT/poisonDps`, `e.burnT/burnDps`, `e.kbX/kbY`,
`e.lungeT/lungeDx/lungeDy`, `e.bubble = {text, t}` (реплика-пузырь).

Что можно из `game`: `game.player`, `game.enemies` (клади новых мобов:
`game.enemies.push(new Entities.Enemy('imp', x, y, depth, player.level))`),
`game.projectiles`, `game.particles` (`burst`, `hearts`, `spawn`),
`game.dmgNums.add(x, y, 'текст', 'quip')`, `game.playerHurt(...)`,
`game.shake(сила)`, `UI.toast/баннеры`.

---

## 1½. Элитки: диабловские аффиксы

С шансом `ELITE_CHANCE` (12%, с глубины 2) любой моб становится элиткой:
аура цвета, ★ над головой, золотая полоска HP, ×2.2 HP / ×2.5 награда.
Аффикс — запись в реестре `ELITE_AFFIXES`:

```js
{ id: 'frosty', name: 'Стылая', col: '#a8e6ff',
  apply(e) { e.dmg *= 1.2; },               // одноразово при создании элитки
  tick(e, game, dt) { /* каждый кадр: ауры, зоны, что угодно */ } },
```

Движок дополнительно читает особые id (без кода в аффиксе):
`sticky` — её удары замедляют игрока, `vamp` — лечится, попадая по нему,
`glass` — держит ×1.5 урона. Пример: `{ id: 'vamp', name: 'Кровожадная', col: '#ff5a6e' }`.

Создать элитку вручную: `e.makeElite(rng)` (в тестах/событиях).

---

## 2. Новый босс

Запись в `BOSSES` + паттерны. Босс = моб `base` (внешность/реплики берутся
оттуда), переопределённые статы и `patterns` — список шагов, вызываемых
по таймеру (в ярости — в 1.5 раза чаще).

```js
duchess: {
  name: 'Герцогиня Румянца', base: 'widow',
  hp: 500, dmg: 17, speed: 1.7, size: 1.9, r: 0.68,
  xp: 300, gold: [60, 100], crown: true, theme: 'crypt',
  patterns: [
    'summon',                              // строка — паттерн из реестра
    ['novaring', { n: 14, dmgMult: 1 }],   // с параметрами
    ['dash', { reps: 3, gap: 500 }],
    (b, game) => {                         // своя функция — что угодно
      game.shake(6);
      b.teleT = 0.8; b.teleR = 3; b.teleX = game.player.x; b.teleY = game.player.y;
    },
  ],
  intro: ['...'], outro: ['...'],
}
```

В ротацию: `BOSS_ORDER` (`['matron', ...]`) или логика `bossForDepth()`.

Готовые паттерны реестра `BOSS_PATTERNS`: `summon {n, type}`, `webnova`,
`novaring`, `firering {n, dmgMult}`, `slam {r, windup}`, `dash {reps, gap}`,
`blink {dist, shots}`, `homing {n, power}`, `silence {lock}`. Новые — просто
новый ключ в `BOSS_PATTERNS` с функцией `(b, game, params)`.

---

## 3. Новое оружие

Запись в `WEAPONS`. Множители `dmg/spd/range/arc` — к базовым ударам,
`trait` — особенность: из реестра или собственная функция.

```js
miracle: {
  id: 'miracle', name: 'Хлыст Чуда', tier: 4,
  dmg: 1.55, spd: 0.95, range: 1.1, arc: 1.05, color: '#7dffb0',
  quip: 'Чудо — когда мозаика вздыхает.',
  // трейт из реестра (яд/огонь/замедление/крит/золото/вампиризм):
  trait: { type: 'poison', val: 60 },
  // или своя логика при каждом попадании:
  // trait(e, game, dmg) { game.dmgNums.add(e.x, e.y, '♡ чудо!', 'quip'); },
}
```

Новый вид особенности — ключ в реестре `WEAPON_TRAITS`:
`{ text: v => 'описание', onHit(e, game, v, dmg) { ... } }`.
Гнёзда зависят от `tier` (1–1, 2–1, 3–2, 4–2, 5–3), заточка и камни —
автоматически. Оружие попадёт в дроп-пул `weaponDrop()` само (по тиру
и глубине) и в «Хлыст в мешке» торговки.

---

## 4. Новое зелье

Одна запись в `POTIONS` — эффект целиком в `apply`:

```js
giant: {
  id: 'giant', name: 'Настой Великана', glyph: '🦶', col: '#c0a0ff',
  dur: 20, cd: 4,
  desc: 'Размер — не главное. Главное — размер!',
  quips: ['Кажется, я стал больше. Везде.'],
  apply(p, game) {
    p.fx.giant = this.dur;                       // таймер исчезнет сам
    game.particles.burst(p.x, p.y - 0.4, 16, this.col, 90);
    UI.toast('Плащ натянулся героически', '');
  },
}
```

Осталось применить множитель в нужном геттере `Player` (`baseDmg`,
`moveSpeed`, `attackSpdMult`, `critChance`, `maxHp`…) — например
`if (this.fx.giant > 0) d *= 1.3;`. Панель зелий, горячая клавиша,
дроп (`potionDrop`), торговка и сейв подхватят новое зелье по списку
`POTIONS` автоматически.

## 4½. Квесты и NPC

NPC — запись в `NPCS` (портрет-глиф, реплики `greet`, `unlock(p)` —
условие появления, запоминается однократно). Квест — запись в `QUESTS`
(или шаблон в `SIDE_TEMPLATES` для бесконечных поручений):

```js
{ id: 'q7', npc: 'moza', name: 'Новая глава',
  story: ['реплика 1', 'реплика 2'],
  goal: [{ kind: 'kill', target: 'widow', n: 10 }, { kind: 'collect', what: 'gem', n: 2 }],
  reward: { gold: 400, relic: 2 },
  outro: 'финальная реплика при сдаче', next: null }
```

Виды целей: `kill target|any`, `bossKill n`, `bossDepth depth`,
`collect heart|gem|potion|relic`, `gemRarity rar`, `weaponTier tier`,
`depth`. Движок (`js/quests.js`) сам считает прогресс по хукам игры
(убийства, подборы, боссы, глубина) — новых видов целей достаточно
добавить в объект `OBJ` (текст + условие завершения).

---

## 4⅔. Монетизация: rewarded-слоты и билеты

Все точки заработка живут в `site/js/ads.js` (`AdSys`). Новый rewarded-слот:

```js
AdSys.showRewarded('my_placement', () => { /* выдать награду */ });
```

Движок сам решает: билет пропуска (>0 у игрока) — мгновенная награда без
просмотра; иначе демо-оверлей 5 сек → кнопка «Забрать награду». Межстраничная:
`AdSys.maybeInterstitial(game)` — вернёт true, если показала (кулдаун 150 сек).
Билеты: `player.adTickets`, +1 за босса (`AdSys.grantBossTicket`). Продажу
билетов через Billing вешать на кнопку рядом с `UI.veksAdPotion`.

---

## 5. Камни, реликвии, темы

- **Камень**: вид в `GEM_TYPES` (`base` — процент при редкости ×1) +
  ключ эффекта в `GEM_KEY` + применение в геттере `gemBonus(ключ)` игрока.
  Редкости — массив `GEM_RARITIES` (можно добавить шестую).
- **Реликвия**: запись в `RELIC_POOL` (`bonus: {ключ: число}`) + чтение
  в `relicBonus(ключ)` там же, где нужен эффект.
- **Тема данжа**: запись в `THEMES` (палитра, `gen: 'rooms'|'cave'|'cross'`
  (+ катакомбный лабиринт для крипта),
  пропсы, частицы, `unlock`-глубина) + пул мобов `THEME_POOLS[id]`.
  Новые планировщики — функция в `dungeon.js` и ключ в `gen`.

---

## 6. Протоколы движка (шпаргалка)

| Что | Протокол |
|---|---|
| Атака моба | `ATTACKS[kind](e, game, params)` или `def.onAttack` |
| Паттерн босса | `BOSS_PATTERNS[name](b, game, params)` / `['name', params]` / `fn(b, game)` |
| Трейт оружия | `WEAPON_TRAITS[type].onHit(e, game, val, dmg)` / `trait(e, game, dmg)` |
| Зелье | `def.apply(p, game)`; счётчик/кд/анимация — автоматом |
| Хуки моба | `onSpawn / onTick / onAttack / onHurt / onDeath` |
| Частицы | `game.particles.spawn({x,y,vx,vy,life,size,col,type:'dot'|'spark'|'heart'|'mosaic',grav})` |
| Реплика-вспышка | `game.dmgNums.add(x, y, 'текст', 'quip')` |
| Звук | `AudioSys.sfx('имя')` — синтезаторы в `audio.js`, SFX-таблица расширяется одной строкой |

После правок `site/`: `./tools/build-apk.sh` — и новый APK готов.
