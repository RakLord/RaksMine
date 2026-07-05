# CLAUDE.md — RaksMine

Working notes for Claude sessions on this repo. Read this first.

## Overview
RaksMine is a browser-based **2D dig-down mining / idle / prestige game**. You mine downward
through a tile world, haul ore back to the surface, sell it, buy upgrades, build processing
buildings (Forge, Warehouse), and eventually **ascend** (prestige) to reset the world for
permanent bonuses. There is no jumping — it's a fall-and-dig game.

**Stack:** **TypeScript** (ES modules, full `strict`, no framework, no classes). Bundled/served by
**Vite**. The world is drawn to an HTML5 `<canvas>` 2D context; all UI (modals, HUD) is plain DOM
styled with **Tailwind loaded from a CDN** in `index.html`. Saves live in `localStorage` (plus
base64 file export/import). ~1,300 lines across 10 `.ts` modules in `js/`.

> Migrated from vanilla JS to TypeScript (Stages 0–4). Shared domain types live in `js/types.ts`.
> The migration plan and deferred Stage 5 work are in
> `~/.claude/plans/review-this-project-get-piped-hickey.md`.

## Run / build
```bash
npm install
npm run dev        # vite dev server (serves under /RaksMine/) — how you test by playing
npm run typecheck  # tsc --noEmit, full strict — must stay clean
npm test           # vitest run — characterization tests in test/
npm run build      # vite build -> dist/ (a build is now REQUIRED; TS can't run raw in the browser)
npm run preview    # serve the built dist/ under /RaksMine/
```
- **Deploy:** `.github/workflows/deploy.yml` builds and deploys `dist/` to GitHub Pages on push to
  `main` (free for public repos). One manual step in repo Settings → Pages → Source = "GitHub
  Actions". `vite.config.ts` sets `base: '/RaksMine/'` — required so built asset URLs resolve on the
  project Pages subpath; don't remove it.
- Verify changes with `npm run typecheck && npm test`, then `npm run dev` and play. Tests use
  `jsdom`; `test/setup.ts` injects `index.html`'s DOM so importing the DOM-wiring `ui` module works.

## Architecture & state model
All game state is three mutable singletons — no classes, no store abstraction. Modules export plain
functions that mutate these directly.

- **`player`** (`js/player.ts`) — one object with everything: position/velocity, cash, stamina,
  inventory, upgrades' stat values, pages, ascension state, forge queue, warehouse, etc. Cloned
  from `BASE_PLAYER`.
- **`world.tiles`** (`js/world.ts`) — a flat `Uint8Array(MAP_W*MAP_H)` of material ids. Access via
  `world.get(x,y)` / `world.set(x,y,v)` (out-of-bounds reads return Stone so edges are solid).
- **`buildings`** (`js/player.ts`) — array of `{x,y,w,h,kind,name}` surface buildings.

**Boot sequence** (`js/main.ts` top): `generateWorld()` → `loadGameFromStorage()` →
`setupPages(player)` → `setupAscensionShop(player)` → wire input → start loop.

**Game loop** (`js/main.ts`): classic `requestAnimationFrame` → `tick()` then `draw()`.
- `tick()` — interaction (the `interact` key opens the modal for the building you overlap), movement
  (accel + friction), mining, gravity, `resolveCollisions()`, `updateForge()`, ascension-unlock
  check, camera follow.
- `draw()` — camera-culled tile render (solid color per material), buildings, mine-target reticle,
  player, HUD stats line, stamina/weight bars.

**Physics note:** constants in `js/config.ts` (`GRAV`, `MOVE_ACC`, `FRICTION`, `TILE=24`,
`MAP_W=200`, `MAP_H=400`) are **frame-rate dependent** — tuned for ~60fps, no delta-time. Keep that
in mind before touching movement.

## File map (`js/`)
| File | Responsibility |
|------|----------------|
| `types.ts` | Shared domain types (`Player`, `Material`, `Building`, `Page`, `Upgrade`, `SaveState`, …). Type-only; no runtime code. |
| `config.ts` | Global constants: tile size, map dims, movement/gravity/friction tuning. |
| `materials.ts` | `MATERIALS[]` table (Air, Grass, Dirt, Stone, ores). Auto-generates a "Bar" variant per ore and the `BAR_MAP` (oreId → barId). |
| `world.ts` | `world` tile store, procedural `generateWorld()`, `worldToTile()`, `isSolidAt()`. Imports page modifiers. |
| `player.ts` | **Logic hub.** Player state, buildings, inventory, selling, shop `upgrades` + pricing, building construction, forge smelting queue, warehouse, teleport-home, ascension / soft-reset. |
| `ui.ts` | **DOM/render hub.** Caches all element refs, `say()` toasts, modal open/close helpers, and every `render*`/`open*` screen. |
| `pages.ts` | "Pages" meta-progression: generates ore modifier pages, award/merge/equip, the Pages modal. |
| `ascension.ts` | Ascension prestige upgrade tree (`ASCENSION_UPGRADES`) + its shop modal. |
| `save.ts` | Serialize/deserialize `{player, buildings, world}` as base64 JSON; localStorage + file I/O. |
| `main.ts` | **Entry point & orchestrator.** Boot, input/keybinds, `tick()`/`draw()` loop, settings. |

