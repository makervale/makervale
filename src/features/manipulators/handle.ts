/** A grabbable part of the gizmo, and what grabbing it means. Kept in the mesh's userData (tests read it there). */
import * as THREE from "three";

export type HandleKind = "axis" | "plane" | "ring" | "corner" | "face";

export interface HandleData {
  kind: HandleKind;
  /** 0 X, 1 Y, 2 Z; -1 for the view ring */
  axis: number;
  /** stretch handles: which side of the box, per axis (-1, 0, 1) */
  s?: [number, number, number];
  /** face handles: the side along `axis` */
  sign?: number;
  /** what lights up when the handle is hovered */
  vis: THREE.Object3D;
}

export const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

export const handleOf = (h: THREE.Object3D): HandleData => h.userData as HandleData;

/** mark `mesh` as a handle */
export function registerHandle(
  list: THREE.Mesh[],
  mesh: THREE.Mesh,
  data: Omit<HandleData, "vis">,
  vis?: THREE.Object3D,
): THREE.Mesh {
  mesh.userData = { ...data, vis: vis ?? mesh };
  list.push(mesh);
  return mesh;
}

/** handles are drawn over everything */
export const handleMaterial = (color: string): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });

/** the fat invisible shape the ray actually hits, so thin handles are easy to grab */
export const hitMaterial = (): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ visible: false });

/** is the object and every parent visible? */
export function shown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}
