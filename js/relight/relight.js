// relight/ — lichtprofiel + scene → shader-uniforms voor kleur en licht per element.
// De eigenlijke kleurregels per element staan in de shader (render/shaders/main.frag,
// blok RELIGHT); dit module vertaalt het profiel naar die invoer.

export function relightUniforms(p, scene) {
  // de zon wordt "geschilderd" met de penseelstreken van de grootste ster
  const big = scene.stars.reduce((a, s) => (!a || s.r > a.r ? s : a), null);
  return {
    u_day: p.day, u_night: p.night, u_lamps: p.lamps,
    u_sun: [p.sun[0], p.sun[1], p.sunVis], u_sunDir: p.sunDir,
    u_sunSrc: big ? [big.x, big.y, big.r] : [0, 0, 0],
    u_skyTop: p.skyTop, u_skyHor: p.skyHor,
    u_lightCol: p.lightCol, u_shadowCol: p.shadowCol,
    u_vig: p.vig,
    u_twilight: p.twilight, u_golden: p.golden, u_glowCol: p.glowCol,
  };
}
