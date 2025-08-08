import {TILE, MAP_W, MAP_H, MOVE_ACC, MAX_HSPEED, GRAV, FRICTION} from './config.js';
import {MATERIALS} from './materials.js';
import {world, worldToTile, isSolidAt} from './world.js';
import {canvas, ctx, statsEl, say, closeAllModals, isUIOpen, openInventory, openShop, openMarket, renderMarket, marketModal, saveBtn, loadBtn, loadInput, staminaFill} from './ui.js';
import {player, buildings, rectsIntersect, totalWeight, invAdd, teleportHome, upgrades, priceFor, buy, sellItem, sellAll, inventoryValue} from './player.js';
import {saveGameToFile, loadGameFromString} from './save.js';

const keys = new Set();
let mouse = { down: false };
let lastDir = 'right';

addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'Escape') { closeAllModals(); return; }
  const lk = k.toLowerCase();
  keys.add(lk);
  if (lk === 'a') lastDir = 'left';
  if (lk === 'd') lastDir = 'right';
});

addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);

function tryMine() {
  const moving = keys.has('a') || keys.has('d');
  let dx = 0, dy = 0;
  if (!moving) { dy = 1; }
  else if (lastDir === 'left') dx = -1; else if (lastDir === 'right') dx = 1;
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  const { tx, ty } = worldToTile(cx, cy);
  let mined = false;
  for (let i = 1; i <= player.drill; i++) {
    const id = world.get(tx + dx * i, ty + dy * i);
    if (id <= 0) continue;
    const m = MATERIALS[id];
    const cost = 3 + m.hard;
    if (m.hard > player.pickPower || player.stamina < cost) break;
    world.set(tx + dx * i, ty + dy * i, 0);
    player.stamina -= cost;
    invAdd(id, 1);
    mined = true;
  }
  if (mined && dy === 1) player.vy = Math.max(player.vy, 0.5);
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
  if (keys.has('f')) {
    if (isUIOpen()) {
      if (!marketModal.classList.contains('hidden')) {
        sellAll();
        renderMarket(player, MATERIALS, sellItem, sellAll, inventoryValue);
      }
    } else {
      const market = buildings.find(b => b.kind === 'market');
      const shop = buildings.find(b => b.kind === 'shop');
      if (market && rectsIntersect(player, market)) openMarket(player, MATERIALS, sellItem, sellAll, inventoryValue);
      else if (shop && rectsIntersect(player, shop)) openShop(player, upgrades, priceFor, buy);
      else say('No one nearby.');
    }
    keys.delete('f');
  }

  if (!isUIOpen()) {
    if (keys.has('a')) { player.vx -= MOVE_ACC * player.speed; player.facing = -1; }
    if (keys.has('d')) { player.vx += MOVE_ACC * player.speed; player.facing = 1; }
    if (keys.has(' ')) { tryMine(); keys.delete(' '); }
    if (keys.has('e')) { openInventory(player, MATERIALS); keys.delete('e'); }
    if (keys.has('r')) { teleportHome(); keys.delete('r'); }
  }

  player.vy += GRAV; if (player.vy > 18) player.vy = 18;
  player.vx = Math.max(-MAX_HSPEED * player.speed, Math.min(MAX_HSPEED * player.speed, player.vx));
  player.vx *= FRICTION;
  resolveCollisions();

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
    ctx.fillStyle = b.kind === 'shop' ? '#2563eb' : b.kind === 'market' ? '#9333ea' : '#16a34a';
    ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
    ctx.fillStyle = '#e5e7eb'; ctx.font = '12px system-ui';
    ctx.fillText(b.name, b.x - camera.x + 2, b.y - camera.y - 4);
  }
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(player.x - camera.x, player.y - camera.y, player.w, player.h);

  statsEl.innerHTML = `Cash: $${player.cash} | Stamina: ${Math.floor(player.stamina)}/${player.staminaMax} | Weight: ${totalWeight()}/${player.carryCap} | Pick: ${player.pickPower} | Drill: ${player.drill} | Speed×${player.speed.toFixed(2)}`;
  staminaFill.style.height = (player.stamina / player.staminaMax * 100) + '%';
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
