import { describe, expect, it } from "vitest";

(globalThis as any).location = { search: "" };
const saved: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => saved[k] ?? null,
  setItem: (k: string, v: string) => {
    saved[k] = v;
  },
};

describe("TURN relay settings", () => {
  it("has no built-in public relay; uses only the one you save", async () => {
    const ice = await import("./ice");
    expect(ice.turnServers()).toEqual([]);
    expect((ice.iceOptions() as any).turnConfig).toEqual([]);
    const custom = ice.validTurn({
      urls: "turn:relay.example.com:3478 turns:relay.example.com:5349",
      username: "u",
      credential: "p",
    });
    ice.setTurnPrefs({ custom });
    expect(ice.turnServers().map((t) => t.name)).toEqual(["Your relay"]);
    expect((ice.iceOptions() as any).turnConfig).toEqual([
      { urls: ["turn:relay.example.com:3478", "turns:relay.example.com:5349"], username: "u", credential: "p" },
    ]);
  });

  it("rejects addresses that are not TURN urls", async () => {
    const ice = await import("./ice");
    expect(ice.validTurn({ urls: "https://example.com" })).toBeNull();
    expect(ice.validTurn({ urls: "relay.example.com:3478" })).toBeNull();
  });
});
