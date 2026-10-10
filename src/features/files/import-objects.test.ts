import { describe, expect, it } from "vitest";
import { composeMatrix } from "@/lib/mesh/affine";
import { genBox } from "@/lib/mesh/generators";
import type { Mesh } from "@/lib/mesh/mesh";
import { signedVolume } from "@/lib/mesh/mesh";
import { emptyWorld } from "@/world/model";
import { bakeTransform, objectsFromItems } from "./import-objects";

const box = (): Mesh => genBox(1);

describe("imported objects", () => {
  it("bakes the file's placement into the vertices", () => {
    const m = bakeTransform(box(), composeMatrix([10, 0, 0], [0, 0, 0, 1], [2, 2, 2]));
    const xs = m.v.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(9);
    expect(Math.max(...xs)).toBeCloseTo(11);
  });

  it("keeps faces pointing out when the placement mirrors", () => {
    const m = bakeTransform(box(), composeMatrix([0, 0, 0], [0, 0, 0, 1], [-1, 1, 1]));
    expect(signedVolume(m)).toBeGreaterThan(0);
  });

  it("fits each object into unit space at its own position", () => {
    const world = emptyWorld();
    const mesh = bakeTransform(box(), composeMatrix([5, 0, 1], [0, 0, 0, 1], [4, 2, 1]));
    const [o] = objectsFromItems(world, [{ name: "", mesh, matrix: null, materials: [] }], "crate.stl");
    expect(o.name).toBe("crate.stl");
    expect(o.pos).toEqual([5, 0, 1].map((x) => expect.closeTo(x)));
    expect(o.size).toEqual([4, 2, 1].map((x) => expect.closeTo(x)));
  });

  it("keeps material names and colours, adds slots the mesh needs, groups a multi-part file", () => {
    const world = emptyWorld();
    const two = box();
    two.fm = two.fm.map((_, i) => i % 3);
    const items = [
      { name: "a", mesh: two, matrix: null, materials: [{ name: "Wood", color: "#aa7744" }] },
      { name: "b", mesh: box(), matrix: null, materials: [] },
      { name: "empty", mesh: { v: [], f: [], fm: [] }, matrix: null, materials: [] },
    ];
    const made = objectsFromItems(world, items, "f.obj");
    expect(made.length).toBe(2);
    expect(made[0].materials.map((m) => m.name)).toEqual(["Wood", "Material 2", "Material 3"]);
    expect(made[0].materials[0].color).toBe("#aa7744");
    expect(made[0].group).not.toBeNull();
    expect(made[0].group).toBe(made[1].group);
  });
});
