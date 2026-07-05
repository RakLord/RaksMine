// Shared domain types for RaksMine.

export type MaterialId = number;

export interface Material {
  id: MaterialId;
  name: string;
  color: string | null;
  solid: boolean;
  hard: number;
  value: number;
  weight: number;
  // Ore-only fields (absent on Air/Grass/Dirt and on generated Bars).
  rarity?: number;
  minDepth?: number;
  maxDepth?: number;
  ascension?: number;
  ore?: boolean;
  // Bar-only back-reference (set on auto-generated bar variants).
  barFor?: MaterialId;
}

export interface InventoryItem {
  id: MaterialId;
  qty: number;
}

export type BuildingKind =
  | 'shop' | 'builder' | 'market' | 'forge' | 'warehouse' | 'ascension';

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BuildingKind;
  name: string;
}

export interface ForgeJob {
  id: MaterialId;
  time: number;
  total: number;
}

export interface BuildingProgress {
  materials: Record<string, number>;
  cash: number;
}

export interface BuildingCost {
  materials?: Record<string, number>;
  cash?: number;
}

// player.pages[pageId][level] = count owned at that level.
export type PageOwned = Record<number, number>;

export interface Page {
  id: string;
  name: string;
  rarity: string;
  weight: number;
  desc: string;
  apply: (mats: Material[], lvl: number) => void;
}

// Numeric player stats a shop upgrade can raise.
export type UpgradeStatKey = 'pickPower' | 'speed' | 'carryCap' | 'staminaMax' | 'drill';

export interface Upgrade {
  key: UpgradeStatKey;
  name: string;
  desc: string;
  max: number;
  step?: number;
  base?: number;
  scale?: number;
  baseLevel?: number;
  price?: (level: number) => number;
}

export interface AscensionUpgrade {
  id: string;
  name: string;
  desc: string;
  cost: number;
  tier: number;
  requires?: string[];
  apply: (p: Player) => void;
}

export interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: number;
  onGround?: boolean;
  cash: number;
  stamina: number;
  staminaMax: number;
  staminaRegen: number;
  carryCap: number;
  pickPower: number;
  speed: number;
  drill: number;
  inventory: InventoryItem[];
  pages: Record<string, PageOwned>;
  equippedPages: Record<string, number>;
  ascensions: number;
  ascensionUnlocked: boolean;
  ascensionPoints: number;
  ascensionUpgrades: Record<string, boolean>;
  holdToMine: boolean;
  mineUp: boolean;
  buildingProgress: Record<string, BuildingProgress>;
  forgeLevel: number;
  forgeQueue: ForgeJob[];
  warehouse: InventoryItem[];
}

export interface SaveState {
  player: Player;
  buildings: Building[];
  world: number[];
}
