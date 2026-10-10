/** Speech bubbles: what avatars and scripted objects say floats above them for a few seconds. One per speaker. */
import type * as THREE from "three";
import type { BubbleKind } from "./draw-bubble";
import { drawBubble } from "./draw-bubble";

interface Bubble {
  sprite: THREE.Sprite;
  /** where the speaker is now, or null once they're gone */
  at: () => THREE.Vector3 | null;
  born: number;
  life: number;
}

const MAX_LIFE_S = 20;
const fadeIn = (age: number) => age * 6;
const FADE_OUT_S = 0.6;
const lifeFor = (text: string) => Math.min(MAX_LIFE_S, 4 + text.length * 0.06);
const now = () => performance.now() / 1000;

export class Bubbles {
  private readonly bubbles = new Map<string, Bubble>();

  constructor(private readonly scene: THREE.Scene) {}

  say(speaker: string, text: string, at: () => THREE.Vector3 | null, kind: BubbleKind = "person"): void {
    this.drop(speaker);
    const sprite = drawBubble(text, kind);
    this.scene.add(sprite);
    this.bubbles.set(speaker, { sprite, at, born: now(), life: lifeFor(text) });
  }

  update(): void {
    const t = now();
    for (const [speaker, b] of this.bubbles) {
      const p = b.at();
      const age = t - b.born;
      if (!p || age > b.life) {
        this.drop(speaker);
        continue;
      }
      b.sprite.position.copy(p);
      b.sprite.material.opacity = Math.min(1, fadeIn(age), (b.life - age) / FADE_OUT_S);
    }
  }

  private drop(speaker: string): void {
    const b = this.bubbles.get(speaker);
    if (!b) return;
    this.scene.remove(b.sprite);
    b.sprite.material.map?.dispose();
    b.sprite.material.dispose();
    this.bubbles.delete(speaker);
  }
}
