import type { Ctx } from "../context";
import { abandonDrags } from "./drag";

/** someone is no longer in the room, whether they left or the owner removed them: nothing of theirs goes on */
export function forgetPeer(ctx: Ctx, pid: string): boolean {
  if (!ctx.net.peers.delete(pid)) return false;
  ctx.deps.peers.remove(pid);
  abandonDrags(ctx, pid);
  ctx.deps.scripts.resync();
  return true;
}
