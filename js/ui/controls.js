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
