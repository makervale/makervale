/**
 * Physics: balls that fall, roll and bounce, and that people kick by walking into them. `mount` hands back the
 * simulator: boot passes it to net (as the PhysicsBridge) and ticks it every frame.
 */
import type { PhysicsDeps } from "./deps";
import { Physics } from "./simulator";

export type { PhysicsDeps } from "./deps";
export { Physics } from "./simulator";

export function mount(deps: PhysicsDeps): Physics {
  const physics = new Physics(deps);
  deps.bus.on("physics:push", ({ id, vel }) => physics.push(id, vel));
  return physics;
}
