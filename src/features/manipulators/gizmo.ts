/** The handles on screen: placed on the selection every frame, the same size whatever the zoom, picked by ray. */
import * as THREE from "three";
import type { Manipulator } from "@/app/store";
import type { Drag } from "./drag-types";
import type { ManipEnv } from "./env";
import { worldPerPixel } from "./env";
import { buildMoveParts, buildRotateParts } from "./gizmo-parts";
import { AXES, handleOf, shown } from "./handle";
import { gizmoMode, pivotOf, referenceQuat } from "./reference";
import type { ScaleParts } from "./scale-frame";
import { buildScaleParts, placeScaleParts, scaleFrameOf } from "./scale-frame";

const ARROW_PX = 96;
export const RING_PX = 92;
/** the plane squares sit this far out between their two axes, on the side facing the camera */
const PLANE_OFFSET = 0.3;

export class Gizmo {
  readonly root = new THREE.Group();
  readonly handles: THREE.Mesh[] = [];
  private readonly move: THREE.Group;
  private readonly rotate: THREE.Group;
  private readonly scale: ScaleParts;
  private hover: THREE.Mesh | null = null;

  constructor(private readonly env: ManipEnv) {
    const theme = env.renderer.theme;
    this.move = buildMoveParts(theme, this.handles);
    this.rotate = buildRotateParts(theme, this.handles);
    this.scale = buildScaleParts(theme, this.handles);
    this.root.add(this.move, this.rotate, this.scale.group);
    env.renderer.parts.gizmoScene.add(this.root);
  }

  /** per frame */
  update(drag: Drag | null): void {
    const mode = gizmoMode(this.env.store);
    this.move.visible = mode === "move";
    this.rotate.visible = mode === "rotate";
    this.scale.group.visible = mode === "scale";
    this.root.visible = !!mode;
    if (!mode) return;
    const objs = this.env.store.selected();
    if (mode === "scale") {
      this.root.position.set(0, 0, 0);
      this.root.quaternion.identity();
      this.root.scale.setScalar(1);
      const box = drag?.frame ?? scaleFrameOf(this.env, objs);
      placeScaleParts(this.scale, box, (p) => worldPerPixel(this.env, p), this.hover);
      return;
    }
    const p = drag?.pivotNow ?? pivotOf(this.env, objs);
    this.root.position.copy(p);
    this.root.scale.setScalar(worldPerPixel(this.env, p) * (mode === "move" ? ARROW_PX : RING_PX));
    this.root.quaternion.copy(drag?.refQ ?? referenceQuat(this.env, objs));
    this.root.updateMatrixWorld();
    if (mode === "rotate") this.faceCamera();
    else this.planesTowardCamera(p);
  }

  /** the handle under a screen point */
  pick(x: number, y: number): THREE.Mesh | null {
    if (!this.root.visible) return null;
    const ray = this.env.renderer.picker.rayAt(x, y);
    this.env.renderer.parts.gizmoScene.updateMatrixWorld(true);
    const hit = ray.intersectObjects(this.handles.filter(shown), false)[0];
    return hit ? (hit.object as THREE.Mesh) : null;
  }

  /** hovering a handle tints it instead of resizing it: a ring that grew under the cursor would flicker */
  setHover(h: THREE.Mesh | null): void {
    if (this.hover === h) return;
    if (this.hover && tintable(this.hover)) tint(this.hover, false, this.env.renderer.theme.root);
    this.hover = h;
    if (h && tintable(h)) tint(h, true, this.env.renderer.theme.root);
  }

  /** which handles are shown, or null */
  mode(): Manipulator | null {
    return gizmoMode(this.env.store);
  }

  private faceCamera(): void {
    const inv = this.root.quaternion.clone().invert();
    for (const c of this.rotate.children) {
      if (c.userData.billboard) c.quaternion.copy(inv).multiply(this.env.camera.quaternion);
    }
  }

  private planesTowardCamera(p: THREE.Vector3): void {
    const toCam = this.env.camera.position.clone().sub(p).applyQuaternion(this.root.quaternion.clone().invert());
    const side = (k: number) => PLANE_OFFSET * Math.sign(toCam.getComponent(k) || 1);
    for (const h of this.handles) {
      const d = handleOf(h);
      if (d.kind !== "plane") continue;
      const j = (d.axis + 1) % 3;
      const k = (d.axis + 2) % 3;
      h.position.set(0, 0, 0).addScaledVector(AXES[j], side(j)).addScaledVector(AXES[k], side(k));
    }
  }
}

const tintable = (h: THREE.Mesh) => handleOf(h).kind !== "corner" && handleOf(h).kind !== "face";

interface Tinted {
  c0?: number;
  o0?: number;
}

function tint(h: THREE.Mesh, on: boolean, color: string): void {
  handleOf(h).vis.traverse((n) => {
    const m = (n as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (!m || !m.visible || !m.color) return;
    const saved = m.userData as Tinted;
    if (on) {
      if (saved.c0 === undefined) Object.assign(saved, { c0: m.color.getHex(), o0: m.opacity });
      m.color.set(color);
      m.opacity = 1;
    } else if (saved.c0 !== undefined) {
      m.color.setHex(saved.c0);
      m.opacity = saved.o0 ?? 1;
    }
  });
}
