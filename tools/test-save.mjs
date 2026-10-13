// test-save.mjs — round-trip сейва: все поля игрока должны пережить
// toSave → JSON → new Player(save). Запуск: node tools/test-save.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
global.window = global;
require('../site/js/util.js');
require('../site/js/data.js');
// стабы окружения для entities.js
global.AudioSys = { sfx() {} };
global.UI = { toast() {}, updateHUD() {}, dialogue() {} };
global.SaveSys = { save() {} };
global.Sprites = { makeWhip: () => ({ pts: [], update() {}, draw() {} }) };
require('../site/js/skills.js');
require('../site/js/entities.js');

const p = new Entities.Player({});
// наполнить всё, что должно сохраняться
p.level = 12; p.gold = 1234; p.kills = 55;
p.weapons.owned.axe = { sharp: 3, gems: [{ type: 'ruby', rar: 2, uid: 9 }] };
p.equippedWeapon = 'axe';
p.gems.push({ type: 'topaz', rar: 1, uid: 10 });
p.relics.push({ def: 'whip_wax', rarity: 2, uid: 11 });
p.adTickets = 2; p.trophies = 77;
p.factory = { imps: 2, acc: 12.5, lastTs: 12345 };
p.quests = {
  main: { def: DATA.QUESTS[2], prog: [7] },
  side: null, prao: null,
  done: { q1: true, q2: true },
  unlocked: { moza: true },
};
p.potions.mana = 4;

const json = JSON.stringify(p.toSave());
const q = new Entities.Player(JSON.parse(json));

const fail = [];
const eq = (name, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail.push(`${name}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
eq('уровень', q.level, 12);
eq('золото', q.gold, 1234);
eq('киллы', q.kills, 55);
eq('оружие-коллекция', q.weapons.owned.axe, { sharp: 3, gems: [{ type: 'ruby', rar: 2, uid: 9 }] });
eq('экипировано', q.equippedWeapon, 'axe');
eq('камни', q.gems.some(g => g.uid === 10), true);
eq('реликвии', q.relics.some(r => r.uid === 11), true);
eq('билеты', q.adTickets, 2);
eq('трофеи', q.trophies, 77);
eq('фабрика', q.factory, { imps: 2, acc: 12.5, lastTs: 12345 });
eq('квест-выполнено', q.quests.done, { q1: true, q2: true });
eq('NPC-разблок', q.quests.unlocked, { moza: true });
if (!q.quests.main || q.quests.main.def.id !== 'q3' || q.quests.main.prog[0] !== 7)
  fail.push('активная глава: ' + JSON.stringify(q.quests.main && { id: q.quests.main.def.id, prog: q.quests.main.prog }));
eq('зелья-мана', q.potions.mana, 4);

if (fail.length) { console.error('ПРОВАЛ:'); fail.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('OK: сейв round-trip — оружие, камни, квесты, NPC, фабрика, билеты на месте');
