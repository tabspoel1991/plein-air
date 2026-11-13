// scene/ — automatische masks voor De Sterrennacht.
//
// Werkt met drie soorten aanwijzingen:
//   - positie: grove contouren (horizonlijn, cipres-omtrek, dorpsrand) als startpunt
//   - kleur:   geel = sterren/maan/ramen, donker en niet-blauw = cipres
//   - helderheid: de horizon wordt per kolom verfijnd op de overgang licht (lucht) → donker (heuvels)
// Uitkomst: per element een grijswaarde-mask (0..1) plus scene-data (posities van sterren en maan).

export const MASK_NAMES = ['sky', 'stars', 'moon', 'cypress', 'village', 'windows', 'hills'];
const WORK_W = 960;

// Contouren in pixels van het origineel (1920×1520), omgerekend naar 0..1.
const P = pts => pts.map(([x, y]) => [x / 1920, y / 1520]);
const RIDGE = P([[0, 1085], [140, 1090], [280, 1110], [700, 1062], [800, 1042], [950, 1030], [1050, 1000], [1150, 955],
  [1250, 932], [1350, 935], [1420, 930], [1480, 912], [1540, 868], [1565, 805], [1620, 790], [1700, 776], [1800, 790], [1920, 822]]);
const VILLAGE_TOP = P([[830, 1175], [1000, 1190], [1150, 1205], [1300, 1215], [1450, 1225], [1600, 1240], [1750, 1262], [1920, 1275]]);
const SPIRE = P([[1058, 1180], [1086, 880], [1112, 1180]]);
const CYPRESS = P([[375, 25], [425, 200], [445, 450], [470, 790], [560, 850], [625, 940], [760, 1040], [855, 1190], [905, 1400],
  [905, 1520], [215, 1520], [218, 1100], [258, 800], [290, 500], [330, 250]]);

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function interp(poly, u) {
  if (u <= poly[0][0]) return poly[0][1];
  for (let i = 1; i < poly.length; i++) {
    const [x0, y0] = poly[i - 1], [x1, y1] = poly[i];
    if (u <= x1) return y0 + (y1 - y0) * (u - x0) / (x1 - x0);
  }
  return poly[poly.length - 1][1];
}

// Polygoon rasteriseren via canvas (met anti-aliasing) → Float32Array 0..1
function polyMask(polys, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff';
  for (const poly of polys) {
    x.beginPath(); poly.forEach(([u, v], i) => i ? x.lineTo(u * w, v * h) : x.moveTo(u * w, v * h)); x.closePath(); x.fill();
  }
  const d = x.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
  return out;
}

