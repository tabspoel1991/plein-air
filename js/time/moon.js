// time/ — maanfase uit de synodische maand (gemiddeld 29,53 dagen).
// phase: 0 = nieuwe maan, 0,25 = eerste kwartier, 0,5 = vol, 0,75 = laatste kwartier.
// Nauwkeurig op ongeveer een halve dag, ruim genoeg voor een geschilderde maan.

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // bekende nieuwe maan

export function moonPhase(date) {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const phase = age / SYNODIC;
  return { phase, age, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2, waxing: phase < 0.5 };
}

export function moonName(p) {
  const f = p.phase;
  if (f < .03 || f > .97) return 'Nieuwe maan';
  if (f < .22) return 'Wassende sikkel';
  if (f < .28) return 'Eerste kwartier';
  if (f < .47) return 'Wassende maan';
  if (f < .53) return 'Volle maan';
  if (f < .72) return 'Afnemende maan';
  if (f < .78) return 'Laatste kwartier';
  return 'Afnemende sikkel';
}
