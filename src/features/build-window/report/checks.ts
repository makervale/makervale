/** "Check mesh": mesh health, and whether an object meets game engines' and 3D printing's limits. */
import type { EditMode } from "@/lib/mesh/selection";
import type { MeshReport } from "@/lib/mesh/validate";
import type { Obj } from "@/world/model";

const GAME_MANY_TRIS = 100000;
const MM_PER_M = 1000;

export type Level = "ok" | "warn" | "bad";

export interface Finding {
  level: Level;
  text: string;
  /** elements to select to show the problem */
  show?: { mode: EditMode; ids: (string | number)[] };
}

export interface Profiles {
  game: [Level, string];
  print: [Level, string];
}

/** the object's extent along each axis, in metres */
export function dimensions(o: Obj): number[] {
  return [0, 1, 2].map((k) => {
    const xs = o.mesh.v.map((v) => v[k] * o.size[k]);
    return xs.length ? Math.max(0, Math.max(...xs) - Math.min(...xs)) : 0;
  });
}

export function health(r: MeshReport): Finding[] {
  const out: Finding[] = [];
  if (r.open.length)
    out.push({ level: "warn", text: `${r.open.length} open edges (holes)`, show: { mode: "edge", ids: r.open } });
  else out.push({ level: "ok", text: "Mesh is closed" });
  if (r.nonManifold.length) {
    const text = `${r.nonManifold.length} edges shared by more than two faces`;
    out.push({ level: "bad", text, show: { mode: "edge", ids: r.nonManifold } });
  }
  if (r.flipped.length) {
    const text = `${r.flipped.length} edges between faces pointing the wrong way (use Recalculate normals)`;
    out.push({ level: "bad", text, show: { mode: "edge", ids: r.flipped } });
  } else out.push({ level: "ok", text: "Normals are consistent" });
  if (r.closed && r.volume < 0) out.push({ level: "bad", text: "The shape is inside out (Recalculate normals)" });
  if (r.degenerate.length) {
    out.push({
      level: "warn",
      text: `${r.degenerate.length} faces with zero area`,
      show: { mode: "face", ids: r.degenerate },
    });
  }
  if (r.ngons.length) {
    const text = `${r.ngons.length} polygons with more than 4 vertices (export will split them)`;
    out.push({ level: "warn", text, show: { mode: "face", ids: r.ngons } });
  }
  if (r.loose.length) out.push({ level: "warn", text: `${r.loose.length} loose vertices without faces` });
  if (r.parts > 1) out.push({ level: "ok", text: `${r.parts} separate parts in one object` });
  return out;
}

function gameEngine(r: MeshReport): [Level, string] {
  if (r.nonManifold.length || r.flipped.length) return ["warn", "fix normals"];
  if (r.tris > GAME_MANY_TRIS) return ["warn", `${r.tris} triangles is a lot`];
  return ["ok", `${r.tris} triangles`];
}

export function profiles(o: Obj, r: MeshReport): Profiles {
  const mm = dimensions(o).map((d) => (d * MM_PER_M).toFixed(0));
  let print: [Level, string] = ["ok", mm.join("×") + " mm"];
  if (!r.closed) print = ["bad", "mesh is not closed"];
  else if (r.flipped.length || r.volume < 0) print = ["bad", "normals need fixing"];
  return { game: gameEngine(r), print };
}
