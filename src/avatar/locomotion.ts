/** Which clips a body should be playing for how it moves: speed-matched walking/jogging/running, and the rest. */
export interface Motion {
  /** m/s over the ground (or through the air when flying) */
  speed: number;
  back?: boolean;
  onGround: boolean;
  flying: boolean;
  sitting: boolean;
  /** turning rate, rad/s (positive: to the right) */
  turn?: number;
  /** -1 down, 0, 1 up (flying) */
  climb?: number;
  talking?: boolean;
}

/** natural speeds of the locomotion clips (m/s for a body whose hips are 1 m high) */
export const GAIT: [string, number][] = [
  ["walk", 1.45],
  ["jog", 3.3],
  ["run", 5.2],
];

export const MOVING_SPEED = 0.15;
const TURNING_RATE = 0.1;
/** how long the landing clip holds after touching down, seconds */
export const LANDING_S = 0.5;

/** blend the two gait clips around this speed (in hips-heights per second) */
function gaitWeights(v: number, target: Map<string, number>): void {
  let i = 0;
  while (i < GAIT.length - 1 && v > GAIT[i + 1][1]) i++;
  if (i === GAIT.length - 1 || v <= GAIT[0][1]) {
    target.set(GAIT[i][0], 1);
    return;
  }
  const k = (v - GAIT[i][1]) / (GAIT[i + 1][1] - GAIT[i][1]);
  target.set(GAIT[i][0], 1 - k);
  target.set(GAIT[i + 1][0], k);
}

function baseClip(m: Motion, air: boolean): string | null {
  if (m.sitting) return m.talking ? "sitTalk" : "sit";
  if (m.flying) return "fly";
  if (air) return "air";
  if (m.speed > MOVING_SPEED) return m.back ? "walkBack" : null;
  if (Math.abs(m.turn ?? 0) > TURNING_RATE) return "turn";
  return m.talking ? "talk" : "idle";
}

/**
 * The clip weights to aim for. `air`: falling or jumping (not flying, not seated). `sinceLanding`: seconds since
 * the feet last touched down; a body that has just landed and stands still plays the landing clip.
 */
export function targetWeights(m: Motion, hipsHeight: number, air: boolean, sinceLanding: number): Map<string, number> {
  const target = new Map<string, number>();
  const single = baseClip(m, air);
  if (single) target.set(single, 1);
  else gaitWeights(m.speed / hipsHeight, target);
  if (sinceLanding < LANDING_S && !m.sitting && !m.flying && m.speed < MOVING_SPEED) {
    target.clear();
    target.set("land", 1);
  }
  return target;
}

export const isGait = (name: string): boolean => GAIT.some(([g]) => g === name);
