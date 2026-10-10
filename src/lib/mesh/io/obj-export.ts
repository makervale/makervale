import type { Mat4 } from "../affine";
import { isMirroring, transformPoint } from "../affine";
import type { Mesh } from "../mesh";
import { uvValid } from "../uv";

/** OBJ + MTL export. OBJ is Y-up: (x, y, z) → (x, z, −y). The caller saves the MTL as "makervale.mtl". */
export interface ObjItem {
  name: string;
  mesh: Mesh;
  matrix: Mat4;
  materials: { name: string; color: string }[];
}

export const MTL_FILE = "makervale.mtl";
const FALLBACK = { name: "Material", color: "#cccccc" };

export const objName = (s: string): string => (s || "object").trim().replace(/\s+/g, "_");

/** a number with up to six decimals and no trailing zeros ("-0" → "0") */
function fmt(x: number): string {
  const s = x.toFixed(6).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

/** "#rgb" / "#rrggbb" → "r g b" in 0…1 (no colour-space conversion); anything else is light grey */
export function hexToKd(hex: string): string {
  let h = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? "cccccc";
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(" ");
}

/** unique material names: the same name with another colour gets a numbered variant */
class MaterialNames {
  readonly colors = new Map<string, string>();

  nameFor(name: string, color: string): string {
    const base = objName(name);
    const c = color.toLowerCase();
    let n = base;
    for (let i = 2; this.colors.has(n) && this.colors.get(n) !== c; i++) n = `${base}_${i}`;
    this.colors.set(n, c);
    return n;
  }
}

interface Bases {
  v: number;
  t: number;
}

/** the item's lines; advances the 1-based vertex and texture-coordinate bases */
function itemLines(it: ObjItem, names: MaterialNames, bases: Bases): string[] {
  const { mesh, matrix } = it;
  const withUV = uvValid(mesh);
  const out = [`o ${objName(it.name)}`];
  for (const v of mesh.v) {
    const p = transformPoint(matrix, v);
    out.push(`v ${fmt(p[0])} ${fmt(p[2])} ${fmt(-p[1])}`);
  }
  // per face, per corner: its vt index
  const vt: number[][] = [];
  if (withUV) {
    for (const face of mesh.uv!) {
      vt.push(face.map(() => bases.t++));
      for (const q of face) out.push(`vt ${fmt(q[0])} ${fmt(q[1])}`);
    }
  }
  out.push(...faceLines(it, names, { v: bases.v, vt: withUV ? vt : null }));
  bases.v += mesh.v.length;
  return out;
}

/** faces grouped by slot so each material is switched to once */
function faceLines(it: ObjItem, names: MaterialNames, idx: { v: number; vt: number[][] | null }): string[] {
  const { mesh } = it;
  const mirror = isMirroring(it.matrix);
  const order = mesh.f.map((_, i) => i).sort((a, b) => mesh.fm[a] - mesh.fm[b] || a - b);
  const out: string[] = [];
  let current = -1;
  for (const fi of order) {
    const s = mesh.fm[fi];
    if (s !== current) {
      current = s;
      const mt = it.materials[s] ?? it.materials[0] ?? FALLBACK;
      out.push(`usemtl ${names.nameFor(mt.name, mt.color)}`);
    }
    const corners = mesh.f[fi].map((_, k) => k);
    if (mirror) corners.reverse();
    const ref = (k: number): string =>
      idx.vt ? `${mesh.f[fi][k] + idx.v}/${idx.vt[fi][k]}` : `${mesh.f[fi][k] + idx.v}`;
    out.push(`f ${corners.map(ref).join(" ")}`);
  }
  return out;
}

/** OBJ + MTL text: polygons kept, one `o` per item, `usemtl` per slot, `vt` per corner when UVs are valid */
export function toOBJ(items: ObjItem[]): { obj: string; mtl: string } {
  const names = new MaterialNames();
  const bases: Bases = { v: 1, t: 1 };
  const obj = ["# Piaskownica", `mtllib ${MTL_FILE}`];
  for (const it of items) obj.push(...itemLines(it, names, bases));
  const mtl = ["# Piaskownica"];
  for (const [n, color] of names.colors) {
    mtl.push("", `newmtl ${n}`, `Kd ${hexToKd(color)}`, "Ka 0 0 0", "Ks 0 0 0", "d 1", "illum 1");
  }
  return { obj: `${obj.join("\n")}\n`, mtl: `${mtl.join("\n")}\n` };
}
