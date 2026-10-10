/**
 * Motion-captured animation for every avatar body (the built-in figure and VRM models alike). Clips are blended
 * by weight in the normalized humanoid space (bones.ts), so a body only has to say how to put such a rotation on
 * its bones (a `Rig`). On top of the clips: speed-matched walking/jogging/running, flight lean and banking,
 * talking while chatting, and one-shot gestures that play over whatever the legs are doing.
 */
import * as THREE from "three";
import type { Bone } from "./bones";
import { BONES, PARENT, UPPER_BODY } from "./bones";
import { clip, sampleBone, sampleHips } from "./clips";
import { gestureClip } from "./gestures";
import type { Motion } from "./locomotion";
import { GAIT, MOVING_SPEED, isGait, targetWeights } from "./locomotion";
import { FlightPose } from "./flight-pose";

export type { Motion } from "./locomotion";

/** what a body has to provide: which bones it has, and how to set them (rotation in normalized rig space) */
export interface Rig {
  has(b: Bone): boolean;
  set(b: Bone, q: THREE.Quaternion): void;
  /** hips position in rig space, in units of the standing hips height (so ~[0, 1, 0] when standing) */
  hips(p: THREE.Vector3): void;
}

interface PlayingGesture {
  clip: string;
  t: number;
  upperOnly: boolean;
}

const GESTURE_FADE_IN_S = 0.3;
const GESTURE_FADE_OUT_S = 0.45;
const WEIGHT_EPSILON = 0.002;
/** the hips carry the root motion, so a gesture leaves them alone */
const FULL_BODY = BONES.filter((b) => b !== "hips");

export class Animator {
  /** clip weights */
  readonly weights = new Map<string, number>();
  /** clip times, seconds */
  readonly times = new Map<string, number>();
  /** shared locomotion phase (0..1), so walking blends into running without the feet fighting */
  phase = 0;
  sinceLanding = 9;
  private wasAir = false;
  gesture: PlayingGesture | null = null;
  readonly out = new Map<Bone, THREE.Quaternion>();
  readonly hipsPos = new THREE.Vector3(0, 1, 0);
  private readonly flight = new FlightPose();

  constructor(public hipsHeight = 0.92) {
    for (const b of BONES) this.out.set(b, new THREE.Quaternion());
    // bodies standing side by side should not breathe in step
    this.times.set("idle", Math.random() * 10);
  }

  play(gesture: string, sitting: boolean): void {
    const g = gestureClip(gesture, sitting);
    if (!g || !clip(g.clip)) return;
    this.gesture = { clip: g.clip, t: 0, upperOnly: g.upperOnly };
  }

  update(m: Motion, dt: number): void {
    const air = !m.onGround && !m.flying && !m.sitting;
    if (this.wasAir && !air && !m.flying) this.sinceLanding = 0;
    this.wasAir = air;
    this.sinceLanding += dt;
    this.easeWeights(targetWeights(m, this.hipsHeight, air, this.sinceLanding), m.sitting, dt);
    this.advanceTimes(m, dt);
    this.blend();
    this.playGesture(m, dt);
    this.flight.apply(this.out, this.hipsPos, m, dt);
  }

  /** weights ease towards the target; sitting down and standing up take a little longer */
  private easeWeights(target: Map<string, number>, sitting: boolean, dt: number): void {
    const rate = sitting || (this.weights.get("sit") ?? 0) > 0.05 ? 5 : 9;
    const k = 1 - Math.exp(-dt * rate);
    for (const n of new Set([...this.weights.keys(), ...target.keys()])) {
      const w = this.weights.get(n) ?? 0;
      const v = w + ((target.get(n) ?? 0) - w) * k;
      if (v >= WEIGHT_EPSILON || target.has(n)) {
        this.weights.set(n, v);
        continue;
      }
      this.weights.delete(n);
      if (n === "land") this.times.delete(n);
    }
  }

