import { describe, expect, it } from "vitest";
import { createRules } from "@/lib/rules";

const store: Record<string, string> = {};
const { newRules, updateRules, checkRules, ownsRules } = createRules({
  get: (k) => store[k] ?? null,
  set: (k, v) => {
    store[k] = v;
  },
});

describe("signed room rules", () => {
  it("the opener owns the rules and can change them; others can check them", async () => {
    const r = await newRules("room1", "peerA");
    expect(ownsRules(r)).toBe(true);
    expect(await checkRules(JSON.parse(JSON.stringify(r)), "room1")).toBeTruthy();
    const r2 = (await updateRules(r, { build: "host", banned: ["peerX"] }))!;
    expect(r2.ver).toBe(2);
    expect(await checkRules(r2, "room1")).toMatchObject({ build: "host", banned: ["peerX"] });
  });

  it("rejects tampering, the wrong room and forged owners", async () => {
    const r = await newRules("room2", "peerA");
    // changed without re-signing
    expect(await checkRules({ ...r, build: "host" }, "room2")).toBeNull();
    expect(await checkRules({ ...r, banned: ["peerA"] }, "room2")).toBeNull();
    expect(await checkRules(r, "other-room")).toBeNull();
    // someone without the key
    delete store["pias.owner.room2"];
    expect(ownsRules(r)).toBe(false);
    expect(await updateRules(r, { build: "host" })).toBeNull();
  });
});
