/**
 * Stretching by the box handles: a face handle stretches along its axis, a corner scales evenly. With "both sides"
 * on, the opposite side moves too (the centre stays); otherwise the opposite side stays put.
 */
import * as THREE from "three";
import type { Vec3 } from "@/lib/vec";
import { fmt } from "@/ui/dom";
import { across, applyElem, hitPlane, restoreStart, SNAP_DISTANCE_PX } from "./drag-common";
import type { StretchDrag } from "./drag-types";
import type { ManipEnv } from "./env";
import { worldPerPixel } from "./env";
import { AXES } from "./handle";

const AXIS_NAMES = "XYZ";
const MIN_SIZE_M = 0.005;
const MAX_SIZE_M = 1000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Pull {
  along: number;
  perp: THREE.Vector3;
  inSnap: boolean;
  unit: number;
}

export function stretchMove(env: ManipEnv, d: StretchDrag, x: number, y: number): boolean {
  restoreStart(env, d);
  const hit = hitPlane(env, x, y, d.plane);
  if (!hit) return false;
  const along = hit.clone().sub(d.hit0).dot(d.A);
  const off = hit.clone().sub(d.handle0);
  off.addScaledVector(d.A, -off.dot(d.A));
  const offPx = off.length() / worldPerPixel(env, d.handle0);
  const pull: Pull = {
    along,
    perp: across(off, d.n, d.A),
    inSnap: env.store.settings.snap && offPx > SNAP_DISTANCE_PX,
    unit: env.rulers.unit(d.handle0, d.A),
  };
  const label = d.kind === "face" ? stretchFace(env, d, pull) : scaleCorner(env, d, pull);
  env.badge.show(x, y, label, pull.inSnap);
  return true;
}

function stretchFace(env: ManipEnv, d: StretchDrag, pull: Pull): string {
  const f0 = d.frame0;
  const i = d.axis;
  const both = env.store.settings.stretchBothSides;
  const s0 = f0.size.getComponent(i);
  let ns = s0 + pull.along * (both ? 2 : 1);
  if (pull.inSnap) ns = Math.max(pull.unit, Math.round(ns / pull.unit) * pull.unit);
  ns = clamp(ns, MIN_SIZE_M, MAX_SIZE_M);
  const k = ns / Math.max(s0, 1e-6);
  const shift = both ? 0 : (ns - s0) / 2;
  const axisW = AXES[i].clone().applyQuaternion(f0.q);
  const anchor = both ? f0.center.clone() : f0.center.clone().addScaledVector(d.A, -s0 / 2);
  const stretch = (p: THREE.Vector3) => p.addScaledVector(axisW, p.clone().sub(anchor).dot(axisW) * (k - 1));
  if (d.elem) applyElem(env, d, stretch);
  else if (f0.single) stretchSingle(env, d, { axisW, k, shift });
  else stretchMany(env, d, stretch, axisW, k);
  d.frame = {
    center: f0.center.clone().addScaledVector(d.A, shift),
    q: f0.q,
    size: f0.size.clone().setComponent(i, ns),
  };
  env.rulers.ruler({ p0: d.handle0, A: d.A, perp: pull.perp, unit: pull.unit, active: pull.inSnap, along: ns - s0 });
  return `${AXIS_NAMES[i]} ${fmt(ns)} m${pull.inSnap ? " · step " + fmt(pull.unit) : ""}`;
}

/** one object: its size changes along the axis, and its mesh centre stays where it was (scaled along the axis) */
function stretchSingle(env: ManipEnv, d: StretchDrag, s: { axisW: THREE.Vector3; k: number; shift: number }): void {
  const o = env.store.selected()[0];
  const f0 = d.frame0;
  const size = [...o.size] as Vec3;
  size[d.axis] = d.start.objs[0].size[d.axis] * s.k;
  o.size = size;
  const relC = f0.objCenter.clone().sub(f0.center).dot(s.axisW);
  o.pos = f0.objCenter
    .clone()
    .addScaledVector(s.axisW, relC * (s.k - 1))
    .addScaledVector(d.A, s.shift)
    .toArray() as Vec3;
}

/** several objects: spread their positions along the axis and stretch each along its own closest axis */
function stretchMany(
  env: ManipEnv,
  d: StretchDrag,
  stretch: (p: THREE.Vector3) => THREE.Vector3,
  axisW: THREE.Vector3,
  k: number,
): void {
  for (const st of d.start.objs) {
    const o = env.store.byId(st.id);
    if (!o) continue;
    o.pos = stretch(new THREE.Vector3().fromArray(st.pos)).toArray() as Vec3;
    const R = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().fromArray(st.quat));
    let best = 0;
    let bd = 0;
    for (let j = 0; j < 3; j++) {
      const c = Math.abs(new THREE.Vector3().setFromMatrixColumn(R, j).dot(axisW));
      if (c > bd) [bd, best] = [c, j];
    }
    const size = [...st.size] as Vec3;
    size[best] = st.size[best] * (1 + (k - 1) * bd * bd);
    o.size = size;
  }
}

function scaleCorner(env: ManipEnv, d: StretchDrag, pull: Pull): string {
  const f0 = d.frame0;
  const both = env.store.settings.stretchBothSides;
  const span = both ? d.r0 : 2 * d.r0;
  const maxDim = Math.max(f0.size.x, f0.size.y, f0.size.z);
  let k = (span + pull.along) / span;
  if (pull.inSnap) k = Math.max(pull.unit, Math.round((maxDim * k) / pull.unit) * pull.unit) / maxDim;
  k = clamp(k, MIN_SIZE_M / Math.max(Math.min(f0.size.x, f0.size.y, f0.size.z), 1e-3), MAX_SIZE_M / maxDim);
  const anchor = both ? f0.center.clone() : f0.center.clone().multiplyScalar(2).sub(d.handle0);
  const scaled = (p: THREE.Vector3) => p.sub(anchor).multiplyScalar(k).add(anchor);
  if (d.elem) applyElem(env, d, scaled);
  else {
    for (const st of d.start.objs) {
      const o = env.store.byId(st.id);
      if (!o) continue;
      o.size = st.size.map((v) => v * k) as Vec3;
      o.pos = scaled(new THREE.Vector3().fromArray(st.pos)).toArray() as Vec3;
    }
  }
  d.frame = { center: scaled(f0.center.clone()), q: f0.q, size: f0.size.clone().multiplyScalar(k) };
  env.rulers.ruler({ p0: d.handle0, A: d.A, perp: pull.perp, unit: pull.unit, active: pull.inSnap });
  return `× ${fmt(k, 3)} · ${fmt(maxDim * k)} m`;
}
