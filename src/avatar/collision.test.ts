import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { HIDDEN_LAYER } from "@/render/lod/lod";
import { Collider } from "./collision";

describe("Collider", () => {
  it("stands on a floor that is drawn in a simpler form from afar", () => {
    THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1).translate(0, 0, 0.5));
    floor.layers.set(HIDDEN_LAYER);
    floor.updateMatrixWorld();
    const hit = new Collider().groundAt(0, 0, 3, [floor]);
    expect(hit.z).toBeCloseTo(1);
    expect(hit.object).toBe(floor);
  });
});
