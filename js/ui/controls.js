// ui/ — knoppen, sliders, frame-modus, tv-modus. Houdt de UI-state bij; weet niets van WebGL.
//
// De knopstand is één pakketje { live, minutes, date, motion, autoMotion }: getState() / applyState().
// Elke wijziging door de gebruiker meldt onChange (zo stuurt de telefoon de tv aan, zie js/remote/).

import { chosenDay, parseDay, dayKey, FIRST_DAY } from '../time/day.js';

const $ = id => document.getElementById(id);
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

export function initUI({ onFile, onDay = () => {}, onChange = () => {}, onRemote = () => {} }) {
  const params = new URLSearchParams(location.search);
  const state = { live: true, minutes: 720, motion: +$('motion').value, autoMotion: true };
  const slider = $('timeSlider'), liveBtn = $('live'), autoBtn = $('autoWind'), dayIn = $('day');
  const changed = () => onChange(state.getState());
  // ?time=13:00 → vaste tijd (handig om te testen)
  const tq = params.get('time');
  if (tq && /^\d{1,2}:\d{2}$/.test(tq)) { const [h, m] = tq.split(':').map(Number); state.live = false; state.minutes = h * 60 + m; }

  // ---- datumkiezer: een dag kiezen wisselt zonder herladen (URL ?date= blijft deelbaar); Live = terug naar nu ----
  const today = new Date();
  dayIn.min = FIRST_DAY; dayIn.max = dayKey(new Date(today.getTime() + 15 * 86400000));
  state.day = chosenDay(params);
  if (state.day) { state.live = false; if (!tq) state.minutes = today.getHours() * 60 + today.getMinutes(); }
  function setDay(day) {
    if ((day && day.key) === (state.day && state.day.key)) return;
    state.day = day;
    dayIn.value = day ? day.key : dayKey(new Date());
    const u = new URL(location.href);
    if (day) u.searchParams.set('date', day.key); else u.searchParams.delete('date');
    history.replaceState(null, '', u.toString().replace(/=(?=&|$)/g, ''));
    onDay(day);
  }
  dayIn.addEventListener('change', () => {
    const d = parseDay(dayIn.value);
    if (!d) return;
    const isToday = d.key === dayKey(new Date());
    setDay(isToday ? null : d);
    if (!isToday && state.live) { state.live = false; state.minutes = new Date().getHours() * 60 + new Date().getMinutes(); }
    refresh(); changed();
  });

  slider.addEventListener('input', () => { state.live = false; state.minutes = +slider.value; refresh(); changed(); });
  liveBtn.addEventListener('click', () => { setDay(null); state.live = true; refresh(); changed(); });
  // beweging: standaard stuurt de wind; zelf schuiven overschrijft dat
  $('motion').addEventListener('input', e => { state.motion = +e.target.value; state.autoMotion = false; refresh(); changed(); });
  autoBtn.addEventListener('click', () => { state.autoMotion = true; refresh(); changed(); });
  state.showMotion = v => { if (state.autoMotion) $('motion').value = Math.min(1, v); };
  state.showWeather = text => { $('wx').textContent = text; };

  // knoppen laten zien wat de state is (ook als die van de telefoon komt)
  function refresh() {
    liveBtn.classList.toggle('on', state.live && !state.day);
    autoBtn.classList.toggle('on', state.autoMotion);
    if (!state.autoMotion) $('motion').value = state.motion;
    if (!state.live) slider.value = state.minutes;
    dayIn.value = state.day ? state.day.key : dayKey(new Date());
  }
  state.getState = () => ({ live: state.live, minutes: state.minutes, date: state.day ? state.day.key : null, motion: state.motion, autoMotion: state.autoMotion });
  state.applyState = s => {
    if (!s) return;
    if (typeof s.live === 'boolean') state.live = s.live;
    if (isFinite(s.minutes)) state.minutes = Math.max(0, Math.min(1439, Math.round(s.minutes)));
    if (isFinite(s.motion)) state.motion = Math.max(0, Math.min(1, +s.motion));
    if (typeof s.autoMotion === 'boolean') state.autoMotion = s.autoMotion;
    if ('date' in s) setDay(parseDay(s.date));
    refresh();
  };

  const file = $('file');
  $('pick').addEventListener('click', () => file.click());
  file.addEventListener('change', () => file.files[0] && onFile(file.files[0]));
  const drop = $('drop');
  addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('show'); });
  addEventListener('dragleave', e => { if (e.target === drop || !e.relatedTarget) drop.classList.remove('show'); });
  addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('show'); const f = e.dataTransfer.files[0]; if (f) onFile(f); });

  $('fs').addEventListener('click', toggleFullscreen);
  $('tvBtn').addEventListener('click', () => onRemote());
  state.showRemote = code => {
    $('tvBtn').textContent = code ? '📺 Tv · ' + code : 'Bedien tv';
    $('tvBtn').classList.toggle('on', !!code);
  };

  // sneltoetsen: M = masks tonen (debug), F = frame-modus
  state.debug = false;
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (state.tv) return;                              // tv-afstandsbediening: alleen fullscreen + code tonen
    if (e.key === 'm' || e.key === 'M') { state.debug = !state.debug; $('legend').classList.toggle('show', state.debug); }
    if (e.key === 'f' || e.key === 'F') setFrame(!state.frame);
  });
  $('frameBtn').addEventListener('click', () => setFrame(true));

  // ---- frame-modus: fullscreen, geen knoppen, geen cursor, altijd de echte tijd ----
  // ---- tv-modus (?tv): ziet eruit als de lijst, maar volgt de telefoon (js/remote/) ----
  state.frame = false;
  state.tv = params.has('tv') && !params.has('demo');
  const fromUrl = params.has('frame') || state.tv;
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* niet ondersteund */ }
  }
  function setFrame(on) {
    state.frame = on;
    document.body.classList.toggle('frame', on);
    if (on) {
      if (!state.tv) { setDay(null); state.live = true; refresh(); }   // lijst-modus is altijd live; de tv volgt de telefoon
      state.debug = false; $('legend').classList.remove('show');
      if (!document.fullscreenElement) toggleFullscreen();
    } else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    keepAwake(on);
  }
  // fullscreen mag pas na een klik/tik: bij ?frame proberen we het direct, en anders bij de eerste aanraking
  const firstGesture = () => { if (state.frame && !document.fullscreenElement) toggleFullscreen(); };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, firstGesture));
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.frame && !fromUrl) setFrame(false); // Esc verlaat de frame-modus
  });
  document.addEventListener('visibilitychange', () => { if (state.frame && document.visibilityState === 'visible') keepAwake(true); });
  if (fromUrl) setFrame(true);
  if (state.tv) document.body.classList.add('tv');
  if (params.has('clean')) document.body.classList.add('frame'); // alleen het beeld (voor screenshots)

  // tv: de koppelcode groot in beeld tot er een telefoon verbindt; daarna even een bevestiging.
  // Een knop op de tv-afstandsbediening laat de code nog even in de hoek zien.
  state.showTvCode = code => {
    $('tvCode').textContent = code;
    $('tvUrl').textContent = location.host + location.pathname.replace(/index\.html$/, '');
    document.body.classList.add('tv-pairing');
  };
  let cornerT;
  state.tvConnected = () => {
    document.body.classList.remove('tv-pairing');
    document.body.classList.add('tv-corner');
    clearTimeout(cornerT); cornerT = setTimeout(() => document.body.classList.remove('tv-corner'), 5000);
  };
  addEventListener('keydown', () => {
    if (!state.tv || document.body.classList.contains('tv-pairing')) return;
    document.body.classList.add('tv-corner');
    clearTimeout(cornerT); cornerT = setTimeout(() => document.body.classList.remove('tv-corner'), 8000);
  });

  // een lijst die dagen aan staat: elke nacht om 04:00 even verversen (frisse klok, geen geheugenopbouw)
  setInterval(() => {
    const d = new Date();
    if (state.frame && d.getHours() === 4 && d.getMinutes() === 0 && performance.now() > 120000) location.reload();
  }, 30000);

  // knoppen verbergen na stilte, zodat het als lijst aan de muur werkt
  let idleT;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => document.body.classList.add('idle'), 3500); };
  ['mousemove', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => addEventListener(ev, wake, { passive: true }));
  wake();

  // De datum die getekend moet worden: nu (of de gekozen dag), op de echte tijd of de tijd van de slider.
  state.targetDate = () => {
    const d = new Date();
    if (state.day) d.setFullYear(state.day.y, state.day.m, state.day.d);
    if (!state.live) d.setHours(Math.floor(state.minutes / 60), state.minutes % 60, 0, 0);
    return d;
  };

  state.showTime = (date, phase) => {
    const m = date.getHours() * 60 + date.getMinutes();
    if (state.live) slider.value = m;
    $('clockT').textContent = fmt(m);
    $('clockPh').textContent = phase;
  };

  state.setTitle = text => { $('sub').textContent = text; };
  state.showError = text => { const e = $('err'); if (text) e.textContent = text; e.style.display = 'flex'; };
  refresh();
  return state;
}

export async function toggleFullscreen() {
  try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch (e) { /* niet toegestaan */ }
}
