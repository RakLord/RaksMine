import { describe, it, expect, beforeEach } from 'vitest';
import {
  player, upgrades, priceFor, buy,
  invAdd, totalWeight, inventoryValue, invTrimTo,
  ascensionCost, queueSmelt, contributeBuilding, BUILDING_COSTS,
  SMELT_TIME, hammerSmelt, raiseHammer, raiseTemperature, activeJobs,
  forgeUpgradeCost, MAX_FORGE_LEVEL, HAMMER_MAX,
} from '../js/player';

// The logic operates on the shared `player` singleton; reset the fields the tests
// touch before each case.
function resetPlayer() {
  Object.assign(player, {
    cash: 0, stamina: 100, staminaMax: 100, carryCap: 40,
    pickPower: 2, speed: 0.12, drill: 1, forgeLevel: 0, forgeTemp: 0, forgeHammer: 0, ascensions: 0,
  });
  player.inventory = [];
  player.forgeQueue = [];
  player.warehouse = [];
  player.buildingProgress = {};
}

beforeEach(resetPlayer);

describe('shop pricing (priceFor)', () => {
  it('pickaxe at level 2 costs 50 * 1.6^2 = 128', () => {
    expect(priceFor(upgrades.pickaxe)).toBe(128);
  });
  it('backpack base cost is 60 and scales x5 after a purchase (cap doubles)', () => {
    expect(priceFor(upgrades.backpack)).toBe(60);
    player.carryCap = 80;
    expect(priceFor(upgrades.backpack)).toBe(300);
  });
  it('lungs base cost is 150', () => {
    expect(priceFor(upgrades.lungs)).toBe(150);
  });
  it('drill base cost is 500', () => {
    expect(priceFor(upgrades.drill)).toBe(500);
  });
  it('boots base cost is 80', () => {
    expect(priceFor(upgrades.boots)).toBe(80);
  });
});

describe('buy', () => {
  it('deducts cost and raises the stat', () => {
    player.cash = 200;
    buy(upgrades.pickaxe);
    expect(player.pickPower).toBe(3);
    expect(player.cash).toBe(200 - 128);
  });
  it('refuses when short on cash', () => {
    player.cash = 10;
    buy(upgrades.pickaxe);
    expect(player.pickPower).toBe(2);
    expect(player.cash).toBe(10);
  });
});

describe('inventory weight + value', () => {
  it('sums weight and value across stacks', () => {
    invAdd(4, 3); // Copper: weight 3, value 5
    expect(totalWeight()).toBe(9);
    expect(inventoryValue()).toBe(15);
  });
  it('invTrimTo drops lowest value-per-weight first', () => {
    invAdd(3, 10); // Stone: value 1, weight 2 -> vpw 0.5
    invAdd(6, 1);  // Gold:  value 30, weight 6 -> vpw 5
    invTrimTo(6);  // keep gold (weight 6), drop stone
    const stone = player.inventory.find((i) => i.id === 3);
    const gold = player.inventory.find((i) => i.id === 6);
    expect(gold?.qty).toBe(1);
    expect(stone).toBeUndefined();
  });
});

describe('ascension cost', () => {
  it('is 10000*(n+1)^2', () => {
    player.ascensions = 0;
    expect(ascensionCost()).toBe(10000);
    player.ascensions = 2;
    expect(ascensionCost()).toBe(90000);
  });
});

describe('forge smelting', () => {
  it('queues a job consuming 10 ore at the 60s base time', () => {
    player.forgeLevel = 1;
    invAdd(4, 12);
    queueSmelt(4);
    expect(player.forgeQueue).toHaveLength(1);
    expect(player.forgeQueue[0].time).toBe(SMELT_TIME);
    expect(player.forgeQueue[0].total).toBe(SMELT_TIME);
    expect(player.inventory.find((i) => i.id === 4)?.qty).toBe(2);
  });
  it('forge level no longer changes the base smelt time', () => {
    player.forgeLevel = 2;
    invAdd(4, 10);
    queueSmelt(4);
    expect(player.forgeQueue[0].time).toBe(SMELT_TIME);
  });
  it('refuses with fewer than 10 ore and returns them', () => {
    invAdd(4, 5);
    queueSmelt(4);
    expect(player.forgeQueue).toHaveLength(0);
    expect(player.inventory.find((i) => i.id === 4)?.qty).toBe(5);
  });
});

