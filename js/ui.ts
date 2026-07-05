import type {Player, Material, Upgrade, MaterialId, Building, BuildingCost} from './types';

// Typed element lookup: throws if the id is missing so refs are never null.
export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error('Missing element #' + id);
  return e as T;
}

export const canvas = el<HTMLCanvasElement>('game');
export const ctx = canvas.getContext('2d')!;
export const statsEl = el('stats');
export const toastWrap = el('toasts');
export const staminaBar = el('staminaBar');
export const staminaFill = el('staminaFill');
export const weightBar = el('weightBar');
export const weightFill = el('weightFill');
export const shopModal = el('shopModal');
const shopBody = el('shopBody');
export const invModal = el('invModal');
const invGrid = el('invGrid');
const invTotal = el('invTotal');
export const marketModal = el('marketModal');
const marketBody = el('marketBody');
const marketTotal = el('marketTotal');
export const builderModal = el('builderModal');
const builderBody = el('builderBody');
export const forgeModal = el('forgeModal');
const forgeBody = el('forgeBody');
export const warehouseModal = el('warehouseModal');
export const pagesModal = el('pagesModal');
const warehousePlayerInv = el('warehousePlayerInv');
const warehouseInv = el('warehouseInv');
export const saveBtn = el('saveBtn');
export const loadBtn = el('loadBtn');
export const loadInput = el<HTMLInputElement>('loadInput');
export const ascendModal = el('ascendModal');
export const ascendBtn = el('ascendBtn');
export const ascendCostText = el('ascendCostText');
export const ascShopBtn = el('ascShopBtn');
export const ascShopModal = el('ascShopModal');
export const ascShopBody = el('ascShopBody');
export const settingsBtn = el('settingsBtn');
export const settingsModal = el('settingsModal');
export const settingsClose = el('settingsClose');
export const autosaveRange = el<HTMLInputElement>('autosaveRange');
export const autosaveLabel = el('autosaveLabel');
export const toastXInput = el<HTMLInputElement>('toastXInput');
export const toastYInput = el<HTMLInputElement>('toastYInput');
export const keybindsTable = el('keybindsTable');
export const hardResetBtn = el('hardResetBtn');

el('shopClose').onclick = () => closeAllModals();
el('invClose').onclick = () => closeAllModals();
el('marketClose').onclick = () => closeAllModals();
el('ascendClose').onclick = () => closeAllModals();
el('ascShopClose').onclick = () => closeAllModals();
el('builderClose').onclick = () => closeAllModals();
el('forgeClose').onclick = () => closeAllModals();
el('warehouseClose').onclick = () => closeAllModals();
settingsClose.onclick = () => closeAllModals();

export function say(text: string) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toastWrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, 10000);
}

export function openModal(el: HTMLElement) { el.classList.remove('hidden'); el.classList.add('flex'); }
export function closeModal(el: HTMLElement) { el.classList.add('hidden'); el.classList.remove('flex'); }
export function closeAllModals() { closeModal(shopModal); closeModal(invModal); closeModal(marketModal); closeModal(builderModal); closeModal(forgeModal); closeModal(warehouseModal); closeModal(ascendModal); closeModal(ascShopModal); closeModal(pagesModal); closeModal(settingsModal); }
export function isUIOpen() { return isOpen(shopModal) || isOpen(invModal) || isOpen(marketModal) || isOpen(builderModal) || isOpen(forgeModal) || isOpen(warehouseModal) || isOpen(ascendModal) || isOpen(ascShopModal) || isOpen(pagesModal) || isOpen(settingsModal); }
function isOpen(el: HTMLElement) { return !el.classList.contains('hidden'); }

export function renderInventory(player: Player, MATERIALS: Material[]) {
  const counts = new Map<MaterialId, number>();
  for (const it of player.inventory) {
    counts.set(it.id, (counts.get(it.id) || 0) + it.qty);
  }
  const entries = Array.from(counts.entries());
  let totalVal = 0;
  const cells = entries.map(([id, qty]) => {
    const m = MATERIALS[id];
    const total = m.value * qty;
    totalVal += total;
    return `<div class='tile'>
      <div class='tile__swatch' style='background:${m.color || "transparent"}'></div>
      <div class='text-xs font-medium'>${m.name}</div>
      <div class='text-2xs muted'>x${qty} @ $${m.value} = $${total}</div>
    </div>`;
  });
  while (cells.length < 16) cells.push(`<div class='tile tile--empty'></div>`);
  invGrid.innerHTML = cells.join('');
  invTotal.textContent = 'Total Value: $' + totalVal;
}

export function openInventory(player: Player, MATERIALS: Material[]) {
  renderInventory(player, MATERIALS);
  openModal(invModal);
}

