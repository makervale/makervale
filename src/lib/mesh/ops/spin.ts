import type { Vec3 } from "../../vec";
import { div3, mul3 } from "../../vec";
import type { Axis } from "../axis";
import { degToRad, isFullTurn, rotateAbout } from "../axis";
import type { Mesh } from "../mesh";
import { edgeKey, parseEdgeKey } from "../mesh";
import { safeSize } from "../scaled";
import type { ElementSelection } from "../selection";
import { emptySelection } from "../selection";
import { invalidateTopology, topologyOf } from "../topology";
import { deleteFaces } from "./delete";
import { extrude, extrudeEdges } from "./extrude";
import { weld } from "./merge";
import { recalcNormals } from "./normals";
import { dropOrphans, dropTwinFaces, remapFaces } from "./rewrite";

/** A sweep around an axis given in metres, in the object's space. */
export interface Sweep {
  axis: Axis;
  angleDeg: number;
  steps: number;
}

/** welding tolerances, in unit space: the seam of a full turn is closed, a partial sweep only fuses the axis */
const SEAM_WELD_M = 1e-5;
const AXIS_WELD = 1e-7;

interface Turn {
  steps: number;
  full: boolean;
  /** turns some vertices by one step */
  rotate: (ids: Iterable<number>) => void;
  /** the largest size component, to express metre tolerances in unit space */
  scale: number;
}

function makeTurn(m: Mesh, sweep: Sweep, size: Vec3): Turn {
  const steps = Math.max(1, Math.round(sweep.steps));
  const step = degToRad(sweep.angleDeg) / steps;
  const rotate = (ids: Iterable<number>): void => {
    for (const i of new Set(ids)) m.v[i] = div3(rotateAbout(mul3(m.v[i], size), sweep.axis, step), size);
  };
  return { steps, full: isFullTurn(sweep.angleDeg), rotate, scale: Math.max(...size) };
}

/** is every edge of these faces shared only with faces of the same set (a free-floating profile)? */
function isIsolated(m: Mesh, faces: Set<number>): boolean {
  const t = topologyOf(m);
  return [...faces].every((fi) => {
    const face = m.f[fi];
    return face.every((a, k) => t.edges.get(edgeKey(a, face[(k + 1) % face.length]))!.faces.every((f) => faces.has(f)));
  });
}

/** sweep faces into a solid of revolution */
function spinFaces(m: Mesh, faces: Set<number>, turn: Turn): void {
  const isolated = isIsolated(m, faces);
  const startCaps = isolated ? [...faces].map((fi) => ({ face: m.f[fi].slice().reverse(), slot: m.fm[fi] })) : [];
  let region = new Set(faces);
  for (let k = 0; k < turn.steps; k++) {
    region = extrude(m, region).faces;
    turn.rotate([...region].flatMap((f) => m.f[f]));
  }
  if (turn.full) {
    // the swept region came back to the start: drop it and stitch the seam
    if (isolated) deleteFaces(m, region);
    weld(m, SEAM_WELD_M / turn.scale);
    dropTwinFaces(m);
    return;
  }
  for (const cap of startCaps) {
    m.f.push(cap.face);
    m.fm.push(cap.slot);
  }
  weld(m, AXIS_WELD);
}

/** sweep open border edges into a surface */
function spinEdges(m: Mesh, edges: Set<string>, turn: Turn): void {
  const t = topologyOf(m);
  if (![...edges].some((k) => t.edges.get(k)?.faces.length === 1)) {
    throw new Error("Spin: select the profile faces or the border edges of an open mesh");
  }
  let current = new Set(edges);
  for (let k = 0; k < turn.steps; k++) {
    current = extrudeEdges(m, current).edges;
    turn.rotate([...current].flatMap(parseEdgeKey));
  }
  weld(m, turn.full ? SEAM_WELD_M / turn.scale : AXIS_WELD);
  dropTwinFaces(m);
}

/** Sweep the selected faces (a solid) or open border edges (a surface) around an axis. */
export function spin(m: Mesh, faces: Set<number>, edges: Set<string>, sweep: Sweep, size: Vec3): ElementSelection {
  const turn = makeTurn(m, sweep, safeSize(size));
  if (faces.size) spinFaces(m, faces, turn);
  else spinEdges(m, edges, turn);
  // vertices on the axis were duplicated per step and welded above: drop the slivers they leave
  remapFaces(m, (i) => i);
  dropOrphans(m);
  invalidateTopology(m);
  recalcNormals(m);
  return emptySelection();
}
