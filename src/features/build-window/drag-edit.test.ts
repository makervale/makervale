import { describe, expect, it } from "vitest";
import { Bus } from "@/app/bus";
import { Commands } from "@/app/commands";
import { Store } from "@/app/store";
import { genBox } from "@/lib/mesh/generators";
import { newObj } from "@/world/model";
import { DragEdit } from "./drag-edit";

function setup() {
  const store = new Store();
  const bus = new Bus();
  const commands = new Commands(store, bus);
  const synced: string[] = [];
  const renderer = {
    views: { sync: (o: { id: string }) => synced.push(o.id) },
    highlights: { refresh: () => {} },
  } as unknown as ConstructorParameters<typeof DragEdit>[0]["renderer"];
  const o = newObj(store.world, genBox(1), [0, 0, 0], [1, 1, 1]);
  store.world.objects.push(o);
  const dragged: string[][] = [];
  bus.on("world:dragging", ({ ids }) => dragged.push(ids));
  return { store, commands, drag: new DragEdit({ commands, renderer }), o, synced, dragged };
}

describe("spinner drags", () => {
  it("follow every step live and leave one undo entry", () => {
    const { store, commands, drag, o, synced, dragged } = setup();
    const step = (phase: "start" | "live" | "end", v: number) =>
      drag.step({ label: "Size", objs: [o], phase, apply: () => (o.size[0] = v) });
    step("start", 1);
    step("live", 2);
    step("live", 3);
    expect(o.size[0]).toBe(3);
    expect(synced.length).toBe(2);
    expect(dragged.length).toBe(2);
    step("end", 3);
    expect(o.size[0]).toBe(3);
    expect(commands.history.last()?.label).toBe("Size");
    commands.undo();
    expect(store.byId(o.id)!.size[0]).toBe(1);
    expect(commands.history.last()).toBeUndefined();
  });

  it("a typed value (start then end) is one entry too", () => {
    const { store, commands, drag, o } = setup();
    drag.step({ label: "Position", objs: [o], phase: "start", apply: () => (o.pos[2] = 5) });
    drag.step({ label: "Position", objs: [o], phase: "end", apply: () => (o.pos[2] = 5) });
    expect(o.pos[2]).toBe(5);
    commands.undo();
    expect(store.byId(o.id)!.pos[2]).toBe(0);
  });

  it("keeps the same object, so everything holding it sees the result", () => {
    const { store, drag, o } = setup();
    drag.step({ label: "Size", objs: [o], phase: "live", apply: () => (o.size[1] = 4) });
    drag.step({ label: "Size", objs: [o], phase: "end", apply: () => (o.size[1] = 4) });
    expect(store.world.objects[0]).toBe(o);
    expect(o.size[1]).toBe(4);
  });
});
