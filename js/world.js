import {MAP_W, MAP_H, TILE} from './config.js';
import {MATERIALS} from './materials.js';

export const world = {
  tiles: new Uint8Array(MAP_W * MAP_H),
  get(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 3;
    return this.tiles[y * MAP_W + x];
  },
  set(x, y, v) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    this.tiles[y * MAP_W + x] = v;
  }
};

export function generateWorld() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (y < 5) { world.set(x, y, 0); continue; }
      if (y === 5) { world.set(x, y, 1); continue; }
      let id = y < 22 ? 2 : 3;
      if (y > 18 && Math.random() < 0.10) id = 4;
      if (y > 32 && Math.random() < 0.07) id = 5;
      if (y > 48 && Math.random() < 0.04) id = 6;
      if (y > 64 && Math.random() < 0.02) id = 7;
      if (y > 8  && Math.random() < 0.015) id = 0;
      world.set(x, y, id);
    }
  }
}

generateWorld();

export function worldToTile(px, py) {
  return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
}

export function isSolidAt(px, py) {
  const { tx, ty } = worldToTile(px, py);
  return MATERIALS[world.get(tx, ty)].solid;
}
