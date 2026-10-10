/** View › Mesh edges on all objects: thin dark lines along every edge, kept in step as meshes change. */
import * as THREE from "three";
import type { ObjectViews } from "@/render/objects";

const EDGE_THRESHOLD_DEG = 1;
const LINE_COLOR = 0x222222;
const LINE_OPACITY = 0.35;

function linesOf(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const material = new THREE.LineBasicMaterial({ color: LINE_COLOR, transparent: true, opacity: LINE_OPACITY });
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_DEG), material);
  lines.userData.wire = true;
  // the geometry the lines were made from: when the view rebuilds its geometry, the lines are remade
  lines.userData.source = geometry;
  return lines;
}

export class Wireframe {
  on = false;

  constructor(private readonly views: ObjectViews) {}

  toggle(): boolean {
    this.on = !this.on;
    this.sync();
    return this.on;
  }

  sync(): void {
    for (const v of this.views.views.values()) {
      const mesh = v.mesh;
      const old = mesh.children.find((c): c is THREE.LineSegments => !!c.userData.wire);
      const stale = old && old.userData.source !== mesh.geometry;
      if (old && (!this.on || stale)) {
        mesh.remove(old);
        old.geometry.dispose();
      }
      if (this.on && (!old || stale)) mesh.add(linesOf(mesh.geometry));
    }
  }
}
