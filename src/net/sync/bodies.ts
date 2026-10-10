/**
 * Physics in a room: the authority sends moving bodies a few times a second, everyone else takes them as the truth
 * and keeps simulating in between. The authority pushes the ball with everyone's avatars, from where they are.
 */
import { velocityOf } from "@/avatar/snapshot";
import type { Vec3 } from "@/lib/vec";
import type { Ctx } from "../context";
import { amAuthority, authorityId, inRoom, quietly, send } from "../context";
import type { BodyState, PhysicsNetHooks } from "../physics-bridge";
import { cleanBodies } from "../sanitize";

function others(ctx: Ctx): { pos: Vec3; vel: Vec3 }[] {
  const out: { pos: Vec3; vel: Vec3 }[] = [];
  for (const p of ctx.net.peers.values()) {
    const t = p.target;
    if (t && !t.sitting) out.push({ pos: t.pos, vel: velocityOf(t) });
  }
  return out;
}

function moved(ctx: Ctx, states: BodyState[]): void {
  if (inRoom(ctx) && ctx.net.synced && states.length) send(ctx, "body", { b: states });
}

export function physicsHooks(ctx: Ctx): PhysicsNetHooks {
  return {
    isAuthority: () => amAuthority(ctx),
    onMoved: (states) => moved(ctx, states),
    others: () => others(ctx),
    quietly: (change) => quietly(ctx, change),
  };
}

/** bodies from the authority; from anyone else they are ignored */
export function onBodies(ctx: Ctx, raw: unknown, pid: string): void {
  if (!ctx.net.synced || pid !== authorityId(ctx)) return;
  const states = cleanBodies(raw).filter((s) => ctx.deps.store.byId(s.id)?.body);
  if (states.length) ctx.deps.physics.applyRemote(states);
}
