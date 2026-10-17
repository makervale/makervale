import { describe, expect, it } from "vitest";
import { pickAuthority } from "./authority";

describe("script authority", () => {
  it("is the synced peer with the smallest id", () => {
    const peers = [
      { id: "c", synced: true },
      { id: "a", synced: false },
      { id: "b", synced: true },
    ];
    expect(pickAuthority("d", true, peers)).toBe("b");
    expect(pickAuthority("a0", true, peers)).toBe("a0");
  });

  it("ignores yourself until you are synced", () => {
    expect(pickAuthority("a", false, [{ id: "z", synced: true }])).toBe("z");
  });

  it("falls back to yourself when nobody is synced", () => {
    expect(pickAuthority("m", false, [{ id: "a", synced: false }])).toBe("m");
    expect(pickAuthority("m", false, [])).toBe("m");
  });

  it("is the same on every peer", () => {
    const all = ["q", "e", "k"].map((id) => ({ id, synced: true }));
    const seen = all.map((me) =>
      pickAuthority(
        me.id,
        true,
        all.filter((p) => p.id !== me.id),
      ),
    );
    expect(new Set(seen)).toEqual(new Set(["e"]));
  });

  it("prefers those who may build, so someone who may not never judges the room while a builder is here", () => {
    const peers = [
      { id: "a", synced: true },
      { id: "b", synced: true },
    ];
    expect(pickAuthority("c", true, peers, (id) => id !== "a")).toBe("b");
    expect(pickAuthority("c", true, peers, () => false)).toBe("a");
  });

  it("is the owner whenever the owner is here and synced, whatever the ids", () => {
    const peers = [
      { id: "a", synced: true },
      { id: "z", synced: true },
    ];
    expect(pickAuthority("m", true, peers, () => true, "z")).toBe("z");
    expect(pickAuthority("z", true, peers.slice(0, 1), () => true, "z")).toBe("z");
    expect(
      pickAuthority(
        "m",
        true,
        [
          { id: "a", synced: true },
          { id: "z", synced: false },
        ],
        () => true,
        "z",
      ),
    ).toBe("a");
  });
});
