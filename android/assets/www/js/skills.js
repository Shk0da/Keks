// skills.js — логика дерева навыков: разблокировка, требования, эффекты.
'use strict';
window.Skills = (function () {

  // можно ли прокачать узел следующим ранком
  function canRank(player, nodeId) {
    const node = findNode(nodeId);
    if (!node) return false;
    const cur = player.skills[nodeId] || 0;
    if (cur >= node.max) return false;
    if (player.skillPts < 1) return false;
    if (player.level < node.reqLvl) return false;
    // требуем предыдущий узел ветки хотя бы 1 ранг
    const branch = DATA.SKILL_TREE.find(b => b.nodes.some(n => n.id === nodeId));
    const idx = branch.nodes.indexOf(node);
    if (idx > 0 && !(player.skills[branch.nodes[idx - 1].id] > 0)) return false;
    return true;
  }

  function reason(player, nodeId) {
    const node = findNode(nodeId);
    const cur = player.skills[nodeId] || 0;
    if (cur >= node.max) return 'максимум';
    if (player.level < node.reqLvl) return 'ур. ' + node.reqLvl;
    const branch = DATA.SKILL_TREE.find(b => b.nodes.some(n => n.id === nodeId));
    const idx = branch.nodes.indexOf(node);
    if (idx > 0 && !(player.skills[branch.nodes[idx - 1].id] > 0))
      return 'сначала «' + branch.nodes[idx - 1].name + '»';
    if (player.skillPts < 1) return 'нет очков';
    return '';
  }

  function rankUp(player, nodeId) {
    if (!canRank(player, nodeId)) { AudioSys.sfx('denied'); return false; }
    player.skills[nodeId] = (player.skills[nodeId] || 0) + 1;
    player.skillPts--;
    AudioSys.sfx('ui');
    return true;
  }

  function findNode(nodeId) {
    for (const b of DATA.SKILL_TREE)
      for (const n of b.nodes) if (n.id === nodeId) return n;
    return null;
  }

  // описание текущего ранка узла
  function nodeDesc(node, cur) {
    return cur > 0 ? node.desc(cur) : node.desc(1) + (node.max > 1 ? ' (за ранк)' : '');
  }

  return { canRank, reason, rankUp, findNode, nodeDesc };
})();
