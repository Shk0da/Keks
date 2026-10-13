// quests.js — движок квестов: главы сюжета, поручения Векс, квест Праотца.
// Состояние живёт в player.quests {main, side, prao, done:{}, unlocked:{}};
// прогресс двигают хуки из игры (onKill/onPickup/onBossDefeated/onWeapon/onDepth).
'use strict';
window.QuestSys = (function () {

  function state(p) {
    if (!p.quests) p.quests = { main: null, side: null, prao: null, done: {}, unlocked: {} };
    const q = p.quests;
    if (!q.done) q.done = {};
    if (!q.unlocked) q.unlocked = {};
    return q;
  }

  function npcUnlocked(p, npcId) {
    const st = state(p);
    if (st.unlocked[npcId]) return true;
    const npc = DATA.NPCS[npcId];
    if (!npc) return false;
    if (!npc.unlock) { st.unlocked[npcId] = true; return true; }
    if (npc.unlock(p)) { st.unlocked[npcId] = true; return true; }
    return false;
  }

  // ---------- цели ----------
  const OBJ = {
    kill:    { text: (o) => 'Убить «' + (o.target === 'any' ? 'любых' : DATA.ENEMIES[o.target].name) + '»: {n}/' + o.n },
    bossKill:{ text: (o) => 'Повергнуть боссов: {n}/' + o.n },
    bossDepth:{ text: (o) => 'Повергнуть босса с глубины ' + o.depth + '{ok}' },
    collect: { text: (o) => 'Собрать ' + ({ heart: 'сердечки', gem: 'камни', potion: 'зелья', relic: 'реликвии' }[o.what] || o.what) + ': {n}/' + o.n },
    gemRarity:{ text: (o) => 'Принести ' + DATA.GEM_RARITIES[o.rar].name.toLowerCase() + ' камень: {n}/' + o.n },
    weaponTier:{ text: (o) => 'Оружие ' + '★'.repeat(o.tier) + '{ok}' },
    depth:   { text: (o) => 'Достичь глубины ' + o.depth + '{ok}' },
  };

  function objText(o, n) {
    const t = (OBJ[o.kind] || OBJ.kill).text(o);
    return t.replace('{n}', String(n)).replace('{ok}', n > 0 ? ' ✓' : '');
  }
  function objDone(o, n) {
    switch (o.kind) {
      case 'bossDepth': return n > 0;
      case 'weaponTier': return n > 0;
      case 'depth': return n > 0;
      default: return n >= o.n;
    }
  }
  function questComplete(aq) {
    if (!aq) return false;
    return aq.def.goal.every((o, i) => objDone(o, aq.prog[i]));
  }

  // ---------- предложения ----------
  // следующая глава сюжета (по порядку QUESTS, с учётом next)
  function mainOffer(p) {
    const st = state(p);
    if (st.main) return null;
    for (const q of DATA.QUESTS) {
      if (st.done[q.id]) continue;
      // глава доступна, если предыдущая выполнена (или это q1)
      if (q.id === 'q1') return q;
      const prev = DATA.QUESTS.find(x => x.next === q.id);
      if (prev && st.done[prev.id]) return q;
    }
    return null;
  }
  function praoOffer(p) {
    const st = state(p);
    return npcUnlocked(p, 'prao') && !st.done.pq1 ? DATA.PRAO_QUEST : null;
  }
  function genSide() {
    const t = DATA.SIDE_TEMPLATES[Math.floor(Math.random() * DATA.SIDE_TEMPLATES.length)];
    return { id: 'side_' + Date.now(), side: true, npc: 'veks',
      name: t.name(), goal: t.goal(null), reward: t.reward() };
  }

  function accept(p, slot, def) {
    const st = state(p);
    const aq = { def, prog: def.goal.map(o => 0) };
    if (slot === 'main') st.main = aq;
    else if (slot === 'side') st.side = aq;
    else st.prao = aq;
    // мгновенные цели проверяем сразу (оружие/глубина могли уже быть)
    checkInstant(p);
    SaveSys.save(window.game);
  }

  function checkInstant(p) {
    const st = state(p);
    const all = [st.main, st.side, st.prao];
    for (const aq of all) {
      if (!aq) continue;
      aq.def.goal.forEach((o, i) => {
        if (o.kind === 'weaponTier' && aq.prog[i] === 0) {
          const ok = Object.keys(p.weapons.owned).some(id => DATA.WEAPON_BY_ID(id).tier >= o.tier);
          if (ok) aq.prog[i] = 1;
        }
        if (o.kind === 'depth' && aq.prog[i] === 0 && p.depth >= o.depth) aq.prog[i] = 1;
      });
    }
  }

  // ---------- хуки прогресса ----------
  function bump(p, aq, i, add) {
    if (!aq || questComplete(aq)) return;
    const o = aq.def.goal[i];
    if (objDone(o, aq.prog[i])) return;
    aq.prog[i] += add;
    if (objDone(o, aq.prog[i]) && questComplete(aq)) {
      UI.toast('✓ «' + aq.def.name + '» — вернись в лагерь!', 'gold');
      AudioSys.sfx('chest');
    }
  }
  function each(p, kind, fn) {
    const st = state(p);
    [st.main, st.side, st.prao].forEach(aq => {
      if (!aq || questComplete(aq)) return;
      aq.def.goal.forEach((o, i) => fn(aq, o, i));
    });
  }

  function onKill(p, e) {
    each(p, 'kill', (aq, o, i) => {
      if (o.kind === 'kill' && (o.target === 'any' || o.target === e.type)) bump(p, aq, i, 1);
    });
  }
  function onBossDefeated(p, depth) {
    each(p, 'boss', (aq, o, i) => {
      if (o.kind === 'bossKill') bump(p, aq, i, 1);
      if (o.kind === 'bossDepth' && depth >= o.depth) bump(p, aq, i, 1);
    });
  }
  function onPickup(p, kind, val) {
    each(p, 'pick', (aq, o, i) => {
      if (o.kind === 'collect' && o.what === kind) bump(p, aq, i, 1);
      if (o.kind === 'gemRarity' && kind === 'gem' && val && val.rar >= o.rar) bump(p, aq, i, 1);
    });
  }
  function onWeapon(p, w) {
    each(p, 'wpn', (aq, o, i) => {
      if (o.kind === 'weaponTier' && w.tier >= o.tier) bump(p, aq, i, 1);
    });
  }
  function onDepth(p, depth) {
    each(p, 'depth', (aq, o, i) => {
      if (o.kind === 'depth' && depth >= o.depth) bump(p, aq, i, 1);
    });
  }

  // ---------- сдача ----------
  function turnIn(p, slot) {
    const st = state(p);
    const aq = slot === 'main' ? st.main : slot === 'side' ? st.side : st.prao;
    if (!aq || !questComplete(aq)) return null;
    const r = aq.def.reward || {};
    if (r.gold) p.gold += r.gold;
    if (r.xp && window.game) p.gainXp(r.xp, window.game);
    if (r.potions) p.potions.heal = (p.potions.heal || 0) + r.potions;
    if (r.relic != null) p.relics.push(DATA.relicInstance(Math.random, null, r.relic));
    if (r.gems) for (let i = 0; i < (r.gems[1] || 1); i++)
      p.gems.push({ type: DATA.GEM_TYPES[Math.floor(Math.random() * DATA.GEM_TYPES.length)].id, rar: r.gems[0], uid: Date.now() + i });
    if (r.relicUnique) p.relics.push({ def: r.relicUnique, rarity: 3, uid: Date.now() });
    st.done[aq.def.id] = true;
    if (slot === 'main') st.main = null;
    else if (slot === 'side') st.side = null;
    else st.prao = null;
    AudioSys.sfx('levelup');
    SaveSys.save(window.game);
    return aq.def;
  }

  // краткий трекер для HUD: первая незавершённая цель
  function tracker(p) {
    const st = state(p);
    const aq = st.main || st.prao || st.side;
    if (!aq) return null;
    for (let i = 0; i < aq.def.goal.length; i++) {
      const o = aq.def.goal[i];
      if (!objDone(o, aq.prog[i])) {
        return { name: aq.def.name, text: objText(o, aq.prog[i]) };
      }
    }
    return { name: aq.def.name, text: '✓ вернись в лагерь' };
  }

  return { state, npcUnlocked, mainOffer, praoOffer, genSide, accept,
           onKill, onBossDefeated, onPickup, onWeapon, onDepth,
           questComplete, turnIn, tracker, objText };
})();
