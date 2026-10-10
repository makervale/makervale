import { describe, expect, it } from "vitest";
import { genBox } from "@/lib/mesh/generators";
import { inspect } from "@/lib/mesh/validate";
import { emptyWorld, newObj } from "@/world/model";
import { dimensions, health, profiles } from "./checks";

const boxObj = (size: [number, number, number] = [1, 2, 3]) => newObj(emptyWorld(), genBox(1), [0, 0, 0], size);

describe("Check mesh", () => {
  it("passes a closed box on every profile", () => {
    const o = boxObj();
    const r = inspect(o.mesh);
    expect(health(r).map((f) => f.level)).toEqual(["ok", "ok"]);
    const p = profiles(o, r);
    expect(p.game[0]).toBe("ok");
    expect(p.print).toEqual(["ok", "1000×2000×3000 mm"]);
  });

  it("measures the object in metres", () => {
    expect(dimensions(boxObj([2, 4, 0.5]))).toEqual([2, 4, 0.5]);
  });

  it("finds holes and offers to show them", () => {
    const o = boxObj();
    o.mesh.f.pop();
    o.mesh.fm.pop();
    const r = inspect(o.mesh);
    const holes = health(r)[0];
    expect(holes.level).toBe("warn");
    expect(holes.show?.mode).toBe("edge");
    expect(holes.show?.ids.length).toBe(4);
    expect(profiles(o, r).print).toEqual(["bad", "mesh is not closed"]);
  });
});
