export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d');
export const statsEl = document.getElementById('stats');
export const toastWrap = document.getElementById('toasts');
export const staminaBar = document.getElementById('staminaBar');
export const staminaFill = document.getElementById('staminaFill');
export const weightBar = document.getElementById('weightBar');
export const weightFill = document.getElementById('weightFill');
export const shopModal = document.getElementById('shopModal');
const shopBody = document.getElementById('shopBody');
export const invModal = document.getElementById('invModal');
const invGrid = document.getElementById('invGrid');
const invTotal = document.getElementById('invTotal');
export const marketModal = document.getElementById('marketModal');
const marketBody = document.getElementById('marketBody');
const marketTotal = document.getElementById('marketTotal');
export const builderModal = document.getElementById('builderModal');
const builderBody = document.getElementById('builderBody');
export const forgeModal = document.getElementById('forgeModal');
const forgeBody = document.getElementById('forgeBody');
export const warehouseModal = document.getElementById('warehouseModal');
const warehousePlayerInv = document.getElementById('warehousePlayerInv');
const warehouseInv = document.getElementById('warehouseInv');
export const saveBtn = document.getElementById('saveBtn');
export const loadBtn = document.getElementById('loadBtn');
export const loadInput = document.getElementById('loadInput');
export const ascendModal = document.getElementById('ascendModal');
export const ascendBtn = document.getElementById('ascendBtn');
export const ascendCostText = document.getElementById('ascendCostText');
export const ascShopBtn = document.getElementById('ascShopBtn');
export const ascShopModal = document.getElementById('ascShopModal');
export const ascShopBody = document.getElementById('ascShopBody');
export const settingsBtn = document.getElementById('settingsBtn');
export const settingsModal = document.getElementById('settingsModal');
export const settingsClose = document.getElementById('settingsClose');
export const autosaveRange = document.getElementById('autosaveRange');
export const autosaveLabel = document.getElementById('autosaveLabel');
export const toastXInput = document.getElementById('toastXInput');
export const toastYInput = document.getElementById('toastYInput');
export const keybindsTable = document.getElementById('keybindsTable');
export const hardResetBtn = document.getElementById('hardResetBtn');

document.getElementById('shopClose').onclick = () => closeAllModals();
document.getElementById('invClose').onclick = () => closeAllModals();
document.getElementById('marketClose').onclick = () => closeAllModals();
document.getElementById('ascendClose').onclick = () => closeAllModals();
document.getElementById('ascShopClose').onclick = () => closeAllModals();
document.getElementById('builderClose').onclick = () => closeAllModals();
document.getElementById('forgeClose').onclick = () => closeAllModals();
document.getElementById('warehouseClose').onclick = () => closeAllModals();
settingsClose.onclick = () => closeAllModals();

export function say(text) {
  const el = document.createElement('div');
  el.className = 'pointer-events-auto select-none bg-slate-900/95 border border-slate-700 shadow-lg rounded-lg px-3 py-2 text-sm flex items-center gap-2';
  el.textContent = text;
  toastWrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 260);
  }, 10000);
}

