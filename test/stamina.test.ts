import { describe, it, expect, beforeEach } from 'vitest';
import { player, regenStamina } from '../js/player';
import { ASCENSION_UPGRADES } from '../js/ascension';

beforeEach(() => {
  player.staminaMax = 100;
  player.stamina = 50;
  player.staminaRegen = 0;
});

describe('regenStamina', () => {
  it('adds staminaRegen * seconds (per-second units)', () => {
    player.staminaRegen = 6;
    regenStamina(1);
    expect(player.stamina).toBe(56);
  });

  it('scales with the elapsed seconds', () => {
    player.staminaRegen = 6;
    regenStamina(0.5);
    expect(player.stamina).toBe(53); // 50 + 6*0.5
  });

  it('caps at staminaMax', () => {
    player.stamina = 99;
    player.staminaRegen = 20;
    regenStamina(1);
    expect(player.stamina).toBe(100);
  });

  it('is a no-op when staminaRegen is 0 (the default)', () => {
    regenStamina(1);
    expect(player.stamina).toBe(50);
  });
});

describe('"2x Stamina Gain" ascension upgrade', () => {
  const staminaGain = ASCENSION_UPGRADES.find(u => u.id === 'stamina_gain')!;

  it('doubles a non-zero base regen', () => {
    player.staminaRegen = 5;
    staminaGain.apply(player);
    expect(player.staminaRegen).toBe(10);
  });

  it('stays 0 when base regen is 0 (no accidental resurrection)', () => {
    player.staminaRegen = 0;
    staminaGain.apply(player);
    expect(player.staminaRegen).toBe(0);
  });
});
