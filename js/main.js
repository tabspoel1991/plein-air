// main — verbindt de modules: input → scene → time → motion/relight → render, met ui eromheen.
import { DEFAULT_PAINTING, loadImage, loadImageFile, toCanvas, measureLuma } from './input/image.js';
import { sunPosition } from './time/sun.js';
import { lightProfile, phaseName, easeProfile } from './time/profile.js';
import { relightUniforms } from './relight/relight.js';
import { createMotion } from './motion/motion.js';
import { createRenderer } from './render/renderer.js';
import { createQuality } from './render/quality.js';
import { loadScene, genericScene } from './scene/scene.js';
import { initUI } from './ui/controls.js';

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
  let profile = null, last = performance.now();
  const t0 = last;
  function frame(now) {
    const rawDt = (now - last) / 1000, dt = Math.min(.25, rawDt); last = now;
    // frame-modus: hooguit ~1.25 beeldpunten per css-pixel (scheelt veel op tablets met een scherp scherm)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    quality.setMax(ui.frame ? Math.min(1, 1.25 / dpr) : 1);
    const res = renderer.resize(quality.update(rawDt));
    const date = ui.targetDate(), sun = sunPosition(date);
    profile = easeProfile(profile, lightProfile(sun), dt);
    ui.showTime(date, phaseName(sun));
    const uniforms = {
      u_res: res, u_img: imgSize, u_t: (now - t0) / 1000,
      ...motion.update(ui.motion, dt),
      ...relightUniforms(profile, scene),
      u_debug: ui.debug ? 1 : 0,
      'u_star[0]': scene.starData, u_starCount: scene.stars.length,
      u_moon: scene.moon ? [scene.moon.x, scene.moon.y, scene.moon.r] : [-1, -1, 0],
    };
    renderer.setUniforms(uniforms);
    window.__levend = { uniforms, profile, sun, ui, quality }; // alleen voor testen/debuggen
    renderer.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
