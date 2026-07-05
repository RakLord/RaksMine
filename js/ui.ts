import type {Player, Material, Upgrade, MaterialId, Building, BuildingCost, ForgeJob, ForgeStatus} from './types';
import {hammerUrl} from './sprites';

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
  costFor: (kind: string) => BuildingCost | null,
  buildings: Building[],
  contribute: (kind: string) => void,
) {
  const items: { kind: string; name: string; cost: BuildingCost }[] = [];
  const push = (kind: string, name: string) => { const c = costFor(kind); if (c) items.push({ kind, name, cost: c }); };
  if (player.forgeLevel === 0) push('forge', 'Forge');
  else push('forgeUpgrade', `Forge Upgrade → Lv ${player.forgeLevel + 1}`);
  const hasWarehouse = buildings.some(b => b.kind === 'warehouse');
  if (!hasWarehouse && player.forgeLevel > 0) push('warehouse', 'Warehouse');
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
    btn.onclick = () => { const kind = btn.getAttribute('data-kind'); if (kind) contribute(kind); renderBuilder(player, MATERIALS, costFor, buildings, contribute); };
  });
}

export function openBuilder(
  player: Player,
  MATERIALS: Material[],
  costFor: (kind: string) => BuildingCost | null,
  buildings: Building[],
  contribute: (kind: string) => void,
) {
  renderBuilder(player, MATERIALS, costFor, buildings, contribute);
  openModal(builderModal);
}

// ---- Forge -----------------------------------------------------------------
// One column per smeltable ore. The DOM structure is rebuilt only on discrete
// changes (open, click, job completion); the per-frame tick nudges progress-bar
// widths and time labels only — never innerHTML — so button nodes stay alive and
// clicks always complete. (The old bug: a 60fps innerHTML rebuild destroyed the
// Smelt button mid-press, so the click never fired.)
export interface ForgeApi {
  smelt: (id: MaterialId) => void;
  hammer: (id: MaterialId) => void;
  raiseHammer: () => void;
  raiseTemp: () => void;
  status: () => ForgeStatus;
  activeJobs: () => ForgeJob[];
}

let forgeState: {
  player: Player;
  MATERIALS: Material[];
  BAR_MAP: Record<MaterialId, MaterialId>;
  api: ForgeApi;
} | null = null;
let forgeDelegated = false;

const hammerIcon = hammerUrl
  ? `<img src='${hammerUrl}' alt='hammer' style='width:18px;height:18px;image-rendering:pixelated'>`
  : '🔨';

