/**
 * Who is near an object (onNear/onAway, within its reach) and who is in it or standing on it (onEnter/onLeave):
 * each fires once as someone arrives and once as they go, with a little margin so standing at the edge doesn't
 * flicker.
 */
import type { Vec3 } from "@/lib/vec";
import { distance, quatInverse, rotate, sub } from "@/lib/vec";
import type { Obj } from "@/world/model";
import type { Running } from "./running";

export interface Avatar {
  name: string;
  pos: Vec3;
}

const MARGIN_M = 0.5;
/** a person counts as on an object while their feet are this far above its top */
const ON_TOP_M = 1;

/** how far from the object's surface (roughly: from its centre less half its largest side) */
const gap = (o: Obj, at: Vec3): number => distance(at, o.pos) - Math.max(...o.size) / 2;

function isInside(o: Obj, at: Vec3, margin: number): boolean {
  const p = rotate(sub(at, o.pos), quatInverse(o.quat));
  const [hx, hy, hz] = o.size.map((s) => s / 2 + margin);
  return Math.abs(p[0]) <= hx && Math.abs(p[1]) <= hy && p[2] >= -hz && p[2] <= hz + ON_TOP_M;
}

type Arrive = (handler: string, who: string) => void;

/** `now`: is the person in, and are they clearly out (past the margin) */
function track(set: Set<string>, who: string, now: [boolean, boolean], names: [string, string], on: Arrive) {
  if (now[0] && !set.has(who)) {
    set.add(who);
    on(names[0], who);
  } else if (now[1] && set.delete(who)) on(names[1], who);
}

export function checkZones(o: Obj, r: Running, avatars: Avatar[], wants: (h: string) => boolean, on: Arrive): void {
  const near = wants("onNear") || wants("onAway");
  const inside = wants("onEnter") || wants("onLeave");
  if (!near && !inside) return;
  for (const a of avatars) {
    const d = gap(o, a.pos);
    if (near) track(r.near, a.name, [d <= r.reach, d > r.reach + MARGIN_M], ["onNear", "onAway"], on);
    if (inside)
      track(r.inside, a.name, [isInside(o, a.pos, 0), !isInside(o, a.pos, MARGIN_M)], ["onEnter", "onLeave"], on);
  }
  // people who left the room leave the object too
  const here = new Set(avatars.map((a) => a.name));
  for (const [set, away] of [
    [r.near, "onAway"],
    [r.inside, "onLeave"],
  ] as const) {
    for (const who of [...set]) if (!here.has(who) && set.delete(who)) on(away, who);
  }
}
