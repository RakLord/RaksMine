import { describe, it, expect } from 'vitest';
import { PAGES, mergePage, applyPageModifiers, MERGE_COST } from '../js/pages';
import { MATERIALS } from '../js/materials';

describe('pages', () => {
  it('generates a _spawn and _depth page per ore', () => {
    const ores = MATERIALS.filter((m: any) => m.ore);
    for (const ore of ores) {
      const slug = ore.name.toLowerCase().replace(/\s+/g, '_');
      expect(PAGES.some((p: any) => p.id === `${slug}_spawn`)).toBe(true);
      expect(PAGES.some((p: any) => p.id === `${slug}_depth`)).toBe(true);
    }
  });

  it('mergePage consumes MERGE_COST of a level to make one of the next', () => {
    const player: any = { pages: { copper_spawn: { 1: MERGE_COST } } };
    expect(mergePage(player, 'copper_spawn')).toBe(true);
    expect(player.pages.copper_spawn[1]).toBeUndefined();
    expect(player.pages.copper_spawn[2]).toBe(1);
  });

  it('mergePage fails without enough copies', () => {
    const player: any = { pages: { copper_spawn: { 1: MERGE_COST - 1 } } };
    expect(mergePage(player, 'copper_spawn')).toBe(false);
  });

  it('applyPageModifiers raises spawn rarity by 10% per level', () => {
    const mats = MATERIALS.map((m: any) => ({ ...m }));
    const copper = mats.find((m: any) => m.name === 'Copper');
    const before = copper.rarity;
    applyPageModifiers(mats, { copper_spawn: 1 });
    expect(copper.rarity).toBe(Math.round(before * 1.1));
  });
});
