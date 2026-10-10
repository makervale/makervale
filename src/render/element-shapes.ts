/** Small geometries for drawing mesh elements (in the object's local space) on top of an object. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import { parseEdgeKey } from "@/lib/mesh/mesh";

export function positions(flat: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(flat, 3));
  return g;
}

/** line segments for a set of edge keys */
export function edgeLines(m: Mesh, keys: Iterable<string>): number[] {
  const out: number[] = [];
  for (const key of keys) {
    const [a, b] = parseEdgeKey(key);
    const A = m.v[a];
    const B = m.v[b];
    if (A && B) out.push(...A, ...B);
  }
  return out;
}

/** the triangles (as a fan) of a set of faces */
export function faceTriangles(m: Mesh, faces: Iterable<number>): number[] {
  const out: number[] = [];
  for (const fi of faces) {
    const face = m.f[fi];
    if (!face) continue;
    for (let i = 1; i < face.length - 1; i++) out.push(...m.v[face[0]], ...m.v[face[i]], ...m.v[face[i + 1]]);
  }
  return out;
}

export function vertexPoints(m: Mesh, ids: Iterable<number>): number[] {
  const out: number[] = [];
  for (const i of ids) if (m.v[i]) out.push(...m.v[i]);
  return out;
}

export function pointsMaterial(color: string, size: number, depthTest = true): THREE.PointsMaterial {
  return new THREE.PointsMaterial({ color, size, sizeAttenuation: false, depthTest });
}

export function faceFill(color: string, opacity: number, offset: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -offset,
    polygonOffsetUnits: -offset,
  });
}
