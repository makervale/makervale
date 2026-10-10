/** What a drag in progress remembers: where it started, and what each kind of handle needs to follow the mouse. */
import type * as THREE from "three";
import type { Quat, Vec3 } from "@/lib/vec";
import type { ScreenPoint } from "@/render/picking";
import type { FrameBox, ScaleFrame } from "./scale-frame";
import type { SoftWeights } from "./soft";

export interface ObjStart {
  id: string;
  pos: Vec3;
  quat: Quat;
  size: Vec3;
}

/** the state before the drag; every move is applied to this, not to the previous move */
export interface DragStart {
  objs: ObjStart[];
  verts: Vec3[] | null;
}

interface DragBase {
  sx: number;
  sy: number;
  /** the touch that drives it, if a finger does */
  touch?: number;
  /** elements of the edited mesh move, not objects */
  elem: boolean;
  start: DragStart;
  soft?: SoftWeights;
  /** where the gizmo is drawn during the drag */
  pivotNow?: THREE.Vector3;
  refQ?: THREE.Quaternion;
  frame?: FrameBox;
}

/** along an arrow (axis) or across a square (plane) */
export interface TranslateDrag extends DragBase {
  kind: "axis" | "plane";
  axis: number;
  A: THREE.Vector3;
  n: THREE.Vector3;
  plane: THREE.Plane;
  hit0: THREE.Vector3;
  pivot0: THREE.Vector3;
  /** Shift: leave a copy behind */
  shift: boolean;
  copied: boolean;
}

export interface RotateDrag extends DragBase {
  kind: "ring";
  axis: number;
  A: THREE.Vector3;
  pivot0: THREE.Vector3;
  /** the pivot on screen; the angle is measured around it */
  c: ScreenPoint;
  acc: number;
  prevAngle: number;
  ringPx: number;
}

export interface StretchDrag extends DragBase {
  kind: "face" | "corner";
  axis: number;
  frame0: ScaleFrame;
  handle0: THREE.Vector3;
  A: THREE.Vector3;
  r0: number;
  n: THREE.Vector3;
  plane: THREE.Plane;
  hit0: THREE.Vector3;
}

/** dragging an object across the ground (or an element across the view) without a handle */
export interface GrabDrag extends DragBase {
  kind: "grab";
  hitPoint: THREE.Vector3;
  shift: boolean;
  started: boolean;
  ids: string[];
  plane?: THREE.Plane;
}

export type HandleDrag = TranslateDrag | RotateDrag | StretchDrag;
export type Drag = HandleDrag | GrabDrag;
