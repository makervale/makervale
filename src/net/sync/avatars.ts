/** Avatars: where mine is, a few times a second, and where everyone else's is heading. Gestures ride along. */
import type { Ctx } from "../context";
import { inRoom, send } from "../context";
import type { AvMsg } from "../messages";
import type { AvatarSnapshot } from "../peers";
import { asRecord, cleanNum, cleanVec3 } from "../sanitize";

const SEND_EVERY_S = 0.1;
const MAX_YAW = 1e3;
/** metres per second */
const MAX_SPEED = 50;
const MAX_TURN = 10;
/** gesture names are checked for shape only; the avatar module ignores ones it doesn't know */
const GESTURE_NAME = /^\w{1,24}$/;

const sinceSent = new WeakMap<Ctx, number>();

export function avatarMsg(a: AvatarSnapshot): AvMsg {
  const [x, y, z] = a.pos;
  return {
    p: [x, y, z],
    y: a.yaw,
    s: a.speed,
    b: a.back,
    k: a.talking,
    f: a.flying,
    t: a.sitting,
    g: a.onGround,
    r: a.turn,
    v: a.climb,
  };
}

export function sendAvatar(ctx: Ctx, target?: string): void {
  send(ctx, "av", avatarMsg(ctx.deps.localAvatar()), target);
}

/** an avatar message from a peer, or null when its position or heading is unusable */
export function readAvatar(raw: unknown): AvatarSnapshot | null {
  const d = asRecord(raw);
  const pos = cleanVec3(d.p);
  const yaw = cleanNum(d.y, -MAX_YAW, MAX_YAW);
  if (!pos || yaw === null) return null;
  return {
    pos,
    yaw,
    speed: cleanNum(d.s, 0, MAX_SPEED) || 0,
    back: !!d.b,
    talking: !!d.k,
    flying: !!d.f,
    sitting: !!d.t,
    onGround: d.g !== false,
    turn: cleanNum(d.r, -MAX_TURN, MAX_TURN) || 0,
    climb: cleanNum(d.v, -1, 1) || 0,
  };
}

export function onAvatar(ctx: Ctx, raw: unknown, pid: string): void {
  const p = ctx.net.peers.get(pid);
  const target = p ? readAvatar(raw) : null;
  if (!p || !target) return;
  p.target = target;
  ctx.deps.peers.setTarget(pid, target);
}

export function sendGesture(ctx: Ctx, name: string): void {
  if (GESTURE_NAME.test(name)) send(ctx, "gest", { g: name });
}

export function onGesture(ctx: Ctx, raw: unknown, pid: string): void {
  const p = ctx.net.peers.get(pid);
  const g = asRecord(raw).g;
  if (p && typeof g === "string" && GESTURE_NAME.test(g)) ctx.deps.peers.gesture(pid, g, !!p.target?.sitting);
}

/** per frame: send my avatar now and then, ease everyone else's towards what they sent */
export function avatarTick(ctx: Ctx, dt: number): void {
  if (!inRoom(ctx)) return;
  const since = (sinceSent.get(ctx) ?? 0) + dt;
  sinceSent.set(ctx, since > SEND_EVERY_S ? 0 : since);
  if (since > SEND_EVERY_S) sendAvatar(ctx);
  ctx.deps.peers.update(dt);
}
