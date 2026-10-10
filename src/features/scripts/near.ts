/** `on near METRES`: fires once when someone comes within the distance, again only after they left. */
import type { Handler } from "@/lib/script";
import { evalArg } from "@/lib/script";
import type { Vec3 } from "@/lib/vec";
import { clamp, distance } from "@/lib/vec";
import type { Obj } from "@/world/model";
import type { Running } from "./running";

export interface Avatar {
  name: string;
  pos: Vec3;
}

const DEFAULT_NEAR_M = 3;
const MIN_NEAR_M = 0.1;
const MAX_NEAR_M = 100;
/** someone must step this much further out before they count as gone (no flicker at the edge) */
const LEAVE_MARGIN_M = 0.5;

/** calls `arrived(handler, who)` for each avatar that just came close */
export function checkNear(o: Obj, r: Running, avatars: Avatar[], arrived: (h: Handler, who: string) => void): void {
  r.prog.handlers.forEach((h, hi) => {
    if (h.ev !== "near") return;
    const reach = clamp(evalArg(h.arg, r.ctx, DEFAULT_NEAR_M), MIN_NEAR_M, MAX_NEAR_M) + Math.max(...o.size) / 2;
    const inside = r.near.get(hi) ?? new Set<string>();
    r.near.set(hi, inside);
    for (const a of avatars) {
      const d = distance(a.pos, o.pos);
      if (d <= reach && !inside.has(a.name)) {
        inside.add(a.name);
        arrived(h, a.name);
      } else if (d > reach + LEAVE_MARGIN_M) inside.delete(a.name);
    }
  });
}
