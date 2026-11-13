precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res, u_img;
uniform float u_t, u_mt, u_amp, u_grain, u_zoom, u_k, u_expo, u_con, u_sat, u_skyAmt, u_vig, u_stars, u_glow;
uniform vec3 u_gain, u_sky, u_horizon;
const vec3 LUM = vec3(0.299, 0.587, 0.114);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
vec3 softLight(vec3 b, vec3 s) { return mix(2. * b * s + b * b * (1. - 2. * s), sqrt(b) * (2. * s - 1.) + 2. * b * (1. - s), step(.5, s)); }
vec2 cover(vec2 uv) { float rs = u_res.x / u_res.y, ri = u_img.x / u_img.y;
  vec2 s = rs > ri ? vec2(1., ri / rs) : vec2(rs / ri, 1.); return (uv - .5) * s + .5; }

void main() {
  vec2 uv = v_uv; float t = u_mt; // bewegingsklok: staat stil als de slider op 0 staat
  float z = .955 + .012 * u_zoom * sin(t * .07);
  vec2 iuv = cover((uv - .5) * z + .5);
  float top = 1. - iuv.y;
  vec2 q = iuv * vec2(u_img.x / u_img.y, 1.) * 2.4;
  vec2 f1 = vec2(fbm(q + vec2(t * .03, 0.)), fbm(q + vec2(5.2, 1.3) - vec2(0., t * .03))) - .5;
  vec2 f2 = vec2(fbm(q * 1.7 + f1 * 2. + t * .02), fbm(q * 1.7 - f1 * 2. + 3.1 - t * .02)) - .5;
  float amp = u_amp * .02 * mix(.45, 1., smoothstep(.2, .9, top));
  iuv += (f1 + f2 * .6) * amp;

  vec3 c = texture2D(u_tex, iuv).rgb;

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
    vec2 sg = iuv * vec2(u_img.x / u_img.y, 1.) * 80.; vec2 cell = floor(sg); float h = hash(cell);
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
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}