  /** locomotion clips share one phase advanced by distance; the rest just run */
  private advanceTimes(m: Motion, dt: number): void {
    const H = this.hipsHeight;
    this.advancePhase(m.speed / H, dt);
    for (const n of this.weights.keys()) {
      const c = clip(n);
      if (!c) continue;
      const t = this.times.get(n) ?? 0;
      if (isGait(n)) this.times.set(n, this.phase * c.dur);
      else if (n === "walkBack") this.times.set(n, t + dt * Math.max(0.6, m.speed / H));
      else if (n === "turn") this.times.set(n, t + dt * Math.min(1.5, Math.abs(m.turn ?? 0) / 2));
      else if (n === "land") this.times.set(n, this.sinceLanding * 1.5);
      else this.times.set(n, t + dt);
    }
  }

  /** `v`: speed in hips-heights per second */
  private advancePhase(v: number, dt: number): void {
    let natural = 0;
    let cycle = 0;
    let sum = 0;
    for (const [g, speed] of GAIT) {
      const w = this.weights.get(g) ?? 0;
      natural += w * speed;
      cycle += w * (clip(g)?.dur ?? 1);
      sum += w;
    }
    if (sum <= 0.01) return;
    this.phase = (this.phase + (dt * v) / (natural / sum) / (cycle / sum)) % 1;
  }

  private blend(): void {
    const q = new THREE.Quaternion();
    const acc = new THREE.Vector4();
    for (const b of BONES) {
      acc.set(0, 0, 0, 0);
      let first: THREE.Quaternion | null = null;
      for (const [n, w] of this.weights) {
        const c = clip(n);
        if (!c || !sampleBone(c, b, this.times.get(n) ?? 0, q)) continue;
        // keep every sample on the same side of the quaternion sphere as the first, or they cancel out
        if (!first) first = q.clone();
        else if (first.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        acc.x += q.x * w;
        acc.y += q.y * w;
        acc.z += q.z * w;
        acc.w += q.w * w;
      }
      const o = this.out.get(b)!;
      if (acc.lengthSq() < 1e-9) o.identity();
      else o.set(acc.x, acc.y, acc.z, acc.w).normalize();
    }
    this.blendHips();
  }

  private blendHips(): void {
    let total = 0;
    for (const v of this.weights.values()) total += v;
    const p = new THREE.Vector3();
    this.hipsPos.set(0, 0, 0);
    for (const [n, w] of this.weights) {
      const c = clip(n);
      if (c) this.hipsPos.addScaledVector(sampleHips(c, this.times.get(n) ?? 0, p), w / Math.max(total, 1e-6));
    }
    if (total < 1e-6) this.hipsPos.set(0, 1, 0);
  }

  /** the gesture on top: whole body when standing still, upper body otherwise */
  private playGesture(m: Motion, dt: number): void {
    const g = this.gesture;
    const c = g ? clip(g.clip) : null;
    if (!g || !c) return;
    g.t += dt;
    const fade = Math.min(1, g.t / GESTURE_FADE_IN_S, Math.max(0, (c.dur - g.t) / GESTURE_FADE_OUT_S));
    const bones = g.upperOnly || isBusy(m) ? UPPER_BODY : FULL_BODY;
    const q = new THREE.Quaternion();
    for (const b of bones) {
      if (!sampleBone(c, b, g.t, q)) continue;
      const o = this.out.get(b)!;
      if (o.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      o.slerp(q, fade);
    }
    if (g.t >= c.dur) this.gesture = null;
  }

  /** put the result on a body; bones it lacks are folded into their nearest existing child */
  apply(rig: Rig): void {
    const carry = new Map<Bone, THREE.Quaternion>();
    for (const b of BONES) {
      const parent = PARENT[b];
      const q = this.out.get(b)!.clone();
      const pre = parent && !rig.has(parent) ? carry.get(parent) : undefined;
      if (pre) q.premultiply(pre);
      if (rig.has(b)) rig.set(b, q);
      else carry.set(b, q);
    }
    rig.hips(this.hipsPos);
  }

  /** how far into the seated pose the body is, 0..1 */
  seated(): number {
    return Math.min(1, (this.weights.get("sit") ?? 0) + (this.weights.get("sitTalk") ?? 0));
  }
}

/** a gesture while walking, flying or falling only moves the upper body */
function isBusy(m: Motion): boolean {
  return m.speed > MOVING_SPEED || m.flying || (!m.onGround && !m.sitting);
}
