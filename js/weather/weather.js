// weather/ — het echte weer in Gouda (Open-Meteo) → een "weather state" met waarden 0..1.
//
//   fetch (elke 15 min) → classify → target  ── state.js laat de getekende state daar
//   vloeiend naartoe lopen en houdt het sneeuwdek bij.
// Zonder internet: laatst bekende meting uit localStorage, anders helder weer.
// Testen: ?weather=clear|cloudy|drizzle|rain|storm|snow|fog forceert een weertype.

import { GOUDA } from '../time/sun.js';

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=' + GOUDA.lat + '&longitude=' + GOUDA.lon +
  '&current=weather_code,cloud_cover,precipitation,rain,showers,snowfall,wind_speed_10m,wind_direction_10m,visibility,temperature_2m&timezone=auto';
const KEY = 'pleinair.weather';
const EVERY = 15 * 60 * 1000;

export const CLEAR = { cloud: .05, rain: 0, snow: 0, fog: 0, windKmh: 8, windDir: 240, temp: 10 };

// Vaste weertypen (voor ?weather= en de demo)
export const PRESETS = {
  clear:   { ...CLEAR },
  cloudy:  { ...CLEAR, cloud: .92, windKmh: 14 },
  drizzle: { ...CLEAR, cloud: .85, rain: .25, windKmh: 12 },
  rain:    { ...CLEAR, cloud: .95, rain: .75, windKmh: 22 },
  storm:   { ...CLEAR, cloud: 1, rain: 1, windKmh: 80, windDir: 250 },
  snow:    { ...CLEAR, cloud: .8, snow: .75, windKmh: 9, temp: -2 },
  fog:     { ...CLEAR, cloud: .55, fog: .9, windKmh: 3, temp: 4 },
};

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Open-Meteo "current" → weather state. WMO-codes: 45/48 mist, 51-57 motregen, 61-67 regen,
// 71-77 sneeuw, 80-82 buien, 85-86 sneeuwbuien, 95-99 onweer.
export function classify(c) {
  const code = c.weather_code ?? 0;
  let cloud = clamp01((c.cloud_cover ?? 0) / 100), rain = 0, snow = 0, fog = 0;
  if (code >= 51 && code <= 57) rain = [.18, .25, .32][Math.min(2, Math.floor((code - 51) / 2))];
  if (code >= 61 && code <= 67) rain = code <= 61 ? .45 : code <= 63 ? .7 : 1;
  if (code >= 80 && code <= 82) rain = [.55, .8, 1][code - 80];
  if (code >= 95) rain = 1;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) snow = code === 71 || code === 85 ? .4 : code === 73 || code === 77 ? .65 : .9;
  // gemeten neerslag telt ook mee (codes lopen soms achter)
  const liquid = (c.rain ?? 0) + (c.showers ?? 0);
  rain = Math.max(rain, clamp01(liquid / 4) * (liquid > 0.05 ? 1 : 0));
  snow = Math.max(snow, clamp01((c.snowfall ?? 0) / 1.5));
  if (code === 45 || code === 48) fog = .85;
  if (c.visibility != null) fog = Math.max(fog, 1 - smooth(300, 5000, c.visibility));
  if (rain > 0 || snow > 0) cloud = Math.max(cloud, .8);
  return { cloud, rain, snow, fog, windKmh: c.wind_speed_10m ?? 8, windDir: c.wind_direction_10m ?? 240, temp: c.temperature_2m ?? 10 };
}

function readCache() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.state ? v : null; } catch (e) { return null; }
}
function writeCache(state) {
  try { localStorage.setItem(KEY, JSON.stringify({ state, at: Date.now() })); } catch (e) { /* privé-venster */ }
}

// Geeft { target, source, forced } dat zichzelf ververst.
export function createWeather({ force } = {}) {
  if (force && PRESETS[force]) return { target: { ...PRESETS[force] }, source: 'test: ' + force, forced: true, takeSnap: () => false };
  const cached = readCache();
  const w = { target: cached ? cached.state : { ...CLEAR }, source: cached ? 'cache' : 'standaard (helder)', forced: false, snap: false };
  // zonder cache: de eerste echte meting direct tonen (niet minutenlang vanaf "helder" infaden)
  let first = !cached;
  w.takeSnap = () => { const s = w.snap; w.snap = false; return s; };
  async function refresh() {
    try {
      const r = await fetch(URL, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      w.target = classify(j.current || {}); w.source = 'open-meteo'; w.raw = j.current;
      if (first) { w.snap = true; first = false; }
      writeCache(w.target);
    } catch (e) { console.warn('Weer ophalen mislukt, gebruik ' + w.source, e.message); }
  }
  refresh();
  setInterval(refresh, EVERY);
  return w;
}

// Wind → beweging: windstil = rustig doek, storm = razende wervels (boven 1 = sterker dan de slider kan)
export function windToMotion(kmh) {
  const k = Math.max(0, kmh);
  return k <= 60 ? .15 + .85 * (k / 60) : Math.min(1.3, 1 + (k - 60) / 100);
}

// Het lichtprofiel onder bewolking: zon, gouden uur en schemering gedempt, daglucht grijzer.
export function applyWeather(p, w) {
  const c = w.cloud, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return {
    ...p,
    sunVis: p.sunVis * (1 - .55 * c),
    golden: p.golden * (1 - .8 * c),
    rake: p.rake * (1 - .75 * c),            // bewolkt: diffuus licht, nauwelijks schaduw in de verf
    twilight: p.twilight * (1 - .6 * c),
    skyTop: mix(p.skyTop, [.58, .61, .66], c * .8),
    skyHor: mix(p.skyHor, [.72, .74, .76], c * .8),
    lightCol: mix(p.lightCol, [.86, .88, .92], c * .7),
    shadowCol: mix(p.shadowCol, [.66, .66, .70], c * .6),
  };
}
