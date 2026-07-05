import {TILE, MAP_W} from './config';
import {MATERIALS, BAR_MAP} from './materials';
import {world, generateWorld} from './world';
import {say} from './ui';
import {awardRandomPage} from './pages';
import {applyAscensionUpgrades} from './ascension';
import type {Player, Building, Upgrade, BuildingCost, MaterialId, ForgeJob, ForgeStatus} from './types';

export const SPAWN_X = TILE * 10;

const BASE_PLAYER: Player = {
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
  speed: 0.12,
  drill: 1,
  inventory: [],
  pages: {},
  equippedPages: {},
  ascensions: 0,
  ascensionUnlocked: false,
  ascensionPoints: 0,
  ascensionUpgrades: {},
  staminaRegen: 0, // stamina/sec. 0 = no passive regen (deliberately off until tuned).
  holdToMine: false,
  mineUp: false,
  buildingProgress: {},
  forgeLevel: 0,
  forgeTemp: 0,
  forgeHammer: 0,
  forgeQueue: [],
  warehouse: []
};

// Deep copy so `player` never shares array/object references with BASE_PLAYER —
// otherwise gameplay mutations would pollute the template and resets wouldn't be clean.
function freshPlayer(): Player { return structuredClone(BASE_PLAYER); }

export const player: Player = freshPlayer();

// The only state that survives an ascension. Everything else resets to a fresh player.
// Future upgrades will conditionally extend this (e.g. keep buildings/warehouse).
const PERSIST_ACROSS_ASCENSION = [
  'ascensions', 'ascensionUnlocked', 'holdToMine',
  'pages', 'equippedPages', 'ascensionPoints', 'ascensionUpgrades',
] as const satisfies readonly (keyof Player)[];

export const BASE_BUILDINGS: Building[] = [
  { x: TILE * 8,  y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'shop',    name: 'Shop' },
  { x: TILE * 13, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'builder', name: 'Builder' },
  { x: TILE * 18, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'market',  name: 'Market' },
];

export const FORGE_BUILDING: Building = { x: TILE * 28, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'forge', name: 'Forge' };
export const WAREHOUSE_BUILDING: Building = { x: TILE * 33, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'warehouse', name: 'Warehouse' };

export const ASCENSION_BUILDING: Building = { x: TILE * 23, y: TILE * 5 - TILE * 2, w: TILE * 3, h: TILE * 2, kind: 'ascension', name: 'Ascension' };

export const buildings: Building[] = BASE_BUILDINGS.slice();

// Passive stamina recovery. `staminaRegen` is stamina-per-second; callers pass the
// elapsed seconds for the frame. No-op while staminaRegen is 0 (the current default).
export function regenStamina(seconds: number) {
  player.stamina = Math.min(player.staminaMax, player.stamina + player.staminaRegen * seconds);
}

