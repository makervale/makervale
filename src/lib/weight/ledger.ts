/** The sand ledger itself: what lies where now, what a change would do, and committing it. See sand.ts. */
import type { Entry, Proposal, Verdict } from "./sand";
import { ROOM_CEILING, SAND_LIMIT, addSpread, entryOf, forWindowsAround, wideShare } from "./sand";
import { cellBox, key, unkey } from "./cells";
import type { Shape } from "./weigh";
import { worldBox } from "./weigh";

export class Ledger {
  private entries = new Map<string, Entry>();
  /** narrow sand per window, by the window's centre cell */
  private windows = new Map<number, number>();
  private wide = new Map<string, Entry>();
  total = 0;

  reset(objects: Iterable<[string, Shape]>): void {
    this.entries.clear();
    this.windows.clear();
    this.wide.clear();
    this.total = 0;
    const p = this.propose([...objects]);
    this.commit(p);
  }

  /** what changing these objects (null: removing them) would do; nothing changes yet */
  propose(changes: Iterable<[string, Shape | null]>): Proposal {
    const p: Proposal = { next: new Map(), cellDelta: new Map(), wideIn: [], wideOut: [], totalDelta: 0 };
    for (const [id, shape] of changes) {
      const old = this.entries.get(id) ?? null;
      const now = shape ? entryOf(shape) : null;
      p.next.set(id, now);
      this.account(p, old, -1);
      this.account(p, now, 1);
    }
    return p;
  }

  private account(p: Proposal, e: Entry | null, sign: number): void {
    if (!e) return;
    p.totalDelta += sign * e.weight;
    if (e.spread) addSpread(p.cellDelta, e.spread, sign);
    else (sign > 0 ? p.wideIn : p.wideOut).push(e);
  }

  /** how much sand lies around this cell (by window centre key), wide layer included */
  sandAt(k: number, extra: Entry[] = [], minus: Entry[] = []): number {
    let s = this.windows.get(k) ?? 0;
    for (const e of this.wide.values()) s += wideShare(e, k);
    for (const e of extra) s += wideShare(e, k);
    for (const e of minus) s -= wideShare(e, k);
    return s;
  }

  verdict(p: Proposal): Verdict {
    if (p.totalDelta > 0 && this.total + p.totalDelta > ROOM_CEILING) return { ok: false, why: "full" };
    const delta = windowDeltas(p.cellDelta);
    for (const e of p.wideIn) for (const w of this.windowsOver(e)) if (!delta.has(w)) delta.set(w, 0);
    for (const [w, d] of delta) {
      const added = d + p.wideIn.reduce((n, e) => n + wideShare(e, w), 0);
      const removed = p.wideOut.reduce((n, e) => n + wideShare(e, w), 0);
      if (added - removed <= 0) continue;
      if (this.sandAt(w) + added - removed > SAND_LIMIT) return { ok: false, why: "dense", at: unkey(w) };
    }
    return { ok: true };
  }

  /** windows with sand under a wide object, and the one where it alone lies thickest */
  private windowsOver(e: Entry): number[] {
    const out = [...this.windows.keys()].filter((w) => wideShare(e, w) > 0);
    const [lo, hi] = [e.box.lo, e.box.hi];
    const mid = [0, 1, 2].map((i) => Math.floor((lo[i] + hi[i]) / 2)) as [number, number, number];
    out.push(windowKey(mid));
    return out;
  }

  commit(p: Proposal): void {
    for (const [cell, d] of p.cellDelta) {
      if (!d) continue;
      forWindowsAround(cell, (w) => {
        const v = (this.windows.get(w) ?? 0) + d;
        if (v) this.windows.set(w, v);
        else this.windows.delete(w);
      });
    }
    for (const [id, e] of p.next) {
      this.wide.delete(id);
      if (e) this.entries.set(id, e);
      else this.entries.delete(id);
      if (e && !e.spread) this.wide.set(id, e);
    }
    this.total += p.totalDelta;
  }

  /** the fullest place, as a share of the limit (1 = full); for the room's meter */
  fullest(): number {
    let max = 0;
    for (const w of this.windows.keys()) max = Math.max(max, this.sandAt(w));
    return max / SAND_LIMIT;
  }

  /** every window with sand, for the sand map: centre cell and how full (1 = at the limit) */
  *windowFill(): Generator<[[number, number, number], number]> {
    for (const w of this.windows.keys()) yield [unkey(w), this.sandAt(w) / SAND_LIMIT];
  }

  /** would this object, so placed, still lie on the same cells? (then moving it changes no sand) */
  sameCells(id: string, shape: Shape): boolean {
    const was = this.entries.get(id)?.box;
    if (!was) return false;
    const now = cellBox(worldBox(shape));
    return [0, 1, 2].every((i) => was.lo[i] === now.lo[i] && was.hi[i] === now.hi[i]);
  }

  weightOf(id: string): number {
    return this.entries.get(id)?.weight ?? 0;
  }
}

function windowDeltas(cellDelta: Map<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [cell, d] of cellDelta) {
    if (d) forWindowsAround(cell, (w) => out.set(w, (out.get(w) ?? 0) + d));
  }
  return out;
}

const windowKey = (c: [number, number, number]) => key(c[0], c[1], c[2]);
