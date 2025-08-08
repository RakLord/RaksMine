import { player, buildings } from './player.js';
import { world } from './world.js';

export function serializeGame() {
  const state = {
    player,
    buildings,
    world: Array.from(world.tiles)
  };
  return btoa(JSON.stringify(state));
}

export function saveGameToFile() {
  const data = serializeGame();
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'raksmine-save.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function loadGameFromString(b64) {
  try {
    const json = atob(b64.trim());
    const state = JSON.parse(json);
    Object.assign(player, state.player);
    player.inventory = state.player.inventory || [];
    player.pages = state.player.pages || {};
    player.equippedPages = state.player.equippedPages || {};
    player.ascensionUpgrades = state.player.ascensionUpgrades || {};
    player.ascensionPoints = state.player.ascensionPoints || 0;
    player.buildingProgress = state.player.buildingProgress || {};
    player.forgeLevel = state.player.forgeLevel || 0;
    player.forgeQueue = state.player.forgeQueue || [];
    player.warehouse = state.player.warehouse || [];
    buildings.length = 0;
    if (Array.isArray(state.buildings)) {
      for (const b of state.buildings) buildings.push(b);
    }
    if (Array.isArray(state.world) && state.world.length === world.tiles.length) {
      world.tiles.set(state.world);
    }
    return true;
  } catch (e) {
    console.error('Failed to load game', e);
    return false;
  }
}

export const SAVE_KEY = 'raksmine-save';

export function saveGameToStorage() {
  try {
    localStorage.setItem(SAVE_KEY, serializeGame());
  } catch (e) {
    console.error('Failed to save game', e);
  }
}

export function loadGameFromStorage() {
  const data = localStorage.getItem(SAVE_KEY);
  if (!data) return false;
  return loadGameFromString(data);
}
