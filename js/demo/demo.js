// demo/ — de demofilm (?demo): een eigen klok stuurt het storyboard, los van de echte tijd en het echte weer.
//
//   timeline.state(t) → zon/profiel, weer, beweging, camera → renderer (schilderij, evt. in de kamer)
//                     → compositor (zwart, bijschriften, titel) → scherm of filmframe
//
// ?demo              speelt de film af (spatie = pauze, ←/→ = 2 s terug/vooruit)
// ?demo&t=14&pause   toont precies het beeld op 14 s (voor stills)
// ?demo&render=concept|final|1280x720   rendert frame voor frame naar de server (zie tools/render_film.py)

import { state, DURATION, DEMO_DATE } from './timeline.js';
import { composite, loadFonts } from './captions.js';
import { sunPosition } from '../time/sun.js';
import { lightProfile } from '../time/profile.js';
import { moonPhase } from '../time/moon.js';
import { applyWeather, windToMotion } from '../weather/weather.js';
import { weatherUniforms } from '../weather/state.js';
import { relightUniforms } from '../relight/relight.js';
import { motionParams } from '../motion/motion.js';

export const FPS = 30;
const SWIRL = [0.50, 0.36];   // de grote centrale wervel: hier begint de beweging
const SIZES = { concept: [960, 540], final: [3840, 2160], hd: [1920, 1080] };

// Gouda in november = UTC+1; zo is de film in elke tijdzone hetzelfde
function dateAt(minutes) { return new Date(Date.UTC(DEMO_DATE.y, DEMO_DATE.m, DEMO_DATE.d, 0, 0, 0) + (minutes - 60) * 60000); }

// bewegingsklok vooraf integreren: u_mt(t) = ∫ snelheid dt (deterministisch, ook bij terugspoelen)
function buildMotionClock() {
  const step = 1 / 600, n = Math.ceil(DURATION / step) + 2, mt = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const s = state((i - .5) * step);
    mt[i] = mt[i - 1] + motionParams(s.motionOn * windToMotion(s.windKmh)).speed * step;
  }
  return t => { const x = Math.max(0, t) / step, i = Math.min(n - 2, Math.floor(x)); return mt[i] + (mt[i + 1] - mt[i]) * (x - i); };
}

export async function runDemo({ renderer, scene, imgSize, glCanvas }) {
  const params = new URLSearchParams(location.search);
  document.body.classList.add('demo');
  await Promise.all([loadFonts(), renderer.addProgram('room', 'js/render/shaders/room.frag')]);
  const motionClock = buildMotionClock();
  const phase = moonPhase(dateAt(22 * 60 + 5)).phase;   // de echte maanfase op de demodatum
  const fbo = renderer.createTarget();

  const comp = document.createElement('canvas');
  comp.id = 'comp'; document.body.appendChild(comp);
  const ctx = comp.getContext('2d', { willReadFrequently: true });

  const renderSpec = params.get('render');
  const fixed = renderSpec ? (SIZES[renderSpec] || renderSpec.split('x').map(Number)) : null;
  if (fixed) renderer.setFixedSize(fixed);

  function renderFrame(t) {
    const s = state(t);
    const [W, H] = renderer.resize(1);
    if (comp.width !== W || comp.height !== H) { comp.width = W; comp.height = H; }
    const sun = sunPosition(dateAt(s.minutes));
    const w = { cloud: s.cloud, rain: s.rain, snow: s.snow, fog: s.fog, windKmh: s.windKmh, windDir: s.windDir, temp: s.temp, snowCover: s.snowCover };
    const profile = applyWeather(lightProfile(sun), w);
    const { speed, ...mp } = motionParams(s.motionOn * windToMotion(s.windKmh));
    const wu = weatherUniforms(w);
    const uniforms = {
      u_res: [W, H], u_img: imgSize, u_t: t, u_mt: motionClock(t), u_wt: t, ...mp,
      ...relightUniforms(profile, scene, phase), ...wu,
      u_debug: 0, 'u_star[0]': scene.starData, u_starCount: scene.stars.length,
      u_moon: scene.moon ? [scene.moon.x, scene.moon.y, scene.moon.r] : [-1, -1, 0],
      u_still: s.still, u_moonOrig: s.moonOrig, u_contain: s.contain, u_pan: s.pan, u_wake: [SWIRL[0], SWIRL[1], s.wake],
    };
    renderer.use('main');
    if (s.room) {
      renderer.target(fbo, W, H);
      renderer.setUniforms(uniforms); renderer.draw();
      renderer.target(null);
      renderer.use('room');
      renderer.bindTexture('u_paint', 4, fbo.tex);
      renderer.setUniforms({ u_res: [W, H], u_cam: s.cam, u_wt: t, u_snow: s.snow, u_wind: wu.u_wind });
      renderer.draw();
      renderer.use('main');
    } else {
      renderer.target(null);
      renderer.setUniforms(uniforms); renderer.draw();
    }
    composite(ctx, glCanvas, s);
    window.__demo = { t, s };
  }

  if (fixed) return renderMovie(renderFrame, comp, ctx, renderSpec);

  // afspelen in de browser
  let t = params.has('t') ? +params.get('t') : 0, paused = params.has('pause'), last = performance.now();
  addEventListener('keydown', e => {
    if (e.key === ' ') paused = !paused;
    if (e.key === 'ArrowRight') t = Math.min(DURATION - .01, t + 2);
    if (e.key === 'ArrowLeft') t = Math.max(0, t - 2);
  });
  function loop(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (!paused) t = (t + dt) % DURATION;
    renderFrame(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// frame voor frame: elk frame als ruwe RGBA naar de server, die het direct aan ffmpeg geeft
// ?from=N: hervatten vanaf frame N (de server houdt ffmpeg open; tools/render_film.py herstart Chrome als die vastloopt)
async function renderMovie(renderFrame, comp, ctx, name) {
  const frames = Math.round(DURATION * FPS);
  const from = +(new URLSearchParams(location.search).get('from') || 0);
  renderFrame(0);
  let r;
  if (from === 0) {
    const q = `w=${comp.width}&h=${comp.height}&fps=${FPS}&name=${encodeURIComponent(name)}&total=${frames}`;
    r = await fetch('/render/start?' + q, { method: 'POST' });
    if (!r.ok) { document.title = 'RENDER-FOUT: ' + await r.text(); return; }
  }
  const t0 = performance.now();
  for (let f = from; f < frames; f++) {
    renderFrame(f / FPS);
    const px = ctx.getImageData(0, 0, comp.width, comp.height).data;
    r = await fetch('/render/frame?f=' + f, { method: 'PUT', body: px });
    if (r.status === 409 && (await r.text()).startsWith('al ontvangen')) continue;
    if (!r.ok) { document.title = 'RENDER-FOUT bij frame ' + f; return; }
    if (f % 30 === 0) await new Promise(res => setTimeout(res, 0));   // even ademruimte (geheugen opruimen)
    if (f % 15 === 0) {
      const sec = (performance.now() - t0) / 1000, eta = sec / (f + 1) * (frames - f - 1);
      document.title = `render ${f}/${frames} · nog ${Math.round(eta)} s`;
    }
  }
  r = await fetch('/render/end', { method: 'POST' });
  document.title = r.ok ? 'RENDER-KLAAR' : 'RENDER-FOUT bij afronden';
}
