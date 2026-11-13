// demo/ — het storyboard van de film (60 s) als keyframes. state(t) is een pure functie:
// dezelfde t geeft altijd dezelfde toestand, dus de film is overal frame voor frame te besturen.

export const DURATION = 60;
// demodatum: 13 november 2026 in Gouda (zon op ~07:58, onder ~16:50)
export const DEMO_DATE = { y: 2026, m: 10, d: 13 };

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const smoother = x => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
// keyframes [[t, waarde, 'lin'|'ease'], ...]: tussen twee keys loopt de waarde lineair of zacht (ease)
export function keys(t, ks) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, v1, e = 'ease'] = ks[i], [t0, v0] = ks[i - 1];
    if (t <= t1) { const x = (t - t0) / (t1 - t0); return v0 + (v1 - v0) * (e === 'lin' ? x : smoother(x)); }
  }
  return ks[ks.length - 1][1];
}
const m = (h, mm) => h * 60 + mm;

// kloktijd (minuten) — binnen een scène een rustige timelapse, tussen scènes een zachte overgang
const CLOCK = [
  [0, m(2, 10)], [9.4, m(2, 10)],
  [10.4, m(6, 40)],                       // nacht → blauw uur (onzichtbaar snel: het is nog donker)
  [16.6, m(8, 32), 'lin'],                // dageraad: sterren doven, roze licht, de zon komt op
  [17.6, m(9, 55)], [24.6, m(11, 0), 'lin'],
  [25.6, m(12, 45)], [31.6, m(13, 40), 'lin'],
  [32.6, m(15, 55)], [38.6, m(16, 55), 'lin'],   // gouden uur → zonsondergang
  [39.8, m(21, 40)], [47, m(22, 25), 'lin'], [60, m(22, 40), 'lin'],
];

export function state(t) {
  const s = {};
  s.t = t;
  s.minutes = keys(t, CLOCK);

  // het doek komt tot leven: eerst een stille print (alles uit), dan één wervel, dan alles
  s.still = 1 - smooth(seg(t, 6.0, 8.6));
  s.contain = keys(t, [[0, 1.78], [5.6, 1.6, 'lin'], [9.8, 0]]);   // hele doek → vullend beeld (langzame push-in)
  s.wake = t < 6.2 ? 0.0001 : t > 10.5 ? 0 : .05 + 1.7 * smooth(seg(t, 6.3, 10.2)); // straal (0 = overal)
  s.moonOrig = 1 - smooth(seg(t, 39.8, 41.0));   // de echte maanfase verschijnt in de sneeuwnacht
  s.pan = keys(t, [[0, 0], [38.5, 0], [40.5, -.07], [47, -.07], [48, -.02]]); // in de sneeuwnacht iets omhoog: maan in beeld

  // weer
  s.cloud = keys(t, [[0, 0], [17, 0], [20.2, .95], [24.8, .95], [28.6, .12], [38.8, .12], [40.2, .32], [60, .32]]);
  s.rain = keys(t, [[0, 0], [19.2, 0], [20.6, .2], [22.2, .5], [24.4, .5], [26.4, 0]]);
  s.fog = keys(t, [[0, 0], [10, 0], [12, .28], [15.2, .22], [17.6, 0]]);   // ochtendnevel
  s.snow = keys(t, [[0, 0], [39.6, 0], [41.4, .7], [60, .7]]);
  s.snowCover = keys(t, [[0, 0], [41.2, 0], [47, .72, 'lin'], [60, .8, 'lin']]);
  s.windKmh = keys(t, [[0, 5], [17, 5], [19, 12], [25, 12], [27, 38], [29.6, 74], [32, 74], [34.5, 14], [39, 10], [40.5, 6]]);
  s.windDir = 245;
  s.temp = t > 39 ? -1 : 6;

  // beweging: 0 tijdens de print, daarna volgt hij de wind
  s.motionOn = smooth(seg(t, 6.2, 8.2));

  // kamer: langzame uitzoom (47 → 53,5), daarna even stil
  const z = smoother(seg(t, 47, 53.5));
  s.room = t >= 47 && t < 55.5;
  s.cam = [ .50 * z, .30 * z, 1 + 2.6 * (z * .82 + .18 * z * z) ];

  // zwart: in vanuit zwart, uit naar de titelkaart, en het einde
  s.black = Math.max(1 - smooth(seg(t, 0, 1.6)), smooth(seg(t, 54.3, 55.2)));
  return s;
}

// bijschriften linksonder (museumlabel en tijd · plaats · weer) en de titelkaart
export const CAPTIONS = [
  { text: 'Vincent van Gogh', sub: 'The Starry Night  ·  1889', a: 1.2, b: 6.6, label: true },
  { text: '02:10  ·  Gouda  ·  clear', a: 7.8, b: 9.9 },
  { text: '07:58  ·  Gouda  ·  sunrise', a: 10.9, b: 16.3 },
  { text: '10:30  ·  Gouda  ·  light rain', a: 17.9, b: 24.3 },
  { text: '13:15  ·  Gouda  ·  windy', a: 25.9, b: 31.3 },
  { text: '16:40  ·  Gouda  ·  sunset', a: 32.9, b: 38.3 },
  { text: '22:05  ·  Gouda  ·  snow', a: 39.9, b: 46.4 },
];
export const TITLE = { main: 'Plein Air', sub: 'The outside, inside.', a: 55.6, aSub: 56.5, fadeOut: [58.6, 59.8] };
export const FADE = 0.8;  // in-/uitfaden van een bijschrift (s)
