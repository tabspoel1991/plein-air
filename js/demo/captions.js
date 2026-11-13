// demo/ — compositor: WebGL-beeld + zwart + bijschriften + titelkaart op één 2D-canvas,
// zodat de tekst ook in de gerenderde filmframes staat.
import { CAPTIONS, TITLE, FADE, seg } from './timeline.js';

const FONT = '"Cormorant Garamond", Georgia, serif';
const ease = x => x * x * (3 - 2 * x);

export async function loadFonts() {
  const faces = [
    new FontFace('Cormorant Garamond', 'url(assets/fonts/CormorantGaramond.ttf)', { weight: '300 700' }),
    new FontFace('Cormorant Garamond', 'url(assets/fonts/CormorantGaramond-Italic.ttf)', { weight: '300 700', style: 'italic' }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
  await document.fonts.load('300 40px "Cormorant Garamond"');
  await document.fonts.load('italic 300 40px "Cormorant Garamond"');
}

// zichtbaarheid van een tekst die op a infaadt en op b weer weg is
function vis(t, a, b, fade = FADE) { return ease(seg(t, a, a + fade)) * (1 - ease(seg(t, b - fade, b))); }

export function composite(ctx, glCanvas, s) {
  const W = ctx.canvas.width, H = ctx.canvas.height, u = H / 1080;   // u = 1 "pixel" bij 1080p
  ctx.globalAlpha = 1;
  ctx.drawImage(glCanvas, 0, 0, W, H);
  if (s.black > 0) { ctx.fillStyle = `rgba(0,0,0,${s.black})`; ctx.fillRect(0, 0, W, H); }

  // bijschriften linksonder: dunne serif, ingetogen, ruime letterspatiëring
  for (const c of CAPTIONS) {
    const v = vis(s.t, c.a, c.b);
    if (v <= 0) continue;
    const size = (c.label ? 30 : 34) * u;
    ctx.font = `300 ${size}px ${FONT}`;
    ctx.letterSpacing = `${(c.label ? 2.2 : 2.6) * u}px`;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const x = 96 * u, y = H - 84 * u;
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18 * u;
    ctx.fillStyle = `rgba(246,240,228,${.88 * v})`;
    if (c.sub) {
      // museumlabel: naam, daaronder titel en jaar (cursief, kleiner)
      ctx.fillText(c.text, x, y - 40 * u);
      ctx.font = `italic 300 ${size * .82}px ${FONT}`; ctx.letterSpacing = `${1.6 * u}px`;
      ctx.fillStyle = `rgba(246,240,228,${.72 * v})`;
      ctx.fillText(c.sub, x, y);
    } else ctx.fillText(c.text, x, y);
    // dun lijntje boven het museumlabel
    if (c.label) { ctx.shadowBlur = 0; ctx.fillStyle = `rgba(246,240,228,${.45 * v})`; ctx.fillRect(x, y - 40 * u - size - 14 * u, 56 * u, 1.2 * u); }
    ctx.shadowBlur = 0;
  }

  // titelkaart op zwart
  const T = TITLE;
  const out = 1 - ease(seg(s.t, T.fadeOut[0], T.fadeOut[1]));
  const vm = ease(seg(s.t, T.a, T.a + 1.1)) * out, vs = ease(seg(s.t, T.aSub, T.aSub + 1.1)) * out;
  if (vm > 0) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `300 ${118 * u}px ${FONT}`; ctx.letterSpacing = `${10 * u}px`;
    ctx.fillStyle = `rgba(246,240,228,${vm})`;
    ctx.fillText(T.main, W / 2 + 5 * u, H / 2 + 8 * u);   // + halve spatiëring: optisch gecentreerd
    if (vs > 0) {
      ctx.font = `italic 300 ${38 * u}px ${FONT}`; ctx.letterSpacing = `${3 * u}px`;
      ctx.fillStyle = `rgba(246,240,228,${.72 * vs})`;
      ctx.fillText(T.sub, W / 2 + 1.5 * u, H / 2 + 78 * u);
    }
  }
  ctx.letterSpacing = '0px';
}
