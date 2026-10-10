import { describe, expect, it } from "vitest";
import type { ProbeResult, RoomAd } from "./port";
import {
  announcedAgo,
  checkMark,
  isRoomCode,
  noRoomsText,
  people,
  pingLabel,
  rankRooms,
  relayStatusText,
  savedAgo,
} from "./format";

const room = (id: string, n: number, at = 0): RoomAd => ({
  id,
  name: id,
  host: "h",
  people: n,
  objects: 0,
  at,
  key: "",
});

describe("multiplayer window words", () => {
  it("counts people", () => {
    expect(people(1)).toBe("1 person");
    expect(people(3)).toBe("3 people");
  });

  it("says how long ago", () => {
    expect(announcedAgo(1000, 1000_000 + 20_000)).toBe("now");
    expect(announcedAgo(1000, 1000_000 + 5 * 60_000)).toBe("5 min ago");
    const now = 10 * 86_400_000;
    expect(savedAgo(now - 10_000, now)).toBe("just now");
    expect(savedAgo(now - 12 * 60_000, now)).toBe("12 min ago");
    expect(savedAgo(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(savedAgo(now - 3 * 86_400_000, now)).toBe(new Date(now - 3 * 86_400_000).toLocaleDateString());
  });

  it("describes the relays", () => {
    expect(relayStatusText({ probing: true, total: 0, reachable: 0 })).toBe("finding relays…");
    expect(relayStatusText({ probing: false, total: 0, reachable: 0 })).toBe("no relay answers");
    expect(relayStatusText({ probing: false, total: 3, reachable: 0 })).toBe("connecting…");
    expect(relayStatusText({ probing: false, total: 3, reachable: 1 })).toBe("via 1 relay");
    expect(relayStatusText({ probing: false, total: 3, reachable: 2 })).toBe("via 2 relays");
    expect(noRoomsText({ probing: false, total: 3, reachable: 2 })).toContain("Open one");
    expect(noRoomsText({ probing: false, total: 0, reachable: 0 })).toContain("Can’t reach");
    expect(noRoomsText({ probing: true, total: 0, reachable: 0 })).toBe("Looking for rooms…");
  });

  it("lists rooms that answered first, silent ones last, busiest first", () => {
    const results: Record<string, ProbeResult> = {
      dead: { ok: false, ms: 0, at: 0 },
      fast: { ok: true, ms: 40, at: 0 },
      busy: { ok: true, ms: 90, at: 0 },
    };
    const rooms = [room("dead", 9), room("unknown", 5), room("fast", 1), room("busy", 4)];
    expect(rankRooms(rooms, (id) => results[id] ?? null).map((r) => r.id)).toEqual(["busy", "fast", "unknown", "dead"]);
    expect(pingLabel(null)).toContain("checking");
    expect(pingLabel(results.fast)).toContain("✓ 40 ms");
    expect(pingLabel(results.dead)).toContain("no answer");
    expect(checkMark("warn")).toBe("!");
  });

  it("accepts room codes only", () => {
    expect(isRoomCode("abc123xyz")).toBe(true);
    expect(isRoomCode("abc")).toBe(false);
    expect(isRoomCode("has space")).toBe(false);
  });
});