Dependency shape: `main.ts` imports from everything; `player.ts` is the logic hub; `ui.ts` the
render hub. Note a small cycle-ish coupling: `world.ts` imports `applyPageModifiers` from
`pages.ts`; `player.ts` imports from both `pages.ts` and `ascension.ts`; those import `say` from
`ui.ts`.

## Core mechanics
- **Mining** — `mineDir` (down/left/right/up) is set by movement keys; up-mining requires
  `player.mineUp`. `getMineTargets()` steps outward up to `player.drill` tiles and stops at any tile
  with `hard > player.pickPower`. Holding **Shift** overrides to single-block. `tryMine()` costs 3
  stamina, clears tiles to air, adds to inventory. Downward mining nudges `vy` so you drop in.
- **Inventory** — weight-based: `player.inventory` is `[{id,qty}]`, capped by `player.carryCap`
  (sum of `weight*qty`). Overweight on teleport-home triggers `invTrimTo()` which drops lowest
  value-per-weight items first. HUD warns at 80%.
- **Economy** — `cash` comes from selling at the **Market** (`sellItem`/`sellAll`). Spend it in the
  **Shop** on upgrades (`upgrades` table + `priceFor()` geometric/custom scaling): pickaxe, boots,
  backpack (doubles cap, cost via `log2` level), lungs (stamina), drill (range).
- **Buildings & Builder** — `Builder` lets you incrementally `contributeBuilding(kind)` cash+
  materials toward `BUILDING_COSTS`; on completion the building spawns. Order gating: Warehouse and
  Forge Upgrade require a Forge first (their costs are denominated in **Bars**, which only the Forge
  produces).
- **Forge (smelting)** — `queueSmelt(oreId)` consumes **10 ore** → queues a job producing **1 Bar**
  (`BAR_MAP`). Smelt time = `10 / 2^(forgeLevel-1)` (each upgrade halves it). `updateForge()`
  advances the front job by `1/60`/frame.
- **Warehouse** — off-inventory storage; `storeInWarehouse`/`takeFromWarehouse` move whole stacks.
- **Ascension (prestige)** — unlocks on reaching the map bottom. `ascensionCost() =
  10000*(ascensions+1)^2`. `ascend()` spends cash, grants `ascensionPoints += ascensions`, resets
  player stats, **regenerates the world** at the new ascension level (unlocks Tin/Diamond), and
  awards a random Page. `softReset()` is the no-gain refresh.
- **Ascension shop** — a tiered upgrade tree (`ASCENSION_UPGRADES`) with `requires` prerequisites;
  purchases persist in `player.ascensionUpgrades` and are re-applied after every reset via
  `applyAscensionUpgrades()`.
- **Pages (meta-progression)** — two generated pages per ore (`_spawn`: +10% rarity/lvl; `_depth`:
  −5 minDepth/lvl). Awarded on ascension, **merge 5→1** to level up, equip to modify the world.

## Adding content — patterns
- **New ore/material** — add a row to `MATERIALS` in `js/materials.ts` (`id` = next index, set
  `rarity`/`minDepth`/`ore:true`/`ascension` gating). Ores **automatically** get a Bar variant, a
  `BAR_MAP` entry, and two Pages. Colors are solid hex (no sprites).
- **New shop upgrade** — add to `upgrades` in `js/player.ts` (define `key`, `step`, `max`, and
  either `base`+`scale` or a custom `price(level)`), then include it in `renderShop`'s list.
- **New ascension upgrade** — add to `ASCENSION_UPGRADES` in `js/ascension.ts` with
  `cost/tier/requires/apply(player)`. `apply` runs on purchase and on every reset.
- **New building** — define a building const + a `BUILDING_COSTS` entry + a branch in
  `contributeBuilding()` + an item in `renderBuilder()` + interact dispatch in `main.ts`'s `tick()`
  + a modal in `index.html` + a `render*`/`open*` fn in `js/ui.ts`.
