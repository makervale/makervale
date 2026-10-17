/** Keeps a public room on the list exactly while its owner is in it, with the number of people in it now. */
import type { Ctx } from "./context";
import { inRoom } from "./context";
import { announce, refreshAnnouncement, withdraw } from "./public-rooms";
import { amOwner } from "./rules";
import { kindOf } from "./state";

interface Announced {
  code: string;
  people: number;
  open: boolean;
  name: string;
  /** the scene's fill in tens of %: the list says light, busy or heavy, so a smaller change isn't worth a refresh */
  fill: number;
}

const announced = new WeakMap<Ctx, Announced>();
const FILL_STEP = 10;

const differs = (a: Announced, b: Announced): boolean =>
  a.people !== b.people || a.open !== b.open || a.name !== b.name || a.fill !== b.fill;

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
  const fill = Math.floor(ctx.deps.commands.space.fill() / FILL_STEP);
  const state = { code: n.id, people: n.peers.size + 1, open: n.rules?.build === "all", name: n.name, fill };
  if (now && now.code === state.code) {
    if (differs(now, state)) refreshAnnouncement();
  } else {
    const secret = ctx.rules.ownerSecret(n.rules);
    if (!secret) return;
    announce(secret, () => ({
      code: n.id,
      name: n.name,
      owner: ctx.deps.selfName(),
      people: n.peers.size + 1,
      open: n.rules?.build === "all",
      fill: ctx.deps.commands.space.fill(),
    }));
  }
  announced.set(ctx, state);
}
