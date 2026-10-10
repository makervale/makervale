/** Keys in the app (outside text fields): the active tool first, then the avatar, then the shortcuts. */
import { showWindow, isOpen } from "@/ui/window";
import { comboOf, deleteToolId, escape, TOOL_KEYS } from "./shortcuts";
import type { InputCtx } from "./state";
import { setMods } from "./state";

const MODES = ["object", "auto", "vert", "edge", "face"] as const;
/** framing the selection stands this far back, in units of its radius */
const FRAME_K = 2.4;

const typing = (e: KeyboardEvent): boolean => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
};

export function keyDown(ctx: InputCtx, e: KeyboardEvent): void {
  setMods(ctx, e);
  if (e.key === "Alt") e.preventDefault();
  if (typing(e)) {
    if (e.key === "Escape") (e.target as HTMLElement).blur();
    return;
  }
  if ((ctx.live.active() && ctx.live.key(e)) || ctx.avatar.key(e, true)) {
    e.preventDefault();
    return;
  }
  const cmd = e.ctrlKey || e.metaKey;
  if (e.key === "Enter" && !cmd) {
    e.preventDefault();
    ctx.bus.emit("chat:focus");
    return;
  }
  if (cmd ? commandKey(ctx, e) : plainKey(ctx, e)) e.preventDefault();
}

/** Ctrl / Cmd shortcuts; true when used */
function commandKey(ctx: InputCtx, e: KeyboardEvent): boolean {
  const k = e.key.toLowerCase();
  const building = isOpen("build");
  // undo and redo belong to building
  if ((k === "z" || k === "y") && !building) return true;
  if (k === "z" && e.shiftKey) ctx.commands.redo();
  else if (k === "z") ctx.commands.undo();
  else if (k === "y") ctx.commands.redo();
  else if (k === "k") ctx.bus.emit("menu:command", { command: "catalog" });
  else if (k === "b") showWindow("build");
  else if (k === "s") ctx.bus.emit("menu:command", { command: "save" });
  else return toolKey(ctx, comboOf(k, true, e.shiftKey));
  return true;
}

function toolKey(ctx: InputCtx, combo: string): boolean {
  const id = TOOL_KEYS[combo];
  if (!id || !isOpen("build")) return false;
  ctx.bus.emit("tool:use", { id });
  return true;
}

/** keys without Ctrl; true when the default should be prevented */
function plainKey(ctx: InputCtx, e: KeyboardEvent): boolean {
  const k = e.key.toLowerCase();
  if (toolKey(ctx, comboOf(k, false, e.shiftKey))) return true;
  const { store, commands, bus } = ctx;
  if (k === "/") bus.emit("search:open", { x: ctx.last.x || undefined, y: ctx.last.y || undefined });
  else if (k === "delete" || k === "backspace") bus.emit("tool:use", { id: deleteToolId(ctx) });
  else if (k === "tab") commands.setMode(store.selection.mode === "object" ? "auto" : "object");
  else return otherKey(ctx, k);
  return true;
}

/** keys that keep their default action */
function otherKey(ctx: InputCtx, k: string): boolean {
  const { store, commands, renderer } = ctx;
  if (k === "escape") escape(ctx);
  else if (k === "f" && store.selection.objects.size) renderer.framing.frame(store.selected(), undefined, FRAME_K);
  else if (k === "g") {
    commands.setSettings({ snap: !store.settings.snap });
    commands.notice("Snap: " + (store.settings.snap ? "on" : "off"));
  } else if (k.length === 1 && "12345".includes(k)) commands.setMode(MODES[Number(k) - 1]);
  return false;
}
