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

  it("reads old saves that call it sstate with v", () => {
    const o = sanitizeObj(obj({ script: "on touch", sstate: { src: "abc", v: { n: 3, ok: true }, home } }))!;
    expect(o.scriptState).toEqual({ src: "abc", vars: { n: 3, ok: true }, home, timer: undefined, pivot: undefined });
    expect((o as any).sstate).toBeUndefined();
  });

  it("reads scriptState with vars, stops at a bad variable name, clamps the timer", () => {
    const vars = { a: 1, b: NaN, "bad name": 2, s: "x" };
    const o = sanitizeObj(obj({ script: "x", scriptState: { src: "k", vars, home, timer: 99999 } }))!;
    expect(o.scriptState!.vars).toEqual({ a: 1 });
    expect(o.scriptState!.timer).toBe(3600);
  });

  it("ignores state without a script or without a home", () => {
    expect(sanitizeObj(obj({ sstate: { src: "a", v: {}, home } }))!.scriptState).toBeUndefined();
    expect(sanitizeObj(obj({ script: "x", sstate: { src: "a", v: {} } }))!.scriptState).toBeUndefined();
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
