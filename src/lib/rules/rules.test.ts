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
    const r = await newRules("room1", "peerA", "private");
    expect(ownsRules(r)).toBe(true);
    expect(r.build).toBe("all");
    expect(await checkRules(JSON.parse(JSON.stringify(r)), "room1")).toBeTruthy();
    const r2 = (await updateRules(r, { build: "owner", allow: ["k1"], banned: ["k2"] }))!;
    expect(r2.ver).toBe(2);
    expect(await checkRules(r2, "room1")).toMatchObject({ build: "owner", allow: ["k1"], banned: ["k2"] });
  });

  it("strangers in a public room watch until let; a public room keeps nothing online", async () => {
    const r = await newRules("room3", "peerA", "public");
    expect(r.build).toBe("owner");
    const kept = (await updateRules(r, { keep: true }))!;
    expect(kept.keep).toBe(false);
    // its code was listed publicly: it stays public
    const back = (await updateRules(kept, { kind: "private", keep: true }))!;
    expect(back.kind).toBe("public");
    expect(back.keep).toBe(false);
  });

  it("rejects tampering, the wrong room and forged owners", async () => {
    const r = await newRules("room2", "peerA", "private");
    expect(await checkRules({ ...r, build: "owner" }, "room2")).toBeNull();
    expect(await checkRules({ ...r, allow: ["me"] }, "room2")).toBeNull();
    expect(await checkRules({ ...r, kind: "public" }, "room2")).toBeNull();
    expect(await checkRules(r, "other-room")).toBeNull();
    delete store["pias.owner.room2"];
    expect(ownsRules(r)).toBe(false);
    expect(await updateRules(r, { build: "owner" })).toBeNull();
  });
});
