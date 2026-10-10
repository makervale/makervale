import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { Vec3 } from "../vec";
import { composeMatrix } from "./affine";
import { booleanOp } from "./boolean";
import { genBox, genCylinder, genSphere } from "./generators";
import type { Mesh } from "./mesh";
import { signedVolume } from "./mesh";
import { topologyOf } from "./topology";
import { inspect } from "./validate";

const M = (pos: Vec3 = [0, 0, 0], size: Vec3 = [1, 1, 1]) => composeMatrix(pos, [0, 0, 0, 1], size);
const at = (mesh: Mesh, matrix: ArrayLike<number> = M()) => ({ mesh, matrix });
const closed = (m: Mesh) => {
  const r = inspect(m);
  return { open: r.open.length, nm: r.nonManifold.length, flipped: r.flipped.length };
};
const ok = { open: 0, nm: 0, flipped: 0 };
const euler = (m: Mesh) => m.v.length - topologyOf(m).edges.size + m.f.length;
const report = (name: string, m: Mesh) => {
  const r = inspect(m);
  console.log(
    `${name}: ${r.faces} faces (${r.tris} tris, ${r.quads} quads, ${r.ngons.length} n-gons), ${r.verts} verts, vol ${r.volume.toFixed(4)}`,
  );
};

describe("booleans", () => {
  it("box minus pocket", () => {
    const r = booleanOp(at(genBox(1)), at(genBox(1), M([0, 0, 0.4], [0.4, 0.4, 0.4])), "subtract", 1);
    report("pocket", r);
    expect(closed(r)).toEqual(ok);
    expect(signedVolume(r)).toBeCloseTo(1 - 0.4 * 0.4 * 0.3, 2);
    expect(Math.abs(signedVolume(r) - (1 - 0.048)) / 0.952).toBeLessThan(0.01);
    expect(new Set(r.fm)).toEqual(new Set([0, 1]));
    expect(r.f.length).toBeLessThan(20);
  });
  it("box union box", () => {
    const r = booleanOp(at(genBox(1)), at(genBox(1), M([0.5, 0.5, 0.5])), "union", 0);
    report("union", r);
    expect(closed(r)).toEqual(ok);
    expect(Math.abs(signedVolume(r) - (2 - 0.125)) / 1.875).toBeLessThan(0.01);
  });
  it("scaled operands, result in A unit space", () => {
    const r = booleanOp(
      at(genBox(1), M([1, 2, 3], [2, 2, 2])),
      at(genBox(1), M([1, 2, 3.8], [1, 1, 1])),
      "subtract",
      1,
    );
    expect(closed(r)).toEqual(ok);
    // pocket 1×1×0.7 (B spans z 3.3–4.3, A's top is at 4); world volume 8 − 0.7 → unit space ÷ 8
    expect(signedVolume(r)).toBeCloseTo((8 - 0.7) / 8, 4);
  });
  it("box ∩ sphere", () => {
    const r = booleanOp(at(genBox(1)), at(genSphere(24), M([0.3, 0, 0], [1.2, 1.2, 1.2])), "intersect", 1);
    report("box∩sphere", r);
    expect(closed(r)).toEqual(ok);
    expect(signedVolume(r)).toBeGreaterThan(0.3);
  });
  it("box minus cylinder through it gives a genus-1 solid", () => {
    const r = booleanOp(at(genBox(1)), at(genCylinder(24), M([0, 0, 0], [0.5, 0.5, 2])), "subtract", 2);
    report("hole", r);
    expect(closed(r)).toEqual(ok);
    expect(euler(r)).toBe(0);
    expect(inspect(r).parts).toBe(1);
    const cylArea = 24 * 0.5 * 0.25 * 0.25 * Math.sin((2 * Math.PI) / 24);
    expect(signedVolume(r)).toBeCloseTo(1 - cylArea, 3);
    expect(new Set(r.fm)).toEqual(new Set([0, 2]));
  });
  it("rotated cutter and sphere − sphere stay closed", () => {
    const R = new THREE.Matrix4().compose(
      new THREE.Vector3(0.2, 0.1, 0.45),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.2, 0.5)),
      new THREE.Vector3(0.5, 0.5, 0.5),
    );
    const r = booleanOp(at(genBox(1)), at(genBox(1), R.elements), "subtract", 1);
    report("rotated", r);
    expect(closed(r)).toEqual(ok);
    const s = booleanOp(at(genSphere(32)), at(genSphere(24), M([0.3, 0.2, 0.1], [0.8, 0.8, 0.8])), "subtract", 1);
    report("sphere−sphere", s);
    expect(closed(s)).toEqual(ok);
  });
  it("disjoint: subtract throws, union appends", () => {
    expect(() => booleanOp(at(genBox(1)), at(genBox(1), M([5, 0, 0])), "subtract", 1)).toThrow(
      "The solids do not overlap",
    );
    const r = booleanOp(at(genBox(1)), at(genBox(1), M([5, 0, 0])), "union", 1);
    expect(r.f.length).toBe(12);
    expect(signedVolume(r)).toBeCloseTo(2, 6);
  });
  it("composeMatrix matches three.js", () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.2, 0.5));
    const R = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), q, new THREE.Vector3(0.5, 2, 3));
    const mine = composeMatrix([1, 2, 3], [q.x, q.y, q.z, q.w], [0.5, 2, 3]);
    mine.forEach((x, i) => expect(x).toBeCloseTo(R.elements[i], 12));
  });
});
