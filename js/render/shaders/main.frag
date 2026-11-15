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

// verfreliëf: rg = normal x,y (b = hoogte); licht = (sterkte, x, y, hoogte van de bron in graden)
uniform sampler2D u_relief;
uniform vec4 u_reliefSun, u_reliefMoon;

// demo: 0 = gewoon. u_still 1 = de onbewerkte museumprint; u_contain 1 = het hele doek in beeld (op donker);
// u_pan = verschuiving omhoog/omlaag; u_wake = beweging alleen binnen straal z rond (x, y) (z <= 0: overal)
uniform float u_panX;                                  // horizontale uitsnede (telefoon in portret)
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
  return (uv - .5) * s + .5 + vec2(u_panX * (1. - s.x) * .5, u_pan); }   // u_panX: -1 = linkerrand, 1 = rechterrand

// WEATHER: wolken en mist als wervelende streken. Ruis wordt langs het flow field uitgesmeerd
// (8 stappen langs de streekrichting), zodat ze dezelfde wervels volgen als Van Goghs lucht;
// de ruis drijft met de wind mee. Geeft 0..1 (licht/donker van de streek).
vec2 cloudDrift() { return vec2(-u_wt * .004 * (.4 + abs(u_wind)) * sign(u_wind + .001), u_wt * .0006); }
float swirl(vec2 q, float aspect) {
  vec2 dr = cloudDrift() * 9.;
  vec2 f0 = texture2D(u_flow, q).rg * 2. - 1.; f0 = f0 / (length(f0) + 1e-4);
  float s = noise(q * vec2(aspect, 1.) * 30. + dr) * .7 + noise(q * vec2(aspect, 1.) * 70. + dr * 1.3) * .3;
  // symmetrisch: 4 stappen vooruit en 4 terug, zodat de (tekenloze) streekrichting geen naden geeft
  for (int k = 0; k < 2; k++) {
    vec2 x = q, prev = k == 0 ? f0 : -f0;
    for (int i = 0; i < 4; i++) {
      vec2 f = texture2D(u_flow, x).rg * 2. - 1.;
      f = f / (length(f) + 1e-4); f *= sign(dot(f, prev) + 1e-4); prev = f;
      x += f * vec2(1. / aspect, 1.) * .007;
      s += noise(x * vec2(aspect, 1.) * 30. + dr) * .7 + noise(x * vec2(aspect, 1.) * 70. + dr * 1.3) * .3;
    }
  }
  return smoothstep(0., 1., (s / 9. - .5) * 2.2 + .5);
}
// grove wolkendekking: waar de wolken open zijn drijven gaten voorbij (sterren, maan en zon schijnen erdoor)
float cloudCov(vec2 q, float streak) {
  vec2 d = cloudDrift();
  float cn = noise(q * vec2(2.4, 4.2) + d) * .65 + noise(q * vec2(6., 9.) + d * 1.7) * .35;
  return smoothstep(cn - .22, cn + .22, u_cloud + (streak - .5) * .3 * smoothstep(.1, .5, u_cloud));
}

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
      diskK *= (1. - cloudCov(u_moonDisk.xy, .5) * .92) * (1. - u_fog * .75);
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

  // WEATHER (bewolking): wervelende streken die met de wind meedrijven; ze verbergen sterren en zon deels,
  // maar door de gaten en dunne plekken schijnen ze af en toe door
  float streak = u_cloud + u_fog > .01 ? swirl(iuv, aspect) : .5;
  // in de sterkransen draait het flow field rond: daar de streken zachter, anders ontstaan harde vlekken
  streak = mix(streak, .5 + (streak - .5) * .25, clamp((mA0.g + mA0.b) * 1.6, 0., 1.));
  float cov = cloudCov(iuv, streak);
  float hide = clamp(1. - cov * .92, 0., 1.) * (1. - u_fog * (.55 + .4 * streak));
  presence *= hide;

  // sterren en maan: zichtbaar (gloeiend) of opgegaan in de lucht, per ster op zijn eigen moment
  float sm = clamp(starM + moonM, 0., 1.);
  vec3 skyNeutral = grad * (.92 + .2 * (Lm - .42)) + detail * .4;
  vec3 nightNeutral = vec3(.10, .17, .40) * (.75 + Lm * .7) + detail * .5;
  vec3 starless = mix(nightNeutral, skyNeutral, day);
  starless = mix(starless, glowSky, tw * .6);
  vec3 starlit = skyC + orig * nightK * .18;
  skyC = mix(skyC, mix(starless, starlit, presence), sm);

  // bewolkte lucht: geschilderde wolkenstreken (licht en donker) die de wervels volgen; de verf eronder blijft licht zichtbaar
  float covK = clamp(u_cloud * (.35 + .65 * cov), 0., 1.);
  float st2 = streak - .5;
  vec3 cloudDay = mix(u_skyHor, u_skyTop, .4) * (.9 + .5 * (Lm - .42)) + detail * .35;
  vec3 cloudDark = mix(cloudDay, vec3(dot(cloudDay, LUM)), .3 + .4 * u_cloud) * vec3(.80, .83, .88);   // leigrijs, geen blauwe lucht
  cloudDay = mix(cloudDark, mix(cloudDay, vec3(.95, .95, .96), .45), smoothstep(-.35, .35, st2));
  vec3 cloudNight = vec3(.075, .09, .135) * (.8 + Lm * .9) + detail * .25;
  cloudNight = mix(cloudNight * .72, cloudNight * 1.6 + vec3(.02, .025, .04), smoothstep(-.35, .35, st2));
  // maanlicht langs de wolkenstreken: een zilveren rand dicht bij de maan
  if (u_moon.z > 0.) {
    float md2 = length((iuv - u_moon.xy) * vec2(aspect, 1.));
    cloudNight += vec3(.30, .32, .36) * exp(-md2 * 5.) * (.5 - .5 * cos(6.2832 * u_moonPhase)) * smoothstep(0., .4, st2);
  }
  vec3 cloudC = mix(cloudNight, cloudDay, day);
  cloudC = mix(cloudC, glowSky * (.75 + .3 * st2), tw * .4);
  skyC = mix(skyC, clamp(cloudC, 0., 1.), covK * (.8 + .18 * streak));

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

  // ---------- RELIEF: zon of maan strijkt over de verfribbels ----------
  // shade = dot(N, L) - L.z: een vlak stuk blijft gelijk, alleen de ribbels krijgen licht en schaduw
  float kSun = u_reliefSun.x * (1. - u_fog * .8), kMoon = u_reliefMoon.x * (1. - u_fog * .8) * (1. - u_cloud * .75);
  if (kSun + kMoon > .001) {
    vec2 rn = texture2D(u_relief, iuv).rg * 2. - 1.;
    vec3 N = vec3(rn, sqrt(max(.05, 1. - dot(rn, rn))));
    float ws = mix(1., .55, sky);                                   // lucht iets zachter dan land
    if (kSun > .001) {
      vec2 d = (u_reliefSun.yz - iuv) * vec2(aspect, 1.);
      float el = radians(clamp(u_reliefSun.w, 4., 75.));
      vec3 Ls = normalize(vec3(d / (length(d) + 1e-4) * cos(el), sin(el)));
      float sh = dot(N, Ls) - Ls.z;
      float spec = pow(clamp(dot(reflect(-Ls, N), vec3(0., 0., 1.)), 0., 1.), 24.); // natte glans op de lichtkant
      c = clamp(c, 0., 1.);
      c *= 1. + clamp(sh, -.5, .5) * kSun * .75 * ws;
      c += u_lightCol * spec * kSun * .06 * ws;
    }
    if (kMoon > .001) {
      vec2 d = (u_reliefMoon.yz - iuv) * vec2(aspect, 1.);
      float el = radians(u_reliefMoon.w);
      vec3 Lm3 = normalize(vec3(d / (length(d) + 1e-4) * cos(el), sin(el)));
      float sh = dot(N, Lm3) - Lm3.z;
      c *= 1. + clamp(sh, -.5, .5) * kMoon * .8 * ws;
      c += vec3(.55, .65, .9) * max(sh, 0.) * kMoon * .06 * ws;    // koel maanlicht op de lichtkant
    }
    c = clamp(c, 0., 1.);
  }

  // ---------- WEATHER (land) ----------
  float land = 1. - sky;
  // bewolkt: diffuus licht (minder kleur, iets donkerder); regen: nat en donkerder
  c = mix(c, vec3(dot(c, LUM)), .28 * u_cloud * land);
  c *= 1. - (.1 * u_cloud * day + .14 * u_rain) * land;

  // natte daken en straten: glans op de verfribbels (normal map van het verfreliëf);
  // overdag koel licht uit de lucht, 's avonds en 's nachts warm lamplicht bij de ramen
  if (u_rain > .001) {
    vec2 rnw = texture2D(u_relief, iuv).rg * 2. - 1.;
    vec3 Nw = vec3(rnw, sqrt(max(.05, 1. - dot(rnw, rnw))));
    vec3 Lw = normalize(vec3(0., -.55, .83));                              // licht van boven (y loopt omlaag)
    float gl = pow(clamp(dot(reflect(-Lw, Nw), vec3(0., 0., 1.)), 0., 1.), 18.);
    float ridge = clamp((dot(Nw, Lw) - Lw.z) * 3., 0., 1.);
    float wet = u_rain * (vil * .9 + hil * .22 + cyp * .12) * (1. - win);
    c = clamp(c, 0., 1.);
    c += mix(vec3(.26, .32, .46), vec3(.78, .83, .90), day) * (gl * .4 + ridge * .14) * wet;
    c += vec3(1., .66, .32) * min(winGlow * 1.6, 1.) * u_lamps * wet * (gl * 2.4 + ridge * 1.1 + .2);
    c = clamp(c, 0., 1.);
  }

  // sneeuwdek als impasto: eerst op de bovenranden van daken, heuvels en cipres, daarna steeds meer.
  // De sneeuw ligt er als dikke, met het mes gestreken klodders verf: eigen hoogte → eigen normal,
  // samen met het verfreliëf belicht vanuit de zon (overdag) of de maan ('s nachts).
  if (u_snowCover > .001) {
    float vilUp = texture2D(u_maskB, iuv - vec2(0., .012)).r;
    float hilUp = texture2D(u_maskB, iuv - vec2(0., .02)).b;
    float cypUp = texture2D(u_maskA, iuv - vec2(0., .01)).a;
    float topV = vil * (1. - vilUp), topH = hil * (1. - hilUp), topC = cyp * (1. - cypUp);
    float base = hil * .55 + vil * .22 + cyp * (.1 + .22 * litK) + topV * 1.1 + topH * .5 + topC * .55 + litK * .15 * land;
    float sn = noise(iuv * vec2(70., 110.)) * .55 + noise(iuv * vec2(15., 24.)) * .45;
    float sAmt = smoothstep(.36, .58, base * u_snowCover * 1.6 + sn * .5 - .25) * land * (1. - win);
    if (sAmt > .002) {
      // hoogte van de klodders: breed en licht schuin gestreken, met korrel; gradiënt in drie monsters
      vec2 sq = iuv * vec2(aspect, 1.);
      vec2 sa = vec2(sq.x * 22. + sq.y * 7., sq.y * 46.);
      float e2 = .3;
      float h0 = noise(sa) * .65 + noise(sa * 2.3 + 7.1) * .35;
      float hx = noise(sa + vec2(e2, 0.)) * .65 + noise((sa + vec2(e2, 0.)) * 2.3 + 7.1) * .35;
      float hy = noise(sa + vec2(0., e2)) * .65 + noise((sa + vec2(0., e2)) * 2.3 + 7.1) * .35;
      float thick = sAmt * (.55 + .45 * u_snowCover);                  // dikkere sneeuw = meer reliëf
      vec2 gs = vec2(hx - h0, hy - h0) / e2 * vec2(22., 46.) * .009 * thick;
      vec2 rns = texture2D(u_relief, iuv).rg * 2. - 1.;
      vec3 Ns = normalize(vec3(rns * .35 - gs, 1.));
      // licht: zon overdag, maan 's nachts (zelfde richting als het strijklicht)
      vec2 lp = mix(u_reliefMoon.yz, u_reliefSun.yz, day);
      float lel = radians(mix(30., clamp(u_reliefSun.w, 12., 60.), day));
      vec2 ld = (lp - iuv) * vec2(aspect, 1.); ld = ld / (length(ld) + 1e-4);
      vec3 Ls2 = normalize(vec3(ld * cos(lel), sin(lel)));
      float shs = clamp(dot(Ns, Ls2) - Ls2.z, -.6, .6);
      float spec2 = pow(clamp(dot(reflect(-Ls2, Ns), vec3(0., 0., 1.)), 0., 1.), 30.);
      float illum = .5 - .5 * cos(6.2832 * u_moonPhase);
      // kleur: overdag wit met blauwe schaduwkant, 's nachts koel maanlicht (sterker bij volle maan)
      vec3 snowN = vec3(.50, .58, .82) * (.58 + L * .55 + illum * .3) + detail * .6;
      vec3 snowD = vec3(.93, .94, .97) * (.94 + detail * .45);
      vec3 snowC = mix(snowN, snowD, day);
      snowC = mix(snowC, snowC * vec3(1.15, .92, .78), u_golden * .5 + tw * .3);
      float soft = mix(.75, .85, day) * (1. - u_fog * .6);               // bij mist vlakker licht
      snowC = clamp(snowC, 0., 1.);
      snowC *= 1. + shs * .6 * soft;
      snowC = mix(snowC, snowC * vec3(.76, .84, 1.02), clamp(-shs * 1.4, 0., 1.) * soft);   // blauwe schaduwkant
      snowC += mix(vec3(.55, .65, .95) * illum * .5, vec3(1., .98, .92), day) * spec2 * .25 * soft;
      // warm lamplicht rond de ramen, vooral op de kant die naar het licht kijkt
      snowC += vec3(1., .66, .32) * min(winGlow * 1.5, 1.) * u_lamps * (.45 + max(shs, 0.) * 1.2);
      c = mix(c, clamp(snowC, 0., 1.), sAmt * (.72 + .28 * h0));
    }
  }

  // mist: dorp en heuvels verzachten (streken vervagen) en lossen op naar de horizon.
  // De mist ligt in lange horizontale banen tussen heuvels en dorp die traag met de wind meedrijven;
  // in de lucht dunne slierten die de wervels volgen
  float depth = smoothstep(.98, .5, iuv.y) * (1. - cyp * .5);
  if (u_fog > .001) {
    vec3 blurC = c - (orig - Cm) * (.55 + .35 * day);
    c = mix(c, blurC, u_fog * (.35 + .45 * land));
    vec2 fq = iuv * vec2(aspect, 1.);
    float fdr = u_wt * .006 * (.3 + abs(u_wind)) * sign(u_wind + .001);
    float band = noise(vec2(fq.x * 1.6 - fdr, fq.y * 14.)) * .6 + noise(vec2(fq.x * 4.5 - fdr * 1.7, fq.y * 32. + 3.)) * .4;
    band = smoothstep(.3, .72, band);
    float zone = smoothstep(.55, .7, iuv.y) * (1. - smoothstep(.95, 1.02, iuv.y));   // tussen heuvels en dorp
    vec3 fogCol = mix(vec3(.2, .22, .29), vec3(.77, .78, .80), day);
    fogCol = mix(fogCol, u_glowCol * .7 + .22, tw * .3);
    fogCol *= .94 + mix(.26, .14, day) * (band - .5) + .1 * (streak - .5) * sky;     // geschilderde banen, geen egaal waas
    float fk = u_fog * (land * (.12 + .5 * depth + .38 * band * zone) + sky * (.28 + .4 * streak));
    c = mix(c, clamp(fogCol * (.93 + .25 * (Lm - .42)), 0., 1.), clamp(fk, 0., 1.));
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
    float sunHide = 1. - cloudCov(u_sun.xy, .5) * .88;
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
      c += vec3(.9, .95, 1.) * s * on * sky * dark * 1.1 * (1. - covK) * (1. - u_fog * (.6 + .4 * streak));
    }
  }

  // ---------- WEATHER (neerslag): geschilderde streken en vlokken voor alles ----------
  vec2 P = iuv * vec2(aspect, 1.);
  // regen: korte, taps toelopende penseelstreken in de blauwen en groenen van het schilderij.
  // De wind bepaalt de schuinte; in de lucht buigen ze deels mee met Van Goghs streekrichting (flow field).
  // Motregen = fijn en schaars, regen = dichter, storm = een derde laag, langer en schuiner.
  if (u_rain > .001) {
    float storm = smoothstep(.8, 1., u_rain);
    vec2 vel = normalize(vec2(u_wind * .6 + .1, 1.));
    vec2 Q = vec2(vel.y * P.x - vel.x * P.y, vel.x * P.x + vel.y * P.y);
    vec2 fo = fl.rg * 2. - 1.; fo = fo / (length(fo) + 1e-4);
    fo *= sign(dot(fo, vel) + 1e-4);                                    // streekrichting met de val mee
    vec2 sd = normalize(mix(vel, fo, .3 * fl.b * skyW * (1. - storm * .6) + .06 * fl.b));
    vec2 dq = vec2(vel.y * sd.x - vel.x * sd.y, vel.x * sd.x + vel.y * sd.y); // richting van de streek in Q
    vec2 nq = vec2(-dq.y, dq.x);
    for (int l = 0; l < 3; l++) {
      float fl2 = float(l);
      float layerK = l == 2 ? storm : 1.;
      if (layerK < .01) break;
      float sc = 1. + fl2 * .7;
      vec2 cs = vec2(.024, .11) / sc;
      float speed = (1.5 + fl2 * .4 + storm * .9) / cs.y;
      float len = (.38 + .32 * u_rain + .2 * storm) * cs.y;             // lengte in hoogte-eenheden
      float W = (.0019 + .0024 * u_rain) / sc;                           // halve dikte
      float gx = Q.x / cs.x;
      for (int k = -1; k <= 1; k++) {                                    // buren: schuine streken mogen over de celrand
        float col = floor(gx) + float(k);
        float gy = Q.y / cs.y - u_wt * speed - hash(vec2(col, fl2)) * 9.;
        vec2 cell = vec2(col, floor(gy));
        float h = hash(cell + fl2 * 17.);
        if (h > (.10 + .55 * u_rain) * layerK) continue;
        vec2 r = vec2((gx - col - .25 - .5 * hash(cell + 3.1)) * cs.x, (gy - cell.y - .5) * cs.y);
        float along = dot(r, dq) / len + .5;                             // 0 = kop, 1 = staart
        if (along < 0. || along > 1.) continue;
        float bend = (hash(cell + 6.2) - .5) * 2.;
        float across = dot(r, nq) + bend * W * 2. * (along - .5) * (along - .5) * 4.;
        float wa = W * (.3 + .7 * pow(sin(3.1416 * along), .7)) * (1.1 - .3 * along);   // taps
        float a = smoothstep(wa, wa * .35, abs(across));
        // haren van het penseel: fijne strepen in de lengte, droger naar de staart
        float bristle = noise(vec2(across / W * 2.2 + h * 40., along * 1.5 + h * 7.));
        a *= mix(1., smoothstep(.2, .65, bristle), (.25 + .35 * along) * (.5 + .5 * u_rain));
        if (a < .01) continue;
        // palet uit De Sterrennacht: ultramarijn, kobalt, groenblauw, bleek cyaan
        float pick = hash(cell + 8.8);
        vec3 pc = pick < .32 ? vec3(.13, .23, .50) : pick < .58 ? vec3(.24, .40, .68) : pick < .82 ? vec3(.18, .40, .40) : vec3(.60, .74, .80);
        vec3 rc = mix(mix(pc, vec3(.60, .72, .86), .55), pc * (.9 + .2 * h), day); // 's nachts lichter dan de lucht
        rc = mix(rc, Cm, .15);                                           // harmonie met de verf eronder
        rc *= .9 + .2 * clamp(across / max(wa, 1e-4), -1., 1.);         // een licht randje aan één kant
        c = mix(c, clamp(rc, 0., 1.), a * (.55 + .25 * u_rain) * (1. - fl2 * .25));
      }
    }
  }
  // sneeuw: verfstipjes, alsof ze met de penseelpunt zijn gezet (korte ovale toets met eigen hoek en
  // penseelharen), wit, lichtblauw of af en toe een vleugje oker; drie lagen (dichtbij groter en sneller)
  if (u_snow > .001) {
    for (int l = 0; l < 3; l++) {
      float fl3 = float(l), sc = 1. + fl3 * .8;
      vec2 S = P;
      S.x -= u_wind * u_wt * .035 / sc + sin(u_wt * .45 + P.y * 5. + fl3 * 2.) * .012;
      S.y -= u_wt * (.075 / sqrt(sc));
      vec2 g = S / (.055 / sc), cell = floor(g), f = fract(g) - .5;
      float h = hash(cell + fl3 * 31.);
      if (h < .12 + .5 * u_snow) {
        vec2 o = (vec2(hash(cell + 1.3), hash(cell + 2.9)) - .5) * .44;
        o.x += sin(u_wt * (.6 + h) + h * 20.) * .1;
        vec2 d = f - o;
        // eigen hoek (licht met de wind mee) en een trage tuimeling
        float ang = (hash(cell + 5.5) - .5) * 2.2 + u_wind * .4 + sin(u_wt * (.3 + h * .5) + h * 9.) * .25;
        vec2 dr = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
        float r = (.10 + .07 * hash(cell + 4.4)) * (1. - fl3 * .12);
        float irr = (noise(dr * 16. + cell * 1.7) - .5) * .35;
        float dl = length(dr * vec2(.62, 1.25)) + irr * r;               // ovaal, rafelige rand
        float a = smoothstep(r, r * .45, dl);
        if (a < .01) continue;
        // penseelharen in de lengte van de toets, en een dikke (lichte) en dunne (schaduw)kant
        float br = noise(vec2(dr.y / r * 3.5 + h * 30., dr.x / r * .8));
        a *= .72 + .28 * smoothstep(.25, .7, br);
        float side = clamp(dr.y / r, -1., 1.);
        float pick = hash(cell + 9.1);
        vec3 pc = pick < .64 ? vec3(.97, .97, .99) : pick < .94 ? vec3(.76, .85, .96) : vec3(.95, .88, .70);
        vec3 fc = mix(pc * vec3(.70, .77, .94) * .95, pc, day);            // 's nachts koel maanlicht
        fc += vec3(1., .68, .36) * u_lamps * .07;
        fc *= .9 + .14 * side;
        // overdag een zacht blauwgrijs randje, zodat witte stipjes ook tegen een lichte lucht leesbaar zijn
        float rim = smoothstep(r * 1.35, r * .95, dl) - a;
        c = mix(c, c * vec3(.72, .76, .86), max(rim, 0.) * .5 * day * min(1., u_snow * 2.) * (1. - fl3 * .25));
        c = mix(c, clamp(fc, 0., 1.), a * (.85 - fl3 * .18) * min(1., u_snow * 2.));
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
