import { describe, expect, it } from "vitest";
import { ToolRunner } from "@/app/tool-runner";
import { ToolRegistry } from "@/app/tools";
import * as G from "@/lib/mesh/generators";
import { emptySelection } from "@/lib/mesh/selection";
import { newObj } from "@/world/model";
import { registerTools, standaloneToolApp } from "./index";
import { topFaces } from "./helpers";

function setup(count = 2) {
  const app = standaloneToolApp();
  const registry = new ToolRegistry();
  registerTools(registry, app);
  const runner = new ToolRunner(app.store, app.commands, app.bus, registry);
  const objs = Array.from({ length: count }, (_, i) => {
    const o = newObj(app.store.world, G.genBox(1), [i * 2, 0, 0.5], [1, 1, 1], { name: "Box " + i });
    app.store.world.objects.push(o);
    return o;
  });
  return { app, runner, objs };
}

describe("tools through the runner", () => {
  it("extrude switches the arrows to follow the faces, and undoes", () => {
    const { app, runner, objs } = setup(1);
    app.commands.selectObjects([objs[0].id]);
    app.commands.setMode("face");
    app.commands.setElements({ ...emptySelection(), faces: new Set(topFaces(objs[0].mesh)) });
    expect(runner.run("extrude")).toBe(true);
    expect(app.store.settings.axes).toBe("normal");
    expect(app.store.byId(objs[0].id)!.mesh.f.length).toBe(10);
    app.commands.undo();
    expect(app.store.byId(objs[0].id)!.mesh.f.length).toBe(6);
  });

  it("join keeps the last selected object and its place", () => {
    const { app, runner, objs } = setup(2);
    app.commands.selectObjects([objs[1].id, objs[0].id]);
    runner.run("join");
    expect(app.store.world.objects.map((o) => o.id)).toEqual([objs[0].id]);
    const joined = app.store.world.objects[0];
    expect(joined.mesh.f.length).toBe(12);
    expect(Math.max(...joined.mesh.v.map((v) => v[0]))).toBeCloseTo(2.5);
    expect(joined.materials.length).toBe(2);
  });

  it("boolean cuts with the last selected object and removes it", () => {
    const { app, runner, objs } = setup(2);
    objs[1].pos = [0.5, 0, 0.5];
    app.commands.selectObjects([objs[0].id, objs[1].id]);
    runner.run("boolean");
    expect(app.store.world.objects.map((o) => o.id)).toEqual([objs[0].id]);
    expect(app.store.byId(objs[0].id)!.mesh.v.every((v) => v[0] <= 1e-6)).toBe(true);
  });

  it("duplicate gives copies their own group and new ids", () => {
    const { app, runner, objs } = setup(2);
    objs.forEach((o) => (o.group = "g9"));
    app.commands.selectObjects(objs.map((o) => o.id));
    runner.run("duplicate");
    const copies = app.store.world.objects.slice(2);
    expect(copies.length).toBe(2);
    expect(new Set(copies.map((o) => o.group)).size).toBe(1);
    expect(copies[0].group).not.toBe("g9");
    expect(copies[0].pos[0]).toBeCloseTo(0.5);
  });

  it("show all brings hidden objects back undoably", () => {
    const { app, runner, objs } = setup(2);
    objs[1].hidden = true;
    runner.run("unhide");
    expect(app.store.byId(objs[1].id)!.hidden).toBe(false);
    app.commands.undo();
    expect(app.store.byId(objs[1].id)!.hidden).toBe(true);
  });
});
