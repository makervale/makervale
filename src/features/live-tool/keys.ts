/** Keys while a tool is active: Esc or Ctrl+Z take it back, Enter or Space confirm, +/−/arrows step, digits type. */
import type { LiveEnv } from "./env";
import { adjustWheel, typeDigit } from "./adjust";
import { badge, banner } from "./feedback";
import { cancelLive, confirmLive } from "./lifecycle";

const MODIFIERS = new Set(["Alt", "Control", "Shift", "Meta"]);

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** true when the key was used up; any other key keeps the result and goes on as usual */
export function liveKey(env: LiveEnv, e: KeyLike): boolean {
  const L = env.live;
  if (!L) return false;
  const k = e.key;
  const cmd = e.ctrlKey || e.metaKey;
  if (MODIFIERS.has(k)) {
    badge(env);
    banner(env);
    return false;
  }
  if (k === "Escape" || (cmd && k.toLowerCase() === "z")) {
    cancelLive(env);
    return true;
  }
  if (k === "Enter" || k === " ") {
    confirmLive(env);
    return true;
  }
  if (L.phase === "adjust" && !cmd && adjustKey(env, k)) return true;
  confirmLive(env);
  return false;
}

function adjustKey(env: LiveEnv, k: string): boolean {
  const spec = env.live!.tool.live!;
  if (k === "+" || k === "=" || k === "ArrowUp") {
    adjustWheel(env, 1);
    return true;
  }
  // a minus steps the count down only when nothing is typed and there is no mouse value it could make negative
  const minusSteps = k === "-" && env.live!.buf === "" && !!spec.wheel && !spec.param;
  if (minusSteps || k === "ArrowDown") {
    adjustWheel(env, -1);
    return true;
  }
  return typeDigit(env, k);
}
