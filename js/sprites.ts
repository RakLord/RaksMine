import {MATERIALS} from './materials';

// Tile art loader. Drop 24x24 PNGs named `tile_<material>.png` (e.g. tile_copper.png,
// lowercased material name) into `assets/tiles/`. Each is auto-discovered here and rendered on its
// matching tile by draw() in main.ts; tiles without art fall back to the material's solid color.
export const tileSprites: (HTMLImageElement | undefined)[] = [];

// material name (lowercased) -> id, e.g. "copper" -> 4
const nameToId = new Map<string, number>();
for (const m of MATERIALS) nameToId.set(m.name.toLowerCase(), m.id);

// Vite resolves each match to a hashed, base-path-correct URL. Empty dir -> {} (all colors).
const urls = import.meta.glob('/assets/tiles/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

for (const [path, url] of Object.entries(urls)) {
  const m = path.match(/tile_(.+)\.png$/);
  if (!m) continue;
  const id = nameToId.get(m[1].toLowerCase());
  if (id === undefined) continue;
  const img = new Image();
  img.src = url;
  tileSprites[id] = img;
}

// UI art loader. Drop PNGs into `assets/ui/`; a missing dir/file just resolves to
// undefined (the UI falls back to an emoji), so the build never breaks on a missing asset.
const uiUrls = import.meta.glob('/assets/ui/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Blacksmith hammer used by the forge's manual speed-up button. Optional.
export const hammerUrl: string | undefined =
  Object.entries(uiUrls).find(([p]) => /hammer\.png$/.test(p))?.[1];
