/** Which way a live tool's distance runs: the selection's normal in the world, and that direction on screen. */
import * as THREE from "three";
import type { ToolContext } from "@/app/tools";
import { faceNormal, parseEdgeKey } from "@/lib/mesh/mesh";
import { topologyOf } from "@/lib/mesh/topology";
import type { Vec3 } from "@/lib/vec";
import type { ObjectViews } from "@/render/objects";
import type { Picker } from "@/render/picking";
import type { ScreenAxis } from "./env";

/** an axis seen almost end-on (shorter than this on screen, per pixel) falls back to "drag up = more" */
const END_ON = 0.35;
const PROBE_PX = 100;

function regionFaces(ctx: ToolContext): Set<number> {
  const m = ctx.mesh!;
  const faces = new Set<number>(ctx.selection.faces);
  if (faces.size) return faces;
  const vertFaces = topologyOf(m).vertFaces;
  const verts = [...ctx.selection.verts];
  for (const k of ctx.selection.edges) verts.push(...parseEdgeKey(k));
  for (const i of verts) for (const f of vertFaces[i]) faces.add(f);
  return faces;
}

/** world-space average normal of the selection (for axis tools without their own axis) */
export function regionNormal(ctx: ToolContext, views: ObjectViews): Vec3 | null {
  const o = ctx.obj;
  if (!o || !ctx.mesh) return null;
  const m = ctx.mesh;
  const faces = regionFaces(ctx);
  if (!faces.size) return [0, 0, 1];
  const n = new THREE.Vector3();
  for (const f of faces) n.add(new THREE.Vector3().fromArray(faceNormal(m, m.f[f])));
  const M = views.worldMatrixOf(o);
  if (n.lengthSq() < 1e-12 || !M) return [0, 0, 1];
  return n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(M)).normalize().toArray() as Vec3;
}

/** the axis's direction on screen at the pivot, so the value never jumps when the axis is seen end-on */
export function screenAxis(picker: Picker, pivot: THREE.Vector3, A: THREE.Vector3): ScreenAxis {
  const wpp = picker.worldPerPixel(pivot);
  const a = picker.screenOf(pivot);
  const b = picker.screenOf(pivot.clone().addScaledVector(A, wpp * PROBE_PX));
  const d = new THREE.Vector2(b.x - a.x, b.y - a.y);
  const len = d.length() / PROBE_PX;
  if (len < END_ON) return { dir: new THREE.Vector2(0, -1), ppm: 1 / wpp };
  return { dir: d.normalize(), ppm: len / wpp };
}
