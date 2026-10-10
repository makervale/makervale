import { describe, expect, it } from "vitest";
import { Store } from "@/app/store";
import { genBox } from "@/lib/mesh/generators";
import { newObj } from "@/world/model";
import { effectiveManipulator, gizmoMode, singlePoint } from "./reference";

function storeWithBox() {
  const store = new Store();
  const o = newObj(store.world, genBox(), [0, 0, 0], [1, 1, 1]);
  store.world.objects.push(o);
  return { store, o };
}

describe("which handles show", () => {
  it("shows nothing without a selection or in create mode", () => {
    const { store, o } = storeWithBox();
    expect(gizmoMode(store)).toBeNull();
    store.selection.objects.add(o.id);
    expect(gizmoMode(store)).toBe("move");
    store.toolMode = "create";
    expect(gizmoMode(store)).toBeNull();
  });
  it("hides the handles of locked objects and of empty element selections", () => {
    const { store, o } = storeWithBox();
    store.selection.objects.add(o.id);
    store.selection.mode = "vert";
    expect(gizmoMode(store)).toBeNull();
    store.selection.mode = "object";
    o.locked = true;
    expect(gizmoMode(store)).toBeNull();
  });
  it("turns move into rotate with Ctrl and stretch with Ctrl+Shift", () => {
    const { store, o } = storeWithBox();
    store.selection.objects.add(o.id);
    store.modifiers.ctrl = true;
    expect(effectiveManipulator(store)).toBe("rotate");
    store.modifiers.shift = true;
    expect(effectiveManipulator(store)).toBe("scale");
    store.modifiers.alt = true;
    expect(effectiveManipulator(store)).toBe("move");
  });
  it("only moves a single point", () => {
    const { store, o } = storeWithBox();
    store.selection.objects.add(o.id);
    store.selection.mode = "vert";
    store.selection.elements.verts.add(0);
    store.manipulator = "rotate";
    expect(singlePoint(store)).toBe(true);
    expect(gizmoMode(store)).toBe("move");
    store.selection.elements.verts.add(1);
    expect(gizmoMode(store)).toBe("rotate");
  });
});
