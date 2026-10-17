import { describe, expect, it } from "vitest";
import { Ledger, ROOM_CEILING } from "@/lib/weight";
import { sampleWorld } from "./index";

describe("the start scene and the laws of space", () => {
  it("fits with room to build", () => {
    const L = new Ledger();
    L.reset(sampleWorld().objects.map((o) => [o.id, o] as [string, typeof o]));
    expect(L.fullest()).toBeLessThan(0.6);
    expect(L.total).toBeLessThan(ROOM_CEILING * 0.15);
  });
});
