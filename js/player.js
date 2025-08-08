import {TILE, MAP_W} from './config.js';
import {MATERIALS} from './materials.js';
import {world, generateWorld} from './world.js';
import {say} from './ui.js';

export const SPAWN_X = TILE * 10;

const BASE_PLAYER = {
  x: SPAWN_X,
  y: TILE * 5 - 22,
  w: 16,
  h: 22,
  vx: 0,
  vy: 0,
  facing: 1,
  cash: 0,
  stamina: 100,
  staminaMax: 100,
  carryCap: 40,
  pickPower: 2,
  speed: 0.3,
  drill: 1,
  inventory: [],
  ascensions: 0,
  ascensionUnlocked: false
};

export const player = { ...BASE_PLAYER };

export const BASE_BUILDINGS = [
  { x: TILE * 8,  y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'shop',    name: 'Shop' },
  { x: TILE * 13, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'builder', name: 'Builder' },
  { x: TILE * 18, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'market',  name: 'Market' },
];

export const ASCENSION_BUILDING = { x: TILE * 23, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'ascension', name: 'Ascension' };

export const buildings = BASE_BUILDINGS.slice();

export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function totalWeight() {
  return player.inventory.reduce((s, it) => s + MATERIALS[it.id].weight * it.qty, 0);
}

export function invAdd(id, qty = 1) {
  const it = player.inventory.find(i => i.id === id);
  if (it) it.qty += qty; else player.inventory.push({ id, qty });
}

export function invTrimTo(cap) {
  const items = player.inventory.map(it => ({ ...it, vpw: MATERIALS[it.id].value / Math.max(1, MATERIALS[it.id].weight) }))
    .sort((a, b) => a.vpw - b.vpw);
  let w = items.reduce((s, it) => s + MATERIALS[it.id].weight * it.qty, 0);
  for (const it of items) {
    while (w > cap && it.qty > 0) {
      it.qty--;
      w -= MATERIALS[it.id].weight;
    }
  }
  player.inventory = items.filter(i => i.qty > 0).map(({ id, qty }) => ({ id, qty }));
}

export function inventoryValue() {
  return player.inventory.reduce((s, it) => s + MATERIALS[it.id].value * it.qty, 0);
}

export function sellItem(id) {
  const idx = player.inventory.findIndex(it => it.id === id);
  if (idx === -1) { say('Item not found.'); return; }
  const it = player.inventory[idx];
  const gained = MATERIALS[id].value * it.qty;
  player.cash += gained;
  player.inventory.splice(idx, 1);
  say(`Sold for $${gained}`);
}

export function sellAll() {
  if (player.inventory.length === 0) { say('Inventory empty.'); return; }
  const gained = inventoryValue();
  player.cash += gained;
  player.inventory = [];
  say(`Sold for $${gained}`);
}

export function teleportHome() {
  if (totalWeight() > player.carryCap) {
    invTrimTo(player.carryCap);
    say('Overweight. Excess destroyed.');
  }
  for (let x = 0; x < MAP_W; x++) {
    world.set(x, 5, 1);
  }
  const tx = Math.floor(SPAWN_X / TILE);
  world.set(tx, 5, 1);
  world.set(tx, 6, 2);
  player.x = SPAWN_X;
  player.y = TILE * 5 - 22;
  player.vx = 0;
  player.vy = 0;
  player.stamina = player.staminaMax;
  say('Teleported home.');
}

function resetPlayerStats() {
  const { ascensions, ascensionUnlocked } = player;
  Object.assign(player, { ...BASE_PLAYER, ascensions, ascensionUnlocked });
  player.inventory = [];
}

export function ascend() {
  if (player.cash < 10000) { say('Need $10000 to ascend.'); return false; }
  player.ascensions++;
  player.cash = 0;
  resetPlayerStats();
  generateWorld(player.ascensions);
  buildings.length = 0;
  buildings.push(...BASE_BUILDINGS);
  if (player.ascensionUnlocked || player.ascensions > 0) {
    player.ascensionUnlocked = true;
    buildings.push({ ...ASCENSION_BUILDING });
  }
  teleportHome();
  say('The world has been reborn.');
  return true;
}

export const upgrades = {
  pickaxe:  { key: 'pickPower', name: 'Pickaxe',           desc: 'Mine harder materials', step: 1,    max: 10,  base: 50,  scale: 1.6,  baseLevel: 0 },
  boots:    { key: 'speed',     name: 'Boots',             desc: 'Move faster',          step: 0.10, max: 2.0, base: 80,  scale: 1.5,  baseLevel: 0.3 },
  backpack: { key: 'carryCap',  name: 'Leather Backpack',  desc: 'Increase carry cap',   step: 20,   max: 300, base: 60,  scale: 1.45, baseLevel: 0 },
  lungs:    { key: 'staminaMax', name: 'Lung Expansion Pills', desc: 'Increase stamina',   step: 20,   max: Infinity, baseLevel: 100, price: level => 150 * Math.pow(level + 1, 1.3) },
  drill:    { key: 'drill',     name: 'Drill Expander',    desc: 'Mine more blocks',     step: 1,    max: 5,      baseLevel: 1,    price: level => (level + 1) * 500 }
};

export function priceFor(u) {
  const cur = player[u.key];
  const baseLevel = u.baseLevel !== undefined ? u.baseLevel : 0;
  const level = Math.round((cur - baseLevel) / u.step);
  if (typeof u.price === 'function') return Math.round(u.price(level));
  return Math.round(u.base * Math.pow(u.scale, level));
}

export function buy(u) {
  const cost = priceFor(u);
  if (player.cash < cost) { say('Not enough cash'); return; }
  const next = +(player[u.key] + u.step).toFixed(2);
  if (next > u.max) { say('Maxed'); return; }
  player.cash -= cost;
  player[u.key] = next;
  if (u.key === 'staminaMax') player.stamina = next;
  say(`${u.name} -> ${next}`);
}
