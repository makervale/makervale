import { normaliseForEditor } from "@/lib/mesh/io/fit";
import type { Mesh } from "@/lib/mesh/mesh";
import type { Vec3 } from "@/lib/vec";
import { add } from "@/lib/vec";
import type { Obj, World } from "@/world/model";
import { defaultMaterial, emptyWorld, newObj } from "@/world/model";
import type { Mat } from "./palette";

/** the scene being built; ids and group names share the world's counter, in the order things are made */
export class SceneBuilder {
  readonly world: World = emptyWorld();

  group(): string {
    return "g" + this.world.seq++;
  }

  /** a shape modelled in metres, fitted into unit space and put `at` that offset */
  place(m: Mesh, at: Vec3, mats: Mat[], name: string, group: string | null = null): Obj {
    const n = normaliseForEditor(m);
    const o = newObj(this.world, n.mesh, add(n.pos, at), n.size, { name });
    o.materials = mats.map((x) => defaultMaterial(x));
    o.group = group;
    this.world.objects.push(o);
    return o;
  }
}
