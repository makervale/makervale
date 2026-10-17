/** Labels: the text a script put above its object (a score, a level, a record), for as long as the script keeps it. */
import type * as THREE from "three";
import type { Store } from "@/app/store";
import { drawLabel } from "./draw-bubble";

/** farther than this a label is too small to read, and only clutters the view */
const SHOWN_WITHIN_M = 45;
const ABOVE_M = 0.3;

export class Labels {
  private readonly shown = new Map<string, { text: string; sprite: THREE.Sprite }>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly store: Store,
  ) {}

  /** per frame: new and changed labels drawn, gone ones dropped, each placed just above its object */
  update(camera: THREE.Camera): void {
    const seen = new Set<string>();
    for (const o of this.store.world.objects) {
      if (!o.label || o.hidden) continue;
      seen.add(o.id);
      let l = this.shown.get(o.id);
      if (!l || l.text !== o.label) {
        this.drop(o.id);
        l = { text: o.label, sprite: drawLabel(o.label) };
        this.scene.add(l.sprite);
        this.shown.set(o.id, l);
      }
      l.sprite.position.set(o.pos[0], o.pos[1], o.pos[2] + Math.max(...o.size) / 2 + ABOVE_M);
      l.sprite.visible = l.sprite.position.distanceTo(camera.position) < SHOWN_WITHIN_M;
    }
    for (const id of [...this.shown.keys()]) if (!seen.has(id)) this.drop(id);
  }

  private drop(id: string): void {
    const l = this.shown.get(id);
    if (!l) return;
    this.scene.remove(l.sprite);
    l.sprite.material.map?.dispose();
    l.sprite.material.dispose();
    this.shown.delete(id);
  }
}
