#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float; // oudere tablets
#endif
varying vec2 v_uv;

uniform sampler2D u_tex;
uniform sampler2D u_maskA; // r=lucht g=sterren b=maan a=cipres
uniform sampler2D u_maskB; // r=dorp g=ramen b=heuvels
uniform sampler2D u_flow;  // rg=streekrichting b=duidelijkheid
uniform vec2 u_res, u_img;
uniform float u_debug;

// motion
uniform float u_mt, u_amp, u_grain, u_zoom;
uniform vec4 u_star[16];   // x, y, straal, ritme
uniform float u_starCount;
uniform vec3 u_moon;       // x, y, straal

// relight
uniform float u_day, u_night, u_lamps, u_sunDir, u_vig;
uniform vec3 u_sun;        // x, y, zichtbaarheid
uniform vec3 u_sunSrc;     // ster waarvan de zon zijn penseelstreken leent (x, y, straal)
uniform vec3 u_skyTop, u_skyHor, u_lightCol, u_shadowCol;
uniform float u_twilight, u_golden;
uniform vec3 u_glowCol;

// weather (0..1), weerklok u_wt, wind: + = naar rechts op het doek
uniform float u_wt, u_cloud, u_rain, u_snow, u_snowCover, u_fog, u_wind;

// maanfase: schijf (x, y, straal in hoogte-eenheden) en fase 0..1 (0 = nieuw, .5 = vol)
uniform vec3 u_moonDisk;
uniform float u_moonPhase;

// demo: 0 = gewoon. u_still 1 = de onbewerkte museumprint; u_contain 1 = het hele doek in beeld (op donker);
// u_pan = verschuiving omhoog/omlaag; u_wake = beweging alleen binnen straal z rond (x, y) (z <= 0: overal)
uniform float u_still, u_contain, u_pan, u_moonOrig;   // u_moonOrig 1 = de originele sikkel houden
uniform vec3 u_wake;

const vec3 LUM = vec3(0.299, 0.587, 0.114);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
vec3 softLight(vec3 b, vec3 s) { return mix(2. * b * s + b * b * (1. - 2. * s), sqrt(b) * (2. * s - 1.) + 2. * b * (1. - s), step(.5, s)); }
vec2 cover(vec2 uv) { float rs = u_res.x / u_res.y, ri = u_img.x / u_img.y;
  vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.);
  vec2 sc = rs > ri ? vec2(rs / ri, 1.) : vec2(1., ri / rs);   // contain: het hele doek
  s = mix(s, sc, u_contain);
  return (uv - .5) * s + .5 + vec2(0., u_pan); }

// zachte versie van een mask-kanaal (5 taps), zodat verplaatsingen geen randen scheuren
vec4 softA(vec2 p) { float e = .008;
  return (texture2D(u_maskA, p) * 2. + texture2D(u_maskA, p + vec2(e, 0)) + texture2D(u_maskA, p - vec2(e, 0))
        + texture2D(u_maskA, p + vec2(0, e)) + texture2D(u_maskA, p - vec2(0, e))) / 6.; }

