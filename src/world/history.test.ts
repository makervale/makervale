import { describe, expect, it } from "vitest";
import { History } from "./history";
import { emptyWorld, newObj } from "./model";

const box = () => ({ v: [[0, 0, 0] as [number, number, number]], f: [[0]], fm: [0] });

function setup(permits?: () => boolean) {
  const world = emptyWorld();
  const applied: string[][] = [];
  let selection: unknown = "sel0";
  const history = new History({
    world: () => world,
    getSelection: () => selection,
    setSelection: (s) => {
      selection = s;
    },
    applied: (ids) => applied.push(ids),
    permits,
  });
  return { world, history, applied, selection: () => selection };
}

describe("History", () => {
  it("records a move and undoes it", () => {
    const { world, history, applied } = setup();
    const o = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(o);
    history.begin("Move", [o.id]);
    o.pos = [1, 2, 3];
    expect(history.end()).not.toBeNull();
    expect(applied).toEqual([[o.id]]);
    history.undo();
    expect(world.objects[0].pos).toEqual([0, 0, 0]);
    history.redo();
    expect(world.objects[0].pos).toEqual([1, 2, 3]);
  });

  it("notices objects created or deleted during the action", () => {
    const { world, history } = setup();
    history.begin("Create", []);
    world.objects.push(newObj(world, box(), [0, 0, 0], [1, 1, 1]));
    history.end();
    expect(world.objects).toHaveLength(1);
    history.undo();
    expect(world.objects).toHaveLength(0);
    history.redo();
    expect(world.objects).toHaveLength(1);
  });

  it("makes no entry when nothing changed, and restores the selection on undo", () => {
    const { world, history, selection } = setup();
    const o = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(o);
    history.begin("Nothing", [o.id]);
    expect(history.end()).toBeNull();
    history.begin("Move", [o.id]);
    o.pos = [5, 0, 0];
    history.end();
    history.undo();
    expect(selection()).toBe("sel0");
  });

  it("keeps the object order after undo", () => {
    const { world, history } = setup();
    const a = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    const b = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(a, b);
    history.begin("Delete", [a.id]);
    world.objects = [b];
    history.end();
    history.undo();
    expect(world.objects.map((o) => o.id)).toEqual([a.id, b.id]);
  });

  it("an undo the laws refuse doesn't happen, and stays on the stack", () => {
    let allowed = true;
    const { world, history } = setup(() => allowed);
    const o = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(o);
    history.begin("Move", [o.id]);
    o.pos = [5, 0, 0];
    history.end();
    allowed = false;
    expect(history.undo()).toBeNull();
    expect(world.objects[0].pos).toEqual([5, 0, 0]);
    allowed = true;
    expect(history.undo()).not.toBeNull();
    expect(world.objects[0].pos).toEqual([0, 0, 0]);
  });

  it("a re-run the laws refuse leaves the run it replaced", () => {
    let allowed = true;
    const { world, history } = setup(() => allowed);
    const o = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(o);
    history.begin("Move", [o.id]);
    o.pos = [5, 0, 0];
    history.end({ id: "move", params: { x: 5 } });
    history.revertLastForRerun();
    allowed = false;
    history.begin("Move", [o.id]);
    world.objects[0].pos = [50, 0, 0];
    expect(history.end({ id: "move", params: { x: 50 } })).toBeNull();
    expect(world.objects[0].pos).toEqual([5, 0, 0]);
    expect(history.last()?.tool?.params).toEqual({ x: 5 });
  });

  it("a re-run reports what the run it replaced made, as gone now", () => {
    const { world, history, applied } = setup(() => true);
    history.begin("Add", []);
    const first = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(first);
    history.end({ id: "add", params: { n: 1 } });
    history.revertLastForRerun();
    history.begin("Add", []);
    const second = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(second);
    history.end({ id: "add", params: { n: 2 } });
    expect(world.objects.map((o) => o.id)).toEqual([second.id]);
    expect(applied.at(-1)).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it("a refused undo leaves the scene as it is now, changes others made since included", () => {
    let allowed = true;
    const { world, history } = setup(() => allowed);
    const o = newObj(world, box(), [0, 0, 0], [1, 1, 1]);
    world.objects.push(o);
    history.begin("Move", [o.id]);
    o.pos = [5, 0, 0];
    history.end();
    // a peer moved it since
    world.objects[0].pos = [9, 9, 9];
    allowed = false;
    expect(history.undo()).toBeNull();
    expect(world.objects[0].pos).toEqual([9, 9, 9]);
  });
});
