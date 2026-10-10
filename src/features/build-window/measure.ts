/** Measurements of the element selection, in metres: distance between two points, edge length, face area. */
import type * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import { faceArea, parseEdgeKey } from "@/lib/mesh/mesh";
import type { ElementSelection } from "@/lib/mesh/selection";
import { selectedFaces } from "@/lib/mesh/selection";
import type { Vec3 } from "@/lib/vec";
import type { Obj } from "@/world/model";
import { fmt } from "@/ui/dom";
import type { Build } from "./context";

/** total area of faces in metres: the mesh is scaled by the object's size (rotation and position don't matter) */
export function scaledArea(m: Mesh, faces: Iterable<number>, size: Vec3): number {
  const v = m.v.map((p): Vec3 => [p[0] * size[0], p[1] * size[1], p[2] * size[2]]);
  const scaled: Mesh = { v, f: m.f, fm: m.fm };
  let area = 0;
  for (const f of faces) area += faceArea(scaled, m.f[f]);
  return area;
}

type WorldVerts = (ids: number[]) => THREE.Vector3[];

function pointDistance(s: ElementSelection, world: WorldVerts): string | null {
  if (s.verts.size !== 2 || s.edges.size || s.faces.size) return null;
  const [p, q] = world([...s.verts]);
  return p && q ? `Distance between points: <b>${fmt(p.distanceTo(q))} m</b>` : null;
}

function edgeLength(s: ElementSelection, world: WorldVerts): string | null {
  if (!s.edges.size) return null;
  let length = 0;
  for (const k of s.edges) {
    const [p, q] = world(parseEdgeKey(k));
    if (p && q) length += p.distanceTo(q);
  }
  return `${s.edges.size === 1 ? "Edge length" : "Total edge length"}: <b>${fmt(length)} m</b>`;
}

function faceAreaLine(o: Obj, s: ElementSelection): string | null {
  const faces = selectedFaces(o.mesh, s);
  if (!faces.size) return null;
  const area = scaledArea(o.mesh, faces, o.size);
  return `${faces.size === 1 ? "Face area" : "Total face area"}: <b>${fmt(area, 3)} m²</b>`;
}

export function measure(b: Build, o: Obj): string {
  const s = b.deps.store.selection.elements;
  const world: WorldVerts = (ids) => b.deps.renderer.picker.worldVerts(o, ids);
  const out = [pointDistance(s, world), edgeLength(s, world), faceAreaLine(o, s)].filter((x): x is string => !!x);
  return out.length ? `<div class="measure">${out.join("<br>")}</div>` : "";
}
