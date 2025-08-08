import { openModal, closeModal, say } from './ui.js';

export const MERGE_COST = 5;

export const PAGES = [
  {
    id: 'iron_spawn',
    name: 'Iron Lore',
    rarity: 'Common',
    weight: 60,
    desc: 'Increase iron spawn rate by 10% per level.',
    apply: (mats, lvl) => {
      const iron = mats.find(m => m.id === 5);
      if (iron) iron.rarity = Math.round(iron.rarity * (1 + 0.1 * lvl));
    }
  },
  {
    id: 'iron_depth',
    name: 'Iron Mapping',
    rarity: 'Uncommon',
    weight: 30,
    desc: 'Reduce iron minimum depth by 5 per level.',
    apply: (mats, lvl) => {
      const iron = mats.find(m => m.id === 5);
      if (iron) iron.minDepth = Math.max(0, (iron.minDepth || 0) - 5 * lvl);
    }
  },
  {
    id: 'gold_spawn',
    name: 'Gold Scriptures',
    rarity: 'Rare',
    weight: 10,
    desc: 'Increase gold spawn rate by 10% per level.',
    apply: (mats, lvl) => {
      const gold = mats.find(m => m.id === 6);
      if (gold) gold.rarity = Math.round(gold.rarity * (1 + 0.1 * lvl));
    }
  }
];

const PAGE_MAP = Object.fromEntries(PAGES.map(p => [p.id, p]));

export function applyPageModifiers(mats, equipped = {}) {
  for (const id in equipped) {
    const page = PAGE_MAP[id];
    const lvl = equipped[id];
    if (page && lvl > 0) page.apply(mats, lvl);
  }
}

export function awardRandomPage(player) {
  const total = PAGES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PAGES) {
    r -= p.weight;
    if (r <= 0) {
      if (!player.pages) player.pages = {};
      if (!player.pages[p.id]) player.pages[p.id] = {};
      player.pages[p.id][1] = (player.pages[p.id][1] || 0) + 1;
      return p;
    }
  }
  return null;
}

export function mergePage(player, pageId) {
  const owned = player.pages[pageId];
  if (!owned) return false;
  const levels = Object.keys(owned).map(Number).sort((a, b) => a - b);
  for (const lvl of levels) {
    if (owned[lvl] >= MERGE_COST) {
      owned[lvl] -= MERGE_COST;
      if (owned[lvl] === 0) delete owned[lvl];
      owned[lvl + 1] = (owned[lvl + 1] || 0) + 1;
      return true;
    }
  }
  return false;
}

export function equipPage(player, pageId, level) {
  if (level <= 0) delete player.equippedPages[pageId];
  else player.equippedPages[pageId] = level;
}

function ownedSummary(owned) {
  if (!owned) return '';
  return Object.keys(owned)
    .map(Number)
    .sort((a, b) => a - b)
    .map(l => `Lv ${l}: x${owned[l]}`)
    .join('<br>');
}

function canMerge(owned) {
  return owned && Object.values(owned).some(q => q >= MERGE_COST);
}

export function setupPages(player) {
  const btn = document.getElementById('pagesBtn');
  const modal = document.getElementById('pagesModal');
  const body = document.getElementById('pagesBody');
  const closeBtn = document.getElementById('pagesClose');
  closeBtn.onclick = () => closeModal(modal);

  function renderList() {
    body.innerHTML = `<div class='grid grid-cols-3 gap-2'>` +
      PAGES.map(p => {
        const owned = player.pages[p.id];
        const total = owned ? Object.values(owned).reduce((a, b) => a + b, 0) : 0;
        const highest = owned ? Math.max(...Object.keys(owned).map(Number)) : 0;
        const known = total > 0;
        const merge = canMerge(owned);
        return `<div data-id='${p.id}' class='pageTile border border-slate-700 rounded-lg p-2 ${known ? 'cursor-pointer' : ''}'>` +
          `<div class='font-medium'>${known ? p.name : 'Unknown'}</div>` +
          `<div class='text-xs text-slate-400'>${p.rarity}</div>` +
          `<div class='text-xs'>Lv ${highest}</div>` +
          `<div class='text-xs'>x${total}</div>` +
          (merge ? `<div class='text-[10px] text-yellow-400 mt-1'>Merge!</div>` : '') +
          `</div>`;
      }).join('') + `</div>`;
    body.querySelectorAll('.pageTile').forEach(el => {
      el.onclick = () => {
        const id = el.getAttribute('data-id');
        const owned = player.pages[id];
        const total = owned ? Object.values(owned).reduce((a, b) => a + b, 0) : 0;
        if (!total) return;
        renderDetail(id);
      };
    });
  }

  function renderDetail(id) {
    const page = PAGE_MAP[id];
    const owned = player.pages[id] || {};
    const total = Object.values(owned).reduce((a, b) => a + b, 0);
    const highest = total ? Math.max(...Object.keys(owned).map(Number)) : 0;
    const equipped = player.equippedPages[id] || 0;
    const mergePossible = canMerge(owned);
    body.innerHTML = `
      <button id='pagesBack' class='mb-3 px-2 py-1 rounded-md border border-slate-600'>&larr; Back</button>
      <div class='mb-2 font-semibold'>${page.name}</div>
      <div class='mb-2 text-slate-400 text-xs'>${page.desc}</div>
      <div class='mb-2'>Owned:</div>
      <div class='mb-3 text-xs'>${ownedSummary(owned) || 'None'}</div>
      <div class='flex gap-2'>
        <button id='pagesMerge' class='px-3 py-1 rounded-md border border-slate-600 ${mergePossible ? '' : 'opacity-50 cursor-not-allowed'}'>Merge</button>
        <button id='pagesEquip' class='px-3 py-1 rounded-md border border-slate-600'>${equipped ? 'Unequip' : 'Equip Lv ' + highest}</button>
      </div>
    `;
    body.querySelector('#pagesBack').onclick = renderList;
    body.querySelector('#pagesMerge').onclick = () => {
      if (mergePossible) {
        mergePage(player, id);
        renderDetail(id);
      }
    };
    body.querySelector('#pagesEquip').onclick = () => {
      if (equipped) {
        equipPage(player, id, 0);
        say('Unequipped ' + page.name);
      } else if (highest > 0) {
        equipPage(player, id, highest);
        say('Equipped ' + page.name + ' Lv' + highest);
      }
      renderDetail(id);
    };
  }

  btn.onclick = () => { renderList(); openModal(modal); };
}
