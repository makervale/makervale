/** Starting a script: parse it, give it the standard library and the host's functions, and queue its top level. */
import type { Value } from "@/lib/lua";
import { LuaError, LuaTable, fromPlain, newCtx, newGlobals, parse, runChunk, toPlain } from "@/lib/lua";
import type { Obj } from "@/world/model";
import type { HostEnv } from "./host";
import { installHost } from "./host";
import type { Running } from "./running";
import { newRunning, savedStateFor } from "./running";
import type { ThreadEnv } from "./threads";
import { fire } from "./threads";

export interface StartEnv {
  now: number;
  host(r: Running): HostEnv;
  threads: ThreadEnv;
}

/** throws a LuaError when the script doesn't parse */
export function startScript(o: Obj, env: StartEnv): Running {
  const src = o.script ?? "";
  const body = parse(src);
  const globals = newGlobals();
  const saved = savedStateFor(o, src);
  const r = newRunning(src, body, globals, saved, env.now);
  const state = fromPlain(saved?.state);
  globals.set("state", state instanceof LuaTable ? state : new LuaTable());
  installHost(globals, r, env.host(r), o.name);
  const ctx = newCtx(globals, env.threads.print, env.threads.random);
  r.threads.push({ gen: runChunk(body, ctx), ctx, wake: 0, what: "the top of the script" });
  return r;
}

const MAX_SENT_PER_S = 30;

export interface Sending {
  from: Obj;
  r: Running;
  t: number;
  line: number;
}

/** send(name, …): every other script on an object with that name hears onMessage(from, …), each with its own copy */
export function deliver({ from, r, t, line }: Sending, receivers: [Running, ThreadEnv][], args: Value[]): void {
  const second = Math.floor(t);
  if (r.sent.second !== second) r.sent = { second, count: 0 };
  if (++r.sent.count > MAX_SENT_PER_S)
    throw new LuaError(`too many messages this second (at most ${MAX_SENT_PER_S})`, line);
  const plain = args.map((v) => toPlain(v, "a message", line));
  for (const [to, env] of receivers) fire(to, "onMessage", [from.name, ...plain.map(fromPlain)], env);
}
