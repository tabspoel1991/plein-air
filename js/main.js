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
import { generateRelief } from './scene/relief.js';
import { initUI } from './ui/controls.js';
import { createWeather, applyWeather, windToMotion } from './weather/weather.js';
import { createWeatherState, weatherUniforms } from './weather/state.js';
import { createDayWeather } from './weather/history.js';
import { chosenDay, dayLabel } from './time/day.js';

const params = new URLSearchParams(location.search);
const demo = params.has('demo');
const day = chosenDay(params);   // datumkiezer (?date=); null = live
const PHONE = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;

function weatherName(w, source) {
  const n = w.snow > .15 ? 'Sneeuw' : w.rain > .55 ? 'Regen' : w.rain > .12 ? 'Motregen' : w.fog > .4 ? 'Mist'
    : w.cloud > .7 ? 'Bewolkt' : w.cloud > .35 ? 'Half bewolkt' : w.snowCover > .2 ? 'Sneeuwdek' : 'Helder';
  const txt = n + ' · ' + Math.round(w.windKmh) + ' km/u';
  if (!day) return txt;
  // gekozen dag: laat zien welke dag en welk weer er actief is
  const d = dayLabel(day) + ' · ';
  return source.status === 'laden' ? d + 'weer laden…' : source.status === 'geen' ? d + 'geen weer bekend (helder)' : d + txt;
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
  renderer.setTexture('u_relief', 5, generateRelief(c, sc.flow));   // unit 4 = demokamer, 7 = render targets
  ui.setTitle(title);
}

async function start() {
  try {
    renderer = await createRenderer(document.getElementById('gl'), { vert: 'js/render/shaders/main.vert', frag: 'js/render/shaders/main.frag', preserve: demo });
  } catch (e) { console.error(e); ui.showError('Shader-fout: ' + e.message); return; }
  if (!renderer) { ui.showError(); return; }

  const [img, sc] = await Promise.all([loadImage(DEFAULT_PAINTING.url), loadScene()]);
  setPainting(img, DEFAULT_PAINTING.name, sc);

  // demo-modus: een eigen klok en een eigen draaiboek (js/demo/)
  if (demo) {
    const { runDemo } = await import('./demo/demo.js');
    try { await runDemo({ renderer, scene, imgSize, glCanvas: document.getElementById('gl') }); }
    catch (e) { console.error(e); ui.showError('Demo-fout: ' + e.message); }
    return;
  }

  const motion = createMotion(), quality = createQuality();
  const forced = params.get('weather');
  // weer: geforceerd (?weather=), van een gekozen dag (?date=), of live
  const weather = day && !forced ? createDayWeather(day) : createWeather({ force: forced });
  const wstate = createWeatherState({ fast: !!forced || !!day, persist: !day, cover: params.has('cover') ? +params.get('cover') : null });
  let profile = null, last = performance.now();
  const t0 = last;
  function frame(now) {
    const rawDt = (now - last) / 1000, dt = Math.min(.25, rawDt); last = now;
    // frame-modus: hooguit ~1.25 beeldpunten per css-pixel (scheelt veel op tablets met een scherp scherm);
    // telefoons/tablets (touch, klein scherm) hooguit ~1.5, voor de prestaties en de batterij
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    quality.setMax(ui.frame ? Math.min(1, 1.25 / dpr) : PHONE ? Math.min(1, 1.5 / dpr) : 1);
    const res = renderer.resize(quality.update(rawDt));
    const date = ui.targetDate(), sun = sunPosition(date);
    if (weather.update) weather.update(date);
    const w = wstate.update(weather.target, dt, weather.takeSnap());
    profile = easeProfile(profile, applyWeather(lightProfile(sun), w), dt);
    ui.showTime(date, phaseName(sun));
    ui.showWeather(weatherName(w, weather));
    const motionValue = ui.autoMotion ? windToMotion(w.windKmh) : ui.motion;
    ui.showMotion(motionValue);
    const uniforms = {
      u_res: res, u_img: imgSize, u_t: (now - t0) / 1000,
      // portret (telefoon): uitsnede iets naar links, zodat cipres en de grote wervel in beeld zijn
      u_panX: scene.source === 'masks' && res[0] < res[1] ? -.42 : 0,
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
