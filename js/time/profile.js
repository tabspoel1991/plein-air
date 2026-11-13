// time/ — zonnestand → lichtprofiel (nacht, blauw uur, gouden uur, dag).

const KEYS = [
  { e: -18, expo: .42, L: .14, gain: [.70, .82, 1.22], sat: .72, sky: [.05, .08, .25], hor: [.10, .12, .30], skyA: .55, vig: .60, stars: 1, glow: 1 },
  { e: -8, expo: .62, L: .22, gain: [.84, .86, 1.15], sat: .85, sky: [.22, .24, .55], hor: [.55, .40, .55], skyA: .50, vig: .42, stars: .35, glow: .7 },
  { e: -2, expo: .86, L: .32, gain: [1.12, .92, .92], sat: 1.05, sky: [.55, .45, .70], hor: [.98, .58, .50], skyA: .48, vig: .30, stars: 0, glow: .35 },
  { e: 4, expo: .96, L: .42, gain: [1.2, .97, .78], sat: 1.18, sky: [.70, .70, .85], hor: [1.0, .72, .42], skyA: .42, vig: .24, stars: 0, glow: .08 },
  { e: 15, expo: 1, L: .49, gain: [1.04, 1.0, .95], sat: 1.05, sky: [.80, .88, 1.0], hor: [.98, .92, .82], skyA: .30, vig: .18, stars: 0, glow: 0 },
  { e: 35, expo: 1.03, L: .53, gain: [1.0, 1.0, 1.0], sat: 1.0, sky: [.68, .84, 1.0], hor: [.90, .94, 1.0], skyA: .22, vig: .12, stars: 0, glow: 0 },
];

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpA = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

export function lightProfile(sun) {
  const e = Math.max(KEYS[0].e, Math.min(KEYS[KEYS.length - 1].e, sun.elev));
  let i = 0; while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (e - a.e) / (b.e - a.e);
  const o = {};
  for (const k in a) if (k !== 'e') o[k] = Array.isArray(a[k]) ? lerpA(a[k], b[k], t) : lerp(a[k], b[k], t);
  // dageraad is iets koeler en rozer dan schemering
  if (sun.morning && sun.elev > -10 && sun.elev < 12) {
    o.gain = [o.gain[0] * .97, o.gain[1], o.gain[2] * 1.06];
    o.hor = [o.hor[0], o.hor[1] * .92, o.hor[2] * 1.15];
  }
  return o;
}

export function phaseName(sun) {
  if (sun.elev < -12) return 'Nacht';
  if (sun.elev < -4) return 'Blauw uur';
  if (sun.elev < 6) return sun.morning ? 'Zonsopkomst' : 'Zonsondergang';
  if (sun.elev < 18) return sun.morning ? 'Ochtend' : 'Avondlicht';
  return sun.morning ? 'Ochtend' : 'Middag';
}

// Laat een profiel vloeiend naar het doel bewegen (geen sprongen bij schuiven).
export function easeProfile(cur, target, dt, rate = 3.5) {
  if (!cur) return JSON.parse(JSON.stringify(target));
  const k = 1 - Math.exp(-dt * rate);
  for (const key in target) cur[key] = Array.isArray(target[key]) ? lerpA(cur[key], target[key], k) : lerp(cur[key], target[key], k);
  return cur;
}
