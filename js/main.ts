import {TILE, MAP_W, MAP_H, MOVE_ACC, GRAV, FRICTION} from './config';
import {MATERIALS, BAR_MAP} from './materials';
import {world, worldToTile, isSolidAt, generateWorld} from './world';
import {resolvePlayerMovement} from './physics';
import {el, canvas, ctx, statsEl, say, closeAllModals, closeModal, isUIOpen, openInventory, openShop, openMarket, marketModal, saveBtn, loadBtn, loadInput, staminaBar, staminaFill, weightBar, weightFill, openModal, ascendModal, ascendBtn, settingsBtn, settingsModal, autosaveRange, autosaveLabel, toastXInput, toastYInput, keybindsTable, hardResetBtn, toastWrap, ascendCostText, openBuilder, openForge, openWarehouse, renderForge, forgeModal} from './ui';
import {player, buildings, rectsIntersect, totalWeight, invAdd, teleportHome, upgrades, priceFor, buy, sellItem, sellAll, inventoryValue, ASCENSION_BUILDING, ascend, ascensionCost, BUILDING_COSTS, contributeBuilding, queueSmelt, storeInWarehouse, takeFromWarehouse, regenStamina} from './player';
import {tileSprites} from './sprites';
import {setupPages} from './pages';
import {setupAscensionShop} from './ascension';
import {saveGameToFile, loadGameFromString, saveGameToStorage, loadGameFromStorage, SAVE_KEY} from './save';

generateWorld(player.ascensions, player.equippedPages);
if (loadGameFromStorage()) {
  say('Game loaded');
}
setupPages(player);
setupAscensionShop(player);

const keys = new Set();
let mouse = { down: false };
let mineDir = 'down';
let weightWarned = false;

const DEFAULT_KEYBINDS: Record<string, string> = {
  left: 'a',
  right: 'd',
  down: 's',
  up: 'w',
  mine: ' ',
  inventory: 'e',
  teleport: 'r',
  interact: 'f'
};
const keyDescriptions: Record<string, string> = {
  left: 'Move Left',
  right: 'Move Right',
  down: 'Aim Down',
  up: 'Aim Up',
  mine: 'Mine',
  inventory: 'Open Inventory',
  teleport: 'Teleport Home',
  interact: 'Interact'
};
let keybinds: Record<string, string> = JSON.parse(localStorage.getItem('keybinds') || 'null') || {};
keybinds = { ...DEFAULT_KEYBINDS, ...keybinds };

function saveKeybinds() { localStorage.setItem('keybinds', JSON.stringify(keybinds)); }

function keyLabel(k: string) { return k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k; }

// ---- new-player guidance ----
const interactPrompt = el('interactPrompt');
const controlsHint = el('controlsHint');
const INTERACT_VERBS: Record<string, string> = {
  market: 'open the Market',
  shop: 'open the Shop',
  builder: 'open the Builder',
  forge: 'open the Forge',
  warehouse: 'open the Warehouse',
  ascension: 'ascend',
};
let lastPromptKey = '';
function updateInteractPrompt() {
  const b = isUIOpen() ? undefined : buildings.find(bb => INTERACT_VERBS[bb.kind] && rectsIntersect(player, bb));
  const key = b ? b.kind + ':' + keybinds.interact : '';
  if (key === lastPromptKey) return;
  lastPromptKey = key;
  if (b) {
    interactPrompt.innerHTML = `Press <kbd>${keyLabel(keybinds.interact)}</kbd> to ${INTERACT_VERBS[b.kind]}`;
    interactPrompt.classList.remove('hidden');
  } else {
    interactPrompt.classList.add('hidden');
  }
}
function renderControlsHint() {
  const k = (a: string) => `<kbd>${keyLabel(keybinds[a])}</kbd>`;
  controlsHint.innerHTML =
    `Move ${k('left')}${k('right')} · Aim ${k('up')}${k('down')} · Mine ${k('mine')} · ` +
    `Interact ${k('interact')} · Inventory ${k('inventory')} · Home ${k('teleport')}`;
}
renderControlsHint();

addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'Escape') { closeAllModals(); return; }
  if (k === ' ' && e.repeat && !player.holdToMine) return;
  const lk = k.toLowerCase();
  keys.add(lk);
  if (lk === keybinds.left) mineDir = 'left';
  if (lk === keybinds.right) mineDir = 'right';
  if (lk === keybinds.down) mineDir = 'down';
  if (lk === keybinds.up && player.mineUp) mineDir = 'up';
});

addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);

function getMineTargets() {
  let dx = 0, dy = 0;
  if (mineDir === 'left') dx = -1;
  else if (mineDir === 'right') dx = 1;
  else if (mineDir === 'up' && player.mineUp) dy = -1;
  else dy = 1;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  const { tx, ty } = worldToTile(cx, cy);
  const targets = [];
  const drillDist = keys.has('shift') ? 1 : player.drill; // shift -> mine single block
  for (let i = 1; i <= drillDist; i++) {
    const x = tx + dx * i, y = ty + dy * i;
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
    const id = world.get(x, y);
    if (id <= 0) continue;
    const m = MATERIALS[id];
    if (m.hard > player.pickPower) break;
    targets.push({ x, y });
  }
  return { targets, dy };
}

function tryMine() {
  const cost = 3;
  if (player.stamina < cost) return;
  const { targets, dy } = getMineTargets();
  if (targets.length === 0) return;
  for (const { x, y } of targets) {
    const id = world.get(x, y);
    world.set(x, y, 0);
    invAdd(id, 1);
  }
  player.stamina -= cost;
  if (dy === 1) player.vy = Math.max(player.vy, 0.5);
}

function resolveCollisions() {
  resolvePlayerMovement(player, isSolidAt);
}

const camera = { x: 0, y: 0 };

function updateForge() {
  if (player.forgeQueue.length === 0) {
    if (!forgeModal.classList.contains('hidden'))
      renderForge(player, MATERIALS, BAR_MAP, queueSmelt);
    return;
  }
  const job = player.forgeQueue[0];
  job.time -= 1 / 60;
  if (job.time <= 0) {
    const barId = BAR_MAP[job.id];
    invAdd(barId, 1);
    player.forgeQueue.shift();
    say('Smelted ' + MATERIALS[barId].name + '.');
  }
  if (!forgeModal.classList.contains('hidden'))
    renderForge(player, MATERIALS, BAR_MAP, queueSmelt);
}

function tick() {
  if (keys.has(keybinds.interact)) {
    if (isUIOpen()) {
      if (!marketModal.classList.contains('hidden')) {
        sellAll();
        closeModal(marketModal);
      }
    } else {
      const market = buildings.find(b => b.kind === 'market');
      const shop = buildings.find(b => b.kind === 'shop');
      const builder = buildings.find(b => b.kind === 'builder');
      const forge = buildings.find(b => b.kind === 'forge');
      const warehouse = buildings.find(b => b.kind === 'warehouse');
      const asc = buildings.find(b => b.kind === 'ascension');
      if (market && rectsIntersect(player, market)) openMarket(player, MATERIALS, sellItem, sellAll, inventoryValue);
      else if (shop && rectsIntersect(player, shop)) openShop(player, upgrades, priceFor, buy);
      else if (builder && rectsIntersect(player, builder)) openBuilder(player, MATERIALS, BUILDING_COSTS, buildings, contributeBuilding);
      else if (forge && rectsIntersect(player, forge)) openForge(player, MATERIALS, BAR_MAP, queueSmelt);
      else if (warehouse && rectsIntersect(player, warehouse)) openWarehouse(player, MATERIALS, storeInWarehouse, takeFromWarehouse);
      else if (asc && rectsIntersect(player, asc)) { ascendCostText.textContent = ascensionCost().toLocaleString(); openModal(ascendModal); }
      else say('No one nearby.');
    }
    keys.delete(keybinds.interact);
  }

  if (!isUIOpen()) {
    if (keys.has(keybinds.left)) { player.vx -= MOVE_ACC * player.speed; player.facing = -1; }
    if (keys.has(keybinds.right)) { player.vx += MOVE_ACC * player.speed; player.facing = 1; }
    if (keys.has(keybinds.mine)) {
      tryMine();
      if (!player.holdToMine) keys.delete(keybinds.mine);
    }
    if (keys.has(keybinds.inventory)) { openInventory(player, MATERIALS); keys.delete(keybinds.inventory); }
    if (keys.has(keybinds.teleport)) { teleportHome(); keys.delete(keybinds.teleport); }
  }

  player.vy += GRAV;
  player.vx *= FRICTION;
  resolveCollisions();
  regenStamina(1 / 60); // ~60fps; same seconds-per-frame convention as the forge
  updateForge();

  if (!player.ascensionUnlocked && Math.floor((player.y + player.h) / TILE) >= MAP_H - 1) {
    player.ascensionUnlocked = true;
    if (!buildings.some(b => b.kind === 'ascension')) buildings.push({ ...ASCENSION_BUILDING });
    say('A strange building appears on the surface...');
  }

  if (!isSolidAt(player.x + 1, player.y + player.h) && !isSolidAt(player.x + player.w - 1, player.y + player.h))
    player.vy += GRAV * 0.5;

  camera.x = Math.max(0, Math.min(MAP_W * TILE - canvas.width,  player.x + player.w / 2 - canvas.width / 2));
  camera.y = Math.max(0, Math.min(MAP_H * TILE - canvas.height, player.y + player.h / 2 - canvas.height / 2));
}

