import { describe, it, expect } from 'vitest';
import { resolvePlayerMovement } from '../js/physics';
import type { Player } from '../js/types';

// Minimal player double with just the fields the physics touches.
const mk = (o: Partial<Player>): Player =>
  ({ x: 0, y: 0, w: 16, h: 22, vx: 0, vy: 0, onGround: false, ...o } as unknown as Player);

// A one-tile-thick floor spanning row 10 (pixels y in [240, 264)).
const floorRow10 = (_px: number, py: number) => Math.floor(py / 24) === 10;
// A full-height wall in column 5 (pixels x in [120, 144)).
const wallCol5 = (px: number, _py: number) => Math.floor(px / 24) === 5;

describe('swept collision — resolvePlayerMovement', () => {
  it('does NOT tunnel through a thin floor on a fast fall', () => {
    const p = mk({ y: 0, vy: 300 }); // one naive step would jump feet to y=322, past the floor
    resolvePlayerMovement(p, floorRow10);
    expect(p.y).toBeCloseTo(240 - p.h - 0.01, 2); // resting on top of the floor
    expect(p.vy).toBe(0);
    expect(p.onGround).toBe(true);
    expect(p.y + p.h).toBeLessThanOrEqual(240); // never crossed into the floor
  });

  it('slow fall lands identically (single-step path)', () => {
    const p = mk({ y: 216, vy: 10 }); // 10 <= MAX_STEP(12) → one step
    resolvePlayerMovement(p, floorRow10);
    expect(p.y).toBeCloseTo(240 - p.h - 0.01, 2);
    expect(p.onGround).toBe(true);
  });

  it('stops against a wall when moving fast horizontally', () => {
    const p = mk({ x: 0, vx: 300 });
    resolvePlayerMovement(p, wallCol5);
    expect(p.x).toBeCloseTo(120 - p.w - 0.01, 2);
    expect(p.vx).toBe(0);
  });

  it('advances freely by exactly (vx, vy) with no solids', () => {
    const p = mk({ vx: 7, vy: 9 });
    resolvePlayerMovement(p, () => false);
    expect(p.x).toBe(7);
    expect(p.y).toBe(9);
    expect(p.vx).toBe(7);
    expect(p.vy).toBe(9);
    expect(p.onGround).toBe(false);
  });
});
