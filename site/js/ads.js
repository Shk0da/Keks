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
  function showRewarded(placement, onReward, onSkip) {
    const g = window.game;
    AudioSys.sfx('ui');
    // билет пропуска: мгновенная награда без просмотра
    if (tickets() > 0) {
      takeTicket();
      UI.toast('🎟 Билет пропуска: награда без рекламы!', 'gold');
      SaveSys.save(g);
      onReward();
      return;
    }
    const ov = ensureOverlay();
    ov.classList.remove('hidden');
    const count = ov.querySelector('.ad-count');
    const claim = ov.querySelector('.ad-claim');
    claim.disabled = true;
    let left = REWARDED_LEN;
    count.textContent = left + '…';
    clearInterval(timer);
    timer = setInterval(() => {
      left--;
      if (left > 0) { count.textContent = left + '…'; return; }
      clearInterval(timer);
      count.textContent = 'Ролик просмотрен ✓';
      claim.disabled = false;
    }, 1000);
    claim.onclick = () => {
      ov.classList.add('hidden');
      UI.toast('Награда получена', 'gold');
      if (g && g.player) g.player._adRewards = (g.player._adRewards || 0) + 1;
      SaveSys.save(g);
      onReward();
    };
  }

  // межстраничная: строго между активностями, не чаще кулдауна, не в бою
  function maybeInterstitial(g) {
    if (!g || !g.player) return false;
    const p = g.player;
    const last = p._lastInterstitial || -1e9;
    if (p.playtime - last < INTERSTITIAL_COOLDOWN) return false;
    p._lastInterstitial = p.playtime;
    const ov = ensureOverlay();
    ov.classList.remove('hidden');
    const count = ov.querySelector('.ad-count');
    const claim = ov.querySelector('.ad-claim');
    claim.disabled = true;
    count.textContent = '3…';
    let left = 3;
    clearInterval(timer);
    timer = setInterval(() => {
      left--;
      if (left > 0) { count.textContent = left + '…'; return; }
      clearInterval(timer);
      count.textContent = 'Спасибо за терпение ♥';
      claim.disabled = false;
      claim.onclick = () => ov.classList.add('hidden');
    }, 1000);
    return true;
  }

  // заработок билетов: +1 за босса
  function grantBossTicket(g) {
    if (!g || !g.player) return;
    g.player.adTickets = (g.player.adTickets || 0) + 1;
    UI.toast('🎟 +1 билет пропуска рекламы (за босса)', 'gold');
  }

  return { showRewarded, maybeInterstitial, grantBossTicket, tickets };
})();
