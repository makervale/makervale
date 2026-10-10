/** Words and order for the room lists: how long ago, how many people, which rooms answered a ping. */
import type { CheckState, ProbeResult, RelayStatus, RoomAd } from "./port";

const MINUTE_MS = 60_000;
const HOUR_MIN = 60;
const DAY_MIN = 1440;

export const people = (n: number): string => `${n} ${n === 1 ? "person" : "people"}`;

/** when a public room last announced itself (`at` in seconds, as Nostr has it) */
export function announcedAgo(atSeconds: number, nowMs: number): string {
  const m = Math.max(0, Math.round((nowMs / 1000 - atSeconds) / 60));
  return m < 1 ? "now" : m + " min ago";
}

/** when you were last in a saved room */
export function savedAgo(savedAt: number, nowMs: number): string {
  const min = (nowMs - savedAt) / MINUTE_MS;
  if (min < 1) return "just now";
  if (min < HOUR_MIN) return Math.round(min) + " min ago";
  if (min < DAY_MIN) return Math.round(min / HOUR_MIN) + " h ago";
  return new Date(savedAt).toLocaleDateString();
}

export function relayStatusText(s: RelayStatus): string {
  if (s.probing) return "finding relays…";
  if (!s.total) return "no relay answers";
  if (!s.reachable) return "connecting…";
  return `via ${s.reachable} relay${s.reachable === 1 ? "" : "s"}`;
}

export function noRoomsText(s: RelayStatus): string {
  if (s.reachable) return "No public rooms right now. Open one!";
  if (!s.probing && !s.total) {
    return (
      "Can’t reach any public relay from here (offline, or this view blocks them). " +
      "You can still join with a code if relays become reachable."
    );
  }
  return "Looking for rooms…";
}

type Lookup = (id: string) => ProbeResult | null;

/** rooms that answered first, then the unchecked ones, then the silent ones; busiest first within each */
export function rankRooms(rooms: readonly RoomAd[], result: Lookup): RoomAd[] {
  const rank = (r: RoomAd) => {
    const p = result(r.id);
    if (!p) return 1;
    return p.ok ? 0 : 2;
  };
  return [...rooms].sort((a, b) => rank(a) - rank(b) || b.people - a.people);
}

export function pingLabel(p: ProbeResult | null): string {
  if (!p) return `<em class="ping run">checking…</em>`;
  if (p.ok) return `<em class="ping ok" title="Round trip to the host">✓ ${p.ms} ms</em>`;
  const why = "No answer within 20 s: your networks may not be able to connect";
  return `<em class="ping bad" title="${why}">✕ no answer</em>`;
}

const MARKS: Record<CheckState, string> = { ok: "✓", run: "…", warn: "!", bad: "✕" };
export const checkMark = (s: CheckState): string => MARKS[s];

/** what a room code looks like (also keeps junk out of the room name we connect to) */
export const isRoomCode = (code: string): boolean => /^[\w-]{6,40}$/.test(code);
