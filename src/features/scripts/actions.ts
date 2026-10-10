/** What each script action does to its object. Each returns how many seconds it takes. */
import type { Fx } from "@/net/scripts-bridge";
import type { Val } from "@/lib/script";
import { ScriptError, show } from "@/lib/script";
import type { Vec3 } from "@/lib/vec";
import { add, clamp, length, normalize, scale, sub } from "@/lib/vec";
import type { Material, Obj } from "@/world/model";
import { parseColor } from "./colors";
import type { Placement } from "./pose";
import { pivotTurn, turned } from "./pose";
import type { Running } from "./running";

export interface ActEnv {
  now(): number;
  /** change the object (a script command) and tell the room */
  change(o: Obj, fn: (o: Obj) => void): void;
  /** start a smooth move and tell the room */
  go(o: Obj, fx: Fx): void;
  /**
   * Where the object will be once its current smooth move ends (where it is, if it isn't moving). Relative
   * actions start from here: starting from a halfway pose lets overlapping moves (fast clicks) drift for ever.
   */
  settled(o: Obj): Placement;
  say(o: Obj, text: string): void;
  /** add velocity to a physical object */
  push(o: Obj, vel: Vec3): void;
  play(o: Obj, note: number, instrument: string): void;
  /** where a person's avatar is (by name), or null */
  avatarAt(name: string): Vec3 | null;
}

export interface Act {
  o: Obj;
  r: Running;
  a: Val[];
  dur: number;
  line: number;
  env: ActEnv;
}

/** scripts keep objects within this distance of where they started */
const LEASH_M = 100;
const MIN_SIZE_M = 0.01;
const MAX_SIZE_M = 200;
const MAX_SPIN_DEG_S = 720;
const SAY_WINDOW_S = 10;
const SAYS_PER_WINDOW = 20;
const MAX_SAY = 300;
const MIN_TIMER_S = 0.1;
const MAX_PUSH_M_S = 25;

const n = (v: Val | undefined): number => (typeof v === "number" ? v : 0);
const vec = (a: Val[]): Vec3 => [n(a[0]), n(a[1]), n(a[2])];

function go(c: Act, pos: Vec3, quat: Fx["quat"], size: Vec3, pv?: number[]): number {
  const { o } = c;
  const home = o.scriptState?.home.pos ?? o.pos;
  const away = sub(pos, home);
  const target = length(away) > LEASH_M ? add(home, scale(normalize(away), LEASH_M)) : pos;
  const clamped = size.map((v) => clamp(v, MIN_SIZE_M, MAX_SIZE_M)) as Vec3;
  const fx: Fx = { id: o.id, pos: target, quat, size: clamped, d: c.dur };
  if (pv) fx.pv = pv;
  c.env.go(o, fx);
  return c.dur;
}

function turn(c: Act): number {
  const { r } = c;
  const from = c.env.settled(c.o);
  const quat = turned(from.quat, vec(c.a));
  const { pos, world } = pivotTurn(from, quat, r.pivot);
  const pivoting = r.pivot.some((v) => v !== 0);
  return go(c, pos, quat, from.size, pivoting ? [...world, ...r.pivot] : undefined);
}

function move(c: Act): number {
  const from = c.env.settled(c.o);
  return go(c, add(from.pos, vec(c.a)), from.quat, from.size);
}

function grow(c: Act): number {
  const from = c.env.settled(c.o);
  return go(c, from.pos, from.quat, scale(from.size, clamp(n(c.a[0]), 0.01, 100)));
}

function home(c: Act): number {
  const h = c.o.scriptState?.home;
  if (!h) return 0;
  return go(c, [...h.pos], [...h.quat], [...h.size]);
}

function pivot(c: Act): number {
  c.r.pivot = vec(c.a).map((v) => clamp(v, -2, 2)) as Vec3;
  if (c.o.scriptState) c.o.scriptState.pivot = [...c.r.pivot];
  return 0;
}

