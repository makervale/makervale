import type { Vec3 } from "../../vec";
import type { Mesh, UV } from "../mesh";

/**
 * OBJ text → objects. Supports v, vt, f (v, v/vt, v//vn, v/vt/vn, negative indices), o/g and usemtl.
 * `g` starts an object only when the file has no `o` lines. Y-up → Z-up: (x, y, z) → (x, −z, y).
 * Each object keeps only the vertices it uses; `mesh.uv` is set when every corner has a vt.
 */
export interface ObjObject {
  name: string;
  mesh: Mesh;
  materials: string[];
}

interface Part {
  name: string;
  f: number[][];
  /** vt indices per face, or null when some corner has none */
  ft: (number[] | null)[];
  slot: number[];
  mats: string[];
  /** the current material slot, -1 before any */
  cur: number;
}

const DEFAULT_MATERIAL = "Material";

/** an OBJ index (1-based, or negative from the end) → 0-based, NaN when absent */
const resolve = (raw: string | undefined, count: number): number => {
  const i = raw ? parseInt(raw, 10) : NaN;
  if (!i) return NaN;
  return i < 0 ? count + i : i - 1;
};

class ObjReader {
  readonly out: ObjObject[] = [];
  private readonly verts: Vec3[] = [];
  private readonly uvs: UV[] = [];
  private part: Part | null = null;
  private unnamed = 0;
  private pendingMat: string | null = null;

  constructor(private readonly groupsAreObjects: boolean) {}

  line(kw: string, rest: string): void {
    const nums = (): number[] => rest.split(/\s+/).map(Number);
    if (kw === "v") {
      const [x, y, z] = nums();
      this.verts.push([x || 0, -(z || 0), y || 0]);
    } else if (kw === "vt") {
      const [u, v] = nums();
      this.uvs.push([u || 0, v || 0]);
    } else {
      this.structure(kw, rest);
    }
  }

  /** objects, materials and faces */
  private structure(kw: string, rest: string): void {
    if (kw === "o" || (kw === "g" && this.groupsAreObjects)) {
      this.start(rest || this.nextName());
    } else if (kw === "usemtl") {
      this.pendingMat = rest || DEFAULT_MATERIAL;
      this.useMaterial(this.current(), this.pendingMat);
    } else if (kw === "f") {
      this.face(rest);
    }
  }

  private nextName = (): string => `Object ${++this.unnamed}`;

  private start(name: string): Part {
    this.flush();
    this.part = { name, f: [], ft: [], slot: [], mats: [], cur: -1 };
    return this.part;
  }

  private current(): Part {
    return this.part ?? this.start(this.nextName());
  }

  private useMaterial(p: Part, name: string): void {
    let i = p.mats.indexOf(name);
    if (i < 0) i = p.mats.push(name) - 1;
    p.cur = i;
  }

  private face(rest: string): void {
    const p = this.current();
    // the material carries over into a new `o`
    if (p.cur < 0) this.useMaterial(p, this.pendingMat ?? DEFAULT_MATERIAL);
    const vi: number[] = [];
    const ti: number[] = [];
    for (const tok of rest.split(/\s+/)) {
      const [a, b] = tok.split("/");
      const v = resolve(a, this.verts.length);
      if (isNaN(v)) continue;
      vi.push(v);
      const t = resolve(b, this.uvs.length);
      ti.push(isNaN(t) ? -1 : t);
    }
    // drop consecutive repeats (and a closing duplicate), keeping the matching vt
    const keep = vi.map((x, k) => x >= 0 && x < this.verts.length && x !== vi[(k + vi.length - 1) % vi.length]);
    const f = vi.filter((_, k) => keep[k]);
    const t = ti.filter((_, k) => keep[k]);
    if (f.length < 3 || new Set(f).size !== f.length) return;
    p.f.push(f);
    p.slot.push(p.cur);
    p.ft.push(t.every((x) => x >= 0 && x < this.uvs.length) ? t : null);
  }

  flush(): void {
    const p = this.part;
    if (!p || !p.f.length) return;
    const map = new Map<number, number>();
    const v: Vec3[] = [];
    const local = (i: number): number => {
      if (!map.has(i)) map.set(i, v.push([...this.verts[i]]) - 1);
      return map.get(i)!;
    };
    const mesh: Mesh = { v, f: p.f.map((face) => face.map(local)), fm: p.slot };
    if (p.ft.every((t) => t)) mesh.uv = p.ft.map((t) => t!.map((i): UV => [...this.uvs[i]]));
    this.out.push({ name: p.name, mesh, materials: p.mats.length ? p.mats : [DEFAULT_MATERIAL] });
  }
}

export function parseOBJ(text: string): ObjObject[] {
  const reader = new ObjReader(!/^\s*o\s/m.test(text));
  for (const raw of text.replace(/\\\r?\n/g, " ").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === "#") continue;
    const sp = line.indexOf(" ");
    reader.line(sp < 0 ? line : line.slice(0, sp), sp < 0 ? "" : line.slice(sp + 1).trim());
  }
  reader.flush();
  return reader.out;
}
