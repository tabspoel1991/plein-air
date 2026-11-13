// main — verbindt de modules: input → scene → time → motion/relight → render, met ui eromheen.
import { DEFAULT_PAINTING, loadImage, loadImageFile, toCanvas, measureLuma } from './input/image.js';
import { sunPosition } from './time/sun.js';
import { lightProfile, phaseName, easeProfile } from './time/profile.js';
import { relightUniforms } from './relight/relight.js';
import { createMotion } from './motion/motion.js';
import { createRenderer } from './render/renderer.js';
import { initUI } from './ui/controls.js';

const ui = initUI({ onFile: f => loadImageFile(f).then(img => setPainting(img, f.name.replace(/\.[^.]+$/, ''))).catch(console.error) });

let renderer, imgSize = [16, 9], srcLuma = .45;

function setPainting(source, title) {
  const c = toCanvas(source);
  renderer.setTexture('u_tex', 0, c);
  imgSize = [c.width, c.height];
  srcLuma = measureLuma(c);
  ui.setTitle(title);
}

async function start() {
  try {
    renderer = await createRenderer(document.getElementById('gl'), { vert: 'js/render/shaders/main.vert', frag: 'js/render/shaders/main.frag' });
  } catch (e) { console.error(e); ui.showError('Shader-fout: ' + e.message); return; }
  if (!renderer) { ui.showError(); return; }

  setPainting(await loadImage(DEFAULT_PAINTING.url), DEFAULT_PAINTING.name);

  const motion = createMotion();
  let profile = null, last = performance.now();
  const t0 = last;
  function frame(now) {
    const dt = Math.min(.25, (now - last) / 1000); last = now;
    const res = renderer.resize();
    const date = ui.targetDate(), sun = sunPosition(date);
    profile = easeProfile(profile, lightProfile(sun), dt);
    ui.showTime(date, phaseName(sun));
    const uniforms = {
      u_res: res, u_img: imgSize, u_t: (now - t0) / 1000,
      ...motion.update(ui.motion, dt),
      ...relightUniforms(profile, srcLuma),
    };
    renderer.setUniforms(uniforms);
    window.__levend = { uniforms, profile, sun, ui }; // alleen voor testen/debuggen
    renderer.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start();
