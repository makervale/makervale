import type { Vec3 } from "../../vec";
import { cross, normalize, scale, sub } from "../../vec";
import type { Mat4 } from "../affine";
import { isMirroring, transformPoint } from "../affine";
import { fromTriangles } from "../cleanup";
import { limitedDissolve } from "../limited-dissolve";
import type { Mesh } from "../mesh";
import { triangulatePoly } from "../triangulate";
import { soupEps } from "./soup-eps";

/** Binary STL out, binary or ASCII STL in. STL is Z-up like the editor, in millimetres (slicers). */
const HEADER_BYTES = 80;
const TRIANGLE_BYTES = 50;
const MM_PER_M = 1000;
const DISSOLVE_DEG = 0.5;

function worldTriangles(meshes: { mesh: Mesh; matrix: Mat4 }[], unitScale: number): Vec3[][] {
  const tris: Vec3[][] = [];
  for (const { mesh, matrix } of meshes) {
    const P = mesh.v.map((p) => scale(transformPoint(matrix, p), unitScale));
    // a mirrored placement flips the winding
    const mirror = isMirroring(matrix);
    for (const face of mesh.f) {
      for (const [a, b, c] of triangulatePoly(mesh, face)) tris.push(mirror ? [P[a], P[c], P[b]] : [P[a], P[b], P[c]]);
    }
  }
  return tris;
}

/** Binary STL of all meshes in world space, coordinates × unitScale (metres → mm by default). */
export function toSTL(meshes: { mesh: Mesh; matrix: Mat4 }[], unitScale = MM_PER_M): ArrayBuffer {
  const tris = worldTriangles(meshes, unitScale);
  const buf = new ArrayBuffer(HEADER_BYTES + 4 + tris.length * TRIANGLE_BYTES);
  const dv = new DataView(buf);
  const head = "Piaskownica STL (mm, Z-up)";
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i));
  dv.setUint32(HEADER_BYTES, tris.length, true);
  let o = HEADER_BYTES + 4;
  for (const [a, b, c] of tris) {
    const n = normalize(cross(sub(b, a), sub(c, a)));
    for (const x of [...n, ...a, ...b, ...c]) {
      dv.setFloat32(o, x, true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

function binaryPositions(dv: DataView, count: number): Float32Array {
  const pos = new Float32Array(count * 9);
  for (let t = 0; t < count; t++) {
    for (let k = 0; k < 9; k++) {
      pos[t * 9 + k] = dv.getFloat32(HEADER_BYTES + 4 + t * TRIANGLE_BYTES + 12 + k * 4, true) / MM_PER_M;
    }
  }
  return pos;
}

/** every "vertex x y z" of an ASCII file, whole triangles only */
function asciiPositions(buf: ArrayBuffer): number[] {
  const text = new TextDecoder().decode(buf);
  const pos: number[] = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi;
  for (let r = re.exec(text); r; r = re.exec(text)) pos.push(+r[1] / MM_PER_M, +r[2] / MM_PER_M, +r[3] / MM_PER_M);
  pos.length -= pos.length % 9;
  return pos;
}

/** Binary or ASCII STL → mesh in metres, Z-up kept, welded and dissolved into polygons. */
export function parseSTL(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf);
  const count = buf.byteLength >= HEADER_BYTES + 4 ? dv.getUint32(HEADER_BYTES, true) : -1;
  // many binary files also start with "solid", so the size decides
  const binary = count >= 0 && HEADER_BYTES + 4 + count * TRIANGLE_BYTES === buf.byteLength;
  const pos = binary ? binaryPositions(dv, count) : asciiPositions(buf);
  const m = fromTriangles(pos, null, undefined, soupEps(pos));
  limitedDissolve(m, DISSOLVE_DEG);
  return m;
}
