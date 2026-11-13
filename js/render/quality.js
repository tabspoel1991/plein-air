// render/ — adaptieve resolutie: als frames te traag worden, rendert de pipeline op een
// lagere resolutie (de browser schaalt het beeld op). Gaat het weer soepel, dan langzaam omhoog.

export function createQuality({ min = .35 } = {}) {
  let scale = 1, max = 1, avg = 1 / 60, slowT = 0, fastT = 0;
  return {
    get scale() { return scale; },
    setMax(m) {
      if (m === max) return;
      if (scale >= max) scale = m;  // stond op het maximum: volg het nieuwe maximum
      max = m; scale = Math.min(scale, max);
    },
    update(dt) {
      if (!(dt > 0) || dt > .5) return scale;          // tab was weg: niet meetellen
      avg += (dt - avg) * .06;
      if (avg > 1 / 40) { slowT += dt; fastT = 0; }    // onder ~40 fps: haperen
      else if (avg < 1 / 55) { fastT += dt; slowT = 0; }
      else { slowT = 0; fastT = 0; }
      if (slowT > 1.5) { scale = Math.max(min, scale * .8); slowT = 0; avg = 1 / 48; }
      if (fastT > 8 && scale < max) { scale = Math.min(max, scale * 1.12); fastT = 0; }
      return scale;
    },
  };
}
