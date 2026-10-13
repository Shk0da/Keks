// audio.js — генеративный звук на WebAudio.
// Движок: мастер-шина с компрессором, свёрточная реверберация подземелья
// (импульс синтезируется), посылы у эффектов. Удары многослойные
// (вуш → щелчок → тело → хвост), музыка — прогрессии аккордов с суб-басом,
// вибрато-мелодией и шумовым «дыханием» данжа. Ни одного аудиофайла.
'use strict';
window.AudioSys = (function () {

  let ctx = null;
  let master = null, comp = null;          // мастер → компрессор → выход
  let sfxBus = null, sfxSend = null;       // эффекты: сухой + посыл в реверб
  let musBus = null, musSend = null;       // музыка: свой посыл (меньше хвоста)
  let reverb = null;
  let volSfx = 0.8, volMus = 0.55, muted = false;
  let noiseBuf = null, noise2s = null;
  let musTimer = null, musTheme = null, musStep = 0;
  let bedNodes = null;                     // шумовое дыхание данжа

  // ==================== инициализация графа ====================
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    // буферы шума (моно 1с и стерео 2с)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise2s = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const dd = noise2s.getChannelData(ch);
      for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    }

    // мастер: компрессор склеивает смесь и не даёт клиппить
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 18;
    comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.26;
    comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp);

    // реверб подземелья: свёртка с экспоненциально затухающим шумом
    // (стерео, каналы некоррелированы → широкая tails)
    const irLen = Math.floor(ctx.sampleRate * 1.9);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const id = ir.getChannelData(ch);
      const pre = Math.floor(ctx.sampleRate * 0.018); // пре-делей 18мс
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        if (i < pre) { id[i] = 0; continue; }
        // двойная экспонента: быстрый старт + длинный хвост
        const env = Math.exp(-t * 4.2) * Math.pow(1 - t, 1.4);
        id[i] = (Math.random() * 2 - 1) * env;
      }
    }
    reverb = ctx.createConvolver();
    reverb.buffer = ir;
    const revOut = ctx.createGain(); revOut.gain.value = 0.9;
    reverb.connect(revOut); revOut.connect(comp);

    // шины
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    sfxSend = ctx.createGain(); sfxSend.gain.value = 0.35;   // удары — с хвостом
    sfxBus.connect(sfxSend); sfxSend.connect(reverb);

    musBus = ctx.createGain(); musBus.connect(master);
    musSend = ctx.createGain(); musSend.gain.value = 0.22;   // музыка — мягче в хвост
    musBus.connect(musSend); musSend.connect(reverb);

    applyVol();
    return ctx;
  }

  function applyVol() {
    if (!ctx) return;
    sfxBus.gain.value = muted ? 0 : volSfx;
    musBus.gain.value = muted ? 0 : volMus * 0.55;
  }

  // ==================== строительные блоки ====================
  // обёртка: узел → шина эффектов; send — индивидуальная глубина реверберации
  function toFx(node, send) {
    node.connect(sfxBus);
    if (send > 0) {
      const g = ctx.createGain(); g.gain.value = send;
      node.connect(g); g.connect(reverb);
    }
  }

  // тон: атака/спад, опциональные фильтр, панорама, вибрато
  function tone(o) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency[o.exp ? 'exponentialRampToValueAtTime' : 'linearRampToValueAtTime']
      (Math.max(20, o.f1), t0 + o.dur);
    const g = c.createGain();
    const vol = o.vol || 0.2;
    const atk = o.atk != null ? o.atk : 0.008;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    let last = osc;
    if (o.lp || o.hp) {
      const f = c.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : 'highpass';
      f.frequency.value = o.lp || o.hp;
      last.connect(f); last = f;
    }
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = o.pan;
      last.connect(p); last = p;
    }
    last.connect(g);
    toFx(g, o.send != null ? o.send : 0.3);
    osc.start(t0); osc.stop(t0 + o.dur + 0.08);
  }

  // шум: полоса, скользящая частота, кривая спада (экспонента — резче/натуральнее)
  function noise(o) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = o.stereo ? noise2s : noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const flt = c.createBiquadFilter();
    flt.type = o.ftype || 'bandpass';
    flt.frequency.setValueAtTime(o.f0 || 1200, t0);
    if (o.f1) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t0 + o.dur);
    flt.Q.value = o.q != null ? o.q : 1.0;
    const g = c.createGain();
    const vol = o.vol || 0.3;
    const atk = o.atk != null ? o.atk : 0.005;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(flt); flt.connect(g);
    let last = g;
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = o.pan;
      last.connect(p); last = p;
    }
    toFx(last, o.send != null ? o.send : 0.3);
    src.start(t0, Math.random()); src.stop(t0 + o.dur + 0.08);
  }

  // удар-«тело»: синус с быстрым падением частоты (кик/п thump)
  function thump(f0, f1, dur, vol, delay, send) {
    tone({ f0, f1, dur, vol, type: 'sine', atk: 0.002, exp: true, delay, send: send != null ? send : 0.25 });
  }

  // металлический звон: два расстроенных треугольника
  function ring(freqs, dur, vol, delay, send) {
    freqs.forEach((f, i) => tone({
      f0: f, dur: dur * (1 - i * 0.15), vol: vol / (i + 1),
      type: 'triangle', atk: 0.002, delay, send: send != null ? send : 0.5,
    }));
  }

  // ==================== «пошлый» слой ====================
  // стон: два расстроенных синуса глиссандо → естественное биение-тремоло
  function moan(f0, f1, dur, vol, delay, send) {
    [-5, 4].forEach(det => tone({
      f0: f0 + det, f1: f1 + det, dur, vol: vol / 2, type: 'sine',
      atk: dur * 0.3, delay, send: send != null ? send : 0.55,   // стоны — самые «воздушные»
    }));
  }
  // хихиканье: восходящие блипы с панорамой
  function giggle(n, base, vol, delay) {
    for (let i = 0; i < n; i++) {
      tone({
        f0: base + i * 90, f1: base * 1.35 + i * 90, dur: 0.07, vol,
        atk: 0.01, delay: (delay || 0) + i * 0.07, pan: (i % 2 ? 0.3 : -0.3),
        send: 0.4,
      });
    }
  }
  // чмок: шумовой «поп» со скользящим фильтром + тональный щелчок
  function kiss(vol, delay) {
    noise({ f0: 900, f1: 300, dur: 0.08, vol, q: 2.4, atk: 0.006, delay, send: 0.35 });
    tone({ f0: 480, f1: 260, dur: 0.06, vol: vol * 0.5, atk: 0.004, delay: (delay || 0) + 0.01, send: 0.35 });
  }
  // взвизг героя
  function yelp(vol) {
    tone({ f0: 320, f1: 640, dur: 0.13, vol, type: 'square', exp: false, lp: 1800, send: 0.35 });
    noise({ f0: 1400, f1: 900, dur: 0.09, vol: vol * 0.7, atk: 0.003 });
  }
  // глотки + довольное «а-а-ах~»
  function gulps() {
    for (let i = 0; i < 3; i++)
      tone({ f0: 210 - i * 30, f1: 140, dur: 0.08, vol: 0.16, exp: true, delay: i * 0.15, lp: 600, send: 0.15 });
    moan(280, 470, 0.34, 0.1, 0.5);
  }

  // ==================== таблица эффектов ====================
  // Каждый звук — многослойный: транзиент → тело → хвост (→ пошлость).
  const SFX = {
    ui()     { tone({ f0: 660, dur: 0.07, vol: 0.18, type: 'triangle', send: 0.2 });
               noise({ f0: 3000, dur: 0.02, vol: 0.05, atk: 0.001, send: 0.1 }); },
    uiBack() { tone({ f0: 440, f1: 380, dur: 0.08, vol: 0.15, type: 'triangle', send: 0.2 }); },
    whip() {
      // 1) вуш: полоса шума разгоняется вверх 2) щелчок-транзиент 3) низкое тело
      noise({ f0: 500, f1: 3200, dur: 0.12, vol: 0.35, q: 1.6, atk: 0.02 });
      noise({ f0: 4200, dur: 0.03, vol: 0.5, ftype: 'highpass', atk: 0.001, send: 0.4 });
      thump(160, 70, 0.1, 0.22);
      moan(330, 220, 0.26, 0.07, 0.05);                    // «о-о-ой»
    },
    whipHit() {
      noise({ f0: 900, f1: 300, dur: 0.1, vol: 0.5, ftype: 'lowpass', atk: 0.002 });
      noise({ f0: 3600, dur: 0.02, vol: 0.3, ftype: 'highpass', atk: 0.001 });
      thump(140, 60, 0.13, 0.3);
      tone({ f0: 240, dur: 0.1, vol: 0.1, type: 'triangle' });  // лёгкий звон кожи
      giggle(2, 640, 0.05, 0.04);
    },
    crit() {
      noise({ f0: 1800, f1: 500, dur: 0.16, vol: 0.55, atk: 0.002 });
      ring([820, 1230], 0.3, 0.14, 0.02);
      thump(120, 50, 0.2, 0.36);
      moan(540, 320, 0.32, 0.1, 0.03);
      giggle(3, 700, 0.05, 0.18);
    },
    spinStart() {
      noise({ f0: 300, f1: 1600, dur: 0.4, vol: 0.3, ftype: 'lowpass', atk: 0.05 });
      moan(200, 380, 0.42, 0.08);
    },
    spinLoop() {
      noise({ f0: 700 + Math.random() * 500, f1: 1400, dur: 0.1, vol: 0.12, q: 1.4 });
      if (Math.random() < 0.4) moan(230 + Math.random() * 90, 300, 0.14, 0.04, 0, 0.45);
    },
    dash()    { noise({ f0: 900, f1: 2600, dur: 0.2, vol: 0.35, ftype: 'highpass', atk: 0.015 });
                giggle(2, 820, 0.04); },
    hurt()    { yelp(0.2); noise({ f0: 700, f1: 250, dur: 0.14, vol: 0.26, ftype: 'lowpass' });
                thump(100, 55, 0.16, 0.22); },
    edie() {
      // «финал» демонессы: крещендо → пик → долгая разрядка (комедийный троп)
      const s = 0.9 + Math.random() * 0.25;                // вариативность тона
      moan(230 * s, 400 * s, 0.38, 0.1);                   // нарастание…
      moan(360 * s, 560 * s, 0.4, 0.13, 0.32);             // …выше…
      moan(540 * s, 630 * s, 0.22, 0.15, 0.68, 0.7);       // пик: дрожащий верх
      ring([1560, 2340], 0.5, 0.05, 0.72, 0.75);           // искристый звон пика
      moan(600 * s, 175 * s, 0.95, 0.12, 0.88, 0.75);      // разрядка: долгий вздох вниз
      noise({ f0: 700, f1: 240, dur: 0.85, vol: 0.09, ftype: 'lowpass', atk: 0.12, delay: 0.95, send: 0.6 });
      moan(265 * s, 210 * s, 0.35, 0.055, 1.55);           // дрожь-афтершок
      giggle(2, 620, 0.04, 1.75);
    },
    coin()  { tone({ f0: 1150, dur: 0.08, vol: 0.11, type: 'square', lp: 2400, send: 0.35 });
              tone({ f0: 1720, dur: 0.12, vol: 0.09, type: 'square', lp: 2600, delay: 0.06, pan: 0.2, send: 0.4 });
              tone({ f0: 3440, dur: 0.08, vol: 0.03, type: 'sine', delay: 0.06, send: 0.5 }); },
    heart() { kiss(0.15); tone({ f0: 660, f1: 720, dur: 0.13, vol: 0.09, delay: 0.06, send: 0.45 }); },
    charm() {
      kiss(0.3);
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ f0: f, dur: 0.16, vol: 0.11, type: 'triangle', delay: 0.12 + i * 0.06, pan: i % 2 ? 0.35 : -0.35, send: 0.5 }));
      giggle(3, 700, 0.045, 0.35);
    },
    levelup() {
      [392, 494, 587, 784].forEach((f, i) =>
        tone({ f0: f, dur: 0.24, vol: 0.13, type: 'triangle', delay: i * 0.09, send: 0.5 }));
      tone({ f0: 1568, dur: 0.4, vol: 0.05, delay: 0.36, send: 0.6 }); // блеск сверху
      moan(440, 700, 0.4, 0.07, 0.15);
    },
    potion() { gulps(); },
    door()   { // каменный грохот врат: трение + тяжёлый удар + оседающая пыль
               noise({ f0: 300, f1: 90, dur: 0.5, vol: 0.3, ftype: 'lowpass', atk: 0.03, send: 0.55 });
               noise({ f0: 900, f1: 300, dur: 0.12, vol: 0.18, atk: 0.002 });
               thump(95, 40, 0.5, 0.32, 0.03, 0.5);
               noise({ f0: 500, f1: 200, dur: 0.5, vol: 0.08, ftype: 'lowpass', atk: 0.1, delay: 0.3, send: 0.5 });
             },
    gate()   { // решётка поднимается: металлический скрежет + дребезг прутьев
               noise({ f0: 1600, f1: 700, dur: 0.55, vol: 0.16, q: 3.5, atk: 0.06, send: 0.45 });
               tone({ f0: 620, f1: 880, dur: 0.4, vol: 0.05, type: 'sawtooth', lp: 1200, atk: 0.1, send: 0.45 });
               for (let i = 0; i < 3; i++)
                 noise({ f0: 2200 + i * 500, dur: 0.04, vol: 0.07, atk: 0.002, delay: 0.3 + i * 0.09, send: 0.4 });
             },
    stairs() { [220, 175, 147].forEach((f, i) => tone({ f0: f, f1: f * 0.94, dur: 0.34, vol: 0.14, atk: 0.03, delay: i * 0.15, send: 0.55 }));
               noise({ f0: 400, f1: 180, dur: 0.5, vol: 0.1, ftype: 'lowpass', atk: 0.05, send: 0.5 }); },
    boss()   {
      thump(70, 40, 1.2, 0.3, 0, 0.4);
      tone({ f0: 110, f1: 95, dur: 1.3, vol: 0.13, type: 'triangle', atk: 0.15, send: 0.5 });
      noise({ f0: 240, f1: 120, dur: 1.2, vol: 0.14, ftype: 'lowpass', atk: 0.1, send: 0.6 });
      moan(150, 105, 1.5, 0.12, 0.15, 0.7);
    },
    shoot()  { noise({ f0: 900, f1: 2200, dur: 0.1, vol: 0.14, q: 2 });
               tone({ f0: 340, f1: 480, dur: 0.09, vol: 0.09, type: 'sawtooth', lp: 1400 }); },
    net()    { noise({ f0: 500, f1: 1600, dur: 0.22, vol: 0.2, q: 1.2 });
               giggle(2, 900, 0.035); },
    fire()   { noise({ f0: 900, f1: 250, dur: 0.32, vol: 0.22, ftype: 'lowpass', atk: 0.015 });
               moan(260, 170, 0.3, 0.05, 0.05); },
    frost()  { tone({ f0: 1400, f1: 1900, dur: 0.16, vol: 0.08, atk: 0.002, send: 0.5 });
               noise({ f0: 3000, f1: 5200, dur: 0.14, vol: 0.1, ftype: 'highpass', send: 0.45 }); },
    chest()  { [523, 784].forEach((f, i) => tone({ f0: f, dur: 0.18, vol: 0.12, type: 'triangle', delay: i * 0.09, send: 0.45 }));
               noise({ f0: 800, f1: 300, dur: 0.08, vol: 0.15, ftype: 'lowpass' });
               kiss(0.12, 0.16); },
    relic()  { [660, 990, 1320].forEach((f, i) => tone({ f0: f, dur: 0.22, vol: 0.11, delay: i * 0.09, send: 0.55 }));
               tone({ f0: 2640, dur: 0.5, vol: 0.04, delay: 0.27, send: 0.65 });
               moan(330, 520, 0.3, 0.06, 0.2); },
    shrine() { tone({ f0: 440, f1: 660, dur: 0.6, vol: 0.12, atk: 0.12, send: 0.65 });
               tone({ f0: 880, f1: 1230, dur: 0.7, vol: 0.06, atk: 0.15, delay: 0.1, send: 0.7 });
               moan(300, 420, 0.6, 0.05, 0.15); },
    denied() { tone({ f0: 180, f1: 130, dur: 0.12, vol: 0.14, type: 'square', lp: 900, exp: true }); },
    spatter() { // белые брызги из хлыста: влажный всплеск + капли
      noise({ f0: 2400, f1: 700, dur: 0.14, vol: 0.4, q: 1.4, atk: 0.004, send: 0.4 });
      thump(300, 120, 0.08, 0.18, 0, 0.2);
      [1500, 1150, 880].forEach((f, i) =>
        tone({ f0: f, f1: f * 0.55, dur: 0.07, vol: 0.09, atk: 0.004, delay: 0.05 + i * 0.05, send: 0.45 }));
      moan(360, 260, 0.2, 0.05, 0.02);
    },
    death()  {
      [330, 262, 196, 131].forEach((f, i) => tone({ f0: f, f1: f * 0.96, dur: 0.45, vol: 0.16, type: 'triangle', atk: 0.04, delay: i * 0.23, send: 0.55 }));
      moan(240, 90, 1.2, 0.1, 0.3, 0.7);
      noise({ f0: 500, f1: 150, dur: 1.4, vol: 0.08, ftype: 'lowpass', atk: 0.3, delay: 0.3, send: 0.6 });
    },
  };

  // ==================== музыка ====================
  // Прогрессии в полутонах от тоники; аккорд = минорное трезвучие + септима.
  const MUS = {
    crypt:   { root: 110, scale: [0, 3, 5, 7, 10], prog: [0, 8, 5, 7], pad: 'sawtooth', lp: 750,  bright: 0.05, every: 5.4, sub: true },
    hell:    { root: 98,  scale: [0, 1, 5, 7, 8],  prog: [0, 1, 5, 0], pad: 'sawtooth', lp: 640,  bright: 0.045, every: 4.4, sub: true, pulse: true },
    ice:     { root: 131, scale: [0, 2, 3, 7, 9],  prog: [0, 7, 3, 10], pad: 'triangle', lp: 950, bright: 0.075, every: 6.2 },
    hive:    { root: 87,  scale: [0, 2, 3, 5, 8],  prog: [0, 3, 8, 5], pad: 'sawtooth', lp: 560,  bright: 0.04, every: 5.0, sub: true },
    library: { root: 123, scale: [0, 3, 5, 8, 10], prog: [0, 5, 8, 3], pad: 'triangle', lp: 880,  bright: 0.065, every: 5.8, sub: true },
    camp:    { root: 147, scale: [0, 3, 5, 7, 10], prog: [0, 5, 7, 3], pad: 'triangle', lp: 1000, bright: 0.085, every: 4.6 },
    title:   { root: 110, scale: [0, 3, 7, 10, 12], prog: [0, 8, 3, 7], pad: 'sawtooth', lp: 700, bright: 0.06, every: 6.6, sub: true },
  };

  // один аккорд прогрессии: пэд-голоса + суб-бас + септима сверху
  function playChord(m, chordStep) {
    const c = ctx;
    const t0 = c.currentTime;
    const chordRoot = m.prog[chordStep % m.prog.length];
    const ivs = [0, 3, 7, 10];                       // минор7
    ivs.forEach((iv, i) => {
      const f = m.root * Math.pow(2, (chordRoot + iv) / 12) * (i === 3 ? 2 : 1);
      [-6, 5].forEach((det, k) => {                  // детюн-пара на голос
        const o = c.createOscillator(), g = c.createGain(), flt = c.createBiquadFilter();
        o.type = m.pad;
        o.frequency.value = f * Math.pow(2, det / 1200);
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(m.lp * 0.55, t0);
        flt.frequency.linearRampToValueAtTime(m.lp, t0 + m.every * 0.5); // фильтр «дышит»
        flt.frequency.linearRampToValueAtTime(m.lp * 0.5, t0 + m.every * 1.1);
        const v = m.bright / (1 + i * 0.35 + k * 0.4);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(v, t0 + m.every * 0.4);
        g.gain.linearRampToValueAtTime(0, t0 + m.every * 1.1);
        o.connect(flt); flt.connect(g); g.connect(musBus);
        o.start(t0); o.stop(t0 + m.every * 1.2);
      });
    });
    // суб-бас: корень на октаву ниже, мягкая пульсация
    if (m.sub) {
      const bf = m.root / 2 * Math.pow(2, chordRoot / 12);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = bf;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(m.bright * 2.4, t0 + m.every * 0.25);
      g.gain.setValueAtTime(m.bright * 2.4, t0 + m.every * 0.7);
      g.gain.linearRampToValueAtTime(0, t0 + m.every * 1.05);
      o.connect(g); g.connect(musBus);
      o.start(t0); o.stop(t0 + m.every * 1.1);
    }
    // напряжённый пульс для ада (медленный «пульс-кик»)
    if (m.pulse) {
      for (let k = 0; k < 3; k++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        const tt = t0 + 0.4 + k * (m.every / 3.4);
        o.type = 'sine';
        o.frequency.setValueAtTime(85, tt);
        o.frequency.exponentialRampToValueAtTime(45, tt + 0.18);
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.075, tt + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.3);
        o.connect(g); g.connect(musBus);
        o.start(tt); o.stop(tt + 0.35);
      }
    }
  }

  // редкая мелодия: нота гаммы с вибрато и панорамой
  function playMelody(m) {
    const c = ctx;
    const t0 = c.currentTime;
    const semi = m.scale[Math.floor(Math.random() * m.scale.length)] + 12 * (Math.random() < 0.4 ? 2 : 1);
    const f = m.root * Math.pow(2, semi / 12);
    const dur = 0.5 + Math.random() * 1.0;
    const o = c.createOscillator(), g = c.createGain();
    const vib = c.createOscillator(), vibG = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    vib.frequency.value = 4.5 + Math.random() * 1.5;   // вибрато 4.5–6 Гц
    vibG.gain.value = f * 0.006;
    vib.connect(vibG); vibG.connect(o.frequency);
    const v = m.bright * 1.3;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.06);
    g.gain.setValueAtTime(v, t0 + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.3);
    let last = g;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = Math.random() * 1.2 - 0.6;
      g.connect(p); last = p;
    }
    last.connect(musBus); last.connect(musSend);
    o.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.4);
    vib.start(t0); vib.stop(t0 + dur + 0.4);
  }

  // шумовое «дыхание» данжа: луп шума через медленно гуляющий полосовой фильтр
  function startBed(m) {
    stopBed();
    const c = ctx;
    const src = c.createBufferSource();
    src.buffer = noise2s; src.loop = true;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 260; flt.Q.value = 0.55;
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.frequency.value = 0.06; lfoG.gain.value = 140;
    lfo.connect(lfoG); lfoG.connect(flt.frequency);
    const g = c.createGain();
    g.gain.value = m.bright * 0.5;
    src.connect(flt); flt.connect(g); g.connect(musBus);
    src.start(); lfo.start();
    bedNodes = { src, lfo, g };
  }
  function stopBed() {
    if (!bedNodes) return;
    try { bedNodes.src.stop(); bedNodes.lfo.stop(); } catch (e) {}
    bedNodes = null;
  }

  function musicStep() {
    if (!ctx || ctx.state !== 'running' || !musTheme) return;
    const m = MUS[musTheme] || MUS.crypt;
    playChord(m, musStep++);
    if (Math.random() < 0.8) setTimeout(() => { if (ctx.state === 'running') playMelody(m); }, 600);
    // изредка — далёкий стон из глубин (еле слышно, широкий)
    if (Math.random() < 0.16) {
      moan(190 + Math.random() * 20, 125, 2.4, 0.03, 0.8, 0.85);
    }
  }

  function setMusic(theme) {
    if (musTheme === theme) return;
    musTheme = theme;
    if (musTimer) { clearInterval(musTimer); musTimer = null; }
    stopBed();
    if (!theme) return;
    ensure();
    musStep = 0;
    startBed(MUS[theme] || MUS.crypt);
    musicStep();
    musTimer = setInterval(musicStep, Math.round((MUS[theme] || MUS.crypt).every * 1000));
  }

  function sfx(name) {
    if (muted) return;
    const fn = SFX[name];
    if (fn) { try { fn(); } catch (e) { /* аудио не критично */ } }
  }

  return {
    ensure, sfx, setMusic,
    setVolumes(v) {
      if (v.sfx != null) volSfx = v.sfx;
      if (v.mus != null) volMus = v.mus;
      applyVol();
    },
    setMuted(m) { muted = m; applyVol(); },
    get context() { return ctx; },
  };
})();
