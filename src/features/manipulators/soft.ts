/**
 * How much each vertex follows an element drag: the selected ones fully, their neighbours within the soft radius
 * partly (a smooth falloff), and with X mirror on, the twin on the other side of X = 0 copies what its side does.
 */
import * as THREE from "three";
import { pointKey } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { selectedVerts } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";

export interface SoftWeights {
  /** 0 … 1 per vertex */
  W: Float32Array;
  /** vertex → its mirror twin across X = 0 (object space) */
  mirror: Map<number, number> | null;
}

/** 1 at the centre, 0 at the radius, smooth at both ends */
export const falloff = (d: number, radius: number): number =>
  d < radius ? Math.pow(1 - Math.pow(d / radius, 2), 2) : 0;

function nearest(p: THREE.Vector3, among: THREE.Vector3[]): number {
  let d = Infinity;
  for (const q of among) d = Math.min(d, p.distanceTo(q));
  return d;
}

export function mirrorTwins(v: Vec3[]): Map<number, number> {
  const byKey = new Map(v.map((p, i) => [pointKey(p), i]));
  const twins = new Map<number, number>();
  v.forEach((p, i) => {
    const j = byKey.get(pointKey([-p[0], p[1], p[2]]));
    if (j !== undefined && j !== i) twins.set(i, j);
  });
  return twins;
}

export function softWeights(
  o: Obj,
  M: THREE.Matrix4,
  sel: ElementSelection,
  radius: number,
  mirror: boolean,
): SoftWeights {
  const m = o.mesh;
  const S = selectedVerts(m, sel);
  const W = new Float32Array(m.v.length);
  const world = m.v.map((v) => new THREE.Vector3().fromArray(v).applyMatrix4(M));
  const centres = [...S].map((i) => world[i]);
  for (let i = 0; i < m.v.length; i++) {
    if (S.has(i)) W[i] = 1;
    else if (radius) W[i] = falloff(nearest(world[i], centres), radius);
  }
  return { W, mirror: mirror ? mirrorTwins(m.v) : null };
}

/**
 * Move the vertices from where they started: `fn` takes a world point and returns where it goes. Partly weighted
 * vertices go part of the way.
 */
export function applyToVerts(
  o: Obj,
  M: THREE.Matrix4,
  start: Vec3[],
  soft: SoftWeights,
  fn: (p: THREE.Vector3) => THREE.Vector3,
): void {
  const Mi = M.clone().invert();
  const moved = new Map<number, THREE.Vector3>();
  for (let i = 0; i < o.mesh.v.length; i++) {
    const w = soft.W[i];
    if (!w) continue;
    const p = new THREE.Vector3().fromArray(start[i]).applyMatrix4(M);
    const q = fn(p.clone());
    if (w < 1) q.lerpVectors(p, q, w);
    const l = q.applyMatrix4(Mi);
    o.mesh.v[i] = [l.x, l.y, l.z];
    moved.set(i, l);
  }
  if (!soft.mirror) return;
  for (const [i, l] of moved) {
    const j = soft.mirror.get(i);
    if (j !== undefined && !moved.has(j)) o.mesh.v[j] = [-l.x, l.y, l.z];
  }
}
