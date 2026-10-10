import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Store } from "@/app/store";
import { genBox } from "@/lib/mesh/generators";
import { newObj } from "@/world/model";
import type { ManipulatorPort } from "./deps";
import { statusText } from "./status";

function setup(manip: Partial<ManipulatorPort> = {}) {
  const store = new Store();
  const o = newObj(store.world, genBox(1), [0, 0, 0], [1, 1, 1]);
  store.world.objects.push(o);
  const port: ManipulatorPort = {
    effManip: () => "move",
    singlePoint: () => false,
    pivotOf: () => new THREE.Vector3(),
    ...manip,
  };
  return { store, o, port };
}

describe("Build window status line", () => {
  it("says what to do with nothing selected, and while creating", () => {
    const { store, port } = setup();
    expect(statusText(store, port, "Box")).toMatch(/^Click an object to select it/);
    store.toolMode = "create";
    expect(statusText(store, port, "Box")).toBe("Click the ground or a face of an object to place: Box");
  });

  it("explains the camera while Alt is held", () => {
    const { store, port } = setup();
    store.modifiers = { alt: true, ctrl: false, shift: false };
    expect(statusText(store, port, "")).toMatch(/^Camera:/);
    store.modifiers = { alt: true, ctrl: true, shift: false };
    expect(statusText(store, port, "")).toMatch(/^Orbit/);
    store.modifiers = { alt: true, ctrl: true, shift: true };
    expect(statusText(store, port, "")).toMatch(/^Pan/);
  });

  it("describes the handle in use", () => {
    const { store, o } = setup();
    store.selection.objects.add(o.id);
    expect(statusText(store, setup().port, "")).toMatch(/Shift\+drag: copy/);
    expect(statusText(store, setup({ effManip: () => "rotate" }).port, "")).toMatch(/colored ring/);
    expect(statusText(store, setup({ effManip: () => "scale" }).port, "")).toMatch(/Corner: proportional/);
  });

  it("asks for elements while editing a mesh with none selected", () => {
    const { store, o, port } = setup();
    store.selection.objects.add(o.id);
    store.selection.mode = "edge";
    expect(statusText(store, port, "")).toMatch(/^Click an edge/);
    store.selection.elements.edges.add("0_1");
    expect(statusText(store, setup({ singlePoint: () => true }).port, "")).toMatch(/^One point/);
  });
});
