// remote/ — de telefoon als afstandsbediening voor een tv.
//
//   telefoon ── send(stand) ──► ntfy.sh/pleinair-<code> ──► listen() ── tv
//
// GitHub Pages heeft geen eigen server, dus de knopstanden gaan via ntfy.sh: een gratis openbare
// "brievenbus" (geen account). Alleen { live, minutes, date, motion, autoMotion } gaat erheen,
// onder een willekeurige koppelcode; ntfy bewaart het laatste bericht 12 uur, zodat een herstarte
// tv meteen weer goed staat.

const RELAY = 'https://ntfy.sh/';
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';     // geen 0/O, 1/I/L: makkelijk over te typen
const TV_KEY = 'pleinair.tvcode', PHONE_KEY = 'pleinair.remote';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* privé-venster */ } },
};

export const cleanCode = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const topic = code => RELAY + 'pleinair-' + code;

// tv: een vaste code per tv (onthouden), of ?tv=CODE
export function tvCode(fromUrl) {
  let c = cleanCode(fromUrl);
  if (c.length !== 6) c = cleanCode(store.get(TV_KEY));
  if (c.length !== 6) c = Array.from({ length: 6 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  store.set(TV_KEY, c);
  return c;
}

// telefoon: de gekoppelde tv onthouden
export const phoneCode = () => { const c = cleanCode(store.get(PHONE_KEY)); return c.length === 6 ? c : null; };
export const setPhoneCode = c => store.set(PHONE_KEY, c);

// laatste stand (bij het opstarten / koppelen)
export async function latest(code) {
  try {
    const r = await fetch(topic(code) + '/json?poll=1&since=latest', { cache: 'no-store' });
    const lines = (await r.text()).trim().split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = JSON.parse(lines[i]);
      if (m.event === 'message') return JSON.parse(m.message);
    }
  } catch (e) { console.warn('Tv-stand ophalen mislukt', e.message); }
  return null;
}

// tv: luister naar nieuwe standen (EventSource verbindt zelf opnieuw na een storing)
export function listen(code, onState) {
  const es = new EventSource(topic(code) + '/sse');
  es.onmessage = e => {
    try { const m = JSON.parse(e.data); if (m.event === 'message') onState(JSON.parse(m.message)); } catch (err) { /* geen stand */ }
  };
  return () => es.close();
}

// telefoon: stand versturen, schuifjes hooguit ~4× per seconde (de laatste stand komt altijd aan)
export function sender(code) {
  let pending = null, timer = null, last = 0;
  const flush = () => {
    timer = null; last = Date.now();
    const body = JSON.stringify(pending); pending = null;
    fetch(topic(code), { method: 'POST', body }).catch(e => console.warn('Versturen naar tv mislukt', e.message));
  };
  return state => {
    pending = { ...state, at: Date.now() };
    if (!timer) timer = setTimeout(flush, Math.max(0, 250 - (Date.now() - last)));
  };
}
