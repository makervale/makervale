import { describe, expect, it } from "vitest";
import type { KeyValue } from "./prefs";
import { Prefs } from "./prefs";

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("tool prefs", () => {
  it("starts with the default pins and no recent tools", () => {
    const p = new Prefs(memory());
    expect(p.pins()).toContain("extrude");
    expect(p.recent).toEqual([]);
  });

  it("toggles a pin, saves it and tells listeners", () => {
    const store = memory();
    const p = new Prefs(store);
    let told = 0;
    p.onChange(() => told++);
    p.togglePin("bevel");
    expect(p.pins()).toContain("bevel");
    p.togglePin("extrude");
    expect(p.pins()).not.toContain("extrude");
    expect(told).toBe(2);
    expect(new Prefs(store).pins()).toEqual(p.pins());
  });

  it("keeps the twelve most recent tools, newest first, without repeats", () => {
    const p = new Prefs(memory());
    for (let i = 0; i < 15; i++) p.noteUsed("t" + i);
    p.noteUsed("t5");
    expect(p.recent.length).toBe(12);
    expect(p.recent[0]).toBe("t5");
    expect(p.recent.filter((x) => x === "t5").length).toBe(1);
  });

  it("survives broken storage", () => {
    const broken: KeyValue = {
      getItem: () => "{not json",
      setItem: () => {
        throw new Error("full");
      },
    };
    const p = new Prefs(broken);
    expect(p.pins().length).toBeGreaterThan(0);
    expect(() => p.togglePin("x")).not.toThrow();
  });
});