void main() {
  vec2 uv = v_uv; float t = u_mt;          // bewegingsklok: staat stil als de slider op 0 staat
  float aspect = u_img.x / u_img.y;
  float z = .965 + .01 * u_zoom * sin(t * .07);
  vec2 p = cover((uv - .5) * z + .5);       // positie in het schilderij (0..1)

  vec4 mA0 = softA(p);
  float skyW = mA0.r, cypW = mA0.a;

  // ---------- MOTION ----------
  // demo: de beweging begint bij één wervel en verspreidt zich (u_wake); anders overal
  float wake = u_wake.z <= 0. ? 1. : 1. - smoothstep(u_wake.z - .3, u_wake.z, length((p - u_wake.xy) * vec2(aspect, 1.)));
  float amp = u_amp * wake;
  vec2 disp = vec2(0.);

  // cipres: wiegt langzaam (meer naar de top), met vlammende golfjes die omhoog lopen
  float height = smoothstep(1., .05, p.y);
  float sway = sin(t * .55 + p.y * 3.) * .006 + sin(t * .9 + p.y * 9.) * .002;
  float flame = (noise(vec2(p.x * 14., p.y * 7. + t * .7)) - .5) * .006;
  disp.x += (sway * height + flame * (.3 + height)) * cypW * amp;

  // sterren en maan: de krans "ademt" (schaal rond het middelpunt), elk in een eigen ritme
  // + per ster: hoe zichtbaar is hij nu? Elke ster heeft een eigen moment waarop hij
  //   verdwijnt (ochtend) of verschijnt (avond), zodat ze één voor één gaan.
  float halo = 0., presW = 0., presSum = 0.;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= u_starCount) break;
    vec4 s = u_star[i];
    vec2 d = (p - s.xy) * vec2(aspect, 1.);
    float r = s.z * aspect;
    float w = smoothstep(r, r * .3, length(d));
    float pulse = sin(t * (.9 + s.w * 1.1) + s.w * 6.283);
    float th = .1 + s.w * .45;
    float vis = 1. - smoothstep(th - .06, th + .06, u_day);
    disp -= (p - s.xy) * pulse * .035 * w * amp * vis;
    halo += w * pulse * vis;
    presW += w * vis; presSum += w;
  }
  if (u_moon.z > 0.) {
    vec2 d = (p - u_moon.xy) * vec2(aspect, 1.);
    float w = smoothstep(u_moon.z * aspect, u_moon.z * aspect * .3, length(d));
    float pulse = sin(t * .45 + 1.3);
    float vis = 1. - smoothstep(.5, .7, u_day);
    disp -= (p - u_moon.xy) * pulse * .02 * w * amp * vis;
    halo += w * pulse * .7 * vis;
    presW += w * vis; presSum += w;
  }
  float presence = presSum > .001 ? presW / presSum : 1. - u_day;

  // dorp en heuvels: (bijna) stil — alleen een heel klein beetje leven in het gras
  vec4 mB0 = texture2D(u_maskB, p);
  disp += (vec2(noise(p * 9. + t * .2), noise(p * 9. - t * .2)) - .5) * .0012 * mB0.b * amp;

  // lucht: wervels stromen mee met de penseelstreken (flow map, twee fasen die overvloeien)
  vec3 fl = texture2D(u_flow, p).rgb;
  vec2 dir = (fl.rg * 2. - 1.) * vec2(1. / aspect, 1.);
  float flowAmt = skyW * (.25 + .75 * fl.b) * amp * .014;
  float ph = t * .12 + noise(p * 3.) * .7;  // ruis in de fase voorkomt dat alles tegelijk "pompt"
  float ph0 = fract(ph), ph1 = fract(ph + .5);
  vec2 q = p + disp;
  vec3 c0 = texture2D(u_tex, q - dir * (ph0 - .5) * flowAmt).rgb;
  vec3 c1 = texture2D(u_tex, q - dir * (ph1 - .5) * flowAmt).rgb;
  vec3 c = mix(c0, c1, abs(1. - 2. * ph0));
  vec2 iuv = q;

  // zachte puls in de helderheid van de kransen
  c *= 1. + halo * .12 * amp;

  // ---------- RELIGHT ----------
  vec3 orig = c;

  // --- MAANFASE: de schijf opnieuw geschilderd met de streken van de krans; de krans zelf blijft ---
  if (u_moonDisk.z > 0.) {
    vec2 md = (iuv - u_moonDisk.xy) * vec2(aspect, 1.) / u_moonDisk.z;   // eenheidsschijf
    float ml = length(md);
    if (ml < 1.25) {
      float jag = (noise(md * 5. + 3.7) - .5) * .14;                     // rafelige penseelrand
      float diskK = smoothstep(1.1, .98, ml + jag * .6) * (1. - smoothstep(.2, .55, u_day)) * (1. - u_moonOrig); // overdag: geen donkere schijf
      // achter wolken of mist: de nieuwe schijf verdwijnt mee (zelfde wolkenvlekken als de lucht)
      vec2 cd0 = vec2(-u_wt * .004 * (.4 + abs(u_wind)) * sign(u_wind + .001), 0.);
      float mcn = noise(u_moonDisk.xy * vec2(2.4, 4.2) + cd0) * .65 + noise(u_moonDisk.xy * vec2(6., 9.) + cd0 * 1.7) * .35;
      diskK *= (1. - smoothstep(mcn - .22, mcn + .22, u_cloud) * .92) * (1. - u_fog * .85);
      float limb = smoothstep(1.04, .97, ml + jag * .5);                  // binnen de maanrand
      float sy = sqrt(max(0., 1. - md.y * md.y));
      float mph = u_moonPhase;
      // terminator: wassend licht rechts, afnemend licht links (noordelijk halfrond)
      float lit = mph < .5 ? smoothstep(-.07, .07, md.x + jag - sy * .9 * cos(6.2832 * mph))
                           : smoothstep(.07, -.07, md.x + jag - sy * .9 * cos(6.2832 * (mph - .5)));
      lit *= limb;
      // penseelstreken: de schijf leent de ronddraaiende streken van de krans (polaire afbeelding)
      float ang = atan(md.y, md.x) + 1.3;
      vec2 rp = u_moonDisk.xy + vec2(cos(ang), sin(ang)) * (1.35 + ml * .55) * u_moonDisk.z / vec2(aspect, 1.);
      vec3 ring = texture2D(u_tex, rp).rgb;
      float Ls = dot(ring, LUM);
      // licht deel: goudgeel, warmer naar binnen, lichter naar de rand
      vec3 litC = mix(vec3(.96, .64, .10), vec3(1., .88, .40), smoothstep(.4, .8, Ls)) * (.9 + .5 * (Ls - .55));
      litC += (ring - vec3(Ls)) * .25;
      litC = mix(litC, vec3(1., .95, .66), smoothstep(.6, 1., ml) * .22);
      // donker deel: diep nachtblauw met een vleugje aardschijn
      vec3 darkC = vec3(.12, .19, .38) * (.6 + Ls * .9) + (ring - vec3(Ls)) * .3 + vec3(.04, .05, .03);
      orig = clamp(mix(orig, mix(darkC, litC, lit), diskK), 0., 1.);  // >1 geeft NaN in pow() verderop
      c = orig;
    }
  }

  vec4 mA = texture2D(u_maskA, iuv), mB = texture2D(u_maskB, iuv);
  float sky = mA.r, starM = mA.g, moonM = mA.b, cyp = mA.a;
  float vil = mB.r, win = mB.g, hil = mB.b;
  float day = u_day, nightK = 1. - u_day;

  // lokale gemiddelde helderheid (ring van 8 monsters): textuur = verschil met dat gemiddelde
  float L = dot(orig, LUM), Lm = L * .2;
  vec3 Cm = orig * .2;                       // lokale gemiddelde kleur (voor mist: zachtere streken)
  float winGlow = 0.;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * .785398; vec2 o = vec2(cos(a), sin(a) * aspect);
    vec3 ring = texture2D(u_tex, iuv + o * .012).rgb;
    Lm += dot(ring, LUM) * .1; Cm += ring * .1;
    winGlow += texture2D(u_maskB, iuv + o * .006).g + texture2D(u_maskB, iuv + o * .016).g * .6;
  }
  winGlow /= 12.8;
  float detail = L - Lm;
  float sat = max(orig.r, max(orig.g, orig.b)) - min(orig.r, min(orig.g, orig.b));

  // --- LUCHT: nachtblauw ↔ daglucht; kleur verschuift, de penseelstreken blijven ---
  vec3 skyNight = orig * vec3(.80, .86, 1.04) * .86;
  vec3 grad = mix(u_skyTop, u_skyHor, smoothstep(.05, .72, iuv.y));
  vec3 skyDay = grad * (.86 + .6 * (Lm - .42)) + detail * 1.1;
  float pale = smoothstep(.5, .85, L) * (1. - sat * .8);              // witte/lichte streken → roomwit
  skyDay = mix(skyDay, vec3(.99, .97, .9), pale * .5);
  skyDay += (orig - vec3(L)) * .3;                                     // een beetje van Van Goghs kleurnuances
  vec3 skyC = mix(skyNight, skyDay, day);

  // zonsopkomst/-ondergang: roze/oranje verloop over de horizon, het sterkst aan de kant van de zon
  float horizonK = smoothstep(.12, .68, iuv.y);
  float sunSide = .5 + .5 * exp(-pow((iuv.x - u_sun.x) * 2.2, 2.));
  float tw = u_twilight * horizonK * sunSide;
  vec3 glowSky = (Lm * .7 + .38 + detail * .9) * u_glowCol;
  skyC = mix(skyC, glowSky, tw * .75);
  // hoger in de lucht een paarsige zweem tijdens de schemering
  skyC = mix(skyC, skyC * vec3(1.08, .92, 1.06), u_twilight * (1. - horizonK) * .5);

  // WEATHER (bewolking): trage wolkenvlakken die met de wind meedrijven; ze verbergen sterren en zon deels
  vec2 cdrift = vec2(-u_wt * .004 * (.4 + abs(u_wind)) * sign(u_wind + .001), 0.);
  float cn = noise(iuv * vec2(2.4, 4.2) + cdrift) * .65 + noise(iuv * vec2(6., 9.) + cdrift * 1.7) * .35;
  float cov = smoothstep(cn - .22, cn + .22, u_cloud);
  float hide = clamp(1. - cov * .92, 0., 1.) * (1. - u_fog * .85);
  presence *= hide;

  // sterren en maan: zichtbaar (gloeiend) of opgegaan in de lucht, per ster op zijn eigen moment
  float sm = clamp(starM + moonM, 0., 1.);
  vec3 skyNeutral = grad * (.92 + .2 * (Lm - .42)) + detail * .4;
  vec3 nightNeutral = vec3(.10, .17, .40) * (.75 + Lm * .7) + detail * .5;
  vec3 starless = mix(nightNeutral, skyNeutral, day);
  starless = mix(starless, glowSky, tw * .6);
  vec3 starlit = skyC + orig * nightK * .18;
  skyC = mix(skyC, mix(starless, starlit, presence), sm);

  // bewolkte lucht: grijzer en vlakker, de penseelstreken blijven zwak zichtbaar
  float covK = clamp(u_cloud * (.35 + .65 * cov), 0., 1.);
  vec3 cloudDay = mix(u_skyHor, u_skyTop, .4) * (.9 + .5 * (Lm - .42)) + detail * .55;
  vec3 cloudNight = vec3(.075, .09, .135) * (.8 + Lm * .9) + detail * .3;
  vec3 cloudC = mix(cloudNight, cloudDay, day);
  cloudC = mix(cloudC, glowSky * .85, tw * .4);
  skyC = mix(skyC, cloudC, covK * .88);

  // --- LANDSCHAP: helder daglicht met warme schaduwkant; 's nachts donker en koel ---
  // licht/schaduw: lichte streken vangen zonlicht, donkere streken liggen in (warme) schaduw
  float litK = smoothstep(.12, .5, L);
  vec3 sunLight = mix(u_shadowCol, u_lightCol, litK);
  // cipres: de kant naar de zon krijgt meer licht
  float e = .012;
  float side = clamp(.5 + (texture2D(u_maskA, iuv - vec2(u_sunDir * e, 0.)).a - texture2D(u_maskA, iuv + vec2(u_sunDir * e, 0.)).a) * 2.5, 0., 1.);

  vec3 hDay = vec3(orig.r + orig.b * .10, orig.g + orig.b * .28, orig.b * .82);  // blauw → groenblauw
  hDay = 1. - pow(1. - clamp(hDay, 0., 1.), vec3(2.3));
  float far = 1. - smoothstep(.6, .8, iuv.y);                            // verre bergen blijven blauwer
  hDay = mix(hDay, 1. - pow(1. - orig, vec3(2.4)), far * .4) * sunLight;

  // dorp: muren worden licht en warm, daken krijgen hun kleur terug
  vec3 vDay = 1. - pow(1. - orig, vec3(3.2));
  vDay = mix(vDay, vec3(dot(vDay, LUM)) * vec3(1.08, 1., .86), .35) * sunLight;

  vec3 cDay = orig * vec3(1.3, 1.5, 1.0) * 1.6 + vec3(.02, .04, 0.);
  cDay *= mix(u_shadowCol * .85, u_lightCol * 1.15, side) * mix(.85, 1.1, litK);

  vec3 landNight = orig * vec3(.52, .58, .80) * .78;
  vec3 hC = mix(landNight, hDay, day), vC = mix(landNight, vDay, day), cC = mix(landNight * .9, cDay, day);

  // --- samenvoegen per element ---
  float wsum = sky + cyp + vil + hil + 1e-4;
  c = (skyC * sky + cC * cyp + vC * vil + hC * hil) / wsum;
  c = mix(c, orig * mix(.6, 1.1, day), smoothstep(.1, 0., wsum));     // plekken zonder mask

  // --- GOUDEN UUR: warm strijklicht op cipres en daken ---
  if (u_golden > .001) {
    vec2 sdv = vec2(u_sunDir * .022, 0.);
    float rim = cyp * (1. - texture2D(u_maskA, iuv + sdv).a);               // cipresrand aan de zonkant
    float rimV = vil * (1. - texture2D(u_maskB, iuv + sdv * .4 - vec2(0., .006)).r); // daken/randen in het dorp
    float landK = 1. - sky;
    c = mix(c, c * vec3(1.24, 1.0, .70), u_golden * landK * .55);           // alles warmer
    c += vec3(1., .55, .18) * rim * u_golden * (.25 + .6 * litK);
    c += vec3(1., .62, .30) * vil * litK * u_golden * .22;
    c += vec3(1., .58, .25) * rimV * u_golden * .3;
  }

  // ---------- WEATHER (land) ----------
  float land = 1. - sky;
  // bewolkt: diffuus licht (minder kleur, iets donkerder); regen: nat en donkerder
  c = mix(c, vec3(dot(c, LUM)), .28 * u_cloud * land);
  c *= 1. - (.1 * u_cloud * day + .14 * u_rain) * land;

  // sneeuwdek: eerst op de bovenranden van daken en heuvels, daarna steeds meer
  if (u_snowCover > .001) {
    float vilUp = texture2D(u_maskB, iuv - vec2(0., .012)).r;
    float hilUp = texture2D(u_maskB, iuv - vec2(0., .02)).b;
    float cypUp = texture2D(u_maskA, iuv - vec2(0., .01)).a;
    float topV = vil * (1. - vilUp), topH = hil * (1. - hilUp), topC = cyp * (1. - cypUp);
    float base = hil * .55 + vil * .22 + cyp * .06 + topV * 1.1 + topH * .5 + topC * .35 + litK * .15 * land;
    float sn = noise(iuv * vec2(70., 110.)) * .55 + noise(iuv * vec2(15., 24.)) * .45;
    float sAmt = smoothstep(.36, .58, base * u_snowCover * 1.6 + sn * .5 - .25) * land * (1. - win);
    vec3 snowN = vec3(.52, .59, .80) * (.64 + L * .8) + detail * .8;   // maanlicht op sneeuw
    vec3 snowD = vec3(.92, .94, .98) * (.9 + detail * 1.2);
    vec3 snowC = mix(snowN, snowD, day);
    snowC = mix(snowC, snowC * vec3(1.15, .92, .78), u_golden * .5 + tw * .3);
    snowC += vec3(1., .68, .34) * winGlow * u_lamps * .5;
    c = mix(c, snowC, sAmt * (.62 + .26 * sn));
  }

  // mist: dorp en heuvels verzachten (streken vervagen) en lossen op naar de horizon
  float depth = smoothstep(.98, .5, iuv.y) * (1. - cyp * .5);
  if (u_fog > .001) {
    vec3 blurC = c - (orig - Cm) * (.55 + .35 * day);
    c = mix(c, blurC, u_fog * (.4 + .5 * land));
    vec3 fogCol = mix(vec3(.2, .22, .29), vec3(.77, .78, .80), day);
    fogCol = mix(fogCol, u_glowCol * .7 + .22, tw * .3);
    float fk = u_fog * (land * (.2 + .72 * depth) + sky * .6);
    c = mix(c, fogCol * (.93 + .25 * (Lm - .42)), fk);
  }

  // --- RAMEN: licht aan in avond en nacht, met zachte gloed; overdag uit ---
  float flick = 1. + (noise(vec2(t * 1.3, iuv.x * 50.)) - .5) * .12 * u_amp;
  c = mix(c, vec3(1., .80, .40) * 1.25 * flick, win * u_lamps * (1. - u_fog * depth * .45));
  c += vec3(1., .66, .30) * winGlow * u_lamps * (.35 + .4 * nightK) * (1. + u_fog * 1.2);
  c = mix(c, c * vec3(.42, .45, .55), win * (1. - u_lamps));

  // --- ZON in Van Gogh-stijl: de penseelstreken van de grootste ster, warm ingekleurd ---
  if (u_sun.z > .001) {
    vec2 sd = (iuv - u_sun.xy) * vec2(aspect, 1.);
    float sr = .085, len = length(sd);
    float scn = noise(u_sun.xy * vec2(2.4, 4.2) + cdrift) * .65 + noise(u_sun.xy * vec2(6., 9.) + cdrift * 1.7) * .35;
    float sunHide = 1. - smoothstep(scn - .22, scn + .22, u_cloud) * .88;
    float vis = u_sun.z * sky * sunHide * (1. - u_fog * .7);
    if (len < sr * 2.5 && vis > .001) {
      float ang = t * .05; mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
      vec3 sc;
      if (u_sunSrc.z > 0.) {
        vec2 src = u_sunSrc.xy + (rot * sd) / sr * vec2(u_sunSrc.z, u_sunSrc.z * aspect);
        sc = texture2D(u_tex, src).rgb;
      } else {
        float rings = .5 + .5 * sin(len / sr * 40. + noise(sd * 30.) * 4.);
        sc = vec3(.6 + .4 * rings);
      }
      float sl = dot(sc, LUM);
      vec3 sunC = mix(vec3(1., .66, .16), vec3(1., .98, .84), smoothstep(.5, .85, sl)) * (.55 + .7 * sl);
      sunC *= mix(vec3(1.), vec3(1., .6, .36), clamp(u_twilight * .9 + u_golden * .35, 0., 1.)); // roder bij de horizon
      c = mix(c, sunC, smoothstep(sr, sr * .8, len) * vis);
      c += vec3(1., .88, .6) * exp(-len / sr * 1.8) * .22 * vis;
    }
  }

  // --- twinkelende sterretjes in de donkerste nacht; ze komen één voor één ---
  if (u_night > .01) {
    vec2 sg = iuv * vec2(aspect, 1.) * 80.; vec2 cell = floor(sg); float h = hash(cell);
    if (h > .982) {
      vec2 f = fract(sg) - .5 - (vec2(hash(cell + 1.7), hash(cell + 3.1)) - .5) * .6;
      float twk = mix(.8, .45 + .55 * sin(t * (.8 + h * 2.5) + h * 40.), u_amp);
      float own = hash(cell + 7.3);                                     // eigen moment van verschijnen
      float on = smoothstep(own * .8, own * .8 + .15, u_night);
      float s = smoothstep(.13, 0., length(f)) * twk;
      float dark = 1. - smoothstep(.08, .32, dot(c, LUM));
      c += vec3(.9, .95, 1.) * s * on * sky * dark * 1.1 * (1. - covK) * (1. - u_fog);
    }
  }

  // ---------- WEATHER (neerslag): geschilderde streken en vlokken voor alles ----------
  vec2 P = iuv * vec2(aspect, 1.);
  // regen: korte, schuine streken (de wind bepaalt de schuinte); motregen dun en schaars, een bui dicht
  if (u_rain > .001) {
    vec2 vel = normalize(vec2(u_wind * .6 + .1, 1.));
    vec2 Q = vec2(vel.y * P.x - vel.x * P.y, vel.x * P.x + vel.y * P.y);
    for (int l = 0; l < 2; l++) {
      float fl2 = float(l), sc = 1. + fl2 * .7;
      vec2 cs = vec2(.016, .085) / sc;
      vec2 g = Q / cs;
      g.y -= u_wt * (1.5 + fl2 * .4) / cs.y + hash(vec2(floor(g.x), fl2)) * 9.;
      vec2 cell = floor(g), f = fract(g);
      float h = hash(cell + fl2 * 17.);
      if (h < .12 + .6 * u_rain) {
        float len = .3 + .45 * u_rain, cy = hash(cell + 5.7) * (1. - len);
        float along = (f.y - cy) / len;
        float dx = abs(f.x - .2 - .6 * hash(cell + 3.1)) * cs.x;
        float w = (.0012 + .0016 * u_rain) / sc;
        float a = smoothstep(w, w * .25, dx) * smoothstep(0., .2, along) * smoothstep(1., .55, along);
        a *= .55 + .45 * noise(vec2(along * 6., cell.x * 3.1));        // penseeltextuur
        // overdag blauwgrijze streken (contrast met de grijze lucht), 's nachts lichter
        vec3 rc = mix(vec3(.52, .60, .76), vec3(.34, .41, .54), day) * (.85 + .3 * h);
        rc = mix(rc, vec3(.92, .94, .98), .25 * day * step(.5, hash(cell + 8.8)));
        c = mix(c, rc, a * (.3 + .45 * u_rain) * (1. - fl2 * .3));
      }
    }
  }
  // sneeuw: dwarrelende vlokken in drie lagen (dichtbij groter en sneller)
  if (u_snow > .001) {
    for (int l = 0; l < 3; l++) {
      float fl3 = float(l), sc = 1. + fl3 * .8;
      vec2 S = P;
      S.x -= u_wind * u_wt * .035 / sc + sin(u_wt * .45 + P.y * 5. + fl3 * 2.) * .012;
      S.y -= u_wt * (.075 / sqrt(sc));
      vec2 g = S / (.055 / sc), cell = floor(g), f = fract(g) - .5;
      float h = hash(cell + fl3 * 31.);
      if (h < .12 + .5 * u_snow) {
        vec2 o = (vec2(hash(cell + 1.3), hash(cell + 2.9)) - .5) * .5;
        o.x += sin(u_wt * (.6 + h) + h * 20.) * .12;
        vec2 d = f - o;
        float r = (.075 + .06 * hash(cell + 4.4)) * (1. - fl3 * .12);
        float irr = noise(d * 14. + cell * 1.7) * .4;
        float dl = length(d * vec2(1., 1.2)) * (1. + irr);
        float a = smoothstep(r, r * .35, dl);
        // overdag een zacht blauwgrijs randje, zodat witte vlokken ook tegen een lichte lucht leesbaar zijn
        float rim = smoothstep(r * 1.5, r * .9, dl) - a;
        c = mix(c, c * vec3(.72, .76, .86), max(rim, 0.) * .55 * day * min(1., u_snow * 2.) * (1. - fl3 * .25));
        vec3 fc = mix(vec3(.70, .76, .90), vec3(.97, .97, 1.), day) * (.85 + .2 * h) + vec3(1., .7, .4) * u_lamps * .06;
        c = mix(c, fc, a * (.8 - fl3 * .18) * min(1., u_snow * 2.));
      }
    }
  }
  vec2 vv = uv - .5; c *= 1. - u_vig * dot(vv, vv) * 2.2;
  c += (hash(uv * u_res + fract(t * .37) * 100.) - .5) * u_grain;

  // demo: de onbewerkte print (geen beweging, gloed of korrel) en het doek op een donkere museumwand
  if (u_still > 0.) c = mix(c, texture2D(u_tex, p).rgb, u_still);
  if (u_contain > 0.) {
    vec2 ed = min(p, 1. - p);
    float inside = smoothstep(-.0015, .0015, min(ed.x, ed.y));
    float shadow = smoothstep(.0, -.03, min(ed.x, ed.y));
    c = mix(vec3(.028, .025, .022) * (1. - .5 * (1. - shadow)), c, inside);
  }

  // debug-weergave (toets M): masks in kleur over het schilderij
  if (u_debug > .5) {
    vec3 o = texture2D(u_tex, iuv).rgb * .45;
    o = mix(o, vec3(.55, .35, .15), mB.b * .6);  // heuvels
    o = mix(o, vec3(.25, .75, 1.), mA.r * .6);   // lucht
    o = mix(o, vec3(1., .2, .2), mB.r * .6);     // dorp
    o = mix(o, vec3(.1, 1., .3), mA.a * .6);     // cipres
    o = mix(o, vec3(1., .55, 0.), mA.b * .7);    // maan
    o = mix(o, vec3(1., .95, 0.), mA.g * .7);    // sterren
    o = mix(o, vec3(1., 0., 1.), mB.g * .9);     // ramen
    c = o;
  }
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}
