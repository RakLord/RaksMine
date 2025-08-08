import {TILE, MAP_W, MAP_H, MOVE_ACC, GRAV, FRICTION} from './config.js';
import {MATERIALS} from './materials.js';
import {world, worldToTile, isSolidAt, generateWorld} from './world.js';
import {canvas, ctx, statsEl, say, closeAllModals, closeModal, isUIOpen, openInventory, openShop, openMarket, marketModal, saveBtn, loadBtn, loadInput, staminaBar, staminaFill, weightBar, weightFill, openModal, ascendModal, ascendBtn, settingsBtn, settingsModal, autosaveRange, autosaveLabel, toastXInput, toastYInput, keybindsTable, hardResetBtn, toastWrap, ascendCostText} from './ui.js';
import {player, buildings, rectsIntersect, totalWeight, invAdd, teleportHome, upgrades, priceFor, buy, sellItem, sellAll, inventoryValue, ASCENSION_BUILDING, ascend, ascensionCost} from './player.js';
import {setupPages} from './pages.js';
import {setupAscensionShop} from './ascension.js';
import {saveGameToFile, loadGameFromString, saveGameToStorage, loadGameFromStorage, SAVE_KEY} from './save.js';

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

const DEFAULT_KEYBINDS = {
  left: 'a',
  right: 'd',
  down: 's',
  up: 'w',
  mine: ' ',
  inventory: 'e',
  teleport: 'r',
  interact: 'f'
};
const keyDescriptions = {
  left: 'Move Left',
  right: 'Move Right',
  down: 'Aim Down',
  up: 'Aim Up',
  mine: 'Mine',
  inventory: 'Open Inventory',
  teleport: 'Teleport Home',
  interact: 'Interact'
};
let keybinds = JSON.parse(localStorage.getItem('keybinds') || 'null') || {};
keybinds = { ...DEFAULT_KEYBINDS, ...keybinds };

function saveKeybinds() { localStorage.setItem('keybinds', JSON.stringify(keybinds)); }

function keyLabel(k) { return k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k; }

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
  player.x += player.vx;
  if (player.vx > 0) {
    if (isSolidAt(player.x + player.w, player.y) || isSolidAt(player.x + player.w, player.y + player.h - 1)) {
      player.x = Math.floor((player.x + player.w) / TILE) * TILE - player.w - 0.01; player.vx = 0;
    }
  } else if (player.vx < 0) {
    if (isSolidAt(player.x, player.y) || isSolidAt(player.x, player.y + player.h - 1)) {
      player.x = Math.floor(player.x / TILE + 1) * TILE + 0.01; player.vx = 0;
    }
  }

  player.y += player.vy; player.onGround = false;
  if (player.vy > 0) {
    if (isSolidAt(player.x + 1, player.y + player.h) || isSolidAt(player.x + player.w - 1, player.y + player.h)) {
      player.y = Math.floor((player.y + player.h) / TILE) * TILE - player.h - 0.01; player.vy = 0; player.onGround = true;
    }
  } else if (player.vy < 0) {
    if (isSolidAt(player.x + 1, player.y) || isSolidAt(player.x + player.w - 1, player.y)) {
      player.y = Math.floor(player.y / TILE + 1) * TILE + 0.01; player.vy = 0;
    }
  }
}

