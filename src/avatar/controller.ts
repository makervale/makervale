/**
 * Your avatar: keys walk, fly, sit and stand it (see avatar-keys.ts), the body follows the
 * avatar smoothly, and the camera follows behind until you move it yourself (Esc brings it back).
 */
import * as THREE from "three";
import type { Bus } from "@/app/bus";
import type { Store } from "@/app/store";
import type { Renderer } from "@/render/renderer";
import type { KeyEventLike } from "./avatar-keys";
import { AvatarKeys } from "./avatar-keys";
import { easeFactor, turnTowards } from "./body-easing";
import { Collider } from "./collision";
import type { ModelSource } from "./figure/figure";
import { Figure } from "./figure/figure";
import { followBehind, headOf } from "./follow-camera";
import { moveWorld } from "./move-world";
import type { TouchInput } from "./touch-input";
import { NO_TOUCH, isActive, mergeInput } from "./touch-input";
import type { Look } from "./look";
import { cleanLook } from "./look";
import type { MoveInput } from "./movement";
import { rise, walk } from "./movement";
import { PlatformRide } from "./platform-ride";
import { seatAt, standingSpot } from "./seat";
import type { BodySnapshot } from "./snapshot";
import { snapshotOf } from "./snapshot";
import type { AvatarState } from "./state";
import { SPAWN, newAvatarState } from "./state";

export interface AvatarDeps {
  renderer: Pick<Renderer, "parts" | "camera" | "solids">;
  bus: Bus;
  store: Store;
  models: ModelSource;
  notice(text: string): void;
}

const MAX_DT_S = 0.1;
/** how far forward the joystick goes before a seated avatar stands up */
const STAND_PUSH = 0.6;
/** below this you fell off the world: back to the gate */
const VOID_Z_M = -40;
/** seated, A/D turn the camera at this rate, rad/s */
const SEATED_LOOK_RATE = 1.4;
/** the body catches up with the avatar at these rates, per second */
const GLIDE_RATE = { walking: 30, seated: 9, turning: 18 };
/** further than this the body jumps (a teleport) instead of gliding, metres */
const JUMP_DISTANCE_M = 3;
const START_FOLLOW_DIST_M = 7;
const TALK_MS = { base: 1200, perChar: 70, max: 6000 };

export class AvatarController {
  readonly state: AvatarState = newAvatarState();
  private figure: Figure;
  private readonly keys: AvatarKeys;
  private readonly collider = new Collider();
  private readonly ride = new PlatformRide();
  private shift = false;
  private touch: TouchInput = NO_TOUCH;

  constructor(private readonly deps: AvatarDeps) {
    const { store } = deps;
    this.keys = new AvatarKeys({
      editingMesh: () => !!store.editTarget(),
      somethingSelected: () => store.selection.objects.size > 0,
    });
    this.figure = this.makeFigure();
    this.place(1);
    deps.bus.on("gesture:play", ({ name }) => this.figure.gesture(name, this.state.sitting));
  }

  myFigure(): Figure {
    return this.figure;
  }

  get sitting(): boolean {
    return this.state.sitting;
  }

  get flying(): boolean {
    return this.state.flying;
  }

  get name(): string {
    return this.state.name;
  }

  snapshot(): BodySnapshot {
    return snapshotOf(this.state);
  }

  /** start behind the avatar, at the gate */
  placeCamera(): void {
    const cam = this.deps.renderer.camera;
    cam.follow = true;
    cam.followDist = START_FOLLOW_DIST_M;
    this.update(0);
    cam.snap();
  }

  /** name and appearance; a new look rebuilds the body where it stands */
  setLook(name: string, look: Partial<Look>): void {
    const next = cleanLook({ ...this.state.look, ...look });
    const same = JSON.stringify(next) === JSON.stringify(this.state.look);
    this.state.name = name;
    this.state.look = next;
    if (same) {
      this.figure.setTag(name);
      return;
    }
    this.figure.dispose();
    this.figure = this.makeFigure();
    this.place(1);
  }

  /** the avatar window's name for setLook */
  setAvatarLook(name: string, look: Partial<Look>): void {
    this.setLook(name, look);
  }

  /** you said something: talk for a moment */
  talked(text: string): void {
    this.state.talkUntil = performance.now() + Math.min(TALK_MS.max, TALK_MS.base + text.length * TALK_MS.perChar);
  }

  /** a key went down or up; true when it belongs to the avatar */
  key(e: KeyEventLike, down: boolean): boolean {
    if (!down) return this.keys.release(e.code);
    const action = this.keys.press(e, this.state.sitting, this.state.flying);
    if (action === null) return false;
    this.deps.renderer.camera.follow = true;
    if (action === "toggleFly") this.setFlying(!this.state.flying);
    else if (action === "fly") this.setFlying(true);
    else if (action === "stand") this.standUp();
    else if (action === "sittingHint")
      this.deps.notice("Sitting. Press W twice, Space, or Stand to get up; A/D look around.");
    return true;
  }