describe('forge hammer (% of bar)', () => {
  it('shaves the 1% base off the bar total at forge L1 (no upgrade)', () => {
    player.forgeLevel = 1;
    invAdd(4, 10);
    queueSmelt(4); // total = 60
    const before = player.forgeQueue[0].time;
    hammerSmelt(4);
    expect(player.forgeQueue[0].time).toBeCloseTo(before - 0.01 * 60, 5); // -0.6s
  });
  it('scales with click-power level and reduces % of the total (not remaining)', () => {
    player.forgeLevel = 2;
    player.forgeHammer = 5; // 0.01 + 0.99*0.5 = 0.505 of the bar
    invAdd(4, 10);
    queueSmelt(4); // total = 60
    player.forgeQueue[0].time = 40; // partially cooked
    hammerSmelt(4);
    expect(player.forgeQueue[0].time).toBeCloseTo(40 - 0.505 * 60, 5);
  });
  it('at max level one click drives the job to completion', () => {
    player.forgeLevel = 2;
    player.forgeHammer = HAMMER_MAX; // 100% of the bar
    invAdd(4, 10);
    queueSmelt(4);
    hammerSmelt(4);
    expect(player.forgeQueue[0].time).toBeLessThanOrEqual(0.0001);
  });
  it('does nothing for an ore with no active job', () => {
    player.forgeLevel = 1;
    invAdd(4, 10);
    queueSmelt(4);
    const t = player.forgeQueue[0].time;
    hammerSmelt(5); // iron: not queued
    expect(player.forgeQueue[0].time).toBe(t);
  });
});

describe('forge click-power upgrade', () => {
  it('is locked below forge level 2', () => {
    player.forgeLevel = 1;
    player.cash = 100000;
    raiseHammer();
    expect(player.forgeHammer).toBe(0);
    expect(player.cash).toBe(100000);
  });
  it('spends scaling cash and raises the level', () => {
    player.forgeLevel = 2;
    player.cash = 100000;
    raiseHammer();
    expect(player.forgeHammer).toBe(1);
    expect(player.cash).toBe(100000 - 1500);
    raiseHammer(); // next level costs 1500 * 1.7
    expect(player.forgeHammer).toBe(2);
    expect(player.cash).toBe(100000 - 1500 - Math.round(1500 * 1.7));
  });
  it('refuses past the max level', () => {
    player.forgeLevel = 2;
    player.forgeHammer = HAMMER_MAX;
    player.cash = 1e9;
    raiseHammer();
    expect(player.forgeHammer).toBe(HAMMER_MAX);
    expect(player.cash).toBe(1e9);
  });
});

describe('forge temperature', () => {
  it('is locked below forge level 3', () => {
    player.forgeLevel = 2;
    player.cash = 100000;
    raiseTemperature();
    expect(player.forgeTemp).toBe(0);
    expect(player.cash).toBe(100000);
  });
  it('spends cash, raises temp, and speeds up subsequent smelts', () => {
    player.forgeLevel = 3;
    player.cash = 100000;
    raiseTemperature();
    expect(player.forgeTemp).toBe(1);
    expect(player.cash).toBe(100000 - 2500);
    invAdd(4, 10);
    queueSmelt(4);
    expect(player.forgeQueue[0].time).toBeCloseTo(SMELT_TIME * 0.9, 5); // -10%
  });
});

describe('forge parallel + activeJobs', () => {
  it('advances only the queue head below the parallel tier', () => {
    player.forgeLevel = 1;
    invAdd(4, 10); invAdd(5, 10);
    queueSmelt(4); queueSmelt(5);
    const active = activeJobs();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(4);
  });
  it('advances one job per ore once parallel is unlocked (level 4)', () => {
    player.forgeLevel = 4;
    invAdd(4, 20); invAdd(5, 10);
    queueSmelt(4); queueSmelt(4); queueSmelt(5);
    const active = activeJobs();
    expect(active).toHaveLength(2); // one copper, one iron
    expect(new Set(active.map((j) => j.id))).toEqual(new Set([4, 5]));
  });
});

describe('forge upgrade cost', () => {
  it('scales with tier and stops past the max level', () => {
    expect(forgeUpgradeCost(2)?.cash).toBe(10000);
    expect(forgeUpgradeCost(3)?.cash).toBe(15000);
    expect(forgeUpgradeCost(4)?.cash).toBe(20000);
    expect(forgeUpgradeCost(MAX_FORGE_LEVEL + 1)).toBeNull();
  });
});

describe('building contribution', () => {
  it('constructs the forge once cash + materials are met', () => {
    const cost = BUILDING_COSTS.forge; // { materials: {5:50,3:50}, cash:5000 }
    player.cash = cost.cash ?? 0;
    invAdd(5, 50); // Iron
    invAdd(3, 50); // Stone
    contributeBuilding('forge');
    expect(player.forgeLevel).toBe(1);
    expect(player.buildingProgress.forge).toBeUndefined();
  });
});