type Rect = { x: number; y: number; w: number; h: number };
export function rectsIntersect(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function totalWeight() {
  return player.inventory.reduce((s, it) => s + MATERIALS[it.id].weight * it.qty, 0);
}

export function invAdd(id: MaterialId, qty = 1) {
  const it = player.inventory.find(i => i.id === id);
  if (it) it.qty += qty; else player.inventory.push({ id, qty });
}

function removeFromInventory(id: MaterialId, qty: number) {
  const it = player.inventory.find(i => i.id === id);
  if (!it) return 0;
  const take = Math.min(it.qty, qty);
  it.qty -= take;
  if (it.qty <= 0) player.inventory.splice(player.inventory.indexOf(it), 1);
  return take;
}

export function invTrimTo(cap: number) {
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

export function sellItem(id: MaterialId) {
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

// ---- Forge tuning ----------------------------------------------------------
export const SMELT_TIME = 60;          // base seconds per 10-ore -> 1-bar job
export const MAX_FORGE_LEVEL = 4;      // Builder stops offering upgrades past this
const HAMMER_UNLOCK_LEVEL = 2;        // forge level that unlocks the click-power upgrade
const TEMP_UNLOCK_LEVEL = 3;          // forge level that unlocks the Temperature upgrade
const PARALLEL_LEVEL = 4;             // forge level that makes every ore column smelt at once
export const HAMMER_MAX = 10;          // click-power level cap; at max one click = instant
const HAMMER_BASE_PCT = 0.01;        // per-click reduction (fraction of bar) before any upgrade
const HAMMER_BASE_COST = 1500;       // cash cost of the first click-power level
const HAMMER_COST_SCALE = 1.7;       // per-level cost multiplier
const TEMP_STEP = 0.1;               // smelt-time reduction per temperature level
const TEMP_CAP = 0.8;                // max total temperature reduction (80%)
const TEMP_BASE_COST = 2500;         // cash cost of the first temperature level
const TEMP_COST_SCALE = 1.6;         // per-level cost multiplier

export const BUILDING_COSTS: Record<string, BuildingCost> = {
  forge: { materials: { 5: 50, 3: 50 }, cash: 5000 },
  warehouse: { materials: { [BAR_MAP[5]]: 50, 3: 100 }, cash: 0 },
};

// Forge Upgrade cost scales with the tier being bought (null once maxed out).
export function forgeUpgradeCost(targetLevel: number): BuildingCost | null {
  if (targetLevel > MAX_FORGE_LEVEL) return null;
  const mult = 1 + (targetLevel - 2) * 0.5; // L2 x1, L3 x1.5, L4 x2
  const base: Record<string, number> = { [BAR_MAP[5]]: 3, [BAR_MAP[4]]: 5, [BAR_MAP[6]]: 1 };
  const materials: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) materials[k] = Math.ceil(v * mult);
  return { materials, cash: Math.round(10000 * mult) };
}

// Cost for a Builder line, resolving the dynamic forge-upgrade tier. null = not offered.
export function buildingCost(kind: string): BuildingCost | null {
  if (kind === 'forgeUpgrade') return forgeUpgradeCost(player.forgeLevel + 1);
  return BUILDING_COSTS[kind] ?? null;
}

export function contributeBuilding(kind: string) {
  const cost = buildingCost(kind);
  if (!cost) return;
  const prog = player.buildingProgress[kind] || { materials: {}, cash: 0 };
  const cashNeed = (cost.cash || 0) - prog.cash;
  const cashAdd = Math.min(player.cash, cashNeed);
  player.cash -= cashAdd;
  prog.cash += cashAdd;
  for (const [id, amt] of Object.entries(cost.materials || {})) {
    const have = removeFromInventory(+id, amt - (prog.materials[id] || 0));
    prog.materials[id] = (prog.materials[id] || 0) + have;
  }
  player.buildingProgress[kind] = prog;
  const done = prog.cash >= (cost.cash || 0) && Object.entries(cost.materials || {}).every(([id, amt]) => (prog.materials[id] || 0) >= amt);
  if (done) {
    if (kind === 'forge') {
      player.forgeLevel = 1;
      buildings.push({ ...FORGE_BUILDING });
      say('Forge constructed!');
    } else if (kind === 'warehouse') {
      buildings.push({ ...WAREHOUSE_BUILDING });
      say('Warehouse constructed!');
    } else if (kind === 'forgeUpgrade') {
      player.forgeLevel++;
      say('Forge upgraded!');
    }
    delete player.buildingProgress[kind];
  }
}

function tempReduction() {
  return Math.min(player.forgeTemp * TEMP_STEP, TEMP_CAP);
}

export function queueSmelt(oreId: MaterialId) {
  const barId = BAR_MAP[oreId];
  if (barId === undefined) { say('Cannot smelt that.'); return; }
  const taken = removeFromInventory(oreId, 10);
  if (taken < 10) { if (taken > 0) invAdd(oreId, taken); say('Need 10 ore.'); return; }
  const time = SMELT_TIME * (1 - tempReduction());
  player.forgeQueue.push({ id: oreId, time, total: time });
  say('Smelting started.');
}

// Jobs currently cooking: the queue head in single mode, or the front job of each
// distinct ore once parallel smelting is unlocked. Shared by the tick, hammer, and UI.
export function activeJobs(): ForgeJob[] {
  if (player.forgeQueue.length === 0) return [];
  if (player.forgeLevel >= PARALLEL_LEVEL) {
    const seen = new Set<MaterialId>();
    const out: ForgeJob[] = [];
    for (const j of player.forgeQueue) {
      if (!seen.has(j.id)) { seen.add(j.id); out.push(j); }
    }
    return out;
  }
  return [player.forgeQueue[0]];
}

// Per-click reduction as a fraction of the bar's (dynamic) total smelt time. Linear
// from a 1% base up to 100% at the level cap — where one click finishes any bar.
function hammerFraction() {
  return HAMMER_BASE_PCT + (1 - HAMMER_BASE_PCT) * (player.forgeHammer / HAMMER_MAX);
}

// Manual speed-up: shave a % of the bar off the active job of one ore column. No-op if
// that column has nothing cooking (e.g. a waiting column in single-queue mode).
export function hammerSmelt(oreId: MaterialId) {
  const job = activeJobs().find(j => j.id === oreId);
  if (!job) return;
  job.time -= hammerFraction() * job.total;
  if (job.time < 0.0001) job.time = 0.0001; // let the next tick finish it cleanly
}

// Cash-bought click-power upgrade, unlocked at forge level 2.
export function raiseHammer() {
  if (player.forgeLevel < HAMMER_UNLOCK_LEVEL) { say('Requires forge level ' + HAMMER_UNLOCK_LEVEL + '.'); return; }
  if (player.forgeHammer >= HAMMER_MAX) { say('Click power maxed.'); return; }
  const cost = Math.round(HAMMER_BASE_COST * Math.pow(HAMMER_COST_SCALE, player.forgeHammer));
  if (player.cash < cost) { say('Not enough cash.'); return; }
  player.cash -= cost;
  player.forgeHammer++;
  say('Click power raised.');
}

export function raiseTemperature() {
  if (player.forgeLevel < TEMP_UNLOCK_LEVEL) { say('Requires forge level ' + TEMP_UNLOCK_LEVEL + '.'); return; }
  const cost = Math.round(TEMP_BASE_COST * Math.pow(TEMP_COST_SCALE, player.forgeTemp));
  if (player.cash < cost) { say('Not enough cash.'); return; }
  player.cash -= cost;
  player.forgeTemp++;
  say('Forge temperature raised.');
}

export function forgeStatus(): ForgeStatus {
  const tempNextCost = Math.round(TEMP_BASE_COST * Math.pow(TEMP_COST_SCALE, player.forgeTemp));
  const hammerMaxed = player.forgeHammer >= HAMMER_MAX;
  const hammerNextCost = Math.round(HAMMER_BASE_COST * Math.pow(HAMMER_COST_SCALE, player.forgeHammer));
  return {
    level: player.forgeLevel,
    hammerLevel: player.forgeHammer,
    hammerMax: HAMMER_MAX,
    hammerUnlocked: player.forgeLevel >= HAMMER_UNLOCK_LEVEL,
    hammerPct: Math.round(hammerFraction() * 100),
    hammerMaxed,
    hammerNextCost,
    hammerCanAfford: player.cash >= hammerNextCost,
    tempLevel: player.forgeTemp,
    tempUnlocked: player.forgeLevel >= TEMP_UNLOCK_LEVEL,
    tempReductionPct: Math.round(tempReduction() * 100),
    tempNextCost,
    tempCanAfford: player.cash >= tempNextCost,
    parallelUnlocked: player.forgeLevel >= PARALLEL_LEVEL,
  };
}

export function storeInWarehouse(id: MaterialId) {
  const taken = removeFromInventory(id, Infinity);
  if (taken <= 0) { say('Nothing to store.'); return; }
  const slot = player.warehouse.find(i => i.id === id);
  if (slot) slot.qty += taken; else player.warehouse.push({ id, qty: taken });
}

export function takeFromWarehouse(id: MaterialId) {
  const idx = player.warehouse.findIndex(i => i.id === id);
  if (idx === -1) return;
  const it = player.warehouse[idx];
  invAdd(id, it.qty);
  player.warehouse.splice(idx, 1);
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
  // Reset to a pristine player, then restore only the fields that survive an ascension.
  const preserved: Partial<Player> = {};
  for (const key of PERSIST_ACROSS_ASCENSION) preserved[key] = player[key] as never;
  Object.assign(player, freshPlayer(), preserved);
  applyAscensionUpgrades(player);
}

// Shared by ascend() and softReset(): regenerate the world and rebuild the surface
// buildings. Forge/Warehouse are intentionally NOT re-added — they reset with the run.
// (Future persist-upgrades will extend PERSIST_ACROSS_ASCENSION and rebuild buildings here.)
function rebuildWorldAndBuildings() {
  generateWorld(player.ascensions, player.equippedPages);
  buildings.length = 0;
  buildings.push(...BASE_BUILDINGS);
  if (player.ascensionUnlocked || player.ascensions > 0) {
    player.ascensionUnlocked = true;
    buildings.push({ ...ASCENSION_BUILDING });
  }
  teleportHome();
}

export function ascensionCost() {
  return 10000 * Math.pow(player.ascensions + 1, 2);
}

export function ascend() {
  const cost = ascensionCost();
  if (player.cash < cost) {
    if (confirm('Not enough money to ascend. Ascend for no gain?')) {
      softReset();
      say('Ascended for no gain.');
      return true;
    } else {
      say('Need $' + cost.toLocaleString() + ' to ascend.');
      return false;
    }
  }
  player.ascensions++;
  player.ascensionPoints += player.ascensions;
  player.cash = 0;
  resetPlayerStats();
  rebuildWorldAndBuildings();
  const pg = awardRandomPage(player);
  say('The world has been reborn.');
  say('Gained ' + player.ascensions + ' ascension points.');
  if (pg) say(`You received a ${pg.rarity} Page: ${pg.name}`);
  return true;
}

export function softReset() {
  resetPlayerStats();
  rebuildWorldAndBuildings();
  say('The world has been refreshed.');
  return true;
}

export const upgrades: Record<string, Upgrade> = {
  pickaxe:  { key: 'pickPower', name: 'Pickaxe',           desc: 'Mine harder materials', step: 1,    max: 10,  base: 50,  scale: 1.6,  baseLevel: 0 },
  boots:    { key: 'speed',     name: 'Boots',             desc: 'Move faster',          step: 0.10, max: 2.0, base: 80,  scale: 1.5,  baseLevel: 0.12 },
  backpack: { key: 'carryCap',  name: 'Leather Backpack',  desc: 'Increase carry cap',   max: Infinity, base: 60,  scale: 5, baseLevel: 40 },
  lungs:    { key: 'staminaMax', name: 'Lung Expansion Pills', desc: 'Increase stamina',   step: 20,   max: Infinity, baseLevel: 100, price: level => 150 * Math.pow(level + 1, 1.3) },
  drill:    { key: 'drill',     name: 'Drill Expander',    desc: 'Mine more blocks',     step: 1,    max: 5,      baseLevel: 1,    price: level => (level + 1) * 500 }
};

export function priceFor(u: Upgrade): number {
  const cur = player[u.key];
  if (u.key === 'carryCap') {
    const level = Math.round(Math.log2(cur / (u.baseLevel ?? 1)));
    return Math.round((u.base ?? 0) * Math.pow(u.scale ?? 1, level));
  }
  const baseLevel = u.baseLevel !== undefined ? u.baseLevel : 0;
  const level = Math.round((cur - baseLevel) / (u.step ?? 1));
  if (typeof u.price === 'function') return Math.round(u.price(level));
  return Math.round((u.base ?? 0) * Math.pow(u.scale ?? 1, level));
}

export function buy(u: Upgrade) {
  const cost = priceFor(u);
  if (player.cash < cost) { say('Not enough cash'); return; }
  const next = u.key === 'carryCap' ? player[u.key] * 2 : +(player[u.key] + (u.step ?? 0)).toFixed(2);
  if (next > u.max) { say('Maxed'); return; }
  player.cash -= cost;
  player[u.key] = next;
  if (u.key === 'staminaMax') player.stamina = next;
  say(`${u.name} -> ${next}`);
}
