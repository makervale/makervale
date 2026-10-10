import { describe, expect, it } from "vitest";
import { edgeLoop, edgeRing } from "./edge-loops";
import { genBox, genCylinder } from "./generators";
import { append } from "./ops/append";
import { grow, linked, shrink } from "./select-grow";
import { emptySelection, selectedFaces } from "./selection";
import { firstVerticalEdge } from "./test-helpers";

describe("selection", () => {
  it("edge loop around a subdivided box", () => {
    const m = genBox(3);
    expect(edgeLoop(m, firstVerticalEdge(m)).size).toBeGreaterThanOrEqual(3);
  });
  it("edge loop on a cylinder side goes all the way up", () => {
    const m = genCylinder(8, 4);
    expect(edgeLoop(m, firstVerticalEdge(m)).size).toBe(4);
  });
  it("edge ring around a box goes all the way round", () => {
    const m = genBox(1);
    expect(edgeRing(m, firstVerticalEdge(m)).size).toBe(4);
  });
  it("linked picks the whole part", () => {
    const m = genBox(1);
    append(m, genBox(1));
    const s = emptySelection();
    s.faces.add(0);
    expect(linked(m, s).faces.size).toBe(6);
  });
  it("grow then shrink", () => {
    const m = genBox(3);
    const s = emptySelection();
    s.faces.add(4);
    const g = grow(m, s);
    expect(g.faces.size).toBeGreaterThan(1);
    expect(shrink(m, g).faces.size).toBeLessThan(g.faces.size);
  });
  it("faces from vertices", () => {
    const m = genBox(1);
    const s = emptySelection();
    m.f[4].forEach((v) => s.verts.add(v));
    expect([...selectedFaces(m, s)]).toEqual([4]);
  });
});
