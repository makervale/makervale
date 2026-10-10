import { describe, expect, it } from "vitest";
import { genBox } from "@/lib/mesh/generators";
import { defaultMaterial, emptyWorld, newObj } from "./model";
import { resting, restingWorld } from "./resting";

function lift() {
  const w = emptyWorld();
  const o = newObj(w, genBox(1), [0, 0, 0], [2, 2, 0.2], { name: "Lift" });
  o.script = "on touch { move 0, 0, 3 in 2 }";
  return { w, o };
}

describe("resting", () => {
  it("saves a scripted object where it was before the script moved it", () => {
    const { o } = lift();
    o.scriptState = { src: "x", vars: { up: true }, home: { pos: [0, 0, 0], quat: [0, 0, 0, 1], size: [2, 2, 0.2] } };
    o.pos = [0, 0, 3];
    const r = resting(o);
    expect(r.pos).toEqual([0, 0, 0]);
    expect(r.scriptState).toBeUndefined();
    expect(r.script).toBe(o.script);
  });

  it("puts back the look the script changed", () => {
    const { o } = lift();
    const dark = defaultMaterial({ color: "#222222" });
    const home = { pos: o.pos, quat: o.quat, size: o.size, look: { materials: [dark], hidden: false } };
    o.scriptState = { src: "x", vars: {}, home };
    o.materials = [defaultMaterial({ color: "#ffcc00", emissive: 1 })];
    o.spin = [0, 0, 90];
    const r = resting(o);
    expect(r.materials[0].color).toBe("#222222");
    expect(r.spin).toBeUndefined();
  });

  it("leaves objects without scripts alone and doesn't touch the live scene", () => {
    const { w, o } = lift();
    o.scriptState = { src: "x", vars: {}, home: { pos: [0, 0, 0], quat: [0, 0, 0, 1], size: [2, 2, 0.2] } };
    o.pos = [0, 0, 3];
    const plain = newObj(w, genBox(1), [5, 0, 0], [1, 1, 1], { name: "Box" });
    w.objects.push(o, plain);
    const saved = restingWorld(w);
    expect(saved.objects[1]).toBe(plain);
    expect(o.pos).toEqual([0, 0, 3]);
  });
});
