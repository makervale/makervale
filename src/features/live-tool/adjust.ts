/** Adjusting the active tool: the mouse drives its main value, the wheel and +/− its count, digits type a value. */
import * as THREE from "three";
import type { LiveEnv } from "./env";
import { clamp, ctrlStep, paramDef, sensitivity } from "./env";
import { badge } from "./feedback";
import { flush, queue } from "./lifecycle";
import { screenAxis } from "./axis";

/** started from a panel, the cursor must rest this long in the view before measuring starts */
const SETTLE_MS = 140;

export function adjustMove(env: LiveEnv, x: number, y: number): void {
  const L = env.live;
  const key = L?.tool.live?.param;
  if (!L || !key) return;
  const d = paramDef(L.tool, key)!;
  if (L.settle) {
    clearTimeout(L.settleTimer);
    L.settleTimer = window.setTimeout(() => {
      if (env.live !== L) return;
      Object.assign(L, { settle: false, p0: L.p[key], x0: env.cursor.x, y0: env.cursor.y });
      badge(env);
    }, SETTLE_MS);
    return;
  }
  if (L.rebase) {
    Object.assign(L, { rebase: false, p0: L.p[key], x0: x, y0: y });
    if (L.A) L.screenAxis = screenAxis(env.renderer.picker, L.pivot, L.A);
  }
  const s = L.A && L.screenAxis;
  let v = s
    ? L.p0 + ((x - L.x0) * s.dir.x + (y - L.y0) * s.dir.y) / s.ppm
    : L.p0 + (x - L.x0) * sensitivity(d, env.renderer.picker.worldPerPixel(L.pivot));
  if (env.store.modifiers.ctrl) {
    const u = ctrlStep(d, () => env.manip.snapUnit(L.pivot, L.A ?? new THREE.Vector3(0, 0, 1)));
    v = Math.round(v / u) * u;
  }
  v = clamp(v, d.min, d.max);
  if (d.decimals !== undefined) v = +v.toFixed(d.decimals);
  L.buf = "";
  queue(env, { [key]: v });
}

/** one step of the wheel parameter (the count) */
export function adjustWheel(env: LiveEnv, sign: number): void {
  const L = env.live;
  const key = L?.tool.live?.wheel;
  if (!L || L.phase !== "adjust" || !key) return;
  const d = paramDef(L.tool, key)!;
  const v = clamp(+(L.p[key] + sign * d.step).toFixed(d.decimals ?? 3), d.min, d.max);
  if (v === L.p[key]) return;
  queue(env, { [key]: v });
  flush(env);
}

/** a digit, point, minus or Backspace edits the typed value; true when the key was one of those */
export function typeDigit(env: LiveEnv, k: string): boolean {
  const L = env.live!;
  const key = L.tool.live!.param ?? L.tool.live!.wheel;
  const editing = /^[0-9.,]$/.test(k) || (k === "-" && !L.buf) || (k === "Backspace" && !!L.buf);
  if (!key || !editing) return false;
  L.buf = k === "Backspace" ? L.buf.slice(0, -1) : L.buf + k.replace(",", ".");
  const d = paramDef(L.tool, key)!;
  const v = parseFloat(L.buf);
  if (!isFinite(v)) {
    badge(env);
    return true;
  }
  queue(env, { [key]: clamp(v, d.min, d.max) });
  flush(env);
  return true;
}
