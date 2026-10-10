/** The zoom slider is logarithmic: equal steps of the slider are equal factors of distance. */
const NEAR_M = 0.3;
const FAR_M = 300;
const SPAN = Math.log(FAR_M) - Math.log(NEAR_M);

/** slider 0 (far) … 100 (near) → distance in metres */
export const sliderToDistance = (v: number): number => Math.exp(Math.log(NEAR_M) + (SPAN * (100 - v)) / 100);

/** distance in metres → slider 0 … 100 */
export function distanceToSlider(metres: number): number {
  const v = 100 - ((Math.log(metres) - Math.log(NEAR_M)) / SPAN) * 100;
  return Math.max(0, Math.min(100, v));
}
