/**
 * The bodies of the other people in a room, and everyone's speech bubbles. Implements `PeerBodies` from
 * net/peers.ts: net says who is here and where they are going; here they are drawn, eased and animated.
 */
import * as THREE from "three";
import type { Store } from "@/app/store";
import type { Bubbles } from "@/render/bubbles/bubbles";
import { easeBody, easeFactor } from "./body-easing";
import type { ModelSource } from "./figure/figure";
import { Figure } from "./figure/figure";
import { GESTURES } from "./gestures";
import type { Look } from "./look";
import type { BodySnapshot, Speaker } from "./snapshot";

/** your own avatar, for your speech bubble and talking animation */
export interface SelfBody {
  myFigure(): Figure;
  talked(text: string): void;
}

export interface PeerBodiesDeps {
  scene: THREE.Scene;
  bubbles: Bubbles;
  models: ModelSource;
  store: Store;
  self: SelfBody;
}

interface PeerBody {
  figure: Figure;
  target: BodySnapshot | null;
  /** the target position as a vector, so easing allocates nothing */
  at: THREE.Vector3;
}

/** bodies catch up with what their owner sent at this rate, per second */
const EASE_RATE = 12;
const BUBBLE_ABOVE_HEAD_M = 0.55;
const BUBBLE_ABOVE_OBJECT_M = 0.25;

const overHead = (f: Figure) => f.root.position.clone().add(new THREE.Vector3(0, 0, f.height + BUBBLE_ABOVE_HEAD_M));

export class PeerBodyStore {
  private readonly peers = new Map<string, PeerBody>();

  constructor(private readonly deps: PeerBodiesDeps) {}

  create(id: string, name: string, look: Look): void {
    const old = this.peers.get(id);
    const figure = new Figure(this.deps.scene, name, look, this.deps.models);
    if (old) {
      figure.root.position.copy(old.figure.root.position);
      figure.root.rotation.z = old.figure.root.rotation.z;
      old.figure.dispose();
    }
    figure.root.visible = !!old?.target;
    this.peers.set(id, { figure, target: old?.target ?? null, at: old?.at ?? new THREE.Vector3() });
  }

  rename(id: string, name: string): void {
    this.peers.get(id)?.figure.setTag(name);
  }

  remove(id: string): void {
    this.peers.get(id)?.figure.dispose();
    this.peers.delete(id);
  }

  setTarget(id: string, target: BodySnapshot): void {
    const p = this.peers.get(id);
    if (!p) return;
    p.at.fromArray(target.pos);
    if (!p.target) {
      p.figure.root.position.copy(p.at);
      p.figure.root.rotation.z = target.yaw;
      p.figure.root.visible = true;
    }
    p.target = target;
  }

  gesture(id: string, name: string, sitting: boolean): void {
    if (GESTURES[name]) this.peers.get(id)?.figure.gesture(name, sitting);
  }

  say(who: Speaker, text: string): void {
    const { bubbles, self, store } = this.deps;
    if (who.kind === "self") {
      self.talked(text);
      bubbles.say("me", text, () => overHead(self.myFigure()));
      return;
    }
    if (who.kind === "peer") {
      const id = who.id;
      bubbles.say("p:" + id, text, () => {
        const p = this.peers.get(id);
        return p ? overHead(p.figure) : null;
      });
      return;
    }
    const id = who.id;
    const above = () => {
      const o = store.byId(id);
      if (!o || o.hidden) return null;
      return new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2] + o.size[2] / 2 + BUBBLE_ABOVE_OBJECT_M);
    };
    bubbles.say("o:" + id, text, above, "object");
  }

  update(dt: number): void {
    const k = easeFactor(dt, EASE_RATE);
    for (const p of this.peers.values()) {
      if (!p.target) continue;
      p.figure.root.visible = true;
      easeBody(p.figure.root, p.at, p.target.yaw, k);
      p.figure.animate(p.target, dt);
    }
  }

  /** a peer's body (tests and the avatar window) */
  figureOf(id: string): Figure | null {
    return this.peers.get(id)?.figure ?? null;
  }
}
