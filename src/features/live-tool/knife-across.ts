/**
 * The knife between points on different faces: cut every visible face between them with the plane that contains
 * both points and the eye, which is what a straight stroke on the screen means.
 */
import * as THREE from "three";
import { faceCenter, faceNormal } from "@/lib/mesh/mesh";
import { bisect } from "@/lib/mesh/ops/bisect";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import type { LiveEnv } from "./env";

/** faces whose centre lies a little beyond the ends still count */
const END_SLACK = 0.02;
const SIDE_EPS = 1e-7;

function straddles(m: Obj["mesh"], face: number[], A: THREE.Vector3, n: THREE.Vector3): boolean {
  let pos = false;
  let neg = false;
  for (const i of face) {
    const d = new THREE.Vector3().fromArray(m.v[i]).sub(A).dot(n);
    if (d > SIDE_EPS) pos = true;
    else if (d < -SIDE_EPS) neg = true;
  }
  return pos && neg;
}

export function knifeAcross(env: LiveEnv, o: Obj, a: number, b: number): void {
  const m = o.mesh;
  const M = env.renderer.views.worldMatrixOf(o);
  if (!M) return;
  const eyeWorld = env.renderer.parts.camera.position;
  const A = new THREE.Vector3().fromArray(m.v[a]);
  const AB = new THREE.Vector3().fromArray(m.v[b]).sub(A);
  const eye = eyeWorld.clone().applyMatrix4(M.clone().invert());
  const n = new THREE.Vector3().crossVectors(AB, eye.sub(A)).normalize();
  if (n.lengthSq() < 1e-12) return;
  const L2 = AB.lengthSq();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(M);
  const faces = new Set<number>();
  m.f.forEach((face, fi) => {
    if (!straddles(m, face, A, n)) return;
    const c = new THREE.Vector3().fromArray(faceCenter(m, face));
    const t = c.clone().sub(A).dot(AB) / L2;
    if (t < -END_SLACK || t > 1 + END_SLACK) return;
    const facing = new THREE.Vector3().fromArray(faceNormal(m, face)).applyMatrix3(normalMatrix);
    if (facing.dot(eyeWorld.clone().sub(c.applyMatrix4(M))) > 0) faces.add(fi); // only what you see
  });
  if (!faces.size) {
    env.commands.notice("There are no visible faces to cut between these points");
    return;
  }
  bisect(m, faces, { p: A.toArray() as Vec3, n: n.toArray() as Vec3 });
}
