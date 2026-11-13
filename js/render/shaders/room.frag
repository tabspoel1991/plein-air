#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
// ROOM — de demo-kamer: het levende schilderij als tv-frame aan de muur van een stille woonkamer
// in de avond, met warm lamplicht en een raam waarachter het sneeuwt (zelfde sneeuw en klok als het doek).
// Wereldcoördinaten: eenheid = hoogte van het beeldscherm; (0,0) = midden van het scherm; y omlaag.
varying vec2 v_uv;
uniform sampler2D u_paint;    // het schilderij (render target), 16:9 net als het scherm
uniform vec2 u_res;
uniform vec3 u_cam;           // middelpunt x, y en beeldhoogte (1 = het scherm vult het beeld)
uniform float u_wt, u_snow, u_wind;

const vec2 TV = vec2(.8889, .5);        // halve maat van het scherm
const float BEZEL = .03;
const vec2 LAMP = vec2(-2.1, -1.04);     // midden van de lampenkap
const vec2 WIN_C = vec2(2.25, -.12), WIN_H = vec2(.56, 1.18);
const float FLOOR = 1.80;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return noise(p) * .55 + noise(p * 2.3 + 7.1) * .3 + noise(p * 5.1 + 3.3) * .15; }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float fill(float d, float aa) { return 1. - smoothstep(-aa, aa, d); }

// het schilderij, met een paar extra monsters als het scherm klein in beeld is (anti-aliasing)
vec3 paint(vec2 uv, float minify) {
  vec2 o = vec2(max(0., minify - 1.) * .45) / u_res;
  vec3 c = texture2D(u_paint, uv).rgb * 2.;
  c += texture2D(u_paint, uv + vec2(o.x, o.y)).rgb + texture2D(u_paint, uv + vec2(-o.x, o.y)).rgb;
  c += texture2D(u_paint, uv + vec2(o.x, -o.y)).rgb + texture2D(u_paint, uv - o).rgb;
  return c / 6.;
}

// licht in de kamer: warme lamp, zacht schijnsel van het scherm, koel licht van het raam
vec3 roomLight(vec2 w, vec3 tvCol) {
  vec3 L = vec3(.115, .088, .07);                                      // warme schemer
  vec2 dl = (w - LAMP) * vec2(.75, 1.);
  L += vec3(1., .70, .42) * 1.1 * exp(-dot(dl, dl) * .30);             // lamp
  // lichtbundels boven en onder de kap
  float up = smoothstep(-.25, -.6, w.y - LAMP.y) * exp(-pow((w.x - LAMP.x) / (.22 + (LAMP.y - w.y) * .75), 2.));
  float dn = smoothstep(.2, .6, w.y - LAMP.y) * exp(-pow((w.x - LAMP.x) / (.28 + (w.y - LAMP.y) * .55), 2.));
  L += vec3(1., .74, .46) * (up * .55 + dn * .35);
  float dt = sdBox(w, TV + BEZEL);
  L += tvCol * .55 * exp(-max(dt, 0.) * 3.2);                          // schijnsel van het doek
  float dw = sdBox(w - WIN_C, WIN_H);
  L += vec3(.20, .27, .45) * .35 * exp(-max(dw, 0.) * 2.2);            // koel raamlicht
  return L;
}

