/** From where the finger is on the joystick to how hard it pushes each way. */
export interface StickReading {
  /** -1 back … 1 forward */
  fwd: number;
  /** -1 left … 1 right */
  lr: number;
  /** where to draw the knob, relative to the centre, px */
  knobX: number;
  knobY: number;
}

/** a small wobble of the thumb near the centre does nothing */
const DEAD_ZONE = 0.15;

export function readStick(dx: number, dy: number, radius: number): StickReading {
  const distance = Math.hypot(dx, dy);
  const reach = Math.min(1, distance / radius);
  const scaleToRim = distance > radius ? radius / distance : 1;
  const knobX = dx * scaleToRim;
  const knobY = dy * scaleToRim;
  if (reach < DEAD_ZONE) return { fwd: 0, lr: 0, knobX, knobY };
  // past the dead zone the push grows from 0, so walking starts slowly instead of with a jump
  const strength = (reach - DEAD_ZONE) / (1 - DEAD_ZONE) / reach;
  return { fwd: (-knobY / radius) * strength, lr: (knobX / radius) * strength, knobX, knobY };
}
