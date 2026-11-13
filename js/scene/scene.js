// scene/ — masks per element laden en klaarzetten voor de GPU.
//
// Bron: de PNG's in assets/masks/ (met de hand bij te werken). Ontbreken die (bijv. bij een
// eigen upload), dan valt de scene terug op een simpele lucht-boven/land-onder verdeling.
// De zeven masks worden in twee RGBA-textures gepakt:
//   maskA = lucht, sterren, maan, cipres      maskB = dorp, ramen, heuvels, (leeg)

import { MASK_NAMES } from './autoMasks.js';
import { loadImage } from '../input/image.js';

export const MASK_DIR = 'assets/masks/';
export const MAX_STARS = 16;

function grayFromImage(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4];
  return out;
}

function pack(masks, w, h) {
  const A = new Uint8Array(w * h * 4), B = new Uint8Array(w * h * 4);
  const m = masks;
  for (let i = 0; i < w * h; i++) {
    A[i * 4] = m.sky[i]; A[i * 4 + 1] = m.stars[i]; A[i * 4 + 2] = m.moon[i]; A[i * 4 + 3] = m.cypress[i];
    B[i * 4] = m.village[i]; B[i * 4 + 1] = m.windows[i]; B[i * 4 + 2] = m.hills[i]; B[i * 4 + 3] = 0;
  }
  return { maskA: { data: A, width: w, height: h }, maskB: { data: B, width: w, height: h } };
}

// sterren als vec4-array: x, y, straal (fractie van breedte), eigen ritme (0..1)
function starArray(stars) {
  const a = new Float32Array(MAX_STARS * 4);
  stars.slice(0, MAX_STARS).forEach((s, i) => {
    a.set([s.x, s.y, s.r, ((i * 0.6180339) % 1)], i * 4);
  });
  return a;
}

export async function loadScene() {
  try {
    const meta = await (await fetch(MASK_DIR + 'scene.json')).json();
    const w = meta.width, h = meta.height;
    const imgs = await Promise.all(MASK_NAMES.map(n => loadImage(MASK_DIR + n + '.png')));
    const masks = {}; MASK_NAMES.forEach((n, i) => { masks[n] = grayFromImage(imgs[i], w, h); });
    return { ...pack(masks, w, h), stars: meta.stars || [], starData: starArray(meta.stars || []), moon: meta.moon, source: 'masks' };
  } catch (e) {
    console.warn('Geen masks gevonden, val terug op simpele verdeling', e);
    return genericScene();
  }
}

// Voor een eigen afbeelding: bovenste deel = lucht, onderste deel = land.
export function genericScene() {
  const w = 64, h = 64, masks = {};
  MASK_NAMES.forEach(n => { masks[n] = new Uint8Array(w * h); });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = y / h, t = Math.min(1, Math.max(0, (0.62 - v) / 0.12)), s = Math.round(t * t * (3 - 2 * t) * 255);
    masks.sky[y * w + x] = s; masks.hills[y * w + x] = 255 - s;
  }
  return { ...pack(masks, w, h), stars: [], starData: starArray([]), moon: null, source: 'generic' };
}
