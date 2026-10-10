/**
 * Motion-captured clips. They come from Overte (the open-source continuation of High Fidelity), Apache-2.0,
 * converted by tools/convert-anims.html into rotations of normalized humanoid bones (see bones.ts), stored as
 * base64 Int16 quaternions (× 1/32767) and hips positions (× 1e-4, in standing-hips units).
 */
import type * as THREE from "three";
import raw from "./clips.json";
import type { Bone } from "./bones";
import { BONES } from "./bones";

export interface Clip {
  name: string;
  fps: number;
  /** frame count */
  n: number;
  loop: boolean;
  hips: Int16Array;
  bones: Partial<Record<Bone, Int16Array>>;
  /** seconds */
  dur: number;
}

interface RawClip {
  fps: number;
  n: number;
  loop: boolean;
  hips: string;
  bones: Partial<Record<Bone, string>>;
}

const QUAT_SCALE = 1 / 32767;
const HIPS_SCALE = 1e-4;
/** below this angle (radians) from the rest pose, a frame counts as T-pose */
const REST_ANGLE = 0.05;
const REST_PROBES: Bone[] = ["leftUpperArm", "rightUpperArm", "spine", "leftUpperLeg"];

const data = raw as unknown as Record<string, RawClip | string | number>;
const cache = new Map<string, Clip>();

export const CLIP_SOURCE = String(data._source);

function decode(s: string): Int16Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Int16Array(u.buffer);
}

/** every clip name (keys starting with "_" are notes from the converter) */
export const clipNames = (): string[] => Object.keys(data).filter((k) => !k.startsWith("_"));

/** angle of a bone's frame `f` away from the rest pose */
export function restAngle(c: Clip, b: Bone, f: number): number {
  const d = c.bones[b];
  if (!d) return 0;
  return 2 * Math.acos(Math.min(1, Math.abs(d[f * 4 + 3]) * QUAT_SCALE));
}

/** frames where the body is still in the rest T-pose (some source files pad their motion with them) */
function isRest(c: Clip, f: number): boolean {
  return Math.max(...REST_PROBES.map((b) => restAngle(c, b, f))) < REST_ANGLE;
}

/** one-shot clips: drop rest-pose frames at either end, so a gesture never flashes a T-pose */
export function trimRestFrames(c: Clip): void {
  let a = 0;
  let b = c.n - 1;
  while (a < b && isRest(c, a)) a++;
  while (b > a && isRest(c, b)) b--;
  if (a === 0 && b === c.n - 1) return;
  const cut = (arr: Int16Array, k: number) => arr.slice(a * k, (b + 1) * k);
  for (const k of Object.keys(c.bones) as Bone[]) c.bones[k] = cut(c.bones[k]!, 4);
  c.hips = cut(c.hips, 3);
  c.n = b - a + 1;
  c.dur = Math.max(1, c.n - 1) / c.fps;
}

export function decodeClip(name: string, r: RawClip): Clip {
  const bones: Clip["bones"] = {};
  for (const b of BONES) if (r.bones[b]) bones[b] = decode(r.bones[b]!);
  // a loop wraps from the last frame back to the first; a one-shot ends on its last frame
  const dur = r.loop ? r.n / r.fps : (r.n - 1) / r.fps;
  const c: Clip = { name, fps: r.fps, n: r.n, loop: r.loop, hips: decode(r.hips), bones, dur };
  if (!c.loop) trimRestFrames(c);
  return c;
}

export function clip(name: string): Clip | null {
  const hit = cache.get(name);
  if (hit) return hit;
  const r = data[name];
  if (!r || typeof r !== "object" || !r.bones) return null;
  const c = decodeClip(name, r);
  cache.set(name, c);
  return c;
}

/** the two frames around time `t` (seconds) and how far between them */
function frameAt(c: Clip, t: number): { i0: number; i1: number; k: number } {
  let f = t * c.fps;
  if (c.loop) {
    f %= c.n;
    if (f < 0) f += c.n;
  } else f = Math.min(c.n - 1, Math.max(0, f));
  const i0 = Math.floor(f);
  const i1 = c.loop ? (i0 + 1) % c.n : Math.min(c.n - 1, i0 + 1);
  return { i0, i1, k: f - i0 };
}

const qa = { x: 0, y: 0, z: 0, w: 1 };
const qb = { x: 0, y: 0, z: 0, w: 1 };

function readQuat(d: Int16Array, i: number, out: typeof qa): void {
  out.x = d[i * 4] * QUAT_SCALE;
  out.y = d[i * 4 + 1] * QUAT_SCALE;
  out.z = d[i * 4 + 2] * QUAT_SCALE;
  out.w = d[i * 4 + 3] * QUAT_SCALE;
}

/** rotation of a bone at time t (seconds), interpolated between frames; false if the clip doesn't move it */
export function sampleBone(c: Clip, b: Bone, t: number, out: THREE.Quaternion): boolean {
  const d = c.bones[b];
  if (!d) return false;
  const { i0, i1, k } = frameAt(c, t);
  readQuat(d, i0, qa);
  readQuat(d, i1, qb);
  // q and -q are the same rotation: take the short way round
  const s = qa.x * qb.x + qa.y * qb.y + qa.z * qb.z + qa.w * qb.w < 0 ? -1 : 1;
  out.set(
    qa.x + (qb.x * s - qa.x) * k,
    qa.y + (qb.y * s - qa.y) * k,
    qa.z + (qb.z * s - qa.z) * k,
    qa.w + (qb.w * s - qa.w) * k,
  );
  out.normalize();
  return true;
}

/** hips position at time t, in standing-hips units (so ~[0, 1, 0] when standing) */
export function sampleHips(c: Clip, t: number, out: THREE.Vector3): THREE.Vector3 {
  const { i0, i1, k } = frameAt(c, t);
  const h = c.hips;
  const at = (j: number) => h[i0 * 3 + j] + (h[i1 * 3 + j] - h[i0 * 3 + j]) * k;
  return out.set(at(0), at(1), at(2)).multiplyScalar(HIPS_SCALE);
}

/** average hips height of a clip, in standing-hips units (used to lower a sitting body onto its seat) */
export function meanHipsY(name: string): number {
  const c = clip(name);
  if (!c) return 1;
  let y = 0;
  for (let i = 0; i < c.n; i++) y += c.hips[i * 3 + 1];
  return (y / c.n) * HIPS_SCALE;
}
