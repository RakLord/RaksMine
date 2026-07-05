import { describe, it, expect, beforeEach } from 'vitest';
import {
  player, upgrades, priceFor, buy,
  invAdd, totalWeight, inventoryValue, invTrimTo,
  ascensionCost, queueSmelt, contributeBuilding, BUILDING_COSTS,
} from '../js/player';

// The logic operates on the shared `player` singleton; reset the fields the tests
// touch before each case.
function resetPlayer() {
  Object.assign(player, {
    cash: 0, stamina: 100, staminaMax: 100, carryCap: 40,
    pickPower: 2, speed: 0.3, drill: 1, forgeLevel: 0, ascensions: 0,
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
  it('queues a job consuming 10 ore, time = 10/2^(level-1)', () => {
    player.forgeLevel = 1;
    invAdd(4, 12);
    queueSmelt(4);
    expect(player.forgeQueue).toHaveLength(1);
    expect(player.forgeQueue[0].time).toBe(10);
    expect(player.inventory.find((i) => i.id === 4)?.qty).toBe(2);
  });
  it('level 2 halves smelt time to 5', () => {
    player.forgeLevel = 2;
    invAdd(4, 10);
    queueSmelt(4);
    expect(player.forgeQueue[0].time).toBe(5);
  });
  it('refuses with fewer than 10 ore and returns them', () => {
    invAdd(4, 5);
    queueSmelt(4);
    expect(player.forgeQueue).toHaveLength(0);
    expect(player.inventory.find((i) => i.id === 4)?.qty).toBe(5);
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
