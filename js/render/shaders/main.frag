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
uniform float u_k, u_expo, u_con, u_sat, u_skyAmt, u_vig, u_stars, u_glow;
uniform vec3 u_gain, u_sky, u_horizon;

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
  float top = 1. - iuv.y;
  vec3 g = vec3(0.);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * .785398; vec2 o = vec2(cos(a), sin(a)) * .012;
    vec3 s = texture2D(u_tex, iuv + o).rgb;
    g += s * smoothstep(.62, .95, dot(s, LUM));
  }
  g /= 8.;

  c = pow(max(c, vec3(.0001)), vec3(u_k));
  c = (c - .5) * u_con + .5;
  c *= u_gain * u_expo;
  float L = dot(c, LUM); c = mix(vec3(L), c, u_sat);
  float skyMask = smoothstep(.35, 1., top);
  vec3 skyCol = mix(u_horizon, u_sky, smoothstep(.5, 1., top));
  c = mix(c, softLight(clamp(c, 0., 1.), skyCol), u_skyAmt * (.4 + .6 * skyMask));
  c += g * vec3(1., .74, .42) * u_glow * 1.5;
  if (u_stars > .01) {
    vec2 sg = iuv * vec2(aspect, 1.) * 80.; vec2 cell = floor(sg); float h = hash(cell);
    if (h > .982) {
      vec2 f = fract(sg) - .5 - (vec2(hash(cell + 1.7), hash(cell + 3.1)) - .5) * .6;
      float tw = mix(.8, .45 + .55 * sin(t * (.8 + h * 2.5) + h * 40.), u_amp);
      float s = smoothstep(.13, 0., length(f)) * tw;
      float dark = 1. - smoothstep(.08, .32, dot(c, LUM));
      c += vec3(.9, .95, 1.) * s * u_stars * skyMask * dark * 1.3;
    }
  }
  vec2 vv = uv - .5; c *= 1. - u_vig * dot(vv, vv) * 2.2;
  c += (hash(uv * u_res + fract(t * .37) * 100.) - .5) * u_grain;

  // debug-weergave (toets M): masks in kleur over het schilderij
  if (u_debug > .5) {
    vec4 mA = texture2D(u_maskA, iuv), mB = texture2D(u_maskB, iuv);
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
