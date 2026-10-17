/** Words: how long ago, how many people, what a relay status means. */
import type { CheckState, RelayStatus } from "./port";

const MINUTE_MS = 60_000;
const HOUR_MIN = 60;
const DAY_MIN = 1440;

export const people = (n: number): string => `${n} ${n === 1 ? "person" : "people"}`;
export const objects = (n: number): string => `${n} ${n === 1 ? "object" : "objects"}`;

/** a scene's weight in a word, from its share of the room ceiling (%); "" when unknown */
export function fillWord(fill: number | null): string {
  if (fill === null) return "";
  if (fill < 34) return "light";
  return fill < 67 ? "busy" : "heavy";
}

export function ago(at: number, nowMs = Date.now()): string {
  const min = (nowMs - at) / MINUTE_MS;
  if (min < 1) return "just now";
  if (min < HOUR_MIN) return Math.round(min) + " min ago";
  if (min < DAY_MIN) return Math.round(min / HOUR_MIN) + " h ago";
  const days = Math.round(min / DAY_MIN);
  return days < 30 ? `${days} day${days === 1 ? "" : "s"} ago` : new Date(at).toLocaleDateString();
}

export function relayStatusText(s: RelayStatus): string {
  if (s.probing) return "finding relays…";
  if (!s.total) return "no relay answers";
  if (!s.reachable) return "connecting…";
  return `via ${s.reachable} relay${s.reachable === 1 ? "" : "s"}`;
}

const MARKS: Record<CheckState, string> = { ok: "✓", run: "…", warn: "!", bad: "✕" };
export const checkMark = (s: CheckState): string => MARKS[s];

/** a fold whose open state lives in the window's state (MpState.folds), so redrawing the page never closes it */
export function fold(folds: ReadonlySet<string>, id: string, summary: string, body: string): string {
  return `<details class="mp-fold" data-fold="${id}"${folds.has(id) ? " open" : ""}><summary>${summary}</summary>${body}</details>`;
}
