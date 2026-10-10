/** Pre-selection: what a click would pick, drawn in the object's space over everything else. */
import * as THREE from "three";
import type { Obj } from "@/world/model";
import { edgeLines, faceFill, faceTriangles, positions } from "./element-shapes";
import type { ObjectViews } from "./objects";
import type { Theme } from "./theme";

/** one mesh element: a vertex index, an edge key ("a_b"), or a face index */
export type ElementPick = { type: "v"; id: number } | { type: "e"; id: string } | { type: "f"; id: number };

const RENDER_ORDER = 10;

export class Preselection {
  private readonly group = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    private readonly views: ObjectViews,
    private readonly theme: Theme,
  ) {
    this.group.renderOrder = 9;
    this.group.matrixAutoUpdate = false;
    scene.add(this.group);
  }

  clear(): void {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as THREE.Mesh).geometry.dispose();
    }
  }

  /** highlight one element of `o` (or nothing) */
  show(o: Obj | null, pick: ElementPick | null): void {
    this.clear();
    if (!o || !pick || !this.follow(o)) return;
    if (pick.type === "v") this.add(this.vertex(o, pick.id));
    else if (pick.type === "e") this.add(this.lines(edgeLines(o.mesh, [pick.id])));
    else if (o.mesh.f[pick.id]) this.add(this.face(o, pick.id));
  }

  /** highlight a set of edges (what a loop cut would go through) */
  showEdges(o: Obj | null, keys: Iterable<string>): void {
    this.clear();
    if (!o || !this.follow(o)) return;
    this.add(this.lines(edgeLines(o.mesh, keys)));
  }

  /** the group takes the object's world matrix, so local-space geometry lands on the object */
  private follow(o: Obj): boolean {
    const v = this.views.get(o.id);
    if (!v) return false;
    this.group.matrix.copy(v.mesh.matrixWorld);
    this.group.matrixWorldNeedsUpdate = true;
    return true;
  }

  private add(object: THREE.Object3D): void {
    object.renderOrder = RENDER_ORDER;
    this.group.add(object);
  }

  private vertex(o: Obj, id: number): THREE.Points {
    const material = new THREE.PointsMaterial({
      color: this.theme.pre,
      size: 12,
      sizeAttenuation: false,
      depthTest: false,
    });
    return new THREE.Points(positions([...o.mesh.v[id]]), material);
  }

  private lines(flat: number[]): THREE.LineSegments {
    return new THREE.LineSegments(
      positions(flat),
      new THREE.LineBasicMaterial({ color: this.theme.pre, depthTest: false }),
    );
  }

  private face(o: Obj, id: number): THREE.Mesh {
    return new THREE.Mesh(positions(faceTriangles(o.mesh, [id])), faceFill(this.theme.pre, 0.28, 3));
  }
}
