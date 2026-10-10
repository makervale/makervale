/**
 * An avatar body: the built-in jointed figure (configurable look, nothing to download) or a VRM model. Both are
 * moved by the same motion-captured animator, so they walk, run, sit, fly and gesture alike.
 */
import * as THREE from "three";
import type { Motion, Rig } from "../animator";
import { Animator } from "../animator";
import { meanHipsY } from "../clips";
import type { Look } from "../look";
import { DEFAULT_LOOK, cleanLook } from "../look";
import { WORLD_FROM_RIG } from "../rig-space";
import type { VRMBody } from "../vrm/parse";
import { bodyRig } from "./body-rig";
import { FIGURE_HEIGHT_M, FIGURE_HIPS_M, buildBody } from "./build-body";
import { disposeTag, nameTag } from "./name-tag";
import { disposeTree } from "./parts";

export interface ModelSource {
  load(model: string): Promise<VRMBody>;
}

const TAG_ABOVE_M = 0.3;
const BLINK_S = 0.12;
const NO_RIG: Rig = { has: () => false, set: () => {}, hips: () => {} };

export class Figure {
  readonly root = new THREE.Group();
  /** turns VRM space (Y up, +Z forward) into the world's (Z up, +Y forward); lowered when seated */
  readonly wrap = new THREE.Group();
  joints: Record<string, THREE.Object3D> = {};
  proc: THREE.Group | null = null;
  vrm: VRMBody | null = null;
  /** the model being loaded, or "" */
  loading = "";
  /** why the model could not be worn, or "" */
  failed = "";
  rig: Rig = NO_RIG;
  readonly anim = new Animator(FIGURE_HIPS_M);
  hipsHeight = FIGURE_HIPS_M;
  height = FIGURE_HEIGHT_M;
  /** how far the body drops to sit with its hips on the seat */
  sitDrop = 0;
  tag: THREE.Sprite;
  readonly look: Look;
  private eyes: THREE.Object3D[] = [];
  private blinkAt = 2 + Math.random() * 3;
  private t = Math.random() * 10;
  private disposed = false;

  constructor(
    private readonly parent: THREE.Object3D,
    public name: string,
    look: Partial<Look>,
    models: ModelSource,
  ) {
    this.look = cleanLook({ ...DEFAULT_LOOK, ...look });
    this.root.name = "Avatar";
    parent.add(this.root);
    this.root.add(this.wrap);
    this.tag = nameTag(name);
    this.root.add(this.tag);
    this.useProcedural();
    if (this.look.model) void this.swapToModel(this.look.model, models);
  }

  setTag(text: string): void {
    const old = this.tag;
    this.name = text;
    this.tag = nameTag(text);
    this.tag.position.z = old.position.z;
    this.root.add(this.tag);
    this.root.remove(old);
    disposeTag(old);
  }

  gesture(id: string, sitting: boolean): void {
    this.anim.play(id, sitting);
  }

  /** one frame of animation */
  animate(motion: Motion, dt: number): void {
    this.t += dt;
    this.anim.update(motion, dt);
    this.anim.apply(this.rig);
    // seated: lower the whole body so the hips rest on the seat (the avatar's position is the seat's top)
    const drop = -this.sitDrop * this.anim.seated();
    this.wrap.position.z = drop;
    if (this.proc) this.proc.position.z = drop;
    const closed = this.blink(dt);
    if (this.vrm) this.vrm.update(dt, closed ? 1 : 0);
    else if (this.proc) this.breathe();
  }

  dispose(): void {
    this.disposed = true;
    this.parent.remove(this.root);
    this.vrm?.dispose();
    disposeTree(this.root);
  }

  /** true while the eyes are closed */
  private blink(dt: number): boolean {
    this.blinkAt -= dt;
    const closed = this.blinkAt < 0 && this.blinkAt > -BLINK_S;
    if (this.blinkAt < -BLINK_S) this.blinkAt = 2.5 + Math.random() * 4;
    for (const e of this.eyes) e.scale.z = closed ? 0.12 : 1;
    return closed;
  }

  private breathe(): void {
    const k = 1 + Math.sin(this.t * 1.7) * 0.012;
    this.joints.spine.scale.set(k, k, 1);
  }

  private useProcedural(): void {
    const { root, joints, eyes } = buildBody(this.look);
    const h = this.look.height;
    root.scale.setScalar(h);
    this.root.add(root);
    this.proc = root;
    this.joints = joints;
    this.eyes = eyes;
    this.rig = bodyRig(joints);
    this.setProportions(FIGURE_HIPS_M * h, FIGURE_HEIGHT_M * h, 0.11 * h);
  }

  /** `seatGap`: how far below the hips the seat is when sitting */
  private setProportions(hipsHeight: number, height: number, seatGap: number): void {
    this.hipsHeight = hipsHeight;
    this.height = height;
    this.anim.hipsHeight = hipsHeight;
    this.sitDrop = meanHipsY("sit") * hipsHeight - seatGap;
    this.tag.position.z = height + TAG_ABOVE_M;
  }

  /** load a VRM and replace the figure with it once it's ready (the figure stays if loading fails) */
  private async swapToModel(model: string, models: ModelSource): Promise<void> {
    this.loading = model;
    let error = "";
    const v = await models.load(model).catch((e: unknown) => {
      error = e instanceof Error ? e.message : String(e);
      console.warn("avatar model", e);
      return null;
    });
    if (this.disposed || this.loading !== model) {
      v?.dispose();
      return;
    }
    this.loading = "";
    if (!v) {
      this.failed = error || "could not load";
      return;
    }
    this.wear(v);
  }

  private wear(v: VRMBody): void {
    if (this.proc) {
      this.root.remove(this.proc);
      disposeTree(this.proc);
      this.proc = null;
      this.joints = {};
      this.eyes = [];
    }
    this.vrm = v;
    this.wrap.quaternion.copy(WORLD_FROM_RIG);
    this.wrap.add(v.scene);
    this.rig = v.rig;
    this.setProportions(v.hipsHeight, v.height, 0.1);
  }
}
