import { openModal, ascShopBtn, ascShopModal, ascShopBody, say } from './ui';
import type { AscensionUpgrade, Player } from './types';

export const ASCENSION_UPGRADES: AscensionUpgrade[] = [
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
    apply: p => { p.staminaRegen *= 2; } // no-op while base regen is 0; scales it once set
  },
  {
    id: 'mine_up',
    name: 'Unlock Up Mining',
    desc: 'Allows mining upward.',
    cost: 2,
    tier: 0,
    apply: p => { p.mineUp = true; }
  }
];

const UP_MAP: Record<string, AscensionUpgrade> = Object.fromEntries(ASCENSION_UPGRADES.map(u => [u.id, u]));

export function applyAscensionUpgrades(player: Player) {
  if (!player.ascensionUpgrades) player.ascensionUpgrades = {};
  for (const id in player.ascensionUpgrades) {
    const up = UP_MAP[id];
    if (up && typeof up.apply === 'function') up.apply(player);
  }
}

export function setupAscensionShop(player: Player) {
  if (!ascShopBtn) return;

  function owned(id: string) { return player.ascensionUpgrades && player.ascensionUpgrades[id]; }

  function canBuy(up: AscensionUpgrade) {
    if (owned(up.id)) return false;
    if (player.ascensionPoints < up.cost) return false;
    if (up.requires && !up.requires.every(r => owned(r))) return false;
    return true;
  }

  function buy(id: string) {
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
    const tiers: Record<number, AscensionUpgrade[]> = {};
    for (const up of ASCENSION_UPGRADES) {
      (tiers[up.tier] ||= []).push(up);
    }
    const order = Object.keys(tiers).map(Number).sort((a, b) => a - b);
    let html = `<div>Ascension Points: <span class='accent'>${player.ascensionPoints}</span></div><div class='row' style='align-items:flex-start;gap:16px'>`;
    for (const t of order) {
      html += "<div class='col'>";
      for (const up of tiers[t]) {
        const bought = owned(up.id);
        const disabled = !canBuy(up) ? 'is-disabled' : '';
        html += `<button data-id='${up.id}' class='ascUpg btn ${disabled} ${bought ? 'is-owned' : ''}'>${up.name}<br><span class='text-xs muted'>Cost ${up.cost}</span></button>`;
      }
      html += '</div>';
    }
    html += '</div>';
    ascShopBody.innerHTML = html;
    ascShopBody.querySelectorAll<HTMLElement>('button.ascUpg').forEach(btn => {
      btn.onclick = () => { const id = btn.getAttribute('data-id'); if (id) buy(id); };
    });
  }

  ascShopBtn.onclick = () => { render(); openModal(ascShopModal); };
}

