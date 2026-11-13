// ui/ — knoppen, sliders, frame-modus. Houdt de UI-state bij; weet niets van WebGL.

const $ = id => document.getElementById(id);
const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

export function initUI({ onFile }) {
  const state = { live: true, minutes: 720, motion: +$('motion').value };
  const slider = $('timeSlider'), liveBtn = $('live');

  slider.addEventListener('input', () => { state.live = false; state.minutes = +slider.value; liveBtn.classList.remove('on'); });
  liveBtn.addEventListener('click', () => { state.live = true; liveBtn.classList.add('on'); });
  $('motion').addEventListener('input', e => { state.motion = +e.target.value; });

  const file = $('file');
  $('pick').addEventListener('click', () => file.click());
  file.addEventListener('change', () => file.files[0] && onFile(file.files[0]));
  const drop = $('drop');
  addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('show'); });
  addEventListener('dragleave', e => { if (e.target === drop || !e.relatedTarget) drop.classList.remove('show'); });
  addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('show'); const f = e.dataTransfer.files[0]; if (f) onFile(f); });

  $('fs').addEventListener('click', toggleFullscreen);

  // sneltoetsen: M = masks tonen (debug), F = frame-modus
  state.debug = false;
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.key === 'm' || e.key === 'M') { state.debug = !state.debug; $('legend').classList.toggle('show', state.debug); }
    if (e.key === 'f' || e.key === 'F') setFrame(!state.frame);
  });
  $('frameBtn').addEventListener('click', () => setFrame(true));

  // ---- frame-modus: fullscreen, geen knoppen, geen cursor, altijd de echte tijd ----
  state.frame = false;
  const fromUrl = new URLSearchParams(location.search).has('frame');
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
      state.live = true; liveBtn.classList.add('on');
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

  // De datum die getekend moet worden: nu, of de tijd van de slider.
  state.targetDate = () => {
    const d = new Date();
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
  return state;
}

export async function toggleFullscreen() {
  try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch (e) { /* niet toegestaan */ }
}