- **Gotcha:** **page modifiers only apply at world regeneration** (ascension or load), *not* when a
  page is equipped mid-run. Equipping then expecting an immediate spawn-rate change is a common
  confusion.

## Reset semantics (Stage 5.1 — fixed)
Three reset paths, now with defined behaviour:
- **Ascension / soft reset** (`ascend()`/`softReset()`, `js/player.ts`) — a **full run reset**.
  `resetPlayerStats()` rebuilds `player` from a fresh clone and restores only the fields in
  `PERSIST_ACROSS_ASCENSION` (ascension count/points/upgrades, pages, `holdToMine`). Forge, Warehouse,
  warehouse contents, cash, inventory, shop-upgrade stats, and the world all reset by design. **To make
  something survive a future upgrade, add its key to `PERSIST_ACROSS_ASCENSION` (conditionally) and
  rebuild it in `rebuildWorldAndBuildings()`** — that's the intended extension point.
- **Hard reset** (Settings, `js/main.ts`) — **progress only**: clears the save and reloads to a fresh
  game, but keeps keybinds and UI settings. It first removes the `beforeunload`/autosave handlers so
  the cleared state isn't re-persisted (the old bug: the mine never changed).
- `player` is built with `freshPlayer()` (`structuredClone`) so it never shares array refs with
  `BASE_PLAYER` — resets are clean and the template can't be polluted. Covered by `test/reset.test.ts`.

## Stamina regen (wired, currently off)
`regenStamina(seconds)` (`js/player.ts`) is called every frame from `tick()` as `regenStamina(1/60)`.
`player.staminaRegen` is measured in **stamina per second** and defaults to **0**, so there's no
passive regen yet — stamina still only drains (3/swing) and refills on teleport-home / Lungs. To
enable it, set a non-zero `staminaRegen` (start small; 100 pool, 3/swing). The "2x Stamina Gain"
ascension upgrade multiplies it (inert while the base is 0). Regen currently applies unconditionally
each frame; idle-only / not-while-mining gating is a future balance lever. Covered by
`test/stamina.test.ts`.

## Collision / falling (fixed)
Player movement is resolved by `resolvePlayerMovement(player, isSolidAt)` in `js/physics.ts`, called
from `resolveCollisions()` in `tick()`. It **sweeps** the move in sub-steps of `TILE*0.5` and runs the
edge checks each sub-step, so fast falls can't tunnel through thin floors / air pockets. **Fall speed
stays uncapped** by design (respecting the gravity revamp) — sub-stepping fixes tunneling without
limiting velocity. Slow movement (|v| ≤ half a tile) runs as a single step, identical to before.
Covered by `test/physics.test.ts` (incl. a `vy=300` no-tunnel regression).

## Known issues & rough edges (backlog)
Remaining half-wired/unbalanced logic, **not yet fixed**:

1. **Balance / progression pacing.** Several economy knobs trend to degenerate: Forge Upgrade has
   **no max level** so smelt time `10/2^(level-1)` (`js/player.ts:159`) → ~0; Warehouse has **no
   capacity cap** (`storeInWarehouse` pulls `Infinity`, `js/player.ts:164`). Worth a deliberate pass
   on ascension cost curve, upgrade caps, and bar/ore values (`materials.ts`).
2. **Forge UI re-renders 60×/second while open** (`js/main.ts:127` → `renderForge`), even with an
   empty queue — rebuilds `innerHTML` + rebinds handlers every frame. Wasteful; render on change.
3. **All new buildings share one color.** `draw()` (`js/main.ts:209`) only special-cases shop
   (blue) and market (purple); builder/forge/warehouse/ascension all render green.
4. **Save format is unversioned.** `js/save.ts` `Object.assign(player, state.player)` loads any
   stored fields with no schema/version guard. Adding/removing `player` fields can silently corrupt
   old saves — add migration logic when you change the shape.

## Conventions
- Keep the existing terse style: compact exported functions operating on the shared singletons; no
  classes, no new runtime deps. All game code is TypeScript under full `strict`.
- **`npm run typecheck` must stay clean** and **`npm test` green** before you consider a change done —
  then `npm run dev` and exercise the affected flow in the browser.
- Add tests to `test/` when you touch pure logic; they're the safety net for the Stage 5 refactors.
- Be careful mutating the `player` shape — it's serialized wholesale and typed by `Player` in
  `js/types.ts` (see issue #7). Update `types.ts` alongside any state-shape change.
- Import specifiers are extensionless (`'./player'`); Vite + `moduleResolution: bundler` resolve them.
