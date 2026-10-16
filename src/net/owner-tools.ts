/**
 * What the owner can change: who builds (everyone, or only people they let), single people, making a room public,
 * whether a private room is kept online, and removing people. Every change is a new signed version of the rules.
 */
import type { RulesChange } from "@/lib/rules";
import type { Ctx } from "./context";
import { applyRules, personOf, snapshotOf } from "./rules";

async function change(ctx: Ctx, c: RulesChange | ((cur: NonNullable<Ctx["net"]["rules"]>) => RulesChange)) {
  const cur = ctx.net.rules;
  if (!cur) return false;
  const was = snapshotOf(ctx);
  const r = await ctx.rules.updateRules(cur, typeof c === "function" ? c(cur) : c);
  if (!r || ctx.net.rules !== cur) return false;
  ctx.net.rules = r;
  applyRules(ctx, was);
  return true;
}

export const setEveryoneBuilds = (ctx: Ctx, on: boolean) => change(ctx, { build: on ? "all" : "owner" });

export function letBuild(ctx: Ctx, pid: string, yes: boolean) {
  const who = personOf(ctx, pid);
  return change(ctx, (r) => ({
    allow: yes ? [...r.allow, who] : r.allow.filter((k) => k !== who),
    deny: yes ? r.deny.filter((k) => k !== who) : [...r.deny, who],
  }));
}

/** nobody but the owner builds, and newcomers only watch, until the owner lets someone again */
export const lockdown = (ctx: Ctx) => change(ctx, { build: "owner", allow: [] });

export function kick(ctx: Ctx, pid: string) {
  if (pid === ctx.net.selfId) return Promise.resolve(false);
  return change(ctx, (r) => ({ banned: [...r.banned, personOf(ctx, pid)] }));
}

/**
 * Going public, for good (its code is listed for anyone, so it can't be made private again): strangers will come,
 * so newcomers watch until let; the people already here keep building.
 */
export function makePublic(ctx: Ctx) {
  const here = [...ctx.net.peers.keys()].map((pid) => personOf(ctx, pid));
  return change(ctx, (r) => ({
    kind: "public",
    build: "owner",
    allow: r.build === "all" ? [...r.allow, ...here] : r.allow,
    keep: false,
  }));
}

export const setKeep = (ctx: Ctx, on: boolean) => change(ctx, { keep: on });
