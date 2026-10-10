import type * as THREE from "three";
import { fromTriangles } from "../cleanup";
import { limitedDissolve } from "../limited-dissolve";
import type { Mesh } from "../mesh";
import { soupEps } from "./soup-eps";

/** glTF binary import. three.js and its loader are loaded on demand (from the CDN in the browser). */
export interface GlbObject {
  name: string;
  mesh: Mesh;
  /** the node's world matrix converted to Z-up, column-major (see affine.ts) */
  matrix: number[];
  materials: { name: string; color: string }[];
}

const DISSOLVE_DEG = 0.5;

/** the material slot of every triangle, from the geometry's groups */
function triangleSlots(g: THREE.BufferGeometry, count: number): Int32Array {
  const slots = new Int32Array(count);
  for (const gr of g.groups) {
    const end = Math.min(count, Math.floor((gr.start + gr.count) / 3));
    for (let t = Math.floor(gr.start / 3); t < end; t++) slots[t] = gr.materialIndex ?? 0;
  }
  return slots;
}

/** BufferGeometry (indexed or not, groups → material slots) → welded mesh dissolved into polygons */
export function geometryToMesh(g: THREE.BufferGeometry): Mesh {
  const pa = g.getAttribute("position");
  if (!pa) return { v: [], f: [], fm: [] };
  const pos = new Float64Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) pos.set([pa.getX(i), pa.getY(i), pa.getZ(i)], i * 3);
  const index = g.index ? Array.from(g.index.array as ArrayLike<number>) : null;
  const count = Math.floor((index ? index.length : pa.count) / 3);
  const m = fromTriangles(pos, index, triangleSlots(g, count), soupEps(pos));
  limitedDissolve(m, DISSOLVE_DEG);
  return m;
}

function materialsOf(mo: THREE.Mesh): { name: string; color: string }[] {
  const list = Array.isArray(mo.material) ? mo.material : [mo.material];
  return list.map((mt, i) => {
    const c = (mt as THREE.MeshStandardMaterial | undefined)?.color;
    return { name: mt?.name || `Material ${i + 1}`, color: `#${c ? c.getHexString() : "cccccc"}` };
  });
}

/** GLB → one entry per mesh node: geometry in its own space plus its world matrix. Textures are ignored. */
export async function parseGLB(buf: ArrayBuffer): Promise<GlbObject[]> {
  const three = await import("three");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().parseAsync(buf, "");
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const yToZ = new three.Matrix4().makeRotationX(Math.PI / 2);
  const out: GlbObject[] = [];
  let k = 0;
  scene.traverse((o) => {
    const mo = o as THREE.Mesh;
    if (!mo.isMesh || !mo.geometry) return;
    k++;
    const materials = materialsOf(mo);
    const mesh = geometryToMesh(mo.geometry);
    if (!mesh.f.length) return;
    // a single material: every group goes to slot 0
    mesh.fm = mesh.fm.map((s) => (s < materials.length ? s : 0));
    const matrix = yToZ.clone().multiply(mo.matrixWorld).elements.slice();
    out.push({ name: mo.name || mo.parent?.name || `Object ${k}`, mesh, matrix, materials });
  });
  return out;
}
