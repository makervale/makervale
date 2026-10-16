/** Keeps a public room on the list exactly while its owner is in it, with the number of people in it now. */
import type { Ctx } from "./context";
import { inRoom } from "./context";
import { announce, refreshAnnouncement, withdraw } from "./public-rooms";
import { amOwner } from "./rules";
import { kindOf } from "./state";

const announced = new WeakMap<Ctx, { code: string; people: number; open: boolean; name: string }>();

const wanted = (ctx: Ctx): boolean => inRoom(ctx) && ctx.net.synced && kindOf(ctx.net) === "public" && amOwner(ctx);

/** after anything about the room changed */
export function keepAnnounced(ctx: Ctx): void {
  const n = ctx.net;
  const now = announced.get(ctx);
  if (!wanted(ctx)) {
    if (now) withdraw();
    announced.delete(ctx);
    return;
  }
  const state = { code: n.id, people: n.peers.size + 1, open: n.rules?.build === "all", name: n.name };
  if (now && now.code === state.code) {
    if (now.people !== state.people || now.open !== state.open || now.name !== state.name) refreshAnnouncement();
  } else {
    const secret = ctx.rules.ownerSecret(n.rules);
    if (!secret) return;
    announce(secret, () => ({
      code: n.id,
      name: n.name,
      owner: ctx.deps.selfName(),
      people: n.peers.size + 1,
      open: n.rules?.build === "all",
    }));
  }
  announced.set(ctx, state);
}
