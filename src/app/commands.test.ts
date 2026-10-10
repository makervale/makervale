import { describe, expect, it } from "vitest";
import { newObj } from "@/world/model";
import { Bus } from "./bus";
import { Commands } from "./commands";
import { Store } from "./store";

const box = () => ({ v: [[0, 0, 0] as [number, number, number]], f: [[0]], fm: [0] });

function setup() {
  const store = new Store();
  const bus = new Bus();
  const notices: string[] = [];
  const commands = new Commands(store, bus, (t) => notices.push(t));
  const events: string[] = [];
  bus.on("world:changed", () => events.push("world"));
  bus.on("selection:changed", () => events.push("selection"));
  const obj = newObj(store.world, box(), [0, 0, 0], [1, 1, 1]);
  store.world.objects.push(obj);
  const current = () => store.byId(obj.id)!;
  return { store, bus, commands, notices, events, obj, current };
}

describe("Commands", () => {
  it("a user action is undoable and announced", () => {
    const { commands, obj, events, current } = setup();
    commands.act("Move", [obj.id], () => {
      obj.pos = [1, 0, 0];
    });
    expect(events).toContain("world");
    commands.undo();
    expect(current().pos).toEqual([0, 0, 0]);
    commands.redo();
    expect(current().pos).toEqual([1, 0, 0]);
  });

  it("moving a scripted object by hand restarts its script from there", () => {
    const { commands, obj, current } = setup();
    obj.scriptState = { src: "x", vars: { up: true }, home: { pos: [0, 0, 0], quat: [0, 0, 0, 1], size: [1, 1, 1] } };
    commands.act("Move", [obj.id], () => {
      current().pos = [4, 0, 0];
    });
    expect(current().scriptState).toBeUndefined();
  });

  it("a drag does the same when it ends, and a script's own change keeps the state", () => {
    const { commands, obj, current } = setup();
    const state = { src: "x", vars: {}, home: { pos: [0, 0, 0], quat: [0, 0, 0, 1], size: [1, 1, 1] } };
    obj.scriptState = structuredClone(state) as typeof obj.scriptState;
    commands.apply([obj.id], () => (current().pos = [0, 0, 2]));
    expect(current().scriptState).toBeDefined();
    commands.startHeld("Move", [obj.id]);
    current().pos = [3, 0, 0];
    commands.finishHeld();
    expect(current().scriptState).toBeUndefined();
  });

  it("a remote change is announced but not undoable", () => {
    const { commands, obj, events } = setup();
    commands.apply([obj.id], () => {
      obj.pos = [2, 0, 0];
    });
    expect(events).toContain("world");
    commands.undo();
    expect(obj.pos).toEqual([2, 0, 0]);
  });

  it("a failing action is rolled back and reported", () => {
    const { commands, obj, notices, current } = setup();
    commands.act("Break", [obj.id], () => {
      obj.pos = [9, 9, 9];
      throw new Error("nope");
    });
    expect(current().pos).toEqual([0, 0, 0]);
    expect(notices).toEqual(["nope"]);
  });

  it("selecting a grouped object selects its whole group", () => {
    const { store, commands, obj } = setup();
    const other = newObj(store.world, box(), [0, 0, 0], [1, 1, 1]);
    store.world.objects.push(other);
    obj.group = other.group = "g1";
    commands.selectObject(obj, false);
    expect(store.selection.objects.size).toBe(2);
    commands.selectObject(obj, true);
    expect(store.selection.objects.size).toBe(0);
  });

  it("mesh editing needs exactly one unlocked object", () => {
    const { store, commands, obj, notices } = setup();
    expect(commands.setMode("face")).toBe(false);
    commands.selectObject(obj, false);
    expect(commands.setMode("face")).toBe(true);
    expect(store.selection.mode).toBe("face");
    obj.locked = true;
    expect(commands.setMode("vert")).toBe(false);
    expect(notices.at(-1)).toMatch(/locked/);
  });
});