// een rij grachtenpanden: puntgevels, trapgevels en klokgevels, sneeuw op de daklijn, warme ramen.
// q in wereldmaat (glas: 1,0 breed, 2,3 hoog), w = breedte per pand, eave = dakvoet, ground = straat
vec4 houses(vec2 q, float w, float eave, float ground, float seed) {
  float hx = q.x / w + seed, cell = floor(hx), fx = fract(hx);
  float ev = eave + (hash(vec2(cell, seed + 1.)) - .5) * .09;
  float gh = .2 + .14 * hash(vec2(cell, seed + 2.));
  float type = hash(vec2(cell, seed + 3.));
  float e = .5 - abs(fx - .5);                         // 0 aan de rand, .5 in het midden
  float top;
  if (type < .33) top = ev - gh * e * 2.;                                        // puntgevel
  else if (type < .7) top = ev - gh * min(1., floor(e * 2. * 3.999 + .35) / 3.); // trapgevel
  else top = ev - gh * (smoothstep(.06, .30, e) * .8 + step(.36, e) * .2);       // klokgevel
  float body = step(top, q.y) * step(q.y, ground) * step(.012, fx) * step(fx, .988);
  vec3 c = vec3(.050, .048, .066) * (.75 + .5 * hash(vec2(cell, seed + 5.)));
  // ramen: drie kolommen per verdieping, één in de gevel
  vec2 wg = vec2(fx * 3., (q.y - ev - .05) / .2);
  vec2 wc = floor(wg), wf = fract(wg);
  float inBody = step(0., q.y - ev - .05) * step(q.y, ground - .16);
  float win = step(.3, wf.x) * step(wf.x, .7) * step(.18, wf.y) * step(wf.y, .78) * inBody;
  vec2 gw = vec2(abs(fx - .5), q.y - (ev - gh * .45));
  win += step(gw.x, .07) * step(abs(gw.y), .055) * step(.33, type);
  float lit = step(.48, hash(wc + cell * 7.31 + seed));
  vec3 warm = vec3(1., .70, .36) * (.6 + .4 * hash(wc + cell + seed * 3.));
  c = mix(c, mix(vec3(.07, .08, .13), warm, lit), clamp(win, 0., 1.) * .95);
  // sneeuw op de daklijn en de vensterbankjes
  float rim = smoothstep(.018, .0, q.y - top) * body;
  float sill = step(.78, wf.y) * step(wf.y, .84) * step(.27, wf.x) * step(wf.x, .73) * inBody;
  c = mix(c, vec3(.55, .60, .76), max(rim, sill * .7));
  return vec4(c, body);
}

// buiten: avondlucht boven Goudse grachtenpanden, een besneeuwde kade en het water, met sneeuw
vec3 outside(vec2 o) {   // o: 0..1 over het glas (x rechts, y omlaag)
  vec2 q = o * (WIN_H * 2. - .09);
  vec3 sky = mix(vec3(.022, .035, .095), vec3(.12, .13, .22), smoothstep(.0, 1.4, q.y));
  sky += vec3(.18, .11, .08) * smoothstep(.9, 1.45, q.y) * .55;         // stadsgloed laag aan de hemel
  vec3 c = sky;
  // achterste rij: kleiner en nevelig
  vec4 far = houses(q, .16, 1.24, 1.76, 11.);
  c = mix(c, mix(far.rgb, sky * 1.1 + vec3(.02, .02, .03), .45), far.a);
  // voorste rij aan de overkant van de gracht
  vec4 near = houses(q, .27, 1.36, 1.76, 3.);
  c = mix(c, near.rgb, near.a);
  // kade met sneeuw
  float quay = step(1.76, q.y) * step(q.y, 1.86);
  c = mix(c, vec3(.40, .45, .60) * (.85 + .2 * noise(q * vec2(40., 90.))), quay);
  // gracht: donker water met de spiegeling van de verlichte ramen
  if (q.y > 1.86) {
    // spiegeling: zacht en uitgerekt (drie monsters naast elkaar, rimpels die langzaam bewegen)
    float rip = (noise(vec2(q.x * 5., q.y * 45. - u_wt * .5)) - .5) * .04;
    float my = 1.74 - (q.y - 1.86) * .55;
    vec3 refl = vec3(0.);
    for (int k = -1; k <= 1; k++) {
      vec4 h = houses(vec2(q.x + rip + float(k) * .012, my), .27, 1.36, 1.76, 3.);
      refl += h.rgb * h.a / 3.;
    }
    float glint = .6 + .4 * noise(vec2(q.x * 20., q.y * 120. - u_wt * .8));
    c = vec3(.03, .04, .08) + refl * .4 * glint * smoothstep(2.3, 1.9, q.y);
  }
  // lantaarn op de kade
  vec2 lp = vec2(.28, 1.40);
  float pole = step(abs(q.x - lp.x), .006) * step(lp.y, q.y) * step(q.y, 1.80);
  c = mix(c, vec3(.03), pole);
  float lg = length((q - lp) * vec2(1., 1.2));
  c += vec3(1., .74, .42) * (smoothstep(.022, .008, lg) * .9 + exp(-lg * lg * 220.) * .35);
  // sneeuwnevel: de verte vervaagt een beetje
  c = mix(c, vec3(.20, .22, .32), .18 * smoothstep(.6, 1.7, q.y) * u_snow);
  // sneeuwvlokken: drie lagen, dezelfde snelheid en klok als op het doek
  for (int l = 0; l < 3; l++) {
    float fl = float(l), sc = 1. + fl * .8;
    vec2 S = q * .75;
    S.x -= u_wind * u_wt * .035 / sc + sin(u_wt * .45 + S.y * 5. + fl * 2.) * .012;
    S.y -= u_wt * (.075 / sqrt(sc));
    vec2 g = S / (.05 / sc), ce = floor(g), f = fract(g) - .5;
    float h = hash(ce + fl * 31. + 9.);
    if (h < .12 + .5 * u_snow) {
      vec2 off = (vec2(hash(ce + 1.3), hash(ce + 2.9)) - .5) * .5;
      off.x += sin(u_wt * (.6 + h) + h * 20.) * .12;
      float r = (.08 + .06 * hash(ce + 4.4)) * (1. - fl * .12);
      float a = smoothstep(r, r * .35, length((f - off) * vec2(1., 1.2)));
      float nearLamp = exp(-dot(q - lp, q - lp) * 30.);
      c = mix(c, vec3(.80, .84, .95) + vec3(.3, .15, 0.) * nearLamp, a * (.8 - fl * .2) * min(1., u_snow * 2.));
    }
  }
  return c;
}

