import { TILE } from './config';
import type { Player } from './types';

// Sub-step size for swept collision. Must be < TILE so a full tile can never be
// skipped between checks; half a tile leaves comfortable margin.
const MAX_STEP = TILE * 0.5;

// Move the player by its velocity and resolve tile collisions, sweeping in
// sub-steps so fast falls can't tunnel through thin floors. Slow movement
// (|v| <= MAX_STEP) runs as a single step, identical to the naive version.
// `isSolidAt(px, py)` reports whether a solid tile occupies that pixel.
export function resolvePlayerMovement(p: Player, isSolidAt: (px: number, py: number) => boolean) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy)) / MAX_STEP));
  const sx = p.vx / steps;
  const sy = p.vy / steps;
  p.onGround = false;

  for (let i = 0; i < steps; i++) {
    // Horizontal — skip once a wall has zeroed vx.
    if (p.vx !== 0) {
      p.x += sx;
      if (p.vx > 0) {
        if (isSolidAt(p.x + p.w, p.y) || isSolidAt(p.x + p.w, p.y + p.h - 1)) {
          p.x = Math.floor((p.x + p.w) / TILE) * TILE - p.w - 0.01; p.vx = 0;
        }
      } else {
        if (isSolidAt(p.x, p.y) || isSolidAt(p.x, p.y + p.h - 1)) {
          p.x = Math.floor(p.x / TILE + 1) * TILE + 0.01; p.vx = 0;
        }
      }
    }

    // Vertical — skip once floor/ceiling has zeroed vy.
    if (p.vy !== 0) {
      p.y += sy;
      if (p.vy > 0) {
        if (isSolidAt(p.x + 1, p.y + p.h) || isSolidAt(p.x + p.w - 1, p.y + p.h)) {
          p.y = Math.floor((p.y + p.h) / TILE) * TILE - p.h - 0.01; p.vy = 0; p.onGround = true;
        }
      } else {
        if (isSolidAt(p.x + 1, p.y) || isSolidAt(p.x + p.w - 1, p.y)) {
          p.y = Math.floor(p.y / TILE + 1) * TILE + 0.01; p.vy = 0;
        }
      }
    }
  }
}
