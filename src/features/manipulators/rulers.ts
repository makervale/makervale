/** The rulers drawn along the dragged axis and the degree ticks around a rotation ring. */
import * as THREE from "three";
import type { Store } from "@/app/store";
import type { Picker } from "@/render/picking";
import type { Theme } from "@/render/theme";
import { rulerSubdivisions, rulerTicks } from "./ruler-math";

const DEG = Math.PI / 180;
/** the ruler runs alongside the axis, this far off it, pixels */
const OFFSET_PX = 26;
const HALF_LENGTH_PX = 170;
const MARKER_PX = { below: 6, above: 16 };
const RING_TICKS = 64;
const RING_STEP_DEG = 5.625;
const INACTIVE_RING_OPACITY = 0.3;

export interface RulerSpec {
  /** the origin: where the drag started */
  p0: THREE.Vector3;
  A: THREE.Vector3;
  /** the side the ruler is drawn on */
  perp: THREE.Vector3;
  unit: number;
  /** snapping: drawn in the snap colour */
  active: boolean;
  /** where the drag is now, metres from p0 */
  along?: number;
}

/** every 8th tick (45°) is long, every 2nd medium */
function ringTickLength(i: number): number {
  if (i % 8 === 0) return 0.16;
  return i % 2 === 0 ? 0.09 : 0.05;
}

export class Rulers {
  private readonly group = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly picker: Picker,
    private readonly store: Store,
    private readonly theme: Theme,
  ) {
    scene.add(this.group);
  }

  subdivisions(p: THREE.Vector3, axis: THREE.Vector3): number {
    const view = this.camera.position.clone().sub(p).normalize();
    const projected = new THREE.Vector3().crossVectors(axis, view).length();
    return rulerSubdivisions(projected, this.picker.worldPerPixel(p), this.store.settings.gridMetres);
  }

  /** one ruler step at a point along an axis, metres */
  unit(p: THREE.Vector3, axis: THREE.Vector3): number {
    return this.store.settings.gridMetres / this.subdivisions(p, axis);
  }

  clear(): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as THREE.LineSegments).geometry.dispose();
    }
  }

  /** a ruler along the axis beside its origin, ticked every `unit` metres */
  ruler({ p0, A, perp, unit, active, along }: RulerSpec): void {
    this.clear();
    const wpp = this.picker.worldPerPixel(p0);
    const half = HALF_LENGTH_PX * wpp;
    const o = p0.clone().addScaledVector(perp, OFFSET_PX * wpp);
    const pts = [o.clone().addScaledVector(A, -half), o.clone().addScaledVector(A, half)];
    for (const t of rulerTicks(p0.dot(A), half, unit, this.store.settings.gridMetres)) {
      const at = o.clone().addScaledVector(A, t.along);
      pts.push(at, at.clone().addScaledVector(perp, t.px * wpp));
    }
    if (along !== undefined) {
      const at = o.clone().addScaledVector(A, along);
      pts.push(
        at.clone().addScaledVector(perp, -MARKER_PX.below * wpp),
        at.addScaledVector(perp, MARKER_PX.above * wpp),
      );
    }
    this.add(pts, this.material(active));
  }

  /** degree ticks around a ring of radius R about axis A */
  ringTicks(center: THREE.Vector3, A: THREE.Vector3, R: number, active: boolean): void {
    this.clear();
    const helper = Math.abs(A.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const b1 = new THREE.Vector3().crossVectors(A, helper).normalize();
    const b2 = new THREE.Vector3().crossVectors(A, b1);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < RING_TICKS; i++) {
      const a = i * RING_STEP_DEG * DEG;
      const len = ringTickLength(i);
      const d = b1.clone().multiplyScalar(Math.cos(a)).addScaledVector(b2, Math.sin(a));
      pts.push(center.clone().addScaledVector(d, R * 1.03), center.clone().addScaledVector(d, R * (1.03 + len)));
    }
    const m = this.material(active);
    if (!active) m.opacity = INACTIVE_RING_OPACITY;
    this.add(pts, m);
  }

  private material(active: boolean): THREE.LineBasicMaterial {
    const color = active ? this.theme.root : this.theme.fg;
    return new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: active ? 1 : 0.55 });
  }

  private add(pts: THREE.Vector3[], m: THREE.LineBasicMaterial): void {
    this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m));
  }
}
