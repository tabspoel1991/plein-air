// scene/ — verfreliëf: een hoogtekaart + normal map van de verf, één keer bij het laden.
//
// Methode: lichte verf ligt (bij benadering) dikker → hoogte = high-pass van de helderheid.
// Die hoogte wordt langs de streekrichting uit het flow field uitgesmeerd (line integral
// convolution), zodat het langgerekte ribbels worden in plaats van vlekken. De normal komt uit
// de hoogte via Sobel. Zonder flow.png (eigen upload) blijft het een fijne, korrelige textuur.
// Opslag: R,G = normal x,y * 0.5 + 0.5   B = hoogte * 0.5 + 0.5

import { readPixels, blur } from './autoMasks.js';

const MAX_W = 1280;
const LIC_STEPS = 5;     // stappen naar voren en naar achteren langs de streek

// flow lezen op de resolutie van het reliëf (flow is een Image of ruwe bytes {data, width, height})
function readFlow(flow, w, h) {
  const N = w * h, fx = new Float32Array(N), fy = new Float32Array(N), coh = new Float32Array(N);
  let d;
  if (flow && flow.data && flow.width === 1) {
    for (let i = 0; i < N; i++) { fx[i] = flow.data[0] / 127.5 - 1; fy[i] = flow.data[1] / 127.5 - 1; coh[i] = flow.data[2] / 255 * .5; }
    return { fx, fy, coh };
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (flow && flow.data) { // ruwe bytes van een ander formaat: via een tijdelijk canvas
    const t = document.createElement('canvas'); t.width = flow.width; t.height = flow.height;
    t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(flow.data), flow.width, flow.height), 0, 0);
    x.drawImage(t, 0, 0, w, h);
  } else x.drawImage(flow, 0, 0, w, h);
  d = x.getImageData(0, 0, w, h).data;
  for (let i = 0; i < N; i++) { fx[i] = d[i * 4] / 127.5 - 1; fy[i] = d[i * 4 + 1] / 127.5 - 1; coh[i] = d[i * 4 + 2] / 255; }
  return { fx, fy, coh };
}

export function generateRelief(canvas, flow) {
  const W = Math.min(MAX_W, canvas.width);
  const { w, h, L } = readPixels(canvas, W), N = w * h;
  // high-pass: fijne verf-structuur, zonder de grote licht/donker-vlakken
  const fine = blur(L, w, h, 1), base = blur(L, w, h, Math.round(w / 160));
  const hp = new Float32Array(N);
  for (let i = 0; i < N; i++) hp[i] = fine[i] - base[i];

  // LIC: uitsmeren langs de streekrichting, hoe duidelijker de streek hoe meer
  const { fx, fy, coh } = readFlow(flow, w, h);
  const H = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let s = hp[i], ws = 1;
    for (const sgn of [-1, 1]) {
      let px = x + .5, py = y + .5;
      for (let k = 1; k <= LIC_STEPS; k++) {
        const j = Math.min(h - 1, Math.max(0, py | 0)) * w + Math.min(w - 1, Math.max(0, px | 0));
        px += fx[j] * sgn * 1.2; py += fy[j] * sgn * 1.2;    // volg de (krommende) streek
        const q = Math.min(h - 1, Math.max(0, py | 0)) * w + Math.min(w - 1, Math.max(0, px | 0));
        const wk = Math.exp(-(k * k) / (LIC_STEPS * LIC_STEPS * .5));
        s += hp[q] * wk; ws += wk;
      }
    }
    const c = Math.min(1, coh[i] * 1.3);
    H[i] = hp[i] * (1 - c) * .6 + (s / ws) * c * 1.3;   // rommelige plekken: zwakker reliëf
  }

  // schalen op de spreiding, zodat elk schilderij ongeveer even veel reliëf krijgt
  let v = 0; for (let i = 0; i < N; i++) v += H[i] * H[i];
  const inv = 1 / (Math.sqrt(v / N) * 3 + 1e-5);

  const out = new Uint8Array(N * 4), slope = 2.5 * inv * (w / 1280);
  const at = (x, y) => H[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -gx * slope, ny = -gy * slope; const len = Math.sqrt(nx * nx + ny * ny + 1);
    nx /= len; ny /= len;
    const i = y * w + x;
    out[i * 4] = Math.round((nx * .5 + .5) * 255);
    out[i * 4 + 1] = Math.round((ny * .5 + .5) * 255);
    out[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, H[i] * inv * .5 + .5)) * 255);
    out[i * 4 + 3] = 255;
  }
  return { data: out, width: w, height: h };
}
