/** The host functions' view of the runtime for one script: acting on its object, the people, sending to others. */
import type { ScriptNetHooks } from "@/net/scripts-bridge";
import type { ActEnv } from "./actions";
import { act } from "./actions";
import type { ScriptDeps } from "./deps";
import type { Gas } from "./gas";
import { ACTION_GAS } from "./gas";
import type { HostEnv } from "./host";
import { placementOf } from "./pose";
import type { Running } from "./running";
import { deliver } from "./start";
import type { ThreadEnv } from "./threads";
import type { Tweens } from "./tweens";

export interface RuntimeView {
  readonly deps: ScriptDeps;
  readonly hooks: ScriptNetHooks;
  readonly gas: Gas;
  readonly tweens: Tweens;
  readonly running: Map<string, Running>;
  readonly actEnv: ActEnv;
  now(): number;
  threadEnv(id: string): ThreadEnv;
}

export function hostEnv(rt: RuntimeView, id: string, r: Running): HostEnv {
  const byId = (x: string) => rt.deps.store.byId(x);
  return {
    now: () => rt.now(),
    act: (name, a, dur, line) => {
      const o = byId(id);
      if (!o) return 0;
      rt.gas.spend(id, ACTION_GAS);
      return act({ o, r, a, dur, line, env: rt.actEnv }, name);
    },
    avatars: () => rt.hooks.avatars(),
    where: () => placementOf(rt.tweens.target(id) ?? byId(id)!).pos,
    send: (to, args, line) => {
      const receivers = [...rt.running]
        .filter(([other]) => other !== id && byId(other)?.name === to)
        .map(([other, run]): [Running, ThreadEnv] => [run, rt.threadEnv(other)]);
      deliver({ from: byId(id)!, r, t: rt.now(), line }, receivers, args);
    },
  };
}
