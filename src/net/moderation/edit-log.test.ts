import { describe, expect, it } from "vitest";
import type { Obj } from "@/world/model";
import { newObj } from "@/world/model";
import type { Change } from "./edit-log";
import { EditLog, undoPlan } from "./edit-log";

const tri = () => ({
  v: [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ] as [number, number, number][],
  f: [[0, 1, 2]],
  fm: [0],
});
const obj = (id: string, x: number): Obj => ({ ...newObj({ seq: 1, objects: [] }, tri(), [x, 0, 0], [1, 1, 1]), id });

function scene(objs: Obj[]) {
  const m = new Map(objs.map((o) => [o.id, o]));
  return (id: string) => m.get(id);
}

describe("undo one person's changes", () => {
  it("removes what they made, even if someone moved it since", () => {
    const changes: Change[] = [
      { at: 1, who: "grief", id: "a", before: null, after: obj("a", 1) },
      { at: 2, who: "ann", id: "a", before: obj("a", 1), after: obj("a", 2) },
    ];
    expect(undoPlan(changes, "grief", scene([obj("a", 2)]))).toEqual(new Map([["a", null]]));
  });

  it("puts back what they changed, unless someone changed it after them", () => {
    const changes: Change[] = [
      { at: 1, who: "grief", id: "b", before: obj("b", 0), after: obj("b", 9) },
      { at: 1, who: "grief", id: "c", before: obj("c", 0), after: obj("c", 9) },
      { at: 2, who: "ann", id: "c", before: obj("c", 9), after: obj("c", 5) },
    ];
    const plan = undoPlan(changes, "grief", scene([obj("b", 9), obj("c", 5)]));
    expect([...plan.keys()]).toEqual(["b"]);
    expect(plan.get("b")?.pos).toEqual([0, 0, 0]);
  });

  it("leaves objects the owner changed by hand since (the owner's edits are logged too)", () => {
    const changes: Change[] = [
      { at: 1, who: "grief", id: "d", before: obj("d", 0), after: obj("d", 9) },
      { at: 2, who: "owner", id: "d", before: null, after: obj("d", 4) },
    ];
    expect(undoPlan(changes, "grief", scene([obj("d", 4)])).size).toBe(0);
  });

  it("undoes a change even if a script changed the object since", () => {
    const changes: Change[] = [{ at: 1, who: "grief", id: "e", before: obj("e", 0), after: obj("e", 9) }];
    const scripted: Obj = {
      ...obj("e", 9),
      scriptState: { src: "", vars: { lit: true }, home: { pos: [9, 0, 0], quat: [0, 0, 0, 1], size: [1, 1, 1] } },
    };
    expect(undoPlan(changes, "grief", scene([scripted]))).toEqual(new Map([["e", obj("e", 0)]]));
  });

  it("keeps a copy a minute, for half an hour", () => {
    const log = new EditLog();
    for (let t = 0; t <= 40 * 60_000; t += 30_000) log.checkpoint(t, () => ({ seq: 1, objects: [] }));
    expect(log.checkpoints.length).toBeLessThanOrEqual(32);
    expect(log.checkpointBefore(40 * 60_000 - 5 * 60_000)?.at).toBe(35 * 60_000);
  });
});
