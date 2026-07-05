import { describe, it, expect, vi } from 'vitest';
import { openForge, tickForgeView } from '../js/ui';
import { MATERIALS, BAR_MAP } from '../js/materials';
import type { Player, ForgeJob, ForgeStatus } from '../js/types';

// Regression coverage for the reported bug: updateForge() rebuilt forgeBody.innerHTML
// ~60x/second, destroying the Smelt button between mousedown and mouseup so the click
// never fired. The fix delegates clicks to the stable parent and only nudges live bars
// each frame (tickForgeView) — never innerHTML. These tests exercise the real DOM path,
// which the pure-logic suite (player.test.ts) can't reach.

function makePlayer(over: Partial<Player> = {}): Player {
  return {
    inventory: [{ id: 4, qty: 20 }],
    forgeQueue: [],
    forgeLevel: 1,
    forgeTemp: 0,
    ...over,
  } as unknown as Player;
}

function status(over: Partial<ForgeStatus> = {}): ForgeStatus {
  return {
    level: 2,
    hammerLevel: 0, hammerMax: 10, hammerUnlocked: true, hammerPct: 1,
    hammerMaxed: false, hammerNextCost: 1500, hammerCanAfford: true,
    tempLevel: 0, tempUnlocked: false, tempReductionPct: 0,
    tempNextCost: 2500, tempCanAfford: false, parallelUnlocked: false,
    ...over,
  };
}

function apiFor(queue: ForgeJob[], statusOver: Partial<ForgeStatus> = {}) {
  return {
    smelt: vi.fn((id: number) => { queue.push({ id, time: 60, total: 60 }); }),
    hammer: vi.fn((id: number) => { const j = queue.find(q => q.id === id); if (j) j.time -= 3; }),
    raiseHammer: vi.fn(),
    raiseTemp: vi.fn(),
    status: () => status(statusOver),
    activeJobs: () => (queue.length ? [queue[0]] : []),
  };
}

describe('forge UI click path', () => {
  it('clicking Smelt still fires after 30 view ticks (the old rebuild ate the click)', () => {
    const player = makePlayer();
    const api = apiFor(player.forgeQueue);
    openForge(player, MATERIALS, BAR_MAP, api);

    for (let i = 0; i < 30; i++) tickForgeView(); // simulate the 60fps loop

    const btn = document.querySelector<HTMLElement>("[data-action='smelt'][data-id='4']");
    expect(btn).not.toBeNull();
    btn!.click();

    expect(api.smelt).toHaveBeenCalledWith(4);
    expect(player.forgeQueue).toHaveLength(1);
  });

  it('hammer is disabled with nothing cooking, enabled once a job is active', () => {
    const player = makePlayer();
    const api = apiFor(player.forgeQueue);
    openForge(player, MATERIALS, BAR_MAP, api);

    const hammerBefore = document.querySelector<HTMLElement>("[data-action='hammer'][data-id='4']");
    expect(hammerBefore!.classList.contains('is-disabled')).toBe(true);
    hammerBefore!.click();
    expect(api.hammer).not.toHaveBeenCalled(); // disabled clicks are ignored

    document.querySelector<HTMLElement>("[data-action='smelt'][data-id='4']")!.click(); // starts a job + re-renders

    const hammerAfter = document.querySelector<HTMLElement>("[data-action='hammer'][data-id='4']");
    expect(hammerAfter!.classList.contains('is-disabled')).toBe(false);
    hammerAfter!.click();
    expect(api.hammer).toHaveBeenCalledWith(4);
  });

  it('the Click Power panel routes its Raise button to raiseHammer', () => {
    const player = makePlayer();
    const api = apiFor(player.forgeQueue); // hammerUnlocked: true by default
    openForge(player, MATERIALS, BAR_MAP, api);

    const raise = document.querySelector<HTMLElement>("[data-action='hammerup']");
    expect(raise).not.toBeNull();
    raise!.click();
    expect(api.raiseHammer).toHaveBeenCalled();
  });

  it('hides the Click Power panel until it is unlocked', () => {
    const player = makePlayer();
    const api = apiFor(player.forgeQueue, { hammerUnlocked: false });
    openForge(player, MATERIALS, BAR_MAP, api);
    expect(document.querySelector("[data-action='hammerup']")).toBeNull();
  });
});
