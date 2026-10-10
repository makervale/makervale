/** Selection outlines around objects, and the element overlay on the object being edited. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Obj } from "@/world/model";
import type { Store } from "@/app/store";
import { adjacencyOf } from "./adjacency";
import type { ObjView, ObjectViews } from "./objects";
import { buildOverlay } from "./overlay";
import type { Theme } from "./theme";

export interface HighlightDeps {
  store: Store;
  views: ObjectViews;
  theme: Theme;
  revisionOf(mesh: Mesh): number;
}

const OUTLINE_ANGLE_DEGREES = 30;

function disposeGroup(g: THREE.Object3D): void {
  g.traverse((n) => {
    if (n instanceof THREE.Mesh || n instanceof THREE.LineSegments || n instanceof THREE.Points) n.geometry.dispose();
  });
}

function addOutline(v: ObjView): void {
  const geometry = new THREE.EdgesGeometry(v.mesh.geometry, OUTLINE_ANGLE_DEGREES);
  v.outline = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95 }));
  v.outline.renderOrder = 2;
  v.mesh.add(v.outline);
}

function removeOutline(v: ObjView): void {
  if (!v.outline) return;
  v.mesh.remove(v.outline);
  v.outline.geometry.dispose();
  v.outline = undefined;
}

function removeOverlay(v: ObjView): void {
  if (!v.overlay) return;
  v.mesh.remove(v.overlay);
  disposeGroup(v.overlay);
  v.overlay = undefined;
}

export class Highlights {
  constructor(private readonly deps: HighlightDeps) {}

  /** outlines follow the object selection; the overlay follows the edit target */
  refresh(): void {
    const target = this.deps.store.editTarget();
    for (const [id, v] of this.deps.views.views) this.refreshView(id, v, target?.id === id);
    if (target) this.refreshOverlay(target);
  }

  private refreshView(id: string, v: ObjView, editing: boolean): void {
    const { store, theme } = this.deps;
    const o = store.byId(id);
    const outlined = store.selection.objects.has(id) && !editing;
    if (outlined && !v.outline) addOutline(v);
    if (!outlined) removeOutline(v);
    if (v.outline && o) {
      const child = o.group && store.selection.last !== id;
      (v.outline.material as THREE.LineBasicMaterial).color.set(child ? theme.child : theme.root);
    }
    if (!editing) removeOverlay(v);
  }

  refreshOverlay(o: Obj): void {
    const v = this.deps.views.get(o.id);
    if (!v) return;
    removeOverlay(v);
    v.overlay = buildOverlay({
      mesh: o.mesh,
      adjacency: adjacencyOf(o.mesh, this.deps.revisionOf(o.mesh)),
      selection: this.deps.store.selection.elements,
      mode: this.deps.store.selection.mode,
      theme: this.deps.theme,
    });
    v.mesh.add(v.overlay);
  }
}
