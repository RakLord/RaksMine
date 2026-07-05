import { openModal, closeModal, say, el } from './ui';
import { MATERIALS } from './materials';
import type { Material, Player, Page, PageOwned } from './types';

export const MERGE_COST = 5;

const ENCHANT_CHARS = Array.from('ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ⚍⍊∴ꖝ||⨅');

function randomEnchant(len = 5): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ENCHANT_CHARS[Math.floor(Math.random() * ENCHANT_CHARS.length)];
  return s;
}

function rarityInfo(value: number) {
  if (value >= 15) return { rarity: 'Common', weight: 60 };
  if (value >= 8) return { rarity: 'Uncommon', weight: 30 };
  return { rarity: 'Rare', weight: 10 };
}

function generateOrePages(): Page[] {
  const pages: Page[] = [];
  const ores = MATERIALS.filter(m => m.ore);
  for (const ore of ores) {
    const slug = ore.name.toLowerCase().replace(/\s+/g, '_');
    const info = rarityInfo(ore.rarity || 0);
    pages.push({
      id: `${slug}_spawn`,
      name: `${ore.name} Lore`,
      rarity: info.rarity,
      weight: info.weight,
      desc: `Increase ${ore.name.toLowerCase()} spawn rate by 10% per level.`,
      apply: (mats: Material[], lvl: number) => {
        const mat = mats.find(m => m.id === ore.id);
        if (mat) mat.rarity = Math.round((mat.rarity ?? 0) * (1 + 0.1 * lvl));
      }
    });
    pages.push({
      id: `${slug}_depth`,
      name: `${ore.name} Mapping`,
      rarity: info.rarity,
      weight: info.weight,
      desc: `Reduce ${ore.name.toLowerCase()} minimum depth by 5 per level.`,
      apply: (mats: Material[], lvl: number) => {
        const mat = mats.find(m => m.id === ore.id);
        if (mat) mat.minDepth = Math.max(0, (mat.minDepth || 0) - 5 * lvl);
      }
    });
  }
  return pages;
}

export const PAGES = generateOrePages();

const PAGE_MAP: Record<string, Page> = Object.fromEntries(PAGES.map(p => [p.id, p]));

export function applyPageModifiers(mats: Material[], equipped: Record<string, number> = {}) {
  for (const id in equipped) {
    const page = PAGE_MAP[id];
    const lvl = equipped[id];
    if (page && lvl > 0) page.apply(mats, lvl);
  }
}

export function awardRandomPage(player: Player): Page | null {
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

export function mergePage(player: Player, pageId: string): boolean {
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

export function equipPage(player: Player, pageId: string, level: number) {
  if (level <= 0) delete player.equippedPages[pageId];
  else player.equippedPages[pageId] = level;
}

function ownedSummary(owned?: PageOwned) {
  if (!owned) return '';
  return Object.keys(owned)
    .map(Number)
    .sort((a, b) => a - b)
    .map(l => `Lv ${l}: x${owned[l]}`)
    .join('<br>');
}

function canMerge(owned?: PageOwned) {
  return owned && Object.values(owned).some(q => q >= MERGE_COST);
}

export function setupPages(player: Player) {
  const btn = el('pagesBtn');
  const modal = el('pagesModal');
  const body = el('pagesBody');
  const closeBtn = el('pagesClose');
  let mysticInterval: ReturnType<typeof setInterval> | undefined;
  closeBtn.onclick = () => { if (mysticInterval) clearInterval(mysticInterval); closeModal(modal); };

  function renderList() {
    body.innerHTML = `<div class='grid-3'>` +
      PAGES.map(p => {
        const owned = player.pages[p.id];
        const total = owned ? Object.values(owned).reduce((a, b) => a + b, 0) : 0;
        const highest = owned ? Math.max(...Object.keys(owned).map(Number)) : 0;
        const known = total > 0;
        const merge = canMerge(owned);
        const equipped = player.equippedPages[p.id];
        return `<div data-id='${p.id}' class='pageTile tile ${known ? 'is-known' : ''} ${equipped ? 'is-equipped' : ''}'>` +
          `<div class='font-medium ${known ? '' : 'unknownName enchant'}'>${known ? p.name : randomEnchant()}</div>` +
          `<div class='text-xs muted'>${p.rarity}</div>` +
          `<div class='text-xs'>Lv ${highest}</div>` +
          `<div class='text-xs'>x${total}</div>` +
          (merge ? `<div class='flag-merge'>Merge!</div>` : '') +
          `</div>`;
      }).join('') + `</div>`;
    if (mysticInterval) clearInterval(mysticInterval);
    const unknownEls = body.querySelectorAll('.unknownName');
    if (unknownEls.length) {
      mysticInterval = setInterval(() => {
        unknownEls.forEach(el => el.textContent = randomEnchant());
      }, 200);
    }
    body.querySelectorAll<HTMLElement>('.pageTile').forEach(tile => {
      tile.onclick = () => {
        const id = tile.getAttribute('data-id');
        if (!id) return;
        const owned = player.pages[id];
        const total = owned ? Object.values(owned).reduce((a, b) => a + b, 0) : 0;
        if (!total) return;
        if (mysticInterval) clearInterval(mysticInterval);
        renderDetail(id);
      };
    });
  }

  function renderDetail(id: string) {
    const page = PAGE_MAP[id];
    const owned = player.pages[id] || {};
    const total = Object.values(owned).reduce((a, b) => a + b, 0);
    const highest = total ? Math.max(...Object.keys(owned).map(Number)) : 0;
    const equipped = player.equippedPages[id] || 0;
    const mergePossible = canMerge(owned);
    body.innerHTML = `
      <button id='pagesBack' class='btn btn-sm' style='align-self:flex-start'>&larr; Back</button>
      <div class='font-semibold'>${page.name}</div>
      <div class='muted text-xs'>${page.desc}</div>
      <div>Owned:</div>
      <div class='text-xs'>${ownedSummary(owned) || 'None'}</div>
      <div class='row'>
        <button id='pagesMerge' class='btn ${mergePossible ? '' : 'is-disabled'}'>Merge</button>
        <button id='pagesEquip' class='btn'>${equipped ? 'Unequip' : 'Equip Lv ' + highest}</button>
      </div>
    `;
    el('pagesBack').onclick = () => { renderList(); };
    el('pagesMerge').onclick = () => {
      if (mergePossible) {
        mergePage(player, id);
        renderDetail(id);
      }
    };
    el('pagesEquip').onclick = () => {
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
