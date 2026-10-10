/**
 * Tools that first wait for a click on the mesh: the loop cut (which edge) and the knife (where to cut). While
 * waiting, what a click would pick is highlighted.
 */
import { edgeKey, parseEdgeKey } from "@/lib/mesh/mesh";
import { edgeRing } from "@/lib/mesh/edge-loops";
import { emptySelection } from "@/lib/mesh/selection";
import { topologyOf } from "@/lib/mesh/topology";
import { connectVerts, insertVertexOnEdge } from "@/lib/mesh/ops/connect";
import type { Obj } from "@/world/model";
import type { LiveEnv } from "./env";
import { clamp } from "./env";
import { knifeAcross } from "./knife-across";
import { begin, cancelLive } from "./lifecycle";

/** a new point on an edge stays this far from its ends (fraction of the edge) */
const EDGE_MARGIN = 0.02;

export function hoverPick(env: LiveEnv, x: number, y: number): void {
  const target = env.store.editTarget();
  const L = env.live;
  if (!target || !L) return;
  const { renderer } = env;
  if (L.tool.live!.pick === "edge") {
    const el = renderer.pickElement(x, y, "edge");
    const key = el?.type === "e" ? el.id : null;
    renderer.preselect.showEdges(key ? target : null, key ? [key, ...edgeRing(target.mesh, key)] : []);
    return;
  }
  const el = renderer.pickElement(x, y, "auto");
  renderer.preselect.show(target, el && el.type !== "f" ? el : null);
}

export function pickClick(env: LiveEnv, x: number, y: number): void {
  const L = env.live!;
  const target = env.store.editTarget();
  if (!target) {
    cancelLive(env);
    return;
  }
  if (L.tool.live!.pick === "knife") {
    knifeClick(env, x, y, target);
    return;
  }
  const el = env.renderer.pickElement(x, y, "edge");
  if (el?.type !== "e") return;
  const sel = emptySelection();
  sel.edges.add(el.id);
  env.commands.setElements(sel);
  env.live = null;
  env.renderer.preselect.clear();
  begin(env, L.tool);
}

/** where on the edge the cursor is, as a fraction from its first vertex */
function fractionAlong(env: LiveEnv, o: Obj, key: string, x: number, y: number): number {
  const [a, b] = parseEdgeKey(key);
  const [A, B] = env.renderer.picker.worldVerts(o, [a, b]);
  const P = env.renderer.picker.pickWorld(x, y, o.id)?.point ?? A;
  const AB = B.clone().sub(A);
  return clamp(P.clone().sub(A).dot(AB) / Math.max(1e-9, AB.lengthSq()), EDGE_MARGIN, 1 - EDGE_MARGIN);
}

/** each click adds a point (on a vertex, or a new one on an edge) and cuts from the previous point to it */
function knifeClick(env: LiveEnv, x: number, y: number, o: Obj): void {
  const L = env.live!;
  const el = env.renderer.pickElement(x, y, "auto");
  if (!el || el.type === "f") return;
  if (!L.knife) {
    env.commands.startHeld("Knife", [o.id]);
    L.knife = { pts: [] };
  }
  const pts = L.knife.pts;
  const m = o.mesh;
  let vi = 0;
  env.commands.apply([o.id], () => {
    vi = el.type === "v" ? el.id : insertVertexOnEdge(m, el.id, fractionAlong(env, o, el.id, x, y));
    const prev = pts[pts.length - 1];
    if (prev === undefined || prev === vi || topologyOf(m).edges.has(edgeKey(prev, vi))) return;
    // two points on one face connect directly; on different faces, cut every visible face between them
    if (!connectVerts(m, new Set([prev, vi])).edges.size) knifeAcross(env, o, prev, vi);
  });
  pts.push(vi);
  const sel = emptySelection();
  sel.verts.add(vi);
  env.commands.setElements(sel);
}