const camera = { x: 0, y: 0 };

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
      const asc = buildings.find(b => b.kind === 'ascension');
      if (market && rectsIntersect(player, market)) openMarket(player, MATERIALS, sellItem, sellAll, inventoryValue);
      else if (shop && rectsIntersect(player, shop)) openShop(player, upgrades, priceFor, buy);
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
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const x0 = Math.max(0, Math.floor(camera.x / TILE)), y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.min(MAP_W, Math.ceil((camera.x + canvas.width) / TILE)), y1 = Math.min(MAP_H, Math.ceil((camera.y + canvas.height) / TILE));
  for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
    const id = world.get(tx, ty); if (id === 0) continue;
    ctx.fillStyle = MATERIALS[id].color;
    ctx.fillRect(tx * TILE - camera.x, ty * TILE - camera.y, TILE, TILE);
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

  statsEl.innerHTML = `Cash: $${player.cash} | Stamina: ${Math.floor(player.stamina)}/${player.staminaMax} | Weight: ${totalWeight()}/${player.carryCap} | Pick: ${player.pickPower} | Drill: ${player.drill} | Speed×${player.speed.toFixed(2)}`;
  const staminaRatio = Math.max(0, Math.min(player.stamina / player.staminaMax, 1));
  staminaFill.style.height = (staminaRatio * 100) + '%';
  staminaFill.style.backgroundColor = `hsl(${staminaRatio * 120}, 100%, 50%)`;

  const weight = totalWeight();
  const weightRatio = Math.max(0, Math.min(weight / player.carryCap, 1));
  weightFill.style.height = (weightRatio * 100) + '%';
  weightFill.style.backgroundColor = `hsl(${(1 - weightRatio) * 120}, 100%, 50%)`;
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
loadInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (loadGameFromString(reader.result)) say('Game loaded');
    else say('Failed to load save');
  };
  reader.readAsText(file);
  loadInput.value = '';
};

ascendBtn.onclick = () => { if (ascend()) closeAllModals(); };

settingsBtn.onclick = () => { renderKeybinds(); openModal(settingsModal); };

function renderKeybinds() {
  keybindsTable.innerHTML = Object.keys(keybinds).map(action => `
    <div class='py-1'>${keyDescriptions[action]}</div>
    <button data-action='${action}' class='key px-2 py-1 rounded-md border border-slate-600'>${keyLabel(keybinds[action])}</button>
  `).join('');
  keybindsTable.querySelectorAll('button.key').forEach(btn => {
    btn.onclick = () => {
      const action = btn.getAttribute('data-action');
      btn.textContent = '...';
      function handler(e) {
        e.preventDefault(); e.stopPropagation();
        const lk = e.key.toLowerCase();
        keybinds[action] = lk;
        saveKeybinds();
        renderKeybinds();
        window.removeEventListener('keydown', handler, true);
      }
      window.addEventListener('keydown', handler, true);
    };
  });
}

let autosaveMs = parseInt(localStorage.getItem('autosaveInterval') || '10000');
autosaveRange.value = autosaveMs / 1000;
function refreshAutosaveLabel() { autosaveLabel.textContent = (autosaveMs / 1000) + 's'; }
refreshAutosaveLabel();
let autosaveHandle = setInterval(saveGameToStorage, autosaveMs);
autosaveRange.oninput = () => {
  autosaveMs = autosaveRange.value * 1000;
  localStorage.setItem('autosaveInterval', autosaveMs);
  refreshAutosaveLabel();
  clearInterval(autosaveHandle);
  autosaveHandle = setInterval(saveGameToStorage, autosaveMs);
};

let toastX = parseInt(localStorage.getItem('toastX') || '16');
let toastY = parseInt(localStorage.getItem('toastY') || '16');
function applyToastPos() {
  toastWrap.style.left = toastX + 'px';
  toastWrap.style.top = toastY + 'px';
}
applyToastPos();
toastXInput.value = toastX;
toastYInput.value = toastY;
toastXInput.oninput = () => {
  toastX = parseInt(toastXInput.value || '0');
  localStorage.setItem('toastX', toastX);
  applyToastPos();
};
toastYInput.oninput = () => {
  toastY = parseInt(toastYInput.value || '0');
  localStorage.setItem('toastY', toastY);
  applyToastPos();
};

hardResetBtn.onclick = () => {
  if (confirm('Erase all save data?')) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('keybinds');
    localStorage.removeItem('autosaveInterval');
    location.reload();
  }
};

saveGameToStorage();
addEventListener('beforeunload', saveGameToStorage);