function draw() {
  ctx.imageSmoothingEnabled = false; // crisp pixel-art tiles; canvas resize resets this, so set per-frame
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const x0 = Math.max(0, Math.floor(camera.x / TILE)), y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.min(MAP_W, Math.ceil((camera.x + canvas.width) / TILE)), y1 = Math.min(MAP_H, Math.ceil((camera.y + canvas.height) / TILE));
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
    const id = world.get(tx, ty); if (id === 0) continue;
    const dx = tx * TILE - camera.x, dy = ty * TILE - camera.y;
    const img = tileSprites[id];
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, dx, dy, TILE, TILE);
    else { ctx.fillStyle = MATERIALS[id].color ?? '#000000'; ctx.fillRect(dx, dy, TILE, TILE); }
  }
  for (const b of buildings) {
    ctx.fillStyle = b.kind === 'shop' ? '#2563eb' : b.kind === 'market' ? '#9333ea' : '#1fa94c';
    ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
    ctx.fillStyle = '#e5e7eb'; ctx.font = '12px system-ui';
    ctx.fillText(b.name, b.x - camera.x + 2, b.y - camera.y - 4);
  }
  const { targets } = getMineTargets();
  ctx.fillStyle = '#fff';
  for (const { x, y } of targets) {
    ctx.fillRect(x * TILE - camera.x + TILE / 2 - 2, y * TILE - camera.y + TILE / 2 - 2, 4, 4);
  }
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(player.x - camera.x, player.y - camera.y, player.w, player.h);

  const depth = Math.max(0, Math.floor((player.y + player.h) / TILE));
  const stat = (k: string, v: string) => `<span><span class='k'>${k}</span><span class='v'>${v}</span></span>`;
  statsEl.innerHTML = [
    stat('DEPTH', depth + 'm'),
    stat('CASH', '$' + player.cash),
    stat('STA', Math.floor(player.stamina) + '/' + player.staminaMax),
    stat('WGT', totalWeight() + '/' + player.carryCap),
    stat('PICK', String(player.pickPower)),
    stat('DRILL', String(player.drill)),
    stat('SPD', '×' + player.speed.toFixed(2)),
  ].join(`<span class='sep'>·</span>`);
  const staminaRatio = Math.max(0, Math.min(player.stamina / player.staminaMax, 1));
  staminaFill.style.height = (staminaRatio * 100) + '%';
  staminaFill.style.backgroundColor = `hsl(${staminaRatio * 110}, 55%, 45%)`;

  const weight = totalWeight();
  const weightRatio = Math.max(0, Math.min(weight / player.carryCap, 1));
  weightFill.style.height = (weightRatio * 100) + '%';
  weightFill.style.backgroundColor = `hsl(${(1 - weightRatio) * 110}, 55%, 45%)`;
  if (weightRatio >= 0.8) {
    if (!weightWarned) {
      say('Inventory almost full! Return to surface soon or excess will be destroyed.');
      weightWarned = true;
    }
  } else {
    weightWarned = false;
  }

  const playerCol = Math.floor((player.x + player.w / 2) / TILE);
  const faded = playerCol < 5;
  staminaBar.style.opacity = faded ? '0.5' : '1';
  weightBar.style.opacity = faded ? '0.5' : '1';

  updateInteractPrompt();
}

