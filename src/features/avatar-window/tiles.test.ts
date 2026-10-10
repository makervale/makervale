import { describe, expect, it } from "vitest";
import type { IndexEntry } from "@/avatar/vrm/registry";
import { filterAvatars, modelName, spritePosition, tileHTML } from "./tiles";

const entry = (name: string, collection: number): IndexEntry => ({ name, collection, model: "m:" + name, thumb: "" });

describe("avatar picker", () => {
  it("finds a thumbnail's tile in the sprite sheet", () => {
    const sheet = { file: "t.jpg", tile: 64, cols: 3, have: [0, 2, 5, 7] };
    expect(spritePosition(0, sheet)).toEqual({ x: 0, y: 0 });
    expect(spritePosition(5, sheet)).toEqual({ x: 128, y: 0 });
    expect(spritePosition(7, sheet)).toEqual({ x: 0, y: 64 });
    expect(spritePosition(1, sheet)).toBeNull();
  });

  it("filters by collection and by name, ignoring case", () => {
    const all = [entry("Robot", 0), entry("Rabbit", 1), entry("Cat", 1)];
    expect(filterAvatars(all, -1, "").length).toBe(3);
    expect(filterAvatars(all, 1, "").map((e) => e.name)).toEqual(["Rabbit", "Cat"]);
    expect(filterAvatars(all, -1, " ro ").map((e) => e.name)).toEqual(["Robot"]);
  });

  it("names the model you wear", () => {
    const all = [entry("Robot", 0)];
    expect(modelName("m:Robot", all)).toBe("Robot");
    expect(modelName("file:" + "a".repeat(64), all)).toBe("Your own avatar");
    expect(modelName("unknown", all)).toBe("Avatar");
  });

  it("marks the worn tile and escapes names", () => {
    const html = tileHTML({ name: "<b>", model: "m", img: "x.jpg" }, "m");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("&lt;b>");
    expect(html).toContain('<img src="x.jpg"');
  });
});
