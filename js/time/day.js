// time/ — de gekozen dag van de datumkiezer (?date=JJJJ-MM-DD). Zonder (geldige) datum: live.
// Frame-modus (?frame) is altijd live, dus daar telt de datum niet.

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const FIRST_DAY = '1940-01-01';                 // het weerarchief begint in 1940

export function parseDay(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  if (isNaN(dt) || dt.getMonth() !== m - 1 || dt.getDate() !== d || s < FIRST_DAY) return null;
  return { y, m: m - 1, d, key: s };
}

export function chosenDay(params = new URLSearchParams(location.search)) {
  return params.has('frame') || params.has('demo') ? null : parseDay(params.get('date'));
}

export const dayLabel = day => day.d + ' ' + MONTHS[day.m] + ' ' + day.y;

export function dayKey(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

// dagen tussen de gekozen dag en vandaag (negatief = verleden)
export function daysFromToday(day) {
  const now = new Date(), t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(day.y, day.m, day.d) - t) / 86400000);
}
