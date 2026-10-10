/** Box select: the elements inside a screen rectangle, only those the camera can see unless X-ray is on. */
import * as THREE from "three";
import { adjacencyOf } from "./adjacency";
import type { ElementPickDeps } from "./pick-element";
import type { ScreenPoint } from "./picking";
import type { ElementPick } from "./preselect";

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Projected {
  world: THREE.Vector3[];
  screen: ScreenPoint[];
  inside(i: number): boolean;
  /** visible from the camera, or X-ray on; cached per vertex */
  seen(i: number): boolean;
  seenAt(w: THREE.Vector3): boolean;
}

function project(deps: ElementPickDeps, mesh: THREE.Mesh, verts: number[][], rect: Rect): Projected {
  const M = mesh.matrixWorld;
  const world = verts.map((p) => new THREE.Vector3().fromArray(p).applyMatrix4(M));
  const screen = world.map((w) => deps.picker.screenOf(w));
  const xray = deps.store.settings.xray;
  const visible = new Map<number, boolean>();
  const seenAt = (w: THREE.Vector3) => xray || deps.picker.isVisible(mesh, w);
  return {
    world,
    screen,
    inside: (i) => {
      const s = screen[i];
      return s.z <= 1 && s.x >= rect.x0 && s.x <= rect.x1 && s.y >= rect.y0 && s.y <= rect.y1;
    },
    seen: (i) => {
      let r = visible.get(i);
      if (r === undefined) {
        r = seenAt(world[i]);
        visible.set(i, r);
      }
      return r;
    },
    seenAt,
  };
}

function facesInside(deps: ElementPickDeps, faces: number[][], p: Projected): ElementPick[] {
  const out: ElementPick[] = [];
  const camera = deps.picker.camera.position;
  faces.forEach((face, fi) => {
    if (!face.every(p.inside)) return;
    if (!deps.store.settings.xray) {
      const centre = new THREE.Vector3();
      for (const i of face) centre.add(p.world[i]);
      centre.multiplyScalar(1 / face.length);
      // only faces turned towards the camera, and not hidden behind the object itself
      const n = new THREE.Vector3()
        .subVectors(p.world[face[1]], p.world[face[0]])
        .cross(new THREE.Vector3().subVectors(p.world[face[face.length - 1]], p.world[face[0]]));
      if (n.dot(new THREE.Vector3().subVectors(camera, centre)) <= 0 || !p.seenAt(centre)) return;
    }
    out.push({ type: "f", id: fi });
  });
  return out;
}

export function elementsInRect(deps: ElementPickDeps, rect: Rect): ElementPick[] {
  const o = deps.store.editTarget();
  const v = o ? deps.views.get(o.id) : undefined;
  if (!o || !v) return [];
  const m = o.mesh;
  const p = project(deps, v.mesh, m.v, rect);
  const mode = deps.store.selection.mode;
  if (mode === "vert" || mode === "auto") {
    return m.v
      .map((_, i) => i)
      .filter((i) => p.inside(i) && p.seen(i))
      .map((i) => ({ type: "v", id: i }));
  }
  if (mode === "edge") {
    const out: ElementPick[] = [];
    for (const [key, [a, b]] of adjacencyOf(m, deps.revisionOf(m)).edges) {
      if (!p.inside(a) || !p.inside(b)) continue;
      if (p.seenAt(p.world[a].clone().lerp(p.world[b], 0.5))) out.push({ type: "e", id: key });
    }
    return out;
  }
  return facesInside(deps, m.f, p);
}