export function renderShop(
  player: Player,
  upgrades: Record<string, Upgrade>,
  priceFor: (u: Upgrade) => number,
  buy: (u: Upgrade) => void,
) {
  const items = [upgrades.pickaxe, upgrades.boots, upgrades.backpack, upgrades.lungs, upgrades.drill];
  shopBody.innerHTML = items.map(u => {
    const cur = player[u.key];
    const nxt = u.key === 'carryCap'
      ? Math.min(u.max, cur * 2)
      : Math.min(u.max, +(cur + (u.step ?? 0)).toFixed(2));
    const cost = priceFor(u);
    const disabled = (nxt <= cur || player.cash < cost) ? 'is-disabled' : '';
    return `
      <div class='list-row'>
        <div>
          <div class='font-medium'>${u.name}</div>
          <div class='muted text-xs'>${u.desc}</div>
          <div class='text-xs'>Current: <span class='accent'>${cur}</span> → Next: <span class='accent'>${nxt}</span></div>
        </div>
        <button data-key='${u.key}' class='buy btn ${disabled}'>$${cost}</button>
      </div>`;
  }).join('');
  shopBody.querySelectorAll<HTMLElement>('button.buy').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-key');
      const u = items.find(x => x.key === key);
      if (u) buy(u);
      renderShop(player, upgrades, priceFor, buy);
    };
  });
}

export function openShop(
  player: Player,
  upgrades: Record<string, Upgrade>,
  priceFor: (u: Upgrade) => number,
  buy: (u: Upgrade) => void,
) {
  renderShop(player, upgrades, priceFor, buy);
  openModal(shopModal);
}

export function renderMarket(
  player: Player,
  MATERIALS: Material[],
  sellItem: (id: MaterialId) => void,
  sellAll: () => void,
  inventoryValue: () => number,
) {
  marketBody.innerHTML = player.inventory.map(it => {
    const m = MATERIALS[it.id];
    const total = m.value * it.qty;
    return `
      <div class='list-row'>
        <div>
          <div class='font-medium'>${m.name}</div>
          <div class='text-xs muted'>x${it.qty} @ $${m.value} = $${total}</div>
        </div>
        <button data-id='${it.id}' class='sell btn'>Sell</button>
      </div>`;
  }).join('');
  marketBody.querySelectorAll<HTMLElement>('button.sell').forEach(btn => {
    btn.onclick = () => { sellItem(Number(btn.getAttribute('data-id'))); renderMarket(player, MATERIALS, sellItem, sellAll, inventoryValue); };
  });
  marketTotal.textContent = '$' + inventoryValue();
}

export function openMarket(
  player: Player,
  MATERIALS: Material[],
  sellItem: (id: MaterialId) => void,
  sellAll: () => void,
  inventoryValue: () => number,
) {
  renderMarket(player, MATERIALS, sellItem, sellAll, inventoryValue);
  el('marketSellAll').onclick = () => { sellAll(); closeModal(marketModal); };
  openModal(marketModal);
}

export function renderBuilder(
  player: Player,
  MATERIALS: Material[],
  BUILDING_COSTS: Record<string, BuildingCost>,
  buildings: Building[],
  contribute: (kind: string) => void,
) {
  const items: { kind: string; name: string; cost: BuildingCost }[] = [];
  if (player.forgeLevel === 0) items.push({ kind: 'forge', name: 'Forge', cost: BUILDING_COSTS.forge });
  else items.push({ kind: 'forgeUpgrade', name: 'Forge Upgrade', cost: BUILDING_COSTS.forgeUpgrade });
  const hasWarehouse = buildings.some(b => b.kind === 'warehouse');
  if (!hasWarehouse && player.forgeLevel > 0) items.push({ kind: 'warehouse', name: 'Warehouse', cost: BUILDING_COSTS.warehouse });
  builderBody.innerHTML = items.map(it => {
    const prog = player.buildingProgress[it.kind] || { materials: {}, cash: 0 };
    const matLines = Object.entries(it.cost.materials || {}).map(([id, amt]) => {
      const have = prog.materials[id] || 0;
      const mat = MATERIALS[Number(id)];
      return `${mat.name}: ${have}/${amt}`;
    }).join('<br>');
    const cashLine = it.cost.cash ? `Cash: ${prog.cash}/${it.cost.cash}` : '';
    return `<div class='tile' style='width:100%;gap:4px'>
      <div class='font-medium'>${it.name}</div>
      <div class='text-xs muted'>${matLines}${cashLine ? '<br>' + cashLine : ''}</div>
      <button data-kind='${it.kind}' class='build btn'>Contribute</button>
    </div>`;
  }).join('');
  builderBody.querySelectorAll<HTMLElement>('button.build').forEach(btn => {
    btn.onclick = () => { const kind = btn.getAttribute('data-kind'); if (kind) contribute(kind); renderBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contribute); };
  });
}

