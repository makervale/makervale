import { afterEach, describe, expect, it, vi } from "vitest";
import { SKINS } from "@/avatar/look";
import { cleanName, loadIdentity, LOOK_KEY, NAME_KEY, randomLook, storeIdentity } from "./identity";

function fakeStorage(): Map<string, string> {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  });
  return m;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("identity", () => {
  it("makes up a resident with a random look when nothing is stored", () => {
    const who = loadIdentity(() => 0);
    expect(who.name).toBe("Resident 1000");
    expect(who.look.skin).toBe(SKINS[0]);
    expect(who.look.hair).not.toBe("none");
  });

  it("round-trips through storage", () => {
    fakeStorage();
    const who = { name: "Ola", look: { ...randomLook(() => 0.5), model: "" } };
    storeIdentity(who);
    expect(loadIdentity(() => 0)).toEqual(who);
  });

  it("ignores a broken stored look and keeps an old shirt colour", () => {
    const m = fakeStorage();
    m.set(NAME_KEY, "Ola");
    m.set(LOOK_KEY, "{not json");
    m.set("pias.color", "#123456");
    const who = loadIdentity(() => 0);
    expect(who.name).toBe("Ola");
    expect(who.look.shirt).toBe("#123456");
  });

  it("trims and caps typed names, keeping the old one for an empty field", () => {
    expect(cleanName("  Ann  ", "Old")).toBe("Ann");
    expect(cleanName("   ", "Old")).toBe("Old");
    expect(cleanName("x".repeat(50), "Old")).toHaveLength(32);
  });
});
