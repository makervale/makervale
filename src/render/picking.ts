/** Picking objects under the cursor (through each mesh's BVH) and screen ↔ world helpers. */
import * as THREE from "three";
import type { Obj } from "@/world/model";
import { infoOf } from "./geometry";
import type { ObjectViews } from "./objects";
import { HIDDEN_LAYER } from "./lod/lod";

export interface WorldHit {
  point: THREE.Vector3;
  dist: number;
  /** the object hit, or null for the ground */
  id: string | null;
  /** the polygon of the object's mesh that was hit */
  poly: number | null;
  /** its material slot */
  slot: number | null;
  normal: THREE.Vector3;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** depth in clip space; > 1 is behind the camera */
  z: number;
}

export class Picker {
  /** the shared raycaster: `rayAt` aims it, callers may intersect what they like with it */
  readonly ray = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly visibilityRay = new THREE.Raycaster();

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly camera: THREE.PerspectiveCamera,
    private readonly views: ObjectViews,
    private readonly ground: THREE.Mesh,
  ) {
    this.ray.firstHitOnly = false;
    this.visibilityRay.firstHitOnly = true;
    // a far object drawn in a simpler form still answers clicks with its full mesh (lod/lod.ts)
    this.ray.layers.enable(HIDDEN_LAYER);
    this.visibilityRay.layers.enable(HIDDEN_LAYER);
  }

  /** aim the shared raycaster at a client-space point */
  rayAt(x: number, y: number): THREE.Raycaster {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray;
  }

  /** objects and the ground; restrict to one object with `onlyId` */
  pickWorld(x: number, y: number, onlyId?: string): WorldHit | null {
    this.rayAt(x, y);
    const h = this.ray.intersectObjects(this.targets(onlyId), false)[0];
    return h ? worldHit(h) : null;
  }

  private targets(onlyId?: string): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const v of this.views.views.values()) {
      if (v.mesh.visible && (!onlyId || v.mesh.userData.id === onlyId)) out.push(v.mesh);
    }
    if (!onlyId) out.push(this.ground);
    return out;
  }

  screenOf(v: THREE.Vector3): ScreenPoint {
    const p = v.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height, z: p.z };
  }

  /** metres per screen pixel at a world point */
  worldPerPixel(p: THREE.Vector3): number {
    const fov = (this.camera.fov * Math.PI) / 360;
    return (2 * this.camera.position.distanceTo(p) * Math.tan(fov)) / (this.canvas.clientHeight || 1);
  }

  /** is world point `w` visible from the camera (nothing of `mesh` in front of it)? */
  isVisible(mesh: THREE.Object3D, w: THREE.Vector3): boolean {
    const from = this.camera.position;
    const d = w.clone().sub(from);
    const L = d.length();
    if (L < 1e-6) return true;
    this.visibilityRay.set(from, d.multiplyScalar(1 / L));
    this.visibilityRay.far = L;
    const h = this.visibilityRay.intersectObject(mesh, false)[0];
    return !h || h.distance > L - Math.max(0.002, L * 0.002);
  }

  /** the object's vertices in world space */
  worldVerts(o: Obj, ids: Iterable<number>): THREE.Vector3[] {
    const M = this.views.worldMatrixOf(o);
    if (!M) return [];
    return [...ids].map((i) => new THREE.Vector3().fromArray(o.mesh.v[i]).applyMatrix4(M));
  }
}

function worldHit(h: THREE.Intersection): WorldHit {
  const info = infoOf((h.object as THREE.Mesh).geometry);
  const face = h.face;
  return {
    point: h.point.clone(),
    dist: h.distance,
    id: h.object.userData.id ?? null,
    poly: info?.vertPoly && face ? info.vertPoly[face.a] : null,
    slot: face ? face.materialIndex : null,
    normal: face ? face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 0, 1),
  };
}
