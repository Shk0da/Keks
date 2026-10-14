// main.js — игровой цикл, камера, рендер мира, освещение, состояния игры.
'use strict';
window.game = null;
(function () {

  const $ = id => document.getElementById(id);
  const canvas = $('c');
  const ctx = canvas.getContext('2d');

  let cw = 0, ch = 0, dpr = 1, zoom = 1;
  let lightCv = null, lightG = null;

  // ===================== Игра =====================
  const G = {
    state: 'boot',       // title | camp | dungeon | descend | dead
    paused: false,
    player: null,
    level: null,
    enemies: [], projectiles: [], pickups: [],
    particles: null, dmgNums: null,
    camX: 0, camY: 0,
    shakeV: 0, hitstopT: 0,
    doorOpen: 0, transitionT: 0,
    flowT: 0, fovT: 0, lastTile: null,
    exitPortal: null, bossDead: false, floorKills: 0,
    menuWhip: null, menuParts: [],
    pendingNew: false,
    rng: Math.random,

    // ===================== запуск =====================
    init() {
      this.particles = new Entities.Particles();
      this.dmgNums = new Entities.DamageNumbers();
      this.menuWhip = Sprites.makeWhip();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      UI.init(this);
      this.initInput();
      this.initDoubleTap();

      // фон меню — угольки
      for (let i = 0; i < 40; i++) this.menuParts.push({
        x: Math.random(), y: Math.random(), s: 0.2 + Math.random() * 0.8,
        ph: Math.random() * 9,
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'dungeon' && !this.paused) this.togglePause();
        if (document.hidden) SaveSys.save(this);
      });

      this.toTitle();
      requestAnimationFrame(ts => this.loop(ts));
    },

    resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = window.innerWidth; ch = window.innerHeight;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      zoom = K.clamp(ch / 440, 0.85, 1.5);
      lightCv = document.createElement('canvas');
      lightCv.width = cw; lightCv.height = ch;
      lightG = lightCv.getContext('2d');
    },

    // ===================== ввод (клавиатура; тач — в UI) =====================
    keys: {},
    initInput() {
      window.addEventListener('keydown', e => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.keys[e.code] = true;
        AudioSys.ensure();
        if (this.state === 'campScene' && !this.paused) {
          if (e.code === 'KeyJ' || e.code === 'Space' || e.code === 'KeyE') this.interact();
          else if (e.code === 'Escape') this.togglePause();
          return;
        }
        if (this.state !== 'dungeon' || this.paused) {
          if (e.code === 'Escape' && this.paused) this.togglePause();
          return;
        }
        const p = this.player;
        if (e.code === 'KeyJ' || e.code === 'Space') p.tryAttack(this);
        else if (e.code === 'KeyK') p.trySpin(this);
        else if (e.code === 'KeyB') p.trySpatter(this);
        else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') p.tryDash(this);
        else if (e.code === 'KeyC') p.tryCharm(this);
        else if (e.code === 'KeyQ') p.tryPotion(this, 'heal');
        else if (e.code === 'KeyI') UI.openArmoryQuick();
        else if (/^Digit[1-6]$/.test(e.code)) {
          const pt = DATA.POTIONS[+e.code.slice(5) - 1];
          if (pt) p.tryPotion(this, pt.id);
        }
        else if (e.code === 'Escape') this.togglePause();
      });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    },
    moveInput() {
      const st = UI.move();
      let x = st.dx || 0, y = st.dy || 0;
      const k = this.keys;
      if (k.KeyW || k.ArrowUp) y -= 1;
      if (k.KeyS || k.ArrowDown) y += 1;
      if (k.KeyA || k.ArrowLeft) x -= 1;
      if (k.KeyD || k.ArrowRight) x += 1;
      return { x, y };
    },

    // ===================== состояния =====================
    // одиночный тап по правой части экрана — удар хлыстом в направлении тапа
    initDoubleTap() {
      const cv = document.getElementById('c');
      cv.addEventListener('touchend', (e) => {
        if (this.state !== 'dungeon' || this.paused || !this.player) return;
        const t = e.changedTouches[0];
        const px = t.clientX, py = t.clientY;
        // только правая 60% экрана (левые 40% — джойстик)
        if (px < cw * 0.40) return;
        // не тапать по боевым кнопкам
        const el = document.elementFromPoint(px, py);
        if (el && el.closest && el.closest('.abtn, .pbtn')) return;
        const p = this.player;
        if (p.attackCd > 0 || p.spinT > 0) return;
        // перевести экран в мировые координаты
        const wx = (px - cw / 2) / zoom + this.camX;
        const wy = (py - ch / 2) / zoom + this.camY;
        const ang = Math.atan2(wy - K.isoY(p.x - 0.5, p.y - 0.5), wx - K.isoX(p.x - 0.5, p.y - 0.5));
        p.facing = Math.atan2(
          (Math.sin(ang) + Math.cos(ang)),
          (Math.cos(ang) - Math.sin(ang))
        );
        p.tryAttack(this);
      }, { passive: true });
    },

    toTitle(wiped) {
      this.state = 'title';
      this.paused = false;
      UI.show('title');
      AudioSys.setMusic('title');
    },
    newGame() {
      this.player = new Entities.Player({});
      this.player.hp = this.player.maxHp;
      this.player.mp = this.player.maxMp;
      this.toCamp();
      UI.dialogue('Кекс', 'Плащ надет. Совесть оставлена у входа. Пошли.');
    },
    continueGame() {
      const s = SaveSys.load();
      if (!s) { this.newGame(); return; }
      this.player = new Entities.Player(s);
      if (this.player.hp == null) { this.player.hp = this.player.maxHp; this.player.mp = this.player.maxMp; }
      this.toCamp();
      this.factoryOffline();
    },
    toCamp() {
      // лагерь — живая комната: уровень без врагов, NPC и постройки на местах
      this.state = 'campScene';
      this.paused = false;
      this.level = CampScene.build();
      Sprites.prepare(this.level.theme);
      const p = this.player;
      p.x = this.level.entry.x; p.y = this.level.entry.y;
      p.moving = false; p.strikeT = 0; p.spinT = 0; p.dashT = 0; p.drinkT = 0;
      p.hp = Math.max(p.hp, p.maxHp * 0.35);          // лагерь чуть подлечивает
      this.enemies = []; this.projectiles = []; this.pickups = [];
      this.particles.list.length = 0;
      this.exitPortal = null; this.bossDead = false;
      this.campFocus = null;
      this.camX = K.isoX(p.x, p.y); this.camY = K.isoY(p.x, p.y);
      AudioSys.setMusic('camp');
      UI.hideAll();          // титул/18+/смерть не должны висеть над сценой
      UI.campMode(true);
      SaveSys.save(this);
    },
    // взаимодействие в лагере: NPC/постройки/врата
    interact() {
      const f = this.campFocus;
      if (!f) { UI.toast('Подойди ближе к жителю или постройке', ''); return; }
      AudioSys.sfx('ui');
      switch (f.kind) {
        case 'npc': UI.openNpc(f.id); break;
        case 'skills': UI.show('skills'); break;
        case 'armory': UI.show('armory'); break;
        case 'relics': UI.show('relics'); break;
        case 'board': UI.show('camp'); break;
        case 'factory': UI.show('factory'); break;
        case 'gate': UI.show('gate'); break;
      }
    },
    togglePause() {
      if (this.state !== 'dungeon' && this.state !== 'campScene') return;
      this.paused = !this.paused;
      UI.show(this.paused ? 'pause' : null);
      if (!this.paused) SaveSys.save(this);
    },
    surrender() {
      if (this.state === 'campScene') { this.togglePause(); return; }  // в лагере «сдаться» = продолжить
      // сдаться в паузе: как смерть, без смертной реплики
      this.player.gold = Math.floor(this.player.gold * 0.85);
      this.paused = false;
      this.toCamp();
      UI.toast('Отступление. Демоницы машут вслед', '');
    },
    playerDeath() {
      if (this.state === 'dead') return;
      this.state = 'dead';
      AudioSys.sfx('death');
      this.player.gold = Math.floor(this.player.gold * 0.8);
      this.particles.hearts(this.player.x, this.player.y - 0.6, 10);
      UI.show('dead');
      $('deadQuip').textContent = K.choice(Math.random, DATA.DEATH_QUIPS);
      $('deadStats').innerHTML = 'Глубина: <b>' + this.level.depth + '</b> · рекорд: <b>' +
        this.player.bestDepth + '</b> · повержено всего: <b>' + this.player.kills + '</b><br>' +
        '<span class="dim">Выкуп за спасение: −20% золота. Прогресс и глубина сохранены.</span>';
      SaveSys.save(this);
    },
    afterDeath() { this.toCamp(); },

    // ===================== этаж =====================
    enterFloor(depth) {
      const seed = (Date.now() & 0xffff) ^ (depth * 7919) ^ ((this.player.kills * 31) & 0xffff);
      this.rng = K.mulberry32(seed);
      this.level = Dungeon.generate(depth, this.rng);
      Sprites.prepare(this.level.theme);

      this.enemies = []; this.projectiles = []; this.pickups = [];
      this.particles.list.length = 0;
      this.exitPortal = null; this.bossDead = false; this.floorKills = 0;

      const p = this.player;
      p.x = this.level.entry.x; p.y = this.level.entry.y;
      p.hp = p.hp != null ? Math.min(p.hp, p.maxHp) : p.maxHp;
      if (p.hp < p.maxHp * 0.3) p.hp = Math.round(p.maxHp * 0.5); // милость входа
      p.vx = p.vy = 0;
      p.spinT = 0;

      for (const s of this.level.spawns) {
        if (s.type.startsWith('boss:')) {
          this.enemies.push(new Entities.Boss(s.type.slice(5), s.x, s.y, depth, p.level));
        } else {
          this.enemies.push(new Entities.Enemy(s.type, s.x, s.y, depth, p.level));
        }
      }
      // хук появления: своя логика при входе моба в мир
      for (const e of this.enemies) if (e.def.onSpawn) e.def.onSpawn(e, this);
      // динамика: элитки с диабловскими аффиксами
      if (!this.level.isBoss && depth >= 2) {
        for (const e of this.enemies) {
          if (!(e instanceof Entities.Boss) && this.rng() < DATA.ELITE_CHANCE) e.makeElite(this.rng);
        }
      }
      // динамика: темп этажа — пар-время, случайное «Вторжение»
      const lvl = this.level;
      lvl.startTime = p.playtime;
      lvl.parTime = K.clamp(40 + lvl.spawns.length * 4, 60, 260);
      lvl.invaded = false;
      lvl.invadeAt = (depth > 1 && this.rng() < 0.25) ? 30 + this.rng() * 40 : null;

      this.state = 'dungeon';
      this.paused = false;
      this.doorOpen = 0;
      this._fatWarned = false;
      if (window.QuestSys) QuestSys.onDepth(p, depth);
      // карточка входа на этаж (диабловское затемнение с названием)
      this.transitionT = 1.15;
      UI.floorCard(depth);
      UI.show(null);
      AudioSys.setMusic(this.level.theme.mus);
      UI.dialogue('Кекс', this.level.isBoss
        ? 'Тут пахнет духами и злобой. Босс рядом.'
        : this.level.theme.quip + ' Глубина ' + depth + '.');
      if (!this.level.isBoss && depth > p.bestDepth) p.bestDepth = depth;

      // камера и туман
      this.camX = K.isoX(p.x, p.y); this.camY = K.isoY(p.x, p.y);
      Dungeon.updateFOV(this.level, p.x, p.y, 8);
      Dungeon.updateFlow(this.level, p.x, p.y);
      this.lastTile = (p.x | 0) + ',' + (p.y | 0);
      UI.updateHUD(p);
      SaveSys.save(this);
    },
    descend() {
      this.player.depth++;
      this.enterFloor(this.player.depth);
    },

    // ===================== бой =====================
    nearestEnemy(x, y, r, exclude) {
      let best = null, bd = r;
      for (const e of this.enemies) {
        if (e.dead || e === exclude) continue;
        const d = K.dist(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },
    losToPlayer(e) {
      const p = this.player;
      return Dungeon.updateFOV && this.tileVis(e.x, e.y) === 2 ||
        K.dist(e.x, e.y, p.x, p.y) < 3;
    },
    tileVis(x, y) {
      const lvl = this.level;
      const tx = K.clamp(x | 0, 0, lvl.w - 1), ty = K.clamp(y | 0, 0, lvl.h - 1);
      return lvl.vis[(ty * lvl.w + tx)];
    },
    flowStep(x, y) {
      const lvl = this.level, f = lvl.flow;
      let bx = 0, by = 0, best = f[(K.clamp(y | 0, 0, lvl.h - 1) * lvl.w + K.clamp(x | 0, 0, lvl.w - 1))];
      if (best < 0) return [0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = (x | 0) + dx, ny = (y | 0) + dy;
        if (nx < 0 || ny < 0 || nx >= lvl.w || ny >= lvl.h) continue;
        const v = f[ny * lvl.w + nx];
        if (v >= 0 && v < best) { best = v; bx = dx; by = dy; }
      }
      if (!bx && !by) { // уже ближе всех — прямо к игроку
        const p = this.player;
        const d = K.dist(x, y, p.x, p.y) || 1;
        return [(p.x - x) / d, (p.y - y) / d];
      }
      const n = Math.hypot(bx, by) || 1;
      return [bx / n, by / n];
    },

    hitEnemy(e, mult, opts) {
      const p = this.player;
      let dmg = p.baseDmg * mult;
      const crit = Math.random() < p.critChance;
      if (crit) dmg *= p.critDmg;
      if (p.combo === 3 && !opts.noCombo) dmg *= p.comboFinisher;
      e.hurt(dmg, this, null);
      this.dmgNums.add(e.x, e.y, dmg, crit ? 'crit' : 'dmg');
      this.particles.burst(e.x, e.y - 0.4, crit ? 12 : 6, '#ffd8ec', crit ? 100 : 60, { type: 'spark' });
      // пошлость от души: реплика-вспышка и сердечко-синяк
      if (Math.random() < 0.22)
        this.dmgNums.add(e.x, e.y - 0.3, K.choice(Math.random, DATA.HIT_QUIPS), 'quip');
      if (Math.random() < 0.45)
        this.particles.spawn({
          x: e.x + (Math.random() - 0.5) * 0.3, y: e.y - 0.7,
          vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 40,
          life: 0.7, size: 3.5 + Math.random() * 3, col: '#ff6a9e',
          type: 'heart', grav: -20,
        });
      // вампиризм (реликвии + изумруды + оружие)
      const leech = p.leechPct;
      if (leech > 0 && p.hp < p.maxHp) {
        const heal = dmg * leech / 100;
        p.hp = K.clamp(p.hp + heal, 0, p.maxHp);
      }
      if (crit) { this.hitstopT = 0.09; this.shake(3); AudioSys.sfx('crit'); }
      else AudioSys.sfx('whipHit');
      return dmg;
    },

    playerStrike(combo) {
      const p = this.player, w = p.weapon;
      const reachS = (1 + 0.12 * p.skill('reach')) * w.range;
      const range = 2.1 * reachS;
      let arc = (1.9 + 0.1 * p.skill('reach')) * w.arc;
      if (combo === 3 && p.skill('weave')) arc = Math.min(Math.PI * 2, arc + 1.05 * p.skill('weave'));
      let dmgMult = 1 * (p.hasSkill('thick') ? 1 + 0.15 * p.skill('thick') : 1);
      let hitAny = false;
      let nearestHit = null, nearestD = 1e9;
      // мозаика «выплёвывает» хлыст: искры заряда у бёдер
      for (let i = 0; i < 4; i++) {
        const a = p.facing + (Math.random() - 0.5) * 1.2;
        this.particles.spawn({
          x: p.x, y: p.y - 0.5,
          vx: Math.cos(a) * 90 + (Math.random() - 0.5) * 30,
          vy: Math.sin(a) * 45 - 25,
          life: 0.3 + Math.random() * 0.2, size: 2.5,
          col: Math.random() < 0.5 ? '#ffd8ec' : p.weapon.color, type: 'spark',
        });
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = K.dist(p.x, p.y, e.x, e.y);
        if (d > range + e.r) continue;
        const a = K.angTo(p.x, p.y, e.x, e.y);
        if (Math.abs(K.angDiff(p.facing, a)) > arc / 2) continue;
        this.hitEnemy(e, dmgMult);
        // лёгкий толчок живым (убитые и так гасят инерцию в die());
        // скольжение ослаблено вчетверо — мобы умирают там, где стояли
        if (!e.dead) {
          const kb = 1.2;
          e.kbX = Math.cos(a) * kb * 40; e.kbY = Math.sin(a) * kb * 40;
        }
        hitAny = true;
        if (d < nearestD) { nearestD = d; nearestHit = e; }
      }
      // цель выхлёста: ближайший поражённый моб — хлыст летит точно в лицо
      p.strikeTarget = nearestHit
        ? { x: nearestHit.x, y: nearestHit.y, size: nearestHit.size || 1 }
        : null;
      if (hitAny) this.shake(2);
      // визуальная дуга удара
      this.strikeFx = { t: 0.18, max: 0.18, ang: p.facing, arc, range };
    },
    playerSpinTick() {
      const p = this.player;
      const mult = 0.38 * (1 + 0.2 * p.skill('carou'));
      const R = p.spinRadius;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = K.dist(p.x, p.y, e.x, e.y);
        if (d > R + e.r) continue;
        this.hitEnemy(e, mult, { noCombo: true });
        if (p.skill('wind') && !e.dead) {
          const a = K.angTo(p.x, p.y, e.x, e.y);
          const kb = Math.min(120, 90 + 15 * p.skill('wind'));
          e.kbX = Math.cos(a) * kb; e.kbY = Math.sin(a) * kb;
          e.slowT = 1.4 + 0.4 * p.skill('wind');
        }
      }
      // мозаичные искры цензуры + сердечко по орбите вихря
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.spawn({
          x: p.x + Math.cos(a) * 0.8, y: p.y + Math.sin(a) * 0.8 - 0.4,
          vx: Math.cos(a) * 60, vy: -30, life: 0.5, size: 5,
          col: 'rgba(216,140,180,.6)', type: 'mosaic',
        });
      }
      const wa = p.whip.armAngle;
      this.particles.spawn({
        x: p.x + Math.cos(wa) * 0.9, y: p.y + Math.sin(wa) * 0.9 - 0.35,
        vx: -Math.sin(wa) * 95, vy: Math.cos(wa) * 45 - 18,
        life: 0.5, size: 4, col: '#ff9ecf', type: 'heart', grav: -10,
      });
    },
    playerCharm() {
      const p = this.player;
      const R = 2.7 + p.skill('compl') + p.stats.cha * 0.03;
      const dur = (1.7 + 0.5 * p.skill('confess') + p.stats.cha * 0.02) * (1 + 0.15 * p.skill('harem'));
      // цели: ближайшие, не более charmTargets (гарем расширяет свиту)
      const inR = this.enemies
        .filter(e => !e.dead && e.charmT <= 0 && K.dist(p.x, p.y, e.x, e.y) <= R)
        .sort((a, b) => K.dist(p.x, p.y, a.x, a.y) - K.dist(p.x, p.y, b.x, b.y));
      let charmed = 0;
      for (const e of inR) {
        if (charmed >= p.charmTargets) break;
        e.charmT = dur * (e instanceof Entities.Boss ? 0.35 : 1);
        if (p.skill('fan') > 0 && charmed === 0) e.fanT = 4 + 2 * p.skill('fan');
        this.particles.hearts(e.x, e.y - 0.6, 4);
        // воздушный поцелуй: сердечко летит от героя к цели
        const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy) || 1;
        this.particles.spawn({
          x: p.x, y: p.y - 0.6, vx: dx / dd * 140, vy: dy / dd * 70,
          life: Math.min(0.55, dd / 3), size: 5, col: '#ff6a9e', type: 'heart',
        });
        charmed++;
      }
      if (charmed) {
        this.particles.hearts(p.x, p.y - 0.8, 6);
        UI.toast('Комплимент принят: ' + charmed + ' смущён' + (charmed === 1 ? 'а' : 'о'), 'gold');
      } else UI.toast('Никого в радиусе флирта', '');
    },
    playerHurt(val, srcName, env, srcEnemy) {
      const p = this.player;
      if (p.iframes > 0 || this.state !== 'dungeon') return;
      let v = val / p.armor;
      // «Второе дыхание»: смертельный удар оставляет 1 HP
      if (p.hp - v <= 0 && p.cheatReady()) {
        p.cheatUsedAt = p.playtime;
        p.hp = 1;
        p.iframes = p.cheatIframes;
        p.hitFlash = 1;
        this.shake(8);
        AudioSys.sfx('levelup');
        UI.toast('ВТОРОЕ ДЫХАНИЕ! Плащ затянул рану (' + Math.round(p.cheatCd / 60) + ' мин отката)', 'gold');
        UI.dialogue('Кекс', 'Ещё не сегодня, девочки.');
        this.particles.burst(p.x, p.y - 0.5, 22, '#7dffb0', 110, { type: 'spark' });
        return;
      }
      p.hp -= v;
      p.iframes = env ? 0.5 : 0.35;
      p.streak = 0; p.streakT = 0;   // «Азарт» рвётся от полученного урона
      // аффиксы элиток-агрессоров: «Липкая» замедляет, «Кровожадная» лечится
      if (srcEnemy && srcEnemy.elite) {
        if (srcEnemy.elite.some(a => a.id === 'sticky')) {
          p.slowT = Math.max(p.slowT || 0, 1.6);
          this.particles.burst(p.x, p.y - 0.4, 5, '#d8c0f0', 40);
        }
        if (srcEnemy.elite.some(a => a.id === 'vamp')) {
          srcEnemy.hp = Math.min(srcEnemy.maxHp, srcEnemy.hp + v * 0.6);
          this.particles.hearts(srcEnemy.x, srcEnemy.y - 0.6, 2);
        }
      }
      p.hitFlash = 1;
      this.shake(5);
      AudioSys.sfx('hurt');
      this.dmgNums.add(p.x, p.y, v, 'player');
      if (Math.random() < 0.25 && !env) UI.dialogue('Кекс', K.choice(Math.random, DATA.HERO_HIT_LINES));
      // шипы реликвии
      const thorns = p.relicBonus('thorns');
      if (thorns > 0 && srcEnemy && !srcEnemy.dead) srcEnemy.hurt(thorns, this, null, true);
      UI.updateHUD(p);
      if (p.hp <= 0) this.playerDeath();
    },

    // ===================== дроп и события =====================
    // множитель «Азарта»: цепочка фрагов без перерыва и урона
    get streakMult() {
      const s = this.player ? this.player.streak : 0;
      return 1 + Math.max(0, Math.min(s - 1, 19)) * 0.1;
    },
    spawnPickups(x, y, gold, xp, bossFlag) {
      const p = this.player;
      const mult = bossFlag ? 1 : this.streakMult;   // боссу множитель не нужен
      p.gainXp(xp * mult, this);
      const coins = Math.min(6, 1 + (gold / 5 | 0));
      const perCoin = Math.max(1, Math.round(gold * mult / coins));
      for (let i = 0; i < coins; i++)
        this.pickups.push(new Entities.Pickup(x, y, 'gold', perCoin));
      if (Math.random() < 0.25 || bossFlag)
        this.pickups.push(new Entities.Pickup(x, y, 'heart', Math.round(p.maxHp * 0.06) + 4));
      // зелья: с боссов два случайных, с мобов редко
      const potN = bossFlag ? 2 : (this.rng() < 0.07 ? 1 : 0);
      for (let i = 0; i < potN; i++)
        this.pickups.push(new Entities.Pickup(x, y, 'potion', DATA.potionDrop(this.rng, this.level.depth)));
      if (bossFlag || Math.random() < 0.03) {
        const minR = this.level.depth >= 12 ? 1 : 0;
        this.pickups.push(new Entities.Pickup(x, y, 'relic', DATA.relicInstance(this.rng, null, minR)));
      }
      // камни: с боссов гарантированно 1–3, с мобов редко
      const gemN = bossFlag ? K.irange(this.rng, 1, 3) : (this.rng() < 0.045 ? 1 : 0);
      for (let i = 0; i < gemN; i++)
        this.pickups.push(new Entities.Pickup(x, y, 'gem', DATA.gemInstance(this.rng, this.level.depth)));
      // оружие: босс всегда, сундук с шансом (см. updateDungeon), глубже — круче
      if (bossFlag) {
        const w = DATA.weaponDrop(this.rng, this.level.depth, Object.keys(p.weapons.owned));
        if (w) this.pickups.push(new Entities.Pickup(x, y, 'weapon', w));
      }
    },
    onEnemyDead(e) {
      this.floorKills++;
      // тайкун-мета: трофеи для фабрики (элитки ×3)
      this.player.trophies += e.elite ? 3 : 1;
      if (window.QuestSys) QuestSys.onKill(this.player, e);
      // «Азарт»: фраг продолжает цепочку (урон по герою рвёт её в playerHurt)
      const p = this.player;
      p.streak++;
      p.streakT = 6;
      if (p.streak === 5 || p.streak === 10 || p.streak === 20) {
        AudioSys.sfx('crit');
        UI.toast('🔥 Азарт ×' + this.streakMult.toFixed(1) + ' — не сбавляй!', 'gold');
        this.particles.burst(p.x, p.y - 0.5, 10, '#ffd860', 90, { type: 'spark' });
      }
      UI.updateHUD(p);
    },
    enemyLine(e, kind) {
      const pool = e.def ? (e.def.lines[kind] || []) : [];
      if (!pool.length) return;
      const text = K.choice(Math.random, pool);
      if (e instanceof Entities.Boss) {
        UI.dialogue(e.bd.name, text);
      } else {
        e.bubble = { text, t: 2.4 };
      }
    },
    bossIntro(b) {
      AudioSys.sfx('boss');
      UI.bossBannerShow(b.bd.name, 'глубина ' + this.level.depth);
      UI.dialogue(b.bd.name, K.choice(Math.random, b.bd.intro));
    },
    bossDefeated(b) {
      this.bossDead = true;
      this.exitPortal = { x: b.x, y: b.y };
      this.player.trophies += 25;
      if (window.AdSys) AdSys.grantBossTicket(this);
      if (window.QuestSys) QuestSys.onBossDefeated(this.player, this.level.depth);
      UI.dialogue(b.bd.name, K.choice(Math.random, b.bd.outro));
      UI.dialogue('Кекс', 'Портал открыт. Реликвия моя. Совесть по-прежнему у входа.');
      SaveSys.save(this);
    },

    // ===================== геометрия/коллизии =====================
    collideCircle(ent) {
      const lvl = this.level;
      const r = ent.r || 0.3;
      const tx0 = Math.floor(ent.x - r), tx1 = Math.floor(ent.x + r);
      const ty0 = Math.floor(ent.y - r), ty1 = Math.floor(ent.y + r);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx >= lvl.w || ty >= lvl.h) continue;
        const t = lvl.tiles[(ty * lvl.w + tx)];
        if (t === 1 || t === 3) continue;
        // ближайшая точка квадрата тайла
        const cx = K.clamp(ent.x, tx, tx + 1), cy = K.clamp(ent.y, ty, ty + 1);
        let dx = ent.x - cx, dy = ent.y - cy;
        let d = Math.hypot(dx, dy);
        if (d < r) {
          if (d < 0.0001) { dx = 0.5; dy = 0.5; d = 0.7; }
          ent.x += dx / d * (r - d);
          ent.y += dy / d * (r - d);
        }
      }
    },

    // ===================== апдейт =====================
    loop(ts) {
      requestAnimationFrame(t => this.loop(t));
      const t = ts / 1000;
      let dt = Math.min(0.05, t - (this._last || t));
      this._last = t;
      if (dt <= 0) dt = 0.001;

      if (this.hitstopT > 0) { this.hitstopT -= dt; dt *= 0.12; }

      if (this.state === 'dungeon' && !this.paused) { this.updateDungeon(dt); this.factoryTick(dt); }
      if (this.state === 'campScene' && !this.paused) {
        CampScene.update(dt, this);
        this.factoryTick(dt);
        this.particles.update(dt);
        const p = this.player;
        this.camX = K.lerp(this.camX, K.isoX(p.x, p.y), Math.min(1, dt * 7));
        this.camY = K.lerp(this.camY, K.isoY(p.x, p.y), Math.min(1, dt * 7));
        UI.updateHUD(p);
      }
      this.updateAlways(dt, t);

      this.render(t);
    },
    updateAlways(dt, t) {
      this.particles.update(dt);
      this.dmgNums.update(dt);
      this.shakeV *= Math.pow(0.001, dt);
      // fps
      this._fpsN = (this._fpsN || 0) + 1;
      if (t - (this._fpsT || 0) > 0.5) {
        $('fps').textContent = Math.round(this._fpsN / (t - this._fpsT)) + ' fps';
        this._fpsN = 0; this._fpsT = t;
      }
      // остывание страйк-эффекта
      if (this.strikeFx) { this.strikeFx.t -= dt; if (this.strikeFx.t <= 0) this.strikeFx = null; }
    },
    updateDungeon(dt) {
      const p = this.player, lvl = this.level;
      // затемнение входа на этаж: мир виден, но управление ещё спит
      if (this.transitionT > 0) {
        this.transitionT -= dt;
        return;
      }
      p.update(dt, this.moveInput(), this);

      // поток и туман — при смене тайла или по таймеру
      const tk = (p.x | 0) + ',' + (p.y | 0);
      this.flowT -= dt; this.fovT -= dt;
      if (tk !== this.lastTile || this.flowT <= 0) {
        Dungeon.updateFlow(lvl, p.x, p.y);
        this.flowT = 0.35;
      }
      if (tk !== this.lastTile || this.fovT <= 0) {
        Dungeon.updateFOV(lvl, p.x, p.y, 8);
        this.fovT = 0.18;
        this.lastTile = tk;
      }

      // сущности
      for (const e of this.enemies) {
        if (e.dead) { e.dieT -= dt; continue; }
        // спим если далеко и не видно
        const dd = K.dist(e.x, e.y, p.x, p.y);
        if (dd > 16) continue;
        e.update(dt, this);
        if (e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
      }
      K.removeIf(this.enemies, e => e.dead && e.dieT <= 0);

      for (const pr of this.projectiles) pr.update(dt, this);
      K.removeIf(this.projectiles, pr => pr.dead);

      for (const pk of this.pickups) pk.update(dt, this);
      K.removeIf(this.pickups, pk => pk.dead);

      // сундуки/алтари/коконы/выход
      for (const c of lvl.chests) {
        if (!c.opened && K.dist(p.x, p.y, c.x, c.y) < 0.62) {
          c.opened = true;
          AudioSys.sfx('chest');
          this.spawnPickups(c.x, c.y, 14 + this.rng() * 20 * lvl.depth, 10 + lvl.depth * 3, this.rng() < 0.35);
          if (this.rng() < 0.16) {
            const w = DATA.weaponDrop(this.rng, lvl.depth, Object.keys(p.weapons.owned));
            if (w) this.pickups.push(new Entities.Pickup(c.x, c.y, 'weapon', w));
          }
          if (this.rng() < 0.45)
            this.pickups.push(new Entities.Pickup(c.x, c.y, 'gem', DATA.gemInstance(this.rng, lvl.depth)));
          this.particles.burst(c.x, c.y - 0.4, 14, '#ffd860', 80, { type: 'spark' });
        }
      }
      for (const pr of lvl.props) {
        if (pr.type === 'shrine' && !pr.used && K.dist(p.x, p.y, pr.x, pr.y) < 0.9) {
          pr.used = true;
          const kinds = ['dmg', 'spd', 'regen'];
          const k = K.choice(this.rng, kinds);
          p.buffs[k] = true;
          AudioSys.sfx('shrine');
          UI.toast(DATA.SHRINE_QUIPS[k], 'gold');
          this.particles.burst(pr.x, pr.y - 0.5, 18, '#ff9ecf', 70);
        }
        if (pr.type === 'cocoon' && !pr.popped && K.dist(p.x, p.y, pr.x, pr.y) < 1.15) {
          pr.popped = true;
          this.particles.burst(pr.x, pr.y - 0.4, 16, '#d8b8e8', 80);
          const e = new Entities.Enemy('imp', pr.x, pr.y, lvl.depth);
          e.aggro = true;
          this.enemies.push(e);
          UI.toast('Из кокона: «Спасли!.. почти»', '');
        }
      }
      // врата спуска: при подходе решётка поднимается, вход — спуск на этаж ниже
      if (!lvl.isBoss && lvl.exit) {
        const ex = lvl.exit;
        const dEx = K.dist(p.x, p.y, ex.x, ex.y);
        const want = dEx < 1.7 ? 1 : 0;
        const wasClosed = this.doorOpen < 0.05;
        this.doorOpen = K.clamp(this.doorOpen + (want ? dt * 1.6 : -dt * 1.1), 0, 1);
        if (want && wasClosed && this.doorOpen > 0.05) AudioSys.sfx('gate');
        if (this.doorOpen > 0.55 && dEx < 0.62) this.floorDone();
      }
      if (this.exitPortal && K.dist(p.x, p.y, this.exitPortal.x, this.exitPortal.y) < 0.8) {
        this.floorDone();
      }

      // динамика: «Вторжение» — глубина злится и высылает подмогу
      const lvlDyn = this.level;
      const elapsed = p.playtime - (lvlDyn.startTime != null ? lvlDyn.startTime : 0);
      if (!lvlDyn.invaded && lvlDyn.invadeAt != null && elapsed > lvlDyn.invadeAt) {
        lvlDyn.invaded = true;
        const pool = DATA.THEME_POOLS[lvlDyn.theme.id];
        const n = 3 + Math.floor(lvlDyn.depth / 4);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = 3.5 + Math.random() * 2.5;
          const fx = K.clamp(p.x + Math.cos(a) * rr, 1.5, lvlDyn.w - 1.5);
          const fy = K.clamp(p.y + Math.sin(a) * rr, 1.5, lvlDyn.h - 1.5);
          const total = pool.reduce((s2, q) => s2 + q[1], 0);
          let roll = Math.random() * total, type = pool[0][0];
          for (const [t2, w2] of pool) { roll -= w2; if (roll <= 0) { type = t2; break; } }
          const e2 = new Entities.Enemy(type, fx, fy, lvlDyn.depth, p.level);
          e2.aggro = true;
          this.enemies.push(e2);
          this.particles.burst(fx, fy - 0.4, 8, '#d9a8ff', 70);
        }
        UI.toast('⚡ Вторжение! Глубина злится: подмога!', '');
        AudioSys.sfx('boss');
        this.shake(6);
      }
      // динамика: рывок бьёт насквозь — проходи сквозь строй, а не вокруг
      if (p.dashT > 0) {
        for (const e of this.enemies) {
          if (e.dead || e._dashHitId === p.dashId) continue;
          if (K.dist(p.x, p.y, e.x, e.y) < e.r + p.r + 0.18) {
            e._dashHitId = p.dashId;
            this.hitEnemy(e, 0.6, { noCombo: true });
            e.slowT = Math.max(e.slowT || 0, 0.8);
          }
        }
      }

      // камера
      const tx = K.isoX(p.x, p.y), ty = K.isoY(p.x, p.y);
      this.camX = K.lerp(this.camX, tx, Math.min(1, dt * 7));
      this.camY = K.lerp(this.camY, ty, Math.min(1, dt * 7));

      UI.updateHUD(p);
    },
    // тайкун-мета «Фабрика трофеев»: импы превращают трофеи в золото
    factoryRate() {
      const f = this.player.factory;
      return f.imps === 0 ? 0 : f.imps * 1.5 * (1 + this.player.bestDepth * 0.03);
    },
    factoryTick(dt) {
      const f = this.player.factory;
      if (f.imps === 0) return;
      f.acc += this.factoryRate() * dt;
      f.lastTs = Date.now();
    },
    // офлайн-доход фабрики при загрузке
    factoryOffline() {
      const f = this.player.factory;
      if (f.imps === 0) { f.lastTs = Date.now(); return; }
      const away = K.clamp((Date.now() - (f.lastTs || Date.now())) / 1000, 0, 8 * 3600);
      const gold = Math.floor(this.factoryRate() * away / 60);  // офлайн — 1/60 скорости
      f.lastTs = Date.now();
      if (gold > 0) {
        this.player.gold += gold;
        UI.toast('🏭 Фабрика принесла ' + gold + ' золота, пока ты отдыхал', 'gold');
      }
    },
    // оживление после смерти (rewarded)
    revive() {
      const p = this.player;
      p.hp = Math.round(p.maxHp * 0.6);
      p.mp = p.maxMp;
      p.iframes = 3;
      p.streak = 0;
      for (const e of this.enemies) if (!e.dead) e.charmT = Math.max(e.charmT, 1.6);
      this.state = 'dungeon';
      this.paused = false;
      UI.show(null);
      AudioSys.sfx('levelup');
      UI.toast('Второе дыхание от рекламодателя! ❤', 'gold');
    },
    floorDone() {
      if (this.state !== 'dungeon') return;
      // межстраничная реклама: между активностями, не чаще кулдауна
      if (window.AdSys) AdSys.maybeInterstitial(this);
      // диабловский переход: скрип врат → генерация → карточка нового этажа
      AudioSys.sfx('door');
      // динамика: бонус за скоростную зачистку (вошёл в пар-время этажа)
      const lvl = this.level, p = this.player;
      const elapsed = p.playtime - (lvl.startTime != null ? lvl.startTime : 0);
      if (!lvl.isBoss && elapsed <= lvl.parTime) {
        const bonus = 20 + lvl.depth * 12;
        p.gold += bonus;
        UI.toast('⏱ Скоростная зачистка! +' + bonus + ' золота', 'gold');
        AudioSys.sfx('coin');
      }
      p.depth = lvl.depth + 1;
      if (this.player.depth > this.player.bestDepth) this.player.bestDepth = this.player.depth;
      SaveSys.save(this);
      this.enterFloor(this.player.depth);   // карточка и затемнение — внутри
    },

    // ===================== рендер =====================
    shake(v) { this.shakeV = Math.max(this.shakeV, v); },

    toScreen(wx, wy) {
      return [
        (K.isoX(wx, wy) - this.camX) * zoom + cw / 2 + (Math.random() - 0.5) * this.shakeV,
        (K.isoY(wx, wy) - this.camY) * zoom + ch / 2 + (Math.random() - 0.5) * this.shakeV,
      ];
    },

    render(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      if (this.state === 'dungeon' || this.state === 'descend' || this.state === 'dead' || this.state === 'campScene') {
        this.renderWorld(t);
      } else {
        this.renderMenu(t);
      }
    },

    renderWorld(t) {
      const lvl = this.level, p = this.player;
      const shx = (Math.random() - 0.5) * this.shakeV, shy = (Math.random() - 0.5) * this.shakeV;
      ctx.save();
      ctx.translate(cw / 2 + shx, ch / 2 + shy);
      ctx.scale(zoom, zoom);
      ctx.translate(-this.camX, -this.camY);

      const vis = lvl.vis;
      // --- полы ---
      const margin = 80;
      for (let y = 0; y < lvl.h; y++) {
        for (let x = 0; x < lvl.w; x++) {
          const v = vis[(y * lvl.w + x)];
          if (!v) continue;
          const tt = lvl.tiles[(y * lvl.w + x)];
          if (tt === 0) continue;
          const sx = K.isoX(x, y), sy = K.isoY(x, y);
          if (sx < this.camX - cw / zoom / 2 - margin || sx > this.camX + cw / zoom / 2 + margin ||
              sy < this.camY - ch / zoom / 2 - margin - K.WH || sy > this.camY + ch / zoom / 2 + margin) continue;
          ctx.globalAlpha = v === 2 ? 1 : 0.42;
          if (tt === 1) Sprites.drawFloor(ctx, lvl.theme, x, y, sx, sy);
          else if (tt === 3) Sprites.drawHazard(ctx, lvl.theme, x, y, sx, sy, t);
        }
      }
      ctx.globalAlpha = 1;

      // --- живность данжа: мыши, тараканы, привидения (до света) ---
      if (lvl.critters) {
        for (const c of lvl.critters) {
          if (this.tileVis(c.x, c.y) !== 2) continue;
          const wx = c.x - 0.5 + Math.sin(t * 0.7 + c.seed) * c.range * 0.3;
          const wy = c.y - 0.5 + Math.cos(t * 0.5 + c.seed) * c.range * 0.3;
          const csx = K.isoX(wx, wy), csy = K.isoY(wx, wy) + K.TH / 2;
          if (c.kind === 'bat') Sprites.drawBat(ctx, csx, csy, t, c.seed);
          else if (c.kind === 'roach') Sprites.drawRoach(ctx, csx, csy, t, c.seed);
          else Sprites.drawGhostCritter(ctx, csx, csy, t, c.seed);
        }
      }

      // --- лагерь: ковёр/постройки рисуются под объектами ---
      if (lvl.isCamp) { CampScene.drawDecor(ctx, t); CampScene.drawStructures(ctx, t); }

      // --- сортируемые объекты ---
      const items = [];
      for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++) {
        const v = vis[(y * lvl.w + x)];
        if (!v) continue;
        if (lvl.tiles[(y * lvl.w + x)] === 2) items.push({ d: x + y, kind: 'wall', x, y, v });
      }
      for (const pr of lvl.props) {
        if (!vis[((pr.y | 0) * lvl.w + (pr.x | 0))]) continue;
        items.push({ d: pr.x + pr.y, kind: 'prop', o: pr });
      }
      for (const c of lvl.chests) {
        if (!vis[((c.y | 0) * lvl.w + (c.x | 0))]) continue;
        items.push({ d: c.x + c.y, kind: 'chest', o: c });
      }
      if (!lvl.isBoss && lvl.exit) items.push({ d: lvl.exit.x + lvl.exit.y, kind: 'stairs', o: lvl.exit });
      if (this.exitPortal) items.push({ d: this.exitPortal.x + this.exitPortal.y, kind: 'portal', o: this.exitPortal });
      for (const tc of lvl.torches) {
        if (!vis[((tc.y | 0) * lvl.w + (tc.x | 0))]) continue;
        items.push({ d: tc.x + tc.y + 0.9, kind: 'torch', o: tc });
      }
      for (const pk of this.pickups) items.push({ d: pk.x + pk.y, kind: 'pickup', o: pk });
      for (const e of this.enemies) {
        if (e.spawnT > 0) continue;
        const v = vis[((e.y | 0) * lvl.w + (e.x | 0))];
        if (v !== 2 && !e.dead) continue;
        items.push({ d: e.x + e.y, kind: 'enemy', o: e });
      }
      if (lvl.isCamp) {
        for (const n of CampScene.npcs(p)) {
          const sp = CampScene.SPOTS[n.id];
          items.push({ d: sp.x + sp.y - 0.05, kind: 'campNpc', o: n });
        }
      }
      items.push({ d: p.x + p.y + 0.01, kind: 'player' });

      items.sort((a, b) => a.d - b.d);
      for (const it of items) {
        switch (it.kind) {
          case 'wall': {
            const sx = K.isoX(it.x, it.y), sy = K.isoY(it.x, it.y);
            ctx.globalAlpha = it.v === 2 ? 1 : 0.42;
            // стена перед героем — полупрозрачная: чем ближе к колонке
            // персонажа, тем прозрачнее (бег вдоль стены не прячет героя)
            if (it.v === 2) {
              const psx = K.isoX(p.x - 0.5, p.y - 0.5), psy = K.isoY(p.x - 0.5, p.y - 0.5) + K.TH / 2;
              const dxw = Math.abs(sx - psx), dyw = sy - psy;
              if (dxw < 78 && dyw > -34 && dyw < 150) {
                const cover = K.clamp(1 - dxw / 78, 0, 1) * K.clamp(1 - Math.abs(dyw - 60) / 95, 0, 1);
                ctx.globalAlpha = K.lerp(1, 0.35, cover);
              }
            }
            Sprites.drawWall(ctx, lvl.theme, it.x, it.y, sx, sy);
            ctx.globalAlpha = 1;
            break;
          }
          case 'torch': {
            const o = it.o;
            if (o.campfire) break;   // костёр рисует CampScene
            const sx = K.isoX(o.x - 0.5, o.y - 0.5), sy = K.isoY(o.x - 0.5, o.y - 0.5) + K.TH / 2;
            Sprites.drawTorch(ctx, sx, sy, t);
            break;
          }
          case 'prop': {
            const o = it.o;
            ctx.globalAlpha = vis[((o.y | 0) * lvl.w + (o.x | 0))] === 2 ? 1 : 0.42;
            Sprites.drawProp(ctx, o, K.isoX(o.x - 0.5, o.y - 0.5), K.isoY(o.x - 0.5, o.y - 0.5) + K.TH / 2, t);
            ctx.globalAlpha = 1;
            break;
          }
          case 'chest': {
            const o = it.o;
            Sprites.drawChest(ctx, K.isoX(o.x - 0.5, o.y - 0.5), K.isoY(o.x - 0.5, o.y - 0.5) + K.TH / 2, o.opened, t);
            break;
          }
          case 'stairs':
            Sprites.drawDoor(ctx, K.isoX(it.o.x - 0.5, it.o.y - 0.5), K.isoY(it.o.x - 0.5, it.o.y - 0.5) + K.TH / 2, t,
              this.doorOpen || 0, lvl.theme);
            break;
          case 'portal': {
            const o = it.o;
            Sprites.drawPortal(ctx, K.isoX(o.x - 0.5, o.y - 0.5), K.isoY(o.x - 0.5, o.y - 0.5) + K.TH / 2 - 6, t);
            break;
          }
          case 'pickup': {
            const o = it.o;
            const sx = K.isoX(o.x - 0.5, o.y - 0.5), sy = K.isoY(o.x - 0.5, o.y - 0.5) + K.TH / 2 - 8 - Math.sin(o.t * 3) * 3;
            if (o.kind === 'gold') Sprites.drawCoin(ctx, sx, sy, o.t);
            else if (o.kind === 'heart') Sprites.drawHeartPickup(ctx, sx, sy, o.t);
            else if (o.kind === 'potion') Sprites.drawPotionPickup(ctx, sx, sy, o.t, DATA.POTION_BY_ID(o.val).col);
            else if (o.kind === 'gem') Sprites.drawGemPickup(ctx, sx, sy, o.t, o.val);
            else if (o.kind === 'weapon') Sprites.drawWeaponPickup(ctx, sx, sy, o.t, o.val);
            else Sprites.drawRelicPickup(ctx, sx, sy, o.t);
            break;
          }
          case 'enemy': {
            const e = it.o;
            const sx = K.isoX(e.x - 0.5, e.y - 0.5), sy = K.isoY(e.x - 0.5, e.y - 0.5) + K.TH / 2;
            const dieDur = e.crown ? 1.4 : 1.0;
            if (e.dead) {
              // гибель на месте: дрожит стоя → оседает/сплющивается к земле
              // ровно там, где стояла (без разлёта) → мерцает и гаснет → звёздочки
              const prog = 1 - K.clamp(e.dieT / dieDur, 0, 1);
              e.hitT = prog < 0.45 ? 0.9 : 0;
              const fp = prog < 0.45 ? 0 : (prog - 0.45) / 0.55;      // фаза падения
              const fall = Math.pow(fp, 1.4);                          // оседает с разгоном
              const squashY = 1 - 0.62 * fall;                         // тело опадает вниз
              const squashX = 1;                                       // строго на месте
              // мерцание: половина времени — мигает, к концу тусклее и реже
              let alpha;
              if (prog < 0.45) alpha = 1;
              else {
                const blink = Math.sin(t * 32 + (e.x + e.y) * 7) > (0.2 - (1 - prog) * 0.5) ? 1 : 0.22;
                alpha = K.clamp((1 - prog) * 2.4, 0, 1) * blink;
              }
              ctx.globalAlpha = alpha;
              ctx.save();
              ctx.translate(sx, sy);
              ctx.scale(squashX, squashY);
              ctx.translate(-sx, -sy);
              Sprites.drawDemon(ctx, e, sx, sy, t);
              ctx.restore();
              // Cartoon-звёздочки над лежащей головой
              if (prog > 0.8) {
                const hx = sx - 12 * (e.size || 1), hy = sy - 26 * (e.size || 1);
                for (let i = 0; i < 3; i++) {
                  const a = t * 3 + i * 2.1;
                  const stx = hx + Math.cos(a) * 13, sty = hy + Math.sin(a) * 5 - 4;
                  ctx.save();
                  ctx.translate(stx, sty);
                  ctx.rotate(a);
                  ctx.strokeStyle = 'rgba(255,216,96,' + (0.5 + 0.4 * Math.sin(t * 6 + i)) + ')';
                  ctx.lineWidth = 1.4;
                  for (let r = 0; r < 4; r++) {
                    const ra = r * Math.PI / 2;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(ra) * 2, Math.sin(ra) * 2);
                    ctx.lineTo(Math.cos(ra) * 5.5, Math.sin(ra) * 5.5);
                    ctx.stroke();
                  }
                  ctx.restore();
                }
              }
              ctx.globalAlpha = 1;   // мерцающий alpha не должен утекать дальше
            } else {
              // аура элитки: пульсирующее кольцо цвета первого аффикса
              if (e.elite) {
                const ec = e.elite[0].col;
                const ep = (t * 0.9 + 0.35) % 1;
                ctx.strokeStyle = K.rgba(ec, 0.55 * (1 - ep) + 0.15);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(sx, sy + 1, (12 + ep * 16) * (e.size || 1), (6 + ep * 8) * (e.size || 1), 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = K.rgba(ec, 0.9);
                ctx.font = '11px Georgia, serif';
                ctx.textAlign = 'center';
                ctx.fillText('★', sx, sy - 84 * (e.size || 1));
                ctx.textAlign = 'left';
              }
              Sprites.drawDemon(ctx, e, sx, sy, t);
              ctx.globalAlpha = 1;
            }
            // полоска HP
            if (!e.dead && e.aggro) {
              const w = 34 * (e.size || 1);
              ctx.fillStyle = 'rgba(0,0,0,.6)';
              ctx.fillRect(sx - w / 2, sy - 78 * (e.size || 1), w, 4);
              ctx.fillStyle = e.elite ? '#ffd860' : (e.charmT > 0 ? '#ff9ec4' : '#ff4a6e');
              ctx.fillRect(sx - w / 2, sy - 78 * (e.size || 1), w * K.clamp(e.hp / e.maxHp, 0, 1), 4);
            }
            break;
          }
          case 'player': {
            const sx = K.isoX(p.x - 0.5, p.y - 0.5), sy = K.isoY(p.x - 0.5, p.y - 0.5) + K.TH / 2;
            // мигание при неуязвимости
            if (p.iframes > 0 && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.45;
            else ctx.globalAlpha = 1;
            // якорь хлыста — мозаика цензуры на бёдрах (та же формула, что в drawPlayer)
            const breathe = Math.sin(t * 2.4) * 1.5;
            const bob = p.moving ? Math.abs(Math.sin(p.walkPhase)) * 3 : breathe * 0.6;
            const whipY = sy - 26 - bob * 0.4 - 4 - 2;
            // направление выхлёста: точно в лицо поражённой цели
            let sA;
            if (p.strikeT > 0 && p.strikeTarget) {
              const st = p.strikeTarget;
              const tSx = K.isoX(st.x - 0.5, st.y - 0.5);
              const tSy = K.isoY(st.x - 0.5, st.y - 0.5) + K.TH / 2 - 62 * (st.size || 1);
              sA = Math.atan2(tSy - whipY, tSx - sx);
            } else {
              const worldA = p.spinT > 0 ? p.whip.armAngle : p.facing;
              sA = Math.atan2(Math.sin(worldA) + Math.cos(worldA), Math.cos(worldA) - Math.sin(worldA));
            }
            const fake = {
              x: p.x, y: p.y, facing: sA, moving: p.moving, walkPhase: p.walkPhase,
            };
            p.whip.armAngle = sA;
            p.whip.col1 = K.shade(p.weapon.color, -0.55);
            p.whip.col2 = p.weapon.color;
            p.whip.update(sx, whipY, t, p.spinT > 0, p.strikeT || 0);
            Sprites.drawPlayer(ctx, fake, sx, sy, t, p.whip);
            ctx.globalAlpha = 1;
            // дуга удара
            if (this.strikeFx) {
              const f = this.strikeFx;
              const k = f.t / f.max;
              ctx.strokeStyle = K.rgba('#ffd8ec', 0.5 * k);
              ctx.lineWidth = 4 * k + 1;
              ctx.beginPath();
              ctx.arc(sx, sy - 26, f.range * K.TW * 0.5, f.ang - f.arc / 2, f.ang + f.arc / 2);
              ctx.stroke();
            }
            // вихрь — круг
            if (p.spinT > 0) {
              const rr = p.spinRadius * K.TW * 0.5;
              ctx.strokeStyle = K.rgba('#ff9ecf', 0.35 + 0.2 * Math.sin(t * 12));
              ctx.lineWidth = 3;
              ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
              ctx.strokeStyle = K.rgba('#ffffff', 0.18);
              ctx.lineWidth = 8;
              ctx.beginPath(); ctx.ellipse(sx, sy, rr * 0.92, rr * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
            }
            break;
          }
        }
      }

      // --- лагерь: NPC поверх мира, стрелка фокуса ---
      if (lvl.isCamp) {
        for (const it of items) if (it.kind === 'campNpc') CampScene.drawNpc(ctx, t, this, it.o);
        if (!this.paused) CampScene.drawFocus(ctx, t, this);
      }

      // --- снаряды ---
      for (const pr of this.projectiles) {
        const sx = K.isoX(pr.x - 0.5, pr.y - 0.5), sy = K.isoY(pr.x - 0.5, pr.y - 0.5) - 14;
        ctx.fillStyle = 'rgba(0,0,10,.35)';
        ctx.beginPath(); ctx.ellipse(sx, K.isoY(pr.x - 0.5, pr.y - 0.5), 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowColor = pr.col; ctx.shadowBlur = 8;
        ctx.fillStyle = pr.col;
        ctx.beginPath(); ctx.arc(sx, sy, pr.r * 26, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.arc(sx - 1, sy - 1, pr.r * 10, 0, Math.PI * 2); ctx.fill();
      }

      // --- телеграф боссового слэма ---
      const boss = this.enemies.find(e => e.teleT > 0);
      if (boss) {
        const k = 1 - boss.teleT / 0.9;
        const sx = K.isoX(boss.teleX - 0.5, boss.teleY - 0.5), sy = K.isoY(boss.teleX - 0.5, boss.teleY - 0.5) + K.TH / 2;
        ctx.strokeStyle = K.rgba('#ff5a6e', 0.5 + 0.4 * Math.sin(t * 14));
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(sx, sy, boss.teleR * K.TW * 0.5 * k, boss.teleR * K.TH * 0.5 * k, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = K.rgba('#ff5a6e', 0.14);
        ctx.fill();
      }

      // --- частицы и числа урона ---
      this.particles.draw(ctx, (wx, wy) => [K.isoX(wx, wy), K.isoY(wx, wy)]);
      this.dmgNums.draw(ctx, (wx, wy) => [K.isoX(wx, wy), K.isoY(wx, wy)]);

      // --- облачка реплик ---
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const e of this.enemies) {
        if (!e.bubble || e.dead) continue;
        const sx = K.isoX(e.x - 0.5, e.y - 0.5), sy = K.isoY(e.x - 0.5, e.y - 0.5) + K.TH / 2 - 92 * (e.size || 1);
        const a = K.clamp(e.bubble.t / 0.4, 0, 1);
        const w = ctx.measureText(e.bubble.text).width + 14;
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(20,10,28,.92)';
        ctx.strokeStyle = 'rgba(255,150,200,.35)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(sx - w / 2, sy - 11, w, 20, 8);
        else ctx.rect(sx - w / 2, sy - 11, w, 20);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + 9); ctx.lineTo(sx + 4, sy + 9); ctx.lineTo(sx, sy + 15);
        ctx.closePath(); ctx.fillStyle = 'rgba(20,10,28,.92)'; ctx.fill();
        ctx.fillStyle = '#f3e8f5';
        ctx.fillText(e.bubble.text, sx, sy + 3);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left';

      ctx.restore();

      // --- полоса HP босса ---
      const bossAlive = this.enemies.find(e => e.crown && !e.dead && e.aggro);
      if (bossAlive) {
        const bw = Math.min(cw * 0.6, 520), bx = (cw - bw) / 2, by = ch * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(bx - 3, by - 3, bw + 6, 18);
        ctx.fillStyle = '#3a0f22';
        ctx.fillRect(bx, by, bw, 12);
        const grd = ctx.createLinearGradient(bx, by, bx, by + 12);
        grd.addColorStop(0, '#ff7a9e'); grd.addColorStop(1, '#c22a52');
        ctx.fillStyle = grd;
        ctx.fillRect(bx, by, bw * K.clamp(bossAlive.hp / bossAlive.maxHp, 0, 1), 12);
        ctx.font = '13px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(bossAlive.bd.name + (bossAlive.enrage ? ' — в ярости!' : ''), cw / 2, by + 24);
        ctx.textAlign = 'left';
      }

      // --- освещение ---
      this.renderLights(t, shx, shy);

      // вспышка урона игрока
      if (p.hitFlash > 0) {
        ctx.fillStyle = K.rgba('#ff2040', 0.22 * p.hitFlash);
        ctx.fillRect(0, 0, cw, ch);
      }
    },

    renderLights(t, shx, shy) {
      const lvl = this.level, p = this.player;
      const lg = lightG;
      lg.globalCompositeOperation = 'source-over';
      lg.clearRect(0, 0, cw, ch);
      lg.fillStyle = K.rgba('#060310', lvl.theme.ambient);
      lg.fillRect(0, 0, cw, ch);
      lg.globalCompositeOperation = 'destination-out';
      const hole = (wx, wy, r, a) => {
        const sx = (K.isoX(wx, wy) - this.camX) * zoom + cw / 2 + shx;
        const sy = (K.isoY(wx, wy) - this.camY) * zoom + ch / 2 + shy;
        if (sx < -r || sy < -r || sx > cw + r || sy > ch + r) return;
        const g2 = lg.createRadialGradient(sx, sy - 10, r * 0.1, sx, sy - 10, r);
        g2.addColorStop(0, 'rgba(0,0,0,' + a + ')');
        g2.addColorStop(0.7, 'rgba(0,0,0,' + a * 0.55 + ')');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = g2;
        lg.beginPath(); lg.arc(sx, sy - 10, r, 0, Math.PI * 2); lg.fill();
      };
      hole(p.x, p.y, 265 * zoom, 0.96);
      for (const tc of lvl.torches) {
        if (this.tileVis(tc.x, tc.y)) hole(tc.x, tc.y, (150 + Math.sin(t * 7 + tc.x * 5) * 16) * zoom, 0.88);
      }
      for (const pr of lvl.props) {
        if (pr.light && this.tileVis(pr.x, pr.y)) hole(pr.x, pr.y, (pr.type === 'shrine' ? 170 : 110) * zoom, 0.75);
      }
      if (this.exitPortal) hole(this.exitPortal.x, this.exitPortal.y, 170 * zoom, 0.85);
      if (!lvl.isBoss && lvl.exit && this.tileVis(lvl.exit.x, lvl.exit.y))
        hole(lvl.exit.x, lvl.exit.y, (110 + 70 * (this.doorOpen || 0)) * zoom, 0.85);
      for (const pr of this.projectiles) hole(pr.x, pr.y, 55 * zoom, 0.6);
      for (const pk of this.pickups) if (pk.kind === 'relic') hole(pk.x, pk.y, 70 * zoom, 0.7);
      lg.globalCompositeOperation = 'source-over';
      ctx.drawImage(lightCv, 0, 0, cw, ch);

      // тёплые аддитивные блики факелов
      ctx.globalCompositeOperation = 'lighter';
      for (const tc of lvl.torches) {
        if (this.tileVis(tc.x, tc.y) !== 2) continue;
        const sx = (K.isoX(tc.x, tc.y) - this.camX) * zoom + cw / 2 + shx;
        const sy = (K.isoY(tc.x, tc.y) - this.camY) * zoom + ch / 2 + shy;
        if (sx < -60 || sy < -60 || sx > cw + 60 || sy > ch + 60) continue;
        const r = 46 * zoom * (0.9 + Math.sin(t * 8 + tc.x * 3) * 0.12);
        const g3 = ctx.createRadialGradient(sx, sy - 26 * zoom, 1, sx, sy - 26 * zoom, r);
        g3.addColorStop(0, K.rgba(lvl.theme.torch, 0.34));
        g3.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g3;
        ctx.beginPath(); ctx.arc(sx, sy - 26 * zoom, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    // фон меню: герой крупно, угольки
    renderMenu(t) {
      const g = ctx;
      const grd = g.createRadialGradient(cw / 2, ch * 0.75, 40, cw / 2, ch * 0.6, Math.max(cw, ch) * 0.85);
      grd.addColorStop(0, '#2a1230');
      grd.addColorStop(0.5, '#150820');
      grd.addColorStop(1, '#070310');
      g.fillStyle = grd;
      g.fillRect(0, 0, cw, ch);

      // «пол» из ромбов
      g.save();
      g.globalAlpha = 0.25;
      const ox = cw / 2, oy = ch * 0.78;
      for (let ry = 0; ry < 5; ry++) for (let rx = -7; rx <= 7; rx++) {
        const sx = ox + (rx - (ry % 2) * 0.5) * 74, sy = oy + ry * 20 - Math.abs(rx) * 0;
        g.strokeStyle = 'rgba(255,150,200,.16)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(sx, sy); g.lineTo(sx + 37, sy + 10); g.lineTo(sx, sy + 20); g.lineTo(sx - 37, sy + 10);
        g.closePath(); g.stroke();
      }
      g.restore();

      // угольки
      for (const e of this.menuParts) {
        const ex = (e.x + Math.sin(t * 0.3 + e.ph) * 0.03) * cw;
        const ey = ((e.y - t * 0.02 * e.s) % 1 + 1) % 1 * ch;
        g.fillStyle = K.rgba('#ff9e6b', 0.14 + 0.2 * Math.sin(t * 2 + e.ph));
        g.beginPath(); g.arc(ex, ey, 1 + e.s * 2, 0, Math.PI * 2); g.fill();
      }

      // герой — правее меню, чтоб не перекрывать текст
      const scale = Math.min(2.0, ch / 380);
      g.save();
      g.translate(cw * (cw > 900 ? 0.78 : 0.5), ch * 0.72);
      g.scale(scale, scale);
      const fake = { moving: false, walkPhase: 0, facing: -0.6 };
      // хлыст цвета экипированного оружия, растёт из мозаики (breathe ≈ sin(t*2.4)*1.5)
      const mBob = Math.sin(t * 2.4) * 1.5 * 0.6;
      const mAx = 0, mAy = 0 - 26 - mBob * 0.4 - 4 - 2;
      const wcol = this.player ? this.player.weapon.color : '#c88aa0';
      this.menuWhip.col1 = K.shade(wcol, -0.55);
      this.menuWhip.col2 = wcol;
      this.menuWhip.armAngle = fake.facing;
      this.menuWhip.update(mAx, mAy, t, false, 0);
      Sprites.drawPlayer(g, fake, 0, 0, t, this.menuWhip);
      g.restore();
    },
  };

  window.game = G;
  window.addEventListener('DOMContentLoaded', () => G.init());
})();
