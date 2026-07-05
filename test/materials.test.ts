import { describe, it, expect } from 'vitest';
import { MATERIALS, BAR_MAP } from '../js/materials';

describe('materials + bar generation', () => {
  it('auto-generates a Bar for every ore', () => {
    const ores = MATERIALS.filter((m: any) => m.ore);
    for (const ore of ores) {
      const barId = BAR_MAP[ore.id];
      expect(barId, `bar for ${ore.name}`).toBeTypeOf('number');
      expect(MATERIALS[barId].barFor).toBe(ore.id);
    }
  });

  it('bar value is 5x the ore value and bars are non-solid', () => {
    for (const ore of MATERIALS.filter((m: any) => m.ore)) {
      const bar = MATERIALS[BAR_MAP[ore.id]];
      expect(bar.value).toBe(ore.value * 5);
      expect(bar.solid).toBe(false);
    }
  });

  it('Copper(4) maps to a bar worth 25', () => {
    expect(MATERIALS[4].name).toBe('Copper');
    expect(MATERIALS[BAR_MAP[4]].value).toBe(25);
  });
});
