/**
 * A live tool's life: it starts (or waits for a pick), runs at once with its defaults, re-runs as the values
 * change, and ends confirmed (the result stays) or cancelled (it is undone).
 */
import * as THREE from "three";
import { needReason } from "@/app/tool-needs";
import type { Params, ToolDef } from "@/app/tools";
import type { Entry } from "@/world/history";
import { regionNormal, screenAxis } from "./axis";
import type { Live, LiveEnv } from "./env";
import { inView } from "./env";
import { badge, banner, clearFeedback, drawHelper } from "./feedback";

export function newLive(env: LiveEnv, tool: ToolDef, phase: Live["phase"]): Live {
  const pivot = env.manip.pivotOf(env.store.selected());
  const { x, y } = env.cursor;
  const base = { tool, phase, p: {}, entry: null, pivot, p0: 0, x0: x, y0: y, buf: "", pending: null, raf: 0 };
  return { ...base, rebase: false, settle: false, settleTimer: 0, knife: null };
}

/** activate a tool: live tools stay active until confirmed, the others just run */
export function startLive(env: LiveEnv, t: ToolDef, over?: Params): boolean {
  if (env.live) confirmLive(env); // picking another tool keeps what the previous one did
  if (!t.live) return env.runner.run(t.id, over);
  const { store, commands } = env;
  const pick = t.live.pick;
  // tools that click on the mesh enter mesh editing by themselves when one object is selected
  if (pick && !store.editTarget() && store.selected().length === 1) commands.setMode(pick === "edge" ? "edge" : "auto");
  if (pick === "knife") return startKnife(env, t);
  if (pick === "edge" && store.editTarget() && !store.selection.elements.edges.size) return waitForPick(env, t);
  const reason = needReason(store, t.need);
  if (reason) {
    commands.notice(reason);
    return false;
  }
  return begin(env, t, over);
}

function startKnife(env: LiveEnv, t: ToolDef): boolean {
  if (env.store.editTarget()) return waitForPick(env, t);
  env.commands.notice("The knife cuts the mesh of one object: enter mesh editing (Tab)");
  return false;
}

function waitForPick(env: LiveEnv, t: ToolDef): boolean {
  env.live = newLive(env, t, "pick");
  banner(env);
  return true;
}

/** run the tool with its defaults and start adjusting */
export function begin(env: LiveEnv, t: ToolDef, over?: Params): boolean {
  const spec = t.live!;
  const L = newLive(env, t, "adjust");
  L.p = { ...defaults(t), ...over };
  if (spec.param && (spec.mode ?? "axis") === "axis") {
    const a = spec.axis ? spec.axis(env.runner.context(), L.p) : regionNormal(env.runner.context(), env.renderer.views);
    if (a) {
      L.A = new THREE.Vector3().fromArray(a).normalize();
      L.screenAxis = screenAxis(env.renderer.picker, L.pivot, L.A);
    }
  }
  const before = env.commands.history.last();
  if (!env.runner.run(t.id, L.p)) return false;
  L.entry = ownEntry(env, t, before);
  L.p0 = spec.param ? L.p[spec.param] : 0;
  if (!inView(env, env.cursor.x, env.cursor.y)) startedFromPanel(env, L);
  env.live = L;
  banner(env);
  badge(env);
  drawHelper(env);
  return true;
}

const defaults = (t: ToolDef): Params => Object.fromEntries((t.params ?? []).map((d) => [d.key, d.def]));

/** started from a panel: measure from the selection's spot on screen, not from the panel */
function startedFromPanel(env: LiveEnv, L: Live): void {
  const q = env.renderer.picker.screenOf(L.pivot);
  L.x0 = q.x;
  L.y0 = q.y;
  if (L.tool.live!.param && L.A) L.p0 = 0;
  else if (L.tool.live!.param) L.settle = true;
}

/** the history entry the tool just made, or null when the run changed nothing */
export function ownEntry(env: LiveEnv, t: ToolDef, before: Entry | undefined): Entry | null {
  const e = env.commands.history.last();
  return e && e !== before && e.tool?.id === t.id ? e : null;
}

/** new values: applied once per frame, however fast the mouse moves */
export function queue(env: LiveEnv, p: Params): void {
  const L = env.live!;
  L.pending = { ...L.pending, ...p };
  if (!L.raf) L.raf = requestAnimationFrame(() => flush(env));
}

export function flush(env: LiveEnv): void {
  const L = env.live;
  if (!L) return;
  L.raf = 0;
  const p = L.pending;
  L.pending = null;
  if (!p || Object.keys(p).every((k) => p[k] === L.p[k])) return;
  L.p = { ...L.p, ...p };
  const history = env.commands.history;
  // re-run our own entry; if the previous value changed nothing there is no entry yet, so run fresh
  if (L.entry && history.last() === L.entry) {
    const before = history.undoStack[history.undoStack.length - 2];
    L.entry = env.runner.rerunLast(p) ? ownEntry(env, L.tool, before) : null;
  } else {
    const before = history.last();
    L.entry = env.runner.run(L.tool.id, L.p) ? ownEntry(env, L.tool, before) : null;
  }
  badge(env);
  drawHelper(env);
}

export function confirmLive(env: LiveEnv): void {
  const L = env.live;
  if (!L) return;
  if (L.knife) env.commands.finishHeld();
  env.live = null;
  clearFeedback(env);
  if (L.tool.params?.length && L.entry) {
    env.commands.notice(L.tool.name + ": done. You can still change the values in the last-operation panel.");
  }
}

export function cancelLive(env: LiveEnv): void {
  const L = env.live;
  if (!L) return;
  env.live = null;
  const { commands, bus } = env;
  if (L.phase === "adjust" && L.entry && commands.history.last() === L.entry) commands.undo();
  if (L.knife) {
    commands.cancelHeld();
    bus.emit("selection:changed");
  }
  clearFeedback(env);
  commands.notice(L.tool.name + ": cancelled");
}
