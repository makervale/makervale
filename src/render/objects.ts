/** Obj ↔ three.js mesh: one view per object, rebuilt when the mesh changes, moved when the transform does. */
import * as THREE from "three";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Obj } from "@/world/model";
import { materialOf } from "@/world/model";
import type { Store } from "@/app/store";
import { buildGeometry, computeBvh, disposeGeometry, dropBvh, infoOf } from "./geometry";
import type { MaterialCache } from "./materials";

export interface ObjView {
  mesh: THREE.Mesh;
  meshRef: Mesh | null;
  revision: number;
  sizeKey: string;
  /** selection outline and element overlay, owned by highlights.ts; dropped with the geometry */
  outline?: THREE.LineSegments;
  overlay?: THREE.Group;
  /** vertices moved during a drag: the BVH is rebuilt when the drag ends */
  dirtyBvh: boolean;
}

export interface ObjectViewDeps {
  scene: THREE.Scene;
  store: Store;
  revisionOf(mesh: Mesh): number;
  materials: MaterialCache;
}

export function objectMatrix(o: Obj): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(o.pos),
    new THREE.Quaternion().fromArray(o.quat),
    new THREE.Vector3().fromArray(o.size),
  );
}

function disposeChild(parent: THREE.Object3D, child: THREE.Object3D | undefined): void {
  if (!child) return;
  parent.remove(child);
  child.traverse((n) => {
    if (n instanceof THREE.Mesh || n instanceof THREE.LineSegments || n instanceof THREE.Points) n.geometry.dispose();
  });
}

export function dropExtras(v: ObjView): void {
  disposeChild(v.mesh, v.outline);
  disposeChild(v.mesh, v.overlay);
  v.outline = undefined;
  v.overlay = undefined;
}

const spinQ = new THREE.Quaternion();
const spinE = new THREE.Euler();

export class ObjectViews {
  readonly views = new Map<string, ObjView>();

  constructor(private readonly deps: ObjectViewDeps) {}

  get(id: string): ObjView | undefined {
    return this.views.get(id);
  }

  worldMatrixOf(o: Obj): THREE.Matrix4 | null {
    return this.views.get(o.id)?.mesh.matrixWorld ?? null;
  }

  /**
   * An object's rotation on screen: its stored rotation, plus the continuous spin a script gave it
   * (paused while it's selected, so the handles line up). Used by every sync, so a rebuild never makes a
   * spinning object jump.
   */
  setRotation(m: THREE.Object3D, o: Obj): void {
    m.quaternion.fromArray(o.quat);
    if (!o.spin || this.deps.store.selection.objects.has(o.id)) return;
    const k = ((Math.PI / 180) * performance.now()) / 1000;
    m.quaternion.multiply(spinQ.setFromEuler(spinE.set(o.spin[0] * k, o.spin[1] * k, o.spin[2] * k)));
  }

  sync(o: Obj): void {
    const v = this.viewFor(o);
    const revision = this.deps.revisionOf(o.mesh);
    const sizeKey = o.size.join(",");
    if (v.meshRef !== o.mesh || v.revision !== revision || v.sizeKey !== sizeKey) {
      this.rebuild(v, o);
      v.meshRef = o.mesh;
      v.revision = revision;
      v.sizeKey = sizeKey;
    }
    const info = infoOf(v.mesh.geometry);
    const slots = Math.max(info.slots, o.materials.length);
    v.mesh.material = Array.from({ length: slots }, (_, i) => this.deps.materials.get(materialOf(o, i), info.open));
    this.syncTransform(o);
    v.mesh.visible = !o.hidden;
  }

  /** every object: new ones appear, deleted ones go */
  syncAll(): void {
    for (const [id, v] of this.views) {
      if (this.deps.store.byId(id)) continue;
      this.deps.scene.remove(v.mesh);
      dropExtras(v);
      disposeGeometry(v.mesh.geometry);
      this.views.delete(id);
    }
    for (const o of this.deps.store.world.objects) this.sync(o);
  }

  /** only the transform changed (during drags) */
  syncTransform(o: Obj): void {
    const v = this.views.get(o.id);
    if (!v) return;
    v.mesh.position.fromArray(o.pos);
    this.setRotation(v.mesh, o);
    v.mesh.scale.fromArray(o.size);
    v.mesh.updateMatrixWorld();
  }

  /** only vertex positions changed (during element drags): rebuild without touching the BVH until the drag ends */
  syncShape(o: Obj): void {
    const v = this.views.get(o.id);
    if (!v) return;
    const old = v.mesh.geometry;
    v.mesh.geometry = this.build(o);
    old.dispose();
    dropBvh(old);
    v.dirtyBvh = true;
  }

  finishShape(o: Obj): void {
    const v = this.views.get(o.id);
    if (!v || !v.dirtyBvh) return;
    computeBvh(v.mesh.geometry);
    v.dirtyBvh = false;
  }

  /** per frame: scripted spins keep turning */
  tickSpin(): void {
    for (const o of this.deps.store.world.objects) {
      if (!o.spin || this.deps.store.selection.objects.has(o.id)) continue;
      const v = this.views.get(o.id);
      if (!v) continue;
      this.setRotation(v.mesh, o);
      v.mesh.updateMatrixWorld();
    }
  }

  private viewFor(o: Obj): ObjView {
    let v = this.views.get(o.id);
    if (v) return v;
    const mesh = new THREE.Mesh();
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.id = o.id;
    this.deps.scene.add(mesh);
    v = { mesh, meshRef: null, revision: -1, sizeKey: "", dirtyBvh: false };
    this.views.set(o.id, v);
    return v;
  }

  private build(o: Obj): THREE.BufferGeometry {
    return buildGeometry(o.mesh, this.deps.store.settings.smoothAngleDegrees, o.size);
  }

  private rebuild(v: ObjView, o: Obj): void {
    const old = v.mesh.geometry;
    v.mesh.geometry = this.build(o);
    computeBvh(v.mesh.geometry);
    if (old) disposeGeometry(old);
    dropExtras(v);
  }
}
