import { describe, expect, it } from "vitest";
import { genBox } from "@/lib/mesh/generators";
import { loadWorld } from "./migrate";
import { defaultMaterial, newObj } from "./model";
import type { World } from "./model";

describe("loading old saves", () => {
  it("keeps current objects and renames the old script state", () => {
    const world: World = { seq: 5, objects: [] };
    const o = newObj(world, genBox(1), [1, 2, 3], [1, 1, 1], { name: "Door" });
    o.script = "var open = false";
    const saved = JSON.parse(JSON.stringify({ seq: world.seq, objects: [o] }));
    saved.objects[0].sstate = {
      src: "abc",
      v: { open: true },
      home: { pos: [1, 2, 3], quat: [0, 0, 0, 1], size: [1, 1, 1] },
      timer: 2,
    };
    const w = loadWorld(saved);
    expect(w.seq).toBe(6);
    const d = w.objects[0];
    expect(d.name).toBe("Door");
    expect(d.mesh.f.length).toBe(6);
    expect(d.scriptState).toEqual({
      src: "abc",
      vars: { open: true },
      home: { pos: [1, 2, 3], quat: [0, 0, 0, 1], size: [1, 1, 1] },
      timer: 2,
    });
    expect("sstate" in d).toBe(false);
  });

  it("opens project files, which wrap the world", () => {
    const o = newObj({ seq: 1, objects: [] }, genBox(1), [0, 0, 0], [1, 1, 1]);
    const file = JSON.parse(JSON.stringify({ format: "piaskownica", version: 4, world: { seq: 2, objects: [o] } }));
    const w = loadWorld(file);
    expect(w.objects.map((x) => x.id)).toEqual(["o1"]);
    expect(w.objects[0].scriptState).toBeUndefined();
  });

  it("turns old prims into meshes with one material per face", () => {
    const w = loadWorld({
      objects: [
        {
          id: "o7",
          type: "cylinder",
          pos: [0, 0, 1],
          size: [1, 1, 2],
          link: "g3",
          faces: [{ c: "#ff0000", shine: "high", alpha: 50 }, { gloss: 0.5, bright: true, pat: "brick", ru: 0 }, {}],
        },
        { id: "o8", type: "blob", pos: [0, 0, 0], size: [1, 1, 1] },
      ],
    });
    expect(w.seq).toBe(1);
    const [cyl, blob] = w.objects;
    expect(cyl.mesh.f.length).toBe(26);
    expect(cyl.quat).toEqual([0, 0, 0, 1]);
    expect(cyl.group).toBe("g3");
    expect(cyl.name).toBe("Object");
    expect(cyl.materials[0]).toEqual(
      defaultMaterial({ name: "Material 1", color: "#ff0000", roughness: 0.18, metalness: 0.15, opacity: 0.5 }),
    );
    expect(cyl.materials[1]).toMatchObject({ roughness: 0.52, emissive: 1, pattern: "brick", repU: 0 });
    expect(cyl.materials[2]).toEqual(defaultMaterial({ name: "Material 3", roughness: 0.92 }));
    expect(blob.mesh.f.length).toBe(6);
    expect(blob.materials.length).toBe(1);
  });

  it("keeps early meshes and their material names", () => {
    const w = loadWorld({
      seq: 3,
      objects: [{ id: "o1", pos: [0, 0, 0], size: [1, 1, 1], mesh: { ...genBox(1), keys: ["Wood"] }, faces: [{}] }],
    });
    expect(w.objects[0].mesh.v.length).toBe(8);
    expect(w.objects[0].materials[0].name).toBe("Wood");
  });

  it("gives an empty world for anything else", () => {
    expect(loadWorld(null)).toEqual({ seq: 1, objects: [] });
    expect(loadWorld("nope").objects).toEqual([]);
  });
});
