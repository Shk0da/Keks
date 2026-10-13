// save.js — сохранение в localStorage (переживает перезапуски, попадает в бэкапы).
'use strict';
window.SaveSys = (function () {
  const KEY = 'keks_save_v1';
  const AGE_KEY = 'keks_age_ok';
  const SET_KEY = 'keks_settings_v1';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } }

  function load() {
    const raw = lsGet(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function save(game) {
    if (!game || !game.player) return;
    lsSet(KEY, JSON.stringify(game.player.toSave()));
  }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function exists() { return !!lsGet(KEY); }

  function ageOk() { return lsGet(AGE_KEY) === '1'; }
  function setAgeOk() { lsSet(AGE_KEY, '1'); }

  function loadSettings() {
    const raw = lsGet(SET_KEY);
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function saveSettings(s) { lsSet(SET_KEY, JSON.stringify(s)); }

  return { load, save, wipe, exists, ageOk, setAgeOk, loadSettings, saveSettings };
})();
