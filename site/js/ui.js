// ui.js — DOM-интерфейс: экраны, HUD, джойстик, лагерь, навыки, реликвии, торговка.
'use strict';
window.UI = (function () {

  const $ = id => document.getElementById(id);
  let game = null;

  // ===================== Режим лагеря =====================
  function campMode(on) {
    $('hud').classList.toggle('camp-mode', !!on);
    const bi = $('btnInteract');
    if (bi) bi.classList.toggle('hidden', !on);   // .hidden!important сильнее CSS-режима
    if (on) $('hud').classList.remove('hidden');
  }
  // возврат из оверлеев в сцену лагеря
  function campBack() {
    AudioSys.sfx('uiBack');
    hideAll();
    if (window.game.state === 'campScene') campMode(true);
  }

  // ===================== Экраны =====================
  const screens = ['scrAge', 'scrTitle', 'scrAbout', 'scrCamp', 'scrSkills',
    'scrArmory', 'scrRelics', 'scrTrader', 'scrNpc', 'scrGate', 'scrFactory',
    'scrSettings', 'scrDescend', 'scrDead', 'scrPause'];
  let settingsFrom = 'title'; // куда возвращаться из настроек

  function show(name) {
    const cap = n => n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
    screens.forEach(s => $(s).classList.toggle('hidden', s !== 'scr' + cap(name)));
    $('hud').classList.toggle('hidden', name != null);
    if (name == null) campMode(false);   // выход из лагерного режима HUD
    if (name === 'title') onTitle();
    if (name === 'camp') onCamp();
    if (name === 'skills') renderSkills();
    if (name === 'gate') renderGate();
    if (name === 'factory') renderFactory();
    if (name === 'armory') renderArmory();
    if (name === 'relics') renderRelics();
    if (name === 'trader') renderTrader();
    if (name === 'settings') loadSettingsUI();
  }
  function hideAll() { show(null); }

  // ===================== Джойстик =====================
  let stick = { active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0 };
  function move() { return stick; }

  function initStick() {
    const zone = $('stickZone'), base = $('stickBase'), knob = $('stickKnob');
    const R = 52;
    const onStart = e => {
      for (const t of e.changedTouches) {
        if (stick.active) break;
        stick.active = true; stick.id = t.identifier;
        stick.bx = t.clientX; stick.by = t.clientY;
        const side = settings.stickSide === 'right';
        base.style.left = '';
        base.style.right = side ? '40px' : '';
        base.style.left = side ? '' : '40px';
        base.classList.add('on');
        position(t);
      }
      e.preventDefault();
    };
    const onMove = e => {
      for (const t of e.changedTouches) if (t.identifier === stick.id) position(t);
      e.preventDefault();
    };
    const onEnd = e => {
      for (const t of e.changedTouches) if (t.identifier === stick.id) {
        stick.active = false; stick.id = null; stick.dx = 0; stick.dy = 0;
        base.classList.remove('on');
        knob.style.transform = '';
      }
      e.preventDefault();
    };
    const position = t => {
      let dx = t.clientX - stick.bx, dy = t.clientY - stick.by;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      stick.dx = dx / R; stick.dy = dy / R;
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    zone.addEventListener('touchstart', onStart, { passive: false });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd, { passive: false });
    zone.addEventListener('touchcancel', onEnd, { passive: false });
  }

  // мышь для десктопа: драг по канвасу двигает
  function initMouseStick() {
    const c = $('c');
    let down = false;
    c.addEventListener('mousedown', e => {
      if (e.target.closest('#actBtns,#topBar,.scr,#dlg')) return;
      down = true;
      stick.active = true; stick.bx = e.clientX; stick.by = e.clientY;
      $('stickBase').classList.add('on');
    });
    window.addEventListener('mousemove', e => {
      if (!down) return;
      let dx = e.clientX - stick.bx, dy = e.clientY - stick.by;
      const len = Math.hypot(dx, dy), R = 52;
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      stick.dx = dx / R; stick.dy = dy / R;
      $('stickKnob').style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    window.addEventListener('mouseup', () => {
      if (!down) return;
      down = false; stick.active = false; stick.dx = 0; stick.dy = 0;
      $('stickBase').classList.remove('on');
      $('stickKnob').style.transform = '';
    });
  }

  // ===================== HUD =====================
  let iconsBuilt = false;
  function buildIcons() {
    if (iconsBuilt || !window.Sprites || !Sprites.icon) return;
    iconsBuilt = true;
    document.querySelectorAll('[data-icon]').forEach(function(el) {
      var cv = Sprites.icon(el.dataset.icon);
      if (cv) { cv.className = 'btn-icon'; el.textContent = ''; el.appendChild(cv); }
    });
  }

  let cdBtns = null;
  let potionBarBuilt = false;

  function buildPotionBar() {
    if (potionBarBuilt) return;
    potionBarBuilt = true;
    const bar = $('potionBar');
    bar.innerHTML = '';
    DATA.POTIONS.forEach(pt => {
      const b = document.createElement('button');
      b.className = 'pbtn';
      b.id = 'pbtn_' + pt.id;
      b.style.setProperty('--pcol', pt.col);
      b.innerHTML = pt.glyph + '<span class="pcnt" id="pcnt_' + pt.id + '">0</span>';
      const drink = e => { e.preventDefault(); game.state === 'dungeon' && game.player.tryPotion(game, pt.id); };
      b.addEventListener('touchstart', drink, { passive: false });
      b.addEventListener('mousedown', drink);
      bar.appendChild(b);
    });
  }

  function updateHUD(p) {
    if (!p) return;
    buildPotionBar();
    if (!p) return;
    const hp = p.hp != null ? p.hp : p.maxHp;
    $('hpFill').style.width = K.clamp(hp / p.maxHp * 100, 0, 100) + '%';
    $('hpText').textContent = '❤ ' + Math.ceil(hp) + '/' + p.maxHp;
    document.querySelector('.hpbar').classList.toggle('low', hp < p.maxHp * 0.3);
    $('mpFill').style.width = K.clamp(p.mp / p.maxMp * 100, 0, 100) + '%';
    $('mpText').textContent = '✦ ' + Math.floor(p.mp);
    $('xpFill').style.width = K.clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
    $('lvlLabel').textContent = p.level >= DATA.MAX_LEVEL
      ? 'ур. 100 · МАКС'
      : 'ур. ' + p.level + (p.statPts + p.skillPts > 0 ? ' · +' + (p.statPts + p.skillPts) : '');
    $('goldLabel').textContent = '💰 ' + K.fmt(p.gold);
    $('depthLabel').textContent = game.level && game.level.isCamp
      ? 'Лагерь «Последний Взгляд»'
      : game.level
      ? (game.level.isBoss ? 'БOСС · ' : '') + 'глубина ' + game.level.depth +
        ' · угроза ' + DATA.threat(game.level.depth, p.level) +
        (game.level.parTime
          ? ' · ⏱ ' + Math.max(0, Math.ceil(game.level.parTime -
              (p.playtime - (game.level.startTime || 0)))) + 'с'
          : '')
      : '';
    // кнопка оружейной в цвете текущего хлыста
    const aq = $('btnArmoryQuick');
    if (aq) {
      aq.style.borderColor = p.weapon.color;
      aq.style.boxShadow = '0 0 12px ' + K.rgba(p.weapon.color, 0.45);
    }
    // зелья: счётчики и кулдауны
    DATA.POTIONS.forEach(pt => {
      const btn = $('pbtn_' + pt.id), cnt = $('pcnt_' + pt.id);
      if (!btn) return;
      const n = p.potions[pt.id] || 0;
      cnt.textContent = n;
      btn.classList.toggle('empty', n === 0);
      const cd = p.potCd[pt.id] || 0;
      let ring = btn.querySelector('.cdRing');
      if (!ring && cd > 0) { ring = document.createElement('span'); ring.className = 'cdRing'; btn.appendChild(ring); }
      if (ring) {
        if (cd > 0) ring.style.setProperty('--p', (cd / pt.cd * 100) + '%');
        else ring.remove();
      }
      btn.classList.toggle('cd', cd > 0.05);
    });
    // активные эффекты эликсиров + «Азарт»
    const fxMap = [['speed', '🐇 Прыть'], ['power', '💥 Гнев'], ['fury', '⚡ Месть'],
                   ['manafree', '💧 Слёзы'], ['invuln', '✨ Дух']];
    let buffHtml = '';
    if (p.streak > 1) {
      buffHtml += '<span class="buffPill" style="--bcol:#ffd860">🔥 Азарт ×' +
        game.streakMult.toFixed(1) + ' (' + p.streak + ')</span>';
    }
    // трекер активного задания
    if (window.QuestSys && game.state === 'dungeon') {
      const tr = QuestSys.tracker(p);
      if (tr) buffHtml += '<span class="buffPill" style="--bcol:#c86aff">📜 ' + tr.text + '</span>';
    }
    for (const [k, label] of fxMap) {
      const t = p.fx ? p.fx[k] : 0;
      if (t > 0) buffHtml += '<span class="buffPill" style="--bcol:' +
        DATA.POTION_BY_ID(k === 'manafree' ? 'mana' : k).col + '">' + label + ' ' + t.toFixed(0) + 'с</span>';
    }
    $('buffBar').innerHTML = buffHtml;
    // кулдауны
    setCd($('btnSpin'), p.spinCd / p.spinCdMax);
    setCd($('btnDash'), p.dashCd / p.dashCdMax);
    setCd($('btnCharm'), p.charmCd / p.charmCdMax);
    setCd($('btnSpatter'), p.spatterCd / p.spatterCdMax);
  }
  function setCd(btn, f) {
    f = K.clamp(f, 0, 1);
    let ring = btn.querySelector('.cdRing');
    if (!ring) { ring = document.createElement('span'); ring.className = 'cdRing'; btn.appendChild(ring); }
    ring.style.setProperty('--p', (f * 100) + '%');
    btn.classList.toggle('cd', f > 0.02);
  }
  function goldPing() { updateHUD(game.player); }

  // ===================== Диалоги/тосты/баннеры/карточки =====================
  // диабловская карточка перехода: «Глубина N · Название темы» + реплика
  function floorCard(depth) {
    const g = window.game;
    const th = g && g.level ? g.level.theme : null;
    const el = $('floorCard');
    el.querySelector('.fc-depth').textContent = 'ГЛУБИНА ' + depth;
    el.querySelector('.fc-name').textContent = th ? th.name : 'Подземелье';
    const nextBoss = depth % 5 === 0;
    el.querySelector('.fc-quip').textContent = nextBoss
      ? 'Тут пахнет духами и злобой. Босс рядом.'
      : (th ? th.quip : '');
    el.classList.remove('hidden', 'on');
    void el.offsetWidth;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 1150);
  }

  const dlgQ = [];
  let dlgBusy = false;
  function dialogue(who, text) {
    dlgQ.push({ who, text });
    pumpDlg();
  }
  function pumpDlg() {
    if (dlgBusy || !dlgQ.length) return;
    dlgBusy = true;
    const d = dlgQ.shift();
    const el = $('dlg');
    el.classList.remove('hidden', 'fade');
    $('dlgWho').textContent = d.who + ':';
    $('dlgText').textContent = d.text;
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => {
      el.classList.add('hidden');
      dlgBusy = false;
      pumpDlg();
    }, 3000);
  }
  function toast(msg, cls) {
    const t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
  function bossBannerShow(name, sub) {
    const b = $('bossBanner');
    b.innerHTML = name + (sub ? '<small>' + sub + '</small>' : '');
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.add('hidden'), 3300);
  }

  // ===================== Жители и квесты =====================
  let npcOpen = null;

  function npcQuestState(p, npcId) {
    const st = QuestSys.state(p);
    const slots = { main: st.main, side: st.side, prao: st.prao };
    for (const s of ['main', 'prao', 'side']) {
      const aq = slots[s];
      if (aq && aq.def.npc === npcId) {
        return { slot: s, aq, done: QuestSys.questComplete(aq) };
      }
    }
    // есть ли предложение
    if (npcId === 'veks') {
      if (QuestSys.mainOffer(p) && QuestSys.mainOffer(p).npc === 'veks') return { offer: 'main', def: QuestSys.mainOffer(p) };
      if (!st.side) return { offer: 'side', def: QuestSys.genSide() };
    }
    if (npcId === 'moza') {
      const o = QuestSys.mainOffer(p);
      if (o && o.npc === 'moza') return { offer: 'main', def: o };
    }
    if (npcId === 'prao') {
      const o = QuestSys.praoOffer(p);
      if (o) return { offer: 'prao', def: o };
    }
    return {};
  }

  function renderNpcs() {
    const p = game.player;
    const box = $('campNpcs');
    let html = '';
    for (const id of ['veks', 'moza', 'prao']) {
      if (!QuestSys.npcUnlocked(p, id)) continue;
      const n = DATA.NPCS[id];
      const qs = npcQuestState(p, id);
      let mark = '';
      if (qs.aq) mark = qs.done ? '<span class="npc-mark done">?</span>' : '<span class="npc-mark" style="color:var(--rose)">…</span>';
      else if (qs.offer) mark = '<span class="npc-mark q">!</span>';
      html += '<div class="npc-card" data-npc="' + id + '" style="--ncol:' + n.col + '">' +
        '<span class="npc-face" style="border-color:' + n.col + ';box-shadow:0 0 10px ' + K.rgba(n.col, 0.35) + '">' + n.glyph + '</span>' +
        '<span><b>' + n.name + '</b>поговорить</span>' + mark + '</div>';
    }
    box.innerHTML = html || '<span class="dim" style="font-size:12px">Жители появятся по мере твоих подвигов…</span>';
    box.querySelectorAll('.npc-card').forEach(el => {
      el.onclick = () => openNpc(el.dataset.npc);
    });
  }

  function openNpc(id) {
    const p = game.player;
    const n = DATA.NPCS[id];
    npcOpen = id;
    $('npcHead').innerHTML = '<span class="npc-face" style="border-color:' + n.col + ';box-shadow:0 0 14px ' + K.rgba(n.col, 0.4) + '">' + n.glyph + '</span>' +
      '<h2>' + n.name + '</h2>';
    const qs = npcQuestState(p, id);
    let body = '<div class="npc-story">' + K.choice(Math.random, n.greet) + '</div>';
    let actions = '<button class="btn" onclick="UI.closeNpc()">Уйти</button>';

    if (qs.aq) {
      const aq = qs.aq;
      body += '<div class="npc-quest"><h4>«' + aq.def.name + '»</h4>';
      aq.def.goal.forEach((o, i) => {
        const done = QuestSys.objText(o, aq.prog[i]);
        const ok = aq.prog[i] >= (o.n != null ? o.n : 1);
        body += '<div class="npc-obj' + (ok ? ' ok' : '') + '">• ' + done + '</div>';
      });
      body += '</div>';
      if (qs.done) {
        const rw = aq.def.reward || {};
        const rwTxt = [rw.gold && rw.gold + '💰', rw.xp && rw.xp + 'опыта', rw.potions && rw.potions + ' зелий',
                       rw.relic != null && 'реликвия', rw.gems && rw.gems[1] + '× камень', rw.relicUnique && 'УНИКАЛЬНАЯ реликвия']
          .filter(Boolean).join(', ');
        body += '<div class="npc-story" style="color:var(--gold)">Награда: ' + rwTxt + '</div>';
        actions = '<button class="btn primary" onclick="UI.turnInNpc(\'' + qs.slot + '\')">Выполнено! Получить награду</button>' + actions;
      }
    } else if (qs.offer) {
      const d = qs.offer === 'side' ? qs.def : qs.def;
      body += '<div class="npc-quest"><h4>«' + d.name + '»</h4><div class="npc-story">' +
        (d.story ? d.story.join('<br>') : 'Поручение простое, а плата — звонкая.') + '</div>';
      d.goal.forEach(o => {
        body += '<div class="npc-obj">• ' + QuestSys.objText(o, 0) + '</div>';
      });
      body += '</div>';
      actions = '<button class="btn primary" onclick="UI.acceptNpc(\'' + qs.offer + '\')">Принять</button>' + actions;
    } else if (id === 'veks') {
      body += '<div class="dim" style="font-size:12px">Кстати, витрина — вон там. Товар не смотрит в зубы.</div>';
      actions += ' <button class="btn" onclick="UI.openTraderFromNpc()">К товарам</button>' +
        ' <button class="btn" onclick="UI.veksAdPotion()">🎬 2 зелья</button>';
    } else if (id === 'moza') {
      body += '<div class="dim" style="font-size:12px">Печать терпелива. Глубины — нет.</div>';
    } else if (id === 'prao') {
      body += '<div class="dim" style="font-size:12px">Дно всегда ниже, чем кажется. Проверено.</div>';
    }
    $('npcBody').innerHTML = body + '<div class="npc-actions">' + actions + '</div>';
    AudioSys.sfx('ui');
    show('npc');
  }

  function closeNpc() { campBack(); }

  function acceptNpc(slot) {
    const p = game.player;
    if (slot === 'side') QuestSys.accept(p, 'side', QuestSys.genSide());
    else {
      const def = slot === 'prao' ? QuestSys.praoOffer(p) : QuestSys.mainOffer(p);
      if (def) QuestSys.accept(p, slot, def);
    }
    AudioSys.sfx('charm');
    openNpc(npcOpen);
  }

  function turnInNpc(slot) {
    const p = game.player;
    const def = QuestSys.turnIn(p, slot);
    if (!def) return;
    UI.toast('✓ ' + def.name, 'gold');
    if (def.outro) setTimeout(() => UI.dialogue(def.npc === 'veks' ? 'Мадам Векс' :
      def.npc === 'moza' ? 'Мозаика' : 'Праотец', def.outro), 600);
    if (def.final) {
      setTimeout(() => UI.bossBannerShow('ПЕЧАТЬ ВОССТАНОВЛЕНА', 'цензура спасена — стыд восторжествовал'), 1400);
    }
    openNpc(npcOpen);
  }

  function openTraderFromNpc() { show('trader'); }


  // ===================== Оружейная из подземелья =====================
  function openArmoryQuick() {
    if (game.state === 'dungeon' && !game.paused) game.paused = true;  // бой на паузу
    show('armory');
    AudioSys.sfx('ui');
  }
  function armoryBack() {
    if (game.state === 'dungeon') { game.paused = false; show(null); }
    else campBack();
  }

  // ===================== Врата и фабрика =====================
  function renderGate() {
    const p = game.player;
    $('gateInfo').textContent = 'Глубина ' + p.depth + (p.depth % 5 === 0 ? ' — логово босса!' : '') +
      ' · угроза ' + DATA.threat(p.depth, p.level) +
      ' · билетов рекламы: ' + (p.adTickets || 0) + ' 🎟';
    $('btnGateBoost').textContent = p.adXpT > 0
      ? '×2 опыт: ещё ' + Math.ceil(p.adXpT) + ' сек'
      : '🎬 ×2 опыт на 2 мин';
    $('btnGateBoost').disabled = p.adXpT > 0;
  }

  const HIRE_COST = [400, 2000, 8000, 25000];
  function renderFactory() {
    const g = game, p = g.player, f = p.factory;
    const rate = g.factoryRate();
    const lvl = f.imps;
    $('factoryBody').innerHTML =
      'Импов-работяг: <b>' + lvl + '</b> · скорость: <b>' + rate.toFixed(1) + ' золота/сек</b><br>' +
      'Накоплено: <b>' + Math.floor(f.acc) + ' 💰</b> · трофеев в запасе: <b>' + p.trophies + '</b><br>' +
      '<span class="dim" style="font-size:12px">Трофеи падают с демонесс (элитки ×3, боссы ×25). Офлайн фабрика работает на 1/60 скорости.</span>';
    const hire = $('btnFactoryHire');
    if (lvl >= HIRE_COST.length) { hire.textContent = 'Все импы наняты'; hire.disabled = true; }
    else {
      hire.textContent = 'Нанять импа — ' + HIRE_COST[lvl] + ' 💰';
      hire.disabled = p.gold < HIRE_COST[lvl];
    }
  }

  // ===================== Оружейная =====================
  let armorySel = null;
  let gemPickSocket = -1; // выбранный слот для вставки камня

  function renderArmory() {
    const p = game.player;
    if (!armorySel || !p.weapons.owned[armorySel]) armorySel = p.equippedWeapon;
    const sel = armorySel;
    const wsel = DATA.WEAPON_BY_ID(sel);
    const st = p.weapons.owned[sel];

    $('armoryGold').textContent = 'Золото: ' + K.fmt(p.gold) + ' 💰 · в руках: «' +
      DATA.WEAPON_BY_ID(p.equippedWeapon).name + '»';

    // список: всё оружие коллекции, неоткрытое — силуметами
    $('weaponList').innerHTML = DATA.WEAPONS.map(w => {
      const own = p.weapons.owned[w.id];
      const traitTxt = w.trait ? traitText(w.trait) : '—';
      return own
        ? '<div class="wp-it' + (w.id === sel ? ' sel' : '') + (w.id === p.equippedWeapon ? ' eq' : '') + '" data-w="' + w.id + '">' +
            '<span class="whipcol" style="background:' + w.color + ';color:' + w.color + '"></span>' +
            '<b>' + w.name + '</b>' +
            '<span class="tier">' + '★'.repeat(w.tier) + '</span> ' +
            '×' + w.dmg.toFixed(2) + ' урон · заточка +' + own.sharp +
            '<br>' + traitTxt + '</div>'
        : '<div class="wp-it locked" data-w="' + w.id + '"><b>???</b>' +
            '<span class="tier">' + '★'.repeat(w.tier) + '</span> глубина ' + ((w.tier - 1) * 5 + 1) + '+' +
            '<br>ещё не найдено</div>';
    }).join('');

    // деталь выбранного
    const sockets = p.weaponSockets(sel);
    const canSharp = st.sharp < DATA.SHARP_MAX;
    const cost = DATA.sharpCost(wsel, st.sharp);
    const gemSum = DATA.GEM_TYPES.map(t => {
      const v = DATA.GEM_KEY[t.id];
      // бонусы камней выбранного оружия
      let sum = 0;
      for (const g of st.gems) if (g && DATA.GEM_KEY[g.type] === v) sum += DATA.gemValue(g);
      return sum > 0 ? '+' + sum + '% ' + t.affix : null;
    }).filter(Boolean).join(' · ');
    $('weaponDetail').innerHTML =
      '<h4>' + wsel.name + ' <span style="color:var(--gold);font-size:12px">' + '★'.repeat(wsel.tier) + '</span></h4>' +
      '<div class="quip">«' + wsel.quip + '»</div>' +
      'Урон ×' + wsel.dmg.toFixed(2) + (st.sharp ? ' <span style="color:var(--gold)">+' + st.sharp + ' (×' +
        (wsel.dmg * (1 + st.sharp * DATA.SHARP_STEP)).toFixed(2) + ')</span>' : '') +
      ' · скорость ×' + wsel.spd.toFixed(2) + ' · длина ×' + wsel.range.toFixed(2) + ' · дуга ×' + wsel.arc.toFixed(2) +
      '<br>Особенность: ' + (wsel.trait ? traitText(wsel.trait) : 'нет — честная верёвка') +
      (gemSum ? '<br><span style="color:var(--good)">Камни: ' + gemSum + '</span>' : '') +
      '<div style="margin-top:8px">Гнёзда: ' +
        sockets.map((g, i) =>
          '<span class="sock' + (g ? ' filled' : '') + '" data-sock="' + i + '" style="' +
          (g ? 'border-color:' + DATA.GEM_RARITIES[g.rar].col : '') + '">' +
          (g ? '<span class="dot" style="background:' + DATA.GEM_TYPES.find(x => x.id === g.type).col + ';display:inline-block;width:10px;height:10px;transform:rotate(45deg)"></span>' : '+') +
          '</span>').join('') +
      '<span class="dim" style="font-size:11px;margin-left:6px">' +
        (sockets.some(g => g) ? 'тап по камню — вынуть' : 'тап — вставить камень') + '</span></div>' +
      '<div class="row">' +
        (sel === p.equippedWeapon
          ? '<span style="color:var(--rose);font-size:13px">✓ в руках</span>'
          : '<button id="armEquip" class="btn">Взять в руки</button>') +
        '<button id="armSharp" class="btn" ' + (!canSharp || p.gold < cost ? 'disabled' : '') + '>' +
          (canSharp ? 'Заточить +1 — ' + cost + ' 💰' : 'Заточка максимум (+' + DATA.SHARP_MAX + ')') + '</button>' +
      '</div>';

    if (document.getElementById('armEquip'))
      document.getElementById('armEquip').onclick = () => {
        p.equippedWeapon = sel;
        AudioSys.sfx('ui');
        SaveSys.save(game);
        renderArmory();
      };
    document.getElementById('armSharp').onclick = () => {
      const s = p.weapons.owned[sel];
      const c = DATA.sharpCost(wsel, s.sharp);
      if (s.sharp >= DATA.SHARP_MAX || p.gold < c) { AudioSys.sfx('denied'); return; }
      p.gold -= c; s.sharp++;
      AudioSys.sfx('chest');
      UI.toast(wsel.name + ': заточка +' + s.sharp + ' (×' +
        (wsel.dmg * (1 + s.sharp * DATA.SHARP_STEP)).toFixed(2) + ')', 'gold');
      SaveSys.save(game);
      renderArmory();
    };
    $('weaponDetail').querySelectorAll('.sock').forEach(el => {
      el.onclick = () => socketTap(+el.dataset.sock);
    });

    // инвентарь камней
    $('gemInventory').innerHTML = p.gems.length
      ? p.gems.map((g, i) => {
        const t = DATA.GEM_TYPES.find(x => x.id === g.type);
        const r = DATA.GEM_RARITIES[g.rar];
        return '<div class="gem-chip" data-i="' + i + '"><span class="dot" style="background:' + t.col + '"></span>' +
          r.name + ' ' + t.name + ' <span style="color:var(--good)">' + DATA.gemTxt(g) + '</span></div>';
      }).join('')
      : '<span class="dim">Камней нет: ищи сундуки, боссов или спроси Мадам Векс.</span>';
    $('gemInventory').querySelectorAll('.gem-chip').forEach(el => {
      el.onclick = () => {
        // тап по камню в инвентаре — вставить в выбранный слот, если он выбран
        if (gemPickSocket >= 0) insertGem(+el.dataset.i);
        else UI.toast('Сначала тапни по гнезду оружия', '');
      };
    });

    $('weaponList').querySelectorAll('.wp-it').forEach(el => {
      el.onclick = () => { armorySel = el.dataset.w; gemPickSocket = -1; renderArmory(); };
    });
  }

  function traitText(t) {
    if (typeof t === 'function') return 'особая логика';
    const reg = DATA.WEAPON_TRAITS[t.type];
    if (reg && reg.text) return reg.text(t.val);
    return '—';
  }

  function socketTap(i) {
    const p = game.player;
    const st = p.weapons.owned[armorySel];
    const sockets = p.weaponSockets(armorySel);
    if (sockets[i]) {
      // вынуть камень обратно в инвентарь
      p.gems.push(sockets[i]);
      sockets[i] = null;
      st.gems = sockets;
      AudioSys.sfx('uiBack');
      SaveSys.save(game);
      gemPickSocket = -1;
      renderArmory();
    } else {
      gemPickSocket = i;
      UI.toast('Выбери камень из инвентаря ниже', '');
      if (!p.gems.length) UI.toast('Камней нет — загляни к Мадам Векс', '');
    }
  }

  function insertGem(gemIdx) {
    const p = game.player;
    const st = p.weapons.owned[armorySel];
    const sockets = p.weaponSockets(armorySel);
    const gem = p.gems[gemIdx];
    if (!gem || gemPickSocket < 0 || gemPickSocket >= sockets.length) return;
    p.gems.splice(gemIdx, 1);
    sockets[gemPickSocket] = gem;
    st.gems = sockets;
    AudioSys.sfx('relic');
    UI.toast('Камень вставлен: ' + DATA.gemName(gem), 'gold');
    SaveSys.save(game);
    gemPickSocket = -1;
    renderArmory();
  }


  function onTitle() {
    $('btnContinue').classList.toggle('hidden', !SaveSys.exists() || !SaveSys.ageOk());
  }

  // ===================== Лагерь =====================
  function onCamp() {
    const p = game.player;
    const hrs = (p.playtime / 3600);
    const needDepth = Math.ceil(0.8 * p.level);
    let advice;
    if (p.depth < needDepth) advice = 'Для уровня ' + p.level + ' мелко: спустись на глубину ' + needDepth + '+, иначе опыт режется.';
    else if (p.depth > p.level * 1.8) advice = 'Глубина смело опережает уровень. Дерзко. Плащ одобряет.';
    else advice = 'Глубина в норме: опыт капает без штрафов.';
    $('campStats').innerHTML =
      cs('Путь к сотне', p.level + ' / 100') +
      cs('Опыт', K.fmt(p.xp) + ' / ' + (p.level >= DATA.MAX_LEVEL ? '—' : K.fmt(p.xpNext))) +
      cs('В подземельях', (hrs >= 10 ? Math.round(hrs) : hrs.toFixed(1)) + ' ч') +
      cs('Золото', K.fmt(p.gold) + ' 💰') +
      cs('Глубина / рекорд', p.depth + ' / ' + p.bestDepth) +
      cs('Повержено', p.kills) +
      cs('Урон', Math.round(p.baseDmg) + ' ⚔') +
      cs('Оружие', '«' + p.weapon.name + '» +' + (p.weapons.owned[p.equippedWeapon] || { sharp: 0 }).sharp) +
      cs('Камней в сумке', p.gems.length + ' 💎') +
      cs('Зелий', DATA.POTIONS.reduce((s, pt) => s + (p.potions[pt.id] || 0), 0) + ' 🧪') +
      cs('Угроза на глубине', DATA.threat(p.depth, p.level));
    const adviceEl = document.getElementById('campAdvice');
    if (adviceEl) adviceEl.textContent = advice;
    // распределение характеристик
    const st = [['str', 'Сила'], ['agi', 'Ловкость'], ['vit', 'Стойкость'], ['cha', 'Харизма']];
    $('statAlloc').innerHTML = (p.statPts > 0 ? '<div class="sa" style="border-color:rgba(240,192,96,.5)">Очков: <b style="color:var(--gold)">' + p.statPts + '</b></div>' : '') +
      st.map(([k, n]) =>
        '<div class="sa">' + n + ' <b>' + p.stats[k] + '</b>' +
        '<button data-stat="' + k + '" ' + (p.statPts > 0 ? '' : 'disabled') + '>+</button></div>').join('');
    $('statAlloc').querySelectorAll('button[data-stat]').forEach(b => {
      b.onclick = () => {
        if (p.statPts <= 0) return;
        p.statPts--; p.stats[b.dataset.stat]++;
        p.hp = p.maxHp;
        AudioSys.sfx('ui');
        SaveSys.save(game);
        onCamp();
      };
    });
    $('btnDive').textContent = p.depth % 5 === 0
      ? 'В подземелье — БОСС (гл. ' + p.depth + ')'
      : 'В подземелье (гл. ' + p.depth + ')';
  }
  function cs(k, v) { return '<div class="cs">' + k + '<b>' + v + '</b></div>'; }

  // ===================== Навыки =====================
  function renderSkills() {
    const p = game.player;
    $('skillPts').textContent = 'очков: ' + p.skillPts;
    $('skillTree').innerHTML = DATA.SKILL_TREE.map(branch =>
      '<div class="st-col" data-branch="' + branch.id + '"><h3>' + branch.name + '</h3>' +
      branch.nodes.map(node => {
        const cur = p.skills[node.id] || 0;
        const can = Skills.canRank(p, node.id);
        const why = Skills.reason(p, node.id);
        return '<div class="st-node' + (cur >= node.max ? ' max' : '') + (!can && cur === 0 ? ' locked' : '') +
          '" data-node="' + node.id + '">' +
          '<b>' + node.name + '</b><span class="rk">' + cur + '/' + node.max + '</span>' +
          Skills.nodeDesc(node, cur) +
          (why && cur < node.max ? '<div style="margin-top:3px;font-size:10.5px;opacity:.8">🔒 ' + why + '</div>' : '') +
          '</div>';
      }).join('') + '</div>').join('');
    $('skillTree').querySelectorAll('.st-node').forEach(el => {
      el.onclick = () => {
        if (Skills.rankUp(game.player, el.dataset.node)) {
          SaveSys.save(game);
          renderSkills();
          UI.updateHUD(game.player);
        }
      };
    });
  }

  // ===================== Реликвии =====================
  function renderRelics() {
    const p = game.player;
    const defOf = it => DATA.RELIC_POOL.find(r => r.id === it.def);
    const scale = it => DATA.RELIC_BONUS_SCALE[it.rarity];
    const bonusTxt = it => {
      const d = defOf(it);
      if (!d) return '';
      const m = scale(it);
      const num = parseFloat((d.txt.match(/[\d.]+/) || [0])[0]) * m;
      return d.txt.replace(/[\d.]+/, Math.round(num * 10) / 10);
    };
    $('relicSlots').innerHTML = DATA.RELIC_SLOTS.map(s => {
      const it = p.equipped[s.id];
      return '<div class="relic-slot' + (it ? ' filled' : '') + '" data-slot="' + s.id + '">' +
        '<span class="ric">' + s.glyph + '</span>' +
        (it ? '<b>' + (defOf(it) || {}).name + '</b><span>' + bonusTxt(it) + '</span>' +
          '<div style="margin-top:4px;font-size:10px;color:var(--rose)">снять</div>'
          : '<b>' + s.name + '</b><span>пусто</span>') + '</div>';
    }).join('');
    $('relicList').innerHTML = p.relics.length
      ? p.relics.map((it, i) => {
        const d = defOf(it) || { name: '?', txt: '' };
        const eq = Object.values(p.equipped).some(e => e && e.uid === it.uid);
        return '<div class="relic-it' + (eq ? ' eq' : '') + '" data-i="' + i + '">' +
          '<span class="ric">' + (DATA.RELIC_SLOTS.find(s => s.id === d.slot) || {}).glyph + '</span>' +
          '<div><b>' + d.name + '</b><span class="rr r' + it.rarity + '">' + DATA.RARITIES[it.rarity] + '</span> · ' +
          bonusTxt(it) + (eq ? ' · надета' : '') + '</div></div>';
      }).join('')
      : '<p class="dim">Реликвий нет. Загляни в сундуки или к Мадам Векс.</p>';
    $('relicSlots').querySelectorAll('.relic-slot').forEach(el => {
      el.onclick = () => {
        const slot = el.dataset.slot;
        if (p.equipped[slot]) { p.equipped[slot] = null; AudioSys.sfx('uiBack'); }
        SaveSys.save(game); renderRelics();
      };
    });
    $('relicList').querySelectorAll('.relic-it').forEach(el => {
      el.onclick = () => {
        const it = p.relics[+el.dataset.i];
        const d = defOf(it);
        if (!d) return;
        p.equipped[d.slot] = it;
        AudioSys.sfx('relic');
        SaveSys.save(game); renderRelics();
      };
    });
  }

  // ===================== Торговка =====================
  function priceOf(it) {
    return Math.round(it.base * Math.pow(it.scale, game.player.bought[it.id] || 0));
  }
  function renderTrader() {
    const p = game.player;
    $('traderQuip').textContent = '«' + K.choice(Math.random, DATA.TRADER.quips) + '»  — ' + DATA.TRADER.name +
      ' · твоё золото: ' + K.fmt(p.gold);
    $('traderStock').innerHTML = DATA.TRADER.stock.map(it => {
      const bought = p.bought[it.id] || 0;
      const maxed = it.max != null && bought >= it.max;
      const pr = priceOf(it);
      const poor = p.gold < pr;
      return '<div class="tr-it' + (poor || maxed ? ' poor' : '') + '" data-id="' + it.id + '">' +
        '<span class="pr">' + (maxed ? 'предел' : pr + ' 💰') + '</span>' +
        '<b>' + it.glyph + ' ' + it.name + '</b>' + it.desc +
        (it.max ? ' <span style="opacity:.6">(' + bought + '/' + it.max + ')</span>' : '') + '</div>';
    }).join('');
    $('traderStock').querySelectorAll('.tr-it').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        const it = DATA.TRADER.stock.find(s => s.id === id);
        const pr = priceOf(it);
        const bought = p.bought[id] || 0;
        if (it.max != null && bought >= it.max) { AudioSys.sfx('denied'); return; }
        if (p.gold < pr) { AudioSys.sfx('denied'); toast('Не хватает золота', ''); return; }
        p.gold -= pr;
        p.bought[id] = bought + 1;
        if (id === 'potion') p.potions.heal = (p.potions.heal || 0) + 1;
        else if (id === 'potion_speed') p.potions.speed = (p.potions.speed || 0) + 1;
        else if (id === 'potion_power') p.potions.power = (p.potions.power || 0) + 1;
        else if (id === 'potion_fury') p.potions.fury = (p.potions.fury || 0) + 1;
        else if (id === 'potion_mana') p.potions.mana = (p.potions.mana || 0) + 1;
        else if (id === 'potion_invuln') p.potions.invuln = (p.potions.invuln || 0) + 1;
        else if (id === 'perm_hp') { p.perm.hp++; p.hp = p.maxHp; }
        else if (id === 'perm_dmg') p.perm.dmg++;
        else if (id === 'perm_pctdmg') p.perm.pctDmg = (p.perm.pctDmg || 0) + 1;
        else if (id === 'perm_pcthp') { p.perm.pctHp = (p.perm.pctHp || 0) + 1; p.hp = p.maxHp; }
        else if (id === 'gempouch') {
          p.gems.push(DATA.gemInstance(Math.random, p.depth));
          AudioSys.sfx('relic');
          toast('Камень: ' + DATA.gemName(p.gems[p.gems.length - 1]), 'gold');
        }
        else if (id === 'weaponbag') {
          const w = DATA.weaponDrop(Math.random, p.depth, Object.keys(p.weapons.owned));
          if (w) {
            p.weapons.owned[w.id] = { sharp: 0, gems: [] };
            AudioSys.sfx('relic');
            toast('Оружие: ' + w.name + ' ' + '★'.repeat(w.tier), 'gold');
          } else {
            // всё собрано — мешок превращается в два камня
            p.gems.push(DATA.gemInstance(Math.random, p.depth));
            p.gems.push(DATA.gemInstance(Math.random, p.depth));
            toast('Коллекция полна! Мешок превращается в два камня', 'gold');
          }
        }
        else if (id === 'relic') {
          const minR = p.depth >= 10 ? 1 : 0;
          p.relics.push(DATA.relicInstance(Math.random, null, minR));
          AudioSys.sfx('relic');
        }
        AudioSys.sfx('coin');
        SaveSys.save(game);
        renderTrader();
      };
    });
  }

  // ===================== Настройки =====================
  let settings = { volSfx: 80, volMus: 55, stickSide: 'left', fps: false };
  function loadSettingsUI() {
    const s = SaveSys.loadSettings();
    Object.assign(settings, s);
    $('volSfx').value = settings.volSfx;
    $('volMus').value = settings.volMus;
    $('stickSide').value = settings.stickSide;
  }
  function persistSettings() {
    SaveSys.saveSettings(settings);
    AudioSys.setVolumes({ sfx: settings.volSfx / 100, mus: settings.volMus / 100 });
  }

  // ===================== Инициализация =====================
  function init(g) {
    game = g;
    initStick();
    initMouseStick();
    loadSettingsUI();
    persistSettings();

    // Кнопки меню — обычный click: срабатывают при отпускании пальца,
    // свайп с кнопки прокручивает список (и отменяет нажатие).
    const tap = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
    // Боевые кнопки — мгновенно по касанию (отклик важнее отмены);
    // preventDefault глушит синтетический click, mousedown — для десктопа.
    const tapFast = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
    };

    // HUD-кнопки
    tapFast('btnAtk', () => game.state === 'dungeon' && game.player.tryAttack(game));
    tapFast('btnSpin', () => game.state === 'dungeon' && game.player.trySpin(game));
    tapFast('btnSpatter', () => game.state === 'dungeon' && game.player.trySpatter(game));
    tapFast('btnDash', () => game.state === 'dungeon' && game.player.tryDash(game));
    tapFast('btnCharm', () => game.state === 'dungeon' && game.player.tryCharm(game));
    tap('btnPause', () => game.togglePause());
    tapFast('btnInteract', () => game.state === 'campScene' && !game.paused && game.interact());
    tap('btnCampBoardBack', () => UI.campBack());
    tap('btnGateDive', () => { game.enterFloor(game.player.depth); });
    tap('btnGateBack', () => UI.campBack());
    tap('btnGateBoost', () => {
      const p = game.player;
      if (p.adXpT > 0) return;
      AdSys.showRewarded('xp_boost', () => { p.adXpT = 120; renderGate(); });
    });
    tap('btnFactoryBack', () => UI.campBack());
    tap('btnFactoryCollect', () => {
      const f = game.player.factory;
      const gold = Math.floor(f.acc);
      if (gold <= 0) { toast('Пока пусто — импы стараются', ''); return; }
      f.acc = 0; game.player.gold += gold;
      AudioSys.sfx('coin');
      toast('+' + gold + ' золота с фабрики', 'gold');
      SaveSys.save(game); renderFactory();
    });
    tap('btnFactoryHire', () => {
      const p = game.player, f = p.factory;
      if (f.imps >= HIRE_COST.length || p.gold < HIRE_COST[f.imps]) return;
      p.gold -= HIRE_COST[f.imps]; f.imps++;
      AudioSys.sfx('levelup');
      toast('🏭 Имп-работяга нанят!', 'gold');
      SaveSys.save(game); renderFactory();
    });
    tap('btnAdRevive', () => {
      AdSys.showRewarded('revive', () => game.revive());
    });

    // титул
    tap('btnNew', () => {
      AudioSys.ensure();
      if (!SaveSys.ageOk()) { game.pendingNew = true; show('age'); }
      else game.newGame();
    });
    tap('btnContinue', () => { AudioSys.ensure(); game.continueGame(); });
    tap('btnAbout', () => show('about'));
    tap('btnAboutBack', () => show('title'));

    // 18+
    tap('btnAgeOk', () => { SaveSys.setAgeOk(); AudioSys.ensure(); if (game.pendingNew) { game.pendingNew = false; game.newGame(); } else show('title'); });
    tap('btnAgeNo', () => {
      AudioSys.sfx('uiBack');
      game.pendingNew = false;
      toast('Возвращайся, когда исполнится 18. Демоницы подождут.', '');
      show('title');
    });

    // лагерь
    tap('btnDive', () => game.enterFloor(game.player.depth));
    tap('btnSkills', () => show('skills'));
    tap('btnSkillsBack', () => { SaveSys.save(game); campBack(); });
    tap('btnArmory', () => show('armory'));
    tap('btnArmoryQuick', () => UI.openArmoryQuick());
    tap('btnArmoryBack', () => { SaveSys.save(game); UI.armoryBack(); });
    tap('btnRelics', () => show('relics'));
    tap('btnRelicsBack', () => { SaveSys.save(game); campBack(); });
    tap('btnTrader', () => show('trader'));
    tap('btnTraderBack', () => { SaveSys.save(game); campBack(); });
    tap('btnSettingsCamp', () => { settingsFrom = 'campScene'; show('settings'); });
    tap('btnToTitle', () => { SaveSys.save(game); game.toTitle(); });

    // спуск
    tap('btnDeeper', () => game.descend());
    tap('btnToCamp2', () => game.toCamp());

    // смерть
    tap('btnDeadCamp', () => game.afterDeath());

    // пауза
    tap('btnResume', () => game.togglePause());
    tap('btnPauseCamp', () => { game.surrender(); });
    tap('btnPauseSettings', () => { settingsFrom = 'pause'; show('settings'); });
    tap('btnPauseTitle', () => { SaveSys.save(game); game.toTitle(); });
    tap('btnSettingsBack', () => { if (settingsFrom === 'campScene') campBack(); else show(settingsFrom); });
    tap('btnWipe', () => {
      if (confirm('Стереть сохранение безвозвратно?')) {
        SaveSys.wipe();
        toast('Сохранение стёрто', '');
        game.toTitle(true);
      }
    });

    // настройки
    $('volSfx').oninput = () => { settings.volSfx = +$('volSfx').value; persistSettings(); };
    $('volMus').oninput = () => { settings.volMus = +$('volMus').value; persistSettings(); };
    $('stickSide').onchange = () => { settings.stickSide = $('stickSide').value; persistSettings(); };
    $('chkFps').onchange = () => { settings.fps = persistSettings(); };

    // «назад» из Android-обёртки: данж — пауза, лагерь — титул, титул — двойной выход
    window.__keksBack = (exitFn) => {
      if (game.state === 'dungeon') { game.togglePause(); return; }
      if (game.state === 'camp') { SaveSys.save(game); game.toTitle(); return; }
      if (game.state === 'title' && typeof exitFn === 'function') {
        const now = Date.now();
        if (window.__keksLastBack && now - window.__keksLastBack < 2000) exitFn();
        else { window.__keksLastBack = now; toast('Нажмите «назад» ещё раз, чтобы выйти', ''); }
      }
    };
  }

  return {
    init, show, hideAll, updateHUD, goldPing, toast, dialogue, bossBannerShow, floorCard,
    openNpc, closeNpc, acceptNpc, turnInNpc, openTraderFromNpc, campMode, campBack,
    openArmoryQuick, armoryBack,
    veksAdPotion() {
      const p = game.player;
      if ((p._adPotionAt || -1e9) > p.playtime - 180) { toast('Векс устала от рекламы — приходи позже', ''); return; }
      AdSys.showRewarded('potions', () => {
        p._adPotionAt = p.playtime;
        p.potions.heal = (p.potions.heal || 0) + 2;
        toast('+2 зелья «Стыд-трава»', 'gold');
        SaveSys.save(game);
      });
    },
    move, get settings() { return settings; },
  };
})();
