/** Mesh → three.js BufferGeometry: one group per material slot, plus a BVH for fast picking. */
import * as THREE from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import type { BuiltInfo } from "@/lib/mesh/geometry-data";
import { buildGeometryData } from "@/lib/mesh/geometry-data";

let installed = false;

/** teach three.js about bounds trees once; every raycast against a mesh then goes through its BVH */
export function installBvh(): void {
  if (installed) return;
  installed = true;
  THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

/** `size` is the object's size: the fallback box projection works in metres, so patterns tile at real scale */
export function buildGeometry(mesh: Mesh, smoothAngleDegrees: number, size: Vec3): THREE.BufferGeometry {
  const data = buildGeometryData(mesh, smoothAngleDegrees, size);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(data.normal, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(data.uv, 2));
  g.setIndex(new THREE.BufferAttribute(data.index, 1));
  for (const group of data.groups) g.addGroup(group.start, group.count, group.materialIndex);
  g.userData = data.info;
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** what the builder learned about the mesh (vertex → polygon map, slot count, open surface) */
export const infoOf = (g: THREE.BufferGeometry): BuiltInfo => g.userData as BuiltInfo;

export function computeBvh(g: THREE.BufferGeometry): void {
  g.computeBoundsTree();
}

/** forget the tree without rebuilding it (vertex drags: the tree waits for the drop) */
export function dropBvh(g: THREE.BufferGeometry): void {
  g.boundsTree = undefined;
}

export function disposeGeometry(g: THREE.BufferGeometry): void {
  g.disposeBoundsTree?.();
  g.dispose();
}
