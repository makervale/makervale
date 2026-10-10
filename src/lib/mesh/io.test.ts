import { describe, expect, it } from "vitest";
import { composeMatrix, IDENTITY } from "./affine";
import { genBox } from "./generators";
import { normaliseForEditor, parseOBJ, parseSTL, toOBJ, toSTL } from "./io";
import { hexToKd } from "./io/obj-export";
import { signedVolume } from "./mesh";
import { boxUV, uvValid } from "./uv";
import { inspect } from "./validate";

describe("STL", () => {
  it("round-trips a placed box in millimetres", () => {
    const buf = toSTL([{ mesh: genBox(1), matrix: composeMatrix([0, 0, 0], [0, 0, 0, 1], [2, 1, 1]) }]);
    expect(buf.byteLength).toBe(84 + 12 * 50);
    const m = parseSTL(buf);
    expect(m.f.length).toBe(6);
    expect(inspect(m).closed).toBe(true);
    expect(signedVolume(m)).toBeCloseTo(2, 5);
  });
  it("reads ASCII", () => {
    const tri = (a: string, b: string, c: string) =>
      `facet normal 0 0 1\nouter loop\nvertex ${a}\nvertex ${b}\nvertex ${c}\nendloop\nendfacet\n`;
    const text = `solid t\n${tri("0 0 0", "1000 0 0", "0 1000 0")}endsolid t\n`;
    const m = parseSTL(new TextEncoder().encode(text).buffer);
    expect(m.f.length).toBe(1);
    expect(Math.max(...m.v.map((p) => p[0]))).toBeCloseTo(1, 9);
  });
  it("mirrored placement keeps faces outward", () => {
    const m = parseSTL(toSTL([{ mesh: genBox(1), matrix: composeMatrix([0, 0, 0], [0, 0, 0, 1], [-1, 1, 1]) }]));
    expect(signedVolume(m)).toBeCloseTo(1, 5);
  });
});

describe("OBJ", () => {
  it("round-trips geometry, slots and UVs (Z-up ↔ Y-up)", () => {
    const box = genBox(1);
    box.fm[2] = 1;
    boxUV(box);
    const materials = [
      { name: "Wall paint", color: "#ff0000" },
      { name: "Wood", color: "#0f0" },
    ];
    const { obj, mtl } = toOBJ([{ name: "My box", mesh: box, matrix: IDENTITY, materials }]);
    expect(obj).toContain("o My_box");
    expect(mtl).toContain("newmtl Wall_paint\nKd 1.0000 0.0000 0.0000");
    expect(mtl).toContain("Kd 0.0000 1.0000 0.0000");
    const [back] = parseOBJ(obj);
    expect(back.name).toBe("My_box");
    expect(back.materials).toEqual(["Wall_paint", "Wood"]);
    expect(back.mesh.f.length).toBe(6);
    expect(uvValid(back.mesh)).toBe(true);
    expect(signedVolume(back.mesh)).toBeCloseTo(1, 6);
    expect(back.mesh.fm.filter((s) => s === 1).length).toBe(1);
  });
  it("groups split objects only without o lines; negative indices work", () => {
    const text = "v 0 0 0\nv 1 0 0\nv 0 1 0\ng a\nf -3 -2 -1\ng b\nf 1/1 2/1 3\n";
    const parts = parseOBJ(text);
    expect(parts.map((p) => p.name)).toEqual(["a", "b"]);
    expect(parts[1].mesh.uv).toBeUndefined();
    expect(parts[0].mesh.v[2]).toEqual([0, -0, 1]);
  });
  it("hexToKd falls back to grey", () => {
    expect(hexToKd("not a colour")).toBe("0.8000 0.8000 0.8000");
  });
});

describe("normaliseForEditor", () => {
  it("recentres and rescales into the unit box; flat axes get a tiny size", () => {
    const m = {
      v: [
        [1, 2, 5],
        [3, 2, 5],
        [3, 6, 5],
      ] as [number, number, number][],
      f: [[0, 1, 2]],
      fm: [0],
    };
    const n = normaliseForEditor(m);
    expect(n.pos).toEqual([2, 4, 5]);
    expect(n.size).toEqual([2, 4, 1e-3]);
    expect(n.mesh.v).toEqual([
      [-0.5, -0.5, 0],
      [0.5, -0.5, 0],
      [0.5, 0.5, 0],
    ]);
  });
});
