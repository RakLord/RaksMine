import {TILE} from './config.js';
import {MATERIALS} from './materials.js';
import {world} from './world.js';
import {say} from './ui.js';

export const SPAWN_X = TILE * 10;

export const player = {
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
  speed: 1.0,
  inventory: []
};

export const buildings = [
  { x: TILE * 8,  y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'shop',    name: 'Shop' },
  { x: TILE * 13, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'builder', name: 'Builder' },
];

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

export function trySell() {
  const shop = buildings.find(b => b.kind === 'shop');
  if (shop && rectsIntersect(player, shop)) sellAll();
  else say('Stand on the shop to sell.');
}

export function sellAll() {
  if (!player.inventory.length) { say('Inventory empty.'); return; }
  let gained = 0;
  for (const it of player.inventory) {
    gained += MATERIALS[it.id].value * it.qty;
  }
  player.cash += gained;
  player.inventory = [];
  say(`Sold for $${gained}`);
}

export function teleportHome() {
  if (totalWeight() > player.carryCap) {
    invTrimTo(player.carryCap);
    say('Overweight. Excess destroyed.');
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

export const upgrades = {
  pickaxe:  { key: 'pickPower', name: 'Pickaxe',           desc: 'Mine harder materials', step: 1,    max: 10,  base: 50,  scale: 1.6 },
  boots:    { key: 'speed',     name: 'Boots',             desc: 'Move faster',          step: 0.10, max: 2.0, base: 80,  scale: 1.5 },
  backpack: { key: 'carryCap',  name: 'Leather Backpack',  desc: 'Increase carry cap',   step: 20,   max: 300, base: 60,  scale: 1.45 },
};

export function priceFor(u) {
  const cur = player[u.key];
  const baseLevel = u.key === 'speed' ? 1.0 : 0.0;
  const level = Math.round((cur - baseLevel) / u.step);
  return Math.round(u.base * Math.pow(u.scale, level));
}

export function buy(u) {
  const cost = priceFor(u);
  if (player.cash < cost) { say('Not enough cash'); return; }
  const next = +(player[u.key] + u.step).toFixed(2);
  if (next > u.max) { say('Maxed'); return; }
  player.cash -= cost;
  player[u.key] = next;
  say(`${u.name} -> ${next}`);
}