export function openModal(el) { el.classList.remove('hidden'); el.classList.add('flex'); }
export function closeModal(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
export function closeAllModals() { closeModal(shopModal); closeModal(invModal); closeModal(marketModal); closeModal(builderModal); closeModal(forgeModal); closeModal(warehouseModal); closeModal(ascendModal); closeModal(ascShopModal); closeModal(settingsModal); }
export function isUIOpen() { return !shopModal.classList.contains('hidden') || !invModal.classList.contains('hidden') || !marketModal.classList.contains('hidden') || !builderModal.classList.contains('hidden') || !forgeModal.classList.contains('hidden') || !warehouseModal.classList.contains('hidden') || !ascendModal.classList.contains('hidden') || !ascShopModal.classList.contains('hidden') || !settingsModal.classList.contains('hidden'); }

export function renderInventory(player, MATERIALS) {
  const counts = new Map();
  for (const it of player.inventory) {
    counts.set(it.id, (counts.get(it.id) || 0) + it.qty);
  }
  const entries = Array.from(counts.entries());
  let totalVal = 0;
  const cells = entries.map(([id, qty]) => {
    const m = MATERIALS[id];
    const total = m.value * qty;
    totalVal += total;
    return `<div class='border border-slate-700 rounded-lg p-2 flex flex-col items-start'>
      <div class='w-5 h-5 rounded-sm mb-1' style='background:${m.color || "transparent"}'></div>
      <div class='text-xs font-medium'>${m.name}</div>
      <div class='text-[11px] text-slate-400'>x${qty} @ $${m.value} = $${total}</div>
    </div>`;
  });
  while (cells.length < 16) cells.push(`<div class='border border-dashed border-slate-700 rounded-lg p-2 h-[52px]'></div>`);
  invGrid.innerHTML = cells.join('');
  invTotal.textContent = 'Total Value: $' + totalVal;
}

export function openInventory(player, MATERIALS) {
  renderInventory(player, MATERIALS);
  openModal(invModal);
}

export function renderShop(player, upgrades, priceFor, buy) {
  const items = [upgrades.pickaxe, upgrades.boots, upgrades.backpack, upgrades.lungs, upgrades.drill];
  shopBody.innerHTML = items.map(u => {
    const cur = player[u.key];
    const nxt = u.key === 'carryCap'
      ? Math.min(u.max, cur * 2)
      : Math.min(u.max, +(cur + u.step).toFixed(2));
    const cost = priceFor(u);
    const disabled = (nxt <= cur || player.cash < cost) ? 'opacity-50 cursor-not-allowed' : '';
    return `
      <div class='flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-3'>
        <div>
          <div class='font-medium'>${u.name}</div>
          <div class='text-slate-400 text-xs'>${u.desc}</div>
          <div class='text-xs mt-1'>Current: <span class='text-slate-200'>${cur}</span> → Next: <span class='text-slate-200'>${nxt}</span></div>
        </div>
        <button data-key='${u.key}' class='buy px-3 py-1.5 rounded-md border border-slate-600 ${disabled}'>$${cost}</button>
      </div>`;
  }).join('');
  shopBody.querySelectorAll('button.buy').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-key');
      const u = items.find(x => x.key === key);
      buy(u);
      renderShop(player, upgrades, priceFor, buy);
    };
  });
}

export function openShop(player, upgrades, priceFor, buy) {
  renderShop(player, upgrades, priceFor, buy);
  openModal(shopModal);
}

export function renderMarket(player, MATERIALS, sellItem, sellAll, inventoryValue) {
  marketBody.innerHTML = player.inventory.map(it => {
    const m = MATERIALS[it.id];
    const total = m.value * it.qty;
    return `
      <div class='flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-3'>
        <div>
          <div class='font-medium'>${m.name}</div>
          <div class='text-xs text-slate-400'>x${it.qty} @ $${m.value} = $${total}</div>
        </div>
        <button data-id='${it.id}' class='sell px-3 py-1.5 rounded-md border border-slate-600'>Sell</button>
      </div>`;
  }).join('');
  marketBody.querySelectorAll('button.sell').forEach(btn => {
    btn.onclick = () => { sellItem(+btn.getAttribute('data-id')); renderMarket(player, MATERIALS, sellItem, sellAll, inventoryValue); };
  });
  marketTotal.textContent = '$' + inventoryValue();
}

export function openMarket(player, MATERIALS, sellItem, sellAll, inventoryValue) {
  renderMarket(player, MATERIALS, sellItem, sellAll, inventoryValue);
  document.getElementById('marketSellAll').onclick = () => { sellAll(); closeModal(marketModal); };
  openModal(marketModal);
}

