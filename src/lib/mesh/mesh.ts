import type { Vec3 } from "../vec";
import { cross, length, normalize, scale } from "../vec";

/**
 * A polygon mesh: the serialisable form of every object's geometry.
 * Vertices are in the object's unit space (the object's size scales them).
 * Faces are vertex-index loops, counter-clockwise seen from outside.
 */
export interface Mesh {
  v: Vec3[];
  f: number[][];
  /** material slot per face */
  fm: number[];
  /** texture coordinates per face corner; dropped when the topology changes */
  uv?: UV[][];
}
export type UV = [number, number];

export function cloneMesh(m: Mesh): Mesh {
  const copy: Mesh = { v: m.v.map((p) => [...p]), f: m.f.map((p) => [...p]), fm: [...m.fm] };
  if (hasUV(m)) copy.uv = m.uv!.map((face) => face.map((q) => [...q]));
  return copy;
}

export function hasUV(m: Mesh): boolean {
  if (!m.uv || m.uv.length !== m.f.length) return false;
  return m.uv.every((corners, i) => corners.length === m.f[i].length);
}

export const edgeKey = (a: number, b: number): string => (a < b ? `${a}_${b}` : `${b}_${a}`);

export function parseEdgeKey(key: string): [number, number] {
  const i = key.indexOf("_");
  return [+key.slice(0, i), +key.slice(i + 1)];
}

/** a key that treats points closer than 0.1 mm as the same */
export const pointKey = (p: ArrayLike<number>): string =>
  `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;

/** Newell's method: robust for n-gons and slightly bent faces */
function newellNormal(m: Mesh, face: number[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < face.length; i++) {
    const a = m.v[face[i]];
    const b = m.v[face[(i + 1) % face.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

export const faceNormal = (m: Mesh, face: number[]): Vec3 => normalize(newellNormal(m, face));
export const faceArea = (m: Mesh, face: number[]): number => length(newellNormal(m, face)) / 2;

export function faceCenter(m: Mesh, face: number[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const i of face) {
    c[0] += m.v[i][0];
    c[1] += m.v[i][1];
    c[2] += m.v[i][2];
  }
  return scale(c, 1 / face.length);
}

export function signedVolume(m: Mesh): number {
  let volume = 0;
  for (const face of m.f) {
    const a = m.v[face[0]];
    for (let i = 1; i < face.length - 1; i++) {
      const b = m.v[face[i]];
      const c = m.v[face[i + 1]];
      volume += (a[0] * cross(b, c)[0] + a[1] * cross(b, c)[1] + a[2] * cross(b, c)[2]) / 6;
    }
  }
  return volume;
}

export function triangleCount(m: Mesh): number {
  let n = 0;
  for (const face of m.f) n += Math.max(0, face.length - 2);
  return n;
}
