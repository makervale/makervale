/** The scene as others should see it: an object a script is moving is sent where it will end up, not mid-move. */
import type { Obj, World } from "@/world/model";
import type { Ctx } from "../context";

export function settled(ctx: Ctx, o: Obj): Obj {
  const target = ctx.deps.scripts.settledTarget(o.id);
  return target ? { ...o, ...target } : o;
}

export function settledWorld(ctx: Ctx): World {
  const world = ctx.deps.store.world;
  return { seq: world.seq, objects: world.objects.map((o) => settled(ctx, o)) };
}
