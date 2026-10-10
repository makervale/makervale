import { describe, expect, it } from "vitest";
import { genBox } from "../generators";
import { signedVolume } from "../mesh";
import { expectSane, moved } from "../test-helpers";
import { arrayLinear, arrayRadial } from "./array";

describe("arrays", () => {
  it("fuses touching copies into one box", () => {
    const m = genBox(1);
    arrayLinear(m, 3, [1, 0, 0], [1, 1, 1]);
    const r = expectSane(m);
    expect(r.parts).toBe(1);
    expect(signedVolume(m)).toBeCloseTo(3, 6);
    expect(m.f.length).toBe(14);
  });
  it("keeps gaps as separate parts", () => {
    const m = genBox(1);
    arrayLinear(m, 4, [2, 0, 0], [1, 1, 1]);
    expect(expectSane(m).parts).toBe(4);
  });
  it("radial copies", () => {
    const m = moved(genBox(1), [2, 0, 0]);
    arrayRadial(m, { count: 6, axis: { p: [0, 0, 0], d: [0, 0, 1] }, angleDeg: 360 }, [1, 1, 1]);
    const r = expectSane(m);
    expect(r.parts).toBe(6);
    expect(signedVolume(m)).toBeCloseTo(6, 6);
  });
});
