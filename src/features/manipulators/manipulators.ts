/** Move / rotate / stretch handles with rulers along the dragged axis. */
import type * as THREE from "three";
import type { Manipulator } from "@/app/store";
import type { Obj } from "@/world/model";
import { Badge } from "./badge";
import { showMoved } from "./drag-common";
import { startHandleDrag } from "./drag-start";
import type { Drag } from "./drag-types";
import type { ManipDeps, ManipEnv } from "./env";
import { Gizmo } from "./gizmo";
import type { GrabStart } from "./grab";
import { grabMove, startGrab } from "./grab";
import { effectiveManipulator, pivotOf, singlePoint } from "./reference";
import { rotateMove } from "./rotate";
import { Rulers } from "./rulers";
import { stretchMove } from "./stretch";
import { translateMove } from "./translate";

export class Manipulators {
  /** the drag in progress */
  drag: Drag | null = null;
  private readonly env: ManipEnv;
  private readonly gizmo: Gizmo;

  constructor(deps: ManipDeps) {
    const { renderer, store } = deps;
    const camera = renderer.parts.camera;
    const rulers = new Rulers(renderer.parts.gizmoScene, camera, renderer.picker, store, renderer.theme);
    this.env = { ...deps, camera, badge: new Badge(deps.stage), rulers };
    this.gizmo = new Gizmo(this.env);
  }

  /** which handles are shown, or null */
  mode(): Manipulator | null {
    return this.gizmo.mode();
  }

  /** the handle that applies now: held Ctrl turns Move into Rotate, Ctrl+Shift into Stretch; one point only moves */
  effManip(): Manipulator {
    return effectiveManipulator(this.env.store);
  }

  /** editing a mesh with a single point (or less) selected */
  singlePoint(): boolean {
    return singlePoint(this.env.store);
  }

  pickHandle(x: number, y: number): THREE.Mesh | null {
    return this.gizmo.pick(x, y);
  }

  setHover(h: THREE.Mesh | null): void {
    this.gizmo.setHover(h);
  }

  /** grab a handle; `shift` leaves a copy behind when moving */
  startHandle(h: THREE.Mesh, x: number, y: number, shift: boolean): Drag {
    this.drag = startHandleDrag(this.env, h, x, y, shift);
    return this.drag;
  }

  /** drag what is selected without a handle (`elem`: the selected elements) */
  startGrab(g: GrabStart): Drag {
    this.drag = startGrab(this.env, g);
    return this.drag;
  }

  move(x: number, y: number): void {
    const d = this.drag;
    if (!d) return;
    const moved = this.moveBy(d, x, y);
    if (moved) showMoved(this.env, d);
  }

  /** the drop: one history entry for the whole drag */
  end(): void {
    const d = this.drag;
    this.drag = null;
    this.clearFeedback();
    if (!d) return;
    const t = this.env.store.editTarget();
    if (t && d.elem) this.env.renderer.views.finishShape(t);
    if (d.kind === "grab" && !d.started) return;
    this.env.commands.finishHeld();
    this.env.bus.emit("selection:changed");
  }

  /** Esc: everything goes back to where it was */
  cancel(): void {
    if (!this.drag) return;
    this.drag = null;
    this.env.commands.cancelHeld();
    this.clearFeedback();
  }

  /** per frame: the handles follow the selection */
  update(): void {
    this.gizmo.update(this.drag);
  }

  pivotOf(objs: Obj[]): THREE.Vector3 {
    return pivotOf(this.env, objs);
  }

  /** one ruler step at a point along an axis, metres */
  snapUnit(p: THREE.Vector3, axis: THREE.Vector3): number {
    return this.env.rulers.unit(p, axis);
  }

  showBadge(x: number, y: number, text: string, snap: boolean): void {
    this.env.badge.show(x, y, text, snap);
  }

  hideBadge(): void {
    this.env.badge.hide();
  }

  private moveBy(d: Drag, x: number, y: number): boolean {
    switch (d.kind) {
      case "grab":
        return grabMove(this.env, d, x, y);
      case "ring":
        return rotateMove(this.env, d, x, y);
      case "face":
      case "corner":
        return stretchMove(this.env, d, x, y);
      default:
        return translateMove(this.env, d, x, y);
    }
  }

  private clearFeedback(): void {
    this.env.rulers.clear();
    this.env.badge.hide();
  }
}
