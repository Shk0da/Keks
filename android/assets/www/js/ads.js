// ads.js — каркас монетизации: rewarded video, межстраничные, билеты пропуска.
// ОФФЛАЙН-РЕЖИМ: реального SDK нет — ролик «сматривается» через демо-оверлей
// (5 сек с таймером). Для подключения сети (AppLovin MAX / AdMob / Yandex)
// достаточно заменить внутренности showRewarded/maybeInterstitial —
// остальная игра работает через эти три функции и не знает о SDK.
// Билеты пропуска (skip tickets): дают награду без просмотра; зарабатываются
// в игре (по одному за босса) — при подключении Billing сюда же вешается
// магазин пакета билетов за $1.99 (см. README, «Монетизация»).
'use strict';
window.AdSys = (function () {

  const INTERSTITIAL_COOLDOWN = 150;   // сек между межстраничными
  const REWARDED_LEN = 5;              // сек демо-ролика

  let overlay = null, timer = null;

  function tickets() { const g = window.game; return (g && g.player && g.player.adTickets) || 0; }
  function takeTicket() { const g = window.game; if (g && g.player) g.player.adTickets = Math.max(0, (g.player.adTickets || 0) - 1); }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'adOverlay';
    overlay.innerHTML =
      '<div class="ad-card">' +
      '<div class="ad-badge">РЕКЛАМА · демо</div>' +
      '<div class="ad-body">Демонстрационный ролик.<br>Здесь будет ролик рекламной сети<br>(MAX / AdMob — см. README).</div>' +
      '<div class="ad-count"></div>' +
      '<button class="btn primary ad-claim" disabled>Забрать награду</button>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  // показать «ролик»: по завершении — onReward(); закрыть раньше — onSkip()
  // ПОКА РЕАЛЬНОЙ РЕКЛАМЫ НЕТ: награда выдаётся мгновенно под баннером
  // «Мы убрали рекламу» — ждём и таймеры убраны. При подключении SDK сюда
  // возвращается показ ролика (см. README, «Монетизация»).
  function showRewarded(placement, onReward, onSkip) {
    const g = window.game;
    AudioSys.sfx('relic');
    showNoAdsBanner();
    if (g && g.player) g.player._adRewards = (g.player._adRewards || 0) + 1;
    SaveSys.save(g);
    onReward();
  }

  // межстраничная: без сети не показываем вовсе — никого не прерываем
  function maybeInterstitial(g) {
    return false;
  }

  // баннер «Мы убрали рекламу»: полоска сверху, 2.2 сек, сама исчезает
  let bannerEl = null, bannerT = null;
  function showNoAdsBanner() {
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'noAdsBanner';
      bannerEl.innerHTML = '<b>Мы убрали рекламу</b><span>награда — сразу, без ролика ♥</span>';
      document.body.appendChild(bannerEl);
    }
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => bannerEl.classList.remove('show'), 2200);
  }

  // заработок билетов: +1 за босса
  function grantBossTicket(g) {
    if (!g || !g.player) return;
    g.player.adTickets = (g.player.adTickets || 0) + 1;
    UI.toast('🎟 +1 билет пропуска рекламы (за босса)', 'gold');
  }

  return { showRewarded, maybeInterstitial, grantBossTicket, tickets };
})();
