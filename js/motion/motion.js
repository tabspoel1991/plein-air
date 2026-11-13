// motion/ — motion-slider (0..1) → bewegingsparameters voor de shader.

export function motionUniforms(slider) {
  return { u_motion: slider * 2 };
}
