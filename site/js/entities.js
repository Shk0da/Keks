// entities.js — игрок, демонессы, боссы, снаряды, дропы, частицы, числа урона.
'use strict';
(function () {

  // ==================== ЧАСТИЦЫ ====================
  class Particles {
    constructor() { this.list = []; }
    spawn(o) {
      if (this.list.length > 420) this.list.shift();
      this.list.push(Object.assign({
        x: 0, y: 0, vx: 0, vy: 0, life: 1, t: 0, size: 3, col: '#fff',
        grav: 0, type: 'dot', fade: true, world: true,
      }, o));
    }
    burst(x, y, n, col, spd, opts) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * spd;
        this.spawn(Object.assign({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.3,
          life: 0.4 + Math.random() * 0.5, size: 2 + Math.random() * 3, col,
          grav: 220,
        }, opts || {}));
      }
    }
    hearts(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.spawn({
          x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 26,
          vy: -46 - Math.random() * 40, life: 0.9 + Math.random() * 0.6,
          size: 4 + Math.random() * 4, col: '#ff6a9e', type: 'heart', grav: -12,
        });
      }
    }
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        if (p.t >= p.life) { L.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    draw(g, toScreen) {
      for (const p of this.list) {
        const k = 1 - p.t / p.life;
        const [sx, sy] = toScreen(p.x, p.y);
        g.globalAlpha = p.fade ? k : 1;
        if (p.type === 'heart') {
          Sprites.drawHeart(g, sx, sy, p.size * (0.5 + k * 0.5), p.col);
        } else if (p.type === 'spark') {
          g.strokeStyle = p.col; g.lineWidth = 1.6 * k;
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - p.vx * 0.04, sy - p.vy * 0.04); g.stroke();
        } else if (p.type === 'mosaic') {
          const cell = p.size;
          g.fillStyle = p.col;
          g.fillRect(sx - cell / 2, sy - cell / 2, cell - 0.4, cell - 0.4);
        } else {
          g.fillStyle = p.col;
          g.beginPath(); g.arc(sx, sy, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
  }

  // ==================== ЧИСЛА УРОНА ====================
  class DamageNumbers {
    constructor() { this.list = []; }
    // kind: dmg | crit | heal | player | quip (val — текст реплики)
    add(x, y, val, kind) {
      const isQuip = kind === 'quip';
      this.list.push({
        x: x + (Math.random() - 0.5) * 0.4, y, t: 0,
        val: isQuip ? String(val) : Math.round(val),
        kind: kind || 'dmg',
      });
      if (this.list.length > 60) this.list.shift();
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const d = this.list[i]; d.t += dt; d.y -= dt * (d.kind === 'quip' ? 0.5 : 0.8);
        if (d.t > (d.kind === 'quip' ? 1.3 : 1.1)) this.list.splice(i, 1);
      }
    }
    draw(g, toScreen) {
      for (const d of this.list) {
        const life = d.kind === 'quip' ? 1.3 : 1.1;
        const k = 1 - d.t / life;
        const [sx, sy] = toScreen(d.x, d.y);
        g.globalAlpha = Math.min(1, k * 2);
        let font, col, txt;
        if (d.kind === 'quip') {
          font = 'italic 15px Georgia, serif';
          col = '#ff9ecf';
          txt = d.val;
        } else {
          font = (d.kind === 'crit' ? 'bold 21px ' : 'bold 15px ') + 'Georgia, serif';
          col = d.kind === 'crit' ? '#ffd860' : d.kind === 'heal' ? '#7dffb0'
            : d.kind === 'player' ? '#ff7a8e' : '#ffffff';
          txt = (d.kind === 'crit' ? '✸' : '') + d.val;
        }
        g.font = font;
        g.textAlign = 'center';
        g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)';
        const yy = sy - 40 - (1 - k) * 26;
        g.strokeText(txt, sx, yy);
        g.fillStyle = col;
        g.fillText(txt, sx, yy);
      }
      g.globalAlpha = 1; g.textAlign = 'left';
    }
  }

  // ==================== ИГРОК ====================
  class Player {
    constructor(save) {
      // характеристики из сейва
      this.level = save.level || 1;
      this.xp = save.xp || 0;
      this.stats = save.stats || { str: 5, agi: 5, vit: 5, cha: 5 };
      this.statPts = save.statPts || 0;
      this.skillPts = save.skillPts || 0;
      this.skills = save.skills || {};
      this.gold = save.gold || 0;
      // зелья: по типам; старые сейвы (число) мигрируем в лечение
      if (typeof save.potions === 'number') {
        this.potions = { heal: save.potions, speed: 1, invuln: 0, power: 0, fury: 0, mana: 0 };
      } else {
        this.potions = save.potions || { heal: 3, speed: 1, invuln: 0, power: 0, fury: 0, mana: 0 };
      }
      // таймеры боевых эликсиров (не сохраняются)
      this.fx = { speed: 0, invuln: 0, power: 0, fury: 0, manafree: 0 };
      this.potCd = { heal: 0, speed: 0, invuln: 0, power: 0, fury: 0, mana: 0 };
      this.relics = save.relics || [];       // [{def,rarity,uid}]
      this.equipped = save.equipped || { amulet: null, cloak: null, ring: null };
      // оружейная: коллекция хлыстов + камни
      this.weapons = save.weapons || {
        owned: { rope: { sharp: 0, gems: [] } },
      };
      this.weapons.owned = this.weapons.owned || { rope: { sharp: 0, gems: [] } };
      this.equippedWeapon = save.equippedWeapon || 'rope';
      if (!this.weapons.owned[this.equippedWeapon]) this.equippedWeapon = 'rope';
      this.gems = save.gems != null ? save.gems : [{ type: 'ruby', rar: 0, uid: 1 }];
      this.perm = save.perm || { hp: 0, dmg: 0 };
      this.bought = save.bought || {};       // сколько раз куплено (для цен)
      this.depth = save.depth || 1;
      this.bestDepth = save.bestDepth || 1;
      this.kills = save.kills || 0;
      this.playtime = save.playtime || 0;    // секунд в подземельях — путь к 1000 часов
      this.buffs = save.buffs || {};         // floor-баффы от алтаря
      this.cheatUsedAt = -1e9;               // «Второе дыхание» (когда последний раз спасало)

      this.x = 0; this.y = 0;
      this.vx = 0; this.vy = 0;
      this.facing = 0;
      this.moving = false;
      this.walkPhase = 0;
      this.r = 0.32;

      this.whip = Sprites.makeWhip();

      // боевые таймеры
      this.attackCd = 0; this.combo = 0; this.comboT = 0;
      this.spinT = 0; this.spinCd = 0; this.spinTickT = 0;
      this.dashT = 0; this.dashCd = 0; this.dashDx = 0; this.dashDy = 0;
      this.charmCd = 0;
      this.spatterCd = 0;
      this.iframes = 0;
      this.hitFlash = 0;
      this.drinkT = 0;                     // поза пития зелья
      this.lastPotionCol = '#58d890';
      this.streak = 0; this.streakT = 0;   // «Азарт»: цепочка убийств
      this.dashId = 0;                     // метка рывка для урона насквозь
      this.adTickets = save.adTickets || 0;      // билеты пропуска рекламы
      this.adXpT = 0;                            // ×2 опыт от ролика, сек
      this.trophies = save.trophies || 0;        // «трофеи» для фабрики
      this.factory = save.factory || { imps: 0, acc: 0, lastTs: Date.now() };
      // квесты: главы, поручения, открытые NPC — раньше не читались из сейва
      this.quests = save.quests || { main: null, side: null, prao: null, done: {}, unlocked: {} };
      {
        const q = this.quests;
        q.done = q.done || {}; q.unlocked = q.unlocked || {};
        // перепривязать определения глав к живым данным (в сейве — копии)
        for (const k of ['main', 'prao']) {
          if (q[k] && q[k].def) {
            const live = (DATA.QUESTS.find(x => x.id === q[k].def.id)) ||
                         (DATA.PRAO_QUEST && DATA.PRAO_QUEST.id === q[k].def.id ? DATA.PRAO_QUEST : null);
            if (live) q[k].def = live;
            else q[k] = null;   // определение исчезло — квест сброшен
          }
        }
        if (!q.main) q.main = null;
        if (!q.prao) q.prao = null;
      }
    }

    // ---------- производные ----------
    relicBonus(key) {
      let v = 0;
      for (const slot of ['amulet', 'cloak', 'ring']) {
        const it = this.equipped[slot];
        if (!it) continue;
        const def = DATA.RELIC_POOL.find(r => r.id === it.def);
        if (def && def.bonus[key]) v += def.bonus[key] * DATA.RELIC_BONUS_SCALE[it.rarity];
      }
      return v;
    }
    hasSkill(id) { return (this.skills[id] || 0) > 0; }
    skill(id) { return this.skills[id] || 0; }

    // ---------- оружейная ----------
    get weapon() { return DATA.WEAPON_BY_ID(this.equippedWeapon); }
    get weaponState() { return this.weapons.owned[this.equippedWeapon] || { sharp: 0, gems: [] }; }
    // суммарный множитель урона оружия (база × заточка)
    get weaponDmgMult() {
      const w = this.weapon, st = this.weaponState;
      return w.dmg * (1 + (st.sharp || 0) * DATA.SHARP_STEP);
    }
    // бонусы камней в гнёздах экипированного оружия (по ключам GEM_KEY)
    gemBonus(key) {
      let v = 0;
      const st = this.weapons.owned[this.equippedWeapon];
      if (!st) return 0;
      for (const g of (st.gems || [])) {
        if (!g) continue;
        if (DATA.GEM_KEY[g.type] === key) v += DATA.gemValue(g);
      }
      return v;
    }
    // особенности оружия, приведённые к бонусам игрока
    get weaponTraitBonus() {
      const t = this.weapon.trait;
      return t ? t : { type: 'none', val: 0 };
    }
    weaponSockets(wid) {
      const w = DATA.WEAPON_BY_ID(wid || this.equippedWeapon);
      const st = this.weapons.owned[w.id];
      if (!st) return [];
      const n = [0, 1, 1, 2, 2, 3][w.tier] || 1;   // тир → гнёзда
      while (st.gems.length < n) st.gems.push(null);
      st.gems.length = n;
      return st.gems;
    }

    get maxHp() {
      let hp = 100 + (this.stats.vit - 5) * 12 + (this.level - 1) * 6 + this.perm.hp * 12;
      hp *= 1 + this.relicBonus('hpPct') / 100;
      hp *= 1 + 0.03 * (this.perm.pctHp || 0);
      if (this.hasSkill('lining')) hp *= 1 + this.skill('lining') * 0.12;
      return Math.round(hp);
    }
    get maxMp() { return 50 + (this.level - 1) * 4 + this.stats.cha * 2; }
    // восстановление маны: растёт с уровнем и харизмой
    get mpRegen() { return 2.4 + this.level * 0.12 + this.stats.cha * 0.06; }
    // восстановление здоровья: 0.45% макс. HP/сек + стойкость (в бою тоже)
    get hpRegen() { return this.maxHp * 0.0045 + this.stats.vit * 0.02; }
    get baseDmg() {
      let d = 8 + (this.stats.str - 5) * 0.9 + (this.level - 1) * 1.2 + this.perm.dmg;
      d *= 1 + this.relicBonus('dmgPct') / 100;
      d *= 1 + 0.03 * (this.perm.pctDmg || 0);
      d *= this.weaponDmgMult;                       // хлыст + заточка
      d *= 1 + this.gemBonus('dmgPct') / 100;        // рубины
      if (this.buffs.dmg) d *= 1.25;
      if (this.fx.power > 0) d *= 1.5;               // «Гнев Суккуба»
      return d;
    }
    get moveSpeed() {
      let s = 3.4 * (1 + (this.stats.agi - 5) * 0.015 + this.relicBonus('spdPct') / 100);
      if (this.buffs.spd) s *= 1.3;
      if (this.fx.speed > 0) s *= 1.5;              // «Заячья Прыть»
      if (this.spinT > 0) s *= 0.55 + (this.hasSkill('yula') ? 0.15 * this.skill('yula') : 0);
      return s;
    }
    get critChance() {
      const trait = this.weaponTraitBonus;
      return K.clamp(0.05 + (this.stats.agi - 5) * 0.01 + this.relicBonus('critPct') / 100
        + this.gemBonus('critPct') / 100
        + (trait.type === 'crit' ? trait.val / 100 : 0)
        + (this.hasSkill('hard') ? 0.05 * this.skill('hard') : 0), 0, 0.85);
    }
    // похищение HP: реликвии + изумруды + оружие («Бич Владычицы»)
    get leechPct() {
      const trait = this.weaponTraitBonus;
      return this.relicBonus('leech') + this.gemBonus('leech')
        + (trait.type === 'leech' ? trait.val : 0);
    }
    get attackSpdMult() {
      return (1 + this.gemBonus('aspd') / 100) * (this.fx.fury > 0 ? 1.4 : 1); // «Месть Кокетки»
    }
    get goldPct() {
      const trait = this.weaponTraitBonus;
      return this.relicBonus('goldPct') + this.gemBonus('goldPct')
        + (trait.type === 'gold' ? trait.val : 0);
    }
    get armor() {
      let a = 1 + (this.stats.vit - 5) * 0.015;
      if (this.hasSkill('hems')) a += 0.08 * this.skill('hems');
      return a;
    }
    get dashCdMax() { return 2.2 * (1 - (this.hasSkill('flap') ? 0.15 * this.skill('flap') : 0)) * (1 - this.relicBonus('cdPct') / 100); }
    get spinCdMax() { return 5.5 * (1 - this.relicBonus('cdPct') / 100); }
    get spatterCdMax() { return 0.9 * (1 - this.relicBonus('cdPct') / 100); }
    get charmCdMax() { return 7 * (1 - this.relicBonus('cdPct') / 100); }
    get spinDur() { return 1.4 + (this.hasSkill('longer') ? 0.3 * this.skill('longer') : 0); }
    // откалиброванная кривая: 1→100 уровень суммарно ≈ 1000 часов оптимальной игры
    get xpNext() {
      return Math.round(DATA.XP_A * Math.pow(this.level, DATA.XP_P) * Math.pow(DATA.XP_G, this.level));
    }
    // ---- эффекты капстоунов и новых ранков ----
    get critDmg() { return 1.6 + 0.2 * this.skill('awaken'); }
    get comboFinisher() { return 1.4 + 0.08 * this.skill('awaken'); }
    get spinManaCost() {
      if (this.fx.manafree > 0) return 0;            // «Слёзы Владычицы»
      return Math.max(8, 20 * (1 - 0.08 * this.skill('eternal')) * (1 - this.gemBonus('mpCost') / 100));
    }
    get spinRadius() { return 1.75 * (1 + 0.06 * this.skill('eternal')); }
    get spinTickMax() { return 0.22 * (1 - 0.04 * this.skill('eternal')); }
    get charmTargets() { return 3 + this.skill('harem'); }
    get cheatCd() { return 240 - 40 * this.skill('second'); }
    get cheatIframes() { return 1.5 + 0.5 * this.skill('second'); }
    cheatReady() { return this.skill('second') > 0 && (this.playtime - this.cheatUsedAt) >= this.cheatCd; }

    // ---------- апдейт ----------
    update(dt, input, game) {
      const lvl = game.level;
      this.playtime += dt;
      this.attackCd = Math.max(0, this.attackCd - dt);
      this.spinCd = Math.max(0, this.spinCd - dt);
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.charmCd = Math.max(0, this.charmCd - dt);
      this.spatterCd = Math.max(0, this.spatterCd - dt);
      for (const k in this.potCd) this.potCd[k] = Math.max(0, this.potCd[k] - dt);
      // таймеры боевых эликсиров
      let fxChanged = false;
      for (const k in this.fx) {
        if (this.fx[k] > 0) {
          this.fx[k] = Math.max(0, this.fx[k] - dt);
          if (this.fx[k] === 0) fxChanged = true;
        }
      }
      // неуязвимость эликсиром держит iframes
      if (this.fx.invuln > 0) this.iframes = Math.max(this.iframes, 0.1);
      this.iframes = Math.max(0, this.iframes - dt);
      this.hitFlash = Math.max(0, this.hitFlash - dt * 3);
      this.strikeT = Math.max(0, (this.strikeT || 0) - dt);
      this.drinkT = Math.max(0, this.drinkT - dt);
      this.comboT = Math.max(0, this.comboT - dt);
      this.adXpT = Math.max(0, this.adXpT - dt);
      // «Азарт»: окно цепочки убийств (6 сек между фрагами)
      if (this.streakT > 0) {
        this.streakT -= dt;
        if (this.streakT <= 0) this.streak = 0;
      }
      if (this.comboT <= 0) this.combo = 0;
      this.mp = K.clamp((this.mp != null ? this.mp : this.maxMp) + dt * this.mpRegen, 0, this.maxMp);
      this.hp = K.clamp((this.hp != null ? this.hp : this.maxHp) + dt * this.hpRegen, 0, this.maxHp);

      // рывок
      if (this.dashT > 0) {
        this.dashT -= dt;
        this.x += this.dashDx * dt; this.y += this.dashDy * dt;
        this.iframes = Math.max(this.iframes, 0.06);
      } else {
        // движение
        const mv = input;
        const len = Math.hypot(mv.x, mv.y);
        this.moving = len > 0.12;
        if (this.moving) {
          const nx = mv.x / len, ny = mv.y / len;
          this.x += nx * this.moveSpeed * dt;
          this.y += ny * this.moveSpeed * dt;
          this.facing = Math.atan2(ny, nx);
          this.walkPhase += dt * 10;
        }
      }

      // вихрь
      if (this.spinT > 0) {
        this.spinT -= dt;
        this.whip.armAngle += dt * 18;
        this.spinTickT -= dt;
        if (this.spinTickT <= 0) {
          this.spinTickT = this.spinTickMax;
          game.playerSpinTick();
          AudioSys.sfx('spinLoop');
        }
        this.mp -= dt * 6;
        if (this.mp <= 0) this.spinT = 0;
      }

      // авто-наведение лицом к ближайшему врагу в упор
      if (!this.moving && this.attackCd <= 0) {
        const e = game.nearestEnemy(this.x, this.y, 7);
        if (e) this.facing = K.angTo(this.x, this.y, e.x, e.y);
      }

      // хлыст-верлет обновляется в отрисовке (нужны экранные координаты руки)

      // столкновения со стенами
      game.collideCircle(this);
      // пропсы-блокеры
      for (const p of lvl.props) {
        if (!p.blocks || p.type === 'cocoon') continue;
        const d = K.dist(this.x, this.y, p.x, p.y);
        const rr = 0.55;
        if (d < rr && d > 0.001) {
          this.x += (this.x - p.x) / d * (rr - d);
          this.y += (this.y - p.y) / d * (rr - d);
        }
      }
      // опасные тайлы
      if (Dungeon.isHazard(lvl, this.x, this.y)) {
        const hz = lvl.theme.hazard;
        if (hz === 'lava' && !this._hzT) { this._hzT = 0.8; game.playerHurt(Math.max(4, game.level.depth * 2), 'лава', true); }
        else if ((hz === 'frost' || hz === 'web') && !this.slowT) this.slowT = 1.2;
      }
      if (this._hzT) { this._hzT -= dt; if (this._hzT <= 0) this._hzT = 0; }
      if (this.slowT) { this.slowT -= dt; if (this.slowT <= 0) this.slowT = 0; }

      // регенерация от алтаря
      if (this.buffs.regen) {
        this.hp = K.clamp((this.hp || this.maxHp) + dt * 2, 0, this.maxHp);
      }
    }

    // ---------- действия ----------
    tryAttack(game) {
      if (this.attackCd > 0 || this.spinT > 0) return;
      // авто-наведение: разворачиваемся к ближайшей цели в радиусе удара —
      // хлыст шлёпает по лицу, а не машет куда попало
      const tgt = game.nearestEnemy(this.x, this.y, 2.9);
      if (tgt) this.facing = K.angTo(this.x, this.y, tgt.x, tgt.y);
      this.combo = (this.combo % 3) + 1;
      this.comboT = 1.2;
      // скорость оружия (тяжёлая секира медленнее) + алмазы (аспд)
      this.attackCd = (this.combo === 3 ? 0.55 : 0.38) * this.weapon.spd / this.attackSpdMult;
      this.strikeT = 0.22; // анимация удара
      AudioSys.sfx('whip');
      game.playerStrike(this.combo);
    }
    trySpin(game) {
      if (this.spinCd > 0 || this.spinT > 0) return;
      if (this.mp < this.spinManaCost) { UI.toast('Мана на исходе', ''); AudioSys.sfx('denied'); return; }
      this.mp -= this.spinManaCost;
      this.spinT = this.spinDur;
      this.spinCd = this.spinCdMax;
      this.spinTickT = 0.05;
      AudioSys.sfx('spinStart');
    }
    tryDash(game) {
      if (this.dashCd > 0) return;
      this.dashId++;                       // рывок бьёт насквозь (см. updateDungeon)
      const sp = 10.5;
      let dx, dy;
      if (this.moving) { dx = Math.cos(this.facing); dy = Math.sin(this.facing); }
      else { dx = Math.cos(this.facing); dy = Math.sin(this.facing); }
      this.dashDx = dx * sp; this.dashDy = dy * sp;
      this.dashT = 0.18;
      this.iframes = 0.28 + (this.hasSkill('invis') ? 0.1 * this.skill('invis') : 0);
      this.dashCd = this.dashCdMax;
      AudioSys.sfx('dash');
      for (let i = 0; i < 6; i++)
        game.particles.spawn({
          x: this.x, y: this.y, vx: -dx * 40 + (Math.random() - 0.5) * 30,
          vy: -dy * 40 + (Math.random() - 0.5) * 20, life: 0.35, size: 3,
          col: 'rgba(200,160,255,.6)',
        });
    }
    // «Брызги»: веер белых капель из хлыста — дальняя атака
    trySpatter(game) {
      if (this.spatterCd > 0) return;
      if (this.mp < 10) { UI.toast('Маны мало — брызги вышли сухими', ''); AudioSys.sfx('denied'); return; }
      this.mp -= 10;
      this.spatterCd = this.spatterCdMax;
      this.strikeT = 0.18;
      // автонаведение: ближайшая цель в 9 клетках, иначе направление взгляда
      const tgt = game.nearestEnemy(this.x, this.y, 9);
      const base = tgt ? K.angTo(this.x, this.y, tgt.x, tgt.y) : this.facing;
      for (let i = -1; i <= 1; i++) {
        const a = base + i * 0.16 + (Math.random() - 0.5) * 0.06;
        game.projectiles.push(new Projectile(this.x, this.y - 0.35,
          Math.cos(a) * 6.2, Math.sin(a) * 6.2, 0, '#f4f0ff', 0.14, 0, true, 0.5));
      }
      // мозаично-капельный шлейф у бёдер
      for (let i = 0; i < 5; i++) {
        const a = base + (Math.random() - 0.5) * 0.7;
        game.particles.spawn({
          x: this.x, y: this.y - 0.35,
          vx: Math.cos(a) * 70, vy: Math.sin(a) * 35 - 20,
          life: 0.3 + Math.random() * 0.2, size: 2.4,
          col: Math.random() < 0.5 ? '#f4f0ff' : '#ffd8ec',
        });
      }
      AudioSys.sfx('spatter');
    }

    tryCharm(game) {
      if (this.charmCd > 0) return;
      if (this.mp < 25) { UI.toast('Не хватает маны на комплимент', ''); AudioSys.sfx('denied'); return; }
      this.mp -= 25;
      this.charmCd = this.charmCdMax;
      AudioSys.sfx('charm');
      game.playerCharm();
    }

    gainXp(v, game) {
      if (this.level >= DATA.MAX_LEVEL) return; // потолок: сотня и хватит
      // усталость: глубина заметно меньше уровня — опыт режется
      let mult = 1;
      if (game && game.level) {
        mult = DATA.xpFatigue(game.level.depth, this.level);
        if (mult < 0.95 && !game._fatWarned) {
          game._fatWarned = true;
          UI.toast('Опыт ×' + mult.toFixed(2) + ': для уровня ' + this.level + ' здесь мелко', '');
        }
      }
      let xp = v * mult * (1 + this.relicBonus('xpPct') / 100);
      if (this.adXpT > 0) xp *= 2;   // благословение за ролик
      this.xp += Math.round(xp);
      while (this.xp >= this.xpNext && this.level < DATA.MAX_LEVEL) {
        this.xp -= this.xpNext;
        this.levelUp(game);
      }
      if (this.level >= DATA.MAX_LEVEL) this.xp = 0;
    }

    levelUp(game) {
      this.level++;
      this.statPts += 3;
      this.skillPts += 1;
      this.hp = this.maxHp; this.mp = this.maxMp;
      AudioSys.sfx('levelup');
      UI.toast(K.choice(Math.random, DATA.LEVELUP_QUIPS), 'gold');
      game.particles.burst(this.x, this.y - 0.5, 24, '#ffd860', 90, { type: 'spark' });
      const m = DATA.MILESTONE_LINES[this.level];
      if (m) UI.dialogue('Кекс', K.choice(Math.random, m));
      UI.updateHUD(this);
    }
    // ---------- зелья: движок знает только протокол (def.apply), логика в data.js ----------
    tryPotion(game, type) {
      type = type || 'heal';
      const def = DATA.POTION_BY_ID(type);
      if ((this.potCd[type] || 0) > 0) return;
      if ((this.potions[type] || 0) <= 0) { UI.toast(def.name + ': пусто', ''); AudioSys.sfx('denied'); return; }
      // лечение на полном HP — не тратим
      if (type === 'heal' && (this.hp || 0) >= this.maxHp) { UI.toast('Здоровье и так полно', ''); return; }
      this.potions[type]--;
      this.potCd[type] = def.cd;
      this.drinkT = 0.75;                  // анимация пития
      this.lastPotionCol = def.col;
      def.apply.call(def, this, game);
      UI.toast(K.choice(Math.random, def.quips), '');
      UI.updateHUD(this);
    }

    toSave() {
      return {
        level: this.level, xp: this.xp, stats: this.stats, statPts: this.statPts,
        skillPts: this.skillPts, skills: this.skills, gold: this.gold,
        potions: this.potions, relics: this.relics, equipped: this.equipped,
        weapons: this.weapons, equippedWeapon: this.equippedWeapon, gems: this.gems,
        perm: this.perm, bought: this.bought, depth: this.depth,
        bestDepth: this.bestDepth, kills: this.kills, playtime: this.playtime,
        quests: this.quests || { main: null, side: null, prao: null, done: {}, unlocked: {} },
        adTickets: this.adTickets, trophies: this.trophies, factory: this.factory,
        buffs: {},
      };
    }
  }

  // ==================== ВРАГ ====================
  class Enemy {
    // plevel — уровень игрока: чем выше, тем толще и злее нечисть
    constructor(type, x, y, depth, plevel) {
      const def = DATA.ENEMIES[type];
      this.type = type; this.def = def;
      const pl = plevel || 1;
      const hpS = (1 + 0.24 * (depth - 1)) * DATA.lvlHpMul(pl);
      const dmS = (1 + 0.16 * (depth - 1)) * DATA.lvlDmgMul(pl);
      this.x = x; this.y = y;
      this.maxHp = Math.round(def.hp * hpS);
      this.hp = this.maxHp;
      this.dmg = def.dmg * dmS;
      this.speed = def.speed;
      this.xp = Math.round(def.xp * (1 + 0.16 * (depth - 1)));
      this.gold = K.irange(Math.random, def.gold[0], def.gold[1]);
      this.r = def.r;
      this.size = def.size;

      this.state = 'idle';
      this.phase = Math.random() * Math.PI * 2;
      this.moving = false;
      this.atkT = 0;       // анимация атаки 0..1
      this.atkCd = 0;
      this.hitT = 0;
      this.poisonT = 0; this.poisonTick = 0; this.poisonDps = 0;  // яд (Жало Скорпиона)
      this.burnT = 0; this.burnTick = 0; this.burnDps = 0;        // горение (Пламенный Кнут)
      this.charmT = 0;     // смущение
      this.slowT = 0;
      this.kbX = 0; this.kbY = 0; // отбрасывание
      this.fanT = 0;       // «поклонница» бьёт своих
      this.aggro = false;
      this.saidLine = false;
      this.dead = false;
      this.dieT = 0;
      this.lungeT = 0; this.lungeDx = 0; this.lungeDy = 0;
      this.spawnT = 0.35; // появление
    }

    // ---------- элитка: диабловские аффиксы (реестр DATA.ELITE_AFFIXES) ----------
    makeElite(rng) {
      const pool = DATA.ELITE_AFFIXES.slice();
      const n = rng() < 0.3 ? 2 : 1;
      const affixes = [];
      for (let i = 0; i < n && pool.length; i++) {
        const a = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        affixes.push(a);
        if (a.apply) a.apply(this);
      }
      this.elite = affixes;
      this.maxHp = Math.round(this.maxHp * 2.2); this.hp = this.maxHp;
      this.dmg *= 1.25;
      this.xp = Math.round(this.xp * 2.5);
      this.gold = Math.round(this.gold * 2.5);
      this.size *= 1.12; this.r *= 1.1;
      return this;
    }

    update(dt, game) {
      if (this.dead) return;   // труп неподвижен: ни КБ, ни хуки, ни аффиксы
      const p = game.player;
      // хук моба: своя логика каждый кадр (см. docs/EXTENDING.md)
      if (this.def.onTick) this.def.onTick(this, game, dt);
      // аффиксы элитки: свои тики (аура «Пылкой» и т.п.)
      if (this.elite) for (const a of this.elite) if (a.tick) a.tick(this, game, dt);
      this.hitT = Math.max(0, this.hitT - dt * 4);
      this.atkCd = Math.max(0, this.atkCd - dt);
      // доты: яд и огонь от оружия
      if (this.poisonT > 0) {
        this.poisonT -= dt; this.poisonTick -= dt;
        if (this.poisonTick <= 0) {
          this.poisonTick = 0.5;
          this.hp -= this.poisonDps * 0.5;
          game.dmgNums.add(this.x, this.y, this.poisonDps * 0.5, 'dmg');
          game.particles.spawn({ x: this.x, y: this.y - 0.4, vx: 0, vy: -24, life: 0.5, size: 2.5, col: '#a8e890' });
          if (this.hp <= 0) { this.die(game); return; }
        }
      }
      if (this.burnT > 0) {
        this.burnT -= dt; this.burnTick -= dt;
        if (this.burnTick <= 0) {
          this.burnTick = 0.5;
          this.hp -= this.burnDps * 0.5;
          game.dmgNums.add(this.x, this.y, this.burnDps * 0.5, 'dmg');
          game.particles.spawn({ x: this.x, y: this.y - 0.4, vx: (Math.random() - 0.5) * 20, vy: -40, life: 0.5, size: 3, col: '#ff9a4b' });
          if (this.hp <= 0) { this.die(game); return; }
        }
      }
      if (this.slowT > 0) this.slowT -= dt;
      if (this.spawnT > 0) { this.spawnT -= dt; return; }

      // смущение: стоит, краснеет, сердечки
      if (this.charmT > 0) {
        this.charmT -= dt;
        this.moving = false;
        if (this.fanT > 0) {
          // поклонница атакует ближайшую коллегу
          this.fanT -= dt;
          const ally = game.nearestEnemy(this.x, this.y, 2.2, this);
          if (ally && this.atkCd <= 0) {
            this.atkCd = 1.0; this.atkT = 1;
            ally.hurt(this.dmg * 1.2, game, this, true);
          }
          if (ally) { // идёт к коллеге
            const d = K.dist(this.x, this.y, ally.x, ally.y);
            if (d > 1) {
              this.x += (ally.x - this.x) / d * this.speed * dt;
              this.y += (ally.y - this.y) / d * this.speed * dt;
              this.moving = true; this.phase += dt * 8;
            }
          }
        }
        return;
      }

      const d = K.dist(this.x, this.y, p.x, p.y);
      // активация
      if (!this.aggro) {
        if (d < this.def.aggro && game.losToPlayer(this)) {
          this.aggro = true;
          if (!this.saidLine && Math.random() < 0.6) {
            game.enemyLine(this, 'aggro');
            this.saidLine = true;
          }
        } else {
          // лёгкое блуждание
          this.moving = false;
          return;
        }
      }

      // отбрасывание: kb задан в пикселях/сек — переводим в тайлы (/K.TW);
      // с мгновенной коллизией — сквозь стены не проскочить
      if (Math.abs(this.kbX) > 1 || Math.abs(this.kbY) > 1) {
        this.x += this.kbX / K.TW * dt; this.y += this.kbY / K.TW * dt;
        this.kbX *= Math.pow(0.001, dt); this.kbY *= Math.pow(0.001, dt);
        game.collideCircle(this);
      }
      // страховка: если всё же оказался в стене — вернуться в последнюю
      // безопасную точку (запоминаем её каждый кадр на открытом полу)
      if (Dungeon.isWall(game.level, this.x, this.y)) {
        this.x = this.lgx != null ? this.lgx : this.x;
        this.y = this.lgy != null ? this.lgy : this.y;
      } else if (!Dungeon.isWall(game.level, this.x + 0.25, this.y) ||
                 !Dungeon.isWall(game.level, this.x - 0.25, this.y) ||
                 !Dungeon.isWall(game.level, this.x, this.y + 0.25) ||
                 !Dungeon.isWall(game.level, this.x, this.y - 0.25)) {
        this.lgx = this.x; this.lgy = this.y;
      }

      // выпад (hunter)
      if (this.lungeT > 0) {
        this.lungeT -= dt;
        this.x += this.lungeDx * dt; this.y += this.lungeDy * dt;
        if (K.dist(this.x, this.y, p.x, p.y) < this.r + p.r + 0.15) {
          game.playerHurt(this.dmg * 1.3, this.def.name, false, this);
          this.lungeT = 0;
        }
        game.collideCircle(this);
        return;
      }

      const range = this.def.atkRange;
      const wantAtk = d < (this.def.attack === 'lunge' ? 3.8 : range + p.r);

      if (this.atkT > 0) {
        // замах → удар
        this.atkT -= dt * 2.6;
        if (this.atkT <= 0) {
          this.doAttack(game, d);
        }
        this.moving = false;
        return;
      }

      if (wantAtk && this.atkCd <= 0) {
        this.atkT = 1;
        this.atkCd = this.def.atkCd;
        this.moving = false;
        return;
      }

      // движение к игроку по полю потоков
      if (!wantAtk) {
        let dx = 0, dy = 0;
        if (this.def.flying || d < 3.5) {
          dx = p.x - this.x; dy = p.y - this.y;
          const dd = Math.hypot(dx, dy) || 1; dx /= dd; dy /= dd;
        } else {
          const st = game.flowStep(this.x, this.y);
          dx = st[0]; dy = st[1];
        }
        let sp = this.speed * (this.slowT > 0 ? 0.45 : 1);
        this.x += dx * sp * dt;
        this.y += dy * sp * dt;
        this.moving = true;
        this.phase += dt * 9;
      } else this.moving = false;

      game.collideCircle(this);
      // расталкивание с коллегами
      for (const o of game.enemies) {
        if (o === this || o.dead) continue;
        const dd = K.dist(this.x, this.y, o.x, o.y);
        const min = this.r + o.r;
        if (dd < min && dd > 0.001) {
          const push = (min - dd) * 0.5;
          this.x += (this.x - o.x) / dd * push;
          this.y += (this.y - o.y) / dd * push;
        }
      }
    }

    doAttack(game, d) {
      // атака из реестра (DATA.ATTACKS) или кастомный onAttack из описания моба
      DATA.runAttack(this, game, d);
    }

    hurt(val, game, src, noFlash) {
      if (this.dead) return;
      // ревность: смущённые получают больше
      if (this.charmT > 0 && game.player.hasSkill('jeal'))
        val *= 1 + 0.25 * game.player.skill('jeal');
      // аффикс «Хрупкая ярость»: сама бьёт страшно — но и держит удар плохо
      if (this.elite && this.elite.some(a => a.id === 'glass')) val *= 1.5;
      this.hp -= val;
      this.hitT = noFlash ? 0.3 : 1;
      // особенность оружия: реестр WEAPON_TRAITS или функция прямо в описании
      DATA.runWeaponTrait(game.player.weapon, this, game, val);
      // хук моба: реакция на полученный урон
      if (this.def.onHurt) this.def.onHurt(this, game, val);
      if (!this.aggro) { this.aggro = true; if (!this.saidLine && Math.random() < 0.5) { game.enemyLine(this, 'aggro'); this.saidLine = true; } }
      if (Math.random() < 0.18) game.enemyLine(this, 'hit');
      if (this.hp <= 0) this.die(game);
    }

    die(game) {
      this.dead = true; this.dieT = 1.0;
      this.kbX = 0; this.kbY = 0; this.lungeT = 0;   // падает там, где стояла
      AudioSys.sfx('edie');                                // крещендо-финал
      if (Math.random() < 0.55)
        game.dmgNums.add(this.x, this.y - 0.2, K.choice(Math.random, DATA.CLIMAX_QUIPS), 'quip');
      // хореография финала: сердечки нарастают вместе со стоном
      const px = this.x, py = this.y, D = game;
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          D.particles.hearts(px + (Math.random() - 0.5) * 0.4, py - 0.6, 1 + (i > 2 ? 1 : 0));
        }, 150 + i * 110);
      }
      // пик (~0.7с): залп сердец + искры + «послесвечение»
      setTimeout(() => {
        D.particles.hearts(px, py - 0.8, 8);
        D.particles.burst(px, py - 0.7, 14, '#ffd8ec', 110, { type: 'spark' });
        for (let i = 0; i < 3; i++) {
          D.particles.spawn({
            x: px + (Math.random() - 0.5) * 0.6, y: py - 0.6,
            vx: (Math.random() - 0.5) * 24, vy: -30 - Math.random() * 20,
            life: 1.3, size: 9 + Math.random() * 9,
            col: 'rgba(255,158,207,.38)',
          });
        }
      }, 720);
      // догорающие сердечки, когда она уже лежит
      setTimeout(() => D.particles.hearts(px, py - 1.0, 3), 1050);
      if (Math.random() < 0.3) game.enemyLine(this, 'die');
      if (this.def.onDeath) this.def.onDeath(this, game);   // хук моба
      // дроп
      game.spawnPickups(this.x, this.y, this.gold, this.xp);
      game.player.kills++;
      game.onEnemyDead(this);
    }
  }

  // ==================== БОСС ====================
  class Boss extends Enemy {
    constructor(bossId, x, y, depth, plevel) {
      const bd = DATA.BOSSES[bossId];
      const base = DATA.ENEMIES[bd.base];
      super(bd.base, x, y, depth, plevel);
      this.bossId = bossId; this.bd = bd;
      const pl = plevel || 1;
      const cyc = Math.floor(depth / 5 / 4); // каждый круг сильнее
      this.maxHp = Math.round(bd.hp * (1 + 0.24 * (depth - 1)) * DATA.lvlHpMul(pl) * (1 + cyc * 0.5));
      this.hp = this.maxHp;
      this.dmg = bd.dmg * (1 + 0.16 * (depth - 1)) * DATA.lvlDmgMul(pl);
      this.xp = Math.round(bd.xp * (1 + 0.16 * (depth - 1)));
      this.gold = K.irange(Math.random, bd.gold[0], bd.gold[1]);
      this.size = bd.size; this.r = bd.r;
      this.crown = true;
      this.aggro = false; // проснётся при входе
      this.patT = 2.2;    // таймер паттернов
      this.patIdx = 0;
      this.teleT = 0; this.teleR = 0; // телеграф-круг
      this.blinkCd = 0;
      this.enrage = false;
      this.silenceT = 0;
    }

    update(dt, game) {
      if (this.dead) { this.dieT -= dt; return; }
      const p = game.player;
      this.hitT = Math.max(0, this.hitT - dt * 4);
      if (this.spawnT > 0) { this.spawnT -= dt; return; }
      if (this.charmT > 0) { this.charmT -= dt * 0.35; return; } // босс почти не смущается

      const d = K.dist(this.x, this.y, p.x, p.y);
      if (!this.aggro) {
        if (d < 9) {
          this.aggro = true;
          game.bossIntro(this);
        }
        return;
      }

      // фаза 2
      if (!this.enrage && this.hp < this.maxHp * 0.45) {
        this.enrage = true;
        AudioSys.sfx('boss');
        UI.toast(this.bd.name + ' в ярости! (и в слезах)', '');
      }

      // телеграф удара «слэм»
      if (this.teleT > 0) {
        this.teleT -= dt;
        if (this.teleT <= 0) {
          // удар по площади в точке телеграфа
          const tx = this.teleX, ty = this.teleY;
          if (K.dist(p.x, p.y, tx, ty) < this.teleR) game.playerHurt(this.dmg * 1.6, this.bd.name);
          game.particles.burst(tx, ty, 26, '#ff7a8e', 110, { type: 'spark' });
          game.shake(9);
          AudioSys.sfx('crit');
        }
        return; // стоит, заряжается
      }

      this.patT -= dt * (this.enrage ? 1.5 : 1);
      if (this.patT <= 0) {
        this.patT = this.enrage ? 1.9 : 2.9;
        this.doPattern(game, d);
        return;
      }

      // обычное преследование
      if (d > 1.4) {
        const st = game.flowStep(this.x, this.y);
        const sp = this.speed * (this.enrage ? 1.35 : 1) * (this.slowT > 0 ? 0.5 : 1);
        this.x += st[0] * sp * dt; this.y += st[1] * sp * dt;
        this.moving = true; this.phase += dt * 6;
      } else {
        this.moving = false;
        if (this.atkCd <= 0) {
          this.atkCd = 1.6;
          this.atkT = 1;
        }
      }
      if (this.atkT > 0) {
        this.atkT -= dt * 2.2;
        if (this.atkT <= 0 && d < 2.2) game.playerHurt(this.dmg, this.bd.name, false, this);
      }
      game.collideCircle(this);
    }

    doPattern(game, d) {
      // паттерн: строка | ['имя', параметры] | собственная функция(b, game)
      const pats = this.bd.patterns;
      const pat = pats[this.patIdx++ % pats.length];
      if (typeof pat === 'function') { pat(this, game); return; }
      const name = Array.isArray(pat) ? pat[0] : pat;
      const params = Array.isArray(pat) ? (pat[1] || {}) : {};
      const fn = DATA.BOSS_PATTERNS[name];
      if (fn) fn(this, game, params);
    }

    hurt(val, game) {
      if (this.dead) return;
      this.hp -= val;
      this.hitT = 1;
      if (!this.aggro) { this.aggro = true; game.bossIntro(this); }
      if (this.hp <= 0) this.die(game);
    }

    die(game) {
      this.dead = true; this.dieT = 1.4;
      AudioSys.sfx('boss');
      AudioSys.sfx('edie');
      setTimeout(() => AudioSys.sfx('edie'), 620);          // босс — вдвойне громкий финал
      game.shake(14);
      for (let i = 0; i < 3; i++)
        setTimeout(() => game.particles.burst(this.x + (Math.random() - 0.5), this.y - 0.5, 30, '#ffd860', 130, { type: 'spark' }), i * 220);
      game.particles.hearts(this.x, this.y - 0.8, 14);
      // сердечковый дождь: босса уносит с небес Valentino
      for (let i = 0; i < 16; i++) {
        game.particles.spawn({
          x: this.x + (Math.random() - 0.5) * 3, y: this.y - 2.6 - Math.random() * 1.2,
          vx: (Math.random() - 0.5) * 20, vy: 30 + Math.random() * 40,
          life: 1.5, size: 4 + Math.random() * 4, col: '#ff6a9e',
          type: 'heart', grav: 60,
        });
      }
      game.dmgNums.add(this.x, this.y - 0.5, '♡ а-а-ах…', 'quip');
      game.spawnPickups(this.x, this.y, this.gold, this.xp, true);
      game.bossDefeated(this);
    }

    // lunge для dash-паттерна босса
  }

  // ==================== СНАРЯД ====================
  class Projectile {
    // fromPlayer=true: капли героя — бьют демонесс, а не героя
    constructor(x, y, vx, vy, dmg, col, r, slow, fromPlayer, mult) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.dmg = dmg; this.col = col; this.r = r || 0.15;
      this.slow = slow || 0;
      this.fromPlayer = !!fromPlayer;
      this.mult = mult != null ? mult : 1;
      this.t = 0; this.life = 3.2;
      this.homing = 0;
      this.dead = false;
    }
    update(dt, game) {
      this.t += dt;
      if (this.t > this.life) { this.dead = true; return; }
      if (this.homing > 0) {
        this.homing -= dt;
        const p = game.player;
        const a = K.angTo(this.x, this.y, p.x, p.y);
        const sp = Math.hypot(this.vx, this.vy);
        const ca = Math.atan2(this.vy, this.vx);
        const na = ca + K.clamp(K.angDiff(ca, a), -2.2 * dt, 2.2 * dt);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Dungeon.isWall(game.level, this.x, this.y)) {
        this.dead = true;
        game.particles.burst(this.x, this.y, 6, this.col, 50);
        return;
      }
      if (this.fromPlayer) {
        // капли героя: первая задетая демонесса получает урон, капля гаснет
        for (const e of game.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (K.dist(this.x, this.y, e.x, e.y) < this.r + e.r) {
            this.dead = true;
            game.hitEnemy(e, this.mult, { noCombo: true });
            game.particles.burst(this.x, this.y - 0.3, 6, '#f4f0ff', 60);
            break;
          }
        }
        return;
      }
      const p = game.player;
      if (K.dist(this.x, this.y, p.x, p.y) < this.r + p.r) {
        this.dead = true;
        game.playerHurt(this.dmg, 'снаряд');
        if (this.slow) p.slowT = this.slow;
      }
    }
  }

  // ==================== ДРОПЫ ====================
  class Pickup {
    constructor(x, y, kind, val) {
      this.x = x; this.y = y; this.kind = kind; this.val = val;
      this.t = Math.random() * 3; this.dead = false;
      this.vx = (Math.random() - 0.5) * 3; this.vy = (Math.random() - 0.5) * 3;
    }
    update(dt, game) {
      this.t += dt;
      // разлёт при появлении
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.vx *= Math.pow(0.01, dt); this.vy *= Math.pow(0.01, dt);
      const p = game.player;
      const d = K.dist(this.x, this.y, p.x, p.y);
      if (d < 1.5) { // магнит
        this.x += (p.x - this.x) / d * 6 * dt;
        this.y += (p.y - this.y) / d * 6 * dt;
      }
      if (d < 0.45) {
        this.dead = true;
        if (this.kind === 'gold') {
          p.gold += Math.max(1, Math.round(this.val * (1 + p.goldPct / 100)));
          AudioSys.sfx('coin');
          UI.goldPing(p);
        } else if (this.kind === 'gem') {
          p.gems.push(this.val);
          if (window.QuestSys) QuestSys.onPickup(p, 'gem', this.val);
          AudioSys.sfx('relic');
          UI.toast('Камень: ' + DATA.gemName(this.val) + ' — ' + DATA.gemTxt(this.val), 'gold');
          SaveSys.save(game);
        } else if (this.kind === 'weapon') {
          const w = this.val;
          if (p.weapons.owned[w.id]) {
            const comp = 80 * w.tier;
            p.gold += comp;
            p.gems.push(DATA.gemInstance(game.rng, game.level.depth));
            AudioSys.sfx('coin');
            UI.toast('Дубликат «' + w.name + '» → ' + comp + '💰 и камень', 'gold');
          } else {
            p.weapons.owned[w.id] = { sharp: 0, gems: [] };
            if (window.QuestSys) QuestSys.onWeapon(p, w);
            AudioSys.sfx('relic');
            UI.dialogue('Кекс', 'Новое оружие: «' + w.name + '». ' + w.quip);
            UI.toast('Оружие: ' + w.name + ' ' + '★'.repeat(w.tier), 'gold');
          }
          SaveSys.save(game);
        } else if (this.kind === 'heart') {
          p.hp = K.clamp((p.hp || p.maxHp) + this.val, 0, p.maxHp);
          AudioSys.sfx('heart');
          game.dmgNums.add(p.x, p.y, this.val, 'heal');
          if (window.QuestSys) QuestSys.onPickup(p, 'heart');
        } else if (this.kind === 'potion') {
          const pd = DATA.POTION_BY_ID(this.val);
          p.potions[this.val] = (p.potions[this.val] || 0) + 1;
          AudioSys.sfx('potion');
          UI.toast('+1 ' + pd.name, 'gold');
        } else if (this.kind === 'relic') {
          p.relics.push(this.val);
          AudioSys.sfx('relic');
          const def = DATA.RELIC_POOL.find(r => r.id === this.val.def);
          UI.toast('Реликвия: ' + (def ? def.name : '?') + ' (' + DATA.RARITIES[this.val.rarity] + ')', 'gold');
          SaveSys.save(game);
        }
        UI.updateHUD(p);
      }
    }
  }

  window.Entities = { Particles, DamageNumbers, Player, Enemy, Boss, Projectile, Pickup };
})();
