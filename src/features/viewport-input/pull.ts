/**
 * Shift+drag on an element pulls new geometry out of it: a vertex grows a spike, an inner edge gets a new point,
 * a border edge grows a new face. The new element is then dragged like any other.
 */
import type * as THREE from "three";
import { parseEdgeKey } from "@/lib/mesh/mesh";
import { extrudeEdges } from "@/lib/mesh/ops/extrude";
import { insertVertexOnEdge } from "@/lib/mesh/ops/connect";
import { spikeVertex } from "@/lib/mesh/ops/spike";
import type { ElementSelection } from "@/lib/mesh/selection";
import { emptySelection } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import type { Obj } from "@/world/model";
import type { InputCtx, PullDrag } from "./state";

/** the spike's base ring, in pixels at the point grabbed */
const SPIKE_RADIUS_PX = 14;
const EDGE_MARGIN = 0.02;

export function pullFromElement(ctx: InputCtx, d: PullDrag, x: number, y: number): void {
  const { store, commands, manip, renderer } = ctx;
  const t = store.editTarget();
  if (!t || t.locked || d.el.type === "f") return;
  const el = d.el;
  const hitPoint = d.hit?.point ?? manip.pivotOf([t]);
  commands.startHeld(el.type === "v" ? "Spike" : "Extrude edge", [t.id]);
  let sel = emptySelection();
  commands.apply([t.id], () => {
    if (el.type === "v") {
      const radius = renderer.picker.worldPerPixel(hitPoint) * SPIKE_RADIUS_PX;
      sel.verts.add(spikeVertex(t.mesh, el.id, radius, t.size).tip);
    } else sel = pullEdge(ctx, t, el.id, hitPoint);
  });
  commands.setElements(sel);
  if (store.selection.mode === "face") commands.setMode("auto");
  const track = ctx.track!;
  manip.startGrab({ hitPoint, x: track.sx, y: track.sy, shift: false, elem: true });
  manip.move(x, y);
}

/** a border edge grows a face; an inner edge gets a new point where it was grabbed */
function pullEdge(ctx: InputCtx, t: Obj, key: string, hitPoint: THREE.Vector3): ElementSelection {
  const m = t.mesh;
  const edge = topologyOf(m).edges.get(key);
  if (edge && edge.faces.length === 1) return extrudeEdges(m, new Set([key]));
  const [A, B] = ctx.renderer.picker.worldVerts(t, parseEdgeKey(key));
  const AB = B.clone().sub(A);
  const f = hitPoint.clone().sub(A).dot(AB) / Math.max(1e-9, AB.lengthSq());
  const sel = emptySelection();
  sel.verts.add(insertVertexOnEdge(m, key, Math.min(1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, f))));
  return sel;
}