export function renderBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contribute) {
  const items = [];
  if (player.forgeLevel === 0) items.push({ kind: 'forge', name: 'Forge', cost: BUILDING_COSTS.forge });
  else items.push({ kind: 'forgeUpgrade', name: 'Forge Upgrade', cost: BUILDING_COSTS.forgeUpgrade });
  const hasWarehouse = buildings.some(b => b.kind === 'warehouse');
  if (!hasWarehouse && player.forgeLevel > 0) items.push({ kind: 'warehouse', name: 'Warehouse', cost: BUILDING_COSTS.warehouse });
  builderBody.innerHTML = items.map(it => {
    const prog = player.buildingProgress[it.kind] || { materials: {}, cash: 0 };
    const matLines = Object.entries(it.cost.materials || {}).map(([id, amt]) => {
      const have = prog.materials[id] || 0;
      const mat = MATERIALS[id];
      return `${mat.name}: ${have}/${amt}`;
    }).join('<br>');
    const cashLine = it.cost.cash ? `Cash: ${prog.cash}/${it.cost.cash}` : '';
    return `<div class='border border-slate-700 rounded-xl p-3 space-y-1'>
      <div class='font-medium'>${it.name}</div>
      <div class='text-xs text-slate-400'>${matLines}${cashLine ? '<br>' + cashLine : ''}</div>
      <button data-kind='${it.kind}' class='build px-3 py-1.5 rounded-md border border-slate-600'>Contribute</button>
    </div>`;
  }).join('');
  builderBody.querySelectorAll('button.build').forEach(btn => {
    btn.onclick = () => { contribute(btn.getAttribute('data-kind')); renderBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contribute); };
  });
}

export function openBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contribute) {
  renderBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contribute);
  openModal(builderModal);
}

export function renderForge(player, MATERIALS, BAR_MAP, queueSmelt) {
  const ores = player.inventory.filter(it => MATERIALS[it.id].ore && it.qty >= 10);
  const oreLines = ores.map(it => {
    const m = MATERIALS[it.id];
    const bar = MATERIALS[BAR_MAP[it.id]];
    return `<div class='flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-3'>
      <div>
        <div class='font-medium'>${m.name}</div>
        <div class='text-xs text-slate-400'>10 → ${bar.name}</div>
      </div>
      <button data-id='${it.id}' class='smelt px-3 py-1.5 rounded-md border border-slate-600'>Smelt</button>
    </div>`;
  }).join('');
  const queueLines = player.forgeQueue.map((job, i) => {
    const m = MATERIALS[job.id];
    const bar = MATERIALS[BAR_MAP[job.id]];
    return `<div class='text-xs'>${i + 1}. ${m.name} → ${bar.name}: ${job.time.toFixed(1)}s</div>`;
  }).join('');
  forgeBody.innerHTML = oreLines + `<div class='mt-4'><div class='font-medium mb-1'>Queue</div>${queueLines || '<div class="text-xs text-slate-400">(empty)</div>'}</div>`;
  forgeBody.querySelectorAll('button.smelt').forEach(btn => {
    btn.onclick = () => { queueSmelt(+btn.getAttribute('data-id')); renderForge(player, MATERIALS, BAR_MAP, queueSmelt); };
  });
}

export function openForge(player, MATERIALS, BAR_MAP, queueSmelt) {
  renderForge(player, MATERIALS, BAR_MAP, queueSmelt);
  openModal(forgeModal);
}

export function renderWarehouse(player, MATERIALS, store, take) {
  warehousePlayerInv.innerHTML = player.inventory.map(it => {
    const m = MATERIALS[it.id];
    return `<div class='flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-2'>
      <div>${m.name} x${it.qty}</div>
      <button data-id='${it.id}' class='store px-2 py-1 rounded-md border border-slate-600'>Store</button>
    </div>`;
  }).join('') || '<div class="text-xs text-slate-400">(empty)</div>';
  warehouseInv.innerHTML = player.warehouse.map(it => {
    const m = MATERIALS[it.id];
    return `<div class='flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-2'>
      <div>${m.name} x${it.qty}</div>
      <button data-id='${it.id}' class='take px-2 py-1 rounded-md border border-slate-600'>Take</button>
    </div>`;
  }).join('') || '<div class="text-xs text-slate-400">(empty)</div>';
  warehousePlayerInv.querySelectorAll('button.store').forEach(btn => {
    btn.onclick = () => { store(+btn.getAttribute('data-id')); renderWarehouse(player, MATERIALS, store, take); };
  });
  warehouseInv.querySelectorAll('button.take').forEach(btn => {
    btn.onclick = () => { take(+btn.getAttribute('data-id')); renderWarehouse(player, MATERIALS, store, take); };
  });
}

export function openWarehouse(player, MATERIALS, store, take) {
  renderWarehouse(player, MATERIALS, store, take);
  openModal(warehouseModal);
}
