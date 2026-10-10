/**
 * The physics of every body in the scene. It runs on every computer: the authority's result is the truth and is sent
 * to the others a few times a second, and everyone simulates in between so motion is smooth and kicks feel instant.
 */
import type { Mover } from "@/lib/physics";
import { pushByPeople, rollQuat, stepBall } from "@/lib/physics";
import type { Vec3 } from "@/lib/vec";
import { add, length, scale, sub } from "@/lib/vec";
import type { BodyState, PhysicsBridge, PhysicsNetHooks } from "@/net/physics-bridge";
import type { Obj } from "@/world/model";
import { bumpsOf } from "./bumps";
import type { PhysicsDeps } from "./deps";
import type { Live } from "./live";
import { movedElsewhere, newLive, radiusOf } from "./live";
import { WorldProbe } from "./probe";

const STEP_S = 1 / 120;
const MAX_STEPS = 8;
const SEND_EVERY_S = 1 / 12;
const SLEEP_SPEED_M_S = 0.08;
const SLEEP_AFTER_S = 0.8;
const MAX_SPEED_M_S = 30;
/** a kicked ball here keeps its own course this long before the authority's reports count again */
const KICK_GRACE_S = 0.4;
const FELL_OFF_Z_M = -30;
/** how old the authority's report usually is when it arrives (network delay), seconds */
const REPORT_DELAY_S = 0.08;
/** a difference from the authority's ball bigger than this is jumped, not smoothed */
const SNAP_DISTANCE_M = 2;
/** the share of the difference worked off per second */
const CORRECTION_PER_S = 6;

export class Physics implements PhysicsBridge {
  private hooks: PhysicsNetHooks;
  private readonly live = new Map<string, Live>();
  private readonly probe: WorldProbe;
  private readonly bumps = bumpsOf();
  private clock = 0;
  private carry = 0;
  private sinceSent = 0;
  private readonly unsent = new Set<string>();

  constructor(private readonly deps: PhysicsDeps) {
    this.probe = new WorldProbe(deps.views);
    this.hooks = { isAuthority: () => true, onMoved: () => {}, others: () => [], quietly: (f) => f() };
  }

  connect(hooks: PhysicsNetHooks): void {
    this.hooks = hooks;
  }

  applyRemote(states: BodyState[]): void {
    const snapped: string[] = [];
    for (const s of states) {
      const o = this.deps.store.byId(s.id);
      if (!o?.body) continue;
      const l = this.liveOf(o);
      if (this.clock < l.ignoreRemoteUntil) continue;
      if (this.adopt(o, l, s)) snapped.push(s.id);
    }
    this.show(snapped);
  }

  /**
   * Take the authority's word on a body. Its report is a moment old, so it is moved on by the usual delay; a small
   * difference is then worked off over a few frames (no visible jump), a big one is jumped at once. True if jumped.
   */
  private adopt(o: Obj, l: Live, s: BodyState): boolean {
    const there = add(s.pos, scale(s.vel, REPORT_DELAY_S));
    const error = sub(there, o.pos);
    l.vel = [...s.vel];
    l.asleep = speed(s.vel) < SLEEP_SPEED_M_S && length(error) < SLEEP_SPEED_M_S;
    l.restS = 0;
    if (length(error) < SNAP_DISTANCE_M) {
      l.error = error;
      return false;
    }
    o.pos = there;
    o.quat = [...s.quat];
    l.error = [0, 0, 0];
    l.lastPos = [...o.pos];
    return true;
  }

  /** move a share of the remaining difference from the authority's ball each step */
  private correct(o: Obj, l: Live, dt: number): void {
    if (this.hooks.isAuthority() || length(l.error) < 1e-4) return;
    const share = scale(l.error, Math.min(1, CORRECTION_PER_S * dt));
    o.pos = add(o.pos, share);
    l.error = sub(l.error, share);
  }

  /** a script pushed its object */
  push(id: string, vel: Vec3): void {
    const o = this.deps.store.byId(id);
    if (!o?.body) return;
    const l = this.liveOf(o);
    // a push right after a move (a script's "home", then "push") starts from the new place
    if (movedElsewhere(o, l)) Object.assign(l, { vel: [0, 0, 0], lastPos: [...o.pos] });
    l.vel = clampSpeed([l.vel[0] + vel[0], l.vel[1] + vel[1], l.vel[2] + vel[2]]);
    l.asleep = false;
  }

