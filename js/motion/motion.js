// motion/ — motion-slider (0..1) → bewegingsparameters voor de shader.
//
// De slider stuurt twee dingen tegelijk:
//   - snelheid: hoe snel de "bewegingsklok" (u_mt) loopt. Op 0 staat die klok stil.
//   - sterkte:  hoe ver pixels verschuiven (u_amp), en hoeveel zoom/korrel/twinkeling.
// De klok wordt geïntegreerd (opgeteld per frame), zodat een andere snelheid nooit
// een sprong geeft; de sliderwaarde zelf wordt ook vloeiend gevolgd.

export function createMotion() {
  let m = null, clock = 0;
  return {
    update(slider, dt) {
      m = m === null ? slider : m + (slider - m) * (1 - Math.exp(-dt * 4));
      const v = m < 0.002 ? 0 : m;
      const speed = 3.0 * Math.pow(v, 1.5);      // 0 → stil, 1 → 3× basistempo
      clock += dt * speed;
      return {
        u_mt: clock,                              // bewegingsklok (seconden × snelheid)
        u_amp: Math.pow(v, 1.15),                 // 0..1 sterkte
        u_grain: 0.024 * Math.min(1, v / 0.3),    // filmkorrel, weg op 0
        u_zoom: v,                                // ademende zoom, weg op 0
      };
    },
  };
}
