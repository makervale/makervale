/** What a ball touches: the ground and every visible object, found with each mesh's BVH (closest point). */
import * as THREE from "three";
import type { Contact } from "@/lib/physics";
import type { Vec3 } from "@/lib/vec";
import type { ObjectViews } from "@/render/objects";

interface Near {
  normal: Vec3;
  depth: number;
}

export class WorldProbe {
  private readonly centre = new THREE.Vector3();
  private readonly box = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();
  private readonly tri = new THREE.Triangle();
  private readonly point = new THREE.Vector3();
  private readonly best = new THREE.Vector3();

  constructor(private readonly views: ObjectViews) {}

  /** everything a ball at `pos` overlaps, apart from object `self` (the ball's own mesh) */
  contacts(pos: Vec3, radius: number, self: string): Contact[] {
    const out: Contact[] = [];
    // the endless ground under everything is the plane z = 0
    if (pos[2] < radius) out.push({ normal: [0, 0, 1], depth: radius - pos[2], id: null });
    this.centre.set(pos[0], pos[1], pos[2]);
    this.sphere.set(this.centre, radius);
    for (const [id, v] of this.views.views) {
      if (id === self || !v.mesh.visible) continue;
      const near = this.touching(v.mesh, radius);
      if (near) out.push({ ...near, id });
    }
    return out;
  }

  /**
   * The nearest point of the mesh, measured in the world: objects are unit meshes stretched by their size, and a
   * distance measured before the stretch would be wrong for anything flat (the ball sank into a 2 cm turf).
   */
  private touching(mesh: THREE.Mesh, radius: number): Near | null {
    const g = mesh.geometry;
    if (!g.boundsTree || !g.boundingBox) return null;
    const m = mesh.matrixWorld;
    if (this.box.copy(g.boundingBox).applyMatrix4(m).distanceToPoint(this.centre) > radius) return null;
    let nearest = radius;
    g.boundsTree.shapecast({
      intersectsBounds: (b) => this.box.copy(b).applyMatrix4(m).intersectsSphere(this.sphere),
      intersectsTriangle: (t) => {
        this.tri.set(t.a, t.b, t.c);
        this.tri.a.applyMatrix4(m);
        this.tri.b.applyMatrix4(m);
        this.tri.c.applyMatrix4(m);
        const d = this.tri.closestPointToPoint(this.centre, this.point).distanceTo(this.centre);
        if (d < nearest) {
          nearest = d;
          this.best.copy(this.point);
        }
        return false;
      },
    });
    if (nearest >= radius) return null;
    if (nearest < 1e-6) return { normal: [0, 0, 1], depth: radius };
    const n = this.centre.clone().sub(this.best).divideScalar(nearest);
    return { normal: [n.x, n.y, n.z], depth: radius - nearest };
  }
}