function boxBlur(a, w, h, r) {
  const tmp = new Float32Array(a.length), out = new Float32Array(a.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w; let acc = 0;
    for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
export function blur(a, w, h, r) { let o = a; for (let i = 0; i < 3; i++) o = boxBlur(o, w, h, Math.max(1, Math.round(r))); return o; }

export function readPixels(source, w) {
  const h = Math.round(w * source.height / source.width);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(source, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, N = w * h;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), L = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    R[i] = d[i * 4] / 255; G[i] = d[i * 4 + 1] / 255; B[i] = d[i * 4 + 2] / 255;
    L[i] = .299 * R[i] + .587 * G[i] + .114 * B[i];
  }
  return { w, h, R, G, B, L };
}

export function generateMasks(source) {
  const px = readPixels(source, WORK_W), { w, h, R, G, B, L } = px, N = w * h;

  // ---- horizon: positie-schatting, per kolom verfijnd op licht→donker overgang ----
  const Lb = blur(L, w, h, 2), ridge = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const prior = interp(RIDGE, x / w) * h;
    let best = prior, bestS = -1e9;
    for (let y = Math.round(prior - 24); y <= Math.round(prior + 14); y++) {
      if (y < 9 || y > h - 9) continue;
      let up = 0, dn = 0;
      for (let k = 1; k <= 8; k++) { up += Lb[(y - k) * w + x]; dn += Lb[(y + k - 1) * w + x]; }
      const s = (up - dn) / 8 - Math.abs(y - prior) * .0025; // lichte voorkeur voor de schatting
      if (s > bestS) { bestS = s; best = y; }
    }
    ridge[x] = best;
  }
  // mediaan + gladstrijken over kolommen
  const med = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const win = []; for (let k = -16; k <= 16; k++) win.push(ridge[Math.min(w - 1, Math.max(0, x + k))]);
    win.sort((a, b) => a - b); med[x] = win[16];
  }
  for (let x = 0; x < w; x++) { let s = 0; for (let k = -6; k <= 6; k++) s += med[Math.min(w - 1, Math.max(0, x + k))]; ridge[x] = s / 13; }

  // ---- cipres: donker en niet-blauw, binnen de grove omtrek ----
  const env = polyMask([CYPRESS], w, h);
  let cyp = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dark = (L[i] < .30 && B[i] < Math.max(R[i], G[i]) + .08) || L[i] < .15;
    cyp[i] = dark ? env[i] : 0;
  }
  cyp = blur(cyp, w, h, 4);
  for (let i = 0; i < N; i++) cyp[i] = smooth(.35, .6, cyp[i]) * env[i];
  cyp = blur(cyp, w, h, 1);

  // ---- lucht: boven de horizon, zonder cipres ----
  const sky = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    sky[i] = smooth(ridge[x] + 2.5, ridge[x] - 2.5, y) * (1 - cyp[i]);
  }

  // ---- maan: zwaartepunt van sterk gele pixels rechtsboven ----
  let mx = 0, my = 0, mw = 0;
  for (let y = 0; y < h * .4; y++) for (let x = Math.round(w * .65); x < w; x++) {
    const i = y * w + x, yel = (R[i] + G[i]) / 2 - B[i];
    if (yel > .3 && L[i] > .55) { mx += x * yel; my += y * yel; mw += yel; }
  }
  const moon = mw > 0 ? { x: mx / mw / w, y: my / mw / h, r: .135 } : null;
  const moonM = new Float32Array(N);
  if (moon) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x / w - moon.x, (y / h - moon.y) * h / w);
    moonM[y * w + x] = smooth(moon.r, moon.r * .45, d) * sky[y * w + x];
  }

  // ---- sterren: lokale maxima van "geelheid" in de lucht ----
  const yel = new Float32Array(N);
  for (let i = 0; i < N; i++) yel[i] = Math.max(0, (R[i] + G[i]) / 2 - B[i]) * smooth(.4, .6, L[i]);
  const yb = blur(yel, w, h, 4), cand = [];
  const WIN = 12;
  for (let y = WIN; y < h - WIN; y += 2) for (let x = WIN; x < w - WIN; x += 2) {
    const i = y * w + x, v = yb[i];
    if (v < .045 || sky[i] < .9) continue;
    if (moon && Math.hypot(x / w - moon.x, (y / h - moon.y) * h / w) < moon.r * 1.05) continue;
    let isMax = true;
    for (let dy = -WIN; dy <= WIN && isMax; dy += 2) for (let dx = -WIN; dx <= WIN; dx += 2) if (yb[i + dy * w + dx] > v) { isMax = false; break; }
    if (!isMax) continue;
    // compactheid: een ster is een piek, een gele streep loopt door → vergelijk met een ring eromheen
    let ring = 0, rn = 0, ringMax = 0;
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, rx = Math.round(x + Math.cos(a) * 22), ry = Math.round(y + Math.sin(a) * 22);
      if (rx < 0 || ry < 0 || rx >= w || ry >= h) continue;
      const rv = yb[ry * w + rx]; ring += rv; rn++; ringMax = Math.max(ringMax, rv);
    }
    ring /= Math.max(1, rn);
    // kern: een ster heeft een fel geel-oranje hart, lichte gele strepen niet
    let core = 0;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; core = Math.max(core, (R[j] + G[j]) / 2 - B[j]);
    }
    if (core > .45 && v - ring > .03 && ringMax < v * .92) cand.push({ x, y, v: v - ring });
  }
  cand.sort((a, b) => b.v - a.v);
  const found = [];
  for (const c of cand) if (!found.some(f => Math.hypot(f.x - c.x, f.y - c.y) < 40)) found.push(c);
  const stars = found.slice(0, 16).map(s => {
    // stralenkrans: hoeveel heldere pixels er rond de kern liggen
    let n = 0; const RR = 60;
    for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
      const x = s.x + dx, y = s.y + dy;
      if (x < 0 || y < 0 || x >= w || y >= h || dx * dx + dy * dy > RR * RR) continue;
      if (Lb[y * w + x] > .6) n++;
    }
    const r = Math.min(58, Math.max(22, Math.sqrt(n / Math.PI) * 1.15));
    return { x: s.x / w, y: s.y / h, r: r / w };
  });
  const starM = new Float32Array(N);
  for (const s of stars) {
    const cx = s.x * w, cy = s.y * h, rr = s.r * w;
    for (let y = Math.max(0, Math.floor(cy - rr)); y < Math.min(h, cy + rr); y++)
      for (let x = Math.max(0, Math.floor(cx - rr)); x < Math.min(w, cx + rr); x++) {
        const i = y * w + x;
        starM[i] = Math.max(starM[i], smooth(rr, rr * .3, Math.hypot(x - cx, y - cy)) * (1 - cyp[i]));
      }
  }

  // ---- dorp: onder de dorpsrand, rechts van de cipres, plus de kerktoren ----
  const vpoly = [[.43, 1], ...VILLAGE_TOP, [1, 1]];
  let village = polyMask([vpoly, SPIRE], w, h);
  village = blur(village, w, h, 2);
  for (let i = 0; i < N; i++) village[i] *= (1 - cyp[i]) * (1 - sky[i]);

  // ---- ramen: kleine geel-oranje lichtjes in het dorp ----
  let win = new Float32Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const lit = R[i] > .55 && G[i] > .42 && B[i] < .5 && (R[i] + G[i]) / 2 - B[i] > .22;
    win[i] = lit && y > h * .74 && x > w * .42 ? 1 - cyp[i] : 0;
  }
  win = blur(win, w, h, 1);
  for (let i = 0; i < N; i++) win[i] = smooth(.06, .3, win[i]);

  // ---- heuvels: al het landschap dat geen lucht, cipres of dorp is ----
  const hills = new Float32Array(N);
  for (let i = 0; i < N; i++) hills[i] = Math.max(0, 1 - sky[i] - cyp[i] - village[i]);

  return {
    width: w, height: h,
    masks: { sky, stars: starM, moon: moonM, cypress: cyp, village, windows: win, hills },
    data: { width: w, height: h, moon, stars },
  };
}

export function maskToCanvas(a, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let i = 0; i < a.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, a[i])) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
