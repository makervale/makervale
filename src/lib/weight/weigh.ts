/**
 * What an object costs everyone who has it: the triangles their graphics card draws, and the vertices they receive
 * and keep. Only integer arithmetic on the object's own data, so every browser gets the same number. Scripts are
 * not weighed here: they pay in gas (script/gas.ts).
 */
import type { Quat, Vec3 } from "@/lib/vec";
import { add, mul3, rotate } from "@/lib/vec";

/** what weighing needs of an object (world's Obj has it all) */
export interface Shape {
  pos: Vec3;
  quat: Quat;
  size: Vec3;
  mesh: { v: Vec3[]; f: number[][] };
}

export function triangles(o: Shape): number {
  let n = 0;
  for (const f of o.mesh.f) if (f.length > 2) n += f.length - 2;
  return n;
}

export const weightOf = (o: Shape): number => triangles(o) + Math.ceil(o.mesh.v.length / 2);

export interface Box {
  lo: Vec3;
  hi: Vec3;
}

/** the object's box in the world: its mesh box scaled, turned and placed, then boxed again along the axes */
export function worldBox(o: Shape): Box {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of o.mesh.v) {
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], v[i]);
      hi[i] = Math.max(hi[i], v[i]);
    }
  }
  if (!o.mesh.v.length) return { lo: [...o.pos], hi: [...o.pos] };
  const out: Box = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
  for (let c = 0; c < 8; c++) {
    const corner: Vec3 = [c & 1 ? hi[0] : lo[0], c & 2 ? hi[1] : lo[1], c & 4 ? hi[2] : lo[2]];
    const p = add(o.pos, rotate(mul3(corner, o.size), o.quat));
    for (let i = 0; i < 3; i++) {
      out.lo[i] = Math.min(out.lo[i], p[i]);
      out.hi[i] = Math.max(out.hi[i], p[i]);
    }
  }
  return out;
}
