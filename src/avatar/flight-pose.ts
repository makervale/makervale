/** Flying: lean into the direction of travel, bank into turns, and bob gently while hovering. */
import * as THREE from "three";
import type { Bone } from "./bones";
import type { Motion } from "./locomotion";

/** full forward lean at this speed, m/s */
const FULL_SPEED = 6;
const EASE_RATE = 4;
const LEAN_FORWARD = 0.8;
const LEAN_CLIMB = 0.25;
const BANK = 0.22;
/** the head turns back up by this share of the lean, to keep looking ahead */
const HEAD_COUNTER = 0.6;
const BOB_RATE = 1.8;
const BOB_HEIGHT = 0.03;

export class FlightPose {
  lean = 0;
  bank = 0;
  private readonly q = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, "ZXY");
  private readonly xAxis = new THREE.Vector3(1, 0, 0);

  apply(out: Map<Bone, THREE.Quaternion>, hipsPos: THREE.Vector3, m: Motion, dt: number): void {
    const fwd = m.flying ? Math.min(1, m.speed / FULL_SPEED) : 0;
    const k = 1 - Math.exp(-dt * EASE_RATE);
    const lean = m.flying ? fwd * LEAN_FORWARD - (m.climb ?? 0) * LEAN_CLIMB * (1 - fwd) : 0;
    const bank = m.flying ? -(m.turn ?? 0) * BANK * (0.3 + fwd) : 0;
    this.lean += (lean - this.lean) * k;
    this.bank += (bank - this.bank) * k;
    if (Math.abs(this.lean) > 1e-3 || Math.abs(this.bank) > 1e-3) {
      out.get("hips")!.premultiply(this.q.setFromEuler(this.euler.set(this.lean, 0, this.bank)));
      out.get("head")!.premultiply(this.q.setFromAxisAngle(this.xAxis, -this.lean * HEAD_COUNTER));
    }
    if (m.flying) hipsPos.y += Math.sin((performance.now() / 1000) * BOB_RATE) * BOB_HEIGHT * (1 - fwd);
  }
}
