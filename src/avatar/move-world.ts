/** The world as walking sees it this frame: what is solid, what is springy, and whom to tell about it. */
import type * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Store } from "@/app/store";
import type { Collider } from "./collision";
import type { MoveWorld } from "./movement";

export interface MoveWorldDeps {
  collider: Collider;
  solids: THREE.Object3D[];
  store: Store;
  bus: Bus;
  /** flying started or stopped */
  changed(): void;
}

export function moveWorld(d: MoveWorldDeps): MoveWorld {
  return {
    collider: d.collider,
    solids: d.solids,
    changed: d.changed,
    springOf: (ground) => springOf(d.store, ground),
    bounced: () => d.bus.emit("avatar:bounced"),
  };
}

/** a trampoline's launch speed, from the object under your feet */
function springOf(store: Store, ground: THREE.Object3D | null): number {
  const id = ground?.userData.id as string | undefined;
  return (id && store.byId(id)?.spring) || 0;
}
