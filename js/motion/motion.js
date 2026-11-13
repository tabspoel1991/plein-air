// motion/ — bewegingswaarde (slider of wind, 0..1.3) → bewegingsparameters voor de shader.
//
// De waarde stuurt twee dingen tegelijk:
//   - snelheid: hoe snel de "bewegingsklok" (u_mt) loopt. Op 0 staat die klok stil.
//   - sterkte:  hoe ver pixels verschuiven (u_amp), en hoeveel zoom/korrel/twinkeling.
// De klok wordt geïntegreerd (opgeteld per frame), zodat een andere snelheid nooit
// een sprong geeft; de waarde zelf wordt ook vloeiend gevolgd.
// Boven 1 (alleen via storm): razende wervels.
// u_wt is de weerklok (regen, sneeuw): die loopt op gewone snelheid, en staat alleen stil op 0.

export function motionParams(v) {
  return {
    speed: 3.0 * Math.pow(v, 1.5),               // 0 → stil, 1 → 3× basistempo
    u_amp: Math.min(1.25, Math.pow(v, 1.15)),     // 0..1 sterkte
    u_grain: 0.024 * Math.min(1, v / 0.3),        // filmkorrel, weg op 0
    u_zoom: Math.min(1, v),                       // ademende zoom, weg op 0
  };
}

export function createMotion() {
  let m = null, clock = 0, wclock = 0;
  return {
    update(value, dt) {
      m = m === null ? value : m + (value - m) * (1 - Math.exp(-dt * 4));
      const v = m < 0.002 ? 0 : m;
      const { speed, ...rest } = motionParams(v);
      clock += dt * speed;
      if (v > 0) wclock += dt;
      return { u_mt: clock, u_wt: wclock, ...rest };
    },
    get value() { return m ?? 0; },
  };
}
