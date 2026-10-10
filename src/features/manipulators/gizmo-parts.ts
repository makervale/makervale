/** The move arrows and planes, and the rotation rings, built once in unit size (the gizmo scales them per frame). */
import * as THREE from "three";
import type { Theme } from "@/render/theme";
import { AXES, handleMaterial, hitMaterial, registerHandle } from "./handle";

export const axisColor = (theme: Theme, i: number): string => [theme.x, theme.y, theme.z][i];
const UP = new THREE.Vector3(0, 1, 0);
const OUT = new THREE.Vector3(0, 0, 1);
/** the ring around the view direction is this much bigger than the axis rings */
export const VIEW_RING_SCALE = 1.22;

function arrow(theme: Theme, i: number, handles: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  const m = handleMaterial(axisColor(theme, i));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 8), m);
  shaft.position.y = 0.4;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 16), m);
  head.position.y = 0.89;
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 8), hitMaterial());
  hit.position.y = 0.5;
  g.add(shaft, head, hit);
  g.quaternion.setFromUnitVectors(UP, AXES[i]);
  registerHandle(handles, hit, { kind: "axis", axis: i }, g);
  return g;
}

function planeSquare(theme: Theme, i: number, handles: THREE.Mesh[]): THREE.Mesh {
  const material = handleMaterial(axisColor(theme, i));
  material.side = THREE.DoubleSide;
  material.opacity = 0.45;
  const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), material);
  sq.quaternion.setFromUnitVectors(OUT, AXES[i]);
  return registerHandle(handles, sq, { kind: "plane", axis: i });
}

export function buildMoveParts(theme: Theme, handles: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) g.add(arrow(theme, i, handles), planeSquare(theme, i, handles));
  return g;
}

function ring(color: string, radius: number, thickness: number, hitThickness: number): [THREE.Mesh, THREE.Mesh] {
  const r = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, 96), handleMaterial(color));
  const hit = new THREE.Mesh(new THREE.TorusGeometry(radius, hitThickness, 6, 48), hitMaterial());
  r.add(hit);
  return [r, hit];
}

export function buildRotateParts(theme: Theme, handles: THREE.Mesh[]): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const [r, hit] = ring(axisColor(theme, i), 1, 0.016, 0.085);
    r.quaternion.setFromUnitVectors(OUT, AXES[i]);
    g.add(r);
    registerHandle(handles, hit, { kind: "ring", axis: i }, r);
  }
  // the outer ring turns about the view direction; it always faces the camera
  const [view, viewHit] = ring(theme.fg, VIEW_RING_SCALE, 0.012, 0.07);
  (view.material as THREE.MeshBasicMaterial).opacity = 0.5;
  view.userData.billboard = true;
  g.add(view);
  registerHandle(handles, viewHit, { kind: "ring", axis: -1 }, view);
  const ball = new THREE.MeshBasicMaterial({ color: theme.fg, transparent: true, opacity: 0.05 });
  ball.depthTest = ball.depthWrite = false;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.98, 24, 16), ball));
  return g;
}