export function openBuilder(
  player: Player,
  MATERIALS: Material[],
  BUILDING_COSTS: Record<string, BuildingCost>,
  buildings: Building[],
  contribute: (kind: string) => void,
) {
  renderBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contribute);
  openModal(builderModal);
}

export function renderForge(
  player: Player,
  MATERIALS: Material[],
  BAR_MAP: Record<MaterialId, MaterialId>,
  queueSmelt: (oreId: MaterialId) => void,
) {
  const ores = player.inventory.filter(it => MATERIALS[it.id].ore && it.qty >= 10);
  const oreLines = ores.map(it => {
    const m = MATERIALS[it.id];
    const bar = MATERIALS[BAR_MAP[it.id]];
    return `<div class='list-row'>
      <div>
        <div class='font-medium'>${m.name}</div>
        <div class='text-xs muted'>10 → ${bar.name}</div>
      </div>
      <button data-id='${it.id}' class='smelt btn'>Smelt</button>
    </div>`;
  }).join('');
  let progressHTML = '';
  if (player.forgeQueue.length > 0) {
    const job = player.forgeQueue[0];
    const m = MATERIALS[job.id];
    const bar = MATERIALS[BAR_MAP[job.id]];
    const total = job.total || 1;
    const ratio = 1 - job.time / total;
    progressHTML = `<div>
      <div class='text-xs' style='margin-bottom:4px'>Smelting ${m.name} → ${bar.name}</div>
      <div class='progress'><div class='progress__fill' style='width:${(ratio * 100).toFixed(1)}%'></div></div>
    </div>`;
  }
  const queueLines = player.forgeQueue.map((job, i) => {
    const m = MATERIALS[job.id];
    const bar = MATERIALS[BAR_MAP[job.id]];
    return `<div class='text-xs'>${i + 1}. ${m.name} → ${bar.name}: ${job.time.toFixed(1)}s</div>`;
  }).join('');
  forgeBody.innerHTML = oreLines + progressHTML + `<div><div class='font-medium'>Queue</div>${queueLines || '<div class="text-xs muted">(empty)</div>'}</div>`;
  forgeBody.querySelectorAll<HTMLElement>('button.smelt').forEach(btn => {
    btn.onclick = () => { queueSmelt(Number(btn.getAttribute('data-id'))); renderForge(player, MATERIALS, BAR_MAP, queueSmelt); };
  });
}

export function openForge(
  player: Player,
  MATERIALS: Material[],
  BAR_MAP: Record<MaterialId, MaterialId>,
  queueSmelt: (oreId: MaterialId) => void,
) {
  renderForge(player, MATERIALS, BAR_MAP, queueSmelt);
  openModal(forgeModal);
}

export function renderWarehouse(
  player: Player,
  MATERIALS: Material[],
  store: (id: MaterialId) => void,
  take: (id: MaterialId) => void,
) {
  warehousePlayerInv.innerHTML = player.inventory.map(it => {
    const m = MATERIALS[it.id];
    return `<div class='list-row list-row--sm'>
      <div>${m.name} x${it.qty}</div>
      <button data-id='${it.id}' class='store btn btn-sm'>Store</button>
    </div>`;
  }).join('') || '<div class="text-xs muted">(empty)</div>';
  warehouseInv.innerHTML = player.warehouse.map(it => {
    const m = MATERIALS[it.id];
    return `<div class='list-row list-row--sm'>
      <div>${m.name} x${it.qty}</div>
      <button data-id='${it.id}' class='take btn btn-sm'>Take</button>
    </div>`;
  }).join('') || '<div class="text-xs muted">(empty)</div>';
  warehousePlayerInv.querySelectorAll<HTMLElement>('button.store').forEach(btn => {
    btn.onclick = () => { store(Number(btn.getAttribute('data-id'))); renderWarehouse(player, MATERIALS, store, take); };
  });
  warehouseInv.querySelectorAll<HTMLElement>('button.take').forEach(btn => {
    btn.onclick = () => { take(Number(btn.getAttribute('data-id'))); renderWarehouse(player, MATERIALS, store, take); };
  });
}

export function openWarehouse(
  player: Player,
  MATERIALS: Material[],
  store: (id: MaterialId) => void,
  take: (id: MaterialId) => void,
) {
  renderWarehouse(player, MATERIALS, store, take);
  openModal(warehouseModal);
}
