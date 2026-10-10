/** Framing: fit a set of objects into the view, from the current direction or a preset one. */
import * as THREE from "three";
import type { Obj } from "@/world/model";
import type { ObjectViews } from "../objects";
import type { RayCast } from "./clear-view";
import { clearView } from "./clear-view";
import type { CameraController } from "./controller";
import type { PresetView } from "./presets";
import { FRAME_K, HOME_DIRECTION, PRESET_DIRECTIONS, PRESET_K } from "./presets";

const EMPTY_RADIUS_M = 6;
const MIN_RADIUS_M = 0.3;

export function boxOf(views: ObjectViews, objs: Obj[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const o of objs) {
    const v = views.get(o.id);
    if (v && v.mesh.visible) box.expandByObject(v.mesh);
  }
  return box;
}

export class Framing {
  private readonly ray = new THREE.Raycaster();

  constructor(
    private readonly camera: CameraController,
    private readonly views: ObjectViews,
  ) {
    this.ray.firstHitOnly = true;
  }

  /** bring the objects into view, optionally from a direction; an empty list frames the origin */
  frame(objs: Obj[], direction?: THREE.Vector3, k = FRAME_K): void {
    const box = boxOf(this.views, objs);
    const centre = box.isEmpty() ? new THREE.Vector3(0, 0, 1) : box.getCenter(new THREE.Vector3());
    const radius = box.isEmpty()
      ? EMPTY_RADIUS_M
      : Math.max(MIN_RADIUS_M, box.getSize(new THREE.Vector3()).length() * 0.5);
    const focusId = objs.length === 1 ? objs[0].id : null;
    if (direction) {
      this.camera.lookAt(centre, direction, radius * k, focusId);
      return;
    }
    // from where the camera is now, unless walls are in the way (then from a side where they aren't)
    const view = clearView(centre, this.camera.offset, radius * k, this.castAround(objs));
    this.camera.lookAt(centre, view.direction, view.distance, focusId);
  }

  /** a ray against everything visible except the framed objects themselves */
  private castAround(objs: Obj[]): RayCast {
    const framed = new Set(objs.map((o) => o.id));
    const solids: THREE.Object3D[] = [];
    for (const [id, v] of this.views.views) if (v.mesh.visible && !framed.has(id)) solids.push(v.mesh);
    return (from, dir, far) => {
      this.ray.set(from, dir);
      this.ray.far = far;
      return this.ray.intersectObjects(solids, false)[0]?.distance ?? null;
    };
  }

  preset(kind: PresetView, objs: Obj[]): void {
    this.frame(objs, new THREE.Vector3().fromArray(PRESET_DIRECTIONS[kind]), PRESET_K);
  }

  home(all: Obj[]): void {
    this.frame(all, new THREE.Vector3().fromArray(HOME_DIRECTION));
  }
}
