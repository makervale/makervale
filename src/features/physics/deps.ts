import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { Mover } from "@/lib/physics";
import type { ObjectViews } from "@/render/objects";

export interface PhysicsDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  /** the meshes bodies collide with */
  views: ObjectViews;
  /** your avatar's feet and velocity; null while seated */
  self(): Mover | null;
}