  /** per frame */
  tick(dt: number): void {
    this.carry = Math.min(this.carry + dt, STEP_S * MAX_STEPS);
    const moved = new Set<string>();
    while (this.carry >= STEP_S) {
      this.carry -= STEP_S;
      this.clock += STEP_S;
      for (const id of this.step(STEP_S)) moved.add(id);
    }
    this.show([...moved]);
    this.report(dt, moved);
  }

  private step(dt: number): string[] {
    const movers = this.movers();
    const moved: string[] = [];
    for (const o of this.deps.store.world.objects) {
      if (o.body && !o.hidden && this.stepBody(o, dt, movers)) moved.push(o.id);
    }
    return moved;
  }

  private stepBody(o: Obj, dt: number, movers: Mover[]): boolean {
    const l = this.liveOf(o);
    if (movedElsewhere(o, l)) Object.assign(l, { vel: [0, 0, 0], asleep: false, restS: 0 });
    const shape = { radius: radiusOf(o), bounce: o.body!.bounce };
    const s = { pos: o.pos, vel: l.vel };
    const pushed = pushByPeople(s, shape, movers);
    // a kick wakes the ball: asleep, it would only move while a foot pressed on it
    if (pushed) Object.assign(l, { asleep: false, restS: 0 });
    if (pushed && !this.hooks.isAuthority()) l.ignoreRemoteUntil = this.clock + KICK_GRACE_S;
    if (l.asleep && !pushed && length(l.error) < 1e-4) return false;
    const hits = stepBall(s, shape, dt, (p, r) => this.probe.contacts(p, r, o.id));
    s.vel = clampSpeed(s.vel);
    o.quat = rollQuat(o.quat, s.vel, shape.radius, dt);
    o.pos = s.pos[2] < FELL_OFF_Z_M ? [...l.start] : s.pos;
    l.vel = s.pos[2] < FELL_OFF_Z_M ? [0, 0, 0] : s.vel;
    this.correct(o, l, dt);
    l.lastPos = [...o.pos];
    for (const b of this.bumps(o.id, hits, this.clock)) this.deps.bus.emit("object:bumped", b);
    this.settle(l, hits.length > 0, dt);
    return true;
  }

  /** a body that has barely moved for a while goes to sleep until something pushes it */
  private settle(l: Live, touching: boolean, dt: number): void {
    l.restS = touching && speed(l.vel) < SLEEP_SPEED_M_S ? l.restS + dt : 0;
    if (l.restS < SLEEP_AFTER_S) return;
    l.asleep = true;
    l.vel = [0, 0, 0];
  }

  /** you and the people in the room; seated people don't kick */
  private movers(): Mover[] {
    const me = this.deps.self();
    return me ? [me, ...this.hooks.others()] : this.hooks.others();
  }

  /** the views follow, without an edit going to the room (bodies travel as BodyStates) */
  private show(ids: string[]): void {
    if (!ids.length) return;
    this.hooks.quietly(() => this.deps.commands.dragging(ids));
  }

  /** the authority tells the room where its moving bodies are, and once more when they stop */
  private report(dt: number, moved: Set<string>): void {
    if (!this.hooks.isAuthority()) return;
    for (const id of moved) this.unsent.add(id);
    this.sinceSent += dt;
    if (this.sinceSent < SEND_EVERY_S || !this.unsent.size) return;
    this.sinceSent = 0;
    const states: BodyState[] = [];
    for (const id of this.unsent) {
      const o = this.deps.store.byId(id);
      if (o) states.push({ id, pos: [...o.pos], quat: [...o.quat], vel: [...this.liveOf(o).vel] });
    }
    this.unsent.clear();
    this.hooks.onMoved(states);
  }

  private liveOf(o: Obj): Live {
    let l = this.live.get(o.id);
    if (!l) this.live.set(o.id, (l = newLive(o)));
    return l;
  }
}

const speed = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

function clampSpeed(v: Vec3): Vec3 {
  const s = Math.hypot(v[0], v[1], v[2]);
  return s > MAX_SPEED_M_S ? [(v[0] / s) * MAX_SPEED_M_S, (v[1] / s) * MAX_SPEED_M_S, (v[2] / s) * MAX_SPEED_M_S] : v;
}
