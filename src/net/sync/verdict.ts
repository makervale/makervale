/**
 * The authority's verdicts on the laws of space. Only the authority judges a peer's edit (objects.ts); when it
 * refuses one, its own copy of those objects goes to everyone as a verdict, so every screen ends up with the same
 * scene, and the person whose edit it was hears why. A verdict is taken only from an authority who may build
 * (authority.ts), so it can never do more than building would.
 */
import { VERDICT_TEXT } from "@/app/space";
import type { Ctx } from "../context";
import { authorityId } from "../context";
import { canBuild } from "../rights";
import { asRecord } from "../sanitize";

export interface Verdict {
  to: string;
  why: keyof typeof VERDICT_TEXT;
}

export function verdictIn(ctx: Ctx, d: Record<string, unknown>, from: string): Verdict | null {
  if (from !== authorityId(ctx) || !canBuild(ctx, from)) return null;
  const v = asRecord(d.verdict);
  if (typeof v.to !== "string") return null;
  return { to: v.to, why: v.why === "full" ? "full" : "dense" };
}

/** a verdict on our own edit: say why it went back */
export function hearVerdict(ctx: Ctx, v: Verdict): void {
  if (v.to === ctx.net.selfId) ctx.deps.bus.emit("space:refused", { text: VERDICT_TEXT[v.why] });
}
