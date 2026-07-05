// The game's ui module wires DOM elements (getElementById(...).onclick = ...) at
// import time, and the logic modules transitively import it. So every test needs
// the real element IDs present. We inject index.html's <body> markup into jsdom
// before any game module is imported. (Injected <script> tags do NOT execute via
// innerHTML, so main.ts never boots — exactly what we want.)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../index.html'), 'utf-8');
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
document.body.innerHTML = body ? body[1] : '';

// jsdom has no 2D canvas backend; ui reads ctx but tests never draw. Stub to null
// to avoid jsdom's "Not implemented: getContext" noise.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
