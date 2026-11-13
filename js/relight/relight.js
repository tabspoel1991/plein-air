// relight/ — lichtprofiel + helderheid van het schilderij → shader-uniforms voor kleur en licht.

export function relightUniforms(p, srcLuma) {
  const k = Math.min(2.5, Math.max(.3, Math.log(p.L) / Math.log(srcLuma)));
  return {
    u_k: k,
    u_con: 1 + Math.max(0, 1 - k) * .55,
    u_expo: p.expo,
    u_sat: p.sat * (1 + Math.max(0, 1 - k) * .35),
    u_skyAmt: p.skyA,
    u_vig: p.vig,
    u_stars: p.stars,
    u_glow: p.glow,
    u_gain: p.gain,
    u_sky: p.sky,
    u_horizon: p.hor,
  };
}