export function renderForge() {
  if (!forgeState) return;
  const { player, MATERIALS, BAR_MAP, api } = forgeState;
  const status = api.status();
  const active = api.activeJobs();

  // Columns = ores you can smelt (>=10 held) OR that already have a job queued.
  const ids = new Set<MaterialId>();
  for (const it of player.inventory) if (MATERIALS[it.id].ore && it.qty >= 10) ids.add(it.id);
  for (const j of player.forgeQueue) ids.add(j.id);
  const oreIds = Array.from(ids).sort((a, b) => a - b);

  const cols = oreIds.map(id => {
    const m = MATERIALS[id];
    const bar = MATERIALS[BAR_MAP[id]];
    const held = player.inventory.find(it => it.id === id)?.qty ?? 0;
    const jobs = player.forgeQueue.filter(j => j.id === id);
    const activeJob = jobs.find(j => active.includes(j));
    const waiting = jobs.length - (activeJob ? 1 : 0);
    const ratio = activeJob ? 1 - activeJob.time / (activeJob.total || 1) : 0;
    const timeLabel = activeJob ? Math.max(0, activeJob.time).toFixed(1) + 's' : '—';
    return `<div class='forge-col'>
      <div class='font-medium'>${m.name}</div>
      <div class='text-2xs muted'>10 → ${bar.name}</div>
      <div class='progress'><div class='progress__fill' data-fill='${id}' style='width:${(ratio * 100).toFixed(1)}%'></div></div>
      <div class='text-xs forge-col__meta'>
        <span data-time='${id}'>${timeLabel}</span>
        <span class='muted'>${waiting > 0 ? '×' + waiting + ' queued' : ''}</span>
      </div>
      <div class='forge-col__actions'>
        <button data-action='smelt' data-id='${id}' class='btn btn-sm btn-block${held >= 10 ? '' : ' is-disabled'}'>Smelt</button>
        <button data-action='hammer' data-id='${id}' class='hammer-btn${activeJob ? '' : ' is-disabled'}' title='-${status.hammerPct}% of bar'>${hammerIcon}</button>
      </div>
    </div>`;
  }).join('');

  const grid = cols
    ? `<div class='forge-grid'>${cols}</div>`
    : `<div class='text-xs muted'>Mine 10+ of an ore to smelt it.</div>`;

  let hammerHTML = '';
  if (status.hammerUnlocked) {
    const action = status.hammerMaxed
      ? `<span class='text-xs accent'>MAX · instant</span>`
      : `<button data-action='hammerup' class='btn btn-sm${status.hammerCanAfford ? '' : ' is-disabled'}'>Raise · $${status.hammerNextCost.toLocaleString()}</button>`;
    hammerHTML = `<div class='list-row'>
      <div>
        <div class='font-medium'>🔨 Click Power — Lv ${status.hammerLevel}/${status.hammerMax}</div>
        <div class='text-xs muted'>−${status.hammerPct}% of bar per click</div>
      </div>
      ${action}
    </div>`;
  }

  let tempHTML = '';
  if (status.tempUnlocked) {
    tempHTML = `<div class='list-row'>
      <div>
        <div class='font-medium'>🌡 Temperature — Lv ${status.tempLevel}</div>
        <div class='text-xs muted'>−${status.tempReductionPct}% smelt time</div>
      </div>
      <button data-action='temp' class='btn btn-sm${status.tempCanAfford ? '' : ' is-disabled'}'>Raise · $${status.tempNextCost.toLocaleString()}</button>
    </div>`;
  }

  const header = `<div class='text-xs muted'>Forge Lv ${status.level}${status.parallelUnlocked ? ' · parallel smelting' : ''}</div>`;

  forgeBody.innerHTML = header + grid + hammerHTML + tempHTML;
}

// Per-frame: only mutate live progress widths + time labels on existing nodes.
export function tickForgeView() {
  if (!forgeState) return;
  const byId = new Map<number, ForgeJob>();
  for (const j of forgeState.api.activeJobs()) byId.set(j.id, j);
  forgeBody.querySelectorAll<HTMLElement>('[data-fill]').forEach(elm => {
    const j = byId.get(Number(elm.getAttribute('data-fill')));
    if (j) elm.style.width = ((1 - j.time / (j.total || 1)) * 100).toFixed(1) + '%';
  });
  forgeBody.querySelectorAll<HTMLElement>('[data-time]').forEach(elm => {
    const j = byId.get(Number(elm.getAttribute('data-time')));
    if (j) elm.textContent = Math.max(0, j.time).toFixed(1) + 's';
  });
}

function onForgeClick(e: MouseEvent) {
  if (!forgeState) return;
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!t || t.classList.contains('is-disabled')) return;
  const action = t.getAttribute('data-action');
  const id = t.getAttribute('data-id');
  if (action === 'smelt' && id) forgeState.api.smelt(Number(id));
  else if (action === 'hammer' && id) forgeState.api.hammer(Number(id));
  else if (action === 'hammerup') forgeState.api.raiseHammer();
  else if (action === 'temp') forgeState.api.raiseTemp();
  renderForge();
}

export function openForge(
  player: Player,
  MATERIALS: Material[],
  BAR_MAP: Record<MaterialId, MaterialId>,
  api: ForgeApi,
) {
  forgeState = { player, MATERIALS, BAR_MAP, api };
  // Delegate on the stable parent once — survives child rebuilds so clicks land.
  if (!forgeDelegated) { forgeBody.onclick = onForgeClick; forgeDelegated = true; }
  renderForge();
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
