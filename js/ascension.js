import { openModal, ascShopBtn, ascShopModal, ascShopBody, say } from './ui.js';

export const ASCENSION_UPGRADES = [
  {
    id: 'drill_range',
    name: '+1 Drill Range',
    desc: 'Increase drill range by 1.',
    cost: 1,
    tier: 0,
    apply: p => { p.drill += 1; }
  },
  {
    id: 'backpack_size',
    name: '+100 Backpack Size',
    desc: 'Increase backpack capacity by 100.',
    cost: 1,
    tier: 1,
    requires: ['drill_range'],
    apply: p => { p.carryCap += 100; }
  },
  {
    id: 'stamina_gain',
    name: '2x Stamina Gain',
    desc: 'Double stamina regeneration.',
    cost: 2,
    tier: 1,
    requires: ['drill_range'],
    apply: p => { p.staminaRegen = (p.staminaRegen || 1) * 2; }
  }
];

const UP_MAP = Object.fromEntries(ASCENSION_UPGRADES.map(u => [u.id, u]));

export function applyAscensionUpgrades(player) {
  if (!player.ascensionUpgrades) player.ascensionUpgrades = {};
  for (const id in player.ascensionUpgrades) {
    const up = UP_MAP[id];
    if (up && typeof up.apply === 'function') up.apply(player);
  }
}

export function setupAscensionShop(player) {
  if (!ascShopBtn) return;

  function owned(id) { return player.ascensionUpgrades && player.ascensionUpgrades[id]; }

  function canBuy(up) {
    if (owned(up.id)) return false;
    if (player.ascensionPoints < up.cost) return false;
    if (up.requires && !up.requires.every(r => owned(r))) return false;
    return true;
  }

  function buy(id) {
    const up = UP_MAP[id];
    if (!up || !canBuy(up)) return;
    player.ascensionPoints -= up.cost;
    if (!player.ascensionUpgrades) player.ascensionUpgrades = {};
    player.ascensionUpgrades[id] = true;
    up.apply(player);
    say('Purchased ' + up.name);
    render();
  }

  function render() {
    const tiers = {};
    for (const up of ASCENSION_UPGRADES) {
      (tiers[up.tier] ||= []).push(up);
    }
    const order = Object.keys(tiers).map(Number).sort((a, b) => a - b);
    let html = `<div class='mb-3'>Ascension Points: ${player.ascensionPoints}</div><div class='flex gap-4'>`;
    for (const t of order) {
      html += "<div class='flex flex-col gap-2'>";
      for (const up of tiers[t]) {
        const bought = owned(up.id);
        const disabled = !canBuy(up) ? 'opacity-50 cursor-not-allowed' : '';
        html += `<button data-id='${up.id}' class='ascUpg px-2 py-1 rounded-md border border-slate-600 ${disabled} ${bought ? 'bg-slate-700' : ''}'>${up.name}<br><span class='text-xs text-slate-400'>Cost ${up.cost}</span></button>`;
      }
      html += '</div>';
    }
    html += '</div>';
    ascShopBody.innerHTML = html;
    ascShopBody.querySelectorAll('button.ascUpg').forEach(btn => {
      btn.onclick = () => buy(btn.getAttribute('data-id'));
    });
  }

  ascShopBtn.onclick = () => { render(); openModal(ascShopModal); };
}

