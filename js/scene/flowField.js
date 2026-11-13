// scene/ — flow field: de richting van de penseelstreken, per pixel.
//
// Methode (structure tensor): meet per pixel de helderheidsgradiënt, middel die over een
// buurt, en neem de richting loodrecht op de sterkste gradiënt = de richting van de streek.
// Een streek heeft geen voor- of achterkant, dus de draairichting kiezen we met een
// referentieveld: wind van links naar rechts, en wervels die met de klok mee draaien.
// Opslag in flow.png:  R,G = richting (x,y) * 0.5 + 0.5   B = hoe duidelijk de streekrichting is

import { readPixels, blur } from './autoMasks.js';

const FLOW_W = 480;
// wervelcentra (x, y, straal) in 0..1 van het beeld
const VORTICES = [[.50, .36, .16], [.68, .46, .10], [.875, .18, .12]];

export function generateFlow(source, maskResult) {
  const { w, h, L } = readPixels(source, FLOW_W), N = w * h;
  const Lb = blur(L, w, h, 1);
  const Jxx = new Float32Array(N), Jxy = new Float32Array(N), Jyy = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = (Lb[i - w + 1] + 2 * Lb[i + 1] + Lb[i + w + 1]) - (Lb[i - w - 1] + 2 * Lb[i - 1] + Lb[i + w - 1]);
    const gy = (Lb[i + w - 1] + 2 * Lb[i + w] + Lb[i + w + 1]) - (Lb[i - w - 1] + 2 * Lb[i - w] + Lb[i - w + 1]);
    Jxx[i] = gx * gx; Jxy[i] = gx * gy; Jyy[i] = gy * gy;
  }
  const r = 5, bxx = blur(Jxx, w, h, r), bxy = blur(Jxy, w, h, r), byy = blur(Jyy, w, h, r);
  const stars = maskResult ? maskResult.data.stars : [];
  const vort = [...VORTICES, ...stars.map(s => [s.x, s.y, s.r * 1.2])];
  const aspect = h / w;

  let vx = new Float32Array(N), vy = new Float32Array(N); const coh = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = bxx[i], b = bxy[i], c = byy[i];
    const theta = 0.5 * Math.atan2(2 * b, a - c);         // richting van de gradiënt
    let tx = -Math.sin(theta), ty = Math.cos(theta);       // loodrecht: richting van de streek
    const tr = a + c, dif = Math.sqrt((a - c) * (a - c) + 4 * b * b);
    coh[i] = tr > 1e-6 ? Math.pow(dif / tr, 1.5) : 0;      // 1 = duidelijke streek, 0 = rommelig
    // referentie: wind naar rechts + wervels met de klok mee
    const u = x / w, v = y / h;
    let rx = .5, ry = 0;
    for (const [cx, cy, rad] of vort) {
      const dx = u - cx, dy = (v - cy) * aspect, d2 = dx * dx + dy * dy, wgt = Math.exp(-d2 / (rad * rad));
      const len = Math.sqrt(d2) + 1e-4;
      rx += -dy / len * wgt * 1.5; ry += dx / len * wgt * 1.5;
    }
    if (tx * rx + ty * ry < 0) { tx = -tx; ty = -ty; }
    vx[i] = tx; vy[i] = ty;
  }
  // gladstrijken: waar de richting omklapt wordt de vector kort → daar minder beweging
  vx = blur(vx, w, h, 2); vy = blur(vy, w, h, 2);

  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  for (let i = 0; i < N; i++) {
    const len = Math.hypot(vx[i], vy[i]) || 1, strength = Math.min(1, Math.hypot(vx[i], vy[i])) * coh[i];
    img.data[i * 4] = Math.round((vx[i] / len * .5 + .5) * 255);
    img.data[i * 4 + 1] = Math.round((vy[i] / len * .5 + .5) * 255);
    img.data[i * 4 + 2] = Math.round(Math.min(1, strength * 1.6) * 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: cv, width: w, height: h };
}
