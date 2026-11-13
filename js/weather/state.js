// weather/ — de getekende weather state: loopt vloeiend naar het doel (nooit een sprong)
// en houdt het sneeuwdek bij (groeit tijdens sneeuw, smelt langzaam als het stopt).

const KEY = 'pleinair.snowcover';
const KEYS = ['cloud', 'rain', 'snow', 'fog', 'windKmh', 'temp'];

// Uniforms voor de shader (WEATHER-blokken in main.frag)
export function weatherUniforms(w) {
  const rad = w.windDir * Math.PI / 180;
  const k = Math.min(1.5, w.windKmh / 50);
  return {
    u_cloud: w.cloud, u_rain: w.rain, u_snow: w.snow, u_snowCover: w.snowCover, u_fog: w.fog,
    // links op het doek = oost, rechts = west: wind uit het westen waait naar links
    u_wind: Math.sin(rad) * k,
  };
}

// rate: hoe snel de state het doel volgt (1/seconde). Echt weer: in ~1-2 minuten; test: in een paar seconden.
export function createWeatherState({ fast = false, cover = null } = {}) {
  let s = null, windDirX = 0, windDirY = 0;
  let saved = 0;
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && Date.now() - v.at < 6 * 3600e3) saved = v.cover; } catch (e) { /* geen opslag */ }
  let lastSave = 0;
  return {
    update(target, dt, snap = false) {
      if (snap && s) s = null;
      if (!s) {
        s = { ...target, snowCover: cover != null ? cover : fast ? 0 : Math.max(saved, target.snow > .05 ? .45 : 0) };
        windDirX = Math.cos(target.windDir * Math.PI / 180); windDirY = Math.sin(target.windDir * Math.PI / 180);
      }
      const k = 1 - Math.exp(-dt * (fast ? .8 : .025));
      for (const key of KEYS) s[key] += (target[key] - s[key]) * k;
      // windrichting via een vector, zodat 350° → 10° niet de verkeerde kant op draait
      windDirX += (Math.cos(target.windDir * Math.PI / 180) - windDirX) * k;
      windDirY += (Math.sin(target.windDir * Math.PI / 180) - windDirY) * k;
      s.windDir = Math.atan2(windDirY, windDirX) * 180 / Math.PI;
      // sneeuwdek: groeit met de sneeuw, smelt (sneller als het dooit)
      const grow = s.snow > .05 ? s.snow / (fast ? 25 : 600) : 0;
      const melt = s.snow > .05 ? 0 : 1 / ((s.temp > 0 ? 1800 : 7200) * (fast ? .02 : 1));
      s.snowCover = Math.min(1, Math.max(0, s.snowCover + (grow - melt) * dt));
      if (performance.now() - lastSave > 60000) {
        lastSave = performance.now();
        try { localStorage.setItem(KEY, JSON.stringify({ cover: s.snowCover, at: Date.now() })); } catch (e) { /* geen opslag */ }
      }
      return s;
    },
    set(values) { if (s) Object.assign(s, values); }, // alleen voor testen
  };
}
