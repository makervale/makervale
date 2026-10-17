/**
 * What a script can call, besides plain Lua: its object's actions (move, colour, say, label …), wait, timers, the
 * people around, and messages to other objects. Every function here acts on the script's own object only.
 */
import type { Ctx, Gen, LuaTable, NativeFn, Value } from "@/lib/lua";
import { LuaError, Native, argNum, argText, isFn, list, tostr } from "@/lib/lua";
import { clamp, distance } from "@/lib/vec";
import type { Running } from "./running";
import { addTimer, cancelTimer } from "./timers";
import type { Avatar } from "./zones";

export interface HostEnv {
  now(): number;
  /** do an action on the object; how many seconds it takes */
  act(name: string, a: Value[], dur: number, line: number): number;
  avatars(): Avatar[];
  /** where the object is now */
  where(): [number, number, number];
  /** hand a message to the scripts of every other object with this name */
  send(to: string, args: Value[], line: number): void;
}

const MAX_WAIT_S = 3600;
const MAX_DURATION_S = 600;
const MAX_REACH_M = 100;

const nums = (a: Value[], n: number, fn: string, line: number): number[] =>
  Array.from({ length: n }, (_, i) => argNum(a, i, fn, line));

/** an optional material number after the main value (1 for the first material) */
const slot = (a: Value[], i: number, fn: string, line: number): Value[] =>
  a[i] === undefined ? [] : [Math.floor(argNum(a, i, fn, line))];

function actions(env: HostEnv): Record<string, NativeFn> {
  /** move(x, y, z, seconds) and the like: the thread waits while the object moves */
  const timed = (name: string, n: number): NativeFn =>
    function* (a, _c, line): Gen<Value[]> {
      const dur = clamp(argNum(a, n, name, line, 0), 0, MAX_DURATION_S);
      const secs = env.act(name, nums(a, n, name, line), dur, line);
      if (secs > 0) yield { wait: secs };
      return [];
    };
  const instant =
    (name: string, args: (a: Value[], line: number) => Value[]): NativeFn =>
    (a, _c, line) => {
      env.act(name, args(a, line), 0, line);
      return [];
    };
  return {
    move: timed("move", 3),
    turn: timed("turn", 3),
    grow: timed("grow", 1),
    home: timed("home", 0),
    pivot: instant("pivot", (a, l) => nums(a, 3, "pivot", l)),
    spin: instant("spin", (a, l) => nums(a, 3, "spin", l)),
    push: instant("push", (a, l) => nums(a, 3, "push", l)),
    color: instant("color", (a, l) => [argText(a, 0, "color", l), ...slot(a, 1, "color", l)]),
    glow: instant("glow", (a, l) => [argNum(a, 0, "glow", l), ...slot(a, 1, "glow", l)]),
    opacity: instant("opacity", (a, l) => [argNum(a, 0, "opacity", l), ...slot(a, 1, "opacity", l)]),
    show: instant("show", () => []),
    hide: instant("hide", () => []),
    say: instant("say", (a) => [tostr(a[0])]),
    label: instant("label", (a) => (a[0] === undefined ? [] : [tostr(a[0])])),
    play: instant("play", (a, l) => [argNum(a, 0, "play", l), argText(a, 1, "play", l, "bell")]),
    kick: instant("kick", (a, l) => [argText(a, 0, "kick", l), argNum(a, 1, "kick", l)]),
  };
}

function needFn(v: Value, fn: string, line: number): Value {
  if (!isFn(v)) throw new LuaError(`${fn} needs a function as its second argument`, line);
  return v;
}

function world(r: Running, env: HostEnv): Record<string, NativeFn> {
  const timer =
    (name: string, repeat: boolean): NativeFn =>
    (a, _c, line) => {
      const s = argNum(a, 0, name, line);
      return [addTimer(r, needFn(a[1], name, line), { delay: s, every: repeat ? s : 0 }, env.now(), line)];
    };
  return {
    wait: function* (a: Value[], _c: Ctx, line: number): Gen<Value[]> {
      yield { wait: clamp(argNum(a, 0, "wait", line, 0), 0, MAX_WAIT_S) };
      return [];
    },
    every: timer("every", true),
    after: timer("after", false),
    cancel: (a, _c, line) => {
      cancelTimer(r, argNum(a, 0, "cancel", line));
      return [];
    },
    now: () => [env.now()],
    players: () => [list(env.avatars().map((p) => p.name))],
    distance: (a, _c, line) => {
      const who = argText(a, 0, "distance", line);
      const p = env.avatars().find((x) => x.name === who);
      return [p ? distance(p.pos, env.where()) : undefined];
    },
    setReach: (a, _c, line) => {
      r.reach = clamp(argNum(a, 0, "setReach", line), 0, MAX_REACH_M);
      return [];
    },
    send: (a, _c, line) => {
      env.send(argText(a, 0, "send", line), a.slice(1), line);
      return [];
    },
  };
}

/** puts the host functions into a script's globals; `me` tells the script its object's name */
export function installHost(g: LuaTable, r: Running, env: HostEnv, name: string): void {
  for (const [k, fn] of Object.entries({ ...actions(env), ...world(r, env) })) g.set(k, new Native(k, fn));
  const me = list([]);
  me.set("name", name);
  g.set("me", me);
}
