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

export function generateWorld(ascensionLevel = 0) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (y < 5) { world.set(x, y, 0); continue; }
      if (y === 5) { world.set(x, y, 1); continue; }
      if (y < 22) { world.set(x, y, 2); continue; }

      const candidates = MATERIALS.filter(m => m.rarity && y >= (m.minDepth || 0)
        && (!m.maxDepth || y <= m.maxDepth)
        && ascensionLevel >= (m.ascension || 0));
      const total = candidates.reduce((s, m) => s + m.rarity, 0);
      let r = Math.random() * total;
      let id = 3;
      for (const m of candidates) {
        r -= m.rarity;
        if (r <= 0) { id = m.id; break; }
      }
      if (y > 8 && Math.random() < 0.015) id = 0;
      world.set(x, y, id);
    }
  }
}

export function worldToTile(px, py) {
  return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
}

export function isSolidAt(px, py) {
  const { tx, ty } = worldToTile(px, py);
  return MATERIALS[world.get(tx, ty)].solid;
}