void main() {
  float ar = u_res.x / u_res.y;
  vec2 w = u_cam.xy + (v_uv - .5) * vec2(ar, 1.) * u_cam.z;
  float aa = u_cam.z / u_res.y * 1.2;                // één beeldpunt in wereldmaat
  vec3 tvCol = (texture2D(u_paint, vec2(.3, .3)).rgb + texture2D(u_paint, vec2(.7, .3)).rgb
              + texture2D(u_paint, vec2(.5, .6)).rgb + texture2D(u_paint, vec2(.2, .8)).rgb) * .25;
  vec3 L = roomLight(w, tvCol);

  // --- muur: warm gestuct, met een zachte structuur ---
  float plaster = fbm(w * vec2(9., 7.)) - .5;
  vec3 c = vec3(.74, .66, .56) * (1. + plaster * .08) * L;
  // schaduw van het tv-frame op de muur (licht komt van links: schaduw naar rechts)
  float sh = smoothstep(.16, -.02, sdBox(w - vec2(.05, .05), TV + BEZEL));
  c *= 1. - .38 * sh;

  // --- plint en vloer ---
  float skirt = step(FLOOR - .1, w.y) * step(w.y, FLOOR);
  c = mix(c, vec3(.84, .80, .74) * L * (1. + .15 * smoothstep(FLOOR - .1, FLOOR - .095, w.y) * step(w.y, FLOOR - .09)), skirt);
  if (w.y > FLOOR) {
    // houten vloer in perspectief: planken lopen naar het verdwijnpunt
    float dz = (w.y - FLOOR) + .02, z = 1. / dz;
    float xw = (w.x - .5) * z * .22;
    float plank = fract(xw * 2.);
    float seam = smoothstep(.0, .04 * z * .2 + .02, plank) * smoothstep(1., .96, plank);
    vec3 wood = vec3(.50, .34, .21) * (.85 + .3 * hash(vec2(floor(xw * 2.), 3.))) * (.9 + .2 * noise(vec2(xw * 6., w.y * 40.)));
    vec3 fL = roomLight(vec2(w.x, FLOOR - .2 - (w.y - FLOOR) * .6), tvCol) * 1.3;
    c = wood * fL * mix(.55, 1., seam);
    // glans: de lamp spiegelt zacht in de vloer
    c += vec3(1., .7, .4) * .08 * exp(-pow((w.x - LAMP.x) * 2.5, 2.)) * smoothstep(FLOOR + .5, FLOOR, w.y);
    c *= smoothstep(FLOOR + 1.2, FLOOR, w.y) * .35 + .65;
  }

  // --- dressoir onder het scherm: walnoot, drie deuren, korte pootjes ---
  vec2 sbC = vec2(0., 1.36), sbH = vec2(1.36, .26);
  float sb = fill(sdBox(w - sbC, sbH), aa);
  if (sb > 0.) {
    vec3 wal = vec3(.26, .16, .10) * (.85 + .3 * noise(vec2(w.x * 3., w.y * 60.)));
    float seams = 1. - .5 * (smoothstep(aa * 2., 0., abs(w.x + .455)) + smoothstep(aa * 2., 0., abs(w.x - .455)));
    float topEdge = smoothstep(sbC.y - sbH.y + .03, sbC.y - sbH.y, w.y);
    vec3 sbc = wal * L * 1.25 * seams + vec3(1., .75, .5) * topEdge * .12 * L;
    // grepen
    float knob = fill(length(w - vec2(-.5, 1.3)) - .012, aa) + fill(length(w - vec2(.41, 1.3)) - .012, aa);
    sbc = mix(sbc, vec3(.75, .6, .35) * L * 1.6, knob);
    c = mix(c, sbc, sb);
  }
  float legs = fill(sdBox(w - vec2(-1.24, FLOOR - .09), vec2(.018, .09)), aa) + fill(sdBox(w - vec2(1.24, FLOOR - .09), vec2(.018, .09)), aa);
  c = mix(c, vec3(.12, .08, .05) * L, clamp(legs, 0., 1.) * step(w.y, FLOOR));

  // vaas met takjes en een stapeltje boeken op het dressoir
  vec2 vp = w - vec2(1.14, .93);
  float vase = fill(length(vp * vec2(1.25, 1.)) - .14 + smoothstep(-.02, -.16, vp.y) * .07, aa) * step(vp.y, .17);
  c = mix(c, vec3(.82, .78, .70) * L * (1.1 - .35 * smoothstep(-.1, .12, vp.x)), vase);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 tp = w - vec2(1.14 + fi * .05 - .05, .80);
    // gebogen takjes die uit de vaas waaieren, met een paar blaadjes
    float sp = (fi - 1.) * .55;
    float bx = tp.x + sp * tp.y + tp.y * tp.y * sp * .9;
    float len = -(.36 + .08 * fi);
    float twig = fill(abs(bx) - .0035, aa) * step(len, tp.y) * step(tp.y, 0.);
    for (int k = 0; k < 3; k++) {
      float yk = len * (.45 + .2 * float(k));
      vec2 lv = vec2(bx - (k == 1 ? -.02 : .02), tp.y - yk);
      twig = max(twig, fill(length(lv * vec2(1., 2.2)) - .016, aa));
    }
    c = mix(c, vec3(.17, .12, .08) * L * 1.2, twig);
  }
  float by = 1.08;
  float b1 = fill(sdBox(w - vec2(-.95, by - .025), vec2(.26, .025)), aa);
  float b2 = fill(sdBox(w - vec2(-.93, by - .07), vec2(.22, .02)), aa);
  float b3 = fill(sdBox(w - vec2(-.97, by - .105), vec2(.24, .015)), aa);
  c = mix(c, vec3(.42, .30, .22) * L, b1); c = mix(c, vec3(.55, .52, .45) * L, b2); c = mix(c, vec3(.25, .30, .33) * L, b3);

  // --- het tv-frame: dunne donkere lijst, het doek erin ---
  float bez = fill(sdBox(w, TV + BEZEL), aa);
  if (bez > 0.) {
    vec3 frameC = vec3(.045, .042, .040) + vec3(.05, .04, .03) * smoothstep(-.5 - BEZEL + .006, -.5 - BEZEL, w.y);
    frameC += L * .03;
    float scr = fill(sdBox(w, TV), aa * .5);
    vec2 suv = (w + TV) / (TV * 2.); suv.y = 1. - suv.y;   // render target: oorsprong linksonder
    vec3 pc = paint(suv, u_cam.z);
    // heel licht schijnsel van de lamp op het glas, links
    pc += vec3(1., .8, .6) * .025 * smoothstep(.4, -.9, w.x) * (1. - smoothstep(1., 1.5, u_cam.z) * 0.) * smoothstep(1.02, 1.3, u_cam.z);
    c = mix(c, mix(frameC, pc, scr), bez);
  }

  // --- raam met gordijnen ---
  vec2 wp = w - WIN_C;
  float reveal = fill(sdBox(wp, WIN_H + .07), aa);
  c = mix(c, vec3(.70, .64, .56) * L * .8, reveal);                        // diepte van de raamopening
  float glass = fill(sdBox(wp, WIN_H - .045), aa);
  if (glass > 0.) {
    vec2 o = (wp + WIN_H) / (WIN_H * 2.);
    vec3 oc = outside(o);
    // spiegeling van de kamer in het glas: warm schijnsel, heel zacht
    oc += vec3(1., .7, .4) * .05 * exp(-pow((o.x - .2) * 3., 2.)) + vec3(.03, .025, .02);
    // sneeuw tegen de onderkant van het glas
    oc = mix(oc, vec3(.6, .65, .78), smoothstep(.975, 1., o.y + (noise(vec2(o.x * 12., 1.)) - .5) * .02) * u_snow);
    c = mix(c, oc, glass);
  }
  // kozijn: roedes en een bovenlicht, gebroken wit
  float mull = fill(abs(wp.x) - .016, aa) + fill(abs(wp.y + .42) - .016, aa);
  float frameW = clamp(mull, 0., 1.) * glass + (reveal - glass) * (1. - fill(sdBox(wp, WIN_H + .02), aa) * 0.) * fill(sdBox(wp, WIN_H), aa);
  c = mix(c, vec3(.80, .78, .73) * (L * .9 + vec3(.03, .04, .06)), clamp(frameW, 0., 1.));
  // vensterbank
  float sill = fill(sdBox(w - vec2(WIN_C.x, WIN_C.y + WIN_H.y + .04), vec2(WIN_H.x + .14, .035)), aa);
  c = mix(c, vec3(.86, .83, .78) * L * 1.15, sill);
  // gordijnen: linnen, zachte plooien, van de roede tot op de vloer
  for (int s = 0; s < 2; s++) {
    float cx = s == 0 ? WIN_C.x - WIN_H.x - .12 : WIN_C.x + WIN_H.x + .12;
    float cw = .17;
    float dx = (w.x - cx) / cw;
    float cur = fill(abs(w.x - cx) - cw - .015 * sin(w.y * 3. + float(s)), aa) * step(-1.62, w.y) * step(w.y, FLOOR + .02);
    float folds = .78 + .22 * sin(dx * 9. + sin(w.y * 1.3 + float(s) * 2.) * .8 + float(s));
    vec3 cc = vec3(.90, .84, .75) * L * folds * 1.2;
    cc += vec3(.15, .2, .32) * .12 * smoothstep(.6, 1., s == 0 ? dx : -dx);   // raamkant koeler
    c = mix(c, cc, cur);
  }
  c = mix(c, vec3(.09, .07, .05) * L * 2., fill(sdBox(w - vec2(WIN_C.x, -1.64), vec2(.92, .012)), aa));  // roede

  // --- staande lamp: koperen voet en steel, linnen kap die zacht gloeit ---
  float stem = fill(abs(w.x - LAMP.x) - .011, aa) * step(LAMP.y + .2, w.y) * step(w.y, FLOOR + .05);
  c = mix(c, vec3(.60, .45, .26) * (L * .9 + .05), stem);
  float base = fill(length((w - vec2(LAMP.x, FLOOR + .06)) * vec2(1., 3.2)) - .16, aa);
  c = mix(c, vec3(.45, .34, .2) * L * 1.2, base);
  vec2 sp = w - LAMP;
  float halfW = mix(.19, .27, clamp((sp.y + .21) / .42, 0., 1.));
  float shade = fill(max(abs(sp.x) - halfW, abs(sp.y) - .21), aa);
  vec3 shadeC = mix(vec3(1., .84, .62) * 1.05, vec3(1., .93, .78) * 1.25, smoothstep(-.21, .21, sp.y));
  shadeC *= .9 + .1 * sin(sp.x / halfW * 6.);
  c = mix(c, shadeC, shade);

  // --- afwerking: zachte vignet, een snufje korrel, warme kleuring ---
  vec2 vv = v_uv - .5;
  c *= 1. - .55 * dot(vv, vv) * smoothstep(1., 2., u_cam.z);
  c = pow(max(c, 0.), vec3(.95));
  c += (hash(v_uv * u_res + fract(u_wt * .37) * 100.) - .5) * .012 * smoothstep(1., 2., u_cam.z);
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}
