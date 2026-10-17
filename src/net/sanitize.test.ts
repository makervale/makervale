import { describe, expect, it } from "vitest";
import {
  cleanFx,
  cleanNum,
  cleanQuat,
  cleanText,
  cleanTransform,
  sanitizeObj,
  sanitizeObjects,
  validId,
} from "./sanitize";

const tri = () => ({
  v: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ],
  f: [[0, 1, 2]],
  fm: [0],
});
const obj = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  name: "Box",
  pos: [1, 2, 3],
  quat: [0, 0, 0, 1],
  size: [1, 1, 1],
  mesh: tri(),
  materials: [{ name: "M", color: "#ff0000" }],
  ...over,
});

describe("numbers", () => {
  it("rejects what isn't a finite number and clamps the rest", () => {
    expect(cleanNum(NaN)).toBeNull();
    expect(cleanNum(Infinity)).toBeNull();
    expect(cleanNum("5")).toBeNull();
    expect(cleanNum(undefined)).toBeNull();
    expect(cleanNum(5, 0, 2)).toBe(2);
    expect(cleanNum(-1e9)).toBe(-1e6);
  });

  it("rejects quaternions with components past 1 instead of clamping them", () => {
    expect(cleanQuat([0, 0, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(cleanQuat([0, 0, 2, 1])).toBeNull();
    expect(cleanQuat([0, 0, 1])).toBeNull();
  });
});

describe("text", () => {
  it("drops control characters and trims", () => {
    expect(cleanText("  hi\u0000 there\u001b\n ", 50)).toBe("hi there");
    expect(cleanText("abcdef", 3)).toBe("abc");
    expect(cleanText(42, 10)).toBe("");
  });

  it("keeps newlines and tabs in scripts only", () => {
    const o = sanitizeObj(obj({ name: "a\nb", script: "on touch\n\tsay hi\u0007" }))!;
    expect(o.name).toBe("ab");
    expect(o.script).toBe("on touch\n\tsay hi");
  });

  it("checks ids", () => {
    expect(validId("o12_a-b")).toBe(true);
    expect(validId("has space")).toBe(false);
    expect(validId("x".repeat(49))).toBe(false);
    expect(validId(7)).toBe(false);
  });
});

describe("objects", () => {
  it("accepts a sane object and fills defaults", () => {
    const o = sanitizeObj(obj())!;
    expect(o.pos).toEqual([1, 2, 3]);
    expect(o.materials[0].color).toBe("#ff0000");
    expect(o.materials[0].pattern).toBe("none");
    expect(o.group).toBeNull();
  });

  it("rejects bad numbers and broken meshes", () => {
    expect(sanitizeObj(obj({ pos: [NaN, 0, 0] }))).toBeNull();
    expect(sanitizeObj(obj({ size: [1, 1] }))).toBeNull();
    expect(sanitizeObj(obj({ mesh: { v: [[0, 0, 0]], f: [[0, 1, 2]] } }))).toBeNull();
    expect(sanitizeObj(obj({ mesh: { v: [[0, 0, "x"]], f: [] } }))).toBeNull();
    expect(sanitizeObj(obj({ id: "../evil" }))).toBeNull();
  });

  it("clamps sizes and material numbers, and drops bad material slots", () => {
    const o = sanitizeObj(
      obj({ size: [0, 1e9, 1], materials: [{ opacity: 7, color: "red" }], mesh: { ...tri(), fm: [5] } }),
    )!;
    expect(o.size).toEqual([1e-6, 1e5, 1]);
    expect(o.materials[0].opacity).toBe(1);
    expect(o.materials[0].color).toBe("#c9c4b8");
    expect(o.mesh.fm).toEqual([0]);
  });

  it("keeps each id once", () => {
    const list = sanitizeObjects([obj(), obj({ name: "Again" }), obj({ id: "o2" }), "junk"], 10);
    expect(list.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(list[0].name).toBe("Box");
  });
});

describe("script state", () => {
  const home = { pos: [0, 0, 0], quat: [0, 0, 0, 1], size: [1, 1, 1] };

  it("keeps a script's state as plain JSON, within limits, and drops what isn't plain", () => {
    const state = { scores: { Ann: 3 }, list: [1, "two", true], bad: NaN, deep: { a: { b: { c: 1 } } } };
    const o = sanitizeObj(obj({ script: "x", scriptState: { src: "k", state, home } }))!;
    expect(o.scriptState!.state).toEqual({ scores: { Ann: 3 }, list: [1, "two", true], bad: null, deep: { a: { b: { c: 1 } } } });
    const huge = { list: Array.from({ length: 9000 }, (_, i) => i) };
    const big = sanitizeObj(obj({ script: "x", scriptState: { src: "k", state: huge, home } }))!;
    expect((big.scriptState!.state as { list: unknown[] }).list.filter((x) => x !== null).length).toBeLessThan(5000);
  });

  it("ignores state without a script or without a home", () => {
    expect(sanitizeObj(obj({ scriptState: { src: "a", state: {}, home } }))!.scriptState).toBeUndefined();
    expect(sanitizeObj(obj({ script: "x", scriptState: { src: "a", state: {} } }))!.scriptState).toBeUndefined();
  });

  it("keeps a label of a few lines, without control characters", () => {
    expect(sanitizeObj(obj({ label: "Red 2 : 1 Blue\nAnn scored\u0007" }))!.label).toBe("Red 2 : 1 Blue\nAnn scored");
    expect(sanitizeObj(obj({ label: 42 }))!.label).toBeUndefined();
  });
});

describe("small messages", () => {
  it("checks transforms and smooth moves", () => {
    const t = { id: "o1", pos: [0, 0, 0], quat: [0, 0, 0, 1], size: [1, 1, 1] };
    expect(cleanTransform(t)).toEqual(t);
    expect(cleanTransform({ ...t, pos: [0, 0, Infinity] })).toBeNull();
    expect(cleanFx({ ...t, d: 2 })).toEqual({ ...t, d: 2 });
    expect(cleanFx({ ...t, d: 1e9 })!.d).toBe(600);
    expect(cleanFx({ ...t, d: "2" })).toBeNull();
    expect(cleanFx({ ...t, d: 1, pv: [1, 2, 3, 4, 5, 6] })!.pv).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
