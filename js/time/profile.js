// time/ — zonnestand → lichtprofiel (nacht, blauw uur, gouden uur, dag).
//
// Het profiel is een set getallen tussen 0 en 1 plus een paar kleuren. Alle waarden
// lopen vloeiend mee met de zonshoogte, zodat er nergens sprongen ontstaan.

export const lerp = (a, b, t) => a + (b - a) * t;
export const lerpA = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const bell = (x, mid, width) => Math.exp(-(((x - mid) / width) ** 2));

export function lightProfile(sun) {
  const e = sun.elev;
  const day = smooth(-7, 9, e);               // 0 = nacht, 1 = volle dag
  const night = 1 - smooth(-15, -5, e);       // diepe nacht (twinkelende sterretjes)
  const lamps = 1 - smooth(-2, 5, e);         // ramen: aan in avond en nacht
  const sunVis = smooth(-4, 0.5, e);          // zon boven (of net onder) de horizon

  // zon op het doek: oost links, west rechts; hoe hoger, hoe hoger op het doek
  const sunX = Math.min(.92, Math.max(.08, .5 + (sun.az - 180) / 150));
  const sunY = Math.max(.1, .66 - e / 45 * .6);

  // daglucht: hoog in de lucht dieper blauw, naar de horizon lichter
  const skyTop = lerpA([.36, .52, .80], [.30, .56, .90], smooth(5, 35, e));
  const skyHor = lerpA([.70, .76, .88], [.74, .86, .96], smooth(5, 35, e));
  // zonlicht: wit-warm midden op de dag, warmer als de zon laag staat
  const lightCol = lerpA([1.08, .88, .66], [1.0, .97, .90], smooth(4, 30, e));
  const shadowCol = [.86, .66, .58];          // warme schaduwkant

  return {
    day, night, lamps, sunVis,
    sun: [sunX, sunY], sunDir: sunX < .5 ? -1 : 1,
    skyTop, skyHor, lightCol, shadowCol,
    vig: lerp(.55, .14, day),
  };
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
