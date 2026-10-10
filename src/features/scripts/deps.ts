import type { Bus } from "@/app/bus";
import type { Commands } from "@/app/commands";
import type { Store } from "@/app/store";
import type { ScriptNetHooks } from "@/net/scripts-bridge";

/** what the script runtime needs from the app */
export interface ScriptDeps {
  store: Store;
  bus: Bus;
  commands: Commands;
  /** the local avatar's name: who touched an object clicked on this computer */
  myName?: () => string;
  /** seconds, monotonic; tests pass a fake clock */
  now?: () => number;
  random?: () => number;
}

/** Outside rooms nobody else is around: this computer runs every script and changes go straight through. */
export function standaloneHooks(): ScriptNetHooks {
  return {
    isAuthority: () => true,
    onMoved: () => {},
    onChanged: () => {},
    onSay: () => {},
    onPlay: () => {},
    onForwardTouch: () => {},
    avatars: () => [],
    quietly: (change) => change(),
  };
}

export const performanceSeconds = (): number => performance.now() / 1000;
