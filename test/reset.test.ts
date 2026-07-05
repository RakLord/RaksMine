import { describe, it, expect, beforeEach } from 'vitest';
import {
  player, buildings, softReset, ascend, ascensionCost, invAdd, storeInWarehouse,
} from '../js/player';

// Normalise the shared player singleton before each case.
function baseState() {
  Object.assign(player, {
    ascensions: 0, ascensionUnlocked: false, ascensionPoints: 0,
    cash: 0, forgeLevel: 0, pickPower: 2, carryCap: 40,
  });
  player.ascensionUpgrades = {};
  player.pages = {};
  player.equippedPages = {};
  player.inventory = [];
  player.warehouse = [];
  player.forgeQueue = [];
  player.buildingProgress = {};
}
beforeEach(baseState);

describe('reset mechanics', () => {
  it('softReset clears run state but keeps meta-progression', () => {
    // meta that must survive
    player.ascensions = 3;
    player.ascensionUpgrades = { drill_range: true };
    player.pages = { copper_spawn: { 1: 2 } };
    // run state that must clear
    player.cash = 999;
    player.pickPower = 8;
    invAdd(4, 20);
    storeInWarehouse(4);
    player.forgeLevel = 3;
    player.forgeQueue.push({ id: 4, time: 5, total: 10 });
    player.buildingProgress = { forge: { materials: {}, cash: 100 } };

    softReset();

    expect(player.ascensions).toBe(3);
    expect(player.ascensionUpgrades).toEqual({ drill_range: true });
    expect(player.pages).toEqual({ copper_spawn: { 1: 2 } });

    expect(player.cash).toBe(0);
    expect(player.inventory).toEqual([]);
    expect(player.warehouse).toEqual([]);
    expect(player.forgeLevel).toBe(0);
    expect(player.forgeQueue).toEqual([]);
    expect(player.buildingProgress).toEqual({});
    expect(player.pickPower).toBe(2); // shop-upgrade stat back to base
  });

  it('each reset yields fresh arrays — no BASE_PLAYER aliasing/accumulation', () => {
    invAdd(5, 5);
    storeInWarehouse(5);
    softReset();
    expect(player.warehouse).toEqual([]);

    const invRef = player.inventory;
    invAdd(6, 3);          // mutate the current array
    softReset();
    expect(player.inventory).toEqual([]);      // cleared again
    expect(player.inventory).not.toBe(invRef); // and it's a brand-new array
  });

  it('ascend at affordable cost resets the run and rebuilds base buildings only', () => {
    player.cash = ascensionCost(); // 10000 at ascensions 0
    invAdd(4, 10);
    player.forgeLevel = 1;

    expect(ascend()).toBe(true);

    expect(player.ascensions).toBe(1);
    expect(player.cash).toBe(0);
    expect(player.inventory).toEqual([]);
    expect(player.forgeLevel).toBe(0);
    expect(buildings.some(b => b.kind === 'forge')).toBe(false);
    expect(buildings.some(b => b.kind === 'warehouse')).toBe(false);
    expect(buildings.some(b => b.kind === 'ascension')).toBe(true); // unlocked post-ascension
  });
});
