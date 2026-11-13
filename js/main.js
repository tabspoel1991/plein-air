// main — verbindt de modules: input → scene → time + weather → motion/relight → render, met ui eromheen.
import { DEFAULT_PAINTING, loadImage, loadImageFile, toCanvas, measureLuma } from './input/image.js';
import { sunPosition } from './time/sun.js';
import { moonPhase } from './time/moon.js';
import { lightProfile, phaseName, easeProfile } from './time/profile.js';
import { relightUniforms } from './relight/relight.js';
import { createMotion } from './motion/motion.js';
import { createRenderer } from './render/renderer.js';
import { createQuality } from './render/quality.js';
import { loadScene, genericScene } from './scene/scene.js';
import { initUI } from './ui/controls.js';
import { createWeather, applyWeather, windToMotion } from './weather/weather.js';
import { createWeatherState, weatherUniforms } from './weather/state.js';

const params = new URLSearchParams(location.search);

function weatherName(w) {
  const n = w.snow > .15 ? 'Sneeuw' : w.rain > .55 ? 'Regen' : w.rain > .12 ? 'Motregen' : w.fog > .4 ? 'Mist'
    : w.cloud > .7 ? 'Bewolkt' : w.cloud > .35 ? 'Half bewolkt' : 'Helder';
  return n + ' · ' + Math.round(w.windKmh) + ' km/u';
}

const ui = initUI({
  onFile: f => loadImageFile(f).then(img => setPainting(img, f.name.replace(/\.[^.]+$/, ''), genericScene())).catch(console.error),
});

let renderer, scene, imgSize = [16, 9], srcLuma = .45;

function setPainting(source, title, sc) {
  const c = toCanvas(source);
  renderer.setTexture('u_tex', 0, c);
  imgSize = [c.width, c.height];
  srcLuma = measureLuma(c);
  scene = sc;
  renderer.setTexture('u_maskA', 1, sc.maskA);
  renderer.setTexture('u_maskB', 2, sc.maskB);
  renderer.setTexture('u_flow', 3, sc.flow);
  ui.setTitle(title);
}

async function start() {
  try {
    renderer = await createRenderer(document.getElementById('gl'), { vert: 'js/render/shaders/main.vert', frag: 'js/render/shaders/main.frag' });
  } catch (e) { console.error(e); ui.showError('Shader-fout: ' + e.message); return; }
  if (!renderer) { ui.showError(); return; }

  const [img, sc] = await Promise.all([loadImage(DEFAULT_PAINTING.url), loadScene()]);
  setPainting(img, DEFAULT_PAINTING.name, sc);

  const motion = createMotion(), quality = createQuality();
  const forced = params.get('weather');
  const weather = createWeather({ force: forced }), wstate = createWeatherState({ fast: !!forced, cover: params.has('cover') ? +params.get('cover') : null });
  let profile = null, last = performance.now();
  const t0 = last;
  function frame(now) {
    const rawDt = (now - last) / 1000, dt = Math.min(.25, rawDt); last = now;
    // frame-modus: hooguit ~1.25 beeldpunten per css-pixel (scheelt veel op tablets met een scherp scherm)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    quality.setMax(ui.frame ? Math.min(1, 1.25 / dpr) : 1);
    const res = renderer.resize(quality.update(rawDt));
    const date = ui.targetDate(), sun = sunPosition(date);
    const w = wstate.update(weather.target, dt, weather.takeSnap());
    profile = easeProfile(profile, applyWeather(lightProfile(sun), w), dt);
    ui.showTime(date, phaseName(sun));
    ui.showWeather(weatherName(w));
    const motionValue = ui.autoMotion ? windToMotion(w.windKmh) : ui.motion;
    ui.showMotion(motionValue);
    const uniforms = {
      u_res: res, u_img: imgSize, u_t: (now - t0) / 1000,
      ...motion.update(motionValue, dt),
      ...relightUniforms(profile, scene, params.has('moon') ? +params.get('moon') : moonPhase(date).phase),
      ...weatherUniforms(w),
      u_debug: ui.debug ? 1 : 0,
      'u_star[0]': scene.starData, u_starCount: scene.stars.length,
      u_moon: scene.moon ? [scene.moon.x, scene.moon.y, scene.moon.r] : [-1, -1, 0],
    };
    renderer.setUniforms(uniforms);
    window.__levend = { uniforms, profile, sun, ui, quality, weather, w, wstate }; // alleen voor testen/debuggen
    renderer.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // testhaakje (werkt ook vanuit een geïsoleerde testomgeving): document.dispatchEvent(new CustomEvent('pa-test', {detail: '{"snowCover":.7}'}))
  document.addEventListener('pa-test', e => {
    const d = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
    const { minutes, ...wv } = d;
    if (minutes != null) { ui.live = false; ui.minutes = minutes; }
    window.__levend.wstate.set(wv);
  });
}

start();
