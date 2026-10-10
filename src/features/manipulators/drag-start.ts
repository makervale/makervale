/** Grabbing a handle: work out the axis, the plane the cursor moves in, and where on it the drag started. */
import * as THREE from "three";
import type { Manipulator } from "@/app/store";
import { planeAlong, hitPlane, softFor, startState } from "./drag-common";
import type { HandleDrag, RotateDrag, StretchDrag, TranslateDrag } from "./drag-types";
import type { ManipEnv } from "./env";
import { RING_PX } from "./gizmo";
import { VIEW_RING_SCALE } from "./gizmo-parts";
import type { HandleData } from "./handle";
import { AXES, handleOf } from "./handle";
import { effectiveManipulator, pivotOf, referenceQuat } from "./reference";
import { pointOnBox, scaleFrameOf } from "./scale-frame";

const LABELS: Record<Manipulator, string> = { move: "Move", rotate: "Rotate", scale: "Stretch" };

interface Common {
  sx: number;
  sy: number;
  elem: boolean;
  start: ReturnType<typeof startState>;
  soft: ReturnType<typeof softFor>;
  pivot0: THREE.Vector3;
  refQ: THREE.Quaternion;
}

export function startHandleDrag(env: ManipEnv, h: THREE.Mesh, x: number, y: number, shift: boolean): HandleDrag {
  const { store, commands } = env;
  const objs = store.selected();
  const elem = !!store.editTarget();
  commands.startHeld(
    LABELS[effectiveManipulator(store)],
    objs.map((o) => o.id),
  );
  const c: Common = {
    sx: x,
    sy: y,
    elem,
    start: startState(env, elem),
    soft: elem ? softFor(env) : undefined,
    pivot0: pivotOf(env, objs),
    refQ: referenceQuat(env, objs),
  };
  const data = handleOf(h);
  if (data.kind === "axis" || data.kind === "plane") return translateDrag(env, c, data, shift);
  if (data.kind === "ring") return rotateDrag(env, c, data);
  return stretchDrag(env, c, data);
}

function translateDrag(env: ManipEnv, c: Common, data: HandleData, shift: boolean): TranslateDrag {
  const A = AXES[data.axis].clone().applyQuaternion(c.refQ);
  const along = planeAlong(env, A, c.pivot0);
  const n = data.kind === "axis" ? along.n : A.clone();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, c.pivot0);
  const hit0 = hitPlane(env, c.sx, c.sy, plane) ?? c.pivot0.clone();
  const kind = data.kind === "axis" ? "axis" : "plane";
  return { ...c, kind, axis: data.axis, A, n, plane, hit0, shift, copied: false };
}

function rotateDrag(env: ManipEnv, c: Common, data: HandleData): RotateDrag {
  const view = data.axis < 0;
  const A = view
    ? env.camera.position.clone().sub(c.pivot0).normalize()
    : AXES[data.axis].clone().applyQuaternion(c.refQ);
  const centre = env.renderer.picker.screenOf(c.pivot0);
  const prevAngle = Math.atan2(-(c.sy - centre.y), c.sx - centre.x);
  const ringPx = RING_PX * (view ? VIEW_RING_SCALE : 1);
  return { ...c, kind: "ring", axis: data.axis, A, c: centre, acc: 0, prevAngle, ringPx };
}

function stretchDrag(env: ManipEnv, c: Common, data: HandleData): StretchDrag {
  const fr = scaleFrameOf(env, env.store.selected());
  const frame0 = { ...fr, center: fr.center.clone(), size: fr.size.clone(), q: fr.q.clone() };
  const handle0 = pointOnBox(fr, data.s ?? [0, 0, 0]);
  const A =
    data.kind === "face"
      ? AXES[data.axis]
          .clone()
          .multiplyScalar(data.sign ?? 1)
          .applyQuaternion(fr.q)
      : handle0.clone().sub(fr.center).normalize();
  const { n, plane } = planeAlong(env, A, handle0);
  const hit0 = hitPlane(env, c.sx, c.sy, plane) ?? handle0.clone();
  const frame = { center: fr.center.clone(), q: fr.q, size: fr.size.clone() };
  const kind = data.kind === "face" ? "face" : "corner";
  return { ...c, kind, axis: data.axis, frame0, frame, handle0, A, r0: handle0.distanceTo(fr.center), n, plane, hit0 };
}