function spin(c: Act): number {
  const v = vec(c.a).map((x) => clamp(x, -MAX_SPIN_DEG_S, MAX_SPIN_DEG_S)) as Vec3;
  c.env.change(c.o, (o) => {
    o.spin = v.every((x) => x === 0) ? undefined : v;
  });
  return 0;
}

/** change all materials, or just material number `slot` (1-based) */
function materials(c: Act, slot: Val | undefined, f: (m: Material) => Material): number {
  const k = typeof slot === "number" ? Math.floor(slot) - 1 : -1;
  c.env.change(c.o, (o) => {
    o.materials = o.materials.map((m, i) => (k < 0 || i === k ? f(m) : m));
  });
  return 0;
}

function color(c: Act): number {
  const hex = parseColor(String(c.a[0]));
  if (!hex) throw new ScriptError(`"${show(c.a[0])}" is not a color (use "#rrggbb" or a name like red)`, c.line);
  return materials(c, c.a[1], (m) => ({ ...m, color: hex }));
}

function say(c: Act): number {
  const { r } = c;
  const t = c.env.now();
  if (t - r.lastSay > SAY_WINDOW_S) r.says = 0;
  if (r.says >= SAYS_PER_WINDOW) return 0;
  r.says++;
  r.lastSay = t;
  const text = show(c.a[0]).slice(0, MAX_SAY).trim();
  if (text) c.env.say(c.o, text);
  return 0;
}

function timer(c: Act): number {
  const { r } = c;
  const every = n(c.a[0]);
  r.timerEvery = every <= 0 ? 0 : Math.max(MIN_TIMER_S, every);
  r.timerNext = c.env.now() + r.timerEvery;
  if (c.o.scriptState) c.o.scriptState.timer = r.timerEvery;
  return 0;
}

const NOTE_RANGE = 24;
const NOTES_PER_SECOND = 8;

/** a note, at most a few a second per object so a loop can't make a racket */
function play(c: Act): number {
  const { r } = c;
  const t = c.env.now();
  if (t - r.lastNote < 1 / NOTES_PER_SECOND) return 0;
  r.lastNote = t;
  const note = Math.round(clamp(n(c.a[0]), -NOTE_RANGE, NOTE_RANGE));
  const instrument = typeof c.a[1] === "string" ? c.a[1].slice(0, 16) : "bell";
  c.env.play(c.o, note, instrument);
  return 0;
}

const MAX_KICK_M_S = 20;
/** a kick lifts the ball a little: vertical speed per m/s */
const KICK_LIFT = 0.3;

/** away from someone, along the ground, with a little lift */
function kick(c: Act): number {
  const from = c.env.avatarAt(String(c.a[0]));
  if (!from) return 0;
  const speed = clamp(n(c.a[1]), 0, MAX_KICK_M_S);
  const dx = c.o.pos[0] - from[0];
  const dy = c.o.pos[1] - from[1];
  const d = Math.hypot(dx, dy) || 1;
  c.env.push(c.o, [(dx / d) * speed, (dy / d) * speed, speed * KICK_LIFT]);
  return 0;
}

function visibility(hidden: boolean) {
  return (c: Act): number => {
    c.env.change(c.o, (o) => {
      o.hidden = hidden;
    });
    return 0;
  };
}

const ACTIONS: Record<string, (c: Act) => number> = {
  move,
  turn,
  grow,
  home,
  pivot,
  spin,
  color,
  glow: (c) => materials(c, c.a[1], (m) => ({ ...m, emissive: clamp(n(c.a[0]), 0, 2) })),
  opacity: (c) => materials(c, c.a[1], (m) => ({ ...m, opacity: clamp(n(c.a[0]), 0, 1) })),
  show: visibility(false),
  hide: visibility(true),
  say,
  timer,
  play,
  kick,
  push: (c) => {
    c.env.push(c.o, vec(c.a).map((v) => clamp(v, -MAX_PUSH_M_S, MAX_PUSH_M_S)) as Vec3);
    return 0;
  },
};

/** do one action; returns how long it takes */
export function act(c: Act, name: string): number {
  return ACTIONS[name]?.(c) ?? 0;
}