function loop() { tick(); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
}
addEventListener('resize', fit); fit();

saveBtn.onclick = () => { saveGameToFile(); say('Game saved'); };
loadBtn.onclick = () => loadInput.click();
loadInput.onchange = () => {
  const file = loadInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (loadGameFromString(String(reader.result))) say('Game loaded');
    else say('Failed to load save');
  };
  reader.readAsText(file);
  loadInput.value = '';
};

ascendBtn.onclick = () => { if (ascend()) closeAllModals(); };

settingsBtn.onclick = () => { renderKeybinds(); openModal(settingsModal); };

function renderKeybinds() {
  keybindsTable.innerHTML = Object.keys(keybinds).map(action => `
    <div>${keyDescriptions[action]}</div>
    <button data-action='${action}' class='key btn btn-sm'>${keyLabel(keybinds[action])}</button>
  `).join('');
  keybindsTable.querySelectorAll<HTMLElement>('button.key').forEach(btn => {
    btn.onclick = () => {
      const action = btn.getAttribute('data-action');
      if (!action) return;
      btn.textContent = '...';
      function handler(e: KeyboardEvent) {
        e.preventDefault(); e.stopPropagation();
        const lk = e.key.toLowerCase();
        keybinds[action!] = lk;
        saveKeybinds();
        renderKeybinds();
        window.removeEventListener('keydown', handler, true);
      }
      window.addEventListener('keydown', handler, true);
    };
  });
  renderControlsHint();
}

let autosaveMs = parseInt(localStorage.getItem('autosaveInterval') || '10000');
autosaveRange.value = String(autosaveMs / 1000);
function refreshAutosaveLabel() { autosaveLabel.textContent = (autosaveMs / 1000) + 's'; }
refreshAutosaveLabel();
let autosaveHandle = setInterval(saveGameToStorage, autosaveMs);
autosaveRange.oninput = () => {
  autosaveMs = Number(autosaveRange.value) * 1000;
  localStorage.setItem('autosaveInterval', String(autosaveMs));
  refreshAutosaveLabel();
  clearInterval(autosaveHandle);
  autosaveHandle = setInterval(saveGameToStorage, autosaveMs);
};

let toastX = parseInt(localStorage.getItem('toastX') || '16');
let toastY = parseInt(localStorage.getItem('toastY') || '16');
function applyToastPos() {
  // anchored from the bottom-right corner; X = offset from right, Y = offset from bottom
  toastWrap.style.right = toastX + 'px';
  toastWrap.style.bottom = toastY + 'px';
}
applyToastPos();
toastXInput.value = String(toastX);
toastYInput.value = String(toastY);
toastXInput.oninput = () => {
  toastX = parseInt(toastXInput.value || '0');
  localStorage.setItem('toastX', String(toastX));
  applyToastPos();
};
toastYInput.oninput = () => {
  toastY = parseInt(toastYInput.value || '0');
  localStorage.setItem('toastY', String(toastY));
  applyToastPos();
};

hardResetBtn.onclick = () => {
  if (confirm('Reset all game progress? Your keybinds and settings are kept.')) {
    // Stop autosave and the unload save first, or they'd immediately re-persist the
    // state we're about to clear and the reload would just restore it.
    clearInterval(autosaveHandle);
    removeEventListener('beforeunload', saveGameToStorage);
    localStorage.removeItem(SAVE_KEY); // progress only — keybinds/autosave/toast settings kept
    location.reload();
  }
};

saveGameToStorage();
addEventListener('beforeunload', saveGameToStorage);
