// weather/ — het weer van één gekozen dag in Gouda, per uur (datumkiezer, ?date=).
//
//   fetch (één keer) → per uur classify (zelfde regels als het live weer) → target op de tijd
//   van de slider, vloeiend tussen twee uren. Sneeuwdek uit de gemeten sneeuwhoogte.
// Bron: Open-Meteo forecast-API (±90 dagen terug t/m 15 dagen vooruit), anders het
// historical archive (vanaf 1940). Verleden dagen worden in localStorage bewaard.
// Zelfde vorm als createWeather(): { target, source, takeSnap }, plus update(date) en status.

import { GOUDA } from '../time/sun.js';
import { daysFromToday } from '../time/day.js';
import { classify, CLEAR } from './weather.js';

const HOURLY = 'weather_code,cloud_cover,precipitation,rain,showers,snowfall,snow_depth,wind_speed_10m,wind_direction_10m,visibility,temperature_2m';
const base = host => 'https://' + host + '?latitude=' + GOUDA.lat + '&longitude=' + GOUDA.lon + '&hourly=' + HOURLY + '&timezone=Europe%2FAmsterdam';
const FORECAST = base('api.open-meteo.com/v1/forecast'), ARCHIVE = base('archive-api.open-meteo.com/v1/archive');
const KEY = 'pleinair.day.';

async function fetchDay(day) {
  try { const c = JSON.parse(localStorage.getItem(KEY + day.key)); if (c && c.time) return c; } catch (e) { /* geen opslag */ }
  const diff = daysFromToday(day);
  if (diff > 15) throw new Error('te ver in de toekomst');
  const q = '&start_date=' + day.key + '&end_date=' + day.key;
  const urls = diff >= -88 ? [FORECAST + q, ARCHIVE + q] : [ARCHIVE + q, FORECAST + q];
  let err;
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || j.error || !j.hourly || !j.hourly.time || !j.hourly.time.length) throw new Error(j.reason || 'HTTP ' + r.status);
      // alleen afgelopen dagen bewaren (voorspellingen veranderen nog)
      if (diff < -1) { try { localStorage.setItem(KEY + day.key, JSON.stringify(j.hourly)); } catch (e) { /* vol */ } }
      return j.hourly;
    } catch (e) { err = e; }
  }
  throw err;
}

const at = (h, k, i) => (h[k] && h[k][i] != null ? h[k][i] : undefined);

export function createDayWeather(day) {
  const w = { target: { ...CLEAR }, source: 'laden', status: 'laden', forced: false, snap: false, hours: null };
  w.takeSnap = () => { const s = w.snap; w.snap = false; return s; };
  fetchDay(day).then(h => {
    w.hours = h.time.map((_, i) => ({
      ...classify({
        weather_code: at(h, 'weather_code', i), cloud_cover: at(h, 'cloud_cover', i), rain: at(h, 'rain', i),
        showers: at(h, 'showers', i), snowfall: at(h, 'snowfall', i), wind_speed_10m: at(h, 'wind_speed_10m', i),
        wind_direction_10m: at(h, 'wind_direction_10m', i), visibility: at(h, 'visibility', i), temperature_2m: at(h, 'temperature_2m', i),
      }),
      // sneeuwdek: ~4 cm sneeuw = volledig wit (een dun laagje al zichtbaar)
      cover: Math.min(1, Math.max(0, (at(h, 'snow_depth', i) || 0) / .04)) ** .7,
    }));
    w.source = 'open-meteo'; w.status = 'ok'; w.snap = true;
  }).catch(e => { console.warn('Weer van ' + day.key + ' niet gevonden:', e.message); w.source = 'geen data'; w.status = 'geen'; });

  // target op het uur van de getekende tijd, vloeiend tussen twee uurmetingen
  w.update = date => {
    if (!w.hours) return;
    const hf = date.getHours() + date.getMinutes() / 60, n = w.hours.length;
    const i0 = Math.min(n - 1, Math.floor(hf)), i1 = Math.min(n - 1, i0 + 1), f = hf - Math.floor(hf);
    const a = w.hours[i0], b = w.hours[i1], t = {};
    for (const k of ['cloud', 'rain', 'snow', 'fog', 'windKmh', 'temp', 'cover']) t[k] = a[k] + (b[k] - a[k]) * f;
    const r = Math.PI / 180;
    t.windDir = Math.atan2(Math.sin(a.windDir * r) * (1 - f) + Math.sin(b.windDir * r) * f,
                           Math.cos(a.windDir * r) * (1 - f) + Math.cos(b.windDir * r) * f) / r;
    w.target = t;
  };
  return w;
}