  releaseKeys(): void {
    this.keys.clear();
  }

  setShift(down: boolean): void {
    this.shift = down;
  }

  /** the on-screen joystick (-1…1 each way); pushing it brings the camera back behind you */
  setStick(fwd: number, lr: number): void {
    // seated, a firm push forward stands you up (the keyboard's "W twice")
    if (this.state.sitting && fwd > STAND_PUSH && this.touch.fwd <= STAND_PUSH) this.standUp();
    this.touch = { ...this.touch, fwd, lr };
    if (isActive(this.touch)) this.deps.renderer.camera.follow = true;
  }

  /** the on-screen up / down buttons: 1 up, -1 down, 0 neither */
  setClimb(dir: number): void {
    this.touch = { ...this.touch, climb: Math.sign(dir) };
  }

  setFlying(on: boolean): void {
    if (this.state.sitting) this.standUp();
    Object.assign(this.state, { flying: on, vz: 0, airHold: 0 });
    this.changed();
  }

  /** get up and step forward off the seat, so you don't end up standing on it */
  standUp(): void {
    const A = this.state;
    if (!A.sitting) return;
    A.sitting = false;
    const spot = standingSpot(A.pos, A.yaw, this.collider, this.deps.renderer.solids());
    if (spot) A.pos.copy(spot);
    A.vz = 0;
    this.changed();
  }

  /** sit on the surface under a right click; lean against a backrest if there is one */
  sitAt(point: THREE.Vector3): void {
    const { renderer } = this.deps;
    const seat = seatAt(point, renderer.camera.camera.position, this.collider, renderer.solids());
    this.state.pos.copy(seat.pos);
    Object.assign(this.state, { yaw: seat.yaw, sitting: true, flying: false, vz: 0 });
    renderer.camera.follow = true;
    this.keys.seated();
    this.changed();
  }

  teleportTo(point: THREE.Vector3): void {
    this.state.pos.copy(point);
    Object.assign(this.state, { sitting: false, flying: false, vz: 0 });
    this.deps.renderer.camera.follow = true;
    this.place(1);
    this.changed();
  }

  /** per frame: move, animate the body, keep the camera behind */
  update(dtIn: number): void {
    const dt = Math.min(dtIn, MAX_DT_S);
    const A = this.state;
    const input = mergeInput(this.keys.input(this.shift), this.touch);
    this.ride.carry(A);
    Object.assign(A, { turn: 0, climb: 0, back: false, talking: performance.now() < A.talkUntil });
    if (A.sitting) this.lookAroundSeated(input, dt);
    else this.move(input, dt);
    this.figure.animate(A, dt);
    this.place(dt);
    const cam = this.deps.renderer.camera;
    if (!cam.follow) return;
    const head = headOf(this.figure.root.position, this.figure.height, A.sitting);
    const solids = this.deps.renderer.solids();
    followBehind(cam, head, A.yaw, (from, dir, far) => this.collider.firstHit(from, dir, far, solids));
  }

  private lookAroundSeated(input: MoveInput, dt: number): void {
    this.state.speed = 0;
    if (input.lr) this.deps.renderer.camera.orbitAround(-input.lr * SEATED_LOOK_RATE * dt);
  }

  private move(input: MoveInput, dt: number): void {
    const A = this.state;
    const solids = this.deps.renderer.solids();
    const { store, bus } = this.deps;
    const world = moveWorld({ collider: this.collider, solids, store, bus, changed: () => this.changed() });
    walk(A, input, dt, world);
    rise(A, input, dt, world);
    if (A.pos.z < VOID_Z_M) this.teleportTo(new THREE.Vector3(...SPAWN));
    this.ride.remember(A, this.collider, solids, this.deps.renderer.parts.ground);
  }

  /** the body glides to where the avatar is (smooth sitting down and standing up), but jumps for teleports */
  private place(dt: number): void {
    const r = this.figure.root;
    const A = this.state;
    const jump = dt >= 1;
    if (jump || r.position.distanceTo(A.pos) > JUMP_DISTANCE_M) r.position.copy(A.pos);
    else r.position.lerp(A.pos, easeFactor(dt, A.sitting ? GLIDE_RATE.seated : GLIDE_RATE.walking));
    turnTowards(r, A.yaw, jump ? 1 : easeFactor(dt, GLIDE_RATE.turning));
  }

  private makeFigure(): Figure {
    return new Figure(this.deps.renderer.parts.scene, this.state.name, this.state.look, this.deps.models);
  }

  private changed(): void {
    this.deps.bus.emit("avatar:changed");
  }
}
