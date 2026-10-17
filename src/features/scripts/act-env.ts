/** What an action needs from the runtime: changing and moving the object, telling the room, the space it fits in. */
import type { ScriptNetHooks } from "@/net/scripts-bridge";
import type { ActEnv } from "./actions";
import type { ScriptDeps } from "./deps";
import { placementOf } from "./pose";
import type { Tweens } from "./tweens";

export interface ActHost {
  readonly deps: ScriptDeps;
  /** read on every use: net connects its hooks after the runtime is made */
  readonly hooks: ScriptNetHooks;
  readonly tweens: Tweens;
  now(): number;
  blocked(id: string): void;
}

export function actEnv(h: ActHost): ActEnv {
  const { deps } = h;
  return {
    now: () => h.now(),
    change: (o, fn) => {
      h.hooks.quietly(() => deps.commands.apply([o.id], () => fn(o)));
      h.hooks.onChanged([o.id]);
    },
    go: (_o, fx) => {
      h.tweens.start(fx);
      h.hooks.onMoved(fx);
    },
    settled: (o) => h.tweens.target(o.id) ?? placementOf(o),
    say: (o, text) => h.hooks.onSay({ id: o.id, name: o.name }, text),
    push: (o, vel) => deps.bus.emit("physics:push", { id: o.id, vel }),
    avatarAt: (name) => h.hooks.avatars().find((a) => a.name === name)?.pos ?? null,
    fits: (o, pose) => deps.commands.space.checkIncoming([{ ...o, ...pose }], []).ok,
    blocked: (o) => h.blocked(o.id),
    play: (o, note, instrument) => {
      deps.bus.emit("sound:play", { id: o.id, note, instrument });
      h.hooks.onPlay(o.id, note, instrument);
    },
  };
}
