precision highp float;
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

const vec3 LUM = vec3(0.299, 0.587, 0.114);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
vec3 softLight(vec3 b, vec3 s) { return mix(2. * b * s + b * b * (1. - 2. * s), sqrt(b) * (2. * s - 1.) + 2. * b * (1. - s), step(.5, s)); }
vec2 cover(vec2 uv) { float rs = u_res.x / u_res.y, ri = u_img.x / u_img.y;
  vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.); return (uv - .5) * s + .5; }

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
  vec2 disp = vec2(0.);

  // cipres: wiegt langzaam (meer naar de top), met vlammende golfjes die omhoog lopen
  float height = smoothstep(1., .05, p.y);
  float sway = sin(t * .55 + p.y * 3.) * .006 + sin(t * .9 + p.y * 9.) * .002;
  float flame = (noise(vec2(p.x * 14., p.y * 7. + t * .7)) - .5) * .006;
  disp.x += (sway * height + flame * (.3 + height)) * cypW * u_amp;

  // sterren en maan: de krans "ademt" (schaal rond het middelpunt), elk in een eigen ritme
  float halo = 0.;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= u_starCount) break;
    vec4 s = u_star[i];
    vec2 d = (p - s.xy) * vec2(aspect, 1.);
    float r = s.z * aspect;
    float w = smoothstep(r, r * .3, length(d));
    float pulse = sin(t * (.9 + s.w * 1.1) + s.w * 6.283);
    disp -= (p - s.xy) * pulse * .035 * w * u_amp;
    halo += w * pulse;
  }
  if (u_moon.z > 0.) {
    vec2 d = (p - u_moon.xy) * vec2(aspect, 1.);
    float w = smoothstep(u_moon.z * aspect, u_moon.z * aspect * .3, length(d));
    float pulse = sin(t * .45 + 1.3);
    disp -= (p - u_moon.xy) * pulse * .02 * w * u_amp;
    halo += w * pulse * .7;
  }

  // dorp en heuvels: (bijna) stil — alleen een heel klein beetje leven in het gras
  vec4 mB0 = texture2D(u_maskB, p);
  disp += (vec2(noise(p * 9. + t * .2), noise(p * 9. - t * .2)) - .5) * .0012 * mB0.b * u_amp;

  // lucht: wervels stromen mee met de penseelstreken (flow map, twee fasen die overvloeien)
  vec3 fl = texture2D(u_flow, p).rgb;
  vec2 dir = (fl.rg * 2. - 1.) * vec2(1. / aspect, 1.);
  float flowAmt = skyW * (.25 + .75 * fl.b) * u_amp * .014;
  float ph = t * .12 + noise(p * 3.) * .7;  // ruis in de fase voorkomt dat alles tegelijk "pompt"
  float ph0 = fract(ph), ph1 = fract(ph + .5);
  vec2 q = p + disp;
  vec3 c0 = texture2D(u_tex, q - dir * (ph0 - .5) * flowAmt).rgb;
  vec3 c1 = texture2D(u_tex, q - dir * (ph1 - .5) * flowAmt).rgb;
  vec3 c = mix(c0, c1, abs(1. - 2. * ph0));
  vec2 iuv = q;

  // zachte puls in de helderheid van de kransen
  c *= 1. + halo * .12 * u_amp;

  // ---------- RELIGHT ----------
  vec3 orig = c;
  vec4 mA = texture2D(u_maskA, iuv), mB = texture2D(u_maskB, iuv);
  float sky = mA.r, starM = mA.g, moonM = mA.b, cyp = mA.a;
  float vil = mB.r, win = mB.g, hil = mB.b;
  float day = u_day, nightK = 1. - u_day;

  // lokale gemiddelde helderheid (ring van 8 monsters): textuur = verschil met dat gemiddelde
  float L = dot(orig, LUM), Lm = L * .2;
  float winGlow = 0.;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * .785398; vec2 o = vec2(cos(a), sin(a) * aspect);
    Lm += dot(texture2D(u_tex, iuv + o * .012).rgb, LUM) * .1;
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
  // sterren en maan gaan overdag op in de lucht (alleen de textuur blijft)
  float sm = clamp(starM + moonM, 0., 1.);
  vec3 skyNeutral = grad * (.92 + .2 * (Lm - .42)) + detail * .4;
  skyDay = mix(skyDay, skyNeutral, sm * .92);
  vec3 skyC = mix(skyNight, skyDay, day);
  skyC += orig * sm * nightK * .18;                                     // 's nachts gloeien sterren en maan

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

  // --- RAMEN: licht aan in avond en nacht, met zachte gloed; overdag uit ---
  float flick = 1. + (noise(vec2(t * 1.3, iuv.x * 50.)) - .5) * .12 * u_amp;
  c = mix(c, vec3(1., .80, .40) * 1.25 * flick, win * u_lamps);
  c += vec3(1., .66, .30) * winGlow * u_lamps * (.35 + .4 * nightK);
  c = mix(c, c * vec3(.42, .45, .55), win * (1. - u_lamps));

  // --- ZON in Van Gogh-stijl: de penseelstreken van de grootste ster, warm ingekleurd ---
  if (u_sun.z > .001) {
    vec2 sd = (iuv - u_sun.xy) * vec2(aspect, 1.);
    float sr = .085, len = length(sd);
    float vis = u_sun.z * sky;
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
      c = mix(c, sunC, smoothstep(sr, sr * .8, len) * vis);
      c += vec3(1., .88, .6) * exp(-len / sr * 1.8) * .22 * vis;
    }
  }

  // --- twinkelende sterretjes in de donkerste nacht ---
  if (u_night > .01) {
    vec2 sg = iuv * vec2(aspect, 1.) * 80.; vec2 cell = floor(sg); float h = hash(cell);
    if (h > .982) {
      vec2 f = fract(sg) - .5 - (vec2(hash(cell + 1.7), hash(cell + 3.1)) - .5) * .6;
      float tw = mix(.8, .45 + .55 * sin(t * (.8 + h * 2.5) + h * 40.), u_amp);
      float s = smoothstep(.13, 0., length(f)) * tw;
      float dark = 1. - smoothstep(.08, .32, dot(c, LUM));
      c += vec3(.9, .95, 1.) * s * u_night * sky * dark * 1.1;
    }
  }
  vec2 vv = uv - .5; c *= 1. - u_vig * dot(vv, vv) * 2.2;
  c += (hash(uv * u_res + fract(t * .37) * 100.) - .5) * u_grain;

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
